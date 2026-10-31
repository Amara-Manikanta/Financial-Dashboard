import XCTest
@testable import KuberaCore

/// Always-on tests with made-up data: the rules, not anyone's finances.
final class CoreTests: XCTestCase {
    private func json(_ text: String) -> JSONValue { try! JSONValue.parse(Data(text.utf8)) }

    func testJavaScriptNumberRules() {
        XCTAssertEqual(json("\"12.5\"").double, 12.5)
        XCTAssertEqual(json("\"\"").double, 0)
        XCTAssertEqual(json("null").double, 0)
        XCTAssertEqual(json("true").double, 1)
        XCTAssertNil(json("\"1,200\"").jsNumber)          // NaN in JavaScript, so `|| 0` makes it 0
        XCTAssertEqual(json("\"1,200\"").double, 0)
        XCTAssertEqual(json("{\"a\":1}")["a"].double, 1)
        XCTAssertEqual(json("{}")["missing"]["deeper"].double, 0)
    }

    func testIndianRupeeFormatting() {
        XCTAssertEqual(Money.rupees(41503928.64), "₹4,15,03,928.64")
        XCTAssertEqual(Money.rupees(1200), "₹1,200")
        XCTAssertEqual(Money.rupees(0), "₹0")
        XCTAssertEqual(Money.rupees(-250.5), "-₹250.50")
        XCTAssertEqual(Money.compact(12_50_000), "₹12.50L")
    }

    func testOnlySpendingCountsAsSpending() {
        let rows = json("""
        [
          {"category":"Groceries","amount":1000,"transactionType":"debit"},
          {"category":"Mutual Funds","amount":500,"transactionType":"debit"},
          {"category":"Credit Card Payment","amount":4000,"transactionType":"debit"},
          {"category":"Loan Given","amount":300,"transactionType":"debit"},
          {"category":"Rent","amount":200,"deductFromSalary":false},
          {"category":"Refund","amount":900,"isCredited":true}
        ]
        """).array
        let b = TransactionKind.buckets(rows)
        XCTAssertEqual(b.spent, 1000)
        XCTAssertEqual(b.invested, 800)            // transfer + lending
        XCTAssertEqual(b.excluded, 4200)           // settlement + payroll
    }

    func testUserCategoryMapAndRowOverrideBeatTheDefaults() {
        let kinds: [String: Kind] = ["groceries": .transfer]
        XCTAssertEqual(TransactionKind.kind(for: json("{\"category\":\"Groceries\"}"), categoryKinds: kinds), .transfer)
        XCTAssertEqual(TransactionKind.kind(for: json("{\"category\":\"Groceries\",\"kind\":\"spend\"}"), categoryKinds: kinds), .spend)
        XCTAssertEqual(TransactionKind.kind(for: json("{\"category\":\"Other\"}")), .spend)   // vague stays spend; it is reported, not guessed
    }

    func testLegacyMonthsFallBackToCategoryTotals() {
        let expenses = json("""
        {"2019":{"March":{"categories":{"Groceries":1500,"SIP":2000,"salary received":50000}}}}
        """)
        let years = ExpenseLedger.years(expenses: expenses, categoryKinds: [:], salaryDetails: json("[]"))
        XCTAssertEqual(years.count, 1)
        let march = years[0].months[0]
        XCTAssertEqual(march.index, 2)
        XCTAssertEqual(march.spent, 1500)
        XCTAssertEqual(march.invested, 2000)
        XCTAssertEqual(march.income, 50000)
    }

    func testPayslipIncomeIsOverriddenBySalaryRowsInTheLedger() {
        let slips = json("[{\"year\":2024,\"month\":\"June\",\"basicSalary\":60000,\"hra\":20000,\"epf\":7200,\"profTax\":200}]")
        let withoutRows = json("{\"2024\":{\"June\":{\"transactions\":[{\"category\":\"Food\",\"amount\":100}]}}}")
        XCTAssertEqual(ExpenseLedger.years(expenses: withoutRows, categoryKinds: [:], salaryDetails: slips)[0].months[0].income, 72600)
        let withRows = json("{\"2024\":{\"June\":{\"transactions\":[{\"category\":\"Salary Received\",\"amount\":70000,\"isCredited\":true}]}}}")
        XCTAssertEqual(ExpenseLedger.years(expenses: withRows, categoryKinds: [:], salaryDetails: slips)[0].months[0].income, 70000)
    }

    func testStockReplayHandlesSplitsBonusesAndSales() {
        let history = json("""
        [
          {"type":"buy","date":"2024-01-10","quantity":10,"price":100},
          {"type":"buy","date":"2024-02-10","quantity":10,"price":200},
          {"type":"split","date":"2024-03-01","splitFrom":1,"splitTo":2},
          {"type":"bonus","date":"2024-04-01","quantity":5},
          {"type":"sell","date":"2024-05-01","quantity":15,"price":90}
        ]
        """).array
        let p = Stocks.replay(history)
        // 20 bought for 3000 → 40 after the split → 45 with the bonus (avg 66.67); 15 sold leaves 30.
        XCTAssertEqual(p.shares, 30)
        XCTAssertEqual(p.avgCost, 66.67, accuracy: 0.001)
    }

    func testManualAverageCostOutranksTheReplay() {
        let stock = json("{\"manualAvgCost\":\"150\",\"transactions\":[{\"type\":\"buy\",\"date\":\"2024-01-01\",\"quantity\":10,\"price\":100}]}")
        let p = Stocks.position(of: stock)
        XCTAssertEqual(p.avgCost, 150)
        XCTAssertTrue(p.avgCostIsManual)
    }

