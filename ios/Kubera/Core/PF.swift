import Foundation

/// The PF account page — a port of the logic in `pages/PFDetails.jsx`: the EPF and EPS balances, their
/// totals, the interest split and contribution charts, the financial-year tabs with their "something is
/// missing" flag, and the entry list for each scheme. Dates go through the same local-time reading the
/// web page's `new Date(...)` does, so a month or year boundary lands on the same side on both.
enum PF {
    enum Scheme: String { case epf = "EPF", eps = "EPS" }

    struct Totals: Equatable {
        var openingBalance = 0.0
        var epfBalance = 0.0, epsBalance = 0.0
        var epfInterest = 0.0, employee = 0.0, employer = 0.0, vpf = 0.0, eps = 0.0
        var combined: Double { epfBalance + epsBalance }
    }

    struct InterestYear: Identifiable, Equatable { let year: String; let employee: Double; let employer: Double; var id: String { year }; var total: Double { employee + employer } }
    struct AmountYear: Identifiable, Equatable { let year: String; let amount: Double; var id: String { year } }
    struct ContributionYear: Identifiable, Equatable {
        let year: String
        var employee = 0.0, employer = 0.0, eps = 0.0, vpf = 0.0, totalEmployer = 0.0, total = 0.0
        var id: String { year }
    }
    struct YearStatus: Equatable { let expected: Int, recorded: Int, missingMonths: [String], hasInterest: Bool, ongoing: Bool
        var missingCount: Int { missingMonths.count }
        /// The red dot on a year's tab: a month with no contribution or no interest filed.
        var warns: Bool { missingCount > 0 || !hasInterest }
    }

    struct Entry: Identifiable, Equatable {
        let index: Int            // position in the account's `details`, which an edit or delete refers to
        let raw: JSONValue
        let date: String
        let isInterest: Bool
        let amount: Double        // what the active scheme's tab shows
        var id: Int { index }
    }

    struct Page: Equatable {
        var totals = Totals()
        var years: [String] = ["All"]
        var epfChart: [InterestYear] = []
        var epsChart: [AmountYear] = []
        var trend: [ContributionYear] = []
        var status: [String: YearStatus] = [:]
    }

    private static func n(_ v: JSONValue) -> Double { v.jsNumber.flatMap { $0.isNaN ? nil : $0 } ?? 0 }
    private static func ts(_ v: JSONValue) -> Double { JSDate.parse(v)?.timeIntervalSince1970 ?? 0 }

    static func financialYear(_ date: JSONValue) -> String { PPF.financialYear(date) }

    private static func epfAmount(_ d: JSONValue) -> Double { n(d["employeeContribution"]) + n(d["employerContribution"]) + n(d["vpfContribution"]) + n(d["interestEarned"]) }
    private static func isInterest(_ d: JSONValue) -> Bool { d["type"].text == "Interest" }

    /// Whether a row appears on a scheme's tab: EPF takes contributions and interest, EPS only pension contributions.
    static func belongs(_ d: JSONValue, to scheme: Scheme) -> Bool {
        switch scheme {
        case .epf: return n(d["employeeContribution"]) > 0 || n(d["employerContribution"]) > 0 || n(d["vpfContribution"]) > 0 || n(d["interestEarned"]) > 0 || isInterest(d)
        case .eps: return n(d["epsContribution"]) > 0
        }
    }

