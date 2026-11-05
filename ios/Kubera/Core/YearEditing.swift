import Foundation

/// Initialising a new expense year, as `Expenses.jsx` `handleAddYear` and `addNewYear` do: a year between 2000 and 2100 that does not
/// exist yet, holding all twelve months, each with every category at 0 and no transactions.
enum YearEditing {
    static let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

    /// The year typed, or why it is not acceptable.
    static func validate(_ text: String, existing: Set<String>) -> (year: String?, problem: String?) {
        guard let n = Int(text.trimmingCharacters(in: .whitespaces)), n >= 2000, n <= 2100 else { return (nil, "Please enter a valid year between 2000 and 2100") }
        if existing.contains(String(n)) { return (nil, "Year \(n) already exists.") }
        return (String(n), nil)
    }

    /// The twelve months of the new year. `categories` is the list the Mac keeps in `appData.categories`.
    static func newYear(categories: [String]) -> [String: Any] {
        var out: [String: Any] = [:]
        for m in months {
            var cats: [String: Any] = [:]
            for c in categories { cats[c] = 0 }
            out[m] = ["categories": cats, "transactions": [Any]()]
        }
        return out
    }
}
