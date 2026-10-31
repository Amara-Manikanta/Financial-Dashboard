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
    func fundamentals(for symbol: String) async -> JSONValue? {
        guard let json = try? await api.get(path: "api/stock-financials", query: [URLQueryItem(name: "symbol", value: symbol)]),
              !json["signal"].isNull else { return nil }
        return json
    }

    // MARK: Records (one at a time, version-checked)

    func record(_ collection: String, id: String) async throws -> (value: JSONValue, version: String?) {
        try await api.record(collection, id: id)
    }

    /// Saves changed fields of one record, then reloads every screen. Nil when saved.
    func saveRecord(_ collection: String, id: String, fields: [String: Any], version: String?, stampUpdated: Bool) async -> String? {
        var fields = fields
        if stampUpdated { fields["updatedAt"] = ISO8601DateFormatter.withMillis.string(from: Date()) }
        if let failure = await api.patchRecord(collection, id: id, fields: fields, version: version) { return failure }
        await load()
        return nil
    }

    /// The stock-market account that holds a holding, so its transactions can be changed.
    func stockAccountId(holding id: String) -> String? {
        data.savingsRaw.array.first { $0["type"].text == "stock_market" && $0["stocks"].array.contains { $0["id"].text == id } }?["id"].text
    }

    /// Applies one change to one holding's transactions. The account is loaded fresh with its version
    /// at the moment of saving, the change is made on that copy and the holding's figures replayed, and
    /// the write carries the version — so only a change landing in that instant can be refused.
    /// Nil when saved, otherwise why nothing changed.
    func saveStockTransaction(holding id: String, change: StockLedger.Change) async -> String? {
        guard let accountId = stockAccountId(holding: id) else { return "That holding is no longer on your Mac. Nothing was changed." }
        do {
            let fresh = try await api.record("savings", id: accountId)
            switch StockLedger.updatedStocks(account: fresh.value, stockId: id, change: change) {
            case .failure(let failure): return failure.message
            case .success(let stocks):
                var fields: [String: Any] = ["stocks": stocks]
                if !fresh.value["updatedAt"].isNull { fields["updatedAt"] = ISO8601DateFormatter.withMillis.string(from: Date()) }
                if let failure = await api.patchRecord("savings", id: accountId, fields: fields, version: fresh.version) { return failure }
            }
        } catch { return error.localizedDescription }
        await load()
        return nil
    }

    /// Changes one savings account the way a deposit page does: the account is loaded fresh with its
    /// version, `build` works out the fields to change from that copy, and they are sent under the
    /// version — so a stale phone is refused, never allowed to overwrite. Nil when saved.
    func saveAccountChange(accountId: String, _ build: (JSONValue) -> Result<[String: Any], DepositLedger.Failure>) async -> String? {
        do {
            let fresh = try await api.record("savings", id: accountId)
            switch build(fresh.value) {
            case .failure(let failure): return failure.message
            case .success(var fields):
                if !fresh.value["updatedAt"].isNull { fields["updatedAt"] = ISO8601DateFormatter.withMillis.string(from: Date()) }
                if let failure = await api.patchRecord("savings", id: accountId, fields: fields, version: fresh.version) { return failure }
            }
        } catch { return error.localizedDescription }
        await load()
        return nil
    }

    /// Creates one new savings account (a single-record POST, never a whole-collection write). Nil when saved.
    func createAccount(_ account: [String: Any]) async -> String? {
        do {
            let r = try await api.send("POST", path: "savings", body: account)
            if !(200...299).contains(r.status) {
                return r.body["reason"].truthy ? r.body["reason"].text : r.body["error"].truthy ? r.body["error"].text : "Your Mac refused the new account (\(r.status)); nothing was added."
            }
        } catch { return error.localizedDescription }
        await load()
        return nil
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
        guard let data = try? await api.data(path: path) else { return nil }
        let image = await Task.detached(priority: .userInitiated) { () -> UIImage? in
            guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
            let options: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true,
                                            kCGImageSourceShouldCacheImmediately: true, kCGImageSourceThumbnailMaxPixelSize: maxPixel]
            return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary).map { UIImage(cgImage: $0) }
        }.value
        if let image { Self.photos.setObject(image, forKey: key, cost: Int(image.size.width * image.size.height * 4)) }
        return image
    }

    /// Saves one new transaction, then reloads so every screen shows what the Mac actually holds.
    /// Returns nil when saved, or the reason it was not.
    func addTransaction(_ draft: NewTransaction.Draft) async -> String? {
        let map = Budgets.categoryMap(appData: data.appDataRaw)
        if let failure = await api.addTransaction(NewTransaction.body(draft, map: map)) { return failure }
        await load()
        return nil
    }

    /// Changes one transaction (only the fields in `patch`), then reloads.
    func updateTransaction(id: String, patch: [String: Any]) async -> String? {
        if let failure = await api.writeTransaction("PATCH", id: id, body: patch) { return failure }
        await load()
        return nil
    }

    /// Removes one transaction, then reloads.
    func deleteTransaction(id: String) async -> String? {
        if let failure = await api.writeTransaction("DELETE", id: id) { return failure }
        await load()
        return nil
    }

    private let api: API
    private let onUnauthorized: () -> Void

    init(api: API, onUnauthorized: @escaping () -> Void) {
        self.api = api
        self.onUnauthorized = onUnauthorized
    }

    func load() async {
        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let raw = try await RawData.fetch(from: api)
            // Deriving every page takes a moment on a phone; keep it off the main thread.
            data = await Task.detached(priority: .userInitiated) { Derived.compute(raw) }.value
            loadedAt = Date()
        } catch APIError.unauthorized {
            onUnauthorized()
        } catch {
            errorMessage = error.localizedDescription
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
