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

extension ParityTests {
    private func asOfDate(_ golden: JSONValue) throws -> Date {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return try XCTUnwrap(f.date(from: golden["asOf"].text))
    }

    func testBenchmarkTablesAreTheJavaScriptOnes() throws {
        let web = try load("KUBERA_GOLDEN")["benchmark"]
        func same(_ mine: [BenchmarkStock], _ theirs: [JSONValue], _ label: String) {
            XCTAssertEqual(mine.count, theirs.count, "\(label) count (run ios/Tests/generate-benchmark.mjs if the JS changed)")
            for (m, t) in zip(mine, theirs) {
                XCTAssertEqual(m.symbol, t["symbol"].text, label); XCTAssertEqual(m.name, t["name"].text, label)
                XCTAssertEqual(m.sector, t["sector"].text, label); XCTAssertEqual(m.cap, t["cap"].isNull ? nil : t["cap"].text, label)
                XCTAssertEqual(m.weight, t["weight"].jsNumber.flatMap { t["weight"].isNull ? nil : $0 }, label)
                XCTAssertEqual(m.aliases, t["aliases"].array.map(\.text), label)
            }
        }
        same(BenchmarkData.nifty50, web["nifty50"].array, "Nifty 50")
        same(BenchmarkData.niftyNext50, web["next50"].array, "Next 50")
        same(BenchmarkData.sbiSmallCap, web["sbi"].array, "SBI Small Cap")
        XCTAssertEqual(BenchmarkData.hdfcFlexiCapWeights.map(\.symbol), web["hdfc"].array.map { $0["symbol"].text })
        XCTAssertEqual(BenchmarkData.hdfcFlexiCapWeights.map(\.weight), web["hdfc"].array.map { $0["weight"].double })
    }

    func testSectorsAndMarketCapsResolveAsOnTheWeb() throws {
        let golden = try load("KUBERA_GOLDEN")
        for pair in golden["sectors"].array {
            XCTAssertEqual(Sectors.normalise(pair["in"].text), pair["out"].text, "sector \"\(pair["in"].text)\"")
        }
        let db = try load("KUBERA_DB")
        let items = db["watchlist"].array + db["savings"].array.flatMap { $0["stocks"].array }
        XCTAssertEqual(items.count, golden["caps"].array.count)
        for (item, expected) in zip(items, golden["caps"].array) {
            XCTAssertEqual(Benchmark.marketCap(of: item), expected["cap"].text, "market cap of \(expected["name"].text)")
        }
    }

    func testWatchlistMatchesTheWebApp() throws {
        let db = try load("KUBERA_DB"), web = try load("KUBERA_GOLDEN")["watchlist"]
        let page = WatchlistPage.summary(db["watchlist"])
        XCTAssertEqual(page.rows.count, web["rows"].array.count)
        for (mine, theirs) in zip(page.rows, web["rows"].array) {
            let tag = mine.name
            XCTAssertEqual(mine.id, theirs["id"].text, tag)
            XCTAssertEqual(mine.sector, theirs["sectorKey"].text, tag); XCTAssertEqual(mine.risk, theirs["riskKey"].text, tag)
            XCTAssertEqual(mine.cap, theirs["capKey"].text, tag); XCTAssertEqual(mine.priority, theirs["priorityKey"].text, tag)
            XCTAssertEqual(mine.quote.price, theirs["price"].isNull ? nil : theirs["price"].double, tag)
            XCTAssertEqual(mine.quote.rangePct ?? -1, theirs["rangePct"].isNull ? -1 : theirs["rangePct"].double, accuracy: 1e-9, "\(tag) range")
            XCTAssertEqual(mine.quote.dayChange ?? -999, theirs["dayChange"].isNull ? -999 : theirs["dayChange"].double, accuracy: 0.005, "\(tag) day change")
            XCTAssertEqual(mine.quote.dayChangePct ?? -999, theirs["dayChangePct"].isNull ? -999 : theirs["dayChangePct"].double, accuracy: 1e-9, "\(tag) day %")
            XCTAssertEqual(mine.quote.nearLow, theirs["nearLow"].isTrue, tag); XCTAssertEqual(mine.quote.nearHigh, theirs["nearHigh"].isTrue, tag)
            XCTAssertEqual(mine.fired.count, Int(theirs["fired"].double), "\(tag) alerts")
        }
        for sort in WatchlistPage.Sort.allCases {
            let key = ["Priority": "priority", "Nearest 52w low": "range", "Name": "name"][sort.rawValue]!
            XCTAssertEqual(WatchlistPage.sorted(page.rows, by: sort).map(\.id), web["order"][key].array.map(\.text), "order by \(key)")
        }
        for level in WatchlistRisk.riskLevels + ["unrated"] { XCTAssertEqual(page.riskCounts[level], Int(web["riskCounts"][level].double), "risk \(level)") }
        for level in WatchlistRisk.priorityLevels + ["unset"] { XCTAssertEqual(page.priorityCounts[level], Int(web["priorityCounts"][level].double), "priority \(level)") }
        XCTAssertEqual(page.nearLow, web["nearLow"].array.count); XCTAssertEqual(page.nearHigh, web["nearHigh"].array.count)
        XCTAssertEqual(page.firedCount, Int(web["firedCount"].double))
        print("parity: watchlist — \(page.rows.count) entries, three sort orders, counts and edges match")
    }

    func testIpoApplicationsMatchTheWebApp() throws {
        let db = try load("KUBERA_DB"), web = try load("KUBERA_GOLDEN")["ipos"]
        let market = db["savings"].array.first { $0["type"].text == "stock_market" && !$0["isArchived"].truthy } ?? .null
        let s = IpoPage.summary(applications: db["ipoApplications"], stocks: market["stocks"].array)
        let ws = web["summary"]
        XCTAssertEqual(s.total, Int(ws["total"].double)); XCTAssertEqual(s.decidedCount, Int(ws["decidedCount"].double))
        XCTAssertEqual(s.allottedCount, Int(ws["allottedCount"].double)); XCTAssertEqual(s.pendingCount, Int(ws["pendingCount"].double))
        XCTAssertEqual(s.allotmentRate ?? -1, ws["allotmentRate"].isNull ? -1 : ws["allotmentRate"].double, accuracy: 1e-9)
        for (mine, theirs) in [(s.capitalBlockedNow, "capitalBlockedNow"), (s.totalApplied, "totalApplied"), (s.totalInvested, "totalInvested"),
                               (s.totalRefunded, "totalRefunded"), (s.listingGain, "listingGain")] { XCTAssertEqual(mine, ws[theirs].double, accuracy: 0.005, theirs) }
        XCTAssertEqual(s.listingGainCount, Int(ws["listingGainCount"].double)); XCTAssertEqual(s.missingListingPrice, Int(ws["missingListingPrice"].double))
        XCTAssertEqual(s.unlinkedAllotments.map(\.id), ws["unlinkedAllotments"].array.map { $0["id"].text })
        XCTAssertEqual(s.applications.count, web["applications"].array.count)
        for (mine, theirs) in zip(s.applications, web["applications"].array) {
            let tag = mine.company
            XCTAssertEqual(mine.id, theirs["id"].text, tag); XCTAssertEqual(mine.status, theirs["status"].text, tag)
            XCTAssertEqual(mine.amountBlocked, theirs["amountBlocked"].double, accuracy: 0.005, tag)
            XCTAssertEqual(mine.investedAtAllotment, theirs["investedAtAllotment"].double, accuracy: 0.005, tag)
            XCTAssertEqual(mine.refunded, theirs["refunded"].double, accuracy: 0.005, tag)
            XCTAssertEqual(mine.listingGain, theirs["listingGain"].double, accuracy: 0.005, tag)
            XCTAssertEqual(mine.daysBlocked.map(Double.init) ?? -1, theirs["daysBlocked"].isNull ? -1 : theirs["daysBlocked"].double, tag)
            XCTAssertEqual(mine.hasListing, theirs["hasListing"].isTrue, tag)
        }
        print("parity: IPOs — \(s.total) applications, allotment rate \(s.allotmentRate.map { String(format: "%.0f%%", $0) } ?? "—"), blocked now \(s.capitalBlockedNow) match")
    }
}

