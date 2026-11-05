import Foundation

/// Deleting a whole loan, person, card or tax year from the phone. Each links to other records differently, so each has its own check:
/// - a **tax year** stands alone;
/// - a **person** can fund a goal (`fundingSources`), so a goal that uses them blocks the delete;
/// - a **card** is what thousands of expense rows and EMI payments name in `creditCardName`, so a card with any history is refused —
///   deleting it would leave that history pointing at nothing;
/// - a **loan** is deleted with its payments; the EMI expenses already logged stay in Expenses (the Mac does the same), and the
///   confirmation says so.
enum RecordDeletion {
    static let collections: Set<String> = ["taxes", "loans", "lents", "creditCards"]

    /// Why the record cannot be deleted here, or nil.
    static func block(collection: String, record: JSONValue, goals: JSONValue, expenses: JSONValue, loans: JSONValue) -> String? {
        let id = record["id"].text
        switch collection {
        case "lents":
            let used = goals.array.filter { $0["fundingSources"].array.contains { $0["category"].text == "lent" && $0["itemId"].text == id } }.map { $0["name"].text }
            if !used.isEmpty { return "The goal \(used.prefix(2).joined(separator: " and ")) is funded from this person. Change the goal first." }
        case "creditCards":
            let spend = Recurring.allTransactions(expenses).filter { Cards.matches($0["creditCardName"].text, record) }.count
            let emis = loans.array.flatMap { $0["payments"].array }.filter { Cards.matches($0["creditCardName"].text, record) }.count
            if spend + emis > 0 {
                return "\(spend + emis) transactions are logged against this card. Delete it on the Mac if you really mean to — that history would point at nothing."
            }
        default: break
        }
        return nil
    }

    /// What to tell the user before they confirm.
    static func warning(collection: String, record: JSONValue, expenses: JSONValue) -> String {
        switch collection {
        case "loans":
            let id = record["id"].text
            let logged = Recurring.allTransactions(expenses).filter { $0["emiOrderId"].text == id }.count
            let p = record["payments"].array.count
            return "This removes the loan and its \(p) recorded payment\(p == 1 ? "" : "s") from your Mac." + (logged > 0 ? " The \(logged) EMI expense\(logged == 1 ? "" : "s") already logged stay in Expenses." : "")
        case "lents": return "This removes the person and their \(record["transactions"].array.count) recorded transactions from your Mac."
        case "creditCards": return "This removes the card and its saved statement history from your Mac."
        default: return "This removes it from your Mac."
        }
    }
}
