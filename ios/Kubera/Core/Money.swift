import Foundation

enum Money {
    /// JavaScript's `Math.round`: halves go toward +infinity, so -2.5 is -2, not -3.
    static func jsRound(_ value: Double) -> Double {
        let floor = value.rounded(.down)
        return value - floor >= 0.5 ? floor + 1 : floor
    }

    /// `Math.round(v * 100) / 100`.
    static func round2(_ value: Double) -> Double { jsRound(value * 100) / 100 }

    private static let whole: NumberFormatter = make(digits: 0)
    private static let cents: NumberFormatter = make(digits: 2)

    private static func make(digits: Int) -> NumberFormatter {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_IN")
        formatter.numberStyle = .currency
        formatter.currencyCode = "INR"
        formatter.currencySymbol = "₹"
        formatter.minimumFractionDigits = digits
        formatter.maximumFractionDigits = digits
        return formatter
    }

    /// The web app's `formatCurrency`: Indian digit grouping, no decimals for a
    /// whole number and two for anything else, so figures read the same on both.
    static func rupees(_ value: Double) -> String {
        let amount = value.isFinite ? value : 0
        let isWhole = amount.truncatingRemainder(dividingBy: 1) == 0
        return (isWhole ? whole : cents).string(from: NSNumber(value: amount)) ?? "₹0"
    }

    /// 12.4L, 1.2Cr — for tight spaces such as chart axes.
    static func compact(_ value: Double) -> String {
        let magnitude = abs(value)
        let sign = value < 0 ? "-" : ""
        switch magnitude {
        case 1e7...: return "\(sign)₹\(String(format: "%.2f", magnitude / 1e7))Cr"
        case 1e5...: return "\(sign)₹\(String(format: "%.2f", magnitude / 1e5))L"
        case 1e3...: return "\(sign)₹\(String(format: "%.1f", magnitude / 1e3))K"
        default: return "\(sign)₹\(Int(magnitude))"
        }
    }
}