    func testFamilyAndPaperHoldingsAreNotThePortfolio() {
        let account = json("""
        {"stocks":[
          {"id":"1","name":"Mine","shares":10,"currentPrice":100},
          {"id":"2","name":"Dad","shares":10,"currentPrice":100,"owner":"member-2"},
          {"id":"3","name":"Paper","shares":10,"currentPrice":100,"owner":"physical"},
          {"id":"4","name":"Gone","shares":10,"currentPrice":100,"isArchived":true},
          {"id":"5","name":"Sold","shares":0,"currentPrice":100}
        ]}
        """)
        let p = Stocks.portfolio(account: account)
        XCTAssertEqual(p.holdings.map(\.name), ["Mine"])
        XCTAssertEqual(p.value, 1000)
    }
}

final class ValuationTests: XCTestCase {
    private func json(_ text: String) -> JSONValue { try! JSONValue.parse(Data(text.utf8)) }
    private let jan1 = JSDate.parse("2026-01-01")!

    func testGoldIsValuedByPurityAndAFilledValueIsKept() {
        let metals = json("""
        {"gold":[{"weightGm":10,"purity":24},{"weightGm":10,"purity":22},{"weightGm":10,"purity":18},{"weightGm":10,"purity":22,"currentValue":5000}],
         "silver":[{"weightGm":100}],"platinum":[],"antique_coins":[],"currencies":[]}
        """)
        let processed = NetWorth.processedMetals(metals, rates: .init(manualGold: 12000, manualSilver: 200))
        let gold = processed["gold"]!.map { $0["currentValue"].double }
        XCTAssertEqual(gold[0], 120000)
        XCTAssertEqual(gold[1], 110000, accuracy: 0.001)
        XCTAssertEqual(gold[2], 110000, accuracy: 0.001)      // 18K is valued at the 22K rate, as the web does
        XCTAssertEqual(gold[3], 5000)
        XCTAssertEqual(processed["silver"]![0]["currentValue"].double, 20000)
    }

    func testRatesFallBackWhenNothingIsSet() {
        XCTAssertEqual(NetWorth.MetalRates().gold24, 7600)
        XCTAssertEqual(NetWorth.MetalRates().silver, 95)
        XCTAssertEqual(NetWorth.MetalRates(manualGold: 0, manualSilver: 0, liveGold: 9000, liveSilver: 80).gold24, 9000)
    }

    func testFixedDepositAccruesAndStopsAtMaturity() {
        let fd = json("{\"originalAmount\":100000,\"interestRate\":8,\"startDate\":\"2025-01-01\",\"endDate\":\"2026-01-01\",\"bank\":\"HDFC\"}")
        let atMaturity = Valuation.depositValue(fd, asOf: jan1)
        // 8% compounded quarterly for 365 days.
        XCTAssertEqual(atMaturity, 100000 * pow(1.02, 4 * 365 / 365.25), accuracy: 0.01)
        XCTAssertEqual(Valuation.depositValue(fd, asOf: JSDate.parse("2030-01-01")!), atMaturity, accuracy: 0.001)   // no interest after the end date
        XCTAssertEqual(Valuation.depositValue(fd, asOf: JSDate.parse("2024-06-01")!), 100000, accuracy: 0.001)       // none before the start
    }

    func testArchivedDepositsAndAnUnparseableOneAreHandled() {
        let list = json("[{\"originalAmount\":1000,\"isArchived\":true},{\"originalAmount\":500,\"currentValue\":520,\"startDate\":\"nonsense\",\"endDate\":\"2026-01-01\"}]")
        XCTAssertEqual(Valuation.totalAccrued(list, asOf: jan1), 520)       // archived skipped; bad date falls back to the stored value
        XCTAssertEqual(Valuation.totalPrincipal(list), 500)
    }

    func testProtectionOnlyPoliciesAreNotSavings() {
        let term = json("{\"type\":\"Policy\",\"amount\":9000000,\"isProtectionOnly\":true,\"premiums\":[{\"status\":\"Paid\",\"amount\":5000}]}")
        let endowment = json("{\"type\":\"policy\",\"amount\":500000,\"premiums\":[{\"status\":\"Paid\",\"amount\":5000},{\"status\":\"Paid\",\"amount\":5000},{\"status\":\"Received\",\"amount\":2000}]}")
        let motor = json("{\"type\":\"Policy\",\"policyDetails\":{\"category\":\"Car\"},\"premiums\":[{\"status\":\"Paid\",\"amount\":900}]}")
        XCTAssertEqual(Valuation.currentValue(term), 0)
        XCTAssertEqual(Valuation.currentValue(endowment), 8000)
        XCTAssertEqual(Valuation.currentValue(motor), 0)
    }

    func testMutualFundCostFollowsAverageOnSales() {
        let fund = json("""
        {"type":"mutual_fund","currentNav":50,"transactions":[
          {"type":"buy","date":"2025-01-01","units":100,"amount":4000},
          {"type":"buy","date":"2025-02-01","units":100,"nav":60},
          {"type":"sell","date":"2025-03-01","units":50}]}
        """)
        XCTAssertEqual(Valuation.currentValue(fund), 7500)       // 150 units × 50
        XCTAssertEqual(Valuation.investedValue(fund), 7500)      // 10000 cost, a quarter of it sold
    }

