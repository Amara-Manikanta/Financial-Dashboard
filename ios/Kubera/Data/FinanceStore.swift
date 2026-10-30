import Foundation

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
