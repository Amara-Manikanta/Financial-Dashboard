import SwiftUI

/// Which holdings you no longer have any of your own money in. Average cost cannot say
/// so: it keeps every remaining share at its original price, however much has since been
/// taken off the table. This is cash in against cash out — nothing is marked to market.
struct FreeHoldingsView: View {
    @ObservedObject var store: FinanceStore
    private var page: FreeHoldingsPage.Page { store.freeHoldings }
    private func inr(_ v: Double) -> String { Money.rupees(v) }

    var body: some View {
        KScreen(refresh: { await store.load() }) {
            Text("Selling part of a position, plus the dividends it has paid, can return everything that was put in. What is still held then costs nothing, however much the average price still says it did.")
                .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)

            let t = page.totals
            KCard(tint: Theme.accent) {
                KStat(label: "Your money still at risk", value: inr(t.stillAtRisk), size: .hero)
                Text("of \(inr(t.invested)) put into positions you still hold").font(Theme.footnote).foregroundStyle(Theme.muted)
                HStack(alignment: .top) {
                    KStat(label: "Free positions", value: "\(t.freeCount)", tone: t.freeCount > 0 ? .positive : .neutral,
                          caption: t.freeCount > 0 ? "worth \(inr(t.freeValue))\(t.bonusShares > 0 ? " · \(Fmt.shares(t.bonusShares)) bonus shares" : "")" : nil)
                    Spacer()
                    KStat(label: "Recovered", value: inr(t.recovered), tone: .positive, caption: String(format: "%.0f%% of what went in", page.recoveredPctOfPortfolio))
                }
                .padding(.top, 10)
            }

            if !page.free.isEmpty {
                section("Free", "cost fully recovered, shares still held") {
                    KList(items: page.free) { r in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(r.name).font(Theme.body).foregroundStyle(.white).lineLimit(2)
                                Spacer()
                                Text(inr(r.value)).font(Theme.figure).foregroundStyle(.white)
                            }
                            Text("\(inr(r.invested)) in · \(inr(r.recovered)) back (\(Int(Money.jsRound(r.rawPct)))%)\(r.dividends > 0 ? " incl. \(inr(r.dividends)) dividends" : "") · surplus \(inr(r.surplus)) · \(Fmt.shares(r.shares)) shares")
                                .font(Theme.footnote).foregroundStyle(Theme.positive)
                        }
                    }
                }
            }

            if !page.almost.isEmpty {
                section("Nearly free", "past \(Int(CostRecovery.nearlyFreeFrom))% recovered — still your own money in the market") {
                    KList(items: page.almost) { r in
                        KRow(title: r.name, subtitle: "\(inr(r.outstandingCost)) still at risk · \(inr(r.netCostPerShare)) a share net",
                             value: "\(Int(Money.jsRound(r.rawPct)))%", valueTone: .warning, valueCaption: inr(r.value))
                    }
                }
            }

            if !page.cashless.isEmpty {
                section("Arrived without a payment", "demerged or bonus; a demerger carries part of the parent's cost, so these are not free") {
                    KList(items: page.cashless) { r in
                        KRow(title: r.name, subtitle: "\(Fmt.shares(r.shares)) shares" + (r.allocatedBasis > 0 ? " · cost carried \(inr(r.allocatedBasis))" : "") + (r.dividends > 0 ? " · dividends \(inr(r.dividends))" : ""),
                             value: inr(r.value))
                    }
                }
            }

            section("All positions", "ranked by how much of the cost is back") {
                KList(items: page.all) { r in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(r.name).font(Theme.body).foregroundStyle(.white).lineLimit(2)
                            Spacer()
                            Text("\(Int(Money.jsRound(r.rawPct)))%").font(Theme.figure).foregroundStyle(r.isFree ? Theme.positive : .white)
                        }
                        ProgressView(value: min(1, r.recoveredPct / 100)).tint(r.isFree ? Theme.positive : Theme.accent)
                        Text("\(inr(r.invested)) in · \(inr(r.recovered)) back · worth \(inr(r.value))").font(Theme.footnote).foregroundStyle(Theme.muted)
                    }
                }
            }
        }
        .navigationTitle("Free Holdings")
        .navigationBarTitleDisplayMode(.large)
    }

    private func section<Content: View>(_ title: String, _ detail: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            KSectionHeader(title: title)
            Text(detail).font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            content()
        }
    }
}
