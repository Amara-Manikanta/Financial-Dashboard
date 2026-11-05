import Foundation

/// Adding a month's payslip, as `Salary.jsx` `handleSave` does when no record exists for the month: a `monthly` record for the
/// year and month with every salary field a number (blank or unreadable → 0). "Copy previous month" is `handleCopyPreviousMonth`.
enum PayslipEditing {
    /// Months of `year` with no payslip yet, in calendar order.
    static func unrecorded(_ months: [SalaryPage.Month]) -> [String] { months.filter { !$0.recorded }.map(\.name) }

    /// The previous calendar month's figures, when it has a payslip (the Mac refuses otherwise: "No data found for the previous month").
    static func previousMonthValues(of month: String, in months: [SalaryPage.Month]) -> [String: Double]? {
        guard let i = months.firstIndex(where: { $0.name == month }), i > 0, months[i - 1].recorded else { return nil }
        return months[i - 1].values
    }

    private static func parse(_ s: String) -> Double {
        let v = Double(s.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")) ?? 0
        return v.isNaN ? 0 : v
    }

    /// The record to POST. Only the given field keys are written, each as a number.
    static func record(year: String, month: String, fieldKeys: [String], values: [String: String], id: String) -> [String: Any] {
        var r: [String: Any] = ["id": id, "year": year, "month": month, "type": "monthly"]
        for k in fieldKeys { r[k] = parse(values[k] ?? "") }
        return r
    }

    static func problems(month: String?, values: [String: String]) -> [String] {
        var out: [String] = []
        if month == nil { out.append("Every month of this year already has a payslip.") }
        if !values.values.contains(where: { parse($0) != 0 }) { out.append("Enter at least one amount.") }
        return out
    }
}
