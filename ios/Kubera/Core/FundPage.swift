import Foundation

/// A mutual-fund account page — a port of the logic in `pages/MutualFundDetails.jsx`: unit accounting with
/// realised and unrealised profit, the two "what if" calculators, the invested-by-NAV-level bands, the
/// yearly profit and loss, and the year filter. Values come from `Valuation` (already checked against the
/// Mac's own valuation for every account), so this page and the savings list always agree.
enum FundPage {
    struct Tx: Identifiable, Equatable {
        let index: Int            // position in the account's `transactions`, which an edit or delete refers to
        let raw: JSONValue
        let date: String
        let isSell: Bool
        let amount: Double
        let units: Double         // negative for a sale, as the page shows it
        let nav: Double
        let value: Double
        let profit: Double
        var id: Int { index }
    }

    struct YearPL: Identifiable, Equatable { let year: String; let realized: Double; let unrealized: Double; let total: Double; var id: String { year } }

    struct Band: Identifiable, Equatable {
        let from: Double, to: Double, amount: Double, units: Double, count: Int, belowAverage: Bool
        var id: Double { from }
        var label: String { String(format: "%.1f–%.1f", from, to) }
    }

    struct Page: Equatable {
        var currentNav = 0.0
        var currentValue = 0.0, costHeld = 0.0, unrealised = 0.0, realised = 0.0, totalProfit = 0.0
        var unitsHeld = 0.0, avgNav = 0.0
        var rows: [Tx] = []                  // oldest first, as the page computes them
        var yearly: [YearPL] = []
        var bands: [Band] = []
        var years: [String] = ["All"]
    }

    struct MoreToday: Equatable { let amount, unitsGained, newUnits, newAvgNav, change, costPerUnit: Double }
    struct AtTarget: Equatable { let target, units, cost, value, profit, percent, breakEven: Double; let includesPlanned: Bool }

    private static func n(_ v: JSONValue) -> Double { v.jsNumber.flatMap { $0.isNaN ? nil : $0 } ?? 0 }
    private static func ts(_ v: JSONValue) -> Double { JSDate.parse(v)?.timeIntervalSince1970 ?? 0 }

    /// April to March, as `2025-26`; empty for a date that cannot be read.
    static func financialYear(_ date: JSONValue) -> String {
        guard let d = JSDate.parse(date) else { return "" }
        let c = Calendar.current.dateComponents([.year, .month], from: d)
        let y = c.year ?? 0, m = c.month ?? 0
        return m >= 4 ? "\(y)-\(String(format: "%02d", (y + 1) % 100))" : "\(y - 1)-\(String(format: "%02d", y % 100))"
    }

    static func page(_ fund: JSONValue, asOf: Date = Date()) -> Page {
        var p = Page()
        p.currentNav = n(fund["currentNav"])
        p.currentValue = Valuation.currentValue(fund, asOf: asOf)
        p.costHeld = Valuation.investedValue(fund)
        p.unrealised = p.currentValue - p.costHeld

        var runningUnits = 0.0, runningCost = 0.0
        let ordered = fund["transactions"].array.enumerated().sorted { a, b in
            ts(a.element["date"]) != ts(b.element["date"]) ? ts(a.element["date"]) < ts(b.element["date"]) : a.offset < b.offset
        }
        for (index, tx) in ordered {
            let sell = ["sell", "withdraw"].contains(tx["type"].text)
            let amount = n(tx["amount"]), units = n(tx["units"])
            if sell {
                let avg = runningUnits > 0 ? runningCost / runningUnits : 0
                let costSold = units * avg
                runningUnits -= units; runningCost -= costSold
                if runningUnits < 0 { runningUnits = 0 }
                if runningCost < 0 { runningCost = 0 }
                p.rows.append(Tx(index: index, raw: tx, date: tx["date"].text, isSell: true, amount: amount, units: -units, nav: n(tx["nav"]), value: amount, profit: amount - costSold))
            } else {
                runningUnits += units; runningCost += amount
                let value = units * p.currentNav
                p.rows.append(Tx(index: index, raw: tx, date: tx["date"].text, isSell: false, amount: amount, units: units, nav: n(tx["nav"]), value: value, profit: value - amount))
            }
        }
        p.unitsHeld = runningUnits
        p.avgNav = runningUnits > 0 ? runningCost / runningUnits : 0
        p.realised = p.rows.filter(\.isSell).reduce(0) { $0 + $1.profit }
        p.totalProfit = p.unrealised + p.realised

        var by: [String: (realized: Double, unrealized: Double, total: Double)] = [:]
        for tx in p.rows {
            let fy = { let f = financialYear(tx.raw["date"]); return f.isEmpty ? String(Calendar.current.component(.year, from: JSDate.parse(tx.raw["date"]) ?? Date())) : f }()
            var e = by[fy] ?? (0, 0, 0)
            if tx.isSell { e.realized += tx.profit } else { e.unrealized += tx.profit }
            e.total += tx.profit
            by[fy] = e
        }
        p.yearly = by.map { YearPL(year: $0.key, realized: $0.value.realized.rounded(), unrealized: $0.value.unrealized.rounded(), total: $0.value.total.rounded()) }.sorted { $0.year < $1.year }
        p.bands = bands(fund, avgNav: p.avgNav)
        p.years = ["All"] + Set(p.rows.map { financialYear($0.raw["date"]) }.filter { !$0.isEmpty }).sorted(by: >)
        return p
    }

