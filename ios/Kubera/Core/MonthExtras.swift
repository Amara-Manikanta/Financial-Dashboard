import Foundation

/// The rest of a month's page — a port of the `monthDetails` memo in `pages/ExpenseDetails.jsx` beyond categories and income:
/// the day-by-day spending velocity, the credit card summary (this month's spend, payments made, what carried forward from
/// earlier months, total due) and the wallets summary (each wallet's balance up to this month).
enum MonthExtras {
    struct Day: Identifiable, Equatable { let day: Int; let amount: Double; let cumulative: Double; var id: Int { day } }
    struct Card: Identifiable, Equatable {
        let name: String, spend: Double, carryForward: Double, payments: Double
        var due: Double { spend + carryForward - payments }
        var id: String { name }
    }
    struct Result: Equatable {
        var days: [Day] = []
        var cards: [Card] = []
        var totalCardSpend = 0.0
        var wallets: [(name: String, balance: Double)] = []
        static func == (a: Result, b: Result) -> Bool { a.days == b.days && a.cards == b.cards && a.totalCardSpend == b.totalCardSpend && a.wallets.map(\.name) == b.wallets.map(\.name) }
    }

    static let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    private static let notSpend: Set<String> = ["food wallet", "wallet load", "deposit", "income"]
    private static func n(_ v: JSONValue) -> Double { v.jsNumber.flatMap { $0.isNaN ? nil : $0 } ?? 0 }
    private static func isBill(_ t: JSONValue) -> Bool { let c = t["category"].text.lowercased(); return c == "credit card bill" || c == "credit card payment" }

    /// `new Date("March 1, 2026")` as a comparable month number; a numeric month ("03") works too.
    static func monthIndex(_ name: String, _ year: String) -> Int? {
        guard let y = Int(year.trimmingCharacters(in: .whitespaces)) else { return nil }
        let m = name.trimmingCharacters(in: .whitespaces)
        if let i = months.firstIndex(where: { $0.lowercased() == m.lowercased() || $0.prefix(3).lowercased() == m.lowercased() }) { return y * 12 + i }
        if let i = Int(m), (1...12).contains(i) { return y * 12 + i - 1 }
        return nil
    }