    func testLoanBalanceAmortisesFromRecordedPayments() {
        let loan = json("{\"principalAmount\":100000,\"interestRate\":12,\"startDate\":\"2025-01-01\",\"payments\":[{\"date\":\"2025-02-01\",\"amount\":10000},{\"date\":\"2025-03-01\",\"amount\":10000}]}")
        let b = NetWorth.loanBalances(loan)
        XCTAssertEqual(b["2025-01"], 100000)
        XCTAssertEqual(b["2025-02"], 91000)                      // 1% interest = 1000; 9000 to principal
        XCTAssertEqual(b["2025-03"]!, 91000 - (10000 - 910), accuracy: 0.01)
    }

    func testGrowthIndexFormattingFollowsJavaScript() {
        XCTAssertEqual(NetWorth.toFixed1(12.25), "12.3")
        XCTAssertEqual(NetWorth.toFixed1(-0.04), "-0.0")
        XCTAssertEqual(NetWorth.toFixed1(13.44), "13.4")
    }
}

final class SavingsTests: XCTestCase {
    private func json(_ text: String) -> JSONValue { try! JSONValue.parse(Data(text.utf8)) }
    private let now = JSDate.parse("2026-06-01")!

    func testGratuityFromAnnualCTCWhenNoTenuresAreRecorded() {
        let rows = json("[{\"month\":\"Annual\",\"year\":2025,\"gratuity\":1000},{\"month\":\"Annual\",\"year\":2026,\"gratuity\":500},{\"month\":\"June\",\"year\":2026,\"gratuity\":99}]")
        XCTAssertEqual(SavingsPage.gratuity(employments: json("[]"), salaryDetails: rows, now: now), 1500)
    }

    func testGratuityNeedsFiveYearsAndUsesTheStatutoryFormula() {
        let current = json("[{\"startDate\":\"2018-01-01\",\"isCurrent\":true,\"lastDrawnBasic\":52000}]")
        // 8 completed years: 15 × 52000 × 8 / 26 = 240000
        XCTAssertEqual(SavingsPage.gratuity(employments: current, salaryDetails: json("[]"), now: now), 240000)
        let short = json("[{\"startDate\":\"2022-01-01\",\"endDate\":\"2024-01-01\",\"lastDrawnBasic\":52000}]")
        XCTAssertEqual(SavingsPage.gratuity(employments: short, salaryDetails: json("[]"), now: now), 0)   // left before five years: forfeited
    }

    func testOnlyMoneyReturningAccountsAreSavings() {
        XCTAssertFalse(SavingsPage.isSavings(json("{\"type\":\"mutual_fund\"}")))
        XCTAssertFalse(SavingsPage.isSavings(json("{\"type\":\"Policy\",\"isProtectionOnly\":true}")))
        XCTAssertFalse(SavingsPage.isSavings(json("{\"type\":\"Policy\",\"policyDetails\":{\"category\":\"health\"}}")))
        XCTAssertTrue(SavingsPage.isSavings(json("{\"type\":\"policy\",\"isProtectionOnly\":false}")))
        XCTAssertTrue(SavingsPage.isSavings(json("{\"type\":\"fixed_deposit\"}")))
    }

    func testAccountTitleAndLabelFollowTheWebPage() {
        let s = SavingsPage.summary(savings: json("[{\"id\":\"1\",\"type\":\"savings_account\"},{\"id\":\"2\",\"type\":\"liquid\",\"title\":\"Emergency Fund\",\"amount\":1000}]"),
                                    salaryDetails: json("[]"), employments: json("[]"), asOf: now)
        XCTAssertEqual(s.active[0].title, "savings account")
        XCTAssertEqual(s.active[1].title, "Emergency Fund")
        XCTAssertEqual(s.active[1].webPath, "/savings/emergency-fund/2")
        XCTAssertEqual(s.valueFromItems, 1000)
    }
}

final class LoansTests: XCTestCase {
    private func json(_ text: String) -> JSONValue { try! JSONValue.parse(Data(text.utf8)) }

    func testPeerDebtMovesWithAdditionsAndRepayments() {
        let debt = json("{\"amount\":10000,\"transactions\":[{\"type\":\"additional\",\"amount\":5000},{\"type\":\"repayment\",\"amount\":3000},{\"type\":\"note\",\"amount\":999}]}")
        XCTAssertEqual(LoansPage.outstanding(debt), 12000)
    }

    func testEmiMatchesTheStandardFormula() {
        // ₹30 lakh at 8.5% for 20 years is the calculator's own starting point: ₹26,035.
        let r = EMI.calculate(principal: 3_000_000, annualRatePercent: 8.5, years: 20)
        XCTAssertEqual(r.emi, 26035)
        XCTAssertEqual(r.totalPayment, 26035 * 240)
        XCTAssertEqual(r.schedule.count, 24)
        XCTAssertEqual(r.schedule[0].interest, (3_000_000 * 0.085 / 12).rounded())
        XCTAssertEqual(r.schedule[0].principal + r.schedule[0].interest, 26035)
    }

    func testZeroInterestSplitsEvenly() {
        XCTAssertEqual(EMI.calculate(principal: 120_000, annualRatePercent: 0, years: 1).emi, 10_000)
        XCTAssertEqual(EMI.calculate(principal: 0, annualRatePercent: 9, years: 5).emi, 0)
    }

