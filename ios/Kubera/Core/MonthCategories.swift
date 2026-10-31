import Foundation

/// The category breakdown on one month's page — a port of the `monthDetails`
/// memo in `pages/ExpenseDetails.jsx` (categories, main categories, income).
enum MonthCategories {
    struct Item: Equatable, Identifiable {
        var id: String { category }
        let category: String
        let mainCategory: String
        let amount: Double
        let deductibleAmount: Double
    }

    struct Income: Equatable, Identifiable {
        var id: String { category }
        let category: String
        let amount: Double
        let percentage: Int
    }

    struct Detail: Equatable {
        var items: [Item] = []
        var mainItems: [Item] = []
        var income: [Income] = []
        var salary: Double = 0
    }

    private static let knownIncome = ["salary received", "salary", "income", "bonus", "freelance",
        "interest income", "bank interest", "dividend", "stocks sell",
        "company claims", "rental income", "mutual fund redemption", "other income"]

    static func isIncome(category: String, mainCategory: String = "") -> Bool {
        if mainCategory.lowercased() == "income" { return true }
        let cat = category.lowercased()
        return knownIncome.contains { cat == $0 || cat.hasPrefix($0) }
    }

    static func mainCategory(of sub: String, map: [(main: String, subs: [String])]) -> String {
        let lower = sub.lowercased()
        if isIncome(category: sub) { return "Income" }
        let people = ["family lent", "family borrowed", "family transfer", "peer", "kitty party", "money received back",
                      "friend lent", "friend borrowed", "received back", "people transfer"]
        if people.contains(where: lower.contains) { return "People Transfers" }
        let transfers = ["bank transfer", "savings account", "emergency fund", "cash reserve", "transfer"]
        if transfers.contains(where: lower.contains) { return "Transfers" }
        for (main, subs) in map where subs.contains(where: { $0.lowercased() == lower }) { return main }
        if let key = map.first(where: { $0.main.lowercased() == lower }) { return key.main }
        return "Miscellaneous"
    }

    /// `salary` is `salaryStats[year].months[month]` — the payslip, overridden by salary rows.
    static func detail(node: JSONValue, salary configured: Double, map: [(main: String, subs: [String])]) -> Detail {
        let categories = node["categories"].isNull ? node : node["categories"]
        // Keys keep first-seen order, as a JavaScript object would.
        var order: [String] = []
        var totals: [String: Double] = [:], deductibles: [String: Double] = [:]
        var mainOrder: [String] = []
        var mainTotals: [String: Double] = [:], mainDeductibles: [String: Double] = [:]

        for (cat, value) in categories.object.sorted(by: { $0.key < $1.key })
        where !["salary received", "salary", "income", "transactions"].contains(cat) {
            order.append(cat)
            let n = value.jsNumber ?? .nan
            totals[cat] = n; deductibles[cat] = n
        }

        let rows = node["transactions"].array
        var incomeOrder: [String] = []
        var incomeTotals: [String: Double] = [:]
        var incomeSum = 0.0
        for t in rows where !t.isNull && isIncome(category: t["category"].text, mainCategory: t["mainCategory"].text) {
            let name = t["category"].truthy ? t["category"].text : "Salary"
            let amt = t["amount"].double
            if incomeTotals[name] == nil { incomeOrder.append(name) }
            incomeTotals[name, default: 0] += amt
            incomeSum += amt
        }

        var base = configured
        if base == 0 {
            if let key = categories.object.keys.sorted().first(where: { ["salary received", "salary", "income"].contains($0.lowercased()) }) {
                base = categories[key].jsNumber ?? .nan
            }
            if base == 0 && node["salary received"].truthy { base = node["salary received"].jsNumber ?? .nan }
        }
        let hasSalary = incomeTotals.keys.contains { ["salary received", "salary"].contains($0.lowercased()) }
        if !hasSalary && base > 0 {
            if incomeTotals["Salary"] == nil { incomeOrder.append("Salary") }
            incomeTotals["Salary"] = base
            incomeSum += base
        }
        let salary = incomeSum
        let income = incomeOrder.compactMap { name -> Income? in
            let amt = incomeTotals[name] ?? 0
            guard amt > 0 else { return nil }
            return Income(category: name, amount: amt, percentage: salary > 0 ? Int((amt / salary * 100).rounded(.toNearestOrAwayFromZero)) : 0)
        }
        .enumerated().sorted { $0.element.amount != $1.element.amount ? $0.element.amount > $1.element.amount : $0.offset < $1.offset }
        .map(\.element)

        if !rows.isEmpty {
            for k in order { totals[k] = 0; deductibles[k] = 0 }
            for t in rows {
                let cat = t["category"].truthy ? t["category"].text : "others"
                if isIncome(category: t["category"].text, mainCategory: t["mainCategory"].text) { continue }
                let amt = t["amount"].double
                let effective = t["isCredited"].truthy ? -amt : amt
                let target = order.first { $0.lowercased() == cat.lowercased() } ?? cat
                if totals[target] == nil { order.append(target) }
                totals[target, default: 0] += effective
                let main = t["mainCategory"].truthy ? t["mainCategory"].text : mainCategory(of: cat, map: map)
                if mainTotals[main] == nil { mainOrder.append(main) }
                mainTotals[main, default: 0] += effective
                let lc = cat.lowercased()
                let isBill = lc.contains("credit card bill") || lc.contains("credit card payment")
                let isCardSpend = t["paymentMode"].text == "credit_card" && !isBill
                if t["deductFromSalary"] != .bool(false) && !t["isRewardPoints"].truthy && !isCardSpend {
                    deductibles[target, default: 0] += effective
                    mainDeductibles[main, default: 0] += effective
                }
            }
        }

        func sorted(_ list: [Item]) -> [Item] {
            list.enumerated().sorted { $0.element.amount != $1.element.amount ? $0.element.amount > $1.element.amount : $0.offset < $1.offset }.map(\.element)
        }
        let items = order.compactMap { cat -> Item? in
            let amount = totals[cat] ?? 0
            guard amount != 0, !amount.isNaN, !isIncome(category: cat) else { return nil }
            let tx = rows.first { $0["category"].text.lowercased() == cat.lowercased() }
            let main = (tx?["mainCategory"].truthy ?? false) ? tx!["mainCategory"].text : mainCategory(of: cat, map: map)
            return Item(category: cat, mainCategory: main, amount: amount, deductibleAmount: deductibles[cat] ?? 0)
        }
        let mainItems = mainOrder.compactMap { cat -> Item? in
            let amount = mainTotals[cat] ?? 0
            guard amount != 0, cat.lowercased() != "income" else { return nil }
            return Item(category: cat, mainCategory: cat, amount: amount, deductibleAmount: mainDeductibles[cat] ?? 0)
        }
        return Detail(items: sorted(items), mainItems: sorted(mainItems), income: income, salary: salary)
    }
}
