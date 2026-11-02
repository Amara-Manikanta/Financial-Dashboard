import Foundation
import UIKit
import ImageIO

/// Everything the native screens show, loaded from the Mac and derived with the
/// same rules as the web app (see Core/ and the parity tests).
///
/// Read-only for now. A write from the phone would have to go through the
/// per-row endpoints and version checks the Mac uses; until that is built and
/// tested, nothing here can change a record.
@MainActor
final class FinanceStore: ObservableObject {
    @Published private(set) var data = Derived()
    @Published private(set) var isLoading = false
    @Published private(set) var loadedAt: Date?
    @Published var errorMessage: String?
    /// Latest outside-research call per holding id (read-only; from the Mac's Research tab).
    @Published private(set) var research: [String: ResearchCall] = [:]

    // The screens read these; each is one field of `data`.
    var years: [YearSummary] { data.years }
    var portfolio: Stocks.Portfolio { data.portfolio }
    var netWorth: NetWorthSummary { data.netWorth }
    var savings: SavingsPage.Summary { data.savings }
    var investments: InvestmentsPage.Summary { data.investments }
    var people: LoansPage.People { data.people }
    var loans: LoansPage.Loans { data.loans }
    var capitalGains: CapitalGainsPage.Page { data.capitalGains }
    var watchlist: WatchlistPage.Summary { data.watchlist }
    var ipos: IpoPage.Summary { data.ipos }
    var returns: ReturnsPage.Page { data.returns }
    var dividends: DividendPage.Page { data.dividends }
    var freeHoldings: FreeHoldingsPage.Page { data.freeHoldings }

    /// Reads that are not part of the database: a stock's fundamentals check and ten years of the Nifty.
    /// The research calls are optional: an older Mac without the route simply leaves them empty.
    func loadResearch() async {
        guard let body = try? await api.get(path: "api/analyst/strategy", query: [URLQueryItem(name: "limit", value: "120")]) else { return }
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; f.locale = Locale(identifier: "en_US_POSIX")
        research = ResearchCall.parse(body, today: f.string(from: Date()))
    }

    func fundamentals(for symbol: String) async -> JSONValue? {
        guard let json = try? await api.get(path: "api/stock-financials", query: [URLQueryItem(name: "symbol", value: symbol)]),
              !json["signal"].isNull else { return nil }
        return json
    }

    // MARK: Records (one at a time, version-checked)

    func record(_ collection: String, id: String) async throws -> (value: JSONValue, version: String?) {
        try await api.record(collection, id: id)
    }

    // MARK: Writing — online straight to the Mac; away from it, kept on the phone and sent when it is back

    /// Saves changed fields of one record. `original` is the record as the screen read it, so a field that has
    /// changed on the Mac since is noticed rather than overwritten.
    func saveRecord(_ collection: String, id: String, fields: [String: Any], original: JSONValue, stampUpdated: Bool, label: String) async -> String? {
        let expected = Dictionary(uniqueKeysWithValues: fields.keys.map { ($0, original[$0]) })
        return await perform(collection: collection, id: id, op: .fields(fields, expected: expected), stamp: stampUpdated, label: label)
    }

    /// The stock-market account that holds a holding, so its transactions can be changed.
    func stockAccountId(holding id: String) -> String? {
        data.savingsRaw.array.first { $0["type"].text == "stock_market" && $0["stocks"].array.contains { $0["id"].text == id } }?["id"].text
    }


    /// Applies one change to one holding's transactions (the holding's shares, average cost and dividends are replayed).
    /// Nil when saved — or when saved on the phone to be sent later — otherwise why nothing changed.
    func saveStockTransaction(holding id: String, change: StockLedger.Change) async -> String? {
        guard let accountId = stockAccountId(holding: id) else { return "That holding is no longer on your Mac. Nothing was changed." }
        return await perform(collection: "savings", id: accountId, op: .stock(holdingId: id, change), stamp: true, label: "Stock transaction")
    }

    /// A change to an asset category — an item, its entries, services, receipts or units.
    func saveAsset(category: String, _ op: AssetOp, label: String) async -> String? {
        await perform(collection: "assets", id: category, op: .asset(op), stamp: true, label: label)
    }