    func testLoanProgressAndDueThisMonth() {
        let now = JSDate.parse("2026-10-15")!
        let list = json("""
        [{"id":"1","name":"Phone","type":"gadget","principalAmount":30000,"emiAmount":5000,"tenureMonths":6,
          "payments":[{"date":"2026-08-05","amount":5000},{"date":"2026-09-05","amount":5000}]}]
        """)
        let loan = LoansPage.loans(list, now: now).loans[0]
        XCTAssertEqual(loan.estimatedTotalCost, 30000)
        XCTAssertEqual(loan.pendingBalance, 20000)
        XCTAssertEqual(loan.progressPercent, 33)                 // 2 of 6 instalments
        XCTAssertTrue(loan.dueThisMonth)                         // nothing paid in October yet
        XCTAssertEqual(loan.badge.label, "Electronic Gadget EMI")
    }
}

final class CapitalGainsTests: XCTestCase {
    private func json(_ text: String) -> JSONValue { try! JSONValue.parse(Data(text.utf8)) }

    func testFifoMatchesTheOldestLotFirstAndSplitsShortFromLong() {
        let tx = json("""
        [{"id":"1","type":"buy","date":"2024-01-10","quantity":10,"price":100},
         {"id":"2","type":"buy","date":"2025-10-01","quantity":10,"price":200},
         {"id":"3","type":"sell","date":"2026-02-01","quantity":15,"price":300}]
        """)
        let r = CapitalGains.matchLots(tx, name: "ACME", id: "a")
        XCTAssertEqual(r.disposals.count, 2)
        XCTAssertEqual(r.disposals[0].term, "long");  XCTAssertEqual(r.disposals[0].gain, 2000)      // 10 × (300−100)
        XCTAssertEqual(r.disposals[1].term, "short"); XCTAssertEqual(r.disposals[1].gain, 500)       // 5 × (300−200)
        XCTAssertEqual(r.openLots.map(\.quantity), [5])
    }

    func testTwelveMonthsMeansMoreThanTwelveMonths() {
        XCTAssertFalse(CapitalGains.isLongTerm("2025-10-20", "2026-10-20"))   // exactly a year is still short term
        XCTAssertTrue(CapitalGains.isLongTerm("2025-10-20", "2026-10-21"))
        XCTAssertEqual(CapitalGains.longTermFrom("2025-10-20"), "2026-10-21")
        XCTAssertFalse(CapitalGains.isLongTerm("2024-02-29", "2025-02-28"))   // 29 February rolls to 1 March
    }

    func testASaleWithNoPurchaseIsReportedNotInvented() {
        let r = CapitalGains.matchLots(json("[{\"id\":\"1\",\"type\":\"sell\",\"date\":\"2026-01-01\",\"quantity\":3,\"price\":50}]"))
        XCTAssertTrue(r.disposals.isEmpty)
        XCTAssertEqual(r.unmatched.first?.quantity, 3)
    }

    func testSplitsRestateOpenLotsAndBonusSharesCostNothing() {
        let tx = json("""
        [{"id":"1","type":"buy","date":"2025-01-01","quantity":10,"price":100},
         {"id":"2","type":"split","date":"2025-06-01","splitFrom":1,"splitTo":2},
         {"id":"3","type":"bonus","date":"2025-07-01","quantity":5}]
        """)
        let lots = CapitalGains.matchLots(tx).openLots
        XCTAssertEqual(lots.map(\.quantity), [20, 5]); XCTAssertEqual(lots.map(\.costPerShare), [50, 0])
    }

    func testBuybackAfterOctober2024IsDividendAndItsCostIsALoss() {
        let tx = json("[{\"id\":\"1\",\"type\":\"buy\",\"date\":\"2024-01-01\",\"quantity\":10,\"price\":100},{\"id\":\"2\",\"type\":\"buyback\",\"date\":\"2025-03-01\",\"quantity\":10,\"price\":150}]")
        let d = CapitalGains.matchLots(tx).disposals[0]
        XCTAssertTrue(d.treatedAsDividend); XCTAssertEqual(d.dividendIncome, 1500); XCTAssertEqual(d.proceeds, 0)
        let year = CapitalGains.summariseYear([d], fy: "2024-25")
        XCTAssertEqual(year.long, -1000)           // the cost of the shares tendered
        XCTAssertEqual(year.buybackDividend, 1500)
    }

    func testLossesCarryForwardAndLapseAfterEightYears() {
        func sale(_ id: String, _ buy: String, _ sell: String, _ price: Double) -> JSONValue {
            json("[{\"id\":\"b\(id)\",\"type\":\"buy\",\"date\":\"\(buy)\",\"quantity\":1,\"price\":1000},{\"id\":\"s\(id)\",\"type\":\"sell\",\"date\":\"\(sell)\",\"quantity\":1,\"price\":\(price)}]")
        }
        let loss = CapitalGains.matchLots(sale("1", "2015-05-01", "2015-06-01", 400)).disposals            // a ₹600 short-term loss in FY 2015-16
        let late = CapitalGains.matchLots(sale("2", "2024-05-01", "2024-06-01", 2000)).disposals           // a gain in FY 2024-25: the loss has lapsed
        let ledger = CapitalGains.ledger(loss + late)
        let year = ledger.years.first { $0.fy == "2024-25" }!
        XCTAssertEqual(year.lapsed, 600)
        XCTAssertEqual(year.netShort, 1000)
        XCTAssertEqual(CapitalGains.ledger(loss).carriedShort.first?.expiresAfter, "2023-24")
    }

    func testExemptionAndRatesChangeWithTheYear() {
        XCTAssertEqual(CapitalGains.exemption(for: "2023-24"), 100_000)
        XCTAssertEqual(CapitalGains.exemption(for: "2024-25"), 125_000)
        XCTAssertEqual(CapitalGains.fyFor(JSDate.parse("2026-03-31")!), "2025-26")
        XCTAssertEqual(CapitalGains.fyFor(JSDate.parse("2026-04-01")!), "2026-27")
    }

