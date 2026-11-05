import SwiftUI

/// The insurance profile the gap analysis is measured against (age, dependents, income, liabilities).
struct InsuranceProfileSheet: View {
    @ObservedObject var store: FinanceStore
    let profile: InsurancePage.Profile
    @State private var age = ""
    @State private var dependents = ""
    @State private var income = ""
    @State private var liabilities = ""
    @State private var loaded = false

    var body: some View {
        FormSheet(title: "Financial & family profile", problems: [], touched: true, save: {
            await store.saveInsuranceProfile(InsuranceEditing.profileFields(age: age, dependents: dependents, income: income, liabilities: liabilities))
        }) {
            Section {
                NumberRow(label: "Age", text: $age)
                NumberRow(label: "Dependents", text: $dependents)
                NumberRow(label: "Annual income ₹", text: $income)
                NumberRow(label: "Liabilities ₹", text: $liabilities)
            } footer: { Text("Life cover is measured as 12× annual income plus liabilities; health cover as ₹10 lakh plus ₹3 lakh a dependent. Saved on your Mac, so it needs to be reachable.") }
        }
        .onAppear {
            guard !loaded else { return }; loaded = true
            func s(_ v: Double) -> String { RecordEditing.number(v) }
            age = s(profile.age); dependents = s(profile.dependents); income = s(profile.annualIncome); liabilities = s(profile.liabilities)
        }
    }
}

/// Adds a policy or changes a policy's own details (the Mac's policy form). Premiums, benefits, claims and documents are kept.
struct PolicySheet: View {
    @ObservedObject var store: FinanceStore
    let editing: JSONValue?
    @State private var f = InsuranceEditing.Form()
    @State private var loaded = false

    var body: some View {
        FormSheet(title: editing == nil ? "Add policy" : "Edit policy", problems: InsuranceEditing.problems(f), touched: editing != nil || !f.planName.isEmpty, save: {
            await store.savePolicy(f, editing: editing)
        }) {
            Section {
                Picker("Category", selection: $f.category) { ForEach(InsuranceEditing.categories, id: \.id) { Text($0.label).tag($0.id) } }
                TextRow(label: "Plan name", text: $f.planName)
                TextRow(label: "Insurer", text: $f.insurer)
                TextRow(label: "Policy number", text: $f.policyNumber)
                if f.isVehicle { TextRow(label: "Vehicle number", text: $f.vehicleNo) }
            }
            Section {
                NumberRow(label: f.isVehicle ? "Insured value (IDV) ₹" : "Sum assured / cover ₹", text: $f.sumAssured)
                NumberRow(label: "Premium ₹", text: $f.premiumAmount)
                if f.isVehicle { NumberRow(label: "No-claim bonus %", text: $f.ncb) }
            }
            Section {
                OptionalDayRow(label: "Start date", day: $f.startDate)
                OptionalDayRow(label: "Expiry / maturity", day: $f.expiryDate)
                TextRow(label: "Policy term", text: $f.policyTerm)
                NumberRow(label: "Premium paying years", text: $f.premiumPayingTerm)
                OptionalDayRow(label: "Premium deduction date", day: $f.premiumDeductionDate)
            } footer: { Text("Term is kept as typed, so “Whole Life (100 Years)” stays as written.") }
            Section("Payout and notes") {
                TextRow(label: "Payout schedule", text: $f.payoutSchedule)
                TextRow(label: "Notes", text: $f.notes)
                ForEach(f.benefitPoints.indices, id: \.self) { i in
                    HStack { TextField("Benefit point", text: $f.benefitPoints[i]); Button(role: .destructive) { f.benefitPoints.remove(at: i) } label: { Image(systemName: "minus.circle") }.buttonStyle(.plain) }
                }
                Button { f.benefitPoints.append("") } label: { Label("Add benefit point", systemImage: "plus") }
            }
        }
        .onAppear { guard !loaded else { return }; loaded = true; if let editing { f = InsuranceEditing.form(from: editing) } }
    }
}


/// An employment tenure, as the Salary page's modal edits it.
struct EmploymentSheet: View {
    @ObservedObject var store: FinanceStore
    let editing: JSONValue?
    @State private var f = EmploymentEditing.Form()
    @State private var loaded = false

    var body: some View {
        FormSheet(title: editing == nil ? "Add employment" : "Edit employment", problems: EmploymentEditing.problems(f), touched: editing != nil || !f.companyName.isEmpty, save: {
            if let editing { return await store.saveEmployment(.replace(id: editing["id"].text, f)) }
            return await store.saveEmployment(.add(f))
        }) {
            Section {
                TextRow(label: "Company", text: $f.companyName)
                TextRow(label: "Designation", text: $f.designation)
                Picker("Gratuity status", selection: $f.status) { ForEach(EmploymentEditing.statuses, id: \.id) { Text($0.label).tag($0.id) } }
            }
            Section {
                OptionalDayRow(label: "Start date", day: $f.startDate)
                Toggle("I still work here", isOn: $f.isCurrent)
                if !f.isCurrent { OptionalDayRow(label: "End date", day: $f.endDate) }
                NumberRow(label: "Last drawn basic ₹ / month", text: $f.lastDrawnBasic)
                TextRow(label: "Notes", text: $f.notes)
            } footer: { Text("Gratuity is 15 days of last drawn basic for each full year (÷ 26), and is lost when you leave before 5 years. Saved on your Mac, so it needs to be reachable.") }
        }
        .onAppear { guard !loaded else { return }; loaded = true; if let editing { f = EmploymentEditing.form(from: editing) } }
    }
}

/// Adds a month's payslip: pick a month with none yet, optionally start from the previous month's figures, fill the amounts.
struct PayslipSheet: View {
    @ObservedObject var store: FinanceStore
    let year: String
    let page: SalaryPage.Page
    @State private var month: String?
    @State private var values: [String: String] = [:]
    @State private var loaded = false

    private var fields: [SalaryPage.Field] { page.fields.earnings + page.fields.deductions }

    var body: some View {
        let free = PayslipEditing.unrecorded(page.months)
        FormSheet(title: "Add payslip \(year)", problems: PayslipEditing.problems(month: month, values: values), touched: !values.isEmpty, save: {
            guard let month else { return nil }
            let record = PayslipEditing.record(year: year, month: month, fieldKeys: fields.map(\.key), values: values, id: String(Int64(Date().timeIntervalSince1970 * 1000)))
            return await store.createRecord("salaryDetails", record, label: "\(month) \(year) payslip")
        }) {
            Section {
                Picker("Month", selection: Binding(get: { month ?? "" }, set: { month = $0 })) { ForEach(free, id: \.self) { Text($0).tag($0) } }
                if let m = month, let prev = PayslipEditing.previousMonthValues(of: m, in: page.months) {
                    Button { values = prev.mapValues { $0 == 0 ? "" : RecordEditing.number($0) } } label: { Label("Copy the previous month", systemImage: "doc.on.doc") }
                }
            }
            Section("Earnings") { ForEach(page.fields.earnings) { f in NumberRow(label: f.label, text: binding(f.key)) } }
            Section("Deductions") { ForEach(page.fields.deductions) { f in NumberRow(label: f.label, text: binding(f.key)) } }
        }
        .onAppear { guard !loaded else { return }; loaded = true; month = free.first }
    }

    private func binding(_ key: String) -> Binding<String> { Binding(get: { values[key] ?? "" }, set: { values[key] = $0 }) }
}
