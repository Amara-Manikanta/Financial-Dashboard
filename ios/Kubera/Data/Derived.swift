import Foundation

/// The collections as the Mac serves them.
struct RawData {
    var expenses = JSONValue.null, savings = JSONValue.null, salaryDetails = JSONValue.null, appData = JSONValue.null
    var metals = JSONValue.null, assets = JSONValue.null, loans = JSONValue.null, lents = JSONValue.null
    var watchlist = JSONValue.null, ipoApplications = JSONValue.null

    /// All collections at once; a failure in any one fails the load, so the screens
    /// never show half of a refresh.
    static func fetch(from api: API) async throws -> RawData {
        async let expenses = api.get("expenses"), savings = api.get("savings"), salary = api.get("salaryDetails")
        async let appData = api.get("appData"), metals = api.get("metals"), assets = api.get("assets")
        async let loans = api.get("loans"), lents = api.get("lents"), watchlist = api.get("watchlist"), ipos = api.get("ipoApplications")
        return RawData(expenses: try await expenses, savings: try await savings, salaryDetails: try await salary, appData: try await appData,
                       metals: try await metals, assets: try await assets, loans: try await loans, lents: try await lents,
                       watchlist: try await watchlist, ipoApplications: try await ipos)
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
        return d
    }
}