    func testFundClassFollowsTheSchemeName() {
        XCTAssertEqual(CapitalGainsPage.assetClass(of: "HDFC Liquid Fund"), "debt")
        XCTAssertEqual(CapitalGainsPage.assetClass(of: "Union Balanced Advantage Fund"), "hybrid")
        XCTAssertEqual(CapitalGainsPage.assetClass(of: "SBI Small Cap Fund"), "equity")
    }
}

final class WatchlistTests: XCTestCase {
    private func json(_ text: String) -> JSONValue { try! JSONValue.parse(Data(text.utf8)) }

    func testQuoteReadsRangeAndDayChange() {
        let q = PriceRange.readQuote(json("{\"quote\":{\"price\":110,\"previousClose\":100,\"fiftyTwoWeekLow\":100,\"fiftyTwoWeekHigh\":200}}"))
        XCTAssertEqual(q.rangePct, 10); XCTAssertTrue(q.nearLow); XCTAssertFalse(q.nearHigh)
        XCTAssertEqual(q.dayChange, 10); XCTAssertEqual(q.dayChangePct, 10)
        XCTAssertEqual(q.aboveLowPct, 10)
        XCTAssertEqual(q.belowHighPct, 45)
    }

    func testMissingBoundsGiveNoRangeRatherThanAConfidentZero() {
        let q = PriceRange.readQuote(json("{\"currentPrice\":50,\"quote\":{\"fiftyTwoWeekLow\":40}}"))
        XCTAssertNil(q.rangePct); XCTAssertFalse(q.hasRange); XCTAssertEqual(q.price, 50)
    }

    func testAZeroPriceIsAFailedQuoteNotACrash() {
        let h = json("{\"currentPrice\":120,\"quote\":{\"price\":0},\"alerts\":[{\"type\":\"below\",\"price\":100},{\"type\":\"above\",\"price\":110}]}")
        // Zero falls back to the stored price rather than satisfying every "below" alert.
        XCTAssertEqual(PriceRange.triggeredAlerts(h).map(\.type), ["above"])
        XCTAssertTrue(PriceRange.triggeredAlerts(json("{\"currentPrice\":0,\"alerts\":[{\"type\":\"below\",\"price\":100}]}")).isEmpty)
    }

    func testNumericStringsAreNotPrices() {
        XCTAssertNil(PriceRange.readQuote(json("{\"currentPrice\":\"100\"}")).price)
    }

    func testRiskAndPriorityAreStoredNeverGuessed() {
        XCTAssertEqual(WatchlistRisk.risk(of: json("{\"risk\":\" High \"}")), "high")
        XCTAssertEqual(WatchlistRisk.risk(of: json("{}")), "unrated")
        XCTAssertEqual(WatchlistRisk.risk(of: json("{\"risk\":\"extreme\"}")), "unrated")
        XCTAssertEqual(WatchlistRisk.priority(of: json("{\"priority\":\"ready\"}")), "ready")
        XCTAssertEqual(WatchlistRisk.priority(of: json("{}")), "unset")
    }

    func testSectorsFoldOntoOneVocabulary() {
        XCTAssertEqual(Sectors.normalise("Financial Services"), "Financials")
        XCTAssertEqual(Sectors.normalise("financials"), "Financials")
        XCTAssertEqual(Sectors.normalise(" Oil & Gas "), "Energy")
        XCTAssertEqual(Sectors.normalise("Something new"), "Other")
        XCTAssertEqual(Sectors.sectorFor("", benchmark: "Automobile"), "Consumer Discretionary")
    }

    func testMarketCapPrefersTheRecordThenTheBenchmarkLists() {
        XCTAssertEqual(Benchmark.marketCap(of: json("{\"marketCap\":\"Small Cap\",\"name\":\"Infosys Limited\"}")), "Small Cap")
        XCTAssertEqual(Benchmark.marketCap(of: json("{\"name\":\"Infosys Ltd.\"}")), "Large Cap")
        XCTAssertEqual(Benchmark.marketCap(of: json("{\"name\":\"Some Unlisted Co\"}")), "Unclassified")
    }
}

final class IpoTests: XCTestCase {
    private func json(_ text: String) -> JSONValue { try! JSONValue.parse(Data(text.utf8)) }

    func testBlockedCapitalAndListingGainUseThePricePaid() {
        let app = IpoPage.application(json("{\"id\":\"1\",\"status\":\"allotted\",\"lots\":2,\"sharesPerLot\":50,\"cutOffPrice\":100,\"sharesAllotted\":50,\"listingPrice\":130,\"appliedDate\":\"2026-01-01\",\"refundDate\":\"2026-01-06\"}"))
        XCTAssertEqual(app.amountBlocked, 10000)           // ASBA blocks the whole application
        XCTAssertEqual(app.investedAtAllotment, 5000)
        XCTAssertEqual(app.refunded, 5000)
        XCTAssertEqual(app.listingGain, 1500)              // 50 × (130 − 100)
        XCTAssertEqual(app.daysBlocked, 5)
    }

