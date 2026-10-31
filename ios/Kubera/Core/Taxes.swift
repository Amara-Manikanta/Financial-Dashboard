import Foundation

/// The Taxes page — filed returns and Form 16 records, and the old-versus-new regime
/// calculator. Ports of `pages/Taxes.jsx` and `components/TaxPlanningCalculator.jsx`.
///
/// The calculator's slabs are the ones written there (new regime FY 2026-27 with the full
/// 87A rebate to ₹12L). They are the web page's assumptions, kept identical so the two
/// never give different answers; nothing here is tax advice.
enum TaxesPage {
    struct Record: Identifiable, Equatable {
        let raw: JSONValue
        var id: String { raw["id"].text }
        var fy: String { raw["financialYear"].text }
        func n(_ key: String) -> Double { raw[key].double }
        /// What the return says is owed back — a negative `taxPayableRefundable`.
        var refundDue: Double { max(0, -n("taxPayableRefundable")) }
        var refundReceived: Double { max(0, n("refundReceived")) }
        var isRefund: Bool { n("taxPayableRefundable") < 0 }
        var isPayable: Bool { n("taxPayableRefundable") > 0 }
    }

    struct Totals: Equatable { var taxPaid = 0.0, refundDue = 0.0, refundReceived = 0.0, refundAwaited = 0.0 }

    /// Newest financial year first (`localeCompare` on "2025-2026" strings).
    static func records(_ taxes: JSONValue) -> [Record] {
        taxes.array.filter { !$0.isNull }.enumerated()
            .sorted { a, b in
                let x = a.element["financialYear"].text, y = b.element["financialYear"].text
                return x != y ? x > y : a.offset < b.offset
            }.map { Record(raw: $0.element) }
    }

    static func totals(_ rows: [Record]) -> Totals {
        var t = Totals()
        for r in rows {
            t.taxPaid += r.n("taxesPaid")
            t.refundDue += r.refundDue
            t.refundReceived += r.refundReceived
            t.refundAwaited += max(0, r.refundDue - r.refundReceived)
        }
        return t
    }

    // MARK: Regime calculator

    struct Inputs: Equatable {
        var basic = 600_000.0, hra = 250_000.0, other = 350_000.0, bonus = 100_000.0
        var tdsPaid = 108_302.0
        var sec80C = 150_000.0, sec80D = 25_000.0, nps = 50_000.0, homeLoanInterest = 0.0
        var rent = 180_000.0
        var metro = true
    }

    struct Result: Equatable {
        var gross = 0.0, hraExemption = 0.0
        var oldDeductions = 0.0, oldTaxable = 0.0, oldTax = 0.0
        var newTaxable = 0.0, newTax = 0.0
        var difference = 0.0
        var newIsBetter = true
        var oldRefundOrPayable = 0.0, newRefundOrPayable = 0.0
    }

    static func oldTax(_ taxable: Double) -> Double {
        if taxable <= 250_000 { return 0 }
        var tax = 0.0
        if taxable <= 500_000 { return 0 } else { tax += 250_000 * 0.05 }
        if taxable <= 1_000_000 { tax += (taxable - 500_000) * 0.20 } else { tax += 500_000 * 0.20; tax += (taxable - 1_000_000) * 0.30 }
        return tax + tax * 0.04
    }

    static func newTax(_ taxable: Double) -> Double {
        if taxable <= 400_000 { return 0 }
        if taxable <= 1_200_000 { return 0 }
        var tax = 400_000 * 0.05 + 400_000 * 0.10
        if taxable <= 1_600_000 { tax += (taxable - 1_200_000) * 0.15 }
        else {
            tax += 400_000 * 0.15
            if taxable <= 2_000_000 { tax += (taxable - 1_600_000) * 0.20 }
            else {
                tax += 400_000 * 0.20
                if taxable <= 2_400_000 { tax += (taxable - 2_000_000) * 0.25 }
                else { tax += 400_000 * 0.25; tax += (taxable - 2_400_000) * 0.30 }
            }
        }
        return tax + tax * 0.04
    }

    static func calculate(_ i: Inputs) -> Result {
        var r = Result()
        r.gross = i.basic + i.hra + i.other + i.bonus
        let rentMinusTen = max(0, i.rent - i.basic * 0.10)
        let basicLimit = i.basic * (i.metro ? 0.50 : 0.40)
        r.hraExemption = min(i.hra, rentMinusTen, basicLimit)
        r.oldDeductions = 50_000 + r.hraExemption + min(150_000, i.sec80C) + min(75_000, i.sec80D) + min(50_000, i.nps) + min(200_000, i.homeLoanInterest)
        r.oldTaxable = max(0, r.gross - r.oldDeductions)
        r.newTaxable = max(0, r.gross - 75_000)
        r.oldTax = oldTax(r.oldTaxable)
        r.newTax = newTax(r.newTaxable)
        r.difference = abs(r.oldTax - r.newTax)
        r.newIsBetter = r.newTax <= r.oldTax
        r.oldRefundOrPayable = i.tdsPaid - r.oldTax
        r.newRefundOrPayable = i.tdsPaid - r.newTax
        return r
    }

    /// What the calculator fills in for a financial year: the matching return (or the
    /// newest), else the first `annual` payslip, with 80C summed from PF, PPF and policies
    /// when the return does not state it. The web page does this in an effect on every change.
    static func prefill(fy: String, taxes: JSONValue, salaryDetails: JSONValue, savings: JSONValue) -> Inputs {
        var i = Inputs()
        let sorted = records(taxes)
        let record = sorted.first { $0.fy == fy } ?? sorted.first
        let annual = salaryDetails.array.first { $0["type"].text == "annual" }
        if let record {
            if record.n("taxesPaid") != 0 { i.tdsPaid = record.n("taxesPaid") }
            else if record.n("f16TdsPartA") != 0 { i.tdsPaid = record.n("f16TdsPartA") }
            if record.raw["f1680C"].truthy { i.sec80C = record.n("f1680C") }
            if record.raw["f16GrossSalary"].truthy || record.raw["totalIncome"].truthy {
                let total = record.raw["f16GrossSalary"].truthy ? record.n("f16GrossSalary") : record.n("totalIncome")
                if total > 0 {
                    i.basic = Money.jsRound(total * 0.45); i.hra = Money.jsRound(total * 0.20)
                    i.other = Money.jsRound(total * 0.25); i.bonus = Money.jsRound(total * 0.10)
                }
            }
        } else if let annual {
            i.basic = annual["basicSalary"].double != 0 ? annual["basicSalary"].double : 600_000
            i.hra = annual["hra"].double != 0 ? annual["hra"].double : 250_000
            let flexi = annual["conveyanceAllowance"].double + annual["flexibleAllowance"].double
            i.other = flexi != 0 ? flexi : 350_000
            i.bonus = annual["performanceBonus"].double != 0 ? annual["performanceBonus"].double : 100_000
        }
        var auto80C = 0.0
        if let annual, annual["pf"].truthy { auto80C += annual["pf"].double }
        for item in savings.array where item["type"].text == "ppf" || item["type"].text == "Policy" { auto80C += item["amount"].double }
        if auto80C > 0 && !(record?.raw["f1680C"].truthy ?? false) { i.sec80C = min(150_000, auto80C) }
        return i
    }
}