    static func compute(expenses: JSONValue, creditCards: JSONValue, year: String, month: String, grossSpent: Double) -> Result {
        var r = Result()
        guard let target = monthIndex(month, year) else { return r }
        let node = expenses[year][month]
        let cal = Calendar.current

        func isSalary(_ t: JSONValue) -> Bool {
            ["salary received", "salary"].contains(t["category"].text.lowercased()) || t["title"].text.lowercased().contains("salary")
        }
        // The page's statement order: salary last, newest date first, then as entered.
        let raw = node["transactions"].array.enumerated()
            .filter { $0.element["id"].truthy && ($0.element["amount"].truthy || $0.element["category"].truthy) }
            .sorted { a, b in
                let sa = isSalary(a.element), sb = isSalary(b.element)
                if sa != sb { return !sa }
                let ta = JSDate.parse(a.element["date"])?.timeIntervalSince1970 ?? 0, tb = JSDate.parse(b.element["date"])?.timeIntervalSince1970 ?? 0
                return ta != tb ? ta > tb : a.offset < b.offset
            }.map(\.element)

        // Spending velocity.
        let monthNumber = target % 12 + 1
        let days = cal.range(of: .day, in: .month, for: cal.date(from: DateComponents(year: target / 12, month: monthNumber, day: 1)) ?? Date())?.count ?? 30
        var byDay: [Int: Double] = [:]
        for t in raw where !t["isCredited"].truthy {
            let c = t["category"].text.lowercased()
            if c.contains("credit card bill") || c.contains("credit card payment") { continue }
            guard let d = JSDate.parse(t["date"]) else { continue }
            let comps = cal.dateComponents([.month, .day], from: d)
            let day = comps.month == monthNumber ? (comps.day ?? 1) : 1
            byDay[day, default: 0] += t["amount"].double
        }
        let txTotal = raw.filter { !$0["isCredited"].truthy }.reduce(0) { $0 + n($1["amount"]) }
        let unaccounted = max(0, grossSpent - txTotal)
        var running = 0.0
        r.days = (1...max(1, days)).map { d in
            var amount = byDay[d] ?? 0
            if d == 1 && unaccounted > 0 { amount += unaccounted }
            running += amount
            return Day(day: d, amount: amount.rounded(), cumulative: running.rounded())
        }

        // Cards and wallets.
        let cardsList = creditCards.array
        let walletNames = cardsList.filter { $0["type"].text == "wallet" }.map { $0["name"].text }
        let isWallet = { (name: String) in walletNames.contains { $0.trimmingCharacters(in: .whitespaces) == name.trimmingCharacters(in: .whitespaces) } }

        r.totalCardSpend = raw.filter { $0["paymentMode"].text == "credit_card" }.reduce(0) { sum, t in
            if isBill(t) { return sum }
            if t["isCredited"].truthy { return notSpend.contains(t["category"].text.lowercased()) ? sum : sum - n(t["amount"]) }
            return sum + n(t["amount"])
        }

        var spendOrder: [String] = [], spend: [String: Double] = [:], payments: [String: Double] = [:]
        for t in raw where t["paymentMode"].text == "credit_card" && t["creditCardName"].truthy {
            let card = t["creditCardName"].text
            if isWallet(card) || t["isRewardPoints"].truthy { continue }
            if isBill(t) { payments[card, default: 0] += n(t["amount"]); continue }
            if spend[card] == nil { spendOrder.append(card); spend[card] = 0 }
            if t["isCredited"].truthy { if !notSpend.contains(t["category"].text.lowercased()) { spend[card]! -= n(t["amount"]) } }
            else { spend[card]! += n(t["amount"]) }
        }

        var baseline: [String: Int] = [:]
        for c in cardsList where c["carryForwardBaseline"].truthy {
            let parts = c["carryForwardBaseline"].text.split(separator: "/").map(String.init)
            if parts.count == 2, let b = monthIndex(parts[0], parts[1]) { baseline[c["name"].text] = b }
        }
        var carry: [String: Double] = [:]
        var walletBalance: [String: Double] = Dictionary(uniqueKeysWithValues: walletNames.map { ($0, 0) })
        for (y, yData) in expenses.object {
            for (m, mData) in yData.object {
                guard let idx = monthIndex(m, y) else { continue }
                for t in mData["transactions"].array where t["paymentMode"].text == "credit_card" && t["creditCardName"].truthy {
                    let card = t["creditCardName"].text
                    if idx <= target, let w = walletNames.first(where: { $0.trimmingCharacters(in: .whitespaces) == card.trimmingCharacters(in: .whitespaces) }) {
                        walletBalance[w, default: 0] += t["isCredited"].truthy ? n(t["amount"]) : -n(t["amount"])
                    }
                    guard idx < target, !isWallet(card) else { continue }
                    if let b = baseline[card], idx < b { continue }
                    let amt = n(t["amount"])
                    if isBill(t) { carry[card, default: 0] -= amt; continue }
                    if t["isCredited"].truthy { if !notSpend.contains(t["category"].text.lowercased()) { carry[card, default: 0] -= amt } else { carry[card, default: 0] += 0 } }
                    else { carry[card, default: 0] += amt }
                }
            }
        }
        carry = carry.filter { abs($0.value) >= 1 }
        let names = spendOrder + carry.keys.filter { !spendOrder.contains($0) }.sorted()
        r.cards = names.map { Card(name: $0, spend: spend[$0] ?? 0, carryForward: carry[$0] ?? 0, payments: payments[$0] ?? 0) }
        r.wallets = walletNames.map { ($0, walletBalance[$0] ?? 0) }
        return r
    }
}
