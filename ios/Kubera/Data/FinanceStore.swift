import Foundation

/// Everything the native screens show, loaded from the Mac and derived with the
/// same rules as the web app (see Core/ and the parity tests).
///
/// Read-only for now. A write from the phone would have to go through the
/// per-row endpoints and version checks the Mac uses; until that is built and
/// tested, nothing here can change a record.
@MainActor
final class FinanceStore: ObservableObject {
    @Published private(set) var years: [YearSummary] = []
    @Published private(set) var portfolio = Stocks.Portfolio(holdings: [])
    @Published private(set) var isLoading = false
    @Published private(set) var loadedAt: Date?
    @Published var errorMessage: String?

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
            async let expenses = api.get("expenses")
            async let savings = api.get("savings")
            async let salary = api.get("salaryDetails")
            async let appData = api.get("appData")
            let (e, s, d, a) = try await (expenses, savings, salary, appData)

            let computed = await Task.detached(priority: .userInitiated) { () -> ([YearSummary], Stocks.Portfolio) in
                let kinds = TransactionKind.categoryKinds(from: a)
                let years = ExpenseLedger.years(expenses: e, categoryKinds: kinds, salaryDetails: d)
                let account = s.array.first { $0["type"].text == "stock_market" } ?? .null
                return (years, Stocks.portfolio(account: account))
            }.value
            years = computed.0
            portfolio = computed.1
            loadedAt = Date()
        } catch APIError.unauthorized {
            onUnauthorized()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
