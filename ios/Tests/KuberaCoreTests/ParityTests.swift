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

extension ParityTests {
    func testSavingsPageMatchesTheWebApp() throws {
        let db = try load("KUBERA_DB"), golden = try load("KUBERA_GOLDEN")
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let asOf = try XCTUnwrap(f.date(from: golden["asOf"].text))
        let s = SavingsPage.summary(savings: db["savings"], salaryDetails: db["salaryDetails"], employments: db["appData"]["employments"], asOf: asOf)
        let web = golden["savings"]
        XCTAssertEqual(s.active.map(\.id), web["active"].array.map(\.text), "active accounts, in order")
        XCTAssertEqual(s.archived.map(\.id), web["archived"].array.map(\.text), "archived accounts")
        XCTAssertEqual(s.gratuity, web["gratuity"].double, accuracy: 0.005)
        XCTAssertEqual(s.valueFromItems, web["valueFromItems"].double, accuracy: 0.005)
        XCTAssertEqual(s.totalValue, web["totalValue"].double, accuracy: 0.005)
        XCTAssertEqual(s.invested, web["invested"].double, accuracy: 0.005)
        XCTAssertEqual(s.profitLoss, web["profitLoss"].double, accuracy: 0.005)
        print("parity: savings \(s.totalValue) across \(s.active.count) accounts (+\(s.archived.count) archived), gratuity \(s.gratuity)")
    }
}

extension ParityTests {
    func testInvestmentsPageMatchesTheWebApp() throws {
        let db = try load("KUBERA_DB"), golden = try load("KUBERA_GOLDEN")
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let asOf = try XCTUnwrap(f.date(from: golden["asOf"].text))
        let s = InvestmentsPage.summary(savings: db["savings"], asOf: asOf)
        let web = golden["investments"]
        XCTAssertEqual(s.active.map(\.id), web["active"].array.map(\.text))
        XCTAssertEqual(s.archived.map(\.id), web["archived"].array.map(\.text))
        XCTAssertEqual(s.value, web["value"].double, accuracy: 0.005)
        XCTAssertEqual(s.invested, web["invested"].double, accuracy: 0.005)
        XCTAssertEqual(s.profitLoss, web["profitLoss"].double, accuracy: 0.005)
        XCTAssertEqual(s.allocation.map(\.name), web["allocation"].array.map { $0["name"].text }, "slice names, in order")
        for (mine, theirs) in zip(s.allocation, web["allocation"].array) { XCTAssertEqual(mine.value, theirs["value"].double, accuracy: 0.005, mine.name) }
        print("parity: investments \(s.value) across \(s.active.count) accounts (+\(s.archived.count) archived), \(s.allocation.count) slices")
    }
}

