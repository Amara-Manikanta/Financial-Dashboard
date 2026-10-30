import Foundation

enum Fmt {
    private static let parser: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"; return f
    }()
    private static let display: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_IN"); f.dateFormat = "d MMM yyyy"; return f
    }()
    private static let day: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_IN"); f.dateFormat = "EEE, d MMM"; return f
    }()

    static func date(_ iso: String) -> String {
        guard let d = parser.date(from: String(iso.prefix(10))) else { return iso }
        return display.string(from: d)
    }

    static func dayHeading(_ iso: String) -> String {
        guard let d = parser.date(from: String(iso.prefix(10))) else { return iso }
        return day.string(from: d)
    }

    static func percent(_ value: Double) -> String {
        String(format: "%@%.1f%%", value > 0 ? "+" : "", value)
    }

    /// "+₹1,200" / "-₹300" — a signed rupee amount.
    static func signed(_ value: Double) -> String {
        value > 0 ? "+\(Money.rupees(value))" : Money.rupees(value)
    }

    static func shares(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(format: "%.2f", value)
    }

    static func title(_ category: String) -> String {
        category.isEmpty ? "Uncategorised" : category.prefix(1).uppercased() + category.dropFirst()
    }
}
