import Foundation

/// Financial Goals — a port of the computation at the top of `pages/FinancialGoals.jsx`.
/// A goal's progress is read live from the accounts it is linked to, so nothing is stored
/// about how much has been saved.
enum GoalsPage {
    struct Goal: Identifiable, Equatable {
        let raw: JSONValue
        var id: String { raw["id"].text }
        var name: String { raw["name"].text }
        var priority: String { raw["priority"].text }
        let saved: Double
        let progressPct: Double
        /// `nil` when the goal has no usable deadline (JavaScript's NaN).
        let daysLeft: Double?
        let status: String
        var target: Double { raw["targetAmount"].double }
    }

    struct Page: Equatable {
        var goals: [Goal] = []
        var totalTarget = 0.0
        var totalAchieved = 0.0
        var overallProgress = 0.0
    }

    private static func active(_ item: JSONValue) -> Bool {
        if item.isNull || item["isArchived"].truthy { return false }
        let s = item["status"].text
        return s != "Closed" && s != "Archived"
    }

    private static func receivable(_ lents: JSONValue) -> [JSONValue] {
        lents.array.filter { $0["type"].text == "lent" && LoansPage.outstanding($0) >= 1 }
    }

    private static func sourceValue(_ category: String, manual: Double, savings: [JSONValue], lents: JSONValue, asOf: Date) -> Double {
        if category == "none" { return 0 }
        if category == "manual" { return manual }
        if category == "lent" { return receivable(lents).reduce(0) { $0 + LoansPage.outstanding($1) } }
        if category == "all_savings" { return savings.reduce(0) { $0 + Valuation.currentValue($1, asOf: asOf) } }
        if category == "all_investments" {
            return savings.filter { $0["type"].text == "mutual_fund" || $0["type"].text == "stock_market" }.reduce(0) { $0 + Valuation.currentValue($1, asOf: asOf) }
        }
        return savings.filter { $0["type"].text.lowercased() == category.lowercased() }.reduce(0) { $0 + Valuation.currentValue($1, asOf: asOf) }
    }

    static func saved(_ goal: JSONValue, savings all: JSONValue, lents: JSONValue, asOf: Date) -> Double {
        let sources: [JSONValue]
        if !goal["fundingSources"].array.isEmpty { sources = goal["fundingSources"].array }
        else {
            let cat = goal["fundingSource"].truthy ? goal["fundingSource"].text : "all_savings"
            sources = [.object(["category": .string(cat), "itemId": .string("all"), "manualAmount": .number(goal["manualProgress"].double)])]
        }
        let savings = all.array.filter(active)
        var total = 0.0
        for src in sources {
            let cat = src["category"].truthy ? src["category"].text : "all_savings"
            let itemId = src["itemId"].text
            let hasItem = src["itemId"].truthy && itemId != "all"
            let manual = src["manualAmount"].double
            if cat == "none" { continue }
            if cat == "manual" { total += manual }
            else if cat == "lent" && hasItem {
                if let found = receivable(lents).first(where: { $0["id"].text == itemId }) { total += LoansPage.outstanding(found) }
            } else if hasItem {
                if itemId.hasPrefix("rd_") {
                    let sub = String(itemId.dropFirst(3))
                    for s in savings where s["type"].text == "recurring_deposit" && s["recurringDeposits"].truthy {
                        if let found = s["recurringDeposits"].array.first(where: { active($0) && $0["id"].text == sub }) {
                            total += found["installments"].array.reduce(0) { $0 + $1["amount"].double }
                        }
                    }
                } else if itemId.hasPrefix("fd_") {
                    let sub = String(itemId.dropFirst(3))
                    for s in savings where s["type"].text == "fixed_deposit" && s["deposits"].truthy {
                        if let found = s["deposits"].array.first(where: { active($0) && $0["id"].text == sub }) {
                            total += found["currentValue"].double != 0 ? found["currentValue"].double : found["originalAmount"].double
                        }
                    }
                } else if let item = savings.first(where: { $0["id"].text == itemId }) {
                    total += Valuation.currentValue(item, asOf: asOf)
                }
            } else {
                total += sourceValue(cat, manual: manual, savings: savings, lents: lents, asOf: asOf)
            }
        }
        return total
    }

    static func page(goals: JSONValue, savings: JSONValue, lents: JSONValue, asOf: Date = Date()) -> Page {
        var page = Page()
        let list = goals.array
        page.totalTarget = list.reduce(0) { $0 + $1["targetAmount"].double }
        for g in list {
            let saved = saved(g, savings: savings, lents: lents, asOf: asOf)
            let target = g["targetAmount"].double
            page.totalAchieved += min(saved, target)
            let pct = target > 0 ? min(100, Money.jsRound(saved / target * 100)) : 0
            let deadline = JSDate.parse(g["deadline"])
            let days = deadline.map { ($0.timeIntervalSince(asOf) * 1000 / 86_400_000).rounded(.up) }
            var status = "on_track"
            if pct >= 100 { status = "completed" }
            else if let days, days < 0 { status = "overdue" }
            else if let days, pct < 30 && days < 90 { status = "behind" }
            page.goals.append(Goal(raw: g, saved: saved, progressPct: pct, daysLeft: days, status: status))
        }
        page.overallProgress = page.totalTarget > 0 ? Money.jsRound(page.totalAchieved / page.totalTarget * 100) : 0
        return page
    }
}
