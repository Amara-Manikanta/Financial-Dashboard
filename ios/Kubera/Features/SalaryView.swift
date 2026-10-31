import SwiftUI

/// Salary by year: what each month paid and took, the annual package against what actually
/// arrived, gratuity, and every year's package. Read-only — payslips are entered on the Mac.
struct SalaryView: View {
    @ObservedObject var store: FinanceStore
    @State private var year = String(Calendar.current.component(.year, from: Date()))
    @State private var open: Set<String> = []

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
                KSectionHeader(title: "Month by month")
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
                }
            } else {
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

            if !p.gratuity.tenures.isEmpty || p.gratuity.total != 0 {
                KSectionHeader(title: "Gratuity")
                KCard {
                    KStat(label: "Accrued so far", value: inr(p.gratuity.total))
                    if p.gratuity.thisYear != 0 { line("Recorded in \(year)'s package", p.gratuity.thisYear) }
                }
                if !p.gratuity.tenures.isEmpty {
                    KList(items: p.gratuity.tenures) { t in
                        KRow(title: t.company.isEmpty ? "Employer" : t.company, subtitle: "\(t.duration) · \(t.status)\(t.eligible ? "" : " · under 5 years")", value: inr(t.amount))
                    }
                }
            }

            if !p.annual.isEmpty {
                KSectionHeader(title: "Every year's package")
                KList(items: p.annual.reversed()) { a in
                    KRow(title: a.year, subtitle: "Basic \(inr(a.values["basicSalary"] ?? 0))",
                         value: inr(p.fields.annual.reduce(0) { $0 + (a.values[$1.key] ?? 0) }))
                }
            }
        }
        .navigationTitle("Salary")
        .navigationBarTitleDisplayMode(.large)
    }

    private func toggle(_ id: String) { if open.contains(id) { open.remove(id) } else { open.insert(id) } }

    private func line(_ label: String, _ value: Double) -> some View {
        HStack { Text(label).font(Theme.footnote).foregroundStyle(Theme.muted); Spacer(); Text(inr(value)).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white) }
    }
}