    /// Uploads a receipt or other paperwork to the Mac's `db/documents`. Needs the Mac: the file is stored there, so it cannot be queued.
    func uploadDocument(_ data: Data, mimeType: String, fileName: String, label: String) async -> Result<String, UploadFailure> {
        if data.count > 10 * 1024 * 1024 { return .failure(UploadFailure(message: "That file is larger than 10 MB.")) }
        if mirror?.offline == true { return .failure(UploadFailure(message: "Uploading needs your Mac. Connect to it and try again.")) }
        let body: [String: Any] = ["dataUrl": "data:\(mimeType);base64,\(data.base64EncodedString())", "name": label, "folder": "documents"]
        do {
            let r = try await api.send("POST", path: "api/upload", body: body, timeout: 120)
            if (200...299).contains(r.status), r.body["url"].truthy { return .success(r.body["url"].text) }
            return .failure(UploadFailure(message: r.body["error"].truthy ? r.body["error"].text : "Upload failed (\(r.status))."))
        } catch { return .failure(UploadFailure(message: error.localizedDescription)) }
    }

    struct UploadFailure: Error { let message: String }

    /// A file the Mac stores (a receipt), for viewing.
    func documentData(_ path: String) async -> Data? {
        if let d = try? await api.data(path: path) { return d }
        return nil
    }

    /// Adds, changes or deletes one row (by id) of a list inside a person's or loan's record.
    func saveListRow(collection: String, id: String, key: String, _ change: DepositLedger.ListChange, label: String) async -> String? {
        await perform(collection: collection, id: id, op: .list(key: key, change), stamp: true, label: label)
    }

    /// Changes one row of one list of a savings account (deposits, instalments, ledger rows…). Nil when saved.
    func saveAccount(_ accountId: String, _ op: AccountOp, label: String) async -> String? {
        await perform(collection: "savings", id: accountId, op: op, stamp: true, label: label)
    }

    /// The one path every record change takes. Online: load the record fresh with its version, build the patch from
    /// it, send it under that version. Not reachable: build the same patch from the phone's copy, apply it there so
    /// the screens show it, and queue the *intent* — it is rebuilt against the Mac's record when the Mac is back.
    private func perform(collection: String, id: String, op: AccountOp, stamp: Bool, label: String) async -> String? {
        func stamped(_ f: [String: Any], _ record: JSONValue) -> [String: Any] {
            var f = f
            if stamp && !record["updatedAt"].isNull { f["updatedAt"] = ISO8601DateFormatter.withMillis.string(from: Date()) }
            return f
        }
        if mirror?.offline != true {
            do {
                let fresh = try await api.record(collection, id: id)
                if mirror?.offline != true {
                    switch op.patch(for: fresh.value) {
                    case .failure(let failure): return failure.message
                    case .success(let fields):
                        switch await api.patchRecordOutcome(collection, id: id, fields: stamped(fields, fresh.value), version: fresh.version) {
                        case .ok: await load(); return nil
                        case .refused(let m): return m
                        case .unauthorized: onUnauthorized(); return APIError.unauthorized.errorDescription
                        case .unreachable: mirror?.setOffline(true)
                        }
                    }
                }
            } catch APIError.unauthorized { onUnauthorized(); return APIError.unauthorized.errorDescription
            } catch APIError.unreachable { mirror?.setOffline(true)
            } catch { return error.localizedDescription }
        }
        guard let mirror, let cached = mirror.record(collection, id: id) else {
            return "This record has not been downloaded to the phone yet. Connect to your Mac once, then try again."
        }
        switch op.patch(for: cached) {
        case .failure(let failure): return failure.message
        case .success(let fields):
            let applied = stamped(fields, cached)
            mirror.modify(collection) { LocalApply.patchRecord(&$0, id: id, fields: applied) }
            mirror.enqueue(OfflineOp(id: UUID().uuidString, created: Date(), label: label, kind: .account(collection: collection, id: id, op)))
            await rebuildFromMirror()
            return nil
        }
    }

    /// Creates one new savings account (a single-record POST, never a whole-collection write). Nil when saved.
    func createAccount(_ account: [String: Any]) async -> String? {
        if mirror?.offline != true {
            do {
                let r = try await api.send("POST", path: "savings", body: account)
                if (200...299).contains(r.status) { await load(); return nil }
                return r.body["reason"].truthy ? r.body["reason"].text : r.body["error"].truthy ? r.body["error"].text : "Your Mac refused the new account (\(r.status)); nothing was added."
            } catch APIError.unauthorized { onUnauthorized(); return APIError.unauthorized.errorDescription
            } catch { mirror?.setOffline(true) }
        }
        guard let mirror else { return APIError.unreachable.errorDescription }
        guard mirror.modify("savings", { LocalApply.appendRecord(&$0, record: account) }) else {
            return "Your savings have not been downloaded to the phone yet. Connect to your Mac once, then try again."
        }
        mirror.enqueue(OfflineOp(id: UUID().uuidString, created: Date(), label: "New account \(account["title"] as? String ?? "")", kind: .createAccount(account)))
        await rebuildFromMirror()
        return nil
    }