extension ParityTests {
    func testReturnsMatchTheWebApp() throws {
        let db = try load("KUBERA_DB"), golden = try load("KUBERA_GOLDEN")
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let asOf = try XCTUnwrap(f.date(from: golden["asOf"].text))
        let web = golden["returns"]
        let page = ReturnsPage.page(savings: db["savings"], asOf: asOf)

        // XIRR is an iterative solve, so allow the solver's own tolerance (and libm's last digit), relatively.
        func close(_ a: Double?, _ b: JSONValue, _ tag: String) {
            if b.isNull { XCTAssertNil(a, tag); return }
            guard let a else { XCTFail("\(tag): swift has no value, web has \(b.double)"); return }
            XCTAssertEqual(a, b.double, accuracy: max(1e-4, abs(b.double) * 1e-6), tag)
        }

        XCTAssertEqual(page.rows.count, web["rows"].array.count)
        for (mine, theirs) in zip(page.rows, web["rows"].array) {
            let tag = mine.name
            XCTAssertEqual("\(mine.kind):\(mine.id)", "\(theirs["kind"].text):\(theirs["id"].text)", "rank order at \(tag)")
            XCTAssertEqual(mine.invested, theirs["invested"].double, accuracy: 0.005, tag)
            XCTAssertEqual(mine.returned, theirs["returned"].double, accuracy: 0.005, tag)
            XCTAssertEqual(mine.closing, theirs["closing"].double, accuracy: 0.005, tag)
            XCTAssertEqual(mine.profit, theirs["profit"].double, accuracy: 0.005, tag)
            close(mine.simplePct, theirs["simplePct"], "\(tag) simple")
            close(mine.xirrPct, theirs["xirrPct"], "\(tag) xirr")
            XCTAssertEqual(mine.days, Int(theirs["days"].double), "\(tag) days")
            XCTAssertEqual(mine.firstFlow, theirs["firstFlow"].isNull ? nil : theirs["firstFlow"].text, tag)
            XCTAssertEqual(mine.lastFlow, theirs["lastFlow"].isNull ? nil : theirs["lastFlow"].text, tag)
            XCTAssertEqual(mine.tooShortToAnnualise, theirs["tooShortToAnnualise"].isTrue, tag)
            XCTAssertEqual(mine.archived, theirs["archived"].isTrue, tag)
        }

        let p = web["portfolio"]
        close(page.portfolio.xirrPct, p["xirrPct"], "portfolio xirr")
        close(page.portfolio.simplePct, p["simplePct"], "portfolio simple")
        XCTAssertEqual(page.portfolio.invested, p["invested"].double, accuracy: 0.005)
        XCTAssertEqual(page.portfolio.returned, p["returned"].double, accuracy: 0.005)
        XCTAssertEqual(page.portfolio.closing, p["closing"].double, accuracy: 0.005)
        XCTAssertEqual(page.portfolio.firstFlow, p["firstFlow"].text)

        for sort in ReturnsPage.Sort.allCases {
            let key = ["Annualised": "xirr", "Total": "simple", "Money in": "invested", "Profit": "profit"][sort.rawValue]!
            XCTAssertEqual(ReturnsPage.sorted(page.rows, by: sort).map { "\($0.kind):\($0.id)" }, web["order"][key].array.map(\.text), "order by \(key)")
        }
        print("parity: returns — \(page.rows.count) holdings, portfolio XIRR \(page.portfolio.xirrPct.map { String(format: "%.2f%%", $0) } ?? "—"), all four orders match")
    }
}

extension ParityTests {
    func testDividendsMatchTheWebApp() throws {
        let db = try load("KUBERA_DB"), golden = try load("KUBERA_GOLDEN")
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let asOf = try XCTUnwrap(f.date(from: golden["asOf"].text))
        let web = golden["dividends"]
        let page = DividendPage.page(savings: db["savings"], asOf: asOf)
        let s = page.summary, ws = web["summary"]

        XCTAssertEqual(s.lifetime, ws["lifetime"].double, accuracy: 0.005); XCTAssertEqual(s.thisYear, ws["thisYear"].double, accuracy: 0.005)
        XCTAssertEqual(s.payerCount, Int(ws["payerCount"].double)); XCTAssertEqual(s.lapsedCount, Int(ws["lapsedCount"].double))
        XCTAssertEqual(s.portfolioYieldOnCost, ws["portfolioYieldOnCost"].double, accuracy: 1e-9)
        XCTAssertEqual(s.bestYear?.year, ws["bestYear"].isNull ? nil : ws["bestYear"]["year"].text)
        XCTAssertEqual(s.bestYear?.amount ?? 0, ws["bestYear"].isNull ? 0 : ws["bestYear"]["amount"].double, accuracy: 0.005)
        XCTAssertEqual(s.years.map(\.year), ws["years"].array.map { $0["year"].text })
        for (mine, theirs) in zip(s.years, ws["years"].array) { XCTAssertEqual(mine.amount, theirs["amount"].double, accuracy: 0.005, "income \(mine.year)") }

        XCTAssertEqual(page.payers.count, web["payers"].array.count)
        for (mine, theirs) in zip(page.payers, web["payers"].array) {
            let tag = mine.name
            XCTAssertEqual(mine.id, theirs["id"].text, "payer order at \(tag)")
            XCTAssertEqual(mine.invested, theirs["invested"].double, accuracy: 0.005, tag); XCTAssertEqual(mine.total, theirs["total"].double, accuracy: 0.005, tag)
            XCTAssertEqual(mine.pct, theirs["pct"].double, accuracy: 1e-9, tag)
            XCTAssertEqual(mine.payments, Int(theirs["payments"].double), tag); XCTAssertEqual(mine.paidYears, Int(theirs["paidYears"].double), tag)
            XCTAssertEqual(mine.spanYears, Int(theirs["spanYears"].double), tag); XCTAssertEqual(mine.consistency, theirs["consistency"].double, accuracy: 1e-9, tag)
            XCTAssertEqual(mine.lastPaid, theirs["lastPaid"].isNull ? nil : theirs["lastPaid"].text, tag)
            XCTAssertEqual(mine.yearsSinceLast.map(Double.init) ?? -1, theirs["yearsSinceLast"].isNull ? -1 : theirs["yearsSinceLast"].double, tag)
            XCTAssertEqual(mine.lapsed, theirs["lapsed"].isTrue, tag); XCTAssertEqual(mine.held, theirs["held"].isTrue, tag)
            for (year, amount) in theirs["byYear"].object { XCTAssertEqual(mine.byYear[year] ?? -1, amount.double, accuracy: 0.005, "\(tag) \(year)") }
            XCTAssertEqual(mine.byYear.count, theirs["byYear"].object.count, tag)
        }
        XCTAssertEqual(page.lapsed.map(\.id), web["lapsed"].array.map(\.text))

        XCTAssertEqual(page.calendar.count, 12)
        for (mine, theirs) in zip(page.calendar, web["calendar"].array) {
            XCTAssertEqual(mine.payments, Int(theirs["payments"].double), mine.name); XCTAssertEqual(mine.typicalTotal, theirs["typicalTotal"].double, accuracy: 0.005, mine.name)
            XCTAssertEqual(mine.payers.map(\.id), theirs["payers"].array.map { $0["id"].text }, "payers in \(mine.name)")
            for (a, b) in zip(mine.payers, theirs["payers"].array) { XCTAssertEqual(a.averagePerYear, b["averagePerYear"].double, accuracy: 0.005) }
        }
        XCTAssertEqual(page.busiest.map(\.month), web["busiest"].array.map { Int($0.double) })
        let latest = page.summary.years.last?.year ?? "\(Calendar.current.component(.year, from: asOf))"
        XCTAssertEqual(latest, web["latestYear"].text)
        for (mine, theirs) in zip(Dividends.incomeByMonth(page.stocks, year: latest), web["months"].array) {
            XCTAssertEqual(mine.amount, theirs["amount"].double, accuracy: 0.005, mine.month); XCTAssertEqual(mine.payments, Int(theirs["payments"].double), mine.month)
        }

        let t = page.tax, wt = web["tax"]
        XCTAssertEqual(t.currentFy, wt["currentFy"].text)
        XCTAssertEqual(t.lifetimeGross, wt["lifetimeGross"].double, accuracy: 0.005); XCTAssertEqual(t.lifetimeTds, wt["lifetimeTds"].double, accuracy: 0.005)
        XCTAssertEqual(t.lifetimeNet, wt["lifetimeNet"].double, accuracy: 0.005)
        XCTAssertEqual(t.rows.count, wt["rows"].array.count)
        for (mine, theirs) in zip(t.rows, wt["rows"].array) {
            let tag = "\(mine.name) FY \(mine.fy)"
            XCTAssertEqual(mine.id, "\(theirs["holdingId"].text)::\(theirs["fy"].text)", tag)
            XCTAssertEqual(mine.gross, theirs["gross"].double, accuracy: 0.005, tag); XCTAssertEqual(mine.tds, theirs["tds"].double, accuracy: 0.005, tag)
            XCTAssertEqual(mine.expectsTds, theirs["expectsTds"].isTrue, tag); XCTAssertEqual(mine.missingTds, theirs["missingTds"].isTrue, tag)
            XCTAssertEqual(mine.isTrust, theirs["isTrust"].isTrue, tag); XCTAssertEqual(mine.payments, Int(theirs["payments"].double), tag)
            XCTAssertEqual(mine.headroom ?? -1, theirs["headroom"].isNull ? -1 : theirs["headroom"].double, accuracy: 0.005, tag)
        }
        XCTAssertEqual(t.years.map(\.fy), wt["years"].array.map { $0["fy"].text })
        XCTAssertEqual(t.needsChecking.map(\.id), wt["needsChecking"].array.map { "\($0["holdingId"].text)::\($0["fy"].text)" })
        XCTAssertEqual(t.approaching.map(\.id), wt["approaching"].array.map { "\($0["holdingId"].text)::\($0["fy"].text)" })
        XCTAssertEqual(t.trustHoldings, wt["trustHoldings"].array.map(\.text))

        XCTAssertEqual(page.shares.map(\.ticker), web["treemap"].array.map { $0["ticker"].text })
        for (mine, theirs) in zip(page.shares, web["treemap"].array) { XCTAssertEqual(mine.value, theirs["value"].double, accuracy: 0.005, mine.ticker) }
        print("parity: dividends — lifetime \(s.lifetime), \(page.payers.count) payers, \(t.rows.count) tax rows, calendar and treemap match")
    }
}