    func testAPendingApplicationIsNotAFailure() {
        let raw = json("[{\"id\":\"1\",\"status\":\"allotted\",\"lots\":1,\"sharesPerLot\":10,\"cutOffPrice\":10,\"sharesAllotted\":10,\"appliedDate\":\"2026-02-01\"},{\"id\":\"2\",\"status\":\"not-allotted\",\"lots\":1,\"sharesPerLot\":10,\"cutOffPrice\":10,\"appliedDate\":\"2026-01-01\"},{\"id\":\"3\",\"status\":\"applied\",\"lots\":1,\"sharesPerLot\":10,\"cutOffPrice\":10,\"appliedDate\":\"2026-03-01\"}]")
        let s = IpoPage.summary(applications: raw, stocks: [])
        XCTAssertEqual(s.allotmentRate, 50)                // 1 of 2 decided; the pending one is not counted against it
        XCTAssertEqual(s.pendingCount, 1)
        XCTAssertEqual(s.capitalBlockedNow, 100)
        XCTAssertEqual(s.applications.map(\.id), ["3", "1", "2"])   // newest first
    }

    func testAnAllotmentNoApplicationPointsAtIsReported() {
        let stocks = json("[{\"id\":\"s1\",\"name\":\"Alpha\",\"transactions\":[{\"type\":\"ipo\"}]},{\"id\":\"s2\",\"name\":\"Beta\",\"transactions\":[{\"type\":\"buy\"}]}]").array
        XCTAssertEqual(IpoPage.summary(applications: json("[]"), stocks: stocks).unlinkedAllotments.map(\.name), ["Alpha"])
    }
}

final class XirrTests: XCTestCase {
    private func json(_ text: String) -> JSONValue { try! JSONValue.parse(Data(text.utf8)) }
    private func ms(_ day: String) -> Double { JSDate.parse(day)!.timeIntervalSince1970 * 1000 }

    func testAYearAtTenPercent() {
        let r = Xirr.rate([.init(date: ms("2025-01-01"), amount: -1000), .init(date: ms("2026-01-01"), amount: 1100)])
        XCTAssertEqual(r!, 0.10, accuracy: 0.001)
    }

    func testOneWayFlowsHaveNoRateRatherThanZero() {
        XCTAssertNil(Xirr.rate([.init(date: ms("2025-01-01"), amount: -1000), .init(date: ms("2026-01-01"), amount: -500)]))
        XCTAssertNil(Xirr.rate([.init(date: ms("2025-01-01"), amount: -1000)]))
    }

    func testASipIsNotTheAverageOfItsHoldingPeriods() {
        // Money added later has less time to grow, so a money-weighted rate sits below a naive one.
        let flows: [Xirr.Flow] = [.init(date: ms("2024-01-01"), amount: -1000), .init(date: ms("2025-01-01"), amount: -1000), .init(date: ms("2026-01-01"), amount: 2300)]
        let r = Xirr.rate(flows)!
        XCTAssertEqual(Xirr.npvForTest(r, flows), 0, accuracy: 0.01)
    }

    func testAClosedSixDayTradeIsFlaggedNotCelebrated() {
        let stock = json("{\"id\":\"1\",\"name\":\"Quick\",\"shares\":0,\"transactions\":[{\"type\":\"buy\",\"date\":\"2021-06-01\",\"quantity\":10,\"price\":100},{\"type\":\"sell\",\"date\":\"2021-06-07\",\"quantity\":10,\"price\":116.5}]}")
        let p = Xirr.stockReturn(stock, asOf: JSDate.parse("2026-10-01")!)
        XCTAssertEqual(p.days, 6)                       // first flow to last flow, not to today
        XCTAssertTrue(p.tooShortToAnnualise)
        XCTAssertEqual(p.simplePct!, 16.5, accuracy: 0.001)
    }

    func testDividendsCountAsMoneyIn() {
        let stock = json("{\"shares\":10,\"currentPrice\":100,\"transactions\":[{\"type\":\"buy\",\"date\":\"2025-01-01\",\"quantity\":10,\"price\":100},{\"type\":\"dividend\",\"date\":\"2025-07-01\",\"quantity\":0,\"price\":50}]}")
        let flows = Xirr.stockCashflows(stock, asOf: JSDate.parse("2026-01-01")!)
        XCTAssertEqual(flows.map(\.amount), [-1000, 50, 1000])
    }

    func testAHoldingWithNoValuationIsKeptAndSortedLast() {
        let stocks = [json("{\"id\":\"a\",\"name\":\"No price\",\"shares\":0,\"transactions\":[{\"type\":\"buy\",\"date\":\"2025-01-01\",\"quantity\":5,\"price\":100}]}"),
                      json("{\"id\":\"b\",\"name\":\"Fine\",\"shares\":1,\"currentPrice\":150,\"transactions\":[{\"type\":\"buy\",\"date\":\"2025-01-01\",\"quantity\":1,\"price\":100}]}")]
        let ranked = Xirr.ranked(stocks: stocks, funds: [], asOf: JSDate.parse("2026-01-01")!)
        XCTAssertEqual(ranked.map(\.id), ["b", "a"])
        XCTAssertNil(ranked[1].xirrPct)
    }
}

final class DividendTests: XCTestCase {
    private func json(_ text: String) -> JSONValue { try! JSONValue.parse(Data(text.utf8)) }
    private let now = JSDate.parse("2026-10-30")!