    // MARK: Transactions (one row at a time)

    private func performTx(_ kind: OfflineOp.Kind, label: String) async -> String? {
        if mirror?.offline != true {
            let outcome: API.Outcome
            switch kind {
            case .txPost(let b): outcome = await api.writeTransactionOutcome("POST", body: b)
            case .txPatch(let id, let b): outcome = await api.writeTransactionOutcome("PATCH", id: id, body: b)
            case .txDelete(let id): outcome = await api.writeTransactionOutcome("DELETE", id: id)
            default: return nil
            }
            switch outcome {
            case .ok: await load(); return nil
            case .refused(let m): return m
            case .unauthorized: onUnauthorized(); return APIError.unauthorized.errorDescription
            case .unreachable: mirror?.setOffline(true)
            }
        }
        guard let mirror else { return APIError.unreachable.errorDescription }
        var found = true
        let stored = mirror.modify("expenses") { e in
            switch kind {
            case .txPost(let b): LocalApply.addTransaction(&e, body: b)
            case .txPatch(let id, let f): found = LocalApply.patchTransaction(&e, id: id, fields: f)
            case .txDelete(let id): found = LocalApply.deleteTransaction(&e, id: id)
            default: break
            }
        }
        guard stored else { return "Your expenses have not been downloaded to the phone yet. Connect to your Mac once, then try again." }
        guard found else { return "That transaction is no longer on the phone's copy — refresh and look again. Nothing was changed." }
        mirror.enqueue(OfflineOp(id: UUID().uuidString, created: Date(), label: label, kind: kind))
        await rebuildFromMirror()
        return nil
    }

    /// Saves one new transaction. Returns nil when saved, or the reason it was not.
    func addTransaction(_ draft: NewTransaction.Draft) async -> String? {
        let map = Budgets.categoryMap(appData: data.appDataRaw)
        return await performTx(.txPost(NewTransaction.body(draft, map: map)), label: "New transaction · \(draft.title)")
    }

    /// Changes one transaction (only the fields in `patch`).
    func updateTransaction(id: String, patch: [String: Any]) async -> String? {
        await performTx(.txPatch(id: id, patch), label: "Change transaction")
    }

    /// Removes one transaction.
    func deleteTransaction(id: String) async -> String? {
        await performTx(.txDelete(id: id), label: "Delete transaction")
    }

    // MARK: News (read and collected on the Mac; the phone only asks)

    private func newsQuery(_ symbol: String, _ name: String) -> [URLQueryItem] {
        [URLQueryItem(name: "symbol", value: symbol), URLQueryItem(name: "name", value: name)]
    }

    /// Stories already stored for a stock (`db/news/<SYMBOL>.csv` on the Mac).
    func storedNews(symbol: String, name: String) async throws -> [JSONValue] {
        let r = try await api.send("GET", path: "api/analyst/news/stored", query: newsQuery(symbol, name))
        guard r.status == 200 else { throw APIError.server(r.status) }
        return r.body["items"].array
    }

    /// Fetches fresh headlines on the Mac (skipping its cache). Returns a sentence for the screen.
    func fetchNews(symbol: String, name: String) async -> String {
        do {
            let r = try await api.send("GET", path: "api/analyst/news", query: newsQuery(symbol, name) + [URLQueryItem(name: "fresh", value: "1")], timeout: 60)
            if r.status != 200 { return r.body["error"].truthy ? r.body["error"].text : "The Mac could not fetch news (\(r.status))." }
            let added = Int(r.body["archive"]["added"].double)
            let errors = r.body["errors"].array.map(\.text).filter { !$0.isEmpty }
            return "\(added) new \(added == 1 ? "story" : "stories")" + (errors.isEmpty ? "" : " · " + errors.joined(separator: "; "))
        } catch { return error.localizedDescription }
    }