    static func page(_ account: JSONValue, now: Date = Date()) -> Page {
        let details = account["details"].array
        var p = Page()
        let opening = n(account["amount"])
        p.totals.openingBalance = opening
        let balances = AccountLedger.pfBalances(details, opening: opening)
        p.totals.epfBalance = balances.last?["epfBalance"].double ?? opening
        p.totals.epsBalance = balances.last?["epsBalance"].double ?? 0
        for d in details {
            p.totals.epfInterest += n(d["interestEarned"]); p.totals.employee += n(d["employeeContribution"]); p.totals.employer += n(d["employerContribution"])
            p.totals.vpf += n(d["vpfContribution"]); p.totals.eps += n(d["epsContribution"])
        }
        p.years = ["All"] + Set(details.map { financialYear($0["date"]) }).sorted(by: >)

        // Interest by financial year: the employee/employer split when the row carries one, otherwise all of it to the employee.
        var split: [String: (emp: Double, emr: Double)] = [:]
        for d in details where isInterest(d) || n(d["interestEarned"]) > 0 {
            let fy = financialYear(d["date"])
            var s = split[fy] ?? (0, 0)
            if d.object["employeeInterestEarned"] != nil || d.object["employerInterestEarned"] != nil {
                s.emp += n(d["employeeInterestEarned"]); s.emr += n(d["employerInterestEarned"])
            } else { s.emp += n(d["interestEarned"]) }
            split[fy] = s
        }
        p.epfChart = split.map { InterestYear(year: $0.key, employee: $0.value.emp, employer: $0.value.emr) }.sorted { $0.year < $1.year }

        var eps: [String: Double] = [:]
        for d in details where n(d["epsContribution"]) > 0 { eps[financialYear(d["date"]), default: 0] += n(d["epsContribution"]) }
        p.epsChart = eps.map { AmountYear(year: $0.key, amount: $0.value) }.sorted { $0.year < $1.year }

        var grouped: [String: ContributionYear] = [:]
        for d in details where !isInterest(d) {
            let fy = financialYear(d["date"])
            var g = grouped[fy] ?? ContributionYear(year: fy)
            let emp = n(d["employeeContribution"]), emr = n(d["employerContribution"]), e = n(d["epsContribution"]), v = n(d["vpfContribution"])
            g.employee += emp; g.employer += emr; g.eps += e; g.vpf += v; g.totalEmployer += emr + e; g.total += emp + emr + e + v
            grouped[fy] = g
        }
        p.trend = grouped.values.sorted { $0.year < $1.year }
        p.status = yearStatus(details, now: now)
        return p
    }

    /// The entries of a scheme's tab for one financial year (or all), newest first.
    static func entries(_ account: JSONValue, scheme: Scheme, year: String) -> [Entry] {
        account["details"].array.enumerated()
            .filter { belongs($0.element, to: scheme) && (year == "All" || financialYear($0.element["date"]) == year) }
            .sorted { a, b in ts(a.element["date"]) != ts(b.element["date"]) ? ts(a.element["date"]) > ts(b.element["date"]) : a.offset < b.offset }
            .map { Entry(index: $0.offset, raw: $0.element, date: $0.element["date"].text, isInterest: isInterest($0.element),
                         amount: scheme == .epf ? epfAmount($0.element) : n($0.element["epsContribution"])) }
    }

    /// For each financial year on record plus the current one: how many months up to today have no contribution
    /// recorded, and whether any interest was filed.
    static func yearStatus(_ details: [JSONValue], now: Date) -> [String: YearStatus] {
        let cal = Calendar.current
        let currentYear = cal.component(.year, from: now), currentMonth = cal.component(.month, from: now)
        let currentFY = currentMonth >= 4 ? "\(currentYear)-\(String(format: "%02d", (currentYear + 1) % 100))" : "\(currentYear - 1)-\(String(format: "%02d", currentYear % 100))"
        let monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        var out: [String: YearStatus] = [:]
        for fy in Set(details.map { financialYear($0["date"]) } + [currentFY]) {
            guard fy.count >= 7, let start = Int(fy.split(separator: "-").first ?? "") else { continue }
            let expected = (4...12).map { (start, $0) } + (1...3).map { (start + 1, $0) }
            let checkable = expected.filter { $0.0 < currentYear || ($0.0 == currentYear && $0.1 <= currentMonth) }
            var have = Set<String>()
            for tx in details where financialYear(tx["date"]) == fy && !isInterest(tx)
                && (n(tx["employeeContribution"]) > 0 || n(tx["employerContribution"]) > 0 || n(tx["epsContribution"]) > 0 || n(tx["vpfContribution"]) > 0) {
                if let d = JSDate.parse(tx["date"]) { let c = cal.dateComponents([.year, .month], from: d); have.insert("\(c.year ?? 0)-\(c.month ?? 0)") }
            }
            let missing = checkable.filter { !have.contains("\($0.0)-\($0.1)") }
            let hasInterest = details.contains { financialYear($0["date"]) == fy && (isInterest($0) || n($0["interestEarned"]) > 0) }
            out[fy] = YearStatus(expected: checkable.count, recorded: checkable.count - missing.count,
                                 missingMonths: missing.map { "\(monthNames[$0.1 - 1]) \($0.0)" }, hasInterest: hasInterest, ongoing: fy == currentFY)
        }
        return out
    }
}