    func testYieldIsAgainstWhatYouPaidAndTdsIsAddedBack() {
        let stock = json("""
        {"id":"1","name":"Acme","shares":10,"transactions":[
          {"type":"buy","date":"2020-01-01","quantity":10,"price":100},
          {"type":"dividend","date":"2025-07-01","quantity":0,"price":40,"tds":4,"amountIsNet":true},
          {"type":"dividend","date":"2026-07-01","quantity":0,"price":60}]}
        """)
        let p = Dividends.profile(stock, now: now)
        XCTAssertEqual(p.invested, 1000)
        XCTAssertEqual(p.total, 104)              // 40 net + 4 withheld = 44 gross, plus 60
        XCTAssertEqual(p.pct, 10.4, accuracy: 1e-9)
        XCTAssertEqual(Dividends.read(json("{\"date\":\"2025-07-01\",\"price\":40,\"tds\":4,\"amountIsNet\":true}")).net, 40)
        XCTAssertEqual(Dividends.read(json("{\"date\":\"2025-07-01\",\"price\":40,\"tds\":4}")).net, 36)
    }

    func testAPayerThatStoppedIsLapsedOnlyAfterTwoCalendarYears() {
        func stock(_ last: String) -> JSONValue { json("{\"shares\":5,\"transactions\":[{\"type\":\"dividend\",\"date\":\"2021-05-01\",\"price\":10},{\"type\":\"dividend\",\"date\":\"\(last)\",\"price\":10}]}") }
        XCTAssertFalse(Dividends.profile(stock("2025-05-01"), now: now).lapsed)       // one year ago
        XCTAssertTrue(Dividends.profile(stock("2024-05-01"), now: now).lapsed)        // two
        XCTAssertEqual(Dividends.profile(stock("2024-05-01"), now: now).consistency, 2.0 / 6.0 * 100, accuracy: 1e-9)   // paid in 2 of 2021…2026
    }

    func testReitsWithholdFromTheFirstRupeeButCompaniesOnlyAboveTheThreshold() {
        let holdings = json("""
        [{"id":"r","name":"Embassy Office Parks REIT","transactions":[{"type":"dividend","date":"2026-06-01","price":100}]},
         {"id":"c","name":"Big Co","transactions":[{"type":"dividend","date":"2026-06-01","price":9000},{"type":"dividend","date":"2026-09-01","price":2000}]},
         {"id":"s","name":"Small Co","transactions":[{"type":"dividend","date":"2026-06-01","price":9000}]}]
        """).array
        let rows = Dividends.taxRows(holdings)
        func row(_ id: String) -> Dividends.TaxRow { rows.first { $0.holdingId == id }! }
        XCTAssertTrue(row("r").expectsTds); XCTAssertTrue(row("r").missingTds); XCTAssertNil(row("r").headroom)
        XCTAssertTrue(row("c").expectsTds)         // 11,000 > 10,000 from FY 2025-26
        XCTAssertFalse(row("s").expectsTds); XCTAssertEqual(row("s").headroom, 1000)
        XCTAssertEqual(Dividends.thresholdFor("2024-25"), 5000)
        let summary = Dividends.taxSummary(holdings, now: now)
        XCTAssertEqual(summary.approaching.map(\.holdingId), ["s"])              // 1,000 left of a 10,000 limit is under 40%
        XCTAssertEqual(summary.trustHoldings, ["Embassy Office Parks REIT"])
    }

    func testIncomeByMonthKeepsTheSilentMonths() {
        let stocks = json("[{\"transactions\":[{\"type\":\"dividend\",\"date\":\"2026-03-10\",\"price\":50},{\"type\":\"dividend\",\"date\":\"2025-03-10\",\"price\":70}]}]").array
        let months = Dividends.incomeByMonth(stocks, year: "2026")
        XCTAssertEqual(months.count, 12); XCTAssertEqual(months[2].amount, 50); XCTAssertEqual(months[0].amount, 0)
        XCTAssertEqual(Dividends.payoutMonths(stocks[0]).first?.averagePerYear, 60)     // 120 over two years
    }
}

final class CostRecoveryTests: XCTestCase {
    private func json(_ text: String) -> JSONValue { try! JSONValue.parse(Data(text.utf8)) }

    func testSellingPartPlusDividendsCanMakeTheRestFree() {
        // ₹10,000 in; ₹9,000 back from selling half; ₹1,500 of dividends: the 50 shares left cost nothing.
        let stock = json("""
        {"id":"1","name":"Acme","shares":50,"currentPrice":300,"transactions":[
          {"type":"buy","date":"2021-01-01","quantity":100,"price":100},
          {"type":"sell","date":"2022-01-01","quantity":50,"price":180},
          {"type":"dividend","date":"2023-06-01","quantity":0,"price":1500}]}
        """)
        let r = CostRecovery.recovery(stock)
        XCTAssertEqual(r.invested, 10_000); XCTAssertEqual(r.recovered, 10_500)
        XCTAssertTrue(r.isFree); XCTAssertEqual(r.surplus, 500); XCTAssertEqual(r.netCostPerShare, 0)
        XCTAssertEqual(r.recoveredPct, 100); XCTAssertEqual(r.rawPct, 105)
    }

    func testAHoldingThatCostNothingIsCashlessNotFree() {
        let stock = json("{\"id\":\"2\",\"name\":\"Spun off\",\"shares\":11,\"currentPrice\":100,\"transactions\":[{\"type\":\"demerger\",\"date\":\"2025-10-01\",\"quantity\":11,\"price\":50}]}")
        let r = CostRecovery.recovery(stock)
        XCTAssertTrue(r.cashless); XCTAssertFalse(r.isFree); XCTAssertEqual(r.allocatedBasis, 550)
        XCTAssertTrue(CostRecovery.ranking([stock]).isEmpty)         // no cost, so no recovery percentage
        XCTAssertEqual(CostRecovery.cashlessHoldings([stock]).count, 1)
    }