    /// Has the Mac read up to five unread stories (Claude or the local model, whichever it uses).
    func analyseNews(symbol: String, name: String) async -> String {
        do {
            let r = try await api.send("POST", path: "api/analyst/news/analyse", query: newsQuery(symbol, name) + [URLQueryItem(name: "count", value: "5")], timeout: 300)
            let b = r.body
            if r.status != 200 { return b["error"].truthy ? b["error"].text : "The Mac could not analyse news (\(r.status))." }
            if b["modelUnavailable"].truthy {
                let why = b["errors"][0].text
                return b["reader"].text == "claude" ? "Claude unavailable: \(why)" : "No local model is running on the Mac (\(why.isEmpty ? "start LM Studio" : why))."
            }
            var parts = ["\(Int(b["analysed"].double)) analysed"]
            if b["skipped"].double > 0 { parts.append("\(Int(b["skipped"].double)) could not be read") }
            if b["failed"].double > 0 { parts.append("\(Int(b["failed"].double)) failed") }
            return parts.joined(separator: ", ") + "."
        } catch { return error.localizedDescription }
    }

    /// Claude's running brief for a stock, and whether Claude reading is on.
    func claudeBrief(symbol: String) async throws -> (brief: JSONValue, status: JSONValue) {
        let r = try await api.send("GET", path: "api/analyst/claude/brief", query: [URLQueryItem(name: "symbol", value: symbol)])
        guard r.status == 200 else { throw APIError.server(r.status) }
        return (r.body["brief"], r.body["status"])
    }

    /// Reads unread stories with Claude, then updates the brief. Nil when it worked, otherwise why not.
    func refreshClaudeBrief(symbol: String, name: String) async -> String? {
        do {
            let r = try await api.send("POST", path: "api/analyst/claude/brief", query: newsQuery(symbol, name), timeout: 600)
            if r.status == 200 { return nil }
            return r.body["error"].truthy ? r.body["error"].text : "Claude could not update the brief (\(r.status))."
        } catch { return error.localizedDescription }
    }

    func indexCloses() async -> [String: Double]? {
        guard let json = try? await api.get(path: "api/history", query: [URLQueryItem(name: "symbol", value: "^NSEI"), URLQueryItem(name: "range", value: "10y")]) else { return nil }
        var closes: [String: Double] = [:]
        for (k, v) in json["closes"].object { closes[k] = v.double }
        return closes
    }

