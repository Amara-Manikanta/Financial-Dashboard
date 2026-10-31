import Foundation

/// Repeating charges found in the transaction history — a port of `utils/recurring.js` and
/// the card-matching half of `utils/emiOrders.js`. Deterministic by design: dates and
/// amounts only, so a wrong grouping can be traced to a rule rather than a guess.
enum Recurring {
    private static let monthWords = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december"
    private static let noiseWords = "\\b(in|us|uk|pvt|ltd|limited|india|payment|payments|paid|recd|received|purchase|purchases|log|import|txn|ref|bank|okhdfcbank|paytm|upi|gpay|phonepe|razorpay|billdesk|new|delhi|gurgaon|kakinada|mumbai|hyderabad|bangalore|bengaluru|chennai|pune|noida|www|com|http|https|the|and|for)\\b"
    private static let tooGeneric: Set<String> = ["auto", "share", "return", "fuel", "cash", "amount", "behalf", "transfer", "credit", "debit", "bill", "misc", "other", "others", "self", "test"]

    private static func sub(_ s: String, _ pattern: String, _ with: String = " ") -> String {
        s.replacingOccurrences(of: pattern, with: with, options: .regularExpression)
    }

    static func normaliseMerchant(_ raw: String) -> String {
        var s = raw.lowercased()
        s = sub(s, "https?://\\S+|www\\.\\S+")
        s = sub(s, "\\b\\d{4,}\\b")
        s = sub(s, "\\b(x{2,}|\\d+)\\b")
        s = sub(s, "[^a-z ]")
        s = sub(s, "\\b(\(monthWords))\\b")
        s = sub(s, noiseWords)
        let tokens = s.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        return String(tokens.prefix(2).joined(separator: " ").prefix(24))
    }

    struct Cadence { let name: String; let days: Double; let tolerance: Double; let perYear: Double }
    static let cadences = [Cadence(name: "Weekly", days: 7, tolerance: 3, perYear: 52), Cadence(name: "Monthly", days: 30, tolerance: 8, perYear: 12),
                           Cadence(name: "Quarterly", days: 91, tolerance: 18, perYear: 4), Cadence(name: "Half-yearly", days: 182, tolerance: 25, perYear: 2),
                           Cadence(name: "Yearly", days: 365, tolerance: 45, perYear: 1)]

