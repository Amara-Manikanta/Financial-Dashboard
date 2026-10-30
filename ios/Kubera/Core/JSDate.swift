import Foundation

/// JavaScript's `new Date(string)` for the shapes this database stores, because
/// the formulas being ported are written against it: a bare `2026-05-10` is
/// midnight UTC, and the month an instant falls in is read in local time.
enum JSDate {
    private static let dateOnly: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withFullDate]; f.timeZone = TimeZone(identifier: "UTC"); return f
    }()
    private static let zoned: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f
    }()
    private static let zonedNoFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f
    }()

    static func parse(_ text: String) -> Date? {
        let t = text.trimmingCharacters(in: .whitespaces)
        if t.isEmpty { return nil }
        if t.count == 10, let d = dateOnly.date(from: t) { return d }
        return zoned.date(from: t) ?? zonedNoFraction.date(from: t) ?? dateOnly.date(from: String(t.prefix(10)))
    }

    static func parse(_ value: JSONValue) -> Date? { parse(value.text) }

    /// Local midnight, so a deposit does not gain a few hours of interest.
    static func midnight(_ date: Date) -> Date { Calendar.current.startOfDay(for: date) }

    /// `YYYY-MM` of the instant in local time.
    static func monthKey(_ value: JSONValue) -> String? {
        guard let d = parse(value) else { return nil }
        let c = Calendar.current.dateComponents([.year, .month], from: d)
        return String(format: "%04d-%02d", c.year ?? 0, c.month ?? 0)
    }
}

extension JSONValue {
    /// True when the key is present on an object, even if its value is null —
    /// JavaScript's `field !== undefined`.
    func has(_ key: String) -> Bool { object[key] != nil }

    /// `a ?? b` over JavaScript's "defined" test used by `firstDefined` (null and '' are missing).
    var isMissing: Bool {
        switch self {
        case .null: return true
        case let .string(s): return s.isEmpty
        default: return false
        }
    }
}