extension ParityTests {
    func testFreeHoldingsMatchTheWebApp() throws {
        let db = try load("KUBERA_DB"), web = try load("KUBERA_GOLDEN")["freeHoldings"]
        let page = FreeHoldingsPage.page(savings: db["savings"])

        func same(_ mine: [CostRecovery.Recovery], _ theirs: [JSONValue], _ label: String) {
            XCTAssertEqual(mine.map(\.id), theirs.map { $0["id"].text }, "\(label): which holdings, in order")
            for (m, t) in zip(mine, theirs) {
                let tag = "\(label) \(m.name)"
                for (key, value) in [("invested", m.invested), ("salesProceeds", m.salesProceeds), ("dividends", m.dividends), ("recovered", m.recovered),
                                     ("outstandingCost", m.outstandingCost), ("surplus", m.surplus), ("value", m.value), ("allocatedBasis", m.allocatedBasis),
                                     ("netCostPerShare", m.netCostPerShare)] { XCTAssertEqual(value, t[key].double, accuracy: 0.005, "\(tag) \(key)") }
                XCTAssertEqual(m.rawPct, t["rawPct"].double, accuracy: 1e-9, tag); XCTAssertEqual(m.recoveredPct, t["recoveredPct"].double, accuracy: 1e-9, tag)
                XCTAssertEqual(m.shares, t["shares"].double, tag); XCTAssertEqual(m.bonusShares, t["bonusShares"].double, tag)
                XCTAssertEqual(m.isFree, t["isFree"].isTrue, tag); XCTAssertEqual(m.cashless, t["cashless"].isTrue, tag); XCTAssertEqual(m.held, t["held"].isTrue, tag)
            }
        }
        same(page.free, web["free"].array, "free"); same(page.almost, web["almost"].array, "nearly free")
        same(page.all, web["all"].array, "ranking"); same(page.cashless, web["cashless"].array, "cashless")
        let t = page.totals, wt = web["totals"]
        for (label, mine, theirs) in [("invested", t.invested, "invested"), ("recovered", t.recovered, "recovered"), ("stillAtRisk", t.stillAtRisk, "stillAtRisk"),
                                      ("freeValue", t.freeValue, "freeValue"), ("bonusShares", t.bonusShares, "bonusShares")] { XCTAssertEqual(mine, wt[theirs].double, accuracy: 0.005, label) }
        XCTAssertEqual(t.freeCount, Int(wt["freeCount"].double))
        print("parity: free holdings — \(page.all.count) ranked, \(page.free.count) free, \(page.almost.count) nearly, \(page.cashless.count) cashless; at risk \(t.stillAtRisk)")
    }

    func testNiftyOverlapMatchesTheWebApp() throws {
        let db = try load("KUBERA_DB"), web = try load("KUBERA_GOLDEN")
        let asOf = try frozenNow(web)
        let views: [(String, NiftyOverlap.Fund?)] = [("all", nil), ("nippon_nifty50", .nippon), ("icici_next50", .icici), ("hdfc_flexicap", .hdfc), ("sbi_smallcap", .sbi)]
        var checked = 0
        for (mode, basis) in [("current", NiftyOverlap.Basis.current), ("invested", .invested)] {
            for (name, fund) in views {
                let key = "\(mode)/\(name)", w = web["overlap"][key]
                let p = NiftyOverlap.page(savings: db["savings"], basis: basis, view: fund, asOf: asOf)
                XCTAssertEqual(p.stockValue, w["totalStockValue"].double, accuracy: 0.005, "\(key) stocks")
                XCTAssertEqual(p.equityFundValue, w["totalEquityMfValue"].double, accuracy: 0.005, "\(key) funds")
                XCTAssertEqual(p.portfolioValue, w["totalPortfolioValue"].double, accuracy: 0.005, "\(key) portfolio")
                XCTAssertEqual(p.fundValues[.nippon] ?? 0, w["nipponVal"].double, accuracy: 0.005, key)
                XCTAssertEqual(p.fundValues[.icici] ?? 0, w["iciciNext50Val"].double, accuracy: 0.005, key)
                XCTAssertEqual(p.fundValues[.hdfc] ?? 0, w["hdfcFlexiVal"].double, accuracy: 0.005, key)
                XCTAssertEqual(p.fundValues[.sbi] ?? 0, w["sbiSmallCapVal"].double, accuracy: 0.005, key)
                let rows = w["consolidatedExposures"].array
                XCTAssertEqual(p.exposures.map { $0.symbol }, rows.map { $0["symbol"].text }, "\(key): which companies, in order")
                for (m, t) in zip(p.exposures, rows) {
                    let tag = "\(key) \(m.symbol)"
                    XCTAssertEqual(m.name, t["name"].text, tag); XCTAssertEqual(m.sector, t["sector"].text, tag); XCTAssertEqual(m.cap, t["cap"].text, tag)
                    XCTAssertEqual(m.directVal, t["directVal"].double, accuracy: 0.005, tag); XCTAssertEqual(m.directShares, t["directShares"].double, accuracy: 1e-9, tag)
                    XCTAssertEqual(m.value(in: .nippon), t["nipponVal"].double, accuracy: 0.005, tag); XCTAssertEqual(m.value(in: .icici), t["iciciNext50Val"].double, accuracy: 0.005, tag)
                    XCTAssertEqual(m.value(in: .hdfc), t["hdfcFlexiVal"].double, accuracy: 0.005, tag); XCTAssertEqual(m.value(in: .sbi), t["sbiSmallCapVal"].double, accuracy: 0.005, tag)
                    XCTAssertEqual(m.total, t["totalVal"].double, accuracy: 0.005, tag); XCTAssertEqual(m.totalPct, t["totalPctOfPortfolio"].double, accuracy: 1e-6, tag)
                    XCTAssertEqual(m.status.rawValue, t["status"].text, tag)
                    checked += 1
                }
                for (m, t) in zip(p.caps, w["marketCapDistribution"].array) { XCTAssertEqual(m.value, t["value"].double, accuracy: 0.005, "\(key) cap"); XCTAssertEqual(m.pct, t["pct"].double, accuracy: 1e-6, "\(key) cap") }
                let secs = w["sectorAnalytics"].array
                XCTAssertEqual(p.sectors.map { $0.sector }, secs.map { $0["sector"].text }, "\(key): sectors in order")
                for (m, t) in zip(p.sectors, secs) {
                    XCTAssertEqual(m.total, t["totalVal"].double, accuracy: 0.005, "\(key) \(m.sector)"); XCTAssertEqual(m.count, Int(t["count"].double), "\(key) \(m.sector)")
                    XCTAssertEqual(m.direct, t["directVal"].double, accuracy: 0.005, "\(key) \(m.sector)"); XCTAssertEqual(m.indirect, t["indirectVal"].double, accuracy: 0.005, "\(key) \(m.sector)")
                }
                XCTAssertEqual(p.sectorNames, w["allSectors"].array.map { $0.text }, "\(key) sector list")
            }
        }
        let all = NiftyOverlap.page(savings: db["savings"], asOf: asOf)
        let sorts: [String: NiftyOverlap.Sort] = ["total_val": .total, "direct_val": .direct, "indirect_val": .indirect, "name": .name]
        let holds: [String: NiftyOverlap.Holding] = ["all": .all, "direct": .direct, "indirect": .indirect]
        for f in web["overlapFilters"].array {
            let mine = NiftyOverlap.filtered(all.exposures, search: f["search"].text, cap: f["cap"].text, holding: holds[f["holding"].text]!, sector: f["sector"].text,
                                             sort: sorts[f["sort"].text]!, descending: f["order"].text == "desc").map { $0.symbol }
            XCTAssertEqual(mine, f["ids"].array.map { $0.text }, "filter \(f["search"].text)/\(f["cap"].text)/\(f["holding"].text)/\(f["sort"].text)/\(f["order"].text)")
        }
        print("parity: nifty overlap — \(all.exposures.count) companies, \(all.sectors.count) sectors, portfolio \(all.portfolioValue); \(checked) rows compared over 10 views")
    }

