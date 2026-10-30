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
