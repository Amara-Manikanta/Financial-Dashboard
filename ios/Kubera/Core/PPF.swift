import Foundation

/// The PPF account page — a port of the logic in `pages/PPFDetails.jsx`: financial years, the
/// yearly interest chart, the "Add Interest" calculation, totals and the entry table.
/// Dates go through the same local-time reading the web page's `new Date(...)` does, so a
/// boundary day (the 5th of a month) lands on the same side on this phone as on the Mac.
enum PPF {
    /// The standard PPF rate the Mac page uses for "Add Interest".
    static let rate = 0.071

    struct Entry: Identifiable, Equatable {
        let index: Int            // position in the account's `details`, which an edit or delete refers to
        let raw: JSONValue
        let date: String
        let type: String
        let contribution: Double
        let interest: Double
        let balance: Double
        var id: Int { index }
    }

    struct YearAmount: Identifiable, Equatable { let year: String; let amount: Double; var id: String { year } }

    struct Page: Equatable {
        var balance = 0.0
        var totalInterest = 0.0
        var chart: [YearAmount] = []
        var years: [String] = ["All"]
    }

    /// `2026-04-01` … `2027-03-31` → `2026-27`.
    static func financialYear(_ date: JSONValue) -> String {
        guard let d = JSDate.parse(date) else { return "NaN-aN" }
        let c = Calendar.current.dateComponents([.year, .month], from: d)
        let year = c.year ?? 0, month = c.month ?? 0
        let two = { (y: Int) in String(format: "%02d", y % 100) }
        return month >= 4 ? "\(year)-\(two(year + 1))" : "\(year - 1)-\(two(year))"
    }

    /// Running balance of deposit plus interest, in date order (the web's `recalculateBalances`).
    static func balances(_ details: [JSONValue]) -> [Double] {
        var running = 0.0
        return details.enumerated().sorted { a, b in
            let x = JSDate.parse(a.element["date"])?.timeIntervalSince1970 ?? 0, y = JSDate.parse(b.element["date"])?.timeIntervalSince1970 ?? 0
            return x != y ? x < y : a.offset < b.offset
        }.map { running += $0.element["amount"].double + $0.element["interestEarned"].double; return running }
    }

    static func page(_ account: JSONValue) -> Page {
        let details = account["details"].array
        var p = Page()
        p.balance = balances(details).last ?? 0
        p.totalInterest = details.reduce(0) { $0 + $1["interestEarned"].double }
        var byYear: [String: Double] = [:]
        for d in details { byYear[financialYear(d["date"]), default: 0] += d["interestEarned"].double }
        p.chart = byYear.map { YearAmount(year: $0.key, amount: $0.value.rounded()) }.sorted { $0.year < $1.year }
        // "All" first, then the years newest first — the web sorts descending by text, where "All" sorts above digits.
        p.years = ["All"] + Set(details.map { financialYear($0["date"]) }).sorted(by: >)
        return p
    }

    /// The entries of one financial year (or all), newest first, each with the balance stored on its row.
    static func entries(_ account: JSONValue, year: String) -> [Entry] {
        account["details"].array.enumerated()
            .filter { year == "All" || financialYear($0.element["date"]) == year }
            .sorted { a, b in
                let x = JSDate.parse(a.element["date"])?.timeIntervalSince1970 ?? 0, y = JSDate.parse(b.element["date"])?.timeIntervalSince1970 ?? 0
                return x != y ? x > y : a.offset < b.offset
            }
            .map { Entry(index: $0.offset, raw: $0.element, date: $0.element["date"].text, type: $0.element["type"].text,
                         contribution: $0.element["amount"].double, interest: $0.element["interestEarned"].double, balance: $0.element["balance"].double) }
    }

    /// "Add Interest" for one financial year, as the Mac page works it out: each month, the balance on
    /// the 5th at the standard rate over twelve, rounded down, summed.
    static func yearlyInterest(fy: String, details: [JSONValue]) -> Double {
        guard let start = Int(fy.split(separator: "-").first ?? "") else { return 0 }
        let cal = Calendar.current
        var total = 0.0
        for m in 0..<12 {
            let month = (3 + m) % 12                       // April is 3 (zero-based, as in the page)
            let year = start + (m >= 9 ? 1 : 0)
            guard let cutoff = cal.date(from: DateComponents(year: year, month: month + 1, day: 5)) else { continue }
            let balance = details.reduce(0.0) { sum, d in
                guard let when = JSDate.parse(d["date"]), when <= cutoff else { return sum }
                return sum + d["amount"].double + d["interestEarned"].double
            }
            total += (balance * rate / 12).rounded(.down)
        }
        return total
    }

    /// The date an interest entry for `fy` is filed under: the last day of the year.
    static func interestDate(fy: String) -> String {
        let start = Int(fy.split(separator: "-").first ?? "") ?? 0
        return "\(start + 1)-03-31"
    }

    /// The financial years offered for "Add Interest": five back, this one and the next.
    static func offeredYears(now: Date = Date()) -> [String] {
        let year = Calendar.current.component(.year, from: now)
        return (-5...1).map { "\(year + $0)-\(String(format: "%02d", (year + $0 + 1) % 100))" }
    }

    /// The row to file for `fy`: the existing interest entry for that date updated in place, or a new one.
    /// Returns the change to apply to the account's `details`.
    static func interestChange(fy: String, details: [JSONValue], amount: Double, newId: String) -> AccountLedger.Change {
        let date = interestDate(fy: fy)
        if let i = details.firstIndex(where: { $0["type"].text == "interest" && $0["date"].text == date }) {
            var o = details[i].object
            o["date"] = .string(date); o["type"] = .string("interest"); o["amount"] = .number(0); o["interestEarned"] = .number(amount)
            return .replace(index: i, expected: details[i], .object(o))
        }
        return .add(.object(["id": .string(newId), "date": .string(date), "type": .string("interest"), "amount": .number(0), "interestEarned": .number(amount)]))
    }
}
