import SwiftUI

/// Salary by year: what each month paid and took, the annual package against what actually
/// arrived, gratuity, and every year's package. Long-press a month to edit its payslip.
struct SalaryView: View {
    @ObservedObject var store: FinanceStore
    @State private var year = String(Calendar.current.component(.year, from: Date()))
    @State private var open: Set<String> = []
    @State private var empSheet: EmploymentRoute?
    @State private var deletingEmp: JSONValue?
    @State private var empMessage: String?
    @State private var addingPayslip = false

    private struct EmploymentRoute: Identifiable { let id = UUID(); let emp: JSONValue? }
    private struct IndexedTenure: Identifiable { let index: Int; let tenure: SalaryPage.Tenure; var id: Int { index } }

    private func inr(_ v: Double) -> String { Money.rupees(v) }

    var body: some View {
        let d = store.data
        let p = SalaryPage.page(salaryDetails: d.salaryRaw, appData: d.appDataRaw, year: year)
        KScreen(refresh: { await store.load() }) {
            Picker("Year", selection: $year) { ForEach(p.years, id: \.self) { Text($0).tag($0) } }.pickerStyle(.menu)

            if p.hasMonthly {
                KCard(tint: Theme.accent) {
                    KStat(label: "Take-home in \(year)", value: inr(p.totalNet), size: .hero)
                    Text("from \(inr(p.totalGross)) gross").font(Theme.footnote).foregroundStyle(Theme.muted)
                    HStack(alignment: .top) {
                        KStat(label: "Income tax", value: inr(p.totalIncomeTax))
                        Spacer()
                        KStat(label: "EPF", value: inr(p.totalEpf))
                    }.padding(.top, 10)
                }
                HStack { KSectionHeader(title: "Month by month"); Button { addingPayslip = true } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) } }
                KList(items: p.months.filter(\.recorded)) { m in
                    VStack(alignment: .leading, spacing: 6) {
                        Button { toggle(m.id) } label: {
                            KRow(title: m.name, subtitle: "Gross \(inr(m.gross)) · less \(inr(m.deductions))", value: inr(m.net), chevron: false)
                        }.buttonStyle(.plain)
                        if open.contains(m.id) {
                            ForEach(p.fields.earnings) { f in line(f.label, m.values[f.key] ?? 0) }
                            ForEach(p.fields.deductions) { f in line(f.label, -(m.values[f.key] ?? 0)) }
                        }
                    }
                    .editable(store, "salaryDetails", id: salaryId(m.name), title: "\(m.name) \(year)")
                }
            } else {
                HStack { KSectionHeader(title: "Month by month"); Button { addingPayslip = true } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) } }
                KCard { Text("No monthly payslips recorded for \(year).").font(Theme.body).foregroundStyle(Theme.muted) }
            }

            if p.annualRecord != nil {
                KSectionHeader(title: "Annual package \(year)")
                KCard {
                    KStat(label: "Total", value: inr(p.annualTotal))
                    ForEach(p.fields.annual) { f in
                        let v = p.annualRecord?[f.key].double ?? 0
                        if v != 0 { line(f.label, v) }
                    }
                }
                if p.hasMonthly {
                    KSectionHeader(title: "Promised against received")
                    KList(items: p.comparison) { c in
                        KRow(title: c.field.label, subtitle: "Promised \(inr(c.target)) · received \(inr(c.received))",
                             value: inr(c.difference), valueTone: c.difference >= 0 ? .positive : .negative)
                    }
                }
            }

            let employments = store.data.appDataRaw["employments"].array
            HStack { KSectionHeader(title: "Gratuity"); Button { empSheet = EmploymentRoute(emp: nil) } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) } }
            if !p.gratuity.tenures.isEmpty || p.gratuity.total != 0 {
                KCard {
                    KStat(label: "Accrued so far", value: inr(p.gratuity.total))
                    if p.gratuity.thisYear != 0 { line("Recorded in \(year)'s package", p.gratuity.thisYear) }
                }
            }
            if p.gratuity.tenures.isEmpty {
                KCard { Text("No employment recorded. Tap + to add a tenure; gratuity is worked out from its dates and last drawn basic.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            } else {
                KList(items: Array(p.gratuity.tenures.enumerated()).map { IndexedTenure(index: $0.offset, tenure: $0.element) }) { it in
                    let t = it.tenure
                    Button { if employments.indices.contains(it.index) { empSheet = EmploymentRoute(emp: employments[it.index]) } } label: {
                        KRow(title: t.company.isEmpty ? "Employer" : t.company, subtitle: "\(t.duration) · \(t.status)\(t.eligible ? "" : " · under 5 years")", value: inr(t.amount))
                    }.buttonStyle(.plain)
                    .contextMenu { if employments.indices.contains(it.index) { Button(role: .destructive) { deletingEmp = employments[it.index] } label: { Label("Delete", systemImage: "trash") } } }
                }
                Text("Tap a tenure to change it; long-press to delete. Needs your Mac.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            }

            if !p.annual.isEmpty {
                KSectionHeader(title: "Every year's package")
                KList(items: p.annual.reversed()) { a in
                    KRow(title: a.year, subtitle: "Basic \(inr(a.values["basicSalary"] ?? 0))",
                         value: inr(p.fields.annual.reduce(0) { $0 + (a.values[$1.key] ?? 0) }))
                }
            }
        }
        .sheet(isPresented: $addingPayslip) { PayslipSheet(store: store, year: year, page: SalaryPage.page(salaryDetails: store.data.salaryRaw, appData: store.data.appDataRaw, year: year)) }
        .sheet(item: $empSheet) { EmploymentSheet(store: store, editing: $0.emp) }
        .confirmationDialog("Delete this employment tenure?", isPresented: Binding(get: { deletingEmp != nil }, set: { if !$0 { deletingEmp = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) { if let e = deletingEmp { Task { empMessage = await store.saveEmployment(.delete(id: e["id"].text)) } } }
        }
        .alert("Not saved", isPresented: Binding(get: { empMessage != nil }, set: { if !$0 { empMessage = nil } })) { Button("OK") { empMessage = nil } } message: { Text(empMessage ?? "") }
        .navigationTitle("Salary")
        .navigationBarTitleDisplayMode(.large)
    }

    private func toggle(_ id: String) { if open.contains(id) { open.remove(id) } else { open.insert(id) } }

    private func line(_ label: String, _ value: Double) -> some View {
        HStack { Text(label).font(Theme.footnote).foregroundStyle(Theme.muted); Spacer(); Text(inr(value)).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white) }
    }

    /// The stored payslip behind a month, so it can be edited.
    private func salaryId(_ month: String) -> String {
        store.data.salaryRaw.array.first { $0["type"].text != "annual" && $0["year"].text == year && $0["month"].text.lowercased() == month.lowercased() }?["id"].text ?? ""
    }

}