    func testTheNetTaxDividendIsCountedGross() {
        let replay = Stocks.replay(json("[{\"type\":\"dividend\",\"date\":\"2025-07-01\",\"price\":90,\"tds\":10,\"amountIsNet\":true}]").array)
        XCTAssertEqual(replay.dividends["2025"], 100)
    }
}

final class NewTransactionTests: XCTestCase {
    private let map: [(main: String, subs: [String])] = [("Food", ["Restaurants", "Groceries"]), ("Travel", ["Fuel"])]

    func testAnEntryIsShapedLikeTheMacsAndSentAsOneRow() throws {
        var d = NewTransaction.Draft(); d.title = " Lunch "; d.amount = "1,250.50"; d.category = "restaurants"
        let body = NewTransaction.body(d, map: map, now: Date(timeIntervalSince1970: 1_786_000_000))
        let tx = try XCTUnwrap(body["transaction"] as? [String: Any])
        XCTAssertEqual(tx["id"] as? String, "1786000000000")
        XCTAssertEqual(tx["title"] as? String, "Lunch"); XCTAssertEqual(tx["amount"] as? Double, 1250.5)
        XCTAssertEqual(tx["category"] as? String, "restaurants"); XCTAssertEqual(tx["mainCategory"] as? String, "Food")
        XCTAssertEqual(tx["paymentMode"] as? String, "direct"); XCTAssertEqual(tx["transactionType"] as? String, "debit"); XCTAssertEqual(tx["isCredited"] as? Bool, false)
        XCTAssertEqual(tx["deductFromSalary"] as? Bool, true); XCTAssertTrue(tx["creditCardName"] is NSNull)
        XCTAssertEqual(body.count, 1, "one transaction, nothing else")
        XCTAssertNotNil(try? JSONSerialization.data(withJSONObject: body))
    }

    func testCardAndReceivedEntries() throws {
        var d = NewTransaction.Draft(); d.amount = "200"; d.category = "Fuel"; d.onCard = true; d.card = "HPCL"; d.received = true
        let tx = try XCTUnwrap(NewTransaction.body(d, map: map)["transaction"] as? [String: Any])
        XCTAssertEqual(tx["paymentMode"] as? String, "credit_card"); XCTAssertEqual(tx["creditCardName"] as? String, "HPCL")
        XCTAssertEqual(tx["isCredited"] as? Bool, true); XCTAssertEqual(tx["transactionType"] as? String, "credit")
    }

    func testIncompleteEntriesAreRefused() {
        XCTAssertEqual(Set(NewTransaction.problems(NewTransaction.Draft())), [.amount, .category])
        var d = NewTransaction.Draft(); d.amount = "0"; d.category = "x"; XCTAssertEqual(NewTransaction.problems(d), [.amount])
        d.amount = "-5"; XCTAssertEqual(NewTransaction.problems(d), [.amount])
        d.amount = "5"; d.onCard = true; XCTAssertEqual(NewTransaction.problems(d), [.card])
        d.card = "HPCL"; d.date = Date().addingTimeInterval(10 * 86_400); XCTAssertEqual(NewTransaction.problems(d), [.date])
    }
}

final class EditTransactionTests: XCTestCase {
    private let map: [(main: String, subs: [String])] = [("Food", ["Restaurants", "Groceries"]), ("Travel", ["Fuel"])]
    private func tx(_ json: String) throws -> JSONValue { try JSONValue.parse(Data(json.utf8)) }

    func testOnlyWhatChangedIsSent() throws {
        let t = try tx(#"{"id":"1","title":"Lunch","amount":250,"category":"restaurants","date":"2026-10-30","mainCategory":"Food"}"#)
        var d = EditTransaction.draft(from: t)
        XCTAssertTrue(EditTransaction.patch(original: t, draft: d, map: map).isEmpty, "untouched means nothing to save")
        d.title = "Lunch with Ravi"; d.amount = "275.5"
        let p = EditTransaction.patch(original: t, draft: d, map: map)
        XCTAssertEqual(Set(p.keys), ["title", "amount"]); XCTAssertEqual(p["amount"] as? Double, 275.5)
        d.category = "fuel"
        let q = EditTransaction.patch(original: t, draft: d, map: map)
        XCTAssertEqual(q["category"] as? String, "fuel"); XCTAssertEqual(q["mainCategory"] as? String, "Travel")
    }

    func testRowsTheMacMustChangeAreLocked() throws {
        XCTAssertNil(EditTransaction.lockReason(try tx(#"{"id":"1"}"#), idCount: 1))
        XCTAssertNotNil(EditTransaction.lockReason(try tx(#"{"title":"x"}"#), idCount: 0))
        XCTAssertNotNil(EditTransaction.lockReason(try tx(#"{"id":"1"}"#), idCount: 2))
        XCTAssertNotNil(EditTransaction.lockReason(try tx(#"{"id":"1","investmentData":{"legs":[]}}"#), idCount: 1))
        XCTAssertNotNil(EditTransaction.lockReason(try tx(#"{"id":"1","expenseId":"9"}"#), idCount: 1))
    }

    func testAnEditCannotLeaveAnAmountOfZero() {
        var d = EditTransaction.Draft(title: "", amount: "0", category: "x", date: Date())
        XCTAssertEqual(EditTransaction.problems(d), [.amount]); d.amount = "5"; d.category = " "
        XCTAssertEqual(EditTransaction.problems(d), [.category])
    }
}