    func testStockAnalystMatchesTheWebApp() throws {
        let db = try load("KUBERA_DB"), web = try load("KUBERA_GOLDEN")
        let asOf = try frozenNow(web)
        let market = db["savings"].array.first { $0["type"].text == "stock_market" && !$0["isArchived"].truthy } ?? .null
        let stocks = market["stocks"].array.filter(Stocks.isOwn)
        var closes: [String: Double] = [:]
        for (k, v) in web["analyst"]["closes"].object { closes[k] = v.double }
        var funds: [String: JSONValue] = [:]
        for (k, v) in web["analyst"]["fundamentals"].object { funds[k] = v }

        for (label, mine) in [
            ("plain", Analyst.analyse(stocks: stocks, watchlist: db["watchlist"].array, sectorLimits: market["sectorLimits"], pricesUpdatedAt: market["pricesUpdatedAt"].truthy ? market["pricesUpdatedAt"].text : nil, asOf: asOf)),
            ("rich", Analyst.analyse(stocks: stocks, watchlist: db["watchlist"].array, sectorLimits: market["sectorLimits"], fundamentals: funds, indexCloses: closes, pricesUpdatedAt: market["pricesUpdatedAt"].truthy ? market["pricesUpdatedAt"].text : nil, asOf: asOf)),
        ] {
            let theirs = web["analyst"][label]
            XCTAssertEqual(mine.asOf, theirs["asOf"].text, label)
            let tf = theirs["findings"].array
            XCTAssertEqual(mine.findings.map { $0.id }, tf.map { $0["id"].text }, "\(label): which findings, in order")
            for (m, t) in zip(mine.findings, tf) {
                let tag = "\(label) \(m.id)"
                XCTAssertEqual(m.kind, t["kind"].text, tag); XCTAssertEqual(m.severity.rawValue, t["severity"].text, tag)
                XCTAssertEqual(m.title, t["title"].text, tag); XCTAssertEqual(m.detail, t["detail"].text, tag); XCTAssertEqual(m.action, t["action"].text, tag)
                XCTAssertEqual(m.rule, t["rule"].text, tag)
                XCTAssertEqual(m.evidence.map { "\($0.label): \($0.value)" }, t["evidence"].array.map { "\($0["label"].text): \($0["value"].text)" }, tag)
                XCTAssertEqual(m.impact, t["impact"].double, accuracy: 0.005, tag)
                XCTAssertEqual(m.deadline ?? "", t["deadline"].text, tag)
            }
            let ms = mine.snapshot, ts = theirs["snapshot"]
            for (name, a, b) in [("value", ms.value, "value"), ("invested", ms.invested, "invested"), ("unrealised", ms.unrealised, "unrealised"), ("topFive", ms.topFiveShare, "topFiveShare"),
                                 ("short", ms.realisedShort, "realisedShort"), ("long", ms.realisedLong, "realisedLong"), ("tax", ms.estimatedTax, "estimatedTax"),
                                 ("exempt", ms.exemptionUsed, "exemptionUsed"), ("carried", ms.carriedLosses, "carriedLosses")] {
                XCTAssertEqual(a, ts[b].double, accuracy: 0.005, "\(label) snapshot \(name)")
            }
            XCTAssertEqual(ms.heldCount, Int(ts["heldCount"].double), label); XCTAssertEqual(ms.daysToFyEnd, Int(ts["daysToFyEnd"].double), label)
            XCTAssertEqual(ms.fundamentalsLoaded, Int(ts["fundamentalsLoaded"].double), label)
            XCTAssertEqual(ms.sectors.map { $0.sector }, ts["sectors"].array.map { $0["sector"].text }, label)
            print("parity: analyst \(label) — \(mine.findings.count) findings (\(mine.counts[.act] ?? 0) act, \(mine.counts[.review] ?? 0) review, \(mine.counts[.info] ?? 0) info)")
        }
    }

    func testSalaryMatchesTheWebApp() throws {
        let db = try load("KUBERA_DB"), web = try load("KUBERA_GOLDEN")["salary"]
        let now = try frozenNow(load("KUBERA_GOLDEN"))
        XCTAssertEqual(SalaryPage.years(db["salaryDetails"], now: now), web["years"].array.map { $0.text })
        let annual = SalaryPage.page(salaryDetails: db["salaryDetails"], appData: db["appData"], year: web["years"][0].text, now: now).annual
        XCTAssertEqual(annual.map { $0.year }, web["annual"].array.map { $0["year"].text }, "annual years")
        for (m, t) in zip(annual, web["annual"].array) { for (k, v) in m.values { XCTAssertEqual(v, t[k].double, accuracy: 0.005, "annual \(m.year) \(k)") } }
        var checked = 0
        for year in web["years"].array.map({ $0.text }) {
            let p = SalaryPage.page(salaryDetails: db["salaryDetails"], appData: db["appData"], year: year, now: now), w = web["byYear"][year]
            for (m, t) in zip(p.months, w["monthly"].array) {
                XCTAssertEqual(m.gross, t["Gross"].double, accuracy: 0.005, "\(year) \(m.name) gross"); XCTAssertEqual(m.deductions, t["Deductions"].double, accuracy: 0.005, "\(year) \(m.name) deductions")
                XCTAssertEqual(m.net, t["Net"].double, accuracy: 0.005, "\(year) \(m.name) net")
                for f in p.fields.earnings + p.fields.deductions { XCTAssertEqual(m.values[f.key] ?? 0, t[f.key].double, accuracy: 0.005, "\(year) \(m.name) \(f.key)") }
            }
            XCTAssertEqual(p.totalGross, w["aggregates"]["totalGross"].double, accuracy: 0.005, year); XCTAssertEqual(p.totalNet, w["aggregates"]["totalNet"].double, accuracy: 0.005, year)
            XCTAssertEqual(p.totalIncomeTax, w["aggregates"]["totalIncomeTax"].double, accuracy: 0.005, year); XCTAssertEqual(p.totalEpf, w["aggregates"]["totalEpf"].double, accuracy: 0.005, year)
            XCTAssertEqual(p.annualTotal, w["annualTotal"].double, accuracy: 0.005, year)
            if p.annualRecord != nil {
                for c in p.comparison { XCTAssertEqual(c.target, w["comparison"][c.field.key]["target"].double, accuracy: 0.005, "\(year) \(c.field.key)"); XCTAssertEqual(c.received, w["comparison"][c.field.key]["received"].double, accuracy: 0.005, "\(year) \(c.field.key)") }
            } else { XCTAssertTrue(w["comparison"].isNull, "\(year) comparison") }
            XCTAssertEqual(p.gratuity.total, w["gratuity"].double, accuracy: 0.005, year); XCTAssertEqual(p.gratuity.thisYear, w["gratuityYear"].double, accuracy: 0.005, year)
            checked += p.months.count
        }
        print("parity: salary — \(web["years"].array.count) years, \(checked) months compared, \(annual.count) annual packages")
    }

    func testTaxesMatchTheWebApp() throws {
        let db = try load("KUBERA_DB"), web = try load("KUBERA_GOLDEN")["taxes"]
        for fy in web["fys"].array.map({ $0.text }) {
            let i = TaxesPage.prefill(fy: fy, taxes: db["taxes"], salaryDetails: db["salaryDetails"], savings: db["savings"]), w = web["prefill"][fy]
            for (name, a, b) in [("basic", i.basic, "basic"), ("hra", i.hra, "hra"), ("other", i.other, "other"), ("bonus", i.bonus, "bonus"), ("tds", i.tdsPaid, "tds"), ("80C", i.sec80C, "sec80C")] {
                XCTAssertEqual(a, w[b].double, accuracy: 0.005, "prefill \(fy) \(name)")
            }
            let r = TaxesPage.calculate(i), c = web["calc"][fy]
            XCTAssertEqual(r.oldTax, c["oldTax"].double, accuracy: 0.005, fy); XCTAssertEqual(r.newTax, c["newTax"].double, accuracy: 0.005, fy)
            XCTAssertEqual(r.newIsBetter, c["isNewRegimeBetter"].isTrue, fy); XCTAssertEqual(r.hraExemption, c["hraExemption"].double, accuracy: 0.005, fy)
        }
        for c in web["cases"].array {
            let v = c["in"].array.map { $0.double }
            let r = TaxesPage.calculate(.init(basic: v[0], hra: v[1], other: v[2], bonus: v[3], tdsPaid: v[4], sec80C: v[5], sec80D: v[6], nps: v[7], homeLoanInterest: v[8], rent: v[9], metro: c["in"][10].isTrue)), o = c["out"]
            XCTAssertEqual(r.gross, o["grossIncome"].double, accuracy: 0.005); XCTAssertEqual(r.oldDeductions, o["totalOldDeductions"].double, accuracy: 0.005)
            XCTAssertEqual(r.oldTaxable, o["oldTaxableIncome"].double, accuracy: 0.005); XCTAssertEqual(r.newTaxable, o["newTaxableIncome"].double, accuracy: 0.005)
            XCTAssertEqual(r.oldTax, o["oldTax"].double, accuracy: 0.005); XCTAssertEqual(r.newTax, o["newTax"].double, accuracy: 0.005)
            XCTAssertEqual(r.difference, o["taxDifference"].double, accuracy: 0.005); XCTAssertEqual(r.newIsBetter, o["isNewRegimeBetter"].isTrue)
            XCTAssertEqual(r.oldRefundOrPayable, o["oldRefundOrPayable"].double, accuracy: 0.005); XCTAssertEqual(r.newRefundOrPayable, o["newRefundOrPayable"].double, accuracy: 0.005)
        }
        let rows = TaxesPage.records(db["taxes"]), t = TaxesPage.totals(rows)
        XCTAssertEqual(rows.map { $0.fy }, db["taxes"].array.map { $0["financialYear"].text }.sorted(by: >))
        print("parity: taxes — \(rows.count) returns, \(web["fys"].array.count) prefills, \(web["cases"].array.count) regime cases; paid \(t.taxPaid), refunds received \(t.refundReceived)")
    }

