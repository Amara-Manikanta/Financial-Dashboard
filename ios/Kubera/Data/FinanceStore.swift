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
    @Published private(set) var netWorth = NetWorthSummary()
    @Published private(set) var savings = SavingsPage.Summary()
    @Published private(set) var investments = InvestmentsPage.Summary()
    @Published private(set) var people = LoansPage.People()
    @Published private(set) var loans = LoansPage.Loans()
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
            async let savingsData = api.get("savings")
            async let salary = api.get("salaryDetails")
            async let appData = api.get("appData")
            async let metals = api.get("metals")
            async let assets = api.get("assets")
            async let loansData = api.get("loans")
            async let lentsData = api.get("lents")
            let (e, s, d, a, m, as_, l, lents) = try await (expenses, savingsData, salary, appData, metals, assets, loansData, lentsData)

            let computed = await Task.detached(priority: .userInitiated) { () -> ([YearSummary], Stocks.Portfolio, NetWorthSummary, SavingsPage.Summary, InvestmentsPage.Summary, LoansPage.People, LoansPage.Loans) in
                let kinds = TransactionKind.categoryKinds(from: a)
                let years = ExpenseLedger.years(expenses: e, categoryKinds: kinds, salaryDetails: d)
                let account = s.array.first { $0["type"].text == "stock_market" } ?? .null
                // A rate typed in by hand wins; without one the web app uses a live feed
                // this phone does not fetch, so a value that depends on it can differ.
                let manual = a["manualMetalRates"]
                let rates = NetWorth.MetalRates(manualGold: manual["gold"].double, manualSilver: manual["silver"].double)
                let worth = NetWorth.summary(savings: s, metals: m, assets: as_, loans: l, rates: rates)
                let savingsSummary = SavingsPage.summary(savings: s, salaryDetails: d, employments: a["employments"])
                return (years, Stocks.portfolio(account: account), worth, savingsSummary, InvestmentsPage.summary(savings: s), LoansPage.people(lents: lents), LoansPage.loans(l))
            }.value
            years = computed.0
            portfolio = computed.1
            netWorth = computed.2
            savings = computed.3
            investments = computed.4
            people = computed.5
            loans = computed.6
            loadedAt = Date()
        } catch APIError.unauthorized {
            onUnauthorized()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
