import Foundation

/// The recurring-deposit account page — a port of the logic in `pages/RecurringDepositDetails.jsx`: the account
/// totals, the paid-vs-target chart, and for each deposit its progress through the term, days left, what has been
/// paid and earned, and whether it is matured or close to it. Dates are read the way the web page's `new Date(...)`
/// does and measured from the same instant, so the text on the phone and on the Mac agree.
enum RDPage {
    struct Card: Identifiable, Equatable {
        let id: String
        let raw: JSONValue
        let name: String
        let installment: Double
        let paid: Double
        let maturity: Double
        let interest: Double
        let tds: Double
        let progressPercent: Double      // of the term (by date) when it has an end date, otherwise of the maturity amount
        let daysText: String
        let matured: Bool
        let nearing: Bool                // within about two months of maturity
        let remarks: String?
        var remaining: Double { max(0, maturity - paid) }
        /// What the badge says: Matured, Maturing Soon, otherwise the deposit's own status.
        var badge: String { matured ? "Matured" : nearing ? "Maturing Soon" : (raw["status"].truthy ? raw["status"].text : "Active") }
    }

    struct ChartBar: Identifiable, Equatable { let name: String; let paid: Double; let maturity: Double; let rate: Double; var id: String { name } }

    struct Totals: Equatable {
        var installment = 0.0, maturity = 0.0, paid = 0.0, count = 0
        var progress: Double { maturity > 0 ? paid / maturity * 100 : 0 }
    }

    struct Page: Equatable { var totals = Totals(); var cards: [Card] = []; var chart: [ChartBar] = [] }

    private static func n(_ v: JSONValue) -> Double { v.jsNumber.flatMap { $0.isNaN ? nil : $0 } ?? 0 }
    private static func paid(_ rd: JSONValue) -> Double { rd["installments"].array.reduce(0) { $0 + n($1["amount"]) } }

    /// 0–100 through the term, by date.
    static func termProgress(start: JSONValue, end: JSONValue, now: Date) -> Double {
        guard start.truthy, end.truthy, let s = JSDate.parse(start)?.timeIntervalSince1970, let e = JSDate.parse(end)?.timeIntervalSince1970 else { return 0 }
        let t = now.timeIntervalSince1970
        if t >= e { return 100 }
        if t <= s { return 0 }
        return min(100, max(0, ((t - s) / (e - s) * 100).rounded()))
    }

    /// `12 days left`, `Maturing Today`, `Matured 5d ago`, or `Ongoing` with no end date.
    static func daysText(end: JSONValue, now: Date) -> String {
        guard end.truthy, let e = JSDate.parse(end)?.timeIntervalSince1970 else { return "Ongoing" }
        let today = Calendar.current.startOfDay(for: now).timeIntervalSince1970
        let diff = Int(ceil((e - today) / 86400))
        if diff < 0 { return "Matured \(abs(diff))d ago" }
        if diff == 0 { return "Maturing Today" }
        return "\(diff) days left"
    }

    static func card(_ rd: JSONValue, now: Date) -> Card {
        let maturityDate = rd["endDate"].truthy ? JSDate.parse(rd["endDate"]) : nil
        let matured = maturityDate.map { now >= $0 } ?? false
        let nearing = maturityDate.map { !matured && ($0.timeIntervalSince(now)) / (86400 * 30.44) <= 2 } ?? false
        let current = paid(rd)
        let interestRows = rd["interestTransactions"].array.reduce(0) { $0 + n($1["amount"]) }
        let tdsRows = rd["tdsTransactions"].array.reduce(0) { $0 + n($1["amount"]) }
        let maturity = n(rd["maturityAmount"])
        let remarks = rd["remarks"].truthy ? rd["remarks"].text : rd["installments"].array.first { $0["remarks"].truthy }?["remarks"].text
        return Card(id: rd["id"].text, raw: rd, name: rd["name"].text, installment: n(rd["installmentAmount"]), paid: current, maturity: maturity,
                    interest: interestRows != 0 ? interestRows : n(rd["interestEarned"]), tds: tdsRows != 0 ? tdsRows : n(rd["tds"]),
                    progressPercent: rd["endDate"].truthy ? termProgress(start: rd["startDate"], end: rd["endDate"], now: now) : (maturity > 0 ? current / maturity * 100 : 0),
                    daysText: daysText(end: rd["endDate"], now: now), matured: matured, nearing: nearing, remarks: remarks)
    }

    static func page(_ account: JSONValue, now: Date = Date()) -> Page {
        let rds = account["recurringDeposits"].array.filter { !$0.isNull }
        var p = Page()
        p.totals = Totals(installment: rds.reduce(0) { $0 + n($1["installmentAmount"]) }, maturity: rds.reduce(0) { $0 + n($1["maturityAmount"]) },
                          paid: rds.reduce(0) { $0 + paid($1) }, count: rds.count)
        p.chart = rds.map { ChartBar(name: $0["name"].text, paid: paid($0), maturity: n($0["maturityAmount"]), rate: n($0["interestRate"])) }
        // Soonest to mature first, as the page lists them; one with no end date keeps its place.
        p.cards = rds.enumerated().sorted { a, b in
            guard let x = JSDate.parse(a.element["endDate"])?.timeIntervalSince1970, let y = JSDate.parse(b.element["endDate"])?.timeIntervalSince1970, x != y else { return a.offset < b.offset }
            return x < y
        }.map { card($0.element, now: now) }
        return p
    }
}