    static func ordinal(_ iso: String) -> Int {
        let p = iso.split(separator: "-").compactMap { Int($0) }
        guard p.count >= 3 else { return 0 }
        var c = DateComponents(); c.year = p[0]; c.month = p[1]; c.day = p[2]
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "UTC")!
        let d = cal.date(from: c) ?? Date(timeIntervalSince1970: 0)
        return Int((d.timeIntervalSince1970 / 86400).rounded(.down))
    }
    static func fromOrdinal(_ n: Int) -> String {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "UTC")!
        let c = cal.dateComponents([.year, .month, .day], from: Date(timeIntervalSince1970: Double(n) * 86400))
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
    static func isoDay(_ d: Date) -> String { fromOrdinal(Int((d.timeIntervalSince1970 / 86400).rounded(.down))) }

    private static func median(_ nums: [Double]) -> Double {
        let s = nums.sorted(), mid = s.count / 2
        return s.count % 2 == 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
    }

    private static func classify(_ name: String, _ categories: [String]) -> String {
        let hay = "\(name) \(categories.joined(separator: " "))"
        func has(_ p: String) -> Bool { hay.range(of: p, options: .regularExpression) != nil }
        if has("emi|loan|principal|amortization|amortisation") { return "Loan / EMI" }
        if has("transfer|person|lent|sent to|behalf") { return "Transfer" }
        if has("insurance|premium|policy") { return "Insurance" }
        return "Subscription"
    }

    struct Event: Equatable { let date: String; let amount: Double; let category: String; let title: String; let card: String? }

    struct Series: Identifiable, Equatable {
        var id: String { key }
        let key: String, label: String, kind: String, cadence: String
        let perYear: Double, medianGap: Double
        let count: Int
        let typical: Double, min: Double, max: Double
        let first: String, last: String, nextExpected: String
        var active: Bool
        let total: Double, annualRunRate: Double, firstAmount: Double, lastAmount: Double, priceChangePct: Double
        let events: [Event]
        // From `applyOverrides`
        var status = "active"
        var overridden = false
        var overrideStatus: String?
        var markedOn: String?
        var note = ""
        var chargedAfterCancel = false
        /// Every card the charges were made on, or none.
        var cards: [String] { events.compactMap(\.card) }
        var mostlyOnCard: Bool { !cards.isEmpty && Double(cards.count) >= Double(events.count) / 2 }
    }

    /// The expense tree's transactions in the order the web code walks it: years ascending,
    /// then months (calendar order — the file's own order is not kept), then the array.
    static func allTransactions(_ expenses: JSONValue) -> [JSONValue] {
        let monthOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        var out: [JSONValue] = []
        for (_, months) in expenses.object.sorted(by: { (Int($0.key) ?? 0) < (Int($1.key) ?? 0) }) {
            let nodes = months.object.sorted { (monthOrder.firstIndex(of: $0.key) ?? 99) < (monthOrder.firstIndex(of: $1.key) ?? 99) }
            for (_, node) in nodes { out += node["transactions"].array }
        }
        return out
    }

    static func detect(_ expenses: JSONValue, asOf: Date = Date()) -> [Series] {
        var order: [String] = []
        var groups: [String: [Event]] = [:]
        for t in allTransactions(expenses) where !t.isNull {
            if t["isCredited"].truthy || t["transactionType"].text == "credit" { continue }
            let title = t["title"].text.trimmingCharacters(in: .whitespacesAndNewlines)
            let date = String(t["date"].text.prefix(10))
            let amount = t["amount"].double
            if title.isEmpty || date.count != 10 || !(amount > 0) { continue }
            let key = normaliseMerchant(title)
            if key.count < 4 || tooGeneric.contains(key) { continue }
            if groups[key] == nil { order.append(key); groups[key] = [] }
            let card: String? = t["paymentMode"].text == "credit_card" ? (t["creditCardName"].text.trimmingCharacters(in: .whitespaces).isEmpty ? nil : t["creditCardName"].text.trimmingCharacters(in: .whitespaces)) : nil
            groups[key]!.append(Event(date: date, amount: amount, category: t["category"].text.lowercased(), title: title, card: card))
        }

        let todayOrd = ordinal(isoDay(asOf))
        var series: [Series] = []
        for key in order {
            var seen = Set<String>(), unique: [Event] = []
            for r in groups[key]! where !seen.contains(r.date) { seen.insert(r.date); unique.append(r) }
            let events = unique.enumerated().sorted { $0.element.date != $1.element.date ? $0.element.date < $1.element.date : $0.offset < $1.offset }.map(\.element)
            if events.count < 3 { continue }
            let ords = events.map { ordinal($0.date) }
            var segment = 0
            for i in 1..<ords.count where ords[i] - ords[i - 1] > 180 { segment = i }
            let evalEvents = events.count - segment >= 3 ? Array(events[segment...]) : events
            let evalOrds = evalEvents.map { ordinal($0.date) }
            var gaps: [Double] = []
            for i in 1..<evalOrds.count { let g = evalOrds[i] - evalOrds[i - 1]; if g > 0 { gaps.append(Double(g)) } }
            if gaps.count < 2 { continue }
            let medianGap = median(gaps)
            guard let cadence = cadences.first(where: { abs(medianGap - $0.days) <= $0.tolerance }) else { continue }
            let amounts = evalEvents.map(\.amount)
            let typical = median(amounts)
            if typical <= 0 { continue }
            let near = amounts.filter { abs($0 - typical) <= Swift.max(100, 0.25 * typical) }
            if Double(near.count) / Double(amounts.count) < 0.5 { continue }
            let lastOrd = evalOrds.last!
            let active = Double(todayOrd - lastOrd) < Swift.max(medianGap * 2.5, 60)
            let all = events.map(\.amount)
            let firstAmount = events[0].amount, lastAmount = events.last!.amount
            series.append(Series(key: key, label: events.last!.title, kind: classify(key, events.map(\.category)), cadence: cadence.name,
                                 perYear: cadence.perYear, medianGap: medianGap, count: events.count, typical: typical,
                                 min: all.min()!, max: all.max()!, first: events[0].date, last: events.last!.date,
                                 nextExpected: fromOrdinal(lastOrd + Int(Money.jsRound(medianGap))), active: active, total: all.reduce(0, +),
                                 annualRunRate: typical * cadence.perYear, firstAmount: firstAmount, lastAmount: lastAmount,
                                 priceChangePct: firstAmount > 0 ? (lastAmount - firstAmount) / firstAmount * 100 : 0, events: events))
        }
        return series.enumerated().sorted { a, b in
            if a.element.active != b.element.active { return a.element.active }
            if a.element.annualRunRate != b.element.annualRunRate { return a.element.annualRunRate > b.element.annualRunRate }
            return a.offset < b.offset
        }.map(\.element)
    }

    /// Your own status layered over what detection found. It never rewrites history: a charge
    /// after you marked something cancelled is surfaced as `chargedAfterCancel`.
    static func applyOverrides(_ series: [Series], _ overrides: JSONValue) -> [Series] {
        series.map { s in
            var s = s
            let o = overrides[s.key]
            if o.isNull || !o["status"].truthy { s.overridden = false; s.status = s.active ? "active" : "stopped"; return s }
            let marked = o["markedOn"].text
            s.chargedAfterCancel = o["status"].text == "cancelled" && !marked.isEmpty && s.last > marked
            var status = o["status"].text
            if status == "cancelled" { status = "stopped" }
            if status == "watching" { status = "active" }
            s.overridden = true; s.overrideStatus = o["status"].text; s.markedOn = marked.isEmpty ? nil : marked; s.note = o["note"].text
            s.status = o["status"].text == "ignored" ? "ignored" : status
            s.active = status == "active"
            return s
        }
    }

    // MARK: Gadget EMI orders and the card they bill to (emiOrders.js)

    private static let noise: Set<String> = ["credit", "card", "the", "bank", "pay", "rupay", "visa", "mastercard"]
    private static func tokens(_ v: String) -> [String] {
        v.lowercased().split(whereSeparator: { !($0.isLetter && $0.isASCII) && !($0.isNumber && $0.isASCII) }).map(String.init).filter { $0.count > 1 }
    }

    static func lenderMatchesCard(_ lender: String, _ card: JSONValue) -> Int {
        if lender.isEmpty || card.isNull { return 0 }
        let want = tokens(lender).filter { !noise.contains($0) }
        if want.isEmpty { return 0 }
        let names = tokens(card["name"].text).filter { !noise.contains($0) }, banks = tokens(card["bankName"].text).filter { !noise.contains($0) }
        var score = 0
        for t in want {
            if names.contains(where: { $0.hasPrefix(t) || t.hasPrefix($0) }) { score += 2 }
            else if banks.contains(where: { $0.hasPrefix(t) || t.hasPrefix($0) }) { score += 1 }
        }
        return score
    }

    static func cardForOrder(_ order: JSONValue, _ cards: [JSONValue]) -> JSONValue? {
        var best: JSONValue?, bestScore = 0
        for c in cards { let s = lenderMatchesCard(order["lender"].text, c); if s > bestScore { bestScore = s; best = c } }
        return bestScore > 0 ? best : nil
    }
}
