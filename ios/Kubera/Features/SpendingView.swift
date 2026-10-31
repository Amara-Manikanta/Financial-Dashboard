import SwiftUI
import Charts

/// What changed in your spending, rather than a chart of what you already know you spent:
/// each category against its own median month, drift over the window, single purchases far
/// outside the norm, and how concentrated the spending is. Real consumption only — card bills
/// and money moved into savings are excluded.
struct SpendingView: View {
    @ObservedObject var store: FinanceStore
    @State private var window = 12
    @State private var month: String?

    private func inr(_ v: Double) -> String { Money.rupees(v) }
    private func signed(_ v: Double) -> String { "\(v > 0 ? "+" : v < 0 ? "−" : "")\(inr(abs(v)))" }
    private struct Bar: Identifiable { let id = UUID(); let month: Date; let series: String; let value: Double }
    private static func day(_ m: String) -> Date {
        let p = m.split(separator: "-").compactMap { Int($0) }
        return Calendar.current.date(from: DateComponents(year: p.first, month: p.count > 1 ? p[1] : 1, day: 1)) ?? Date()
    }

    var body: some View {
        let d = store.data
        let kinds = TransactionKind.categoryKinds(from: d.appDataRaw)
        let ex = d.expensesRaw
        KScreen(refresh: { await store.load() }) {
            if let o = SpendingAnalytics.overview(ex, kinds) {
                let target = month ?? o.lastComplete?.month
                let movers = SpendingAnalytics.movers(ex, kinds, month: target)
                let conc = SpendingAnalytics.concentration(ex, kinds, months: window)
                let trends = SpendingAnalytics.trends(ex, kinds, windowMonths: window)
                let outliers = SpendingAnalytics.outliers(ex, kinds, sinceMonths: window)
                let notable = Array(movers.rows.filter { abs($0.change) >= 500 }.prefix(12))
                let drifting = trends.filter { $0.activeMonths >= 4 && abs($0.change) >= 500 }
                let bars = o.series.suffix(max(window, 6)).flatMap { m in
                    [Bar(month: Self.day(m.month), series: "Spending", value: m.netSpend), Bar(month: Self.day(m.month), series: "Income", value: m.income)]
                }

                KCard(tint: Theme.accent) {
                    KStat(label: "Normal month", value: inr(o.normalSpend), size: .hero)
                    Text("median of the last 6 complete months").font(Theme.footnote).foregroundStyle(Theme.muted)
                    HStack(alignment: .top) {
                        KStat(label: "Last complete month", value: inr(o.lastComplete?.netSpend ?? 0),
                              tone: (o.lastVsNormal?.change ?? 0) > 0 ? .negative : .positive,
                              caption: o.lastVsNormal.map { "\($0.change > 0 ? "▲" : "▼") \(inr(abs($0.change))) (\(Int(abs($0.pct).rounded()))%) vs normal" })
                        Spacer()
                        KStat(label: "Savings rate", value: o.medianSavingsRate.map { "\(Int($0.rounded()))%" } ?? "—",
                              tone: (o.medianSavingsRate ?? 0) >= 0 ? .positive : .negative, caption: "\(o.monthsWithIncome) usable months")
                    }.padding(.top, 10)
                    KRow(title: "Normal income", subtitle: "from months that recorded one", value: inr(o.normalIncome))
                }
                if !o.monthsMissingIncome.isEmpty {
                    KNotice(message: "\(o.monthsMissingIncome.count) of the last 12 months have no salary recorded (\(o.monthsMissingIncome.joined(separator: ", "))). They are left out of the savings rate rather than counted as months you earned nothing.")
                }

                Picker("Window", selection: $window) { Text("6 months").tag(6); Text("12").tag(12); Text("24").tag(24) }.pickerStyle(.segmented)
                KCard {
                    Chart(bars) { b in BarMark(x: .value("Month", b.month, unit: .month), y: .value("₹", b.value)).foregroundStyle(by: .value("Series", b.series)).position(by: .value("Series", b.series)) }
                        .chartForegroundStyleScale(["Spending": Theme.negative, "Income": Theme.positive])
                        .chartXAxis { AxisMarks(values: .stride(by: .month, count: window > 12 ? 6 : 3)) { _ in AxisValueLabel(format: .dateTime.month(.abbreviated)).foregroundStyle(Theme.muted) } }
                        .chartYAxis { AxisMarks { v in AxisGridLine().foregroundStyle(Color.white.opacity(0.06)); AxisValueLabel { if let n = v.as(Double.self) { Text(Money.compact(n)).foregroundStyle(Theme.muted) } } } }
                        .frame(height: 190)
                }

                KSectionHeader(title: "What changed in \(target ?? "—")")
                Menu {
                    ForEach(Array(o.complete.suffix(18).reversed()), id: \.month) { m in Button(m.month) { month = m.month } }
                } label: { Label("Month: \(target ?? "—")", systemImage: "calendar").font(Theme.footnote.weight(.semibold)) }
                Text("Against each category's median over the six months before it.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
                if notable.isEmpty { KCard { Text("Nothing moved by ₹500 or more.").font(Theme.body).foregroundStyle(Theme.muted) } }
                else {
                    KList(items: notable) { r in
                        KRow(title: r.category.capitalized, subtitle: "now \(inr(r.current)) · normal \(inr(r.normal))\(r.isNew ? " · new" : r.stopped ? " · stopped" : r.established ? "" : " · short history")",
                             value: signed(r.change), valueTone: r.change > 0 ? .negative : .positive, valueCaption: r.changePct.map { "\($0 > 0 ? "+" : "")\(Int($0.rounded()))%" })
                    }
                }

                KSectionHeader(title: "Drifting over \(window) months")
                if drifting.isEmpty { KCard { Text("No category is drifting by ₹500 or more.").font(Theme.body).foregroundStyle(Theme.muted) } }
                else {
                    KList(items: drifting) { t in
                        KRow(title: t.category.capitalized, subtitle: "median \(inr(t.before)) → \(inr(t.after)) a month", value: signed(t.change),
                             valueTone: t.direction == "up" ? .negative : .positive, valueCaption: t.direction == "up" ? "rising" : "falling")
                    }
                }

                KSectionHeader(title: "Unusual purchases")
                Text("Single payments at least four times their category's typical one.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
                if outliers.isEmpty { KCard { Text("None in this window.").font(Theme.body).foregroundStyle(Theme.muted) } }
                else {
                    KList(items: Array(outliers.prefix(10))) { x in
                        KRow(title: x.title, subtitle: "\(x.date) · \(x.category.capitalized) · \(String(format: "%.1f", x.timesTypical))× the usual \(inr(x.typical))", value: inr(x.amount))
                    }
                }

                KSectionHeader(title: "Where it goes")
                Text("\(conc.categoriesTo80) of \(conc.categoryCount) categories make up 80% of spending; the top five are \(Int(conc.topFiveShare.rounded()))%.")
                    .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
                KList(items: Array(conc.rows.prefix(10))) { r in
                    VStack(alignment: .leading, spacing: 4) {
                        KRow(title: r.category.capitalized, subtitle: "\(inr(r.perMonth)) a month", value: inr(r.amount), valueCaption: String(format: "%.1f%%", r.share))
                        ProgressView(value: min(1, r.share / 100)).tint(Theme.accent)
                    }
                }
            } else {
                KCard { Text("No transactions to analyse yet.").font(Theme.body).foregroundStyle(Theme.muted) }
            }
        }
        .navigationTitle("Spending Analysis")
        .navigationBarTitleDisplayMode(.large)
    }
}
