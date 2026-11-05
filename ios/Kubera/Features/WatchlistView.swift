import SwiftUI

/// Companies you follow but do not own, in the order you said they matter.
/// Everything here is descriptive: a price near its 52-week low is reported as a
/// position in a range, and the only thresholds that raise anything are ones you set.
struct WatchlistView: View {
    @ObservedObject var store: FinanceStore

    @State private var sort: WatchlistPage.Sort = .priority
    @State private var priority = "All"
    @State private var risk = "All"
    @State private var sector = "All"
    @State private var cap = "All"

    private var page: WatchlistPage.Summary { store.watchlist }
    private var activeFilters: Int { [priority, risk, sector, cap].filter { $0 != "All" }.count }

    private var rows: [WatchlistPage.Row] {
        WatchlistPage.sorted(page.rows, by: sort).filter {
            (priority == "All" || $0.priority == priority) && (risk == "All" || $0.risk == risk)
                && (sector == "All" || $0.sector == sector) && (cap == "All" || $0.cap == cap)
        }
    }

    var body: some View {
        KScreen(refresh: { await store.load() }) {
            Text("Prices and 52-week ranges come from the same refresh as your holdings; the priority, risk and alert levels are yours.")
                .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)

            HStack(spacing: 12) {
                tile("Watching", "\(page.rows.count)", tint: nil, note: "on your list")
                tile("Marked ready", "\(page.priorityCounts["ready"] ?? 0)", tint: (page.priorityCounts["ready"] ?? 0) > 0 ? Theme.accent : nil, note: "your call, not the app's")
            }
            HStack(spacing: 12) {
                tile("Lower \(Int(PriceRange.nearEdgePct))% of range", "\(page.nearLow)", tint: page.nearLow > 0 ? Color(red: 0.38, green: 0.65, blue: 0.98) : nil, note: "a position, not a signal")
                tile("Alerts triggered", "\(page.firedCount)", tint: page.firedCount > 0 ? Color(red: 0.75, green: 0.52, blue: 0.99) : nil, note: "levels you set yourself")
            }

            controls

            if sort == .priority {
                ForEach(["ready", "interested", "watching", "unset"], id: \.self) { key in
                    let group = rows.filter { $0.priority == key }
                    if !group.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            KSectionHeader(title: WatchlistRisk.priorityLabel(key), detail: "\(group.count)")
                            Text(WatchlistRisk.priorityBlurb(key)).font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
                            list(group)
                        }
                    }
                }
            } else {
                list(rows)
            }
            if rows.isEmpty { KCard { Text(page.rows.isEmpty ? "Nothing on the watchlist yet." : "No entry matches these filters.").font(Theme.footnote).foregroundStyle(Theme.muted) } }
        }
        .navigationTitle("Watchlist")
        .toolbar {
            ToolbarItem(placement: .primaryAction) { NewRecordButton(store: store, collection: "watchlist", records: store.data.watchlistRaw.array) }
        }
        .navigationBarTitleDisplayMode(.large)
    }

    // MARK: Pieces

    private func tile(_ label: String, _ value: String, tint: Color?, note: String? = nil) -> some View {
        KCard(tint: tint) {
            KStat(label: label, value: value, tone: tint == nil ? .neutral : .accent, caption: note, size: .large)
        }
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("Sort", selection: $sort) { ForEach(WatchlistPage.Sort.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.segmented)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    menu("Priority", selection: $priority, options: ["ready", "interested", "watching", "unset"].filter { (page.priorityCounts[$0] ?? 0) > 0 },
                         label: { WatchlistRisk.priorityLabel($0) + " \(page.priorityCounts[$0] ?? 0)" })
                    menu("Risk", selection: $risk, options: (WatchlistRisk.riskLevels + ["unrated"]).filter { (page.riskCounts[$0] ?? 0) > 0 },
                         label: { WatchlistRisk.riskLabel($0) + " \(page.riskCounts[$0] ?? 0)" })
                    menu("Sector", selection: $sector, options: page.sectorCounts.map(\.name),
                         label: { name in "\(Sectors.icon(name)) \(name) \(page.sectorCounts.first { $0.name == name }?.count ?? 0)" })
                    menu("Cap", selection: $cap, options: page.capCounts.map(\.name),
                         label: { name in "\(name) \(page.capCounts.first { $0.name == name }?.count ?? 0)" })
                    if activeFilters > 0 {
                        Button("Clear \(activeFilters)") { priority = "All"; risk = "All"; sector = "All"; cap = "All" }
                            .font(Theme.footnote.weight(.bold)).foregroundStyle(Theme.accent)
                    }
                }
            }
            if activeFilters > 0 { Text("showing \(rows.count) of \(page.rows.count)").font(Theme.footnote).foregroundStyle(Theme.muted) }
        }
    }

    private func menu(_ title: String, selection: Binding<String>, options: [String], label: @escaping (String) -> String) -> some View {
        Menu {
            Button("All") { selection.wrappedValue = "All" }
            ForEach(options, id: \.self) { option in Button(label(option)) { selection.wrappedValue = option } }
        } label: {
            HStack(spacing: 4) {
                Text(selection.wrappedValue == "All" ? title : label(selection.wrappedValue))
                Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold))
            }
            .font(Theme.footnote.weight(.bold))
            .padding(.horizontal, 12).padding(.vertical, 7)
            .foregroundStyle(selection.wrappedValue == "All" ? Theme.muted : .white)
            .background(selection.wrappedValue == "All" ? Color.white.opacity(0.04) : Theme.accent.opacity(0.22), in: Capsule())
        }
    }

    private func list(_ items: [WatchlistPage.Row]) -> some View {
        KList(items: items) { row in
            VStack(alignment: .leading, spacing: 8) {
                KRow(title: row.name, subtitle: "\(row.ticker) · \(Sectors.icon(row.sector)) \(row.sector)",
                     value: row.quote.price.map { Money.rupees($0) } ?? "—",
                     valueCaption: row.quote.dayChangePct.map { Fmt.percent($0) }, captionTone: row.quote.dayChangePct.map { Tone.of($0) })
                if let position = row.quote.rangePct { RangeBar(position: position, low: row.quote.low, high: row.quote.high) }
                HStack(spacing: 6) {
                    KBadge(text: WatchlistRisk.priorityLabel(row.priority), tone: row.priority == "ready" ? .accent : .neutral)
                    KBadge(text: row.risk == "unrated" ? "Unrated" : "\(WatchlistRisk.riskLabel(row.risk)) risk",
                           tone: row.risk == "high" ? .negative : row.risk == "low" ? .positive : row.risk == "medium" ? .warning : .neutral)
                    if row.cap != "Unclassified" { KBadge(text: row.cap, tone: .neutral) }
                }
                ForEach(row.fired, id: \.id) { alert in
                    Label("\(alert.type == "below" ? "At or below" : "At or above") \(Money.rupees(alert.price))\(alert.note.isEmpty ? "" : " — \(alert.note)")",
                          systemImage: "bell.fill").font(Theme.footnote.weight(.semibold)).foregroundStyle(Color(red: 0.75, green: 0.52, blue: 0.99))
                }
                if !row.notes.isEmpty { Text(row.notes).font(Theme.footnote).foregroundStyle(Theme.muted).lineLimit(3) }
            }
            .editable(store, "watchlist", id: row.id, title: row.name)
        }
    }
}
