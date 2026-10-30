import SwiftUI

/// Loads what the analyst needs beyond the database — each held stock's fundamentals check
/// (three at a time, as the web page does, since the Mac fans each out to Yahoo) and ten
/// years of the Nifty — and hands the analysis to the screen as it improves.
@MainActor
final class AnalystModel: ObservableObject {
    @Published private(set) var analysis = Analyst.Analysis()
    @Published private(set) var pending = 0
    @Published private(set) var total = 0
    @Published private(set) var indexStatus = "loading"
    @Published private(set) var working = true

    private var fundamentals: [String: JSONValue] = [:]
    private var closes: [String: Double]?
    private var loadedFor: Int?

    func run(store: FinanceStore) async {
        let raw = store.data
        let market = raw.savingsRaw.array.first { $0["type"].text == "stock_market" && !$0["isArchived"].truthy } ?? .null
        let stocks = market["stocks"].array.filter(Stocks.isOwn)
        let key = stocks.count &+ raw.watchlistRaw.array.count
        if loadedFor == key { return }
        loadedFor = key

        let symbols = Array(Set((stocks.filter { !$0["isArchived"].truthy && $0["shares"].double > 0 } + raw.watchlistRaw.array).compactMap(Analyst.symbolFor))).sorted()
        total = symbols.count; pending = symbols.count
        await recompute(stocks: stocks, market: market, raw: raw)

        async let index = store.indexCloses()
        var queue = symbols
        await withTaskGroup(of: (String, JSONValue?).self) { group in
            func next() { if !queue.isEmpty { let s = queue.removeFirst(); group.addTask { (s, await store.fundamentals(for: s)) } } }
            for _ in 0..<3 { next() }
            var done = 0
            for await (symbol, json) in group {
                if let json { fundamentals[symbol] = json }
                pending = max(0, pending - 1); done += 1
                next()
                if done % 8 == 0 { await recompute(stocks: stocks, market: market, raw: raw) }
            }
        }
        closes = await index
        indexStatus = closes == nil ? "unavailable" : "ok"
        await recompute(stocks: stocks, market: market, raw: raw)
    }

    private func recompute(stocks: [JSONValue], market: JSONValue, raw: Derived) async {
        let funds = fundamentals, idx = closes
        let updated = market["pricesUpdatedAt"].truthy ? market["pricesUpdatedAt"].text : nil
        let watch = raw.watchlistRaw.array, limits = market["sectorLimits"]
        working = true
        analysis = await Task.detached(priority: .userInitiated) {
            Analyst.analyse(stocks: stocks, watchlist: watch, sectorLimits: limits, fundamentals: funds, indexCloses: idx, pricesUpdatedAt: updated)
        }.value
        working = false
    }
}

struct AnalystView: View {
    @ObservedObject var store: FinanceStore
    @StateObject private var model = AnalystModel()
    @State private var filter: Analyst.Severity?
    @State private var open: Set<String> = []

    private func inr(_ v: Double) -> String { Analyst.inr(v) }

