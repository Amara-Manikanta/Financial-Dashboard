import SwiftUI
import Charts

/// Money contributed over time, rebuilt from dated records. Not market value: the database
/// keeps today's price for each holding and none for earlier days.
struct NetWorthHistoryView: View {
    @ObservedObject var store: FinanceStore
    private enum Range: String, CaseIterable, Identifiable { case all = "All", y5 = "5Y", y3 = "3Y", y1 = "1Y"; var id: String { rawValue }
        var months: Int? { switch self { case .all: nil; case .y5: 60; case .y3: 36; case .y1: 12 } } }
    @State private var range = Range.all

    private static let names: [(key: String, label: String, color: Color)] = [
        ("gold", "Gold & silver", .yellow), ("deposits", "Deposits", .cyan), ("retirement", "PF, PPF & NPS", .purple),
        ("property", "Property", .pink), ("equities", "Equities", .green), ("cash", "Cash", .gray),
    ]
    private struct Slice: Identifiable { let id = UUID(); let month: String; let label: String; let value: Double }

    private func inr(_ v: Double) -> String { Money.rupees(Money.jsRound(v)) }

    var body: some View {
        let d = store.data
        let s = NetWorthHistory.series(savings: d.savingsRaw, metals: d.metalsRaw, assets: d.assetsRaw, loans: d.loansRaw)
        let shown = range.months.map { Array(s.points.suffix($0)) } ?? s.points
        let latest = s.points.last, first = shown.first
        let growth = (latest != nil && first != nil) ? latest!.net - first!.net : 0
        let slices = shown.flatMap { p in Self.names.map { Slice(month: p.month, label: $0.label, value: p.values[$0.key] ?? 0) } }

        KScreen(refresh: { await store.load() }) {
            if s.points.isEmpty {
                KCard { Text("No dated records to build a history from.").font(Theme.body).foregroundStyle(Theme.muted) }
            } else {
                KCard(tint: Theme.accent) {
                    KStat(label: "Contributed to date", value: inr(latest?.net ?? 0), size: .hero)
                    Text("net of \(inr(latest?.debt ?? 0)) still owed · \(s.points.count) months back to \(s.points[0].month)").font(Theme.footnote).foregroundStyle(Theme.muted)
                    HStack(alignment: .top) {
                        KStat(label: "Added in range", value: inr(growth), tone: growth >= 0 ? .positive : .negative, caption: shown.count > 1 ? "\(inr(growth / Double(shown.count))) a month" : nil)
                        Spacer()
                        KStat(label: "Not on timeline", value: inr(s.undated.total), tone: s.undated.total > 0 ? .warning : .neutral, caption: "\(s.undated.items.count) undated")
                    }.padding(.top, 10)
                }
                Picker("Range", selection: $range) { ForEach(Range.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.segmented)

                KCard {
                    Chart(slices) { x in
                        AreaMark(x: .value("Month", x.month), y: .value("Amount", x.value)).foregroundStyle(by: .value("Part", x.label))
                    }
                    .chartForegroundStyleScale(domain: Self.names.map(\.label), range: Self.names.map(\.color))
                    .chartXAxis { AxisMarks(values: .automatic(desiredCount: 4)) { _ in AxisValueLabel().foregroundStyle(Theme.muted) } }
                    .chartYAxis { AxisMarks { v in AxisGridLine().foregroundStyle(Color.white.opacity(0.06)); AxisValueLabel { if let n = v.as(Double.self) { Text(Money.compact(n)).foregroundStyle(Theme.muted) } } } }
                    .frame(height: 220)
                }
                Text("This is money put in, not market value: purchases at what you paid, deposits at face value, less debt still owed. Its slope is your saving rate, not the market's mood.")
                    .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)

                let steps = NetWorthHistory.bigSteps(s.points)
                if !steps.isEmpty {
                    KSectionHeader(title: "Steps worth checking")
                    Text("These months jump by over a quarter in one step — usually the day older holdings were entered, not bought. Confirm before reading one as a windfall.")
                        .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
                    KList(items: steps) { st in KRow(title: st.month, subtitle: "\(inr(st.from)) → \(inr(st.to))", value: "+\(inr(st.jump))", valueTone: .warning) }
                }
                if s.undated.total > 0 {
                    KSectionHeader(title: "Could not be placed in time")
                    Text("\(s.undated.items.count) holdings carry no purchase date, so they are on no month of the chart. Adding dates on the Mac puts them on the line.")
                        .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
                    KList(items: Array(s.undated.items.prefix(6).enumerated().map { Indexed(id: $0.offset, item: $0.element) })) { r in
                        KRow(title: r.item.name, subtitle: r.item.kind, value: inr(r.item.amount))
                    }
                }
                KSectionHeader(title: "Added each year")
                KList(items: NetWorthHistory.contributionByYear(s.points).reversed()) { y in
                    KRow(title: y.year, subtitle: "total \(inr(y.net))", value: inr(y.added), valueTone: y.added >= 0 ? .positive : .negative)
                }
            }
        }
        .navigationTitle("Net Worth Over Time")
        .navigationBarTitleDisplayMode(.large)
    }

    private struct Indexed: Identifiable { let id: Int; let item: NetWorthHistory.Undated.Item }
}