extension ParityTests {
    func testLoansAndLentsMatchTheWebApp() throws {
        let db = try load("KUBERA_DB"), golden = try load("KUBERA_GOLDEN")
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let asOf = try XCTUnwrap(f.date(from: golden["asOf"].text))
        let web = golden["loans"]

        let people = LoansPage.people(lents: db["lents"])
        XCTAssertEqual(people.totalLent, web["peer"]["totalLent"].double, accuracy: 0.005)
        XCTAssertEqual(people.totalBorrowed, web["peer"]["totalBorrowed"].double, accuracy: 0.005)
        for expected in web["peer"]["items"].array {
            let id = expected["id"].text
            guard let debt = people.debts.first(where: { $0.id == id }) else { XCTFail("missing lent \(id)"); continue }
            XCTAssertEqual(debt.outstanding, expected["outstanding"].double, accuracy: 0.005, "outstanding \(id)")
            XCTAssertEqual(debt.outstanding, expected["pending"].double, accuracy: 0.005, "the card's own pending amount \(id)")
        }

        let loans = LoansPage.loans(db["loans"], now: asOf)
        XCTAssertEqual(loans.totalPrincipal, web["totals"]["totalPrincipal"].double, accuracy: 0.005)
        XCTAssertEqual(loans.totalMonthlyEmi, web["totals"]["totalMonthlyEmi"].double, accuracy: 0.005)
        XCTAssertEqual(loans.totalFeesAndGst, web["totals"]["totalFeesGstPaid"].double, accuracy: 0.005)
        XCTAssertEqual(loans.loans.count, web["cards"].array.count)
        for expected in web["cards"].array {
            let id = expected["id"].text
            guard let loan = loans.loans.first(where: { $0.id == id }) else { XCTFail("missing loan \(id)"); continue }
            XCTAssertEqual(loan.totalPaid, expected["totalPaid"].double, accuracy: 0.005, "paid \(id)")
            XCTAssertEqual(loan.estimatedTotalCost, expected["estimatedTotalCost"].double, accuracy: 0.005, "total cost \(id)")
            XCTAssertEqual(loan.pendingBalance, expected["pendingBalance"].double, accuracy: 0.005, "pending \(id)")
            XCTAssertEqual(loan.paidCount, Int(expected["paidCount"].double), "payments \(id)")
            XCTAssertEqual(loan.progressPercent, expected["progressPercent"].double, accuracy: 0.005, "progress \(id)")
            XCTAssertEqual(loan.processingFee, expected["pFee"].double, accuracy: 0.005, "fee \(id)")
            XCTAssertEqual(loan.gst, expected["gstAmt"].double, accuracy: 0.005, "gst \(id)")
            XCTAssertEqual(loan.paidThisMonth, expected["isCurrentMonthPaid"].isTrue, "paid this month \(id)")
            XCTAssertEqual(loan.dueThisMonth, expected["isCurrentMonthPending"].isTrue, "due this month \(id)")
        }
        print("parity: \(people.debts.count) peer debts (lent \(people.totalLent), borrowed \(people.totalBorrowed)) and \(loans.loans.count) loans match")
    }
}