    var body: some View {
        let a = model.analysis, s = a.snapshot
        let shown = a.findings.filter { filter == nil || $0.severity == filter }

        KScreen(refresh: { await store.load() }) {
            Text("What is worth doing about your stocks, each suggestion naming the rule behind it. Tax comes from the Capital Gains ledger; nothing here predicts a price, and nothing is changed for you.")
                .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)

            KCard(tint: Theme.accent) {
                KStat(label: "Stock portfolio", value: inr(s.value), size: .hero)
                Text("\(s.heldCount) holdings · \(Analyst.signedInr(s.unrealised)) (\(Analyst.signedPct(s.unrealisedPct))) against cost").font(Theme.footnote).foregroundStyle(Theme.muted)
                HStack(alignment: .top) {
                    KStat(label: "Act", value: "\(a.counts[.act] ?? 0)", tone: (a.counts[.act] ?? 0) > 0 ? .negative : .neutral)
                    Spacer()
                    KStat(label: "Review", value: "\(a.counts[.review] ?? 0)", tone: (a.counts[.review] ?? 0) > 0 ? .warning : .neutral)
                    Spacer()
                    KStat(label: "For info", value: "\(a.counts[.info] ?? 0)")
                }.padding(.top, 10)
            }

            if s.pricesStale && s.heldCount > 0 {
                KNotice(message: s.pricesAgeHours == nil ? "Prices have no timestamp, so how old they are is unknown. Refresh them on the Mac before acting."
                        : "Prices are \(Int(Money.jsRound(s.pricesAgeHours ?? 0))) hours old. Refresh them on the Mac before acting on anything here.")
            }
            if model.pending > 0 || model.indexStatus == "loading" {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text(model.pending > 0 ? "Checking fundamentals — \(model.total - model.pending) of \(model.total)." : "Loading the Nifty history…").font(Theme.footnote).foregroundStyle(Theme.muted)
                }.padding(.horizontal, 4)
            } else if model.indexStatus == "unavailable" {
                Text("The Nifty history could not be loaded, so the comparison with the index is left out.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            }

            Picker("Show", selection: $filter) {
                Text("All \(a.findings.count)").tag(Analyst.Severity?.none)
                ForEach(Analyst.Severity.allCases, id: \.self) { sev in Text(label(sev)).tag(Analyst.Severity?.some(sev)) }
            }.pickerStyle(.segmented)

            if shown.isEmpty && !model.working {
                KCard { Text("Nothing here needs attention.").font(Theme.body).foregroundStyle(Theme.muted) }
            }
            ForEach(shown) { f in finding(f) }

            KSectionHeader(title: "This financial year")
            KCard {
                KRow(title: "Short-term gains", value: inr(s.realisedShort))
                KRow(title: "Long-term gains", value: inr(s.realisedLong))
                KRow(title: "Estimated tax", value: inr(s.estimatedTax))
                KRow(title: "Long-term exemption used", value: "\(inr(s.exemptionUsed)) of \(inr(s.exemption))")
                KRow(title: "Losses carried forward", value: inr(s.carriedLosses))
                KRow(title: "Year ends", value: "\(Analyst.readable(s.fyEnd)) · \(s.daysToFyEnd) days")
            }
        }
        .navigationTitle("Stock Analyst")
        .navigationBarTitleDisplayMode(.large)
        .task { await model.run(store: store) }
    }

    private func label(_ sev: Analyst.Severity) -> String {
        switch sev { case .act: "Act"; case .review: "Review"; case .info: "Info" }
    }
    private func tone(_ sev: Analyst.Severity) -> Tone { switch sev { case .act: .negative; case .review: .warning; case .info: .accent } }

    private func finding(_ f: Analyst.Finding) -> some View {
        let expanded = open.contains(f.id)
        return KCard(tint: f.severity == .act ? Theme.negative : nil) {
            VStack(alignment: .leading, spacing: 8) {
                HStack { KBadge(text: label(f.severity), tone: tone(f.severity)); KBadge(text: f.kind, tone: .neutral); Spacer() }
                Text(f.title).font(Theme.body.weight(.semibold)).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                if !f.detail.isEmpty { Text(f.detail).font(Theme.footnote).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true) }
                Text(f.action).font(Theme.footnote).foregroundStyle(.white.opacity(0.9)).fixedSize(horizontal: false, vertical: true)
                if let deadline = f.deadline { Text("By \(Analyst.readable(deadline))").font(Theme.footnote.weight(.bold)).foregroundStyle(Theme.warning) }
                if expanded {
                    Divider().overlay(Color.white.opacity(0.08))
                    ForEach(Array(f.evidence.enumerated()), id: \.offset) { _, e in
                        HStack(alignment: .firstTextBaseline) {
                            Text(e.label).font(Theme.footnote).foregroundStyle(Theme.muted)
                            Spacer(minLength: 12)
                            Text(e.value).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white).multilineTextAlignment(.trailing)
                        }
                    }
                    Text("Rule: \(f.rule)").font(Theme.footnote).foregroundStyle(Theme.muted)
                }
                if !f.evidence.isEmpty || !f.rule.isEmpty {
                    Button(expanded ? "Hide figures" : "Figures and rule") { if expanded { open.remove(f.id) } else { open.insert(f.id) } }
                        .font(Theme.footnote.weight(.bold))
                }
            }
        }
    }
}