    func testGoalsMatchTheWebApp() throws {
        let db = try load("KUBERA_DB"), golden = try load("KUBERA_GOLDEN"), web = golden["goals"]
        let page = GoalsPage.page(goals: db["goals"], savings: db["savings"], lents: db["lents"], asOf: try frozenNow(golden))
        XCTAssertEqual(page.goals.map { $0.id }, web["processedGoals"].array.map { $0["id"].text })
        for (m, t) in zip(page.goals, web["processedGoals"].array) {
            XCTAssertEqual(m.saved, t["currentSaved"].double, accuracy: 0.005, m.name); XCTAssertEqual(m.progressPct, t["progressPct"].double, m.name)
            XCTAssertEqual(m.status, t["status"].text, m.name)
            if let d = m.daysLeft { XCTAssertEqual(d, t["diffDays"].double, m.name) } else { XCTAssertTrue(t["diffDays"].isNull, m.name) }
        }
        XCTAssertEqual(page.totalTarget, web["totalTargetAmount"].double, accuracy: 0.005); XCTAssertEqual(page.totalAchieved, web["totalAchievedAmount"].double, accuracy: 0.005)
        XCTAssertEqual(page.overallProgress, web["overallProgress"].double)
        print("parity: goals — \(page.goals.count) goals, achieved \(page.totalAchieved) of \(page.totalTarget)")
    }

    func testInsuranceMatchesTheWebApp() throws {
        let db = try load("KUBERA_DB"), web = try load("KUBERA_GOLDEN")["insurance"]
        let stored = InsurancePage.profile(appData: db["appData"], salaryDetails: db["salaryDetails"])
        if !web["profile"].isNull { XCTAssertEqual(stored.annualIncome, web["profile"]["annualIncome"].double); XCTAssertEqual(stored.dependents, web["profile"]["dependents"].double) }
        let tabs: [String: InsurancePage.Tab] = ["all": .all, "bike": .bike, "life": .life, "health": .health, "home": .home]
        var shown = 0
        for c in web["cases"].array {
            let pr = c["profile"]
            let p = InsurancePage.page(savings: db["savings"], profile: .init(age: pr["age"].double, dependents: pr["dependents"].double, annualIncome: pr["annualIncome"].double, liabilities: pr["liabilities"].double),
                                       tab: tabs[c["tab"].text]!, showArchived: c["showArchived"].isTrue)
            let o = c["out"], tag = "\(c["tab"].text) archived=\(c["showArchived"].isTrue)"
            XCTAssertEqual(p.policies.map { $0.id }, o["policyItems"].array.map { $0["id"].text }, tag); XCTAssertEqual(p.shown.map { $0.id }, o["filteredPolicies"].array.map { $0["id"].text }, tag)
            XCTAssertEqual(p.archivedCount, Int(o["archivedCount"].double), tag)
            for (a, b) in [(p.life, "existingLifeCover"), (p.health, "existingHealthCover"), (p.bike, "totalBikeIdv"), (p.car, "totalCarIdv"), (p.home, "totalHomeCover"), (p.premiums, "totalAnnualPremiums"),
                           (p.recommendedLife, "recommendedLifeCover"), (p.recommendedHealth, "recommendedHealthCover"), (p.lifeGap, "lifeGap"), (p.healthGap, "healthGap"), (p.lifePct, "lifeCoveragePct"), (p.healthPct, "healthCoveragePct")] {
                XCTAssertEqual(a, o[b].double, accuracy: 0.005, "\(tag) \(b)")
            }
            XCTAssertEqual(p.vehicles, o["bikeVehicleList"].array.map { $0.text }, tag)
            XCTAssertEqual(p.policies.map { InsurancePage.isExpired($0, today: web["today"].text) }, o["expired"].array.map { $0.isTrue }, tag)
            shown += p.shown.count
        }
        print("parity: insurance — \(web["cases"].array.count) tab/profile/archive combinations, \(shown) policy rows compared")
    }

    func testRecurringAndCashflowMatchTheWebApp() throws {
        let db = try load("KUBERA_DB"), golden = try load("KUBERA_GOLDEN")
        let asOf = try frozenNow(golden)
        let series = Recurring.detect(db["expenses"], asOf: asOf), web = golden["recurring"]["detected"].array
        XCTAssertEqual(series.map { $0.key }, web.map { $0["key"].text }, "which series, in order")
        for (m, t) in zip(series, web) {
            let tag = m.key
            XCTAssertEqual(m.label, t["label"].text, tag); XCTAssertEqual(m.kind, t["kind"].text, tag); XCTAssertEqual(m.cadence, t["cadence"].text, tag)
            XCTAssertEqual(m.medianGap, t["medianGap"].double, tag); XCTAssertEqual(m.count, Int(t["count"].double), tag)
            XCTAssertEqual(m.typical, t["typical"].double, accuracy: 0.005, tag); XCTAssertEqual(m.min, t["min"].double, accuracy: 0.005, tag); XCTAssertEqual(m.max, t["max"].double, accuracy: 0.005, tag)
            XCTAssertEqual(m.first, t["first"].text, tag); XCTAssertEqual(m.last, t["last"].text, tag); XCTAssertEqual(m.nextExpected, t["nextExpected"].text, tag)
            XCTAssertEqual(m.active, t["active"].isTrue, tag); XCTAssertEqual(m.total, t["total"].double, accuracy: 0.005, tag)
            XCTAssertEqual(m.annualRunRate, t["annualRunRate"].double, accuracy: 0.005, tag); XCTAssertEqual(m.priceChangePct, t["priceChangePct"].double, accuracy: 1e-6, tag)
            XCTAssertEqual(m.events.map { $0.card ?? "" }, t["cards"].array.map { $0.text }, tag)
        }
        let over = Recurring.applyOverrides(series, db["appData"]["recurringOverrides"])
        for (m, t) in zip(over, golden["recurring"]["overridden"].array) {
            XCTAssertEqual(m.status, t["status"].text, m.key); XCTAssertEqual(m.active, t["active"].isTrue, m.key); XCTAssertEqual(m.chargedAfterCancel, t["chargedAfterCancel"].isTrue, m.key)
        }
        var rows = 0
        for days in [30, 60, 90] {
            let f = Cashflow.build(expenses: db["expenses"], creditCards: db["creditCards"], loans: db["loans"], overrides: db["appData"]["recurringOverrides"], asOf: asOf, days: days), w = golden["cashflow"]["\(days)"]
            XCTAssertEqual(f.salaryAmount, w["salaryAmount"].double, "\(days) salary"); XCTAssertEqual(f.monthlyCommitted, w["monthlyCommitted"].double, accuracy: 0.005, "\(days) committed")
            XCTAssertEqual(f.events.map { "\($0.date)|\($0.kind)|\($0.label)" }, w["events"].array.map { "\($0["date"].text)|\($0["kind"].text)|\($0["label"].text)" }, "\(days) events")
            for (m, t) in zip(f.events, w["events"].array) {
                if t["amount"].isNull { XCTAssertNil(m.amount, "\(days) \(m.label)") } else { XCTAssertEqual(m.amount ?? -1, t["amount"].double, accuracy: 0.005, "\(days) \(m.label)") }
                XCTAssertEqual(m.detail, t["detail"].text); XCTAssertEqual(m.includes.map { "\($0.label)=\($0.amount)" }, t["includes"].array.map { "\($0["label"].text)=\($0["amount"].double)" }, "\(days) \(m.label) includes")
            }
            XCTAssertEqual(f.cycles.map { "\($0.from)>\($0.to)" }, w["cycles"].array.map { "\($0["from"].text)>\($0["to"].text)" }, "\(days) cycles")
            for (m, t) in zip(f.cycles, w["cycles"].array) { XCTAssertEqual(m.income, t["income"].double, accuracy: 0.005); XCTAssertEqual(m.committed, t["committed"].double, accuracy: 0.005); XCTAssertEqual(m.unknown, Int(t["unknown"].double)) }
            rows += f.events.count
        }
        print("parity: recurring — \(series.count) series; cashflow — \(rows) events over 30/60/90 days")
    }

    func testNetWorthHistoryMatchesTheWebApp() throws {
        let db = try load("KUBERA_DB"), golden = try load("KUBERA_GOLDEN"), web = golden["netWorthHistory"]
        let s = NetWorthHistory.series(savings: db["savings"], metals: db["metals"], assets: db["assets"], loans: db["loans"], now: try frozenNow(golden))
        let wp = web["series"]["points"].array
        XCTAssertEqual(s.points.map { $0.month }, wp.map { $0["month"].text }, "months")
        for (m, t) in zip(s.points, wp) {
            for c in NetWorthHistory.components { XCTAssertEqual(m.values[c] ?? 0, t[c].double, accuracy: 0.005, "\(m.month) \(c)") }
            XCTAssertEqual(m.debt, t["debt"].double, accuracy: 0.005, m.month); XCTAssertEqual(m.gross, t["gross"].double, accuracy: 0.005, m.month); XCTAssertEqual(m.net, t["net"].double, accuracy: 0.005, m.month)
        }
        let u = web["series"]["undated"]
        XCTAssertEqual(s.undated.total, u["total"].double, accuracy: 0.005); XCTAssertEqual(s.undated.items.map { $0.name }, u["items"].array.map { $0["name"].text })
        let years = NetWorthHistory.contributionByYear(s.points)
        XCTAssertEqual(years.map { $0.year }, web["byYear"].array.map { $0["year"].text })
        for (m, t) in zip(years, web["byYear"].array) { XCTAssertEqual(m.added, t["added"].double, accuracy: 0.005, m.year) }
        let steps = NetWorthHistory.bigSteps(s.points)
        XCTAssertEqual(steps.map { $0.month }, web["steps"].array.map { $0["month"].text })
        print("parity: net worth history — \(s.points.count) months, \(years.count) years, \(steps.count) steps to check, \(s.undated.items.count) undated")
    }

