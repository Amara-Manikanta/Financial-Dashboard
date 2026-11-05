import SwiftUI

/// Every card with what is due on it. A card's own page (its statements, edits) is on the Mac.
struct CardsView: View {
    @ObservedObject var store: FinanceStore
    @Environment(\.openWebPage) private var openWebPage

    private func inr(_ v: Double) -> String { Money.rupees(v) }

    var body: some View {
        let d = store.data
        let r = Cards.listCards(creditCards: d.creditCardsRaw, expenses: d.expensesRaw)
        KScreen(refresh: { await store.load() }) {
            KCard(tint: Theme.accent) {
                KStat(label: "Due across cards", value: inr(r.totalDue), size: .hero)
                Text("unpaid statements, or what has been spent since the last one").font(Theme.footnote).foregroundStyle(Theme.muted)
            }
            if r.cards.isEmpty { KCard { Text("No cards yet. Add one on the Mac.").font(Theme.body).foregroundStyle(Theme.muted) } }
            ForEach(r.cards) { c in
                NavigationLink(value: CardRoute(id: c.id)) {
                    KCard {
                        HStack { Text(c.name).font(Theme.body.weight(.bold)).foregroundStyle(.white); Spacer()
                            Text(c.isWallet ? "Wallet" : c.raw["last4Digits"].truthy ? "•••• \(c.raw["last4Digits"].text)" : "Card").font(.system(.footnote, design: .monospaced)).foregroundStyle(Theme.muted) }
                        if c.raw["bankName"].truthy { Text(c.raw["bankName"].text).font(Theme.footnote).foregroundStyle(Theme.muted) }
                        if c.isWallet {
                            HStack(alignment: .top) {
                                KStat(label: "Available", value: inr(c.wallet), tone: .positive)
                                Spacer()
                                KStat(label: "Auto-load", value: c.raw["autoCredit"]["amount"].truthy ? inr(c.raw["autoCredit"]["amount"].double) : "Manual")
                            }
                        } else {
                            HStack(alignment: .top) {
                                KStat(label: "Limit", value: inr(c.raw["creditLimit"].double))
                                Spacer()
                                KStat(label: c.unbilled ? "Unbilled" : "Due", value: inr(c.due), tone: c.due > 0 ? .negative : .positive)
                                Spacer()
                                KStat(label: "Points", value: Int(c.points).formatted(), tone: .warning)
                            }
                        }
                    }
                }.buttonStyle(.plain)
            }
        }
        .navigationTitle("Cards")
        .toolbar {
            ToolbarItem(placement: .primaryAction) { NewRecordButton(store: store, collection: "creditCards", records: store.data.creditCardsRaw.array) }
        }
        .navigationBarTitleDisplayMode(.large)
        .navigationDestination(for: CardRoute.self) { CardDetailView(store: store, route: $0) }
    }
}
