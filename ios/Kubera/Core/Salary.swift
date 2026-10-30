import Foundation

/// The Salary page's figures — a port of the memos in `pages/Salary.jsx` and of
/// `calculateGratuity` / `gratuityForYear` (`utils/financeCalculators.js`).
///
/// Field lists are the page's defaults plus whatever you added in the Mac app, minus the
/// ones you hid, so a custom earning shows up here as it does there.
enum SalaryPage {
    struct Field: Equatable, Identifiable { let key: String; let label: String; var category = ""; var id: String { key } }

    static let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

    static let annualDefaults: [Field] = [
        Field(key: "basicSalary", label: "Basic Salary", category: "Base"), Field(key: "hra", label: "HRA", category: "Base"),
        Field(key: "conveyanceAllowance", label: "Conveyance Allowance", category: "Base"), Field(key: "flexibleAllowance", label: "Flexible Allowance", category: "Base"),
        Field(key: "performanceBonus", label: "Performance Bonus", category: "Base"), Field(key: "foodWallet", label: "Food Wallet", category: "Allowances"),
        Field(key: "annualFlexiBasket", label: "Annual Flexi Basket", category: "Allowances"), Field(key: "pf", label: "PF", category: "Retirement"),
        Field(key: "gratuity", label: "Gratuity", category: "Retirement"), Field(key: "medicalInsurance", label: "Medical Insurance", category: "Insurance & Limits"),
        Field(key: "hospitalizationLimit", label: "Hospitalization Limit", category: "Insurance & Limits"), Field(key: "termLifeInsurance", label: "Term Life Insurance", category: "Insurance & Limits"),
        Field(key: "disabilityCover", label: "Disability Cover", category: "Insurance & Limits"),
    ]
    static let earningDefaults: [Field] = [
        Field(key: "basicSalary", label: "Basic Salary"), Field(key: "hra", label: "HRA"), Field(key: "conveyanceAllowance", label: "Conveyance Allowance"),
        Field(key: "flexibleAllowance", label: "Flexible Allowance"), Field(key: "performanceBonus", label: "Performance Bonus"),
    ]
    static let deductionDefaults: [Field] = [
        Field(key: "epf", label: "EPF"), Field(key: "profTax", label: "Professional Tax"), Field(key: "incomeTax", label: "Income Tax"), Field(key: "otherRecoveries", label: "Other Recoveries"),
    ]

    private static func fields(_ defaults: [Field], custom: JSONValue, hidden: Set<String>) -> [Field] {
        (defaults + custom.array.map { Field(key: $0["key"].text, label: $0["label"].text, category: $0["category"].text) }).filter { !hidden.contains($0.key) }
    }

    struct Fields: Equatable {
        var annual: [Field] = [], earnings: [Field] = [], deductions: [Field] = []
    }

    static func activeFields(appData: JSONValue) -> Fields {
        let custom = appData["customSalaryFields"]
        let hidden = Set(appData["hiddenSalaryFields"].array.map(\.text))
        return Fields(annual: fields(annualDefaults, custom: custom["annual"], hidden: hidden),
                      earnings: fields(earningDefaults, custom: custom["monthlyEarnings"], hidden: hidden),
                      deductions: fields(deductionDefaults, custom: custom["monthlyDeductions"], hidden: hidden))
    }

    struct Month: Identifiable, Equatable {
        var id: String { name }
        let name: String
        var short: String { String(name.prefix(3)) }
        var values: [String: Double] = [:]
        var gross = 0.0, deductions = 0.0, net = 0.0
        var recorded = false
    }

    struct Comparison: Identifiable, Equatable { let field: Field; let target: Double; let received: Double; var difference: Double { received - target }; var id: String { field.key } }

    struct AnnualYear: Identifiable, Equatable { let year: String; let values: [String: Double]; var id: String { year } }

    struct Tenure: Identifiable, Equatable {
        var id: String { "\(company)-\(start)" }
        let company: String, designation: String, start: String, end: String
        let isCurrent: Bool
        let totalYears: Double, fullYears: Double
        let duration: String
        let eligible: Bool
        let status: String
        let amount: Double
    }

    struct Gratuity: Equatable { var total = 0.0; var thisYear = 0.0; var tenures: [Tenure] = [] }

    struct Page: Equatable {
        var years: [String] = []
        var year = ""
        var fields = Fields()
        var months: [Month] = []
        var hasMonthly = false
        var totalGross = 0.0, totalNet = 0.0, totalIncomeTax = 0.0, totalEpf = 0.0
        var annualRecord: JSONValue?
        var annualTotal = 0.0
        var comparison: [Comparison] = []
        var annual: [AnnualYear] = []
        var gratuity = Gratuity()
    }

    static func years(_ salary: JSONValue, now: Date = Date()) -> [String] {
        var set = Set(salary.array.map { $0["year"].text })
        let current = Calendar.current.component(.year, from: now)
        for i in 0..<10 { set.insert(String(current - i)) }
        return set.sorted(by: >)
    }

