import Foundation

/// Loans & Lents. Port of `lentOutstanding` (utils/lents.js), the totals and
/// per-loan figures in LentsAndLoans.jsx, and EMICalculator.jsx.
enum LoansPage {
    // MARK: People

    struct PeerDebt: Identifiable, Equatable {
        let id: String
        let name: String
        let detail: String
        let isLent: Bool
        let outstanding: Double
    }

    struct People: Equatable {
        var debts: [PeerDebt] = []
        var totalLent: Double { debts.filter(\.isLent).reduce(0) { $0 + $1.outstanding } }
        var totalBorrowed: Double { debts.filter { !$0.isLent }.reduce(0) { $0 + $1.outstanding } }
    }

    /// The opening amount, adjusted by what was lent on top and what has been paid back.
    static func outstanding(_ item: JSONValue) -> Double {
        item["transactions"].array.reduce(item["amount"].double) { acc, tx in
            let value = tx["amount"].double
            switch tx["type"].text {
            case "repayment": return acc - value
            case "additional": return acc + value
            default: return acc
            }
        }
    }

    static func people(lents: JSONValue) -> People {
        People(debts: lents.array.filter { !$0.isNull }.map {
            PeerDebt(id: $0["id"].text, name: $0["name"].text, detail: $0["description"].text,
                     isLent: $0["type"].text == "lent", outstanding: outstanding($0))
        })
    }

    // MARK: Bank loans

    struct Payment: Identifiable, Equatable {
        let id: String
        let number: String
        let date: String
        let amount: Double
    }

    struct Loan: Identifiable, Equatable {
        let id: String
        let name: String
        let lender: String
        let kind: String
        let principal: Double
        let emi: Double
        let tenureMonths: Double
        let totalPaid: Double
        let estimatedTotalCost: Double
        let pendingBalance: Double
        let paidCount: Int
        let progressPercent: Double
        let processingFee: Double
        let gst: Double
        let paidThisMonth: Bool
        let dueThisMonth: Bool
        let payments: [Payment]

        var badge: (emoji: String, label: String) { LoansPage.badge(for: kind) }
    }

    struct Loans: Equatable {
        var loans: [Loan] = []
        var totalPrincipal = 0.0
        var totalMonthlyEmi = 0.0
        var totalFeesAndGst = 0.0
    }

    static func badge(for type: String) -> (emoji: String, label: String) {
        switch type.lowercased() {
        case "gadget": return ("📱", "Electronic Gadget EMI")
        case "home": return ("🏠", "Home Loan")
        case "car": return ("🚗", "Car Loan")
        case "personal": return ("💼", "Personal Loan")
        case "no_cost_emi": return ("💳", "No-Cost EMI")
        case "consumer_durable": return ("🛒", "Consumer EMI")
        case "education": return ("🎓", "Education Loan")
        default: return ("🪙", "Debt / Loan")
        }
    }

    /// Is a payment dated in the month of `now`? `yyyy-mm-dd` is read as written,
    /// not through a time zone, as the web page does.
    private static func isInMonth(_ date: JSONValue, of now: Date) -> Bool {
        guard date.truthy else { return false }
        let calendar = Calendar.current
        let parts = date.text.split(separator: "-", omittingEmptySubsequences: false).map { Double($0) }
        if parts.count == 3, let y = parts[0], let m = parts[1] {
            return y == Double(calendar.component(.year, from: now)) && (m - 1) == Double(calendar.component(.month, from: now) - 1)
        }
        guard let d = JSDate.parse(date) else { return false }
        return calendar.component(.year, from: d) == calendar.component(.year, from: now)
            && calendar.component(.month, from: d) == calendar.component(.month, from: now)
    }

    static func loans(_ list: JSONValue, now: Date = Date()) -> Loans {
        var result = Loans()
        for loan in list.array where !loan.isNull {
            let payments = loan["payments"].array
            let totalPaid = payments.reduce(0) { $0 + $1["amount"].double }
            let tenure = loan["tenureMonths"].double != 0 ? loan["tenureMonths"].double : 12
            let estimated = loan["emiAmount"].double > 0 ? (loan["emiAmount"].double * tenure).rounded() : loan["principalAmount"].double
            let pending = max(0, estimated - totalPaid)
            let paidThisMonth = payments.contains { isInMonth($0["date"], of: now) }
            result.loans.append(Loan(
                id: loan["id"].text, name: loan["name"].text, lender: loan["lender"].text, kind: loan["type"].text,
                principal: loan["principalAmount"].double, emi: loan["emiAmount"].double, tenureMonths: tenure,
                totalPaid: totalPaid, estimatedTotalCost: estimated, pendingBalance: pending, paidCount: payments.count,
                progressPercent: min(100, (Double(payments.count) / tenure * 100).rounded()),
                processingFee: loan["processingFee"].double, gst: loan["gstAmount"].double,
                paidThisMonth: paidThisMonth, dueThisMonth: !paidThisMonth && pending > 0,
                payments: payments.enumerated().map { index, p in
                    Payment(id: p["id"].isNull ? "p\(index)" : p["id"].text, number: p["emiNumber"].text, date: p["date"].text, amount: p["amount"].double)
                }.sorted { $0.date > $1.date }))
        }
        result.totalPrincipal = list.array.reduce(0) { $0 + $1["principalAmount"].double }
        result.totalMonthlyEmi = list.array.reduce(0) { $0 + $1["emiAmount"].double }
        result.totalFeesAndGst = list.array.reduce(0) { $0 + $1["processingFee"].double + $1["gstAmount"].double }
        return result
    }
}

/// The EMI calculator: a reducing-balance loan paid in equal monthly instalments.
enum EMI {
    struct Row: Identifiable, Equatable { let month: Int; let emi: Double; let principal: Double; let interest: Double; let balance: Double; var id: Int { month } }

    struct Result: Equatable {
        var emi = 0.0, totalPayment = 0.0, totalInterest = 0.0, interestPercent = 0.0
        var schedule: [Row] = []
    }

    static func calculate(principal: Double, annualRatePercent: Double, years: Double) -> Result {
        let p = principal.isFinite ? principal : 0
        let r = (annualRatePercent.isFinite ? annualRatePercent : 0) / 12 / 100
        let n = (years.isFinite ? years : 0) * 12
        var emi = 0.0
        if p > 0 && r > 0 && n > 0 {
            emi = ((p * r * pow(1 + r, n)) / (pow(1 + r, n) - 1)).rounded()
        } else if p > 0 && n > 0 && r == 0 {
            emi = (p / n).rounded()
        }
        let total = emi * n
        let interest = max(0, total - p)
        var out = Result(emi: emi, totalPayment: total, totalInterest: interest,
                         interestPercent: total > 0 ? (interest / total * 100).rounded() : 0)
        // The first two years of the schedule, as the web page shows them.
        var balance = p
        if n >= 1 {
            for month in 1...Int(min(n, 24)) {
                let interestPart = (balance * r).rounded()
                let principalPart = min(balance, emi - interestPart)
                balance = max(0, balance - principalPart)
                out.schedule.append(Row(month: month, emi: emi, principal: principalPart, interest: interestPart, balance: balance))
            }
        }
        return out
    }
}
