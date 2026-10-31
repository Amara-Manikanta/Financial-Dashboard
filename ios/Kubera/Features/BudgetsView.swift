import SwiftUI

/// Your category limits against what was spent in a chosen month. Limits are set on the Mac.
struct BudgetsView: View {
    @ObservedObject var store: FinanceStore
    @State private var year: String?
    @State private var month: String?
    @State private var open: Set<String> = []

    private func inr(_ v: Double) -> String { Money.rupees(v) }
    private static let monthOrder = SalaryPage.months
    private func tone(_ s: String) -> Tone { s == "overspent" ? .negative : s == "warning" ? .warning : .positive }

    var body: some View {
        let d = store.data
        let years = d.expensesRaw.object.keys.sorted(by: >)
        let y = year ?? (years.contains(String(Calendar.current.component(.year, from: Date()))) ? String(Calendar.current.component(.year, from: Date())) : years.first ?? "")
        let months = d.expensesRaw[y].object.keys.sorted { (Self.monthOrder.firstIndex(of: $0) ?? 99) < (Self.monthOrder.firstIndex(of: $1) ?? 99) }
        let currentName = Self.monthOrder[Calendar.current.component(.month, from: Date()) - 1]
        let m = month.flatMap { months.contains($0) ? $0 : nil } ?? (months.contains(currentName) ? currentName : months.last ?? currentName)
        let map = Budgets.categoryMap(appData: d.appDataRaw)
        let budgets = d.appDataRaw["categoryBudgets"]
        let sp = Budgets.spending(expenses: d.expensesRaw, year: y, month: m, map: map)
        let st = Budgets.stats(map: map, budgets: budgets, spending: sp)
        let shown = map.filter { !Budgets.excluded.contains($0.main) }

        KScreen(refresh: { await store.load() }) {
            HStack {
                Menu { ForEach(years, id: \.self) { yy in Button(yy) { year = yy; month = nil } } } label: { chip(y) }
                Menu { ForEach(months, id: \.self) { mm in Button(mm) { month = mm } } } label: { chip(m) }
                Spacer()
            }
            KCard(tint: st.over > 0 ? Theme.negative : Theme.accent) {
                KStat(label: "Spent in \(m)", value: inr(st.totalActual), size: .hero)
                Text(st.totalTarget > 0 ? "against \(inr(st.totalTarget)) of limits you set" : "no limits set yet — set them on the Mac").font(Theme.footnote).foregroundStyle(Theme.muted)
                HStack(alignment: .top) {
                    KStat(label: "Over", value: "\(st.over)", tone: st.over > 0 ? .negative : .neutral)
                    Spacer(); KStat(label: "Near limit", value: "\(st.warning)", tone: st.warning > 0 ? .warning : .neutral)
                    Spacer(); KStat(label: "Within", value: "\(st.safe)", tone: .positive)
                    Spacer(); KStat(label: "Health", value: "\(Int(st.health))%")
                }.padding(.top, 8)
            }
            ForEach(shown, id: \.main) { c in
                let target = budgets[c.main].double, actual = sp.mainSpend(c.main)
                let s = Budgets.status(planned: target, actual: actual)
                KCard {
                    Button { if open.contains(c.main) { open.remove(c.main) } else { open.insert(c.main) } } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack { Text(c.main).font(Theme.body.weight(.semibold)).foregroundStyle(.white); Spacer()
                                Text(inr(actual)).font(Theme.figure).foregroundStyle(target > 0 ? tone(s.status).color : .white) }
                            if target > 0 {
                                ProgressView(value: min(1, s.percentUsed / 100)).tint(tone(s.status).color)
                                Text("\(inr(actual)) of \(inr(target)) · \(s.difference >= 0 ? "\(inr(s.difference)) left" : "\(inr(-s.difference)) over")").font(Theme.footnote).foregroundStyle(Theme.muted)
                            }
                        }
                    }.buttonStyle(.plain)
                    if open.contains(c.main) {
                        ForEach(c.subs, id: \.self) { sub in
                            let t = budgets[sub].double, a = sp.subSpend(sub)
                            if t > 0 || a > 0 {
                                HStack { Text(sub).font(Theme.footnote).foregroundStyle(.white.opacity(0.85)); Spacer()
                                    Text(t > 0 ? "\(inr(a)) / \(inr(t))" : inr(a)).font(Theme.footnote.weight(.semibold)).foregroundStyle(t > 0 ? tone(Budgets.status(planned: t, actual: a).status).color : Theme.muted) }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Budget Limits")
        .navigationBarTitleDisplayMode(.large)
    }

    private func chip(_ text: String) -> some View {
        Text(text).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white).padding(.horizontal, 10).padding(.vertical, 6).background(Color.white.opacity(0.08), in: Capsule())
    }
}
