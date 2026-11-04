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

final class RecordEditingTests: XCTestCase {
    private func json(_ s: String) -> JSONValue { try! JSONValue.parse(Data(s.utf8)) }

    func testOnlyPlainUnlockedFieldsAreOffered() {
        let fund = json(#"{"id":"7","type":"mutual_fund","title":"Nifty","amount":5000,"currentNav":12.3,"transactions":[{"units":1}],"isArchived":false,"date":"2024-01-05","updatedAt":"2026-01-01T00:00:00.000Z"}"#)
        let keys = RecordEditing.fields(of: fund, collection: "savings").map(\.key)
        XCTAssertEqual(keys, ["title", "date", "isArchived"], "id, type, derived amount/NAV, timestamps and lists stay locked")
        let bank = json(#"{"id":"3","type":"savings_account","title":"HDFC","amount":5000}"#)
        XCTAssertTrue(RecordEditing.fields(of: bank, collection: "savings").map(\.key).contains("amount"), "a bank balance is the user's own figure")
        XCTAssertNotNil(RecordEditing.nestedLock(key: "transactions", collection: "savings", record: fund))
        XCTAssertNil(RecordEditing.nestedLock(key: "transactions", collection: "lents", record: json(#"{"id":"1"}"#)))
    }

    func testFieldKindsFollowTheStoredType() {
        let tax = json(#"{"id":"t","taxesPaid":"12500","itrStatus":"Filed","refundReceivedDate":"2025-08-01","verified":true}"#)
        let kinds = Dictionary(uniqueKeysWithValues: RecordEditing.fields(of: tax, collection: "taxes").map { ($0.key, $0.kind) })
        XCTAssertEqual(kinds["taxesPaid"], .numericText)
        XCTAssertEqual(kinds["itrStatus"], .text)
        XCTAssertEqual(kinds["refundReceivedDate"], .date)
        XCTAssertEqual(kinds["verified"], .toggle)
    }

    func testPatchHoldsOnlyChangesTypedAsStored() {
        let goal = json(#"{"id":"g","name":"House","targetAmount":3000000,"notes":"old","done":false,"paid":"100"}"#)
        let fields = RecordEditing.fields(of: goal, collection: "goals")
        var edits: [String: RecordEditing.Edit] = ["name": .text("House"), "targetAmount": .text("3,500,000"), "done": .toggle(true), "paid": .text("150")]
        let patch = RecordEditing.patch(fields: fields, edits: edits, record: goal)
        XCTAssertEqual(patch.count, 3, "an unchanged name is not sent")
        XCTAssertEqual(patch["targetAmount"] as? Double, 3500000)
        XCTAssertEqual(patch["done"] as? Bool, true)
        XCTAssertEqual(patch["paid"] as? String, "150", "numbers stored as text stay text")
        edits["targetAmount"] = .text("abc")
        XCTAssertEqual(RecordEditing.problems(fields: fields, edits: edits)["targetAmount"], "Not a number")
    }

    func testRowsAreReplacedOrRemovedAndLinkedRowsLocked() {
        let rows = json(#"[{"date":"2025-01-01","amount":100},{"date":"2025-02-01","amount":200,"note":"x"}]"#).array
        let changed = RecordEditing.replacingRow(rows, at: 1, with: ["amount": 250.0])
        XCTAssertEqual((changed[1] as? [String: Any])?["amount"] as? Double, 250)
        XCTAssertEqual((changed[1] as? [String: Any])?["note"] as? String, "x", "other fields of the row survive")
        XCTAssertEqual((changed[0] as? [String: Any])?["amount"] as? Double, 100)
        XCTAssertEqual(RecordEditing.replacingRow(rows, at: 0, with: nil).count, 1)
        XCTAssertNotNil(RecordEditing.rowLock(json(#"{"expenseId":"e1"}"#)))
        XCTAssertTrue(RecordEditing.fields(of: json(#"{"type":"given","amount":5}"#), collection: "lents", parent: json(#"{"id":"1"}"#)).map(\.key).contains("type"), "a row's type is editable")
    }
}

final class StockLedgerTests: XCTestCase {
    private func json(_ s: String) -> JSONValue { try! JSONValue.parse(Data(s.utf8)) }
    private let account = #"{"id":"a","type":"stock_market","stocks":[{"id":"s1","name":"Coal","shares":10,"avgCost":100,"dividends":{"2020":5},"transactions":[{"id":"1","date":"2024-01-01","type":"buy","quantity":10,"price":100}]},{"id":"s2","name":"Other","shares":1,"transactions":[]}]}"#

    private func stocks(_ r: Result<[Any], StockLedger.Failure>) -> [[String: Any]] { (try! r.get()) as! [[String: Any]] }

    func testAddingABuyReplaysSharesAndAverageCost() {
        var d = StockLedger.Draft(); d.date = "2024-06-01"; d.quantity = "10"; d.price = "120"
        let out = stocks(StockLedger.updatedStocks(account: json(account), stockId: "s1", change: .add(StockLedger.row(d, id: "9"))))
        XCTAssertEqual(out[0]["shares"] as? Double, 20)
        XCTAssertEqual(out[0]["avgCost"] as? Double, 110)
        XCTAssertEqual((out[0]["transactions"] as? [Any])?.count, 2)
        XCTAssertEqual(out[1]["name"] as? String, "Other", "other holdings pass through")
    }

    func testADividendIsCreditedToItsYearAndKeepsHandTypedYears() {
        var d = StockLedger.Draft(); d.kind = .dividend; d.date = "2025-03-10"; d.price = "450"; d.tds = "45"; d.amountIsNet = true
        let row = StockLedger.row(d, id: "d")
        XCTAssertEqual(row["quantity"].double, 0)
        let out = stocks(StockLedger.updatedStocks(account: json(account), stockId: "s1", change: .add(row)))
        let div = out[0]["dividends"] as? [String: Double]
        XCTAssertEqual(div?["2025"], 495, "gross = net + tax withheld")
        XCTAssertEqual(div?["2020"], 5, "a year not in the history stays")
        XCTAssertEqual(out[0]["shares"] as? Double, 10, "a dividend moves no shares")
    }

    func testDeleteAndEditAndStaleRows() {
        let acct = json(account)
        var out = stocks(StockLedger.updatedStocks(account: acct, stockId: "s1", change: .delete(id: "1")))
        XCTAssertEqual(out[0]["shares"] as? Double, 0)
        var d = StockLedger.draft(from: acct["stocks"][0]["transactions"][0]); d.quantity = "4"
        out = stocks(StockLedger.updatedStocks(account: acct, stockId: "s1", change: .replace(id: "1", StockLedger.row(d, id: "1", base: acct["stocks"][0]["transactions"][0]))))
        XCTAssertEqual(out[0]["shares"] as? Double, 4)
        XCTAssertThrowsError(try StockLedger.updatedStocks(account: acct, stockId: "s1", change: .delete(id: "gone")).get())
        XCTAssertThrowsError(try StockLedger.updatedStocks(account: acct, stockId: "nope", change: .delete(id: "1")).get())
    }

    func testValidationAndLocks() {
        let history = json(account)["stocks"][0]["transactions"].array
        var d = StockLedger.Draft(); d.kind = .sell; d.date = "2024-06-01"; d.quantity = "11"; d.price = "1"
        XCTAssertEqual(StockLedger.problems(d, history: history, editing: nil).count, 1, "cannot sell more than held")
        d.quantity = "10"; XCTAssertTrue(StockLedger.problems(d, history: history, editing: nil).isEmpty)
        d.date = "2023-01-01"; XCTAssertFalse(StockLedger.problems(d, history: history, editing: nil).isEmpty, "nothing held before the first buy")
        XCTAssertNotNil(StockLedger.rowLock(json(#"{"id":"1","expenseId":"e"}"#)))
        XCTAssertNotNil(StockLedger.holdingLock(json(#"{"transactions":[{"type":"merger_out"}]}"#)))
        XCTAssertNil(StockLedger.holdingLock(json(#"{"transactions":[{"type":"buy"}]}"#)))
        var split = StockLedger.Draft(); split.kind = .split; split.splitFrom = "1"; split.splitTo = "2"; split.date = "2024-06-01"
        XCTAssertTrue(StockLedger.problems(split, history: history, editing: nil).isEmpty)
        XCTAssertEqual(StockLedger.row(split, id: "x")["tds"], .null, "tax only belongs on a dividend")
    }
}


final class DepositLedgerTests: XCTestCase {
    private func json(_ s: String) -> JSONValue { try! JSONValue.parse(Data(s.utf8)) }
    private let account = #"{"id":"a","type":"recurring_deposit","amount":100,"recurringDeposits":[{"id":"r1","name":"LIC","maturityAmount":62000,"installments":[{"id":1,"date":"2026-01-01","amount":5000}],"interestTransactions":[]},{"id":"r2","name":"Axis","maturityAmount":1000,"installments":[]}]}"#

    func testAddingAnInstalmentTouchesOnlyThatDepositsList() throws {
        var d = DepositLedger.EntryDraft(); d.date = "2026-02-01"; d.amount = "5,000"
        let row = DepositLedger.entryRow(d, id: "9", interest: false)
        let patch = try DepositLedger.nestedPatch(account: json(account), listKey: "recurringDeposits", depositId: "r1", subKey: "installments", change: .add(row)).get()
        let rds = patch["recurringDeposits"] as! [[String: Any]]
        XCTAssertEqual((rds[0]["installments"] as! [Any]).count, 2)
        XCTAssertEqual(rds[0]["name"] as? String, "LIC"); XCTAssertEqual(rds[1]["name"] as? String, "Axis")
        XCTAssertNil(patch["amount"], "an instalment does not change the account amount")
        XCTAssertNil(row["financialYear"].text.isEmpty ? nil : row["financialYear"], "instalments carry no financial year")
    }

    func testInterestRowsCarryTheirFinancialYear() {
        XCTAssertEqual(DepositLedger.financialYear("2026-03-31"), "2025-2026")
        XCTAssertEqual(DepositLedger.financialYear("2026-04-01"), "2026-2027")
        var d = DepositLedger.EntryDraft(); d.date = "2026-09-26"; d.amount = "98"
        XCTAssertEqual(DepositLedger.entryRow(d, id: "1", interest: true)["financialYear"].text, "2026-2027")
    }

    func testStaleRowsAndDepositsAreRefused() {
        let acct = json(account)
        XCTAssertThrowsError(try DepositLedger.nestedPatch(account: acct, listKey: "recurringDeposits", depositId: "zz", subKey: "installments", change: .delete(id: "1")).get())
        XCTAssertThrowsError(try DepositLedger.nestedPatch(account: acct, listKey: "recurringDeposits", depositId: "r1", subKey: "installments", change: .replace(id: "gone", .null)).get())
    }

    func testRecurringChangesRecomputeTheAccountAmountAndKeepHistory() throws {
        let acct = json(account)
        var d = DepositLedger.rdDraft(from: acct["recurringDeposits"][0]); d.maturityAmount = "70000"
        let row = DepositLedger.rdRow(d, id: "x", base: acct["recurringDeposits"][0])
        XCTAssertEqual((row["installments"].array.count), 1, "editing the form fields keeps the payment history")
        let patch = try DepositLedger.recurringPatch(account: acct, change: .replace(id: "r1", row)).get()
        XCTAssertEqual(patch["amount"] as? Double, 71000)
        XCTAssertEqual(DepositLedger.rdProblems(DepositLedger.RDDraft()).isEmpty, false)
    }

    func testFixedDepositRowFiguresFollowTheModal() throws {
        var d = DepositLedger.FDDraft(); d.accountNo = "1"; d.bank = "UBI"; d.startDate = "2025-01-01"; d.endDate = "2026-01-01"; d.originalAmount = "100000"; d.interestRate = "7"
        XCTAssertTrue(DepositLedger.fdProblems(d).isEmpty)
        let row = DepositLedger.fdRow(d, id: "5", asOf: JSDate.parse("2025-07-01")!)
        XCTAssertEqual(row["maturityAmount"].double, (100000 * pow(1 + 0.07 / 4, 4 * 365 / 365.25)).rounded())
        XCTAssertEqual(row["interestEarned"].double, row["maturityAmount"].double - 100000)
        XCTAssertEqual(row["renewalCount"].double, 0)
        d.bank = ""; XCTAssertFalse(DepositLedger.fdProblems(d).isEmpty)
        let closed = DepositLedger.closedRow(row, closureDate: "2025-09-01", finalInterest: 3000, remarks: "early")
        XCTAssertTrue(closed["isArchived"].isTrue); XCTAssertEqual(closed["currentValue"].double, 103000); XCTAssertEqual(closed["endDate"].text, "2025-09-01")
        XCTAssertEqual(DepositLedger.banks([json(#"{"bank":"b"}"#), json(#"{"bank":"A"}"#), json(#"{"bank":"b"}"#)]), ["A", "b"])
    }
}

final class AccountLedgerTests: XCTestCase {
    private func json(_ s: String) -> JSONValue { try! JSONValue.parse(Data(s.utf8)) }

    func testPPFEntryRecalculatesBalancesAndAmount() throws {
        let acct = json(#"{"id":"p","type":"ppf","amount":500,"details":[{"id":"1","date":"2021-09-24","type":"investment","amount":500,"interestEarned":0,"balance":500}]}"#)
        let spec = AccountLedger.lists(for: "ppf")[0]
        var d = AccountLedger.draft(for: spec); d["date"] = "2021-10-01"; d["type"] = "investment"; d["amount"] = "1,000"
        let patch = try AccountLedger.patch(account: acct, spec: spec, change: .add(AccountLedger.row(d, spec: spec, type: "ppf"))).get()
        XCTAssertEqual(patch["amount"] as? Double, 1500)
        XCTAssertEqual(((patch["details"] as! [[String: Any]]).last)?["balance"] as? Double, 1500)
    }

    func testStaleRowsAreRefused() {
        let acct = json(#"{"id":"s","type":"savings_account","transactions":[{"id":"1","type":"deposit","amount":10,"date":"2026-01-01"}]}"#)
        let spec = AccountLedger.lists(for: "savings_account")[0]
        let old = json(#"{"id":"1","type":"deposit","amount":99,"date":"2026-01-01"}"#)
        XCTAssertThrowsError(try AccountLedger.patch(account: acct, spec: spec, change: .delete(index: 0, expected: old)).get())
        XCTAssertThrowsError(try AccountLedger.patch(account: acct, spec: spec, change: .delete(index: 4, expected: old)).get())
    }

    func testFundTransactionDerivesUnitsAndAmountAndKeepsLinks() throws {
        let acct = json(#"{"id":"f","type":"mutual_fund","currentNav":50,"amount":0,"transactions":[{"id":"1","type":"buy","units":10,"nav":40,"amount":400,"date":"2026-01-01","expenseId":"e"}]}"#)
        let spec = AccountLedger.lists(for: "mutual_fund")[0]
        var d = AccountLedger.draft(for: spec); d["amount"] = "1000"; d["nav"] = "50"; d["date"] = "2026-02-01"; d["type"] = "sip"
        let row = AccountLedger.row(d, spec: spec, type: "mutual_fund")
        XCTAssertEqual(row["units"].double, 20)
        let patch = try AccountLedger.patch(account: acct, spec: spec, change: .add(row)).get()
        XCTAssertEqual(patch["amount"] as? Double, 1500, "30 units at ₹50")
        XCTAssertNotNil(AccountLedger.rowLock(acct["transactions"][0], type: "mutual_fund"))
    }

    func testNpsTransactionResyncsSchemeAndAccount() throws {
        let acct = json(#"{"id":"n","type":"nps","amount":0,"holdings":[{"id":"h","issueName":"Scheme C","currentPrice":10,"transactions":[]}]}"#)
        let spec = AccountLedger.lists(for: "nps")[1]
        var d = AccountLedger.draft(for: spec); d["amount"] = "1000"; d["units"] = "100"; d["nav"] = "10"; d["type"] = "contribution"
        let patch = try AccountLedger.patch(account: acct, spec: spec, parentIndex: 0, change: .add(AccountLedger.row(d, spec: spec, type: "nps"))).get()
        XCTAssertEqual(patch["amount"] as? Double, 1000); XCTAssertEqual(patch["investedAmount"] as? Double, 1000)
        XCTAssertEqual(((patch["holdings"] as! [[String: Any]])[0])["percentage"] as? Double, 100)
    }

    func testPremiumsSumPaidAndValidation() throws {
        let acct = json(#"{"id":"p","type":"policy","amount":0,"premiums":[]}"#)
        let spec = AccountLedger.lists(for: "policy")[0]
        var d = AccountLedger.draft(for: spec); XCTAssertFalse(AccountLedger.problems(d, spec: spec).isEmpty)
        d["amount"] = "1228"; d["status"] = "Paid"
        XCTAssertTrue(AccountLedger.problems(d, spec: spec).isEmpty)
        let patch = try AccountLedger.patch(account: acct, spec: spec, change: .add(AccountLedger.row(d, spec: spec, type: "policy"))).get()
        XCTAssertEqual(patch["amount"] as? Double, 1228)
        XCTAssertEqual(AccountLedger.newAccount(type: "ppf", title: "x", amount: 0, date: "2026-01-01")["details"] as? [Any] != nil, true)
    }
}

final class OfflineTests: XCTestCase {
    private func json(_ s: String) -> JSONValue { try! JSONValue.parse(Data(s.utf8)) }

    private func roundTrip(_ op: AccountOp) -> AccountOp? {
        let o = OfflineOp(id: "1", created: Date(timeIntervalSince1970: 5), label: "x", kind: .account(collection: "savings", id: "a", op))
        let data = try! JSONSerialization.data(withJSONObject: OfflineCoding.encode(o))
        let back = OfflineCoding.decode(try! JSONSerialization.jsonObject(with: data) as! [String: Any])
        if case .account(_, _, let a)? = back?.kind { return a }
        return nil
    }

    func testQueuedChangesSurviveBeingWrittenToDisk() throws {
        let acct = json(#"{"id":"a","type":"recurring_deposit","amount":0,"recurringDeposits":[{"id":"r","name":"LIC","maturityAmount":100,"installments":[]}]}"#)
        let row = json(#"{"id":"9","date":"2026-02-01","amount":5000,"remarks":""}"#)
        let op = AccountOp.nested(listKey: "recurringDeposits", depositId: "r", subKey: "installments", .add(row))
        let back = try XCTUnwrap(roundTrip(op))
        let a = try op.patch(for: acct).get(), b = try back.patch(for: acct).get()
        XCTAssertEqual(OfflineCoding.value(a["recurringDeposits"] as Any), OfflineCoding.value(b["recurringDeposits"] as Any))
        // The other kinds of change round-trip too.
        for o in [AccountOp.deposits(.delete(id: "d")), .recurring(.replace(id: "r", row)), .stock(holdingId: "h", .add(row)),
                  .ledger(specId: "details", parentIndex: nil, .replace(index: 2, expected: row, row)), .fields(["notes": "x"], expected: ["notes": .string("old")])] {
            XCTAssertNotNil(roundTrip(o))
        }
    }

    func testAChangeIsRebuiltAgainstTheMacsRecordWhenItIsBack() throws {
        // Made on the phone against its copy…
        let phone = json(#"{"id":"s","type":"savings_account","amount":10,"transactions":[{"id":"1","type":"deposit","amount":10,"date":"2026-01-01"}]}"#)
        let spec = AccountLedger.lists(for: "savings_account")[0]
        var d = AccountLedger.draft(for: spec); d["amount"] = "5"; d["date"] = "2026-02-01"; d["type"] = "withdraw"
        let op = AccountOp.ledger(specId: spec.id, parentIndex: nil, .add(AccountLedger.row(d, spec: spec, type: "savings_account")))
        XCTAssertEqual(try op.patch(for: phone).get()["amount"] as? Double, 5)
        // …and the Mac meanwhile got another deposit: the new row lands on top of it.
        let mac = json(#"{"id":"s","type":"savings_account","amount":110,"transactions":[{"id":"1","type":"deposit","amount":10,"date":"2026-01-01"},{"id":"2","type":"deposit","amount":100,"date":"2026-01-15"}]}"#)
        XCTAssertEqual(try op.patch(for: mac).get()["amount"] as? Double, 105)
        // A change to a row that has since been edited on the Mac is held, not forced.
        let edit = AccountOp.ledger(specId: spec.id, parentIndex: nil, .delete(index: 0, expected: phone["transactions"][0]))
        let moved = json(#"{"id":"s","type":"savings_account","transactions":[{"id":"1","type":"deposit","amount":999,"date":"2026-01-01"}]}"#)
        XCTAssertThrowsError(try edit.patch(for: moved).get())
        // A field edited on both sides is held; a different field is not.
        let f = AccountOp.fields(["notes": "mine"], expected: ["notes": .string("old")])
        XCTAssertThrowsError(try f.patch(for: json(#"{"id":"x","notes":"theirs"}"#)).get())
        XCTAssertNoThrow(try f.patch(for: json(#"{"id":"x","notes":"old","other":"changed on mac"}"#)).get())
    }

    func testLocalCopyShowsAChangeBeforeTheMacHasIt() throws {
        var expenses: Any = ["2026": ["October": ["categories": [String: Any](), "transactions": [["id": "1", "date": "2026-10-05", "amount": 10.0]]]]]
        LocalApply.addTransaction(&expenses, body: ["transaction": ["id": "2", "date": "2026-11-02", "amount": 5.0]])
        var e = expenses as! [String: [String: Any]]
        XCTAssertEqual(((e["2026"]?["November"] as? [String: Any])?["transactions"] as? [Any])?.count, 1, "a new month is created")
        XCTAssertTrue(LocalApply.patchTransaction(&expenses, id: "1", fields: ["date": "2026-11-09", "amount": 12.0]))
        e = expenses as! [String: [String: Any]]
        XCTAssertEqual(((e["2026"]?["October"] as? [String: Any])?["transactions"] as? [Any])?.count, 0, "moved out of October")
        XCTAssertEqual(((e["2026"]?["November"] as? [String: Any])?["transactions"] as? [Any])?.count, 2)
        XCTAssertTrue(LocalApply.deleteTransaction(&expenses, id: "2"))
        XCTAssertFalse(LocalApply.deleteTransaction(&expenses, id: "nope"))
        var savings: Any = [["id": "a", "amount": 1.0], ["id": 7, "amount": 2.0]]
        XCTAssertTrue(LocalApply.patchRecord(&savings, id: "7", fields: ["amount": 9.0]), "numeric ids match by text")
        LocalApply.appendRecord(&savings, record: ["id": "n"])
        XCTAssertEqual((savings as! [Any]).count, 3)
    }
}

final class LoanLedgerTests: XCTestCase {
    private func json(_ s: String) -> JSONValue { try! JSONValue.parse(Data(s.utf8)) }

    func testPersonTransactionIsOneRowAndKeepsWhatTheFormDoesNotShow() throws {
        let person = json(#"{"id":"p","type":"lent","name":"venku","amount":1000,"transactions":[{"id":"1","type":"repayment","amount":100,"date":"2026-01-01","description":"EMI","extra":"keep"}]}"#)
        var d = LoanLedger.LentDraft(); XCTAssertFalse(LoanLedger.lentProblems(d).isEmpty)
        d.amount = "2,500"; d.date = "2026-02-01"; d.type = "additional"
        let add = AccountOp.list(key: "transactions", .add(LoanLedger.lentRow(d, id: "9")))
        let rows = try add.patch(for: person).get()["transactions"] as! [[String: Any]]
        XCTAssertEqual(rows.count, 2); XCTAssertEqual(rows[1]["amount"] as? Double, 2500); XCTAssertEqual(rows[1]["type"] as? String, "additional")
        let edited = LoanLedger.lentRow(LoanLedger.lentDraft(from: person["transactions"][0]), id: "x", base: person["transactions"][0])
        XCTAssertEqual(edited["extra"].text, "keep"); XCTAssertEqual(edited["id"].text, "1")
        XCTAssertThrowsError(try AccountOp.list(key: "transactions", .delete(id: "gone")).patch(for: person).get())
    }

    func testLoanPaymentStartsAsTheMacFormDoesAndRebasesOnTheMacsRecord() throws {
        let loan = json(#"{"id":"l","name":"Phone EMI","lender":"Scapia","emiAmount":6533,"updatedAt":"x","payments":[{"id":"pay_1","amount":6533,"date":"2025-11-25","emiNumber":1}]}"#)
        var d = LoanLedger.paymentDraft(newFor: loan)
        XCTAssertEqual(d.amount, "6533"); XCTAssertEqual(d.emiNumber, "2"); XCTAssertEqual(d.card, "Scapia"); XCTAssertEqual(d.mode, "auto_debit")
        d.date = "2025-12-25"
        let row = LoanLedger.paymentRow(d, now: Date(timeIntervalSince1970: 1_800_000_000))
        XCTAssertEqual(row["id"].text, "pay_1800000000000"); XCTAssertEqual(row["emiNumber"].double, 2); XCTAssertFalse(row["createdAt"].isNull)
        let op = AccountOp.list(key: "payments", .add(row))
        // Made on the phone; the Mac meanwhile recorded another payment — both survive.
        let mac = json(#"{"id":"l","payments":[{"id":"pay_1"},{"id":"pay_mac","amount":1}]}"#)
        XCTAssertEqual((try op.patch(for: mac).get()["payments"] as! [Any]).count, 3)
        // It survives being written to disk while offline.
        let o = OfflineOp(id: "1", created: Date(), label: "x", kind: .account(collection: "loans", id: "l", op))
        let back = OfflineCoding.decode(try JSONSerialization.jsonObject(with: JSONSerialization.data(withJSONObject: OfflineCoding.encode(o))) as! [String: Any])
        guard case .account(_, _, let b)? = back?.kind else { return XCTFail("lost") }
        XCTAssertEqual((try b.patch(for: loan).get()["payments"] as! [Any]).count, 2)
        d.amount = "0"; XCTAssertFalse(LoanLedger.paymentProblems(d).isEmpty)
    }
}

final class AssetEditingTests: XCTestCase {
    private func json(_ s: String) -> JSONValue { try! JSONValue.parse(Data(s.utf8)) }
    private let category = #"{"id":"plots","type":"real_estate","items":[{"id":1790,"name":"House","currentValue":100,"transactions":[{"id":"t0","kind":"property_tax","amount":10}],"units":[{"id":"u1","name":"Shop 1","unitType":"shop","selfOccupied":false,"rental":{"monthlyRent":1000,"leaseStart":"2026-01-01"},"transactions":[]},{"id":"u2","name":"Shop 2","unitType":"shop","rental":null,"transactions":[]}]},{"id":"g1","name":"Mixer","services":[],"receipts":[]}]}"#

    private func roundTrip(_ op: AssetOp) -> AssetOp? {
        let o = OfflineOp(id: "1", created: Date(), label: "x", kind: .account(collection: "assets", id: "plots", .asset(op)))
        let data = try! JSONSerialization.data(withJSONObject: OfflineCoding.encode(o))
        guard case .account(_, _, .asset(let a))? = OfflineCoding.decode(try! JSONSerialization.jsonObject(with: data) as! [String: Any])?.kind else { return nil }
        return a
    }

    func testItemFormKeepsWhatItDoesNotShowAndTheEditIsAnIntent() throws {
        let cat = json(category), item = cat["items"][0]
        var d = AssetEditing.itemDraft(from: item); d.currentValue = "250,000"; d.place = "Vizag"
        let row = AssetEditing.itemRow(d, isRealEstate: true, id: "x", base: item)
        XCTAssertEqual(row["transactions"].array.count, 1); XCTAssertEqual(row["units"].array.count, 2, "units survive an edit of the item")
        XCTAssertEqual(row["id"], item["id"], "numeric ids stay numeric")
        let edit = AssetEditing.itemEdit(itemId: "1790", old: item, new: row)
        let patch = try edit.patch(for: cat).get()
        XCTAssertEqual(((patch["items"] as! [[String: Any]])[0])["currentValue"] as? Double, 250000)
        XCTAssertEqual((patch["items"] as! [Any]).count, 2)
        // The Mac changed the value meanwhile: held, not overwritten.
        let moved = json(category.replacingOccurrences(of: #""currentValue":100"#, with: #""currentValue":999"#))
        XCTAssertThrowsError(try edit.patch(for: moved).get())
        XCTAssertNotNil(roundTrip(edit))
    }

    func testEntriesLandInTheirUnitAndCanMoveBetweenUnits() throws {
        let cat = json(category)
        var d = AssetEditing.entryDraft(newFor: true, unit: "u1"); d.amount = "1,000"; d.period = "August 2026"; d.date = "2026-09-04"
        XCTAssertTrue(AssetEditing.entryProblems(d).isEmpty)
        let row = AssetEditing.entryRow(d, isRealEstate: true, id: "n1")
        XCTAssertEqual(row["period"].text, "2026-08"); XCTAssertEqual(row["type"].text, "income"); XCTAssertTrue(row["borne"].isNull, "rent does not ask who pays")
        let add = AssetOp.entry(itemId: "1790", unit: "u1", .add(row))
        let after = try add.patch(for: cat).get()["items"] as! [[String: Any]]
        XCTAssertEqual(((after[0]["units"] as! [[String: Any]])[0]["transactions"] as! [Any]).count, 1)
        XCTAssertEqual((after[0]["transactions"] as! [Any]).count, 1, "the building's own entries are untouched")
        // Move it to Shop 2 after it exists in Shop 1.
        let held = json(String(data: try JSONSerialization.data(withJSONObject: ["id": "plots", "items": after]), encoding: .utf8)!)
        let move = AssetOp.entry(itemId: "1790", unit: "u2", .replace(row, from: "u1"))
        let moved = try move.patch(for: held).get()["items"] as! [[String: Any]]
        let units = moved[0]["units"] as! [[String: Any]]
        XCTAssertEqual((units[0]["transactions"] as! [Any]).count, 0); XCTAssertEqual((units[1]["transactions"] as! [Any]).count, 1)
        XCTAssertThrowsError(try AssetOp.entry(itemId: "1790", unit: "u1", .delete(id: "nope")).patch(for: cat).get())
        XCTAssertNotNil(roundTrip(move))
        // An expense on a let property asks who pays; a part-recovered bill keeps the amount.
        var bill = AssetEditing.entryDraft(newFor: true, unit: nil); bill.kind = "current_bill"; bill.amount = "3000"; bill.borne = "recovered"; bill.recoveredAmount = "1200"
        let b = AssetEditing.entryRow(bill, isRealEstate: true, id: "b")
        XCTAssertEqual(Rental.netCost(b), 1800); XCTAssertEqual(b["recoveredAmount"].double, 1200)
        bill.kind = "rent"; XCTAssertTrue(AssetEditing.entryRow(bill, isRealEstate: true, id: "b")["recoveredAmount"].isNull, "a stale value cannot survive a change of kind")
    }

    func testServicesAndUnitsAndDeletes() throws {
        let cat = json(category)
        var s = AssetEditing.ServiceDraft(); XCTAssertFalse(AssetEditing.serviceProblems(s).isEmpty)
        s.description = "Replaced pods"; s.cost = "0"; s.underWarranty = true
        let add = AssetOp.sublist(itemId: "g1", key: "services", .add(AssetEditing.serviceRow(s, id: "s1")))
        XCTAssertEqual((((try add.patch(for: cat).get()["items"] as! [[String: Any]])[1])["services"] as! [Any]).count, 1)
        var u = AssetEditing.UnitDraft(); u.name = "Annex"; u.rental.monthlyRent = "3000"
        let unitRow = AssetEditing.unitRow(u)
        let addUnit = AssetOp.unit(itemId: "1790", .add(unitRow))
        XCTAssertEqual((((try addUnit.patch(for: cat).get()["items"] as! [[String: Any]])[0])["units"] as! [Any]).count, 3)
        XCTAssertEqual(unitRow["rental"]["monthlyRent"].double, 3000)
        let del = AssetOp.unit(itemId: "1790", .delete(id: "u2"))
        XCTAssertEqual((((try del.patch(for: cat).get()["items"] as! [[String: Any]])[0])["units"] as! [Any]).count, 1)
        XCTAssertThrowsError(try AssetOp.unit(itemId: "1790", .delete(id: PropertyUnits.mainId)).patch(for: cat).get())
        XCTAssertEqual((try AssetOp.deleteItem(itemId: "g1").patch(for: cat).get()["items"] as! [Any]).count, 1)
        XCTAssertEqual((try AssetOp.addItem(json(#"{"id":"n","name":"New"}"#)).patch(for: cat).get()["items"] as! [Any]).count, 3)
        for op in [add, addUnit, del, AssetOp.deleteItem(itemId: "g1"), AssetOp.addItem(json(#"{"id":"n"}"#))] { XCTAssertNotNil(roundTrip(op)) }
    }

    func testResearchCallsKeepTheNewestPerHoldingAndItsChanges() {
        let body = json("""
        {"snapshots":[
         {"date":"2026-11-02","rows":[{"holdingId":"s1","call":"HOLD","confidence":"HIGH","reason":"a"},{"holdingId":"s2","call":"BUY"}]},
         {"date":"2026-11-04","rows":[{"holdingId":"s1","call":"BUY","confidence":"MEDIUM","reason":"b","news":"n","trigger":"t"},{"name":"No match","call":"SELL"}]}
        ]}
        """)
        let calls = ResearchCall.parse(body, today: "2026-11-06")
        XCTAssertEqual(calls.count, 2)
        XCTAssertEqual(calls["s1"]?.call, "BUY")
        XCTAssertEqual(calls["s1"]?.reason, "b")
        XCTAssertEqual(calls["s1"]?.ageDays, 2)
        XCTAssertEqual(calls["s1"]?.changes.map(\.call), ["BUY", "HOLD"])
        XCTAssertEqual(calls["s2"]?.date, "2026-11-02")      // left out of the later day: keeps its call, marked old
        XCTAssertEqual(calls["s2"]?.ageDays, 4)
        XCTAssertEqual(calls["s1"]?.previous?.call, "HOLD")      // it was HOLD until the 4th
        XCTAssertEqual(calls["s1"]?.since, "2026-11-04")
        XCTAssertNil(calls["s2"]?.previous)
    }

    func testDividendRemindersSkipWhatAlreadyArrivedThisMonth() {
        let stocks = [
            json("{\"id\":\"a\",\"name\":\"Alpha\",\"shares\":10,\"transactions\":[{\"type\":\"dividend\",\"date\":\"2025-11-10\",\"amount\":50},{\"type\":\"dividend\",\"date\":\"2026-11-05\",\"amount\":60}]}"),
            json("{\"id\":\"b\",\"name\":\"Beta\",\"shares\":5,\"transactions\":[{\"type\":\"dividend\",\"date\":\"2025-11-20\",\"amount\":30},{\"type\":\"dividend\",\"date\":\"2026-02-20\",\"amount\":30}]}"),
            json("{\"id\":\"c\",\"name\":\"Gone\",\"shares\":0,\"transactions\":[{\"type\":\"dividend\",\"date\":\"2025-12-01\",\"amount\":30}]}"),
        ]
        let today = ISO8601DateFormatter().date(from: "2026-11-15T06:00:00Z")!
        let plan = DividendReminders.plan(stocks: stocks, calendar: Dividends.calendarMonths(stocks), today: today)
        // November: Alpha already paid this month, Beta has not.
        XCTAssertEqual(plan.first?.month, 11)
        XCTAssertTrue(plan.first?.body.contains("Beta") == true)
        XCTAssertFalse(plan.first?.body.contains("Alpha") == true)
        // December has only an exited stock, so no reminder; February has Beta.
        XCTAssertNil(plan.first { $0.month == 12 })
        XCTAssertEqual(plan.first { $0.month == 2 }?.year, 2027)
    }

    func testPriceLevelsGroupBuysByPricePaid() {
        let txs = [
            json("{\"type\":\"buy\",\"price\":100,\"quantity\":10}"),
            json("{\"type\":\"buy\",\"price\":200,\"quantity\":5}"),
            json("{\"type\":\"ipo\",\"price\":150,\"quantity\":2}"),
            json("{\"type\":\"sell\",\"price\":900,\"quantity\":3}"),       // a sale commits no money
            json("{\"type\":\"bonus\",\"quantity\":4}"),                      // a bonus costs none
        ]
        let bands = PriceLevels.bands(txs, avgCost: 130)
        XCTAssertEqual(bands.reduce(0) { $0 + $1.amount }, 100 * 10 + 200 * 5 + 150 * 2)
        XCTAssertEqual(bands.reduce(0) { $0 + $1.count }, 3)
        XCTAssertTrue(bands.first!.belowAverage)
        XCTAssertFalse(bands.last!.belowAverage)
        // One price only: a single band, not nothing.
        let one = PriceLevels.bands([json("{\"type\":\"buy\",\"price\":50,\"quantity\":3}"), json("{\"type\":\"buy\",\"price\":50,\"quantity\":2}")], avgCost: 50)
        XCTAssertEqual(one.count, 1)
        XCTAssertEqual(one[0].amount, 250)
        XCTAssertEqual(one[0].count, 2)
        XCTAssertTrue(PriceLevels.bands([json("{\"type\":\"sell\",\"price\":9,\"quantity\":1}")], avgCost: 1).isEmpty)
    }

    func testPriceHistorySeriesStatsAndBuyDots() {
        let body = json("{\"closes\":{\"2026-10-05\":110,\"2026-10-01\":100,\"2026-10-03\":\"bad\",\"2026-10-09\":90}}")
        let points = PriceHistory.series(body)
        XCTAssertEqual(points.map(\.day), ["2026-10-01", "2026-10-05", "2026-10-09"])    // oldest first, bad value dropped
        let stats = PriceHistory.stats(points)!
        XCTAssertEqual(stats.high, 110); XCTAssertEqual(stats.low, 90)
        XCTAssertEqual(stats.changePercent, -10, accuracy: 0.0001)
        let txs = [
            json("{\"type\":\"buy\",\"date\":\"2026-10-03\",\"price\":101,\"quantity\":2}"),   // a weekend-style gap: lands on the 5th
            json("{\"type\":\"sell\",\"date\":\"2026-10-05\",\"price\":120,\"quantity\":1}"),   // a sale is no dot
            json("{\"type\":\"buy\",\"date\":\"2025-01-01\",\"price\":50,\"quantity\":1}"),    // before the range
        ]
        let buys = PriceHistory.buys(txs, in: points)
        XCTAssertEqual(buys.count, 1)
        XCTAssertEqual(buys[0].price, 101)
        XCTAssertEqual(buys[0].date, points[1].date)
        XCTAssertNil(PriceHistory.stats([points[0]]))
    }
}
