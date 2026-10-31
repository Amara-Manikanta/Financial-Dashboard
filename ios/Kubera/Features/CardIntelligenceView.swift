import SwiftUI

/// Whether each card is working for you: how much of the limit is in use now and at its worst,
/// what carrying a balance has cost, which months were revolved, and which cards sit idle. Due
/// dates, rates and fees are not recorded, so none are assumed.
struct CardIntelligenceView: View {
    @ObservedObject var store: FinanceStore
    @State private var open: Set<String> = []

    private func inr(_ v: Double) -> String { Money.rupees(v) }
    private func pct(_ v: Double?) -> String { v.map { String(format: "%.0f%%", $0) } ?? "—" }

    var body: some View {
        let d = store.data
        let ps = Cards.profiles(creditCards: d.creditCardsRaw, expenses: d.expensesRaw)
        let t = Cards.totals(ps)
        KScreen(refresh: { await store.load() }) {
            KCard(tint: t.utilisation > 30 ? Theme.warning : Theme.accent) {
                KStat(label: "Utilisation, all cards", value: String(format: "%.1f%%", t.utilisation), size: .hero)
                Text("\(inr(t.outstanding)) of \(inr(t.limit)) in use · \(inr(t.available)) available").font(Theme.footnote).foregroundStyle(Theme.muted)
                ProgressView(value: min(1, t.utilisation / 100)).tint(t.utilisation > 30 ? Theme.warning : Theme.accent)
                HStack(alignment: .top) {
                    KStat(label: "Interest paid", value: inr(t.interestPaid), tone: t.interestPaid > 0 ? .negative : .positive, caption: "lifetime")
                    Spacer()
                    KStat(label: "Spent through cards", value: inr(t.lifetimeSpend))
                }.padding(.top, 8)
            }
            if !t.idle.isEmpty { KNotice(message: "No use in over 90 days: \(t.idle.joined(separator: ", ")).") }
            Text("Utilisation is on the combined limit — an average of a card at 5% and one at 95% would describe neither.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)

            ForEach(ps) { p in
                KCard {
                    Button { if open.contains(p.id) { open.remove(p.id) } else { open.insert(p.id) } } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack { Text(p.name).font(Theme.body.weight(.bold)).foregroundStyle(.white); Spacer(); if p.isWallet { KBadge(text: "wallet", tone: .neutral) } }
                            HStack(alignment: .top) {
                                KStat(label: "Owed now", value: inr(p.outstanding), caption: p.utilisation.map { "\(pct($0)) of limit" })
                                Spacer()
                                KStat(label: "Lifetime spend", value: inr(p.lifetimeSpend), caption: "\(p.transactionCount) payments")
                            }
                        }
                    }.buttonStyle(.plain)
                    if open.contains(p.id) {
                        row("Limit", p.limit > 0 ? inr(p.limit) : "—")
                        row("Peak month-end balance", "\(inr(p.peakBalance))\(p.peakUtilisation.map { " (\(pct($0)))" } ?? "")")
                        row("Interest paid", inr(p.interestPaid))
                        if !p.interestMonths.isEmpty { row("Interest charged in", "\(p.interestMonths.count) months, last \(p.interestMonths.last!.month)") }
                        row("Average monthly spend (6 mo)", inr(p.averageMonthlySpend))
                        if let c = p.cycle { row("Next statement", "\(c.nextStatement) · \(c.daysToNext) days") }
                        if let idle = p.daysIdle { row("Last used", "\(p.lastUsed ?? "") · \(idle) days ago") }
                        if !p.topCategories.isEmpty {
                            Text("Used for").font(Theme.footnote.weight(.bold)).foregroundStyle(Theme.muted).padding(.top, 4)
                            ForEach(Array(p.topCategories.prefix(5).enumerated()), id: \.offset) { _, c in row(c.category.capitalized, inr(c.amount)) }
                        }
                    }
                }
            }
        }
        .navigationTitle("Card Intelligence")
        .navigationBarTitleDisplayMode(.large)
    }

    private func row(_ k: String, _ v: String) -> some View {
        HStack(alignment: .firstTextBaseline) { Text(k).font(Theme.footnote).foregroundStyle(Theme.muted); Spacer(minLength: 12); Text(v).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white).multilineTextAlignment(.trailing) }
    }
}
