import Foundation

/// The savings-account page's filters, totals and earnings distribution, as `SavingsAccountDetails.jsx` computes them.
/// The Mac page also credits daily interest automatically when it opens; the phone does not (see docs).
enum SavingsAccountPage {
    struct Row: Identifiable { let index: Int; let raw: JSONValue; var id: Int { index } }
    struct Totals { var deposits = 0.0, interest = 0.0, withdrawals = 0.0, monnies = 0.0, lifetimeInterest = 0.0 }
    struct YearInterest: Identifiable { let year: String; var total: Double; var months: [(name: String, amount: Double)]; var id: String { year } }

    static let monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

    /// `sortedTransactions`: year, month (1-12 or nil) and type filters, newest first (stable for equal dates).
    static func rows(_ a: JSONValue, year: String = "All", month: Int? = nil, type: String = "All") -> [Row] {
        var out = a["transactions"].array.enumerated().map { Row(index: $0.offset, raw: $0.element) }
        if year != "All" { out = out.filter { $0.raw["date"].text.hasPrefix(year) } }
        if let month { out = out.filter { monthNumber($0.raw["date"].text) == month } }
        if type != "All" { out = out.filter { $0.raw["type"].text.lowercased() == type.lowercased() } }
        return out.enumerated().sorted { l, r in
            let a = l.element.raw["date"].text, b = r.element.raw["date"].text
            return a == b ? l.offset < r.offset : a > b
        }.map(\.element)
    }

    static func monthNumber(_ date: String) -> Int? {
        let p = date.split(separator: "-"); return p.count >= 2 ? Int(p[1]) : nil
    }

    /// `years`: "All" then each year with a transaction, newest first.
    static func years(_ a: JSONValue) -> [String] {
        let ys = Set(a["transactions"].array.map { String($0["date"].text.split(separator: "-").first ?? "") })
        return ["All"] + ys.sorted { (Int($0) ?? 0) > (Int($1) ?? 0) }
    }

    /// The four stat cards: totals follow the filter, lifetime interest never does.
    static func totals(_ a: JSONValue, shown: [Row]) -> Totals {
        var t = Totals()
        for r in a["transactions"].array where r["type"].text == "interest" { t.lifetimeInterest += r["amount"].double }
        for r in shown {
            let v = r.raw["amount"].double
            switch r.raw["type"].text {
            case "deposit": t.deposits += v
            case "interest": t.interest += v
            case "withdraw": t.withdrawals += v
            case "monnies_redeemed": t.monnies += v
            default: break
            }
        }
        return t
    }

    /// `interestSummary`: interest by year (newest first) and, inside each, by month in order of first appearance.
    static func earnings(_ a: JSONValue) -> [YearInterest] {
        var years: [String: YearInterest] = [:]
        for t in a["transactions"].array where t["type"].text == "interest" {
            let d = t["date"].text
            guard let y = d.split(separator: "-").first.map(String.init), let m = monthNumber(d), (1...12).contains(m) else { continue }
            var yi = years[y] ?? YearInterest(year: y, total: 0, months: [])
            yi.total += t["amount"].double
            let name = monthNames[m - 1]
            if let i = yi.months.firstIndex(where: { $0.name == name }) { yi.months[i].amount += t["amount"].double } else { yi.months.append((name, t["amount"].double)) }
            years[y] = yi
        }
        return years.values.sorted { (Int($0.year) ?? 0) > (Int($1.year) ?? 0) }
    }
}
