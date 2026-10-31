import SwiftUI

/// A worklist of what is wrong or untidy in the records. Nothing is repaired automatically;
/// the fixes themselves are made on the Mac.
struct DataHealthView: View {
    @ObservedObject var store: FinanceStore
    @State private var toggled: [String: Bool] = [:]

    private func inr(_ v: Double) -> String { Money.rupees(v) }
    private func color(_ s: DataHealth.Severity) -> Color { switch s { case .high: Theme.negative; case .medium: Theme.warning; case .low: Theme.accent; case .ok: Theme.positive } }
    private func label(_ s: DataHealth.Severity) -> String { switch s { case .high: "Needs attention"; case .medium: "Worth cleaning"; case .low: "Minor"; case .ok: "Clean" } }

    var body: some View {
        let d = store.data
        let checks = DataHealth.run(expenses: d.expensesRaw, salaryDetails: d.salaryRaw, creditCards: d.creditCardsRaw, assets: d.assetsRaw)
        let clean = checks.filter { $0.severity == .ok }.count
        KScreen(refresh: { await store.load() }) {
            KCard(tint: Theme.accent) {
                KStat(label: "Checks passing", value: "\(clean) of \(checks.count)", size: .hero)
                Text("Each check names the rows it found, so it can be worked through rather than only counted.").font(Theme.footnote).foregroundStyle(Theme.muted)
            }
            ForEach(checks) { c in
                let open = toggled[c.id] ?? (c.severity == .high)
                KCard(tint: c.severity == .ok ? nil : color(c.severity)) {
                    Button { toggled[c.id] = !open } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 3) {
                                    KBadge(text: label(c.severity), tone: c.severity == .high ? .negative : c.severity == .medium ? .warning : c.severity == .ok ? .positive : .accent)
                                    Text(c.title).font(Theme.body.weight(.semibold)).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 1) {
                                    Text(c.severity == .ok ? "✓" : "\(c.count)").font(.system(size: 24, weight: .black)).foregroundStyle(color(c.severity))
                                    if c.total > 0 { Text(inr(c.total)).font(Theme.footnote).foregroundStyle(Theme.muted) }
                                }
                            }
                            Text(c.detail).font(Theme.footnote).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true)
                        }
                    }.buttonStyle(.plain)
                    if open {
                        ForEach(Array(c.sample.enumerated()), id: \.offset) { _, s in
                            HStack(alignment: .firstTextBaseline) {
                                Text("\(s.date.map { "\($0)  " } ?? "")\(s.label)").font(Theme.footnote).foregroundStyle(.white.opacity(0.85)).lineLimit(2)
                                Spacer(minLength: 8)
                                if let a = s.amount { Text(inr(abs(a))).font(Theme.footnote.weight(.semibold)).foregroundStyle(Theme.muted) }
                            }
                        }
                        if c.count > c.sample.count && c.severity != .ok { Text("… and \(c.count - c.sample.count) more").font(Theme.footnote).foregroundStyle(Theme.muted) }
                        if c.severity != .ok { Text("Fix: \(c.fix)").font(Theme.footnote).foregroundStyle(Theme.muted) }
                    }
                }
            }
        }
        .navigationTitle("Data Health")
        .navigationBarTitleDisplayMode(.large)
    }
}