    static func page(salaryDetails: JSONValue, appData: JSONValue, year: String, now: Date = Date()) -> Page {
        var p = Page()
        p.year = year
        p.fields = activeFields(appData: appData)
        p.years = years(salaryDetails, now: now)
        let rows = salaryDetails.array

        let records = rows.filter { $0["year"].text == year && $0["month"].text != "Annual" }
        p.months = months.map { name in
            let record = records.first { $0["month"].text == name } ?? .null
            var m = Month(name: name)
            for f in p.fields.earnings + p.fields.deductions { m.values[f.key] = record[f.key].double }
            m.gross = p.fields.earnings.reduce(0) { $0 + (m.values[$1.key] ?? 0) }
            m.deductions = p.fields.deductions.reduce(0) { $0 + (m.values[$1.key] ?? 0) }
            m.net = m.gross - m.deductions
            m.recorded = !record.isNull
            // Aggregates read the two known keys even when a field has been hidden.
            if record["incomeTax"].truthy { m.values["incomeTax"] = record["incomeTax"].double }
            if record["epf"].truthy { m.values["epf"] = record["epf"].double }
            return m
        }
        p.hasMonthly = p.months.contains { $0.gross > 0 || $0.deductions > 0 }
        for m in p.months {
            p.totalGross += m.gross; p.totalNet += m.net
            p.totalIncomeTax += (record(m, "incomeTax")); p.totalEpf += (record(m, "epf"))
        }

        let annualRecord = rows.first { $0["year"].text == year && $0["month"].text == "Annual" }
        p.annualRecord = annualRecord
        if let annualRecord {
            p.annualTotal = p.fields.annual.reduce(0) { $0 + annualRecord[$1.key].double }
            p.comparison = p.fields.earnings.map { f in
                Comparison(field: f, target: annualRecord[f.key].double, received: p.months.reduce(0) { $0 + ($1.values[f.key] ?? 0) })
            }
        }

        var order: [String] = [], byYear: [String: [String: Double]] = [:]
        for r in rows where r["month"].text == "Annual" {
            let y = r["year"].text
            if byYear[y] == nil { byYear[y] = Dictionary(uniqueKeysWithValues: p.fields.annual.map { ($0.key, 0.0) }); order.append(y) }
            for f in p.fields.annual { byYear[y]![f.key] = r[f.key].double }
        }
        p.annual = order.sorted().map { AnnualYear(year: $0, values: byYear[$0]!) }

        p.gratuity = gratuity(employments: appData["employments"], salaryDetails: salaryDetails, year: year, now: now)
        return p
    }
    private static func record(_ m: Month, _ key: String) -> Double { m.values[key] ?? 0 }

    // MARK: Gratuity

    static func gratuity(employments: JSONValue, salaryDetails: JSONValue, year: String, now: Date = Date()) -> Gratuity {
        var out = Gratuity()
        out.total = SavingsPage.gratuity(employments: employments, salaryDetails: salaryDetails, now: now)
        out.thisYear = Money.round2(salaryDetails.array.filter { $0["month"].text == "Annual" && $0["year"].text == year }.reduce(0) { $0 + $1["gratuity"].double })
        let calendar = Calendar.current
        for emp in employments.array {
            let start = emp["startDate"].truthy ? JSDate.parse(emp["startDate"]) : nil
            let end = (emp["isCurrent"].truthy || !emp["endDate"].truthy) ? now : (JSDate.parse(emp["endDate"]) ?? now)
            var totalYears = 0.0, fullYears = 0.0
            var duration = "N/A"
            if let start {
                let diff = max(0, end.timeIntervalSince(start) * 1000)
                totalYears = diff / (1000 * 60 * 60 * 24 * 365.25)
                fullYears = totalYears.rounded(.down)
                let monthsPart = Int((diff / (1000 * 60 * 60 * 24 * 30.4375)).truncatingRemainder(dividingBy: 12).rounded(.down))
                duration = "\(Int(fullYears)) Yrs, \(monthsPart) Mos"
            }
            let eligible = totalYears >= 5.0
            var status = emp["status"].truthy ? emp["status"].text : "active"
            if !emp["isCurrent"].truthy && !eligible && status == "active" { status = "forfeited" }
            var amount = 0.0
            if status != "forfeited" && status != "claimed" {
                if emp["lastDrawnBasic"].double > 0 && fullYears > 0 { amount = 15 * emp["lastDrawnBasic"].double * fullYears / 26 }
                else {
                    let startYear = start.map { Double(calendar.component(.year, from: $0)) } ?? 0
                    let endYear = Double(calendar.component(.year, from: end))
                    for row in salaryDetails.array where row["month"].text == "Annual" { let y = row["year"].double; if y >= startYear && y <= endYear { amount += row["gratuity"].double } }
                }
            }
            out.tenures.append(Tenure(company: emp["companyName"].text, designation: emp["designation"].text, start: emp["startDate"].text, end: emp["endDate"].text,
                                      isCurrent: emp["isCurrent"].truthy, totalYears: totalYears, fullYears: fullYears, duration: duration, eligible: eligible, status: status, amount: amount))
        }
        return out
    }
}
