import Foundation

/// The collections as the Mac serves them.
struct RawData {
    var expenses = JSONValue.null, savings = JSONValue.null, salaryDetails = JSONValue.null, appData = JSONValue.null
    var metals = JSONValue.null, assets = JSONValue.null, loans = JSONValue.null, lents = JSONValue.null
    var watchlist = JSONValue.null, ipoApplications = JSONValue.null, taxes = JSONValue.null, goals = JSONValue.null, creditCards = JSONValue.null

    /// All collections at once; a failure in any one fails the load, so the screens
    /// never show half of a refresh.
    static func fetch(from api: API) async throws -> RawData {
        async let expenses = api.get("expenses"), savings = api.get("savings"), salary = api.get("salaryDetails")
        async let appData = api.get("appData"), metals = api.get("metals"), assets = api.get("assets")
        async let loans = api.get("loans"), lents = api.get("lents"), watchlist = api.get("watchlist"), ipos = api.get("ipoApplications"), taxes = api.get("taxes"), goals = api.get("goals"), cards = api.get("creditCards")
        return RawData(expenses: try await expenses, savings: try await savings, salaryDetails: try await salary, appData: try await appData,
                       metals: try await metals, assets: try await assets, loans: try await loans, lents: try await lents,
                       watchlist: try await watchlist, ipoApplications: try await ipos, taxes: try await taxes, goals: try await goals, creditCards: try await cards)
    }
}

extension RawData {
    /// Everything as last stored on the phone, or nil if any collection has not been downloaded yet.
    static func fromMirror(_ m: LocalMirror) -> RawData? {
        func read(_ k: String) -> JSONValue? { m.get(k).flatMap { try? JSONValue.parse($0) } }
        guard let expenses = read("expenses"), let savings = read("savings"), let salary = read("salaryDetails"), let appData = read("appData"),
              let metals = read("metals"), let assets = read("assets"), let loans = read("loans"), let lents = read("lents"),
              let watchlist = read("watchlist"), let ipos = read("ipoApplications"), let taxes = read("taxes"), let goals = read("goals"), let cards = read("creditCards") else { return nil }
        return RawData(expenses: expenses, savings: savings, salaryDetails: salary, appData: appData, metals: metals, assets: assets, loans: loans, lents: lents,
                       watchlist: watchlist, ipoApplications: ipos, taxes: taxes, goals: goals, creditCards: cards)
    }
}

/// Every figure the screens show, derived from `RawData` with the same rules as the
/// web app (see Core/ and the parity tests). One value, so a refresh swaps the whole
/// picture at once.
struct Derived {
    var years: [YearSummary] = []
    var portfolio = Stocks.Portfolio(holdings: [])
    var netWorth = NetWorthSummary()
    var savings = SavingsPage.Summary()
    var investments = InvestmentsPage.Summary()
    var people = LoansPage.People()
    var loans = LoansPage.Loans()
    var capitalGains = CapitalGainsPage.Page()
    var watchlist = WatchlistPage.Summary()
    var ipos = IpoPage.Summary()
    var returns = ReturnsPage.Page()
    var dividends = DividendPage.Page()
    var freeHoldings = FreeHoldingsPage.Page()
    /// Kept for the overlap page, whose basis and fund focus change on screen and so cannot be precomputed.
    var savingsRaw = JSONValue.null
    var watchlistRaw = JSONValue.null
    var salaryRaw = JSONValue.null
    var taxesRaw = JSONValue.null
    var goalsRaw = JSONValue.null
    var metalsRaw = JSONValue.null
    var assetsRaw = JSONValue.null
    var expensesRaw = JSONValue.null
    var loansRaw = JSONValue.null
    var creditCardsRaw = JSONValue.null
    var lentsRaw = JSONValue.null
    var appDataRaw = JSONValue.null

    static func compute(_ raw: RawData, asOf: Date = Date()) -> Derived {
        var d = Derived()
        let account = raw.savings.array.first { $0["type"].text == "stock_market" } ?? .null
        let openAccount = raw.savings.array.first { $0["type"].text == "stock_market" && !$0["isArchived"].truthy } ?? .null
        // A rate typed in by hand wins; without one the web app uses a live feed this
        // phone does not fetch, so a value that depends on it can differ.
        let manual = raw.appData["manualMetalRates"]
        let rates = NetWorth.MetalRates(manualGold: manual["gold"].double, manualSilver: manual["silver"].double)

        d.years = ExpenseLedger.years(expenses: raw.expenses, categoryKinds: TransactionKind.categoryKinds(from: raw.appData), salaryDetails: raw.salaryDetails)
        d.portfolio = Stocks.portfolio(account: account)
        d.netWorth = NetWorth.summary(savings: raw.savings, metals: raw.metals, assets: raw.assets, loans: raw.loans, rates: rates, asOf: asOf)
        d.savings = SavingsPage.summary(savings: raw.savings, salaryDetails: raw.salaryDetails, employments: raw.appData["employments"], asOf: asOf)
        d.investments = InvestmentsPage.summary(savings: raw.savings, asOf: asOf)
        d.people = LoansPage.people(lents: raw.lents)
        d.loans = LoansPage.loans(raw.loans, now: asOf)
        d.capitalGains = CapitalGainsPage.page(savings: raw.savings, asOf: asOf)
        d.watchlist = WatchlistPage.summary(raw.watchlist)
        d.ipos = IpoPage.summary(applications: raw.ipoApplications, stocks: openAccount["stocks"].array)
        d.returns = ReturnsPage.page(savings: raw.savings, asOf: asOf)
        d.dividends = DividendPage.page(savings: raw.savings, asOf: asOf)
        d.freeHoldings = FreeHoldingsPage.page(savings: raw.savings)
        d.savingsRaw = raw.savings
        d.watchlistRaw = raw.watchlist
        d.salaryRaw = raw.salaryDetails
        d.taxesRaw = raw.taxes
        d.goalsRaw = raw.goals
        d.metalsRaw = raw.metals
        d.assetsRaw = raw.assets
        d.expensesRaw = raw.expenses
        d.loansRaw = raw.loans
        d.creditCardsRaw = raw.creditCards
        d.lentsRaw = raw.lents
        d.appDataRaw = raw.appData
        return d
    }
}
