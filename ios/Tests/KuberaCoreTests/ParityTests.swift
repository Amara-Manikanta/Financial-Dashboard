import XCTest
@testable import KuberaCore

/// Reproduces, to the paisa, what the web app computes from a real database.
/// Skipped unless Tests/run-parity.sh has produced a golden file — the data is
/// someone's actual finances and is never kept in the repo.
final class ParityTests: XCTestCase {
    private func load(_ variable: String) throws -> JSONValue {
        guard let path = ProcessInfo.processInfo.environment[variable] else { throw XCTSkip("\(variable) not set; run Tests/run-parity.sh") }
        return try JSONValue.parse(try Data(contentsOf: URL(fileURLWithPath: path)))
    }

    func testEveryMonthMatchesTheWebApp() throws {
        let db = try load("KUBERA_DB"), golden = try load("KUBERA_GOLDEN")
        let kinds = TransactionKind.categoryKinds(from: db["appData"])
        let years = ExpenseLedger.years(expenses: db["expenses"], categoryKinds: kinds, salaryDetails: db["salaryDetails"])
        var index: [String: MonthSummary] = [:]
        for year in years { for month in year.months { index["\(month.year)-\(month.index)"] = month } }

        var mismatches: [String] = []
        for expected in golden["months"].array {
            let key = "\(Int(expected["year"].double))-\(Int(expected["index"].double))"
            guard let got = index[key] else { mismatches.append("\(key): missing"); continue }
            for (label, a, b) in [("spent", got.spent, expected["spent"].double),
                                  ("invested", got.invested, expected["invested"].double),
                                  ("income", got.income, expected["income"].double)] where abs(a - b) > 0.005 {
                mismatches.append("\(key) \(label): swift \(a) vs web \(b)")
            }
            if got.spentCategories != Int(expected["count"].double) { mismatches.append("\(key) spent categories: \(got.spentCategories) vs \(expected["count"].double)") }
        }
        XCTAssertEqual(index.count, golden["months"].array.count, "month count")
        XCTAssertTrue(mismatches.isEmpty, "\(mismatches.count) mismatches, first: \(mismatches.prefix(8))")
        print("parity: \(index.count) months match")
    }

    func testStockPortfolioMatchesTheWebApp() throws {
        let db = try load("KUBERA_DB"), golden = try load("KUBERA_GOLDEN")
        let account = db["savings"].array.first { $0["type"].text == "stock_market" } ?? .null
        let portfolio = Stocks.portfolio(account: account)
        XCTAssertEqual(portfolio.holdings.count, Int(golden["stocks"]["count"].double))
        XCTAssertEqual(portfolio.value, golden["stocks"]["value"].double, accuracy: 0.005)
        XCTAssertEqual(portfolio.invested, golden["stocks"]["invested"].double, accuracy: 0.005)
        for expected in golden["stocks"]["holdings"].array {
            guard let h = portfolio.holdings.first(where: { $0.id == expected["id"].text }) else { XCTFail("missing holding \(expected["id"].text)"); continue }
            XCTAssertEqual(h.invested, expected["invested"].double, accuracy: 0.005, "invested for \(h.name)")
        }
        print("parity: \(portfolio.holdings.count) holdings, value and cost match")
    }
}

extension ParityTests {
    private func frozenNow(_ golden: JSONValue) throws -> Date {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return try XCTUnwrap(f.date(from: golden["asOf"].text), "golden has no asOf")
    }

    private func rates(_ db: JSONValue) -> NetWorth.MetalRates {
        let manual = db["appData"]["manualMetalRates"]
        return NetWorth.MetalRates(manualGold: manual["gold"].double, manualSilver: manual["silver"].double)
    }

    func testEveryAccountIsValuedAsTheWebApp() throws {
        let db = try load("KUBERA_DB"), golden = try load("KUBERA_GOLDEN")
        let asOf = try frozenNow(golden)
        var mismatches: [String] = []
        for expected in golden["items"].array {
            guard let item = db["savings"].array.first(where: { $0["id"].text == expected["id"].text }) else { mismatches.append("\(expected["id"].text): missing"); continue }
            let current = Valuation.currentValue(item, asOf: asOf), invested = Valuation.investedValue(item)
            if abs(current - expected["current"].double) > 0.005 { mismatches.append("\(expected["type"].text) \(expected["id"].text) current: swift \(current) vs web \(expected["current"].double)") }
            if abs(invested - expected["invested"].double) > 0.005 { mismatches.append("\(expected["type"].text) \(expected["id"].text) invested: swift \(invested) vs web \(expected["invested"].double)") }
        }
        XCTAssertTrue(mismatches.isEmpty, "\(mismatches.count) mismatches, first: \(mismatches.prefix(6))")
        print("parity: \(golden["items"].array.count) accounts valued the same")
    }

    func testDashboardMatchesTheWebApp() throws {
        let db = try load("KUBERA_DB"), golden = try load("KUBERA_GOLDEN")
        let s = NetWorth.summary(savings: db["savings"], metals: db["metals"], assets: db["assets"], loans: db["loans"],
                                 rates: rates(db), asOf: try frozenNow(golden))
        let web = golden["dashboard"]
        let pairs: [(String, Double, String)] = [
            ("netWorth", s.netWorth, "netWorth"), ("debt", s.debt, "debt"), ("totalSavings", s.totalSavings, "totalSavings"),
            ("totalMetals", s.totalMetals, "totalMetals"), ("totalAssets", s.totalAssets, "totalAssets"),
            ("gold", s.goldValue, "goldVal"), ("goldGms", s.goldGrams, "goldGms"), ("silver", s.silverValue, "silverVal"),
            ("silverGms", s.silverGrams, "silverGms"), ("platinum", s.platinumValue, "platinumVal"),
            ("antique", s.antiqueCoinsValue, "antiqueCoinsVal"), ("currencies", s.currenciesValue, "currenciesVal"),
            ("fd", s.fixedDeposits, "fd"), ("stocks", s.stocks, "stocks"), ("mf", s.mutualFunds, "mf"),
            ("ppf", s.ppf, "ppf"), ("nps", s.nps, "nps"), ("sgb", s.goldBonds, "sgb"),
        ]
        for (label, mine, key) in pairs { XCTAssertEqual(mine, web[key].double, accuracy: 0.005, label) }
        XCTAssertEqual(s.growthIndex, web["growthIndex"].text)
        XCTAssertEqual(s.assetHealth, web["assetHealth"].text)
        print("parity: net worth \(s.netWorth) matches, growth \(s.growthIndex), health \(s.assetHealth)")
    }
}
