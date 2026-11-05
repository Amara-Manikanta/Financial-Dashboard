import Foundation

/// Archiving, restoring and deleting a whole savings or investment account — the rules of the Mac's Savings page
/// (`handleArchiveClick`: flip `isArchived`; `confirmDelete`: remove the record), plus the checks the Mac does not make.
enum AccountManagement {
    /// Why an account cannot be deleted from the phone, or nil. Deleting removes every row inside it, and some things point at it:
    /// the stock account holds every holding, a goal can be funded from it, and rows logged from the Expenses page link back to it.
    static func deleteBlock(account: JSONValue, goals: JSONValue) -> String? {
        if account["type"].text == "stock_market" { return "This is your stock account — it holds every holding. Delete it on the Mac if you really mean to." }
        let id = account["id"].text
        let usedBy = goals.array.filter { $0["fundingSources"].array.contains { $0["itemId"].text == id } || $0["linkedAccountId"].text == id }.map { $0["name"].text }
        if !usedBy.isEmpty { return "The goal \(usedBy.prefix(2).joined(separator: " and ")) is funded from it. Change the goal first, or archive this account instead." }
        if containsExpenseLink(account) { return "Some of its rows were logged from the Expenses page. Delete it on the Mac so those expenses stay in step, or archive it here." }
        return nil
    }

    private static func containsExpenseLink(_ v: JSONValue) -> Bool {
        switch v {
        case .object(let o): return o["expenseId"]?.truthy == true || o["adoptedByExpense"]?.truthy == true || o["investmentData"]?.truthy == true || o.values.contains { containsExpenseLink($0) }
        case .array(let a): return a.contains { containsExpenseLink($0) }
        default: return false
        }
    }

    /// What archiving does: a fund's or policy's history is kept; it just leaves the main lists.
    static func archiveFields(_ archived: Bool) -> [String: Any] { ["isArchived": archived] }
}
