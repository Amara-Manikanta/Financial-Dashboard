import SwiftUI

/// The Investments tab: every mutual fund, stock account and gold bond together.
/// Port of Investments.jsx; the stock account opens the native holdings list,
/// the rest open the Mac's own account page until they are rebuilt here.
struct InvestView: View {
    @ObservedObject var store: FinanceStore
    @Environment(\.openWebPage) private var openWebPage
    @State private var showArchived = false

    private var summary: InvestmentsPage.Summary { store.investments }

    var body: some View {
        NavigationStack {
            KScreen(refresh: { await store.load() }) {
                if let message = store.errorMessage { KNotice(message: message) { Task { await store.load() } } }

                KCard(tint: Theme.accent) {
                    KStat(label: "Current value", value: Money.rupees(summary.value), size: .hero)
                    HStack(alignment: .top) {
                        KStat(label: "Invested", value: Money.rupees(summary.invested))
                        Spacer()
                        KStat(label: "Gain", value: Fmt.signed(summary.profitLoss), tone: Tone.of(summary.profitLoss),
                              caption: Fmt.percent(summary.returnPercent))
                    }
                    .padding(.top, 10)
                }

                AllocationCard(slices: AllocationCard.condensed(summary.allocation.map { AllocationSlice(name: $0.name, value: $0.value) }))

                KSectionHeader(title: "Accounts", detail: "\(summary.active.count)")
                KList(items: summary.active.sorted { $0.value > $1.value }) { account in accountRow(account) }

                if !summary.archived.isEmpty {
                    Button { withAnimation { showArchived.toggle() } } label: {
                        KSectionHeader(title: showArchived ? "Hide archived" : "Show archived", detail: "\(summary.archived.count)")
                    }
                    .buttonStyle(.plain)
                    if showArchived { KList(items: summary.archived) { account in accountRow(account) } }
                }
            }
            .navigationTitle("Investments")
            .navigationDestination(for: NativeScreen.self) { NativeDestination(screen: $0, store: store) }
            // Funds, deposits, policies… open here; the link existed but nothing answered it.
            .navigationDestination(for: AccountRoute.self) { AccountDetailView(store: store, route: $0) }
        }
    }

    @ViewBuilder private func accountRow(_ account: SavingsPage.Account) -> some View {
        let row = KRow(title: account.title, subtitle: account.typeLabel.capitalized, value: Money.rupees(account.value),
                       valueCaption: "\(Fmt.signed(account.gain)) · \(Fmt.percent(account.gainPercent))",
                       captionTone: Tone.of(account.gain), chevron: true)
        if account.type == "stock_market" {
            NavigationLink(value: NativeScreen.stocks) { row }.buttonStyle(.plain)
        } else if let path = account.webPath {
            NavigationLink(value: AccountRoute(id: account.id)) { row }.buttonStyle(.plain)
        } else {
            row
        }
    }
}

/// Every stock holding of your own, valued as the web Dashboard does.
struct StocksView: View {
    @ObservedObject var store: FinanceStore
    @State private var expanded: Set<String> = []

    /// What a row hides until it is opened: where the price sits in its ranges, the day's move,
    /// cost, weight in the stock portfolio and sector.
    @ViewBuilder private func details(_ h: Stocks.Holding) -> some View {
        let q = h.raw["quote"]
        let previous = q["previousClose"].double
        let day = previous > 0 && h.price > 0 ? (h.price - previous) / previous * 100 : nil
        let weight = store.portfolio.value > 0 ? h.value / store.portfolio.value * 100 : 0
        VStack(alignment: .leading, spacing: 10) {
            StockRanges(raw: h.raw, price: h.price)
            HStack(alignment: .top) {
                KStat(label: "Avg cost", value: Money.rupees(h.avgCost))
                Spacer()
                KStat(label: "Invested", value: Money.rupees(h.invested))
                Spacer()
                KStat(label: "Weight", value: String(format: "%.1f%%", weight))
            }
            HStack(alignment: .top) {
                if let day { KStat(label: "Today", value: Fmt.percent(day), tone: Tone.of(day)) }
                Spacer()
                if !h.sector.isEmpty { KBadge(text: h.sector) }
            }
        }
    }

    private var holdings: [Stocks.Holding] { store.portfolio.holdings.sorted { $0.value > $1.value } }

    var body: some View {
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
                VStack(spacing: 0) {
                    HStack(spacing: 8) {
                        NavigationLink(value: holding.id) {
                            KRow(title: holding.name, subtitle: "\(Fmt.shares(holding.shares)) × \(Money.rupees(holding.price))",
                                 value: Money.rupees(holding.value), valueTone: .neutral,
                                 valueCaption: "\(Fmt.signed(holding.gain)) · \(Fmt.percent(holding.gainPercent))",
                                 captionTone: Tone.of(holding.gain))
                        }
                        .buttonStyle(.plain)
                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) { if expanded.contains(holding.id) { expanded.remove(holding.id) } else { expanded.insert(holding.id) } }
                        } label: {
                            Image(systemName: "chevron.down").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.muted)
                                .rotationEffect(.degrees(expanded.contains(holding.id) ? 180 : 0)).frame(width: 32, height: 32)
                        }
                        .buttonStyle(.plain)
                    }
                    if expanded.contains(holding.id) { details(holding).padding(.top, 8) }
                }
            }
            if holdings.isEmpty && store.loadedAt != nil {
                KCard { Text("No active stock holdings.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            }
        }
        .navigationTitle("Stocks")
        .navigationBarTitleDisplayMode(.large)
        .navigationDestination(for: AccountRoute.self) { AccountDetailView(store: store, route: $0) }
        .navigationDestination(for: String.self) { id in
            if let holding = store.portfolio.holdings.first(where: { $0.id == id }) { HoldingView(store: store, holdingId: holding.id) }
        }
    }
}