extension ParityTests {
    func testCapitalGainsMatchTheWebApp() throws {
        let db = try load("KUBERA_DB"), golden = try load("KUBERA_GOLDEN")
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let asOf = try XCTUnwrap(f.date(from: golden["asOf"].text))
        let web = golden["capitalGains"]
        let page = CapitalGainsPage.page(savings: db["savings"], asOf: asOf)

        XCTAssertEqual(page.currentFy, web["currentFy"].text)

        // Every disposal, in the page's order.
        let webDisposals = web["disposals"].array
        XCTAssertEqual(page.disposals.count, webDisposals.count, "disposal count")
        for (mine, theirs) in zip(page.disposals, webDisposals) {
            let tag = "\(mine.holding) \(mine.soldOn)"
            XCTAssertEqual(mine.txId, theirs["txId"].text, tag)
            XCTAssertEqual(mine.acquiredOn, theirs["acquiredOn"].text, tag)
            XCTAssertEqual(mine.acquiredAs, theirs["acquiredAs"].text, tag)
            XCTAssertEqual(mine.term, theirs["term"].text, tag)
            XCTAssertEqual(mine.fy, theirs["fy"].text, tag)
            XCTAssertEqual(mine.treatedAsDividend, theirs["treatedAsDividend"].isTrue, tag)
            for (label, a, b) in [("quantity", mine.quantity, theirs["quantity"].double), ("cost", mine.cost, theirs["cost"].double),
                                  ("proceeds", mine.proceeds, theirs["proceeds"].double), ("gain", mine.gain, theirs["gain"].double),
                                  ("dividend", mine.dividendIncome, theirs["dividendIncome"].double)] {
                XCTAssertEqual(a, b, accuracy: 0.005, "\(tag) \(label)")
            }
        }

        XCTAssertEqual(page.unmatched.map(\.soldOn), web["unmatched"].array.map { $0["soldOn"].text })
        XCTAssertEqual(page.unmatched.map(\.quantity), web["unmatched"].array.map { $0["quantity"].double })

        // The ledger, year by year, every figure.
        let years = web["years"].array
        XCTAssertEqual(page.ledger.years.map(\.fy), years.map { $0["fy"].text })
        for (mine, theirs) in zip(page.ledger.years, years) {
            let pairs: [(String, Double, String)] = [
                ("grossShort", mine.grossShort, "grossShort"), ("grossLong", mine.grossLong, "grossLong"),
                ("openingShort", mine.openingCarriedShort, "openingCarriedShort"), ("openingLong", mine.openingCarriedLong, "openingCarriedLong"),
                ("setOffCur", mine.setOffCurrentShortLossAgainstLong, "setOffCurrentShortLossAgainstLong"),
                ("setOffSS", mine.setOffShortAgainstShort, "setOffShortAgainstShort"), ("setOffSL", mine.setOffShortAgainstLong, "setOffShortAgainstLong"),
                ("setOffLL", mine.setOffLongAgainstLong, "setOffLongAgainstLong"), ("netShort", mine.netShort, "netShort"), ("netLong", mine.netLong, "netLong"),
                ("exemption", mine.exemption, "exemption"), ("exemptUsed", mine.exemptUsed, "exemptUsed"), ("taxableLong", mine.taxableLong, "taxableLong"),
                ("shortRate", mine.shortRate, "shortRate"), ("longRate", mine.longRate, "longRate"), ("tax", mine.estimatedTax, "estimatedTax"),
                ("buybackDividend", mine.buybackDividend, "buybackDividend"), ("proceeds", mine.proceeds, "proceeds"), ("cost", mine.cost, "cost"),
                ("lapsed", mine.lapsed, "lapsed"), ("closingShort", mine.closingCarriedShort, "closingCarriedShort"), ("closingLong", mine.closingCarriedLong, "closingCarriedLong"),
            ]
            for (label, a, key) in pairs { XCTAssertEqual(a, theirs[key].double, accuracy: 0.005, "FY \(mine.fy) \(label)") }
            XCTAssertEqual(mine.disposalCount, Int(theirs["disposalCount"].double), "FY \(mine.fy) disposal count")
        }
        XCTAssertEqual(page.ledger.totalRealised, web["totals"]["realised"].double, accuracy: 0.005)
        XCTAssertEqual(page.ledger.totalTax, web["totals"]["tax"].double, accuracy: 0.005)
        XCTAssertEqual(page.ledger.carriedShort.map(\.fy), web["carried"]["short"].array.map { $0["fy"].text })
        XCTAssertEqual(page.ledger.carriedLong.map(\.amount), web["carried"]["long"].array.map { $0["amount"].double })
        XCTAssertEqual(page.ledger.carriedLong.map(\.expiresAfter), web["carried"]["long"].array.map { $0["expiresAfter"].text })

        // What is still held.
        let lots = web["unrealised"]["lots"].array
        XCTAssertEqual(page.unrealised.lots.count, lots.count, "open lots")
        for (mine, theirs) in zip(page.unrealised.lots, lots) {
            XCTAssertEqual(mine.acquiredOn, theirs["acquiredOn"].text); XCTAssertEqual(mine.term, theirs["term"].text)
            XCTAssertEqual(mine.longTermFrom, theirs["longTermFrom"].text); XCTAssertEqual(mine.daysToLongTerm, Int(theirs["daysToLongTerm"].double), "\(mine.holding) days to long term")
            XCTAssertEqual(mine.quantity, theirs["quantity"].double, accuracy: 0.005); XCTAssertEqual(mine.cost, theirs["cost"].double, accuracy: 0.005)
            XCTAssertEqual(mine.value, theirs["value"].double, accuracy: 0.005); XCTAssertEqual(mine.gain, theirs["gain"].double, accuracy: 0.005)
        }
        XCTAssertEqual(page.unrealised.shortTerm.gain, web["unrealised"]["shortTerm"]["gain"].double, accuracy: 0.005)
        XCTAssertEqual(page.unrealised.longTerm.gain, web["unrealised"]["longTerm"]["gain"].double, accuracy: 0.005)
        XCTAssertEqual(page.unrealised.crossingWithin90Days.count, Int(web["unrealised"]["crossing"].double))

        // Mutual funds, with their inferred class.
        XCTAssertEqual(page.funds.count, web["funds"].array.count, "fund disposals")
        for (mine, theirs) in zip(page.funds, web["funds"].array) {
            XCTAssertEqual(mine.assetClass, theirs["assetClass"].text); XCTAssertEqual(mine.disposal.gain, theirs["gain"].double, accuracy: 0.005, mine.disposal.holding)
        }
        print("parity: capital gains — \(page.disposals.count) disposals, \(page.ledger.years.count) years, tax \(page.ledger.totalTax), \(page.unrealised.lots.count) open lots, \(page.funds.count) fund disposals match")
    }
}
