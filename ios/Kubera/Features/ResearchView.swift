import SwiftUI

/// Every holding's latest outside-research call, from the Mac's Research tab. A second opinion to
/// read — never an instruction — and read-only: calls are pasted or imported on the Mac.
struct ResearchView: View {
    @ObservedObject var store: FinanceStore
    @State private var filter = "all"
    @State private var openId: String?
    @State private var query = ""

    private struct Entry: Identifiable { let id: String; let call: ResearchCall }

    private var entries: [Entry] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        return store.research.map { Entry(id: $0.key, call: $0.value) }
            .filter { filter == "all" || $0.call.call == filter }
            .filter { q.isEmpty || $0.call.name.lowercased().contains(q) }
            .sorted { a, b in
                // Things to look at first: what changed lately, then by the call's urgency, then by name.
                let ca = a.call.since ?? "", cb = b.call.since ?? ""
                if ca != cb { return ca > cb }
                let ra = ResearchCall.rank[a.call.call] ?? 9, rb = ResearchCall.rank[b.call.call] ?? 9
                return ra != rb ? ra < rb : a.call.name < b.call.name
            }
    }

    private func count(_ call: String) -> Int { store.research.values.filter { $0.call == call }.count }

    var body: some View {
        KScreen(refresh: { await store.load() }) {
            if store.research.isEmpty {
                KCard {
                    Text("No research calls yet. They appear here once the Mac's Research tab has saved some — paste or import a table there, then pull down to refresh.")
                        .font(Theme.footnote).foregroundStyle(Theme.muted)
                }
            } else {
                KCard {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            chip("All", "all", store.research.count)
                            ForEach(["BUY", "ACCUMULATE", "HOLD", "REVIEW", "SELL"], id: \.self) { chip($0.capitalized, $0, count($0)) }
                        }
                    }
                    Text("Outside research, a second opinion — not advice, and it never changes a holding.")
                        .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 6)
                }
                KSectionHeader(title: "Calls", detail: "\(entries.count) of \(store.research.count)")
                KList(items: entries) { e in
                    VStack(alignment: .leading, spacing: 6) {
                        Button { withAnimation(.easeInOut(duration: 0.2)) { openId = openId == e.id ? nil : e.id } } label: { header(e.call, open: openId == e.id) }
                            .buttonStyle(.plain)
                        if openId == e.id { detail(e.call) }
                    }
                }
                if entries.isEmpty { KCard { Text("No call matches this filter.").font(Theme.footnote).foregroundStyle(Theme.muted) } }
            }
        }
        .navigationTitle("Research")
        .navigationBarTitleDisplayMode(.large)
        .searchable(text: $query, prompt: "Search a stock")
    }

    private func chip(_ title: String, _ value: String, _ n: Int) -> some View {
        Button { filter = value } label: {
            Text("\(title) \(n)").font(Theme.footnote.weight(.semibold))
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background((filter == value ? Theme.accent : Color.white).opacity(filter == value ? 0.25 : 0.07), in: Capsule())
                .foregroundStyle(filter == value ? Theme.accent : Theme.muted)
        }
        .buttonStyle(.plain)
    }

    private func header(_ c: ResearchCall, open: Bool) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            VStack(alignment: .leading, spacing: 3) {
                Text(c.name).font(Theme.body).foregroundStyle(.white).lineLimit(1)
                HStack(spacing: 6) {
                    if let p = c.previous { Text("was \(p.call) until \(Fmt.date(c.since ?? ""))").font(Theme.footnote).foregroundStyle(Theme.warning) }
                    else { Text(c.ageDays > 0 ? "as of \(Fmt.date(c.date)) · \(c.ageDays)d ago" : "today").font(Theme.footnote).foregroundStyle(Theme.muted) }
                }
            }
            Spacer()
            if !c.confidence.isEmpty { Text(c.confidence.capitalized).font(Theme.footnote).foregroundStyle(Theme.muted) }
            KBadge(text: c.call, tone: ResearchTone.of(c.call))
            Image(systemName: "chevron.down").font(.system(size: 11, weight: .bold)).foregroundStyle(Theme.muted).rotationEffect(.degrees(open ? 180 : 0))
        }
    }

    @ViewBuilder private func detail(_ c: ResearchCall) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if !c.reason.isEmpty { Text(c.reason).font(Theme.footnote).foregroundStyle(.white.opacity(0.9)) }
            if !c.news.isEmpty { Text("News: \(c.news)").font(Theme.footnote).foregroundStyle(Theme.muted) }
            if !c.trigger.isEmpty { Text("What would change this: \(c.trigger)").font(Theme.footnote).foregroundStyle(Theme.muted) }
            if c.changes.count > 1 {
                Text("History: " + c.changes.map { "\(Fmt.date($0.date)) \($0.call)" }.joined(separator: " → ")).font(Theme.footnote).foregroundStyle(Theme.muted.opacity(0.8))
            }
        }
        .padding(.top, 2)
    }
}