    func testSpendingAnalyticsMatchTheWebApp() throws {
        let db = try load("KUBERA_DB"), golden = try load("KUBERA_GOLDEN"), web = golden["spending"]
        let kinds = TransactionKind.categoryKinds(from: db["appData"]), now = try frozenNow(golden)
        let series = SpendingAnalytics.monthlySeries(db["expenses"], kinds)
        XCTAssertEqual(series.map { $0.month }, web["series"].array.map { $0["month"].text })
        for (m, t) in zip(series, web["series"].array) {
            for (a, b) in [(m.income, "income"), (m.spend, "spend"), (m.netSpend, "netSpend"), (m.refunds, "refunds"), (m.transfers, "transfers"), (m.settlements, "settlements"),
                           (m.lending, "lending"), (m.transfersIn, "transfersIn"), (m.payroll, "payroll"), (m.surplus, "surplus")] { XCTAssertEqual(a, t[b].double, accuracy: 0.005, "\(m.month) \(b)") }
            XCTAssertEqual(m.incomeIncomplete, t["incomeIncomplete"].isTrue, m.month); XCTAssertEqual(m.noIncomeRecorded, t["noIncomeRecorded"].isTrue, m.month)
            if let r = m.savingsRate { XCTAssertEqual(r, t["savingsRate"].double, accuracy: 1e-6, m.month) } else { XCTAssertTrue(t["savingsRate"].isNull, m.month) }
        }
        let o = try XCTUnwrap(SpendingAnalytics.overview(db["expenses"], kinds, now: now)), wo = web["overview"]
        XCTAssertEqual(o.normalSpend, wo["normalSpend"].double, accuracy: 0.005); XCTAssertEqual(o.normalIncome, wo["normalIncome"].double, accuracy: 0.005)
        XCTAssertEqual(o.monthsMissingIncome, wo["monthsMissingIncome"].array.map { $0.text }); XCTAssertEqual(o.monthsWithIncome, Int(wo["monthsWithIncome"].double))
        if let r = o.medianSavingsRate { XCTAssertEqual(r, wo["medianSavingsRate"].double, accuracy: 1e-6) } else { XCTAssertTrue(wo["medianSavingsRate"].isNull) }
        XCTAssertEqual(o.complete.map { $0.month }, wo["complete"].array.map { $0.text })

        func movers(_ m: SpendingAnalytics.Movers, _ t: JSONValue, _ label: String) {
            XCTAssertEqual(m.month ?? "", t["month"].text, label); XCTAssertEqual(m.rows.map { $0.category }, t["rows"].array.map { $0["category"].text }, "\(label) rows")
            XCTAssertEqual(m.increases.map { $0.category }, t["increases"].array.map { $0["category"].text }, "\(label) increases"); XCTAssertEqual(m.decreases.map { $0.category }, t["decreases"].array.map { $0["category"].text }, "\(label) decreases")
            for (r, w) in zip(m.rows, t["rows"].array) {
                XCTAssertEqual(r.current, w["current"].double, accuracy: 0.005, r.category); XCTAssertEqual(r.normal, w["normal"].double, accuracy: 0.005, r.category)
                XCTAssertEqual(r.monthsSeen, Int(w["monthsSeen"].double), r.category); XCTAssertEqual(r.isNew, w["isNew"].isTrue, r.category); XCTAssertEqual(r.stopped, w["stopped"].isTrue, r.category)
                if let p = r.changePct { XCTAssertEqual(p, w["changePct"].double, accuracy: 1e-6, r.category) } else { XCTAssertTrue(w["changePct"].isNull, r.category) }
            }
        }
        movers(SpendingAnalytics.movers(db["expenses"], kinds, month: o.lastComplete?.month), web["movers"], "movers")
        movers(SpendingAnalytics.movers(db["expenses"], kinds, month: o.complete.suffix(8).first?.month), web["moversOlder"], "older movers")
        for w in [6, 12, 24] {
            let c = SpendingAnalytics.concentration(db["expenses"], kinds, months: w), wc = web["conc"]["\(w)"]
            XCTAssertEqual(c.rows.map { $0.category }, wc["rows"].array.map { $0["category"].text }, "conc \(w)"); XCTAssertEqual(c.total, wc["total"].double, accuracy: 0.005); XCTAssertEqual(c.categoriesTo80, Int(wc["categoriesTo80"].double))
            let t = SpendingAnalytics.trends(db["expenses"], kinds, windowMonths: w), wt = web["trends"]["\(w)"].array
            XCTAssertEqual(t.map { $0.category }, wt.map { $0["category"].text }, "trends \(w)")
            for (a, b) in zip(t, wt) { XCTAssertEqual(a.change, b["change"].double, accuracy: 0.005, a.category); XCTAssertEqual(a.direction, b["direction"].text, a.category); XCTAssertEqual(a.activeMonths, Int(b["activeMonths"].double), a.category) }
            let out = SpendingAnalytics.outliers(db["expenses"], kinds, sinceMonths: w), wout = web["outliers"]["\(w)"].array
            XCTAssertEqual(out.map { $0.txId }, wout.map { $0["id"].text }, "outliers \(w)")
        }
        print("parity: spending analytics — \(series.count) months, \(web["movers"]["rows"].array.count) movers, normal month \(o.normalSpend)")
    }

    func testMoneyFlowMatchesTheWebApp() throws {
        let db = try load("KUBERA_DB"), golden = try load("KUBERA_GOLDEN"), now = try frozenNow(golden)
        let kinds = TransactionKind.categoryKinds(from: db["appData"])
        for (key, period) in [("12m", MoneyFlow.Period.twelve), ("year", .year), ("all", .all)] {
            let p = MoneyFlow.page(expenses: db["expenses"], kinds: kinds, period: period, now: now), w = golden["moneyFlow"][key]
            XCTAssertEqual(p.breakdown.gross, w["breakdown"]["gross"].double, accuracy: 0.005, key); XCTAssertEqual(p.naive, w["naive"].double, accuracy: 0.005, key)
            XCTAssertEqual(p.averageSpend, w["avg"]["average"].double, accuracy: 0.005, key); XCTAssertEqual(p.averageMonths, Int(w["avg"]["months"].double), key)
            for (r, t) in zip(p.breakdown.rows, w["breakdown"]["rows"].array) {
                XCTAssertEqual(r.kind.rawValue, t["kind"].text); XCTAssertEqual(r.total, t["total"].double, accuracy: 0.005, "\(key) \(r.kind)"); XCTAssertEqual(r.count, Int(t["count"].double), "\(key) \(r.kind)")
                // Equal totals can come out in either order (the file's own month order decides in the web app), so compare name by name.
                XCTAssertEqual(Dictionary(uniqueKeysWithValues: r.categories.map { ($0.category, $0.amount) }), Dictionary(uniqueKeysWithValues: t["categories"].array.map { ($0["category"].text, $0["amount"].double) }), "\(key) \(r.kind) categories")
                XCTAssertEqual(r.categories.map { $0.amount }, t["categories"].array.map { $0["amount"].double }, "\(key) \(r.kind) amounts in order")
            }
            let u = w["breakdown"]["unreviewed"]
            XCTAssertEqual(p.breakdown.unreviewed.total, u["total"].double, accuracy: 0.005, key); XCTAssertEqual(p.breakdown.unreviewed.count, Int(u["count"].double), key)
            XCTAssertEqual(p.breakdown.unreviewed.categories.map { $0.amount }, u["categories"].array.map { $0["amount"].double }, key)
            XCTAssertEqual(p.categories.map { $0.amount }, w["categoryRows"].array.map { $0["amount"].double }, "\(key) category amounts in order")
            let byName = Dictionary(uniqueKeysWithValues: w["categoryRows"].array.map { ($0["category"].text, $0) })
            XCTAssertEqual(Set(p.categories.map { $0.category }), Set(byName.keys), "\(key) category set")
            for r in p.categories {
                guard let t = byName[r.category] else { continue }
                XCTAssertEqual(r.kind.rawValue, t["kind"].text, r.category); XCTAssertEqual(r.suggested.rawValue, t["suggested"].text, r.category); XCTAssertEqual(r.vague, t["vague"].isTrue, r.category)
                XCTAssertEqual(r.assigned?.rawValue ?? "", t["assigned"].text, r.category); XCTAssertEqual(r.amount, t["amount"].double, accuracy: 0.005, r.category)
            }
        }
        print("parity: money flow — 3 periods, \(MoneyFlow.page(expenses: db["expenses"], kinds: kinds, period: .all, now: now).categories.count) categories")
    }

