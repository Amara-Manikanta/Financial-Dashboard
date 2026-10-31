import Foundation

/// A transaction entered on the phone, shaped exactly like one the Mac's form creates
/// (`addItem` in FinanceContext): a 13-digit millisecond id, the main category looked up from
/// the sub-category, and `deductFromSalary` on. It is sent as ONE row to `POST /api/tx`, so it
/// can never overwrite rows this phone has not loaded.
enum NewTransaction {
    struct Draft: Equatable {
        var title = ""
        var amount = ""
        var date = Date()
        var category = ""
        var received = false
        var onCard = false
        var card = ""
    }

    enum Problem: Equatable { case amount, category, card, date }

    static func problems(_ d: Draft) -> [Problem] {
        var out: [Problem] = []
        if !(Double(d.amount.replacingOccurrences(of: ",", with: "")) ?? 0 > 0) { out.append(.amount) }
        if d.category.trimmingCharacters(in: .whitespaces).isEmpty { out.append(.category) }
        if d.onCard && d.card.isEmpty { out.append(.card) }
        if d.date > Date().addingTimeInterval(86_400) { out.append(.date) }
        return out
    }

    static func isoDay(_ d: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func body(_ d: Draft, map: [(main: String, subs: [String])], now: Date = Date()) -> [String: Any] {
        let cat = d.category.trimmingCharacters(in: .whitespaces)
        let main = map.first { $0.subs.contains { $0.lowercased() == cat.lowercased() } }?.main
        var tx: [String: Any] = [
            "id": String(Int64(now.timeIntervalSince1970 * 1000)),
            "title": d.title.trimmingCharacters(in: .whitespacesAndNewlines),
            "amount": Double(d.amount.replacingOccurrences(of: ",", with: "")) ?? 0,
            "category": cat.lowercased(),
            "date": isoDay(d.date),
            "deductFromSalary": true,
            "paymentMode": d.onCard ? "credit_card" : "direct",
            "creditCardName": d.onCard ? d.card : NSNull(),
            "isRewardPoints": false,
            "isCredited": d.received,
            "transactionType": d.received ? "credit" : "debit",
            "type": "monthly",
            "investmentData": NSNull(),
        ]
        if let main { tx["mainCategory"] = main }
        return ["transaction": tx]
    }
}
