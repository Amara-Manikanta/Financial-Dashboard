import Foundation

struct MonthSummary: Identifiable, Equatable {
    var id: String { "\(year)-\(index)" }
    let year: Int
    /// 0 = January, matching JavaScript's `getMonth()`.
    let index: Int
    let name: String
    var spent: Double
    var invested: Double
    var income: Double
    var spentCategories: Int
    var investedCategories: Int
    /// Raw rows for the month; empty for older months that only kept category totals.
    var transactions: [JSONValue]
    var balance: Double { income - spent - invested }
}

struct YearSummary: Identifiable, Equatable {
    var id: Int { year }
    let year: Int
    var months: [MonthSummary]
    var spent: Double { months.reduce(0) { $0 + $1.spent } }
    var invested: Double { months.reduce(0) { $0 + $1.invested } }
    var income: Double { months.reduce(0) { $0 + $1.income } }
}

/// Month and year totals, as the web Expenses page computes them
/// (`Expenses.jsx` expenseGroups + `calculateSalaryStats` in FinanceContext).
enum ExpenseLedger {
    static let monthNames = ["January", "February", "March", "April", "May", "June", "July",
                             "August", "September", "October", "November", "December"]

    static func monthIndex(_ name: String) -> Int? {
        let key = name.trimmingCharacters(in: .whitespaces).lowercased()
        return monthNames.firstIndex { $0.lowercased() == key || $0.lowercased().prefix(3) == key }
    }

    // MARK: Income

    private static let earningsKeys = ["basicSalary", "hra", "conveyanceAllowance", "flexibleAllowance", "performanceBonus",
                                       "foodWallet", "holidayAllowance", "compensatoryAllowance", "engagementPb",
                                       "annualFlexiBasket", "internetAllowance", "cfPfMonthly"]
    // `vpf` is listed on purpose: a numeric payslip key in neither list is added
    // to gross by the catch-all, which would flip a deduction into earnings.
    private static let deductionKeys = ["epf", "vpf", "profTax", "incomeTax", "otherRecoveries", "medicalPremRecoverable", "cfPfMonthly"]

    /// Net pay from explicit payslips, keyed year → month name.
    static func payslips(_ salaryDetails: JSONValue) -> [String: [String: Double]] {
        var slips: [String: [String: Double]] = [:]
        let known = Set(["id", "year", "month", "type"] + earningsKeys + deductionKeys)
        for record in salaryDetails.array {
            if !record["year"].truthy || !record["month"].truthy || record["month"].text == "Annual" { continue }
            var gross = 0.0
            for key in earningsKeys where key != "cfPfMonthly" { gross += record[key].double }
            for (key, value) in record.object where !known.contains(key) {
                if let number = value.jsNumber, number > 0 { gross += number }
            }
            var deductions = 0.0
            for key in deductionKeys where key != "cfPfMonthly" { deductions += abs(record[key].double) }
            let net = gross - deductions
            if net > 0 { slips[record["year"].text, default: [:]][record["month"].text] = net }
        }
        return slips
    }

    /// Income for one month: a payslip, overridden by salary rows in the ledger,
    /// falling back to the legacy category totals.
    static func income(year: String, month: String, node: JSONValue, slips: [String: [String: Double]]) -> Double {
        let salary = configuredSalary(year: year, month: month, node: node, slips: slips)
        if salary == 0 {
            let categories = node["categories"].isNull ? node : node["categories"]
            for key in ["salary received", "salary", "income"] where categories[key].truthy {
                return categories[key].double
            }
            return 0
        }
        return salary
    }

    /// `salaryStats[year].months[month]`: the payslip, overridden by salary rows in the ledger.
    static func configuredSalary(year: String, month: String, node: JSONValue, slips: [String: [String: Double]]) -> Double {
        var salary = slips[year]?[month] ?? 0
        if case .array(let rows) = node["transactions"] {
            var sum = 0.0
            for tx in rows {
                let category = tx["category"].text.lowercased()
                let title = tx["title"].text.lowercased()
                if ["salary received", "salary", "income"].contains(category) || category.contains("salary")
                    || title.contains("salary received") || tx["isIncome"].truthy {
                    sum += tx["amount"].double
                }
            }
            if sum > 0 { salary = sum }
        }
        return salary
    }

    // MARK: Months and years

    static func years(expenses: JSONValue, categoryKinds: [String: Kind], salaryDetails: JSONValue) -> [YearSummary] {
        let slips = payslips(salaryDetails)
        var result: [YearSummary] = []
        for (yearKey, yearNode) in expenses.object {
            guard let year = Int(yearKey) else { continue }
            var months: [MonthSummary] = []
            for (monthName, node) in yearNode.object {
                guard let index = monthIndex(monthName) else { continue }
                var spent = 0.0, invested = 0.0, spentCategories = 0, investedCategories = 0
                let rows = node["transactions"].array
                if !rows.isEmpty {
                    let buckets = TransactionKind.buckets(rows, categoryKinds: categoryKinds)
                    spent = buckets.spent
                    invested = buckets.invested
                    spentCategories = buckets.spentCategories
                    investedCategories = buckets.investedCategories
                } else {
                    // Only per-category totals survive for these months.
                    let categories = node["categories"].isNull ? node : node["categories"]
                    for (category, value) in categories.object {
                        if ["salary received", "income", "salary"].contains(category.lowercased()) { continue }
                        let amount = value.double
                        let kind = categoryKinds[category.lowercased()] ?? TransactionKind.defaultKind(forCategory: category)
                        if kind == .spend { spent += amount; spentCategories += 1 }
                        else if kind == .transfer || kind == .lending { invested += amount; investedCategories += 1 }
                    }
                }
                months.append(MonthSummary(
                    year: year, index: index, name: monthNames[index], spent: spent, invested: invested,
                    income: MonthCategories.incomeTotal(node: node, salary: configuredSalary(year: yearKey, month: monthName, node: node, slips: slips)),
                    spentCategories: spentCategories, investedCategories: investedCategories, transactions: rows))
            }
            months.sort { $0.index < $1.index }
            result.append(YearSummary(year: year, months: months))
        }
        return result.sorted { $0.year > $1.year }
    }
}
