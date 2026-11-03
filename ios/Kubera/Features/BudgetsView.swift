import SwiftUI

/// Your category limits against what was spent in a chosen month. Limits can be changed here (it needs the Mac).
struct BudgetsView: View {
    @ObservedObject var store: FinanceStore
    @State private var year: String?
    @State private var month: String?
    @State private var open: Set<String> = []
    @State private var editing = false

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
                Button { editing = true } label: { chip("Edit limits") }.buttonStyle(.plain)
            }
            KCard(tint: st.over > 0 ? Theme.negative : Theme.accent) {
                KStat(label: "Spent in \(m)", value: inr(st.totalActual), size: .hero)
                Text(st.totalTarget > 0 ? "against \(inr(st.totalTarget)) of limits you set" : "no limits set yet — tap Edit limits").font(Theme.footnote).foregroundStyle(Theme.muted)
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
        .sheet(isPresented: $editing) { BudgetLimitsEditor(store: store) }
        .navigationBarTitleDisplayMode(.large)
    }

    private func chip(_ text: String) -> some View {
        Text(text).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white).padding(.horizontal, 10).padding(.vertical, 6).background(Color.white.opacity(0.08), in: Capsule())
    }
}


/// Every category's monthly limit in one list. Blank removes a limit. Saved to the Mac as one `appData` key, under its version.
struct BudgetLimitsEditor: View {
    @ObservedObject var store: FinanceStore
    @Environment(\.dismiss) private var dismiss
    @State private var text: [String: String] = [:]
    @State private var saving = false
    @State private var message: String?
    @State private var query = ""

    private var map: [(main: String, subs: [String])] { Budgets.categoryMap(appData: store.data.appDataRaw).filter { !Budgets.excluded.contains($0.main) } }
    private var current: JSONValue { store.data.appDataRaw["categoryBudgets"] }

    private func value(_ key: String) -> String {
        if let t = text[key] { return t }
        let v = current[key].double
        return v > 0 ? RecordEditing.number(v) : ""
    }

    /// Only limits whose text was edited, as numbers; blank becomes 0, which `saveBudgetLimits` drops.
    private var changes: [String: Double] {
        var out: [String: Double] = [:]
        for (k, t) in text {
            let clean = t.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")
            let n = clean.isEmpty ? 0 : (Double(clean) ?? .nan)
            if !n.isNaN && n >= 0 && n != current[k].double { out[k] = n }
        }
        return out
    }
    private var invalid: Bool { text.values.contains { let c = $0.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ""); return !c.isEmpty && Double(c) == nil } }

    var body: some View {
        NavigationStack {
            Form {
                if let message { Section { Text(message).foregroundStyle(Tone.negative.color) } }
                ForEach(map, id: \.main) { c in
                    Section(c.main) {
                        row(c.main, label: "Whole category")
                        ForEach(c.subs, id: \.self) { sub in row(sub, label: sub) }
                    }
                }
                Section { Text("A limit is a monthly amount you choose. Leave blank for none. Saved to your Mac; it needs the Mac to be reachable.").font(.footnote).foregroundStyle(.secondary) }
            }
            .navigationTitle("Budget limits")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else {
                        Button("Save") { Task {
                            saving = true; message = nil
                            let failure = await store.saveBudgetLimits(changes)
                            saving = false
                            if let failure { message = failure } else { dismiss() }
                        } }.disabled(changes.isEmpty || invalid)
                    }
                }
            }
            .interactiveDismissDisabled(!changes.isEmpty)
        }
    }

    private func row(_ key: String, label: String) -> some View {
        LabeledContent(label) {
            TextField("No limit", text: Binding(get: { value(key) }, set: { text[key] = $0 })).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
        }
    }
}
