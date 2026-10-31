import Foundation
import UIKit

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

    func indexCloses() async -> [String: Double]? {
        guard let json = try? await api.get(path: "api/history", query: [URLQueryItem(name: "symbol", value: "^NSEI"), URLQueryItem(name: "range", value: "10y")]) else { return nil }
        var closes: [String: Double] = [:]
        for (k, v) in json["closes"].object { closes[k] = v.double }
        return closes
    }

    /// A photo from the Mac, kept in memory so scrolling back does not fetch it again.
    private static let photos = NSCache<NSString, UIImage>()
    func photo(_ path: String) async -> UIImage? {
        if let hit = Self.photos.object(forKey: path as NSString) { return hit }
        guard let data = try? await api.data(path: path), let image = UIImage(data: data) else { return nil }
        Self.photos.setObject(image, forKey: path as NSString)
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
