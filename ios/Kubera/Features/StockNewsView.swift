import SwiftUI

/// A stock's News & analysis card from the Mac (`StockNewsCard.jsx`): the stories stored on
/// the Mac, Claude's running brief, and buttons that ask the Mac to fetch or read more.
/// Everything is collected and kept on the Mac; the phone holds nothing between visits.
struct StockNewsView: View {
    @ObservedObject var store: FinanceStore
    let symbol: String
    let name: String

    @State private var stories: [JSONValue] = []
    @State private var brief: JSONValue = .null
    @State private var claude: JSONValue = .null
    @State private var loading = true
    @State private var busy = ""
    @State private var note = ""
    @State private var loadError: String?
    @State private var shown = 40

    /// `RELIANCE` → `RELIANCE.NS`, as the Mac's stock page does.
    static func symbol(for ticker: String) -> String { ticker.contains(".") ? ticker : "\(ticker).NS" }

    private struct Story: Identifiable { let id: String; let raw: JSONValue }
    private var rows: [Story] {
        stories.enumerated()
            .sorted { $0.element["published"].text > $1.element["published"].text }
            .map { Story(id: $0.element["id"].truthy ? $0.element["id"].text : "s\($0.offset)", raw: $0.element) }
    }

    var body: some View {
        KScreen(refresh: { await load() }) {
            if let loadError { KNotice(message: loadError) { Task { await load() } } }

            KCard {
                HStack(spacing: 10) {
                    action("Fetch latest", icon: "arrow.down.circle", key: "fetch") { await store.fetchNews(symbol: symbol, name: name) }
                    action("Analyse 5", icon: "sparkles", key: "analyse") { await store.analyseNews(symbol: symbol, name: name) }
                }
                if !note.isEmpty { Text(note).font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 8) }
                Text("Collected and read on your Mac every few hours; these ask it to do so now.")
                    .font(Theme.footnote).foregroundStyle(Theme.muted.opacity(0.8)).padding(.top, 4)
            }

            briefSection

            KSectionHeader(title: "Stories", detail: loading ? nil : "\(stories.count)")
            if loading {
                KCard { ProgressView().frame(maxWidth: .infinity) }
            } else if rows.isEmpty {
                KCard { Text("No news stored for this stock yet. Fetch latest to collect some.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            } else {
                ForEach(rows.prefix(shown)) { story($0.raw) }
                if rows.count > shown {
                    Button("Show \(min(40, rows.count - shown)) more") { shown += 40 }
                        .font(Theme.footnote.weight(.semibold)).foregroundStyle(Theme.accent).frame(maxWidth: .infinity).padding(.vertical, 8)
                }
            }
        }
        .navigationTitle("News · \(name)")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    // MARK: Brief

    @ViewBuilder private var briefSection: some View {
        let enabled = claude["enabled"].truthy && claude["configured"].truthy
        if !brief.isNull || enabled {
            KSectionHeader(title: "Claude's brief", detail: brief["asOf"].truthy ? "as of \(Fmt.date(brief["asOf"].text))" : nil)
            KCard {
                if brief.isNull {
                    Text("No brief yet for this stock.").font(Theme.footnote).foregroundStyle(Theme.muted)
                } else {
                    if brief["overview"].truthy {
                        Text(brief["overview"].text).font(Theme.body).foregroundStyle(.white.opacity(0.9))
                        if brief["overviewUnverified"].array.count > 0 { unverified(brief["overviewUnverified"]) }
                    }
                    ForEach(Array(brief["items"].array.enumerated()), id: \.offset) { _, item in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                KBadge(text: item["status"].text == "resolved" ? "Resolved" : "Open")
                                if item["isNew"].truthy { KBadge(text: "New") }
                                Spacer()
                                if item["lastDate"].truthy { Text(Fmt.date(item["lastDate"].text)).font(Theme.footnote).foregroundStyle(Theme.muted) }
                            }
                            Text(item["whatChanged"].text).font(Theme.body).foregroundStyle(.white)
                            if item["whyItMatters"].truthy { Text(item["whyItMatters"].text).font(Theme.footnote).foregroundStyle(Theme.muted) }
                            if item["check"].truthy { Text("Check: \(item["check"].text)").font(Theme.footnote).foregroundStyle(Theme.accent) }
                            if item["unverified"].array.count > 0 { unverified(item["unverified"]) }
                        }
                        .padding(.top, 12)
                    }
                    Text("A summary of headlines, not advice. Figures marked unverified were not found in the stories cited.")
                        .font(Theme.footnote).foregroundStyle(Theme.muted.opacity(0.8)).padding(.top, 10)
                }
                if enabled {
                    action("Update brief with Claude", icon: "text.badge.star", key: "brief") {
                        if let failure = await store.refreshClaudeBrief(symbol: symbol, name: name) { return failure }
                        return "Brief updated."
                    }
                    .padding(.top, 10)
                    Text("Spent today ₹\(String(format: "%.2f", claude["spentTodayInr"].double)) of ₹\(Int(claude["dailyCapInr"].double))")
                        .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 4)
                }
            }
        }
    }

    private func unverified(_ figures: JSONValue) -> some View {
        Text("Unverified figure: \(figures.array.map(\.text).joined(separator: ", "))")
            .font(Theme.footnote).foregroundStyle(Tone.negative.color)
    }

    // MARK: Stories

    private func story(_ s: JSONValue) -> some View {
        KCard {
            HStack(alignment: .firstTextBaseline) {
                if s["impact"].truthy {
                    let impact = s["impact"].text.lowercased()
                    KBadge(text: impact, tone: impact.contains("positive") ? .positive : impact.contains("negative") ? .negative : .neutral)
                }
                if s["theme"].truthy && s["theme"].text != "other" { KBadge(text: s["theme"].text.capitalized) }
                Spacer()
                Text(Fmt.date(s["published"].text)).font(Theme.footnote).foregroundStyle(Theme.muted)
            }
            Text(s["title"].text).font(Theme.body.weight(.semibold)).foregroundStyle(.white).padding(.top, 6)
            Text(s["sources"].array.map(\.text).joined(separator: ", ")).font(Theme.footnote).foregroundStyle(Theme.muted).lineLimit(2)
            ForEach(Array(s["keyPoints"].array.enumerated()), id: \.offset) { _, point in
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("•").foregroundStyle(Theme.accent)
                    Text(point.text).font(Theme.footnote).foregroundStyle(.white.opacity(0.85))
                }
                .padding(.top, 2)
            }
            if s["why"].truthy { Text(s["why"].text).font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 4) }
            HStack {
                if s["analysedBy"].truthy {
                    Text("Read by \(s["analysedBy"].text)").font(Theme.footnote).foregroundStyle(Theme.muted.opacity(0.8))
                } else if s["status"].truthy {
                    Text(s["status"].text).font(Theme.footnote).foregroundStyle(Theme.muted.opacity(0.8))
                } else {
                    Text("Not read yet").font(Theme.footnote).foregroundStyle(Theme.muted.opacity(0.8))
                }
                Spacer()
                if let link = s["links"].array.first, let url = URL(string: link["url"].text) {
                    Link(destination: url) { Label(link["source"].truthy ? link["source"].text : "Open", systemImage: "arrow.up.right.square").font(Theme.footnote) }
                }
            }
            .padding(.top, 6)
        }
    }

    // MARK: Actions

    private func action(_ title: String, icon: String, key: String, run: @escaping () async -> String) -> some View {
        Button {
            Task {
                busy = key; note = ""
                note = await run()
                await load()
                busy = ""
            }
        } label: {
            HStack(spacing: 6) {
                if busy == key { ProgressView().controlSize(.small) } else { Image(systemName: icon) }
                Text(title).font(Theme.footnote.weight(.semibold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(Theme.accent.opacity(0.15), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .foregroundStyle(Theme.accent)
        }
        .buttonStyle(.plain)
        .disabled(!busy.isEmpty)
    }

    private func load() async {
        do {
            stories = try await store.storedNews(symbol: symbol, name: name)
            loadError = nil
        } catch { loadError = error.localizedDescription }
        // The brief is optional: an older Mac without the Claude routes simply shows none.
        if let b = try? await store.claudeBrief(symbol: symbol) { brief = b.brief; claude = b.status }
        loading = false
    }
}
