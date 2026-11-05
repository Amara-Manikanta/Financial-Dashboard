import Foundation

/// Adding and deleting grocery categories, items, brands and variants — the rules of `GroceryMasterList.jsx`: a name is trimmed, may not be empty
/// or repeat one already in that list (case-insensitively here, exactly there), and a list is kept sorted. All four lists are `[category: [name]]`.
enum GroceryEditing {
    enum Result: Equatable { case saved([String: [String]]), refused(String) }

    private static func sorted(_ a: [String]) -> [String] { a.sorted { Array($0.utf16).lexicographicallyPrecedes(Array($1.utf16)) } }

    static func adding(_ name: String, to category: String, in dict: [String: [String]], noun: String) -> Result {
        let n = name.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty else { return .refused("Enter a name.") }
        guard !category.isEmpty else { return .refused("Pick a category first.") }
        let list = dict[category] ?? []
        if list.contains(where: { $0.lowercased() == n.lowercased() }) { return .refused("That \(noun) already exists in \(category).") }
        var next = dict; next[category] = sorted(list + [n])
        return .saved(next)
    }

    static func removing(_ name: String, from category: String, in dict: [String: [String]]) -> [String: [String]] {
        var next = dict; next[category] = (dict[category] ?? []).filter { $0 != name }
        return next
    }

    static func addingCategory(_ name: String, to dict: [String: [String]]) -> Result {
        let n = name.trimmingCharacters(in: .whitespaces)
        guard !n.isEmpty else { return .refused("Enter a category name.") }
        if dict.keys.contains(where: { $0.lowercased() == n.lowercased() }) { return .refused("That category already exists.") }
        var next = dict; next[n] = []
        return .saved(next)
    }

    static func deletingCategory(_ name: String, from dict: [String: [String]]) -> [String: [String]] {
        var next = dict; next.removeValue(forKey: name); return next
    }
}