    /// A photo from the Mac, shrunk to `maxPixel` on its longest side while it is decoded. The
    /// originals are full-camera size (a dozen megapixels, ~50 MB each once decoded), and a gallery
    /// of 59 of them decoded whole is enough to make a phone kill the app. Cached in memory.
    private static let photos = NSCache<NSString, UIImage>()
    func photo(_ path: String, maxPixel: CGFloat = 700) async -> UIImage? {
        let key = "\(path)@\(Int(maxPixel))" as NSString
        if let hit = Self.photos.object(forKey: key) { return hit }
        let diskKey = "photo-\(key)"
        // Away from the Mac, the thumbnail kept from the last time it was shown.
        func fromDisk() -> UIImage? { mirror?.get(diskKey).flatMap { UIImage(data: $0) } }
        if mirror?.offline == true { return fromDisk() }
        guard let data = try? await api.data(path: path) else { return fromDisk() }
        let image = await Task.detached(priority: .userInitiated) { () -> UIImage? in
            guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
            let options: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true,
                                            kCGImageSourceShouldCacheImmediately: true, kCGImageSourceThumbnailMaxPixelSize: maxPixel]
            return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary).map { UIImage(cgImage: $0) }
        }.value
        if let image {
            Self.photos.setObject(image, forKey: key, cost: Int(image.size.width * image.size.height * 4))
            if let jpeg = image.jpegData(compressionQuality: 0.8) { mirror?.put(diskKey, jpeg) }
        }
        return image
    }

    // MARK: Offline and syncing

    @Published private(set) var offline = false
    @Published private(set) var syncedAt: Date?
    @Published private(set) var pending: [OfflineOp] = []
    @Published private(set) var isSyncing = false

    private let mirror: LocalMirror?

    private func publishSyncState() {
        offline = mirror?.offline ?? false
        syncedAt = mirror?.syncedAt
        pending = mirror?.ops ?? []
    }

    /// Rebuilds every screen from the phone's own copy (after a change made away from the Mac).
    private func rebuildFromMirror() async {
        if let mirror, let raw = RawData.fromMirror(mirror) {
            data = await Task.detached(priority: .userInitiated) { Derived.compute(raw) }.value
        }
        publishSyncState()
    }

    /// Sends the queued changes, oldest first. One that can no longer be made (its row moved, the record is gone)
    /// is held with the reason for the user to look at; the rest still go. Stops quietly if the Mac goes away.
    private func syncPending() async {
        guard let mirror else { return }
        isSyncing = true; defer { isSyncing = false }
        for op in mirror.ops where op.state == .pending {
            switch await replay(op) {
            case .done: mirror.remove(op.id)
            case .conflict(let why): mirror.update(op.id) { $0.state = .conflict; $0.message = why }
            case .unreachable: mirror.setOffline(true); return
            case .unauthorized: onUnauthorized(); return
            }
        }
    }

    private enum Replay { case done, conflict(String), unreachable, unauthorized }

    private func replay(_ op: OfflineOp) async -> Replay {
        func map(_ o: API.Outcome) -> Replay {
            switch o { case .ok: return .done; case .refused(let m): return .conflict(m); case .unreachable: return .unreachable; case .unauthorized: return .unauthorized }
        }
        switch op.kind {
        case .txPost(let b): return map(await api.writeTransactionOutcome("POST", body: b))
        case .txPatch(let id, let b): return map(await api.writeTransactionOutcome("PATCH", id: id, body: b))
        case .txDelete(let id): return map(await api.writeTransactionOutcome("DELETE", id: id))
        case .createAccount(let a):
            do {
                let r = try await api.send("POST", path: "savings", body: a)
                if (200...299).contains(r.status) { return .done }
                return .conflict(r.body["reason"].truthy ? r.body["reason"].text : "Your Mac refused the new account (\(r.status)).")
            } catch APIError.unauthorized { return .unauthorized } catch { return .unreachable }
        case .account(let collection, let id, let a):
            let fresh: (value: JSONValue, version: String?)
            do { fresh = try await api.record(collection, id: id) }
            catch APIError.unauthorized { return .unauthorized }
            catch APIError.server(404) { return .conflict("That record is no longer on your Mac.") }
            catch { return .unreachable }
            if mirror?.offline == true { return .unreachable }
            switch a.patch(for: fresh.value) {
            case .failure(let f): return .conflict(f.message)
            case .success(var fields):
                if !fresh.value["updatedAt"].isNull { fields["updatedAt"] = ISO8601DateFormatter.withMillis.string(from: Date()) }
                return map(await api.patchRecordOutcome(collection, id: id, fields: fields, version: fresh.version))
            }
        }
    }

    /// Give up on a held change. The next refresh shows the Mac's own version again.
    func discard(_ id: String) async { mirror?.remove(id); await load() }

    /// Try a held change again.
    func retry(_ id: String) async { mirror?.update(id) { $0.state = .pending; $0.message = nil }; await load() }

    private let api: API
    private let onUnauthorized: () -> Void

    init(api: API, onUnauthorized: @escaping () -> Void) {
        self.api = api
        self.mirror = api.mirror
        self.onUnauthorized = onUnauthorized
        publishSyncState()
    }

    /// Loads everything. With the Mac in reach: first sends any changes made while away, then downloads a fresh copy
    /// (kept on the phone). Without it: shows the last copy, with the changes made since.
    func load() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false; publishSyncState() }
        if mirror != nil {
            switch await api.ping() {
            case .unpaired: onUnauthorized(); return
            case .offline: mirror?.setOffline(true)
            case .online: mirror?.setOffline(false); await syncPending()
            }
        }
        do {
            let raw = try await RawData.fetch(from: api)
            // Deriving every page takes a moment on a phone; keep it off the main thread.
            data = await Task.detached(priority: .userInitiated) { Derived.compute(raw) }.value
            loadedAt = Date()
            if mirror?.offline == false { mirror?.markSynced() }
            await loadResearch()
        } catch APIError.unauthorized {
            onUnauthorized()
        } catch {
            errorMessage = (mirror?.offline == true)
                ? "Your Mac is out of reach and nothing has been saved on this phone yet. Connect to it once on your home Wi-Fi to download your data."
                : error.localizedDescription
        }
    }
}

extension ISO8601DateFormatter {
    /// `2026-10-31T09:15:00.000Z`, the form JavaScript's `toISOString()` writes.
    static let withMillis: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}
