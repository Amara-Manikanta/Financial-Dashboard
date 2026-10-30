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
