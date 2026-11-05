import Foundation

/// The card's carry-forward baseline: the month from which the Mac counts what a card is owed, and the balance already owed at that point.
/// The rules of `handleSaveBaseline` in `SingleCreditCardDetails.jsx`.
enum CardBaseline {
    struct Draft: Equatable { var enabled = false; var month = "January"; var year = ""; var opening = "" }

    static func draft(from card: JSONValue) -> Draft {
        let parts = card["carryForwardBaseline"].text.split(separator: "/").map(String.init)
        guard parts.count == 2 else { return Draft(enabled: false, month: "January", year: String(Calendar.current.component(.year, from: Date())), opening: "") }
        let o = card["baselineOpeningBalance"].double
        return Draft(enabled: true, month: parts[0], year: parts[1], opening: o == 0 ? "" : RecordEditing.number(o))
    }

    static func problems(_ d: Draft) -> [String] {
        guard d.enabled else { return [] }
        var out: [String] = []
        if Int(d.year.trimmingCharacters(in: .whitespaces)) == nil { out.append("Enter the year.") }
        let t = d.opening.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")
        if !t.isEmpty && Double(t) == nil { out.append("Opening balance must be a number.") }
        return out
    }

    /// The fields to save. Turning it off clears both; a blank opening balance keeps the one already stored rather than wiping it.
    static func fields(_ d: Draft, card: JSONValue) -> [String: Any] {
        guard d.enabled else { return ["carryForwardBaseline": NSNull(), "baselineOpeningBalance": 0] }
        let t = d.opening.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")
        let opening = t.isEmpty ? card["baselineOpeningBalance"].double : (Double(t) ?? 0)
        return ["carryForwardBaseline": "\(d.month)/\(d.year.trimmingCharacters(in: .whitespaces))", "baselineOpeningBalance": opening]
    }
}
