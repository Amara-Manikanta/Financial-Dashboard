import SwiftUI

/// Where the money actually goes: each debit sorted into spending, moved to savings, a card
/// bill, money lent, or a payroll deduction. Summing them together roughly doubles the apparent
/// cost of living. Reclassifying a category is done on the Mac.
struct MoneyFlowView: View {
    @ObservedObject var store: FinanceStore
    @State private var period = MoneyFlow.Period.twelve
    @State private var onlyUnreviewed = false
    @State private var open: Set<String> = []

    private func inr(_ v: Double) -> String { Money.rupees(v) }
    private func color(_ k: Kind) -> Color { [Kind.spend: Theme.negative, .transfer: Theme.positive, .settlement: .cyan, .lending: Theme.warning, .payroll: .purple][k] ?? Theme.muted }

    var body: some View {
        let d = store.data
        let kinds = TransactionKind.categoryKinds(from: d.appDataRaw)
        let p = MoneyFlow.page(expenses: d.expensesRaw, kinds: kinds, period: period)
        let b = p.breakdown
        let spendPct = b.gross > 0 ? b.total(.spend) / b.gross * 100 : 0
        let rows = onlyUnreviewed ? p.categories.filter { $0.vague && $0.assigned == nil } : p.categories

        KScreen(refresh: { await store.load() }) {
            Picker("Period", selection: $period) { ForEach(MoneyFlow.Period.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.menu)
            KCard(tint: Theme.accent) {
                KStat(label: "Real spending", value: inr(b.total(.spend)), size: .hero)
                Text("\(Int(spendPct.rounded()))% of the \(inr(b.gross)) that left your accounts was consumption. Counting every debit as spending would say \(inr(p.naive)).")
                    .font(Theme.footnote).foregroundStyle(Theme.muted)
                KRow(title: "Average real month", subtitle: "last \(p.averageMonths) complete month\(p.averageMonths == 1 ? "" : "s")", value: inr(p.averageSpend))
            }

            if b.gross > 0 {
                GeometryReader { g in
                    HStack(spacing: 1) {
                        ForEach(b.rows.filter { $0.total > 0 }) { r in Rectangle().fill(color(r.kind)).frame(width: max(2, g.size.width * r.pct / 100)) }
                    }.clipShape(Capsule())
                }.frame(height: 10)
            }
            KList(items: b.rows.filter { $0.count > 0 }) { r in
                VStack(alignment: .leading, spacing: 6) {
                    Button { if open.contains(r.id) { open.remove(r.id) } else { open.insert(r.id) } } label: {
                        HStack(alignment: .top, spacing: 10) {
                            Circle().fill(color(r.kind)).frame(width: 10, height: 10).padding(.top, 5)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(MoneyFlow.labels[r.kind] ?? "").font(Theme.body).foregroundStyle(.white)
                                Text(MoneyFlow.blurbs[r.kind] ?? "").font(Theme.footnote).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
                            }
                            Spacer(minLength: 8)
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(inr(r.total)).font(Theme.figure).foregroundStyle(.white)
                                Text("\(Int(r.pct.rounded()))% · \(r.count)").font(Theme.footnote).foregroundStyle(Theme.muted)
                            }
                        }
                    }.buttonStyle(.plain)
                    if open.contains(r.id) {
                        ForEach(Array(r.categories.prefix(8).enumerated()), id: \.offset) { _, c in
                            HStack { Text(c.category.capitalized).font(Theme.footnote).foregroundStyle(Theme.muted); Spacer(); Text(inr(c.amount)).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white) }
                        }
                    }
                }
            }

            if b.unreviewed.count > 0 {
                KNotice(message: "\(inr(b.unreviewed.total)) is counted as spending only because \(b.unreviewed.count) transactions sit in categories too vague to classify — \(Int(b.unreviewed.pctOfSpend.rounded()))% of the spending figure. Classify them on the Mac to firm it up.")
            }

            KSectionHeader(title: "Category by category")
            Toggle("Only vague, unclassified ones", isOn: $onlyUnreviewed).font(Theme.footnote).tint(Theme.accent)
            KList(items: Array(rows.prefix(40))) { r in
                KRow(title: r.category.capitalized, subtitle: "\(r.count) payments · counted as \(MoneyFlow.labels[r.kind] ?? "")\(r.assigned != nil ? " (your rule)" : r.vague ? " (unclassified)" : "")",
                     value: inr(r.amount))
            }
            if rows.count > 40 { Text("Showing the largest 40 of \(rows.count).").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4) }
        }
        .navigationTitle("Money Flow")
        .navigationBarTitleDisplayMode(.large)
    }
}