    func testCardIntelligenceMatchesTheWebApp() throws {
        let db = try load("KUBERA_DB"), golden = try load("KUBERA_GOLDEN"), web = golden["cards"]
        let ps = Cards.profiles(creditCards: db["creditCards"], expenses: db["expenses"], now: try frozenNow(golden))
        XCTAssertEqual(ps.map { $0.name }, web["profiles"].array.map { $0["name"].text }, "cards in order")
        for (m, t) in zip(ps, web["profiles"].array) {
            let tag = m.name
            for (a, b) in [(m.limit, "limit"), (m.outstanding, "outstanding"), (m.peakBalance, "peakBalance"), (m.lifetimeSpend, "lifetimeSpend"), (m.interestPaid, "interestPaid"),
                           (m.rewards, "rewards"), (m.averageMonthlySpend, "averageMonthlySpend"), (m.worstShortfall, "worstShortfall")] { XCTAssertEqual(a, t[b].double, accuracy: 0.005, "\(tag) \(b)") }
            XCTAssertEqual(m.isWallet, t["isWallet"].isTrue, tag); XCTAssertEqual(m.transactionCount, Int(t["transactionCount"].double), tag); XCTAssertEqual(m.revolvingMonths, Int(t["revolvingMonths"].double), tag)
            XCTAssertEqual(m.lastUsed ?? "", t["lastUsed"].text, tag)
            if let d = m.daysIdle { XCTAssertEqual(d, Int(t["daysIdle"].double), tag) } else { XCTAssertTrue(t["daysIdle"].isNull, tag) }
            if let u = m.utilisation { XCTAssertEqual(u, t["utilisation"].double, accuracy: 1e-6, tag) } else { XCTAssertTrue(t["utilisation"].isNull, tag) }
            if let c = m.cycle { XCTAssertEqual(c.lastStatement, t["cycle"]["lastStatement"].text, tag); XCTAssertEqual(c.nextStatement, t["cycle"]["nextStatement"].text, tag); XCTAssertEqual(c.daysToNext, Int(t["cycle"]["daysToNextStatement"].double), tag) } else { XCTAssertTrue(t["cycle"].isNull, tag) }
            XCTAssertEqual(m.history.map { $0.month }, t["history"].array.map { $0["month"].text }, "\(tag) months")
            for (h, w) in zip(m.history, t["history"].array) {
                for (a, b) in [(h.spend, "spend"), (h.payment, "payment"), (h.interest, "interest"), (h.refund, "refund"), (h.reward, "reward"), (h.shortfall, "shortfall")] { XCTAssertEqual(a, w[b].double, accuracy: 0.005, "\(tag) \(h.month) \(b)") }
                XCTAssertEqual(h.revolved, w["revolved"].isTrue, "\(tag) \(h.month)"); XCTAssertEqual(h.tracked, w["trackedBalance"].isTrue, "\(tag) \(h.month)")
                if let c = h.closing { XCTAssertEqual(c, w["closingBalance"].double, accuracy: 0.005, "\(tag) \(h.month)") } else { XCTAssertTrue(w["closingBalance"].isNull, "\(tag) \(h.month)") }
            }
            XCTAssertEqual(m.interestMonths.map { $0.month }, t["interestMonths"].array.map { $0["month"].text }, tag)
            XCTAssertEqual(m.topCategories.map { $0.amount }, t["topCategories"].array.map { $0["amount"].double }, "\(tag) top categories")
        }
        let tot = Cards.totals(ps), wt = web["totals"]
        for (a, b) in [(tot.limit, "limit"), (tot.outstanding, "outstanding"), (tot.available, "available"), (tot.interestPaid, "interestPaid"), (tot.lifetimeSpend, "lifetimeSpend")] { XCTAssertEqual(a, wt[b].double, accuracy: 0.005, b) }
        XCTAssertEqual(tot.utilisation, wt["utilisation"].double, accuracy: 1e-6); XCTAssertEqual(tot.idle, wt["idle"].array.map { $0.text }); XCTAssertEqual(tot.highestUtilisation ?? "", wt["highestUtilisation"].text)
        print("parity: cards — \(ps.count) cards, \(ps.reduce(0) { $0 + $1.history.count }) card-months, outstanding \(tot.outstanding)")
    }

    func testCardsListMatchesTheWebApp() throws {
        let db = try load("KUBERA_DB"), web = try load("KUBERA_GOLDEN")["cardList"]
        let r = Cards.listCards(creditCards: db["creditCards"], expenses: db["expenses"])
        XCTAssertEqual(r.cards.map { $0.id }, web["cards"].array.map { $0["id"].text })
        for (m, t) in zip(r.cards, web["cards"].array) {
            XCTAssertEqual(m.spend, t["spend"].double, accuracy: 0.005, m.name); XCTAssertEqual(m.wallet, t["wallet"].double, accuracy: 0.005, m.name)
            XCTAssertEqual(m.points, t["points"].double, accuracy: 0.005, m.name); XCTAssertEqual(m.pending, t["pending"].double, accuracy: 0.005, m.name)
        }
        XCTAssertEqual(r.totalDue, web["totalDue"].double, accuracy: 0.005)
        print("parity: cards list — \(r.cards.count) cards, total due \(r.totalDue)")
    }

    func testWarrantiesAndDataHealthMatchTheWebApp() throws {
        let db = try load("KUBERA_DB"), golden = try load("KUBERA_GOLDEN"), now = try frozenNow(golden)
        let w = Warranty.summary(assets: db["assets"], today: now), ww = golden["warranty"]
        XCTAssertEqual([w.total, w.active, w.expiring, w.expired, w.unknown, w.missingReceipt], ["total", "active", "expiring", "expired", "unknown", "missingReceipt"].map { Int(ww[$0].double) })
        XCTAssertEqual(w.rows.map { $0.name }, ww["rows"].array.map { $0["name"].text }, "warranty rows in order")
        for (m, t) in zip(w.rows, ww["rows"].array) {
            XCTAssertEqual(m.status.state.rawValue, t["state"].text, m.name); XCTAssertEqual(m.status.expiryIso ?? "", t["expiry"].text, m.name); XCTAssertEqual(m.status.extended, t["extended"].isTrue, m.name)
            if let d = m.status.daysLeft { XCTAssertEqual(d, Int(t["daysLeft"].double), m.name) } else { XCTAssertTrue(t["daysLeft"].isNull, m.name) }
            XCTAssertEqual(m.services.paid, t["services"]["paid"].double, accuracy: 0.005, m.name); XCTAssertEqual(m.services.covered, t["services"]["covered"].double, accuracy: 0.005, m.name)
        }
        let checks = DataHealth.run(expenses: db["expenses"], salaryDetails: db["salaryDetails"], creditCards: db["creditCards"], assets: db["assets"], today: now), wc = golden["health"].array
        XCTAssertEqual(checks.map { $0.id }, wc.map { $0["id"].text }, "checks in order")
        for (m, t) in zip(checks, wc) {
            XCTAssertEqual(m.severity.rawValue, t["severity"].text, m.id); XCTAssertEqual(m.count, Int(t["count"].double), m.id); XCTAssertEqual(m.total, t["total"].double, accuracy: 0.005, m.id)
            XCTAssertEqual(m.title, t["title"].text, m.id); XCTAssertEqual(m.detail, t["detail"].text, m.id)
        }
        print("parity: warranties — \(w.total) items; data health — \(checks.count) checks (\(checks.filter { $0.severity != .ok }.count) with findings)")
    }

    func testMonthCategoriesMatchTheWebApp() throws {
        let db = try load("KUBERA_DB"), web = try load("KUBERA_GOLDEN")["monthCategories"]
        let map = Budgets.categoryMap(appData: db["appData"])
        let slips = ExpenseLedger.payslips(db["salaryDetails"])
        func same(_ mine: [MonthCategories.Item], _ theirs: [JSONValue], _ tag: String) {
            // Ties keep JavaScript insertion order, which an unordered decode cannot see.
            let a = mine.map { "\($0.category)|\($0.mainCategory)|\(String(format: "%.2f|%.2f", $0.amount, $0.deductibleAmount))" }.sorted()
            let b = theirs.map { "\($0["category"].text)|\($0["mainCategory"].text)|\(String(format: "%.2f|%.2f", $0["amount"].double, $0["deductibleAmount"].double))" }.sorted()
            XCTAssertEqual(a, b, tag)
            XCTAssertEqual(mine.map(\.amount), theirs.map { $0["amount"].double }, "\(tag) order")
        }
        for m in web.array {
            let (y, mo) = (m["year"].text, m["month"].text), tag = "\(y) \(mo)"
            let node = db["expenses"][y][mo]
            let d = MonthCategories.detail(node: node, salary: ExpenseLedger.configuredSalary(year: y, month: mo, node: node, slips: slips), map: map)
            XCTAssertEqual(d.salary, m["salary"].double, accuracy: 0.005, tag)
            same(d.items, m["items"].array, "\(tag) items")
            same(d.mainItems, m["mainItems"].array, "\(tag) main")
            XCTAssertEqual(d.income.map { "\($0.category)|\($0.amount)|\($0.percentage)" }.sorted(),
                           m["income"].array.map { "\($0["category"].text)|\($0["amount"].double)|\(Int($0["percentage"].double))" }.sorted(), "\(tag) income")
        }
        print("parity: month categories — \(web.array.count) months")
    }

