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