    /// The year's rows, newest first (the page's own table order).
    static func rows(_ page: Page, year: String) -> [Tx] {
        page.rows.enumerated().sorted { a, b in
            ts(a.element.raw["date"]) != ts(b.element.raw["date"]) ? ts(a.element.raw["date"]) > ts(b.element.raw["date"]) : a.offset < b.offset
        }.map(\.element).filter { year == "All" || financialYear($0.raw["date"]) == year }
    }

    /// How the money already invested is spread across NAV levels. Buys only; a redemption returns money.
    static func bands(_ fund: JSONValue, avgNav: Double) -> [Band] {
        let buys = fund["transactions"].array.compactMap { t -> (nav: Double, amount: Double, units: Double)? in
            let type = t["type"].truthy ? t["type"].text : (t["remarks"].text.lowercased().contains("sip") ? "sip" : "buy")
            guard type == "buy" || type == "sip", n(t["nav"]) > 0, n(t["amount"]) > 0 else { return nil }
            return (n(t["nav"]), n(t["amount"]), n(t["units"]))
        }
        guard buys.count >= 2 else { return [] }
        let lo = buys.map(\.nav).min()!, hi = buys.map(\.nav).max()!
        guard hi > lo else { return [] }
        let count = max(3, min(10, buys.count))
        let width = (hi - lo) / Double(count)
        var amount = [Double](repeating: 0, count: count), units = [Double](repeating: 0, count: count), c = [Int](repeating: 0, count: count)
        for b in buys {
            let i = min(count - 1, Int(floor((b.nav - lo) / width)))
            amount[i] += b.amount; units[i] += b.units; c[i] += 1
        }
        return (0..<count).filter { c[$0] > 0 }.map { i in
            let from = lo + Double(i) * width, to = lo + Double(i + 1) * width
            return Band(from: from, to: to, amount: amount[i], units: units[i], count: c[i], belowAverage: (from + to) / 2 < avgNav)
        }
    }

    /// What one more purchase today would do to the average.
    static func investMore(_ page: Page, amount: Double) -> MoreToday? {
        guard amount.isFinite, amount > 0, page.currentNav > 0 else { return nil }
        let gained = amount / page.currentNav
        let newUnits = page.unitsHeld + gained
        let newAvg = newUnits > 0 ? ((page.avgNav * page.unitsHeld) + amount) / newUnits : 0
        return MoreToday(amount: amount, unitsGained: gained, newUnits: newUnits, newAvgNav: newAvg, change: newAvg - page.avgNav, costPerUnit: page.currentNav)
    }

    /// What the position is worth if the NAV reaches a figure, counting a planned purchase when there is one.
    static func atTarget(_ page: Page, target: Double, planned: MoreToday?) -> AtTarget? {
        guard target.isFinite, target > 0 else { return nil }
        let units = planned?.newUnits ?? page.unitsHeld
        let cost = (page.avgNav * page.unitsHeld) + (planned?.amount ?? 0)
        guard units > 0 else { return nil }
        let value = units * target, profit = value - cost
        return AtTarget(target: target, units: units, cost: cost, value: value, profit: profit, percent: cost > 0 ? profit / cost * 100 : 0, breakEven: cost / units, includesPlanned: planned != nil)
    }
}
