import Foundation

/// Adding a main category or a sub-category — `handleAddMainCategory` / `handleAddSubCategory` on the Mac's Budget Limits page. Only the
/// additions are stored (`appData.customCategoryMap`); the built-in map is merged with them by union, so this is the same result as the
/// Mac saving the whole merged map.
enum CategoryEditing {
    enum Result: Equatable { case saved([String: [String]]), refused(String) }

    /// `custom` is the stored `customCategoryMap`; `existing` the merged map in force (built-ins, additions, minus deletions).
    static func adding(main: String, sub: String?, custom: [String: [String]], existing: [(main: String, subs: [String])]) -> Result {
        let m = main.trimmingCharacters(in: .whitespaces)
        guard !m.isEmpty else { return .refused("Enter a category name.") }
        var next = custom
        guard let sub else {
            if existing.contains(where: { $0.main.lowercased() == m.lowercased() }) { return .refused("That main category already exists.") }
            next[m] = next[m] ?? []
            return .saved(next)
        }
        let s = sub.trimmingCharacters(in: .whitespaces)
        guard !s.isEmpty else { return .refused("Enter a sub-category name.") }
        let home = existing.first { $0.main == m }?.main ?? m
        if existing.first(where: { $0.main == home })?.subs.contains(where: { $0.lowercased() == s.lowercased() }) == true { return .refused("That sub-category already exists in \(home).") }
        next[home, default: []].append(s)
        return .saved(next)
    }
}
