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

/// Editing one transaction from the phone: only what changed is sent, and some rows are not
/// editable here at all.
enum EditTransaction {
    struct Draft: Equatable {
        var title: String, amount: String, category: String
        var date: Date
    }

    static func draft(from tx: JSONValue) -> Draft {
        Draft(title: tx["title"].text, amount: tx["amount"].text, category: tx["category"].text, date: JSDate.parse(tx["date"]) ?? Date())
    }

    /// Why this row cannot be changed from the phone, or nil when it can. Rows tied to a holding,
    /// without an id, or sharing an id with another row would be changed or removed wrongly.
    static func lockReason(_ tx: JSONValue, idCount: Int) -> String? {
        if tx["id"].text.isEmpty { return "This row has no id, so the Mac cannot be told which one to change." }
        if idCount > 1 { return "Another transaction has the same id, so a change here could hit the wrong one. Fix it on the Mac." }
        if tx["investmentData"].truthy || tx["expenseId"].truthy { return "This payment is linked to a holding. Change it on the Mac so the holding stays in step." }
        return nil
    }

    static func problems(_ d: Draft) -> [NewTransaction.Problem] {
        var out: [NewTransaction.Problem] = []
        if !(Double(d.amount.replacingOccurrences(of: ",", with: "")) ?? 0 > 0) { out.append(.amount) }
        if d.category.trimmingCharacters(in: .whitespaces).isEmpty { out.append(.category) }
        return out
    }

    /// Only the fields that differ. An empty result means there is nothing to save.
    static func patch(original tx: JSONValue, draft d: Draft, map: [(main: String, subs: [String])]) -> [String: Any] {
        var out: [String: Any] = [:]
        let title = d.title.trimmingCharacters(in: .whitespacesAndNewlines)
        if title != tx["title"].text { out["title"] = title }
        let amount = Double(d.amount.replacingOccurrences(of: ",", with: "")) ?? 0
        if amount != tx["amount"].double { out["amount"] = amount }
        let cat = d.category.trimmingCharacters(in: .whitespaces).lowercased()
        if cat != tx["category"].text.lowercased() {
            out["category"] = cat
            if let main = map.first(where: { $0.subs.contains { $0.lowercased() == cat } })?.main { out["mainCategory"] = main }
        }
        let day = NewTransaction.isoDay(d.date)
        if day != String(tx["date"].text.prefix(10)) { out["date"] = day }
        return out
    }
}
