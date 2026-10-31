import Foundation

/// Budget limits against what was actually spent — a port of `utils/budgetUtils.js`'s
/// `calculateBudgetStatus` and the memos in `pages/CategoryBudgets.jsx`. Limits are entered by
/// you on the Mac; this only reads them.
enum Budgets {
    struct Status: Equatable {
        let planned: Double, actual: Double, difference: Double, percentUsed: Double
        let status: String   // safe, warning, overspent
    }

    static func status(planned: Double, actual: Double) -> Status {
        let p = planned.isNaN ? 0 : planned, a = actual.isNaN ? 0 : actual
        var pct = 0.0
        if p > 0 { pct = a / p * 100 } else if a > 0 { pct = 100 }
        let s = a > p ? "overspent" : pct >= 80 ? "warning" : "safe"
        return Status(planned: p, actual: a, difference: p - a, percentUsed: pct, status: s)
    }

    /// Built-in categories, plus those you added, minus those you deleted (`mergedCategoryMap`).
    static func categoryMap(appData: JSONValue) -> [(main: String, subs: [String])] {
        var merged: [(main: String, subs: [String])] = CategoryData.map
        for (main, subs) in appData["customCategoryMap"].object.sorted(by: { $0.key < $1.key }) {
            let add = subs.array.map(\.text)
            if let i = merged.firstIndex(where: { $0.main == main }) {
                var seen = Set<String>(); merged[i].subs = (merged[i].subs + add).filter { seen.insert($0).inserted }
            } else { merged.append((main, add)) }
        }
        let deleted = Set(appData["deletedCategories"].array.map(\.text))
        return merged.filter { !deleted.contains($0.main) }.map { m in (m.main, m.subs.filter { !deleted.contains("\(m.main):\($0)") }) }
    }

    static let excluded: Set<String> = ["Income", "Transfers", "Investments", "Loans"]

    struct Spending: Equatable {
        var sub: [String: Double] = [:], main: [String: Double] = [:]
        func subSpend(_ n: String) -> Double { sub[n.trimmingCharacters(in: .whitespaces).lowercased()] ?? 0 }
        func mainSpend(_ n: String) -> Double { main[n.trimmingCharacters(in: .whitespaces).lowercased()] ?? 0 }
    }

    static func spending(expenses: JSONValue, year: String, month: String, map: [(main: String, subs: [String])]) -> Spending {
        func mainOf(_ sub: String) -> String {
            let lower = sub.trimmingCharacters(in: .whitespaces).lowercased()
            for (main, subs) in map where subs.contains(where: { $0.trimmingCharacters(in: .whitespaces).lowercased() == lower }) { return main }
            if let k = map.first(where: { $0.main.trimmingCharacters(in: .whitespaces).lowercased() == lower }) { return k.main }
            return "Miscellaneous"
        }
        let monthData = expenses[year][month]
        var s = Spending()
        let txs = monthData["transactions"].array
        if !txs.isEmpty {
            for tx in txs {
                if tx["isCredited"].truthy || tx["transactionType"].text == "credit" { continue }
                let subCat = tx["category"].truthy ? tx["category"].text : "Miscellaneous"
                let mainCat = tx["mainCategory"].truthy ? tx["mainCategory"].text : mainOf(subCat)
                let amt = tx["amount"].double
                s.sub[subCat.trimmingCharacters(in: .whitespaces).lowercased(), default: 0] += amt
                s.main[mainCat.trimmingCharacters(in: .whitespaces).lowercased(), default: 0] += amt
            }
        } else if !monthData.isNull {
            let categories = monthData["categories"].truthy ? monthData["categories"] : monthData
            for (cat, val) in categories.object {
                if ["salary received", "salary", "income", "transactions"].contains(cat.trimmingCharacters(in: .whitespaces).lowercased()) { continue }
                let amt = val.double
                let mainCat = mainOf(cat)
                s.sub[cat.trimmingCharacters(in: .whitespaces).lowercased(), default: 0] += amt
                s.main[mainCat.trimmingCharacters(in: .whitespaces).lowercased(), default: 0] += amt
            }
        }
        return s
    }

    struct Stats: Equatable {
        var totalTarget = 0.0, totalActual = 0.0
        var over = 0, warning = 0, safe = 0, tracked = 0
        var health = 100.0
    }

    static func stats(map: [(main: String, subs: [String])], budgets: JSONValue, spending: Spending) -> Stats {
        var t = Stats()
        for (main, subs) in map where !excluded.contains(main) {
            let mainSpend = spending.mainSpend(main)
            t.totalActual += mainSpend
            let mainTarget = budgets[main].double
            func count(_ st: String) { if st == "overspent" { t.over += 1 } else if st == "warning" { t.warning += 1 } else { t.safe += 1 } }
            if mainTarget > 0 { t.totalTarget += mainTarget; t.tracked += 1; count(status(planned: mainTarget, actual: mainSpend).status) }
            for sub in subs {
                let target = budgets[sub].double
                if target > 0 {
                    if mainTarget == 0 { t.totalTarget += target }
                    t.tracked += 1
                    count(status(planned: target, actual: spending.subSpend(sub)).status)
                }
            }
        }
        t.health = t.tracked > 0 ? Money.jsRound(Double(t.tracked - t.over) / Double(t.tracked) * 100) : 100
        return t
    }
}
