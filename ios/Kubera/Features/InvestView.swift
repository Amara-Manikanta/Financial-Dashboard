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
    @State private var query = ""
    @State private var callFilter = "all"
    @State private var sectorFilter = "all"
    @State private var resultFilter = "all"
    @State private var sort = "value"
    @State private var addingHolding = false
    @State private var refreshingPrices = false
    @State private var deletingHolding: Stocks.Holding?
    @State private var message: String?
    @State private var showArchived = false

    private var filtersActive: Bool { callFilter != "all" || sectorFilter != "all" || resultFilter != "all" || sort != "value" }

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

    private var allHoldings: [Stocks.Holding] { store.portfolio.holdings }

    /// Holdings you archived (or that have no shares left): kept with their history, restorable.
    private var archived: [JSONValue] {
        (store.data.savingsRaw.array.first { $0["type"].text == "stock_market" && !$0["isArchived"].truthy }?["stocks"].array ?? [])
            .filter { $0["isArchived"].truthy && Stocks.isOwn($0) }
    }

    @ViewBuilder private var archivedSection: some View {
        if !archived.isEmpty {
            Button { withAnimation { showArchived.toggle() } } label: {
                HStack { Text("Archived").font(Theme.caption).tracking(1.0).foregroundStyle(Theme.muted); Text("\(archived.count)").font(Theme.caption).foregroundStyle(Theme.muted)
                    Spacer(); Image(systemName: "chevron.down").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.muted).rotationEffect(.degrees(showArchived ? 180 : 0)) }
                    .padding(.horizontal, 4).padding(.top, 8)
            }.buttonStyle(.plain)
            if showArchived {
                KList(items: archived.map { ArchivedRow(raw: $0) }) { a in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) { Text(a.raw["name"].text).font(Theme.body).foregroundStyle(.white); Text(a.raw["ticker"].text).font(Theme.footnote).foregroundStyle(Theme.muted) }
                        Spacer()
                        Button("Restore") { Task { message = await store.saveHoldings(.setArchived(id: a.raw["id"].text, false), label: "Restore \(a.raw["name"].text)") } }
                            .font(Theme.footnote.weight(.bold))
                    }
                }
            }
        }
    }

    private struct ArchivedRow: Identifiable { let raw: JSONValue; var id: String { raw["id"].text } }
    private var sectors: [String] { Array(Set(allHoldings.map(\.sector).filter { !$0.isEmpty })).sorted() }

    private var holdings: [Stocks.Holding] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        let list = allHoldings.filter { h in
            (q.isEmpty || h.name.lowercased().contains(q) || h.ticker.lowercased().contains(q) || h.sector.lowercased().contains(q))
            && (callFilter == "all" || (callFilter == "none" ? store.research[h.id] == nil : store.research[h.id]?.call == callFilter))
            && (sectorFilter == "all" || h.sector == sectorFilter)
            && (resultFilter == "all" || (resultFilter == "gain" ? h.gain >= 0 : h.gain < 0))
        }
        switch sort {
        case "gain": return list.sorted { $0.gainPercent > $1.gainPercent }
        case "loss": return list.sorted { $0.gainPercent < $1.gainPercent }
        case "name": return list.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        default: return list.sorted { $0.value > $1.value }
        }
    }

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
            if let message {
                if message.hasPrefix("Prices updated") { Label(message, systemImage: "checkmark.circle.fill").font(Theme.footnote.weight(.semibold)).foregroundStyle(Theme.positive).padding(.horizontal, 4) }
                else { KNotice(message: message) { self.message = nil } }
            }
            KSectionHeader(title: "Stocks", detail: holdings.count == allHoldings.count ? "\(holdings.count) holdings" : "\(holdings.count) of \(allHoldings.count)")
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
                    if store.research[holding.id] != nil || !holding.sector.isEmpty {
                        HStack(spacing: 8) {
                            if !holding.sector.isEmpty { KBadge(text: holding.sector, tone: .neutral) }
                            if let c = store.research[holding.id] {
                                KBadge(text: c.call, tone: ResearchTone.of(c.call))
                                if c.ageDays > 0 { Text("\(c.ageDays)d ago").font(Theme.footnote).foregroundStyle(Theme.muted) }
                            }
                            Spacer()
                        }
                        .padding(.top, 6)
                    }
                    if expanded.contains(holding.id) { details(holding).padding(.top, 8) }
                }
                .contextMenu {
                    Button { Task { message = await store.saveHoldings(.setArchived(id: holding.id, true), label: "Archive \(holding.name)") } } label: { Label("Archive", systemImage: "archivebox") }
                    Button(role: .destructive) { deletingHolding = holding } label: { Label("Delete", systemImage: "trash") }
                }
            }
            archivedSection
            if holdings.isEmpty && store.loadedAt != nil && !allHoldings.isEmpty {
                KCard { Text("No stock matches this search and filter.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            }
            if allHoldings.isEmpty && store.loadedAt != nil {
                KCard { Text("No active stock holdings.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            }
        }
        .navigationTitle("Stocks")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $query, prompt: "Search name, ticker or sector")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                HStack(spacing: 14) {
                    Button { Task { refreshingPrices = true; message = nil; message = await store.refreshPrices(); refreshingPrices = false } } label: {
                        if refreshingPrices { ProgressView() } else { Image(systemName: "arrow.clockwise") }
                    }.disabled(refreshingPrices)
                    Button { addingHolding = true } label: { Image(systemName: "plus") }
                }
            }
            ToolbarItem(placement: .secondaryAction) {
                Menu {
                    Picker("Research call", selection: $callFilter) {
                        Text("Any call").tag("all")
                        ForEach(["BUY", "ACCUMULATE", "HOLD", "REVIEW", "SELL"], id: \.self) { Text($0.capitalized).tag($0) }
                        Text("No call yet").tag("none")
                    }
                    Picker("Sector", selection: $sectorFilter) {
                        Text("All sectors").tag("all")
                        ForEach(sectors, id: \.self) { Text($0).tag($0) }
                    }
                    Picker("Result", selection: $resultFilter) {
                        Text("Gain and loss").tag("all"); Text("In profit").tag("gain"); Text("In loss").tag("loss")
                    }
                    Picker("Sort by", selection: $sort) {
                        Text("Value").tag("value"); Text("Best return").tag("gain"); Text("Worst return").tag("loss"); Text("Name").tag("name")
                    }
                    if filtersActive || !query.isEmpty {
                        Button("Clear filters", role: .destructive) { callFilter = "all"; sectorFilter = "all"; resultFilter = "all"; sort = "value"; query = "" }
                    }
                } label: {
                    Image(systemName: filtersActive ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                }
            }
        }
        .sheet(isPresented: $addingHolding) { NewHoldingSheet(store: store) }
        .confirmationDialog("Delete this holding?", isPresented: Binding(get: { deletingHolding != nil }, set: { if !$0 { deletingHolding = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let h = deletingHolding {
                    if let block = HoldingEditing.deleteBlock(h.raw) { message = block }
                    else { Task { message = await store.saveHoldings(.delete(id: h.id), label: "Delete \(h.name)") } }
                }
            }
        } message: { Text("\(deletingHolding?.name ?? "") and all its transactions are removed from your Mac. Archive it instead to keep the history.") }
        .navigationDestination(for: AccountRoute.self) { AccountDetailView(store: store, route: $0) }
        .navigationDestination(for: String.self) { id in
            if let holding = store.portfolio.holdings.first(where: { $0.id == id }) { HoldingView(store: store, holdingId: holding.id) }
        }
    }
}


/// A new stock holding, as the Mac's Add Stock form: name, ticker, shares and the average price paid (which becomes its opening buy),
/// sector, market cap and whether it pays dividends. Saved as the stock account's list, under its version.
struct NewHoldingSheet: View {
    @ObservedObject var store: FinanceStore
    @State private var f = HoldingEditing.Form()

    var body: some View {
        FormSheet(title: "Add stock", problems: HoldingEditing.problems(f), touched: !f.name.isEmpty, save: {
            await store.saveHoldings(.add(HoldingEditing.newHolding(f, today: NewTransaction.isoDay(Date()))), label: "Add \(f.name)")
        }) {
            Section {
                TextRow(label: "Company", text: $f.name)
                TextRow(label: "Ticker", text: $f.ticker)
                NumberRow(label: "Shares held", text: $f.shares)
                NumberRow(label: "Average price ₹", text: $f.avgCost)
            } footer: { Text("With shares, an opening buy dated today is recorded, so the holding's history starts from what you entered.") }
            Section {
                Picker("Sector", selection: $f.sector) { Text("—").tag(""); ForEach(HoldingEditing.sectors, id: \.self) { Text($0).tag($0) } }
                Picker("Market cap", selection: $f.marketCap) { ForEach(HoldingEditing.marketCaps, id: \.self) { Text($0).tag($0) } }
                Toggle("Pays dividends", isOn: $f.expectsDividends)
                TextRow(label: "Remarks", text: $f.remarks)
            }
        }
    }
}
