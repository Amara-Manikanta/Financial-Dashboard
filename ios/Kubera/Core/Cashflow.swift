import Foundation

/// What is already committed over the coming weeks — a port of `utils/cashflow.js`.
/// It deliberately does not predict a bank balance (there is none in the database) and does
/// not double count: a charge billed to a card sits inside that card's bill.
enum Cashflow {
    struct Include: Equatable { let label: String; let amount: Double; var isEmi = false }
    struct Event: Identifiable, Equatable {
        var id: String { "\(date)-\(kind)-\(label)-\(amount.map { String($0) } ?? "nil")" }
        let date: String, kind: String, label: String
        let amount: Double?
        let detail: String
        var includes: [Include] = []
    }
    struct Cycle: Identifiable, Equatable { var id: String { "\(from)-\(to)" }; let from: String, to: String; let income: Double, committed: Double; let unknown: Int; let events: [Event] }
    struct Forecast: Equatable { var events: [Event] = [], cycles: [Cycle] = []; var monthlyCommitted = 0.0, salaryAmount = 0.0 }

    private static func lastDay(_ y: Int, _ m0: Int) -> Int {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "UTC")!
        let first = cal.date(from: DateComponents(year: y, month: m0 + 1, day: 1))!
        return cal.range(of: .day, in: .month, for: first)?.count ?? 30
    }
    private static func date(_ y: Int, _ m0: Int, _ d: Int) -> Int { Recurring.ordinal(String(format: "%04d-%02d-%02d", y + m0 / 12, m0 % 12 + 1, d)) }

    /// Each occurrence of a day-of-month on or after `from` (a day number), a 31st landing on a month's last day.
    static func nextOnDay(from: Int, dayOfMonth: Int, limit: Int?) -> [Int] {
        var out: [Int] = []
        if dayOfMonth == 0 { return out }
        let parts = Recurring.fromOrdinal(from).split(separator: "-").compactMap { Int($0) }
        var y = parts[0], m = parts[1] - 1
        var i = 0
        while i < 24 && out.count < 24 {
            let day = min(dayOfMonth, lastDay(y, m))
            let when = date(y, m, day)
            if when >= from && (limit == nil || when <= limit!) { out.append(when) }
            if let limit, when > limit { break }
            m += 1
            if m > 11 { m = 0; y += 1 }
            i += 1
        }
        return out
    }

    static func cardOutstanding(_ expenses: JSONValue, _ cardName: String) -> Double {
        var total = 0.0
        for t in Recurring.allTransactions(expenses) where t["paymentMode"].text == "credit_card" && t["creditCardName"].text.trimmingCharacters(in: .whitespaces) == cardName {
            let amount = abs(t["amount"].double), cat = t["category"].text.lowercased()
            let isPayment = cat == "credit card bill" || cat == "credit card payment"
            if isPayment || t["isCredited"].truthy || t["transactionType"].text == "credit" { total -= amount } else { total += amount }
        }
        return total
    }

    static func build(expenses: JSONValue, creditCards: JSONValue, loans: JSONValue, overrides: JSONValue, asOf: Date = Date(), days: Int = 90) -> Forecast {
        let start = Recurring.ordinal(Recurring.isoDay(asOf)), end = start + days
        func iso(_ n: Int) -> String { Recurring.fromOrdinal(n) }
        let series = Recurring.applyOverrides(Recurring.detect(expenses, asOf: asOf), overrides).filter { $0.status == "active" }
        let cards = creditCards.array.filter { !$0.isNull }
        let cardNames = cards.filter { $0["type"].text != "wallet" }.map { $0["name"].text }
        var events: [Event] = []
        var f = Forecast()

        // Income: the day salary has actually been landing, and what it usually is.
        struct Credit { let day: Int; let amount: Double; let date: String }
        var credits: [Credit] = []
        for t in Recurring.allTransactions(expenses) where t["isCredited"].truthy || t["transactionType"].text == "credit" {
            if !"\(t["category"].text) \(t["title"].text)".lowercased().contains("salary") { continue }
            let d = String(t["date"].text.prefix(10))
            if d.count == 10 { credits.append(Credit(day: Int(d.suffix(2)) ?? 0, amount: abs(t["amount"].double), date: d)) }
        }
        credits = credits.enumerated().sorted { $0.element.date != $1.element.date ? $0.element.date < $1.element.date : $0.offset < $1.offset }.map(\.element)
        let recent = Array(credits.suffix(6))
        if !recent.isEmpty {
            var counts: [Int: Int] = [:]
            recent.forEach { counts[$0.day, default: 0] += 1 }
            let usual = counts.keys.sorted().reduce(into: (day: 0, n: -1)) { best, d in if counts[d]! > best.n { best = (d, counts[d]!) } }.day
            f.salaryAmount = Money.jsRound(recent.reduce(0) { $0 + $1.amount } / Double(recent.count))
            for when in nextOnDay(from: start, dayOfMonth: usual, limit: end) {
                events.append(Event(date: iso(when), kind: "income", label: "Salary", amount: f.salaryAmount, detail: "usually lands on the \(usual)"))
            }
        }

        let gadgets = loans.array.filter { $0["type"].text == "gadget" }
        var emiCard: [String: String?] = [:]
        for l in gadgets { emiCard[l["id"].text] = Recurring.cardForOrder(l, cards).map { $0["name"].text } }

        for name in cardNames {
            guard let card = cards.first(where: { $0["name"].text == name }), card["billingDay"].truthy else { continue }
            let outstanding = cardOutstanding(expenses, name)
            let onThis = series.filter { s in let c = s.cards; return !c.isEmpty && Double(c.filter { $0 == name }.count) >= Double(c.count) / 2 }
            let emis = gadgets.filter { (emiCard[$0["id"].text] ?? nil) == name }
            for (i, when) in nextOnDay(from: start, dayOfMonth: Int(card["billingDay"].double), limit: end).enumerated() {
                let declared = emis.map { Include(label: $0["name"].text, amount: $0["emiAmount"].double, isEmi: true) }
                let detected = onThis.filter { x in !emis.contains { l in let emi = l["emiAmount"].double; return emi > 0 && abs(x.typical - emi) <= emi * 0.08 } }
                    .map { Include(label: $0.label, amount: $0.typical) }
                events.append(Event(date: iso(when), kind: "card-bill", label: "\(name) bill", amount: i == 0 ? max(0, outstanding) : nil,
                                    detail: i == 0 ? "current outstanding — will change as you spend" : "amount not yet known", includes: declared + detected))
            }
        }

        for l in gadgets where (emiCard[l["id"].text] ?? nil) == nil {
            let startDate = l["startDate"].text
            if startDate.isEmpty { continue }
            let anchor = Int(startDate.dropFirst(8).prefix(2)) ?? 0
            let tenure = Int(l["tenureMonths"].double)
            let y = Int(startDate.prefix(4)) ?? 0, m = (Int(startDate.dropFirst(5).prefix(2)) ?? 1) - 1 + tenure
            let endOfPlan = date(y, m, anchor)
            for when in nextOnDay(from: start, dayOfMonth: anchor, limit: min(end, endOfPlan)) {
                events.append(Event(date: iso(when), kind: "emi", label: l["name"].text, amount: l["emiAmount"].double, detail: "\(l["lender"].text) · \(tenure) month plan"))
            }
        }

        for s in series {
            if s.mostlyOnCard { continue }
            if s.kind.lowercased().range(of: "emi|loan", options: .regularExpression) != nil { continue }
            // A fractional median gap (30.5 days) moves the time of day, which decides the date.
            let day = 86_400_000.0, endMs = Double(end) * day, startMs = Double(start) * day
            var when = Double(Recurring.ordinal(s.nextExpected)) * day, guardCount = 0
            while when <= endMs && guardCount < 40 {
                if when >= startMs { events.append(Event(date: iso(Int((when / day).rounded(.down))), kind: "recurring", label: s.label, amount: s.typical, detail: "\(s.cadence.lowercased()) · paid directly")) }
                when += s.medianGap * day
                guardCount += 1
            }
        }
        events = events.enumerated().sorted { a, b in
            if a.element.date != b.element.date { return a.element.date < b.element.date }
            if a.element.kind != b.element.kind { return a.element.kind < b.element.kind }
            return a.offset < b.offset
        }.map(\.element)
        f.events = events

        var bounds = [iso(start)] + events.filter { $0.kind == "income" }.map(\.date) + [iso(end)]
        var seen = Set<String>(); bounds = bounds.filter { seen.insert($0).inserted }.sorted()
        for i in 0..<(bounds.count - 1) {
            let from = bounds[i], to = bounds[i + 1]
            let inCycle = events.filter { $0.date >= from && $0.date < to }
            if inCycle.isEmpty { continue }
            f.cycles.append(Cycle(from: from, to: to, income: inCycle.filter { $0.kind == "income" }.reduce(0) { $0 + ($1.amount ?? 0) },
                                  committed: inCycle.filter { $0.kind != "income" }.reduce(0) { $0 + ($1.amount ?? 0) },
                                  unknown: inCycle.filter { $0.kind != "income" && $0.amount == nil }.count, events: inCycle))
        }
        f.monthlyCommitted = series.filter { !$0.mostlyOnCard }.reduce(0) { $0 + $1.annualRunRate / 12 } + gadgets.reduce(0) { $0 + $1["emiAmount"].double }
        return f
    }
}
