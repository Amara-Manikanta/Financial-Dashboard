import SwiftUI

struct InvestView: View {
    @ObservedObject var store: FinanceStore

    private var holdings: [Stocks.Holding] { store.portfolio.holdings.sorted { $0.value > $1.value } }

    var body: some View {
        NavigationStack {
            KScreen(refresh: { await store.load() }) {
                if let message = store.errorMessage { KNotice(message: message) { Task { await store.load() } } }
                KCard(tint: Theme.accent) {
                    KStat(label: "Current value", value: Money.rupees(store.portfolio.value), size: .hero)
                    HStack(alignment: .top) {
                        KStat(label: "Invested", value: Money.rupees(store.portfolio.invested))
                        Spacer()
                        KStat(label: "Gain", value: Fmt.signed(store.portfolio.gain), tone: Tone.of(store.portfolio.gain),
                              caption: Fmt.percent(store.portfolio.gainPercent))
                    }
                    .padding(.top, 10)
                }
                KSectionHeader(title: "Stocks", detail: "\(holdings.count) holdings")
                KList(items: holdings) { holding in
                    NavigationLink(value: holding.id) {
                        KRow(title: holding.name, subtitle: "\(Fmt.shares(holding.shares)) × \(Money.rupees(holding.price))",
                             value: Money.rupees(holding.value), valueTone: .neutral,
                             valueCaption: "\(Fmt.signed(holding.gain)) · \(Fmt.percent(holding.gainPercent))",
                             captionTone: Tone.of(holding.gain), chevron: true)
                    }
                    .buttonStyle(.plain)
                }
                if holdings.isEmpty && store.loadedAt != nil {
                    KCard { Text("No active stock holdings.").font(Theme.footnote).foregroundStyle(Theme.muted) }
                }
            }
            .navigationTitle("Investments")
            .navigationDestination(for: String.self) { id in
                if let holding = store.portfolio.holdings.first(where: { $0.id == id }) { HoldingView(holding: holding) }
            }
        }
    }
}

private struct HoldingView: View {
    let holding: Stocks.Holding

    private struct Row: Identifiable { let id: Int; let tx: JSONValue }
    private var history: [Row] {
        holding.raw["transactions"].array.enumerated()
            .sorted { $0.element["date"].text > $1.element["date"].text }
            .map { Row(id: $0.offset, tx: $0.element) }
    }

    var body: some View {
        KScreen {
            KCard {
                KStat(label: "Value", value: Money.rupees(holding.value), size: .hero)
                HStack(alignment: .top) {
                    KStat(label: "Gain", value: Fmt.signed(holding.gain), tone: Tone.of(holding.gain), caption: Fmt.percent(holding.gainPercent))
                    Spacer()
                    KStat(label: "Invested", value: Money.rupees(holding.invested))
                }
                .padding(.top, 10)
            }
            KCard {
                HStack(alignment: .top) {
                    KStat(label: "Shares", value: Fmt.shares(holding.shares))
                    Spacer()
                    KStat(label: "Avg cost", value: Money.rupees(holding.avgCost))
                    Spacer()
                    KStat(label: "Price", value: Money.rupees(holding.price))
                }
                if !holding.sector.isEmpty { KBadge(text: holding.sector).padding(.top, 10) }
            }
            if !history.isEmpty {
                KSectionHeader(title: "Transactions", detail: "\(history.count)")
                KList(items: history) { row in
                    let tx = row.tx
                    let money = tx["quantity"].double * tx["price"].double
                    KRow(title: tx["type"].text.capitalized,
                         subtitle: Fmt.date(tx["date"].text),
                         value: ["dividend", "bonus", "split"].contains(tx["type"].text) ? nil : Money.rupees(money),
                         valueCaption: ["dividend", "split"].contains(tx["type"].text) ? nil : "\(Fmt.shares(tx["quantity"].double)) @ \(Money.rupees(tx["price"].double))")
                }
            }
        }
        .navigationTitle(holding.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}
