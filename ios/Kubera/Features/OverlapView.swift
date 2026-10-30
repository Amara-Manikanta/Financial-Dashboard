import SwiftUI

/// Your direct shares and what four funds hold in the same companies, added together so
/// one company shows as one row. Percentages are of the whole of what is looked through
/// here — direct stocks plus the four funds — not of net worth.
struct OverlapView: View {
    @ObservedObject var store: FinanceStore
    @State private var basis = NiftyOverlap.Basis.current
    @State private var focus: NiftyOverlap.Fund?
    @State private var search = ""
    @State private var cap = "all"
    @State private var holding = NiftyOverlap.Holding.all
    @State private var sector = "all"
    @State private var sort = NiftyOverlap.Sort.total
    @State private var showAllSectors = false
    @State private var limit = 25

    private func inr(_ v: Double) -> String { Money.rupees(v) }
    private func pct(_ v: Double) -> String { String(format: "%.1f%%", v) }

    var body: some View {
        let page = NiftyOverlap.page(savings: store.data.savingsRaw, basis: basis, view: focus)
        let rows = NiftyOverlap.filtered(page.exposures, search: search, cap: cap, holding: holding, sector: sector, sort: sort, descending: sort != .name)

        KScreen(refresh: { await store.load() }) {
            Picker("Valued at", selection: $basis) { ForEach(NiftyOverlap.Basis.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.segmented)

            KCard(tint: Theme.accent) {
                KStat(label: "Looked through", value: inr(page.portfolioValue), size: .hero)
                HStack(alignment: .top) {
                    KStat(label: "Direct stocks", value: inr(page.stockValue), caption: share(page.stockValue, of: page.portfolioValue))
                    Spacer()
                    KStat(label: "Four funds", value: inr(page.equityFundValue), caption: share(page.equityFundValue, of: page.portfolioValue))
                }.padding(.top, 10)
                if let top = page.top {
                    Text("Largest single company: \(top.name), \(pct(top.totalPct)) of this total").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 6)
                }
            }

            KSectionHeader(title: "Funds")
            KList(items: NiftyOverlap.Fund.allCases) { fund in
                Button { focus = focus == fund ? nil : fund } label: {
                    HStack {
                        Image(systemName: focus == fund ? "checkmark.circle.fill" : "circle").foregroundStyle(focus == fund ? Theme.accent : Theme.muted)
                        KRow(title: fund.rawValue, subtitle: page.fundFound[fund] == true ? nil : "Not in your savings",
                             value: inr(page.fundValues[fund] ?? 0))
                    }
                }.buttonStyle(.plain)
            }
            Text(focus == nil ? "Showing all four. Tap one to look at it alone; the total above still counts every fund." : "Looking at \(focus!.rawValue) only. Tap it again for all four.")
                .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)

            KSectionHeader(title: "By company size")
            KCard {
                ForEach(page.caps) { slice in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack { Text(slice.name).font(Theme.body).foregroundStyle(.white); Spacer(); Text(pct(slice.pct)).font(Theme.figure).foregroundStyle(.white) }
                        ProgressView(value: min(1, slice.pct / 100)).tint(Theme.accent)
                        Text(inr(slice.value)).font(Theme.footnote).foregroundStyle(Theme.muted)
                    }.padding(.vertical, 4)
                }
            }

            KSectionHeader(title: "By sector")
            let sectors = showAllSectors ? page.sectors : Array(page.sectors.prefix(8))
            KList(items: sectors) { s in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("\(Sectors.icon(s.sector)) \(s.sector)").font(Theme.body).foregroundStyle(.white)
                        Spacer()
                        Text(pct(s.pct)).font(Theme.figure).foregroundStyle(.white)
                    }
                    ProgressView(value: min(1, s.pct / 100)).tint(Theme.accent)
                    Text("\(inr(s.total)) · \(s.count) \(s.count == 1 ? "company" : "companies") · direct \(inr(s.direct)) · funds \(inr(s.indirect))")
                        .font(Theme.footnote).foregroundStyle(Theme.muted)
                }
            }
            if page.sectors.count > 8 {
                Button(showAllSectors ? "Show fewer" : "Show all \(page.sectors.count) sectors") { showAllSectors.toggle() }.font(Theme.footnote.weight(.bold))
            }

            KSectionHeader(title: "Companies")
            TextField("Search company, symbol or sector", text: $search)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
                .padding(10).background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 10, style: .continuous)).foregroundStyle(.white)
            Picker("Held", selection: $holding) { ForEach(NiftyOverlap.Holding.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.segmented)
            HStack {
                Menu { Picker("Size", selection: $cap) { Text("All sizes").tag("all"); ForEach(Benchmark.marketCaps, id: \.self) { Text($0).tag($0) } } } label: { chip(cap == "all" ? "All sizes" : cap) }
                Menu { Picker("Sector", selection: $sector) { ForEach(page.sectorNames, id: \.self) { Text($0 == "all" ? "All sectors" : $0).tag($0) } } } label: { chip(sector == "all" ? "All sectors" : sector) }
                Menu { Picker("Sort", selection: $sort) { ForEach(NiftyOverlap.Sort.allCases) { Text($0.rawValue).tag($0) } } } label: { chip("Sort: \(sort.rawValue)") }
                Spacer()
            }
            Text("\(rows.count) of \(page.exposures.count) companies").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)

            KList(items: Array(rows.prefix(limit))) { e in
                VStack(alignment: .leading, spacing: 5) {
                    HStack(alignment: .firstTextBaseline) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(e.name).font(Theme.body).foregroundStyle(.white).lineLimit(2)
                            Text("\(e.symbol) · \(e.cap) · \(e.sector)").font(Theme.footnote).foregroundStyle(Theme.muted).lineLimit(1)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 1) {
                            Text(inr(e.total)).font(Theme.figure).foregroundStyle(.white)
                            Text(String(format: "%.2f%% of total", e.totalPct)).font(Theme.footnote).foregroundStyle(Theme.muted)
                        }
                    }
                    if e.directVal > 0 {
                        Text("Direct \(inr(e.directVal)) · \(Fmt.shares(e.directShares)) shares").font(Theme.footnote).foregroundStyle(Theme.positive)
                    }
                    if e.totalIndirect > 0 {
                        Text(NiftyOverlap.Fund.allCases.filter { e.value(in: $0) > 0 }.map { "\($0.short) \(inr(e.value(in: $0)))" }.joined(separator: " · "))
                            .font(Theme.footnote).foregroundStyle(Theme.accent)
                    }
                    if e.status == .both { KBadge(text: "Held both ways", tone: .warning) }
                }
            }
            if rows.count > limit { Button("Show \(min(25, rows.count - limit)) more") { limit += 25 }.font(Theme.footnote.weight(.bold)) }
        }
        .navigationTitle("Nifty 50 & overlap")
        .navigationBarTitleDisplayMode(.large)
    }

    private func share(_ part: Double, of whole: Double) -> String { whole > 0 ? String(format: "%.0f%% of the total", part / whole * 100) : "" }

    private func chip(_ text: String) -> some View {
        Text(text).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white).lineLimit(1)
            .padding(.horizontal, 10).padding(.vertical, 6).background(Color.white.opacity(0.08), in: Capsule())
    }
}