    func testBudgetsMatchTheWebApp() throws {
        let db = try load("KUBERA_DB"), web = try load("KUBERA_GOLDEN")["budgets"]
        let map = Budgets.categoryMap(appData: db["appData"])
        XCTAssertEqual(Set(map.map { $0.main }), Set(web["map"].array.map { $0[0].text }), "main categories")
        for (main, subs) in map { XCTAssertEqual(Set(subs), Set((web["map"].array.first { $0[0].text == main }?[1].array ?? []).map { $0.text }), main) }
        for m in web["months"].array {
            let tag = "\(m["year"].text) \(m["month"].text)"
            let sp = Budgets.spending(expenses: db["expenses"], year: m["year"].text, month: m["month"].text, map: map)
            for (k, v) in m["sub"].object { XCTAssertEqual(sp.sub[k] ?? 0, v.double, accuracy: 0.005, "\(tag) sub \(k)") }
            for (k, v) in m["main"].object { XCTAssertEqual(sp.main[k] ?? 0, v.double, accuracy: 0.005, "\(tag) main \(k)") }
            XCTAssertEqual(sp.sub.count, m["sub"].object.count, tag); XCTAssertEqual(sp.main.count, m["main"].object.count, tag)
            let st = Budgets.stats(map: map, budgets: web["budgets"], spending: sp), w = m["stats"]
            XCTAssertEqual(st.totalTarget, w["totalTarget"].double, accuracy: 0.005, tag); XCTAssertEqual(st.totalActual, w["totalActual"].double, accuracy: 0.005, tag)
            XCTAssertEqual([st.over, st.warning, st.safe, st.tracked], ["overBudgetCount", "warningCount", "safeCount", "totalTrackedCategories"].map { Int(w[$0].double) }, tag); XCTAssertEqual(st.health, w["healthScore"].double, tag)
        }
        print("parity: budgets — \(web["months"].array.count) months, \(map.count) categories")
    }

    func testFuelMatchesTheWebApp() throws {
        let db = try load("KUBERA_DB"), web = try load("KUBERA_GOLDEN")["fuel"]
        XCTAssertEqual(Fuel.page(expenses: db["expenses"]).years, web["years"].array.map { Int($0.double) })
        var rows = 0
        for c in web["cases"].array {
            let tag = "\(c["v"].text)/\(c["y"].text)/\(c["m"].text)"
            let p = Fuel.page(expenses: db["expenses"], vehicle: c["v"].text, year: c["y"].text, month: c["m"].text)
            XCTAssertEqual(p.rows.count, Int(c["count"].double), tag)
            for (a, b) in [(p.totalSpent, "totalSpent"), (p.totalLiters, "totalLiters"), (p.totalDistance, "totalDistance"), (p.avgMileage, "avgMileage"), (p.avgPrice, "avgPrice")] { XCTAssertEqual(a, c[b].double, accuracy: 1e-6, "\(tag) \(b)") }
            XCTAssertEqual(p.validMileage, Int(c["valid"].double), tag)
            for (m, t) in zip(p.rows, c["rows"].array) {
                XCTAssertEqual(m.txId, t["id"].text, tag)
                if let d = m.distance { XCTAssertEqual(d, t["distance"].double, accuracy: 1e-9, tag) } else { XCTAssertTrue(t["distance"].isNull, tag) }
                if let x = m.mileage { XCTAssertEqual(x, t["mileage"].double, accuracy: 1e-9, tag) } else { XCTAssertTrue(t["mileage"].isNull, tag) }
                if let x = m.pricePerLiter { XCTAssertEqual(x, t["pricePerLiter"].double, accuracy: 1e-9, tag) } else { XCTAssertTrue(t["pricePerLiter"].isNull, tag) }
            }
            rows += p.rows.count
        }
        print("parity: fuel — \(web["cases"].array.count) filter sets, \(rows) fill-ups")
    }

    func testGroceriesMatchTheWebApp() throws {
        let db = try load("KUBERA_DB"), web = try load("KUBERA_GOLDEN")["grocery"]
        let all = Groceries.all(db["expenses"])
        XCTAssertEqual(all.count, Int(web["total"].double)); XCTAssertEqual(all.prefix(40).map { "\($0.txId)|\($0.name)|\(jsNum($0.price))" }, web["first"].array.map { $0.text })
        for c in web["cases"].array {
            let tag = "\(c["c"].text)/\(c["i"].text)"
            let o = Groceries.options(all, category: c["c"].text, item: c["i"].text, brand: c["b"].text), w = c["opts"]
            XCTAssertEqual(o.categories, w["categories"].array.map { $0.text }, tag); XCTAssertEqual(o.items, w["items"].array.map { $0.text }, tag)
            XCTAssertEqual(o.brands, w["brands"].array.map { $0.text }, tag); XCTAssertEqual(o.flavours, w["flavours"].array.map { $0.text }, tag)
            let rows = Groceries.filter(all, category: c["c"].text, item: c["i"].text, brand: c["b"].text, flavour: c["f"].text), st = Groceries.stats(rows)
            XCTAssertEqual(rows.count, Int(c["count"].double), tag)
            XCTAssertEqual(st.totalSpent, c["stats"]["totalSpent"].double, accuracy: 0.005, tag); XCTAssertEqual(st.avgPrice, c["stats"]["avgPrice"].double, accuracy: 1e-6, tag)
        }
        print("parity: groceries — \(all.count) line items")
    }
    private func jsNum(_ v: Double) -> String { v == v.rounded() && abs(v) < 1e15 ? String(Int64(v)) : String(v) }

    func testGroceryMasterMatchesTheWebApp() throws {
        let db = try load("KUBERA_DB"), web = try load("KUBERA_GOLDEN")["groceryMaster"]
        let cats = GroceryMaster.categories(appData: db["appData"])
        XCTAssertEqual(Set(cats.map { $0.category }), Set(web["categories"].array.map { $0[0].text }))
        for (name, items) in web["items"].object {
            XCTAssertEqual(GroceryMaster.items(of: name, base: cats, appData: db["appData"], expenses: db["expenses"]), items.array.map { $0.text }, name)
        }
        print("parity: grocery master — \(cats.count) categories")
    }

    func testAllTransactionsMatchTheWebApp() throws {
        let db = try load("KUBERA_DB"), web = try load("KUBERA_GOLDEN")["allTx"]
        let all = AllTransactions.list(db["expenses"])
        XCTAssertEqual(all.count, Int(web["total"].double)); XCTAssertEqual(AllTransactions.years(all), web["years"].array.map { $0.text })
        func key(_ r: AllTransactions.Row) -> String { "\(r.raw["id"].text)|\(r.date)" }
        XCTAssertEqual(all.prefix(25).map(key), web["first"].array.map { $0.text }, "newest first")
        let map = Budgets.categoryMap(appData: db["appData"])
        for c in web["cases"].array {
            let o = c["o"], tag = o.object.keys.sorted().joined(separator: ",") + ":" + o.object.values.map { $0.text }.joined(separator: ",")
            let rows = AllTransactions.filter(all, search: o["search"].text, type: o["type"].text == "credit" ? .credit : o["type"].text == "debit" ? .debit : .all,
                                              year: o["year"].truthy ? o["year"].text : "all", month: o["month"].truthy ? o["month"].text : "all", category: o["cat"].truthy ? o["cat"].text : "all",
                                              subCategory: o["sub"].truthy ? o["sub"].text : "all", onlyWasteful: o["waste"].text == "only", issue: o["issue"].truthy ? o["issue"].text : nil, map: map)
            XCTAssertEqual(rows.count, Int(c["count"].double), tag)
            XCTAssertEqual(rows.prefix(25).map(key), c["first"].array.map { $0.text }, tag)
            let w = AllTransactions.waste(rows)
            XCTAssertEqual(w.total, c["waste"]["total"].double, accuracy: 0.005, tag); XCTAssertEqual(w.count, Int(c["waste"]["count"].double), tag)
        }
        print("parity: all transactions — \(all.count) rows, \(web["cases"].array.count) filter sets")
    }

    func testEveryAccountHasADetailPage() throws {
        let db = try load("KUBERA_DB"), now = try frozenNow(load("KUBERA_GOLDEN"))
        var rows = 0
        for a in db["savings"].array where a["type"].text != "stock_market" {
            let p = AccountDetail.page(a, asOf: now)
            XCTAssertFalse(p.title.isEmpty, a["id"].text)
            XCTAssertEqual(p.value, Valuation.currentValue(a, asOf: now), accuracy: 0.005, p.title)
            rows += p.sections.reduce(0) { $0 + $1.rows.count }
        }
        print("account details: \(db["savings"].array.count - 1) accounts, \(rows) ledger rows")
    }
}
