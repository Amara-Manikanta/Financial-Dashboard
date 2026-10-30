import SwiftUI

/// How each holding has actually performed, weighted by money and time. The simple
/// percentage cannot tell a holding that doubled in three months from one that took
/// nine years; this shows both, side by side, because the gap is usually the story.
struct ReturnsView: View {
    @ObservedObject var store: FinanceStore
    @State private var sort: ReturnsPage.Sort = .xirr
    @State private var includeArchived = false

    private var page: ReturnsPage.Page { store.returns }
    private var rows: [Xirr.Profile] {
        ReturnsPage.sorted(includeArchived ? page.rows : page.rows.filter { !$0.archived }, by: sort)
    }
    private func inr(_ v: Double) -> String { Money.rupees(Money.jsRound(v)) }

    var body: some View {
        KScreen(refresh: { await store.load() }) {
            Text("Annualised and money-weighted: the single yearly rate that makes every one of your cash flows add up.")
                .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)

            let p = page.portfolio
            KCard(tint: Theme.accent) {
                KStat(label: "Portfolio XIRR", value: p.xirrPct.map(Fmt.pct) ?? "—", tone: p.xirrPct.map { Tone.of($0) } ?? .neutral, caption: "a year\(p.firstFlow.map { ", since \(Fmt.date($0))" } ?? "")", size: .hero)
                HStack(alignment: .top) {
                    KStat(label: "Total return", value: p.simplePct.map(Fmt.pct) ?? "—", tone: p.simplePct.map { Tone.of($0) } ?? .neutral, caption: "not annualised")
                    Spacer()
                    KStat(label: "Money in", value: inr(p.invested), caption: "every purchase")
                }
                .padding(.top, 10)
                HStack(alignment: .top) {
                    KStat(label: "Taken out", value: inr(p.returned), caption: "sales and dividends")
                    Spacer()
                    KStat(label: "Still held", value: inr(p.closing), caption: "at today's prices")
                }
                .padding(.top, 8)
                Text("Every holding's cash flows are pooled into one series, not averaged: an average would weight a ₹500 position the same as a ₹2 lakh one.")
                    .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 6)
            }

            Picker("Sort", selection: $sort) { ForEach(ReturnsPage.Sort.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.segmented)
            Toggle("Include archived", isOn: $includeArchived).font(Theme.footnote).tint(Theme.accent).padding(.horizontal, 4)

            if !page.notComputable.isEmpty {
                KNotice(message: "\(page.notComputable.count) holdings have no annualised rate: they have only money out and no value, which is a gap in the records rather than a zero return.")
            }
            if !page.tooShort.isEmpty {
                KNotice(message: "\(page.tooShort.count) were held under three months, where annualising turns noise into a headline. The gain itself is real; the yearly rate is not.")
            }

            KSectionHeader(title: "Holdings", detail: "\(rows.count)")
            KList(items: rows) { r in
                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(r.name).font(Theme.body).foregroundStyle(.white).lineLimit(2)
                        KBadge(text: r.kind, tone: .neutral)
                        Spacer()
                        Text(r.xirrPct.map(Fmt.pct) ?? "—").font(Theme.figure).foregroundStyle((r.xirrPct.map { Tone.of($0) } ?? .neutral).color)
                    }
                    HStack {
                        Text("Total \(r.simplePct.map(Fmt.pct) ?? "—") · profit \(Fmt.signed(Money.jsRound(r.profit)))")
                            .font(Theme.footnote).foregroundStyle(Theme.muted)
                        Spacer()
                        if r.tooShortToAnnualise { KBadge(text: "under 3 months", tone: .warning) }
                        else if r.xirrPct == nil { KBadge(text: "not computable", tone: .warning) }
                    }
                    Text("In \(inr(r.invested)) · \(r.days) day\(r.days == 1 ? "" : "s")\(r.firstFlow.map { " since \(Fmt.date($0))" } ?? "")")
                        .font(Theme.footnote).foregroundStyle(Theme.muted)
                }
            }
        }
        .navigationTitle("Returns")
        .navigationBarTitleDisplayMode(.large)
    }
}
