import SwiftUI
import Charts

/// Dividends as income rather than as a footnote on a holding: what has arrived and
/// when, how dependable each payer is, and the tax withheld. Descriptive throughout —
/// a payout is declared by a board, so nothing is projected forward.
struct DividendsView: View {
    @ObservedObject var store: FinanceStore
    @State private var year: String?
    @State private var showAllPayers = false

    private var page: DividendPage.Page { store.dividends }
    private var s: Dividends.IncomeSummary { page.summary }
    private var selectedYear: String { year ?? s.years.last?.year ?? String(Calendar.current.component(.year, from: Date())) }
    private func inr(_ v: Double) -> String { Money.rupees(v) }

    var body: some View {
        KScreen(refresh: { await store.load() }) {
            Text("Cash your holdings have actually paid you, arranged by when it arrived.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)

            tax
            headline
            if !page.lapsed.isEmpty { lapsedNotice }
            byYear
            byMonth
            payers
            calendar
            sources
        }
        .navigationTitle("Dividend Income")
        .navigationBarTitleDisplayMode(.large)
    }

    // MARK: Sections

    /// First, on purpose: if any figure below is net of TDS, every number under it is understated.
    private var tax: some View {
        let t = page.tax
        return VStack(alignment: .leading, spacing: 8) {
            KSectionHeader(title: "Tax withheld", detail: "gross · TDS · net")
            KCard(tint: Color(red: 0.18, green: 0.83, blue: 0.75)) {
                HStack(alignment: .top) {
                    KStat(label: "Gross", value: inr(t.lifetimeGross))
                    Spacer()
                    KStat(label: "TDS recorded", value: inr(t.lifetimeTds), tone: t.lifetimeTds > 0 ? .positive : .neutral)
                    Spacer()
                    KStat(label: "Net", value: inr(t.lifetimeNet))
                }
                Text("Since 2020 a dividend is taxed in your hands and the payer withholds part of it, so what reaches the bank is less than what was declared. The difference is claimable against your own tax.")
                    .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 4)
                if !t.needsChecking.isEmpty {
                    Divider().overlay(Color.white.opacity(0.06)).padding(.vertical, 6)
                    Label("\(t.needsChecking.count) payout\(t.needsChecking.count == 1 ? "" : "s") where tax was probably withheld but none is recorded", systemImage: "exclamationmark.triangle.fill")
                        .font(Theme.footnote.weight(.bold)).foregroundStyle(Theme.warning)
                    Text("A REIT or InvIT withholds 10% from the first rupee. An ordinary company withholds only above ₹10,000 from that one company in a financial year (₹5,000 before FY 2025-26). Check the payout advice and enter the tax if there was any.")
                        .font(Theme.footnote).foregroundStyle(Theme.muted)
                    ForEach(t.needsChecking.prefix(8)) { r in
                        HStack { Text("\(r.name) · FY \(r.fy)").font(Theme.footnote).foregroundStyle(.white); Spacer(); Text(inr(r.gross)).font(Theme.footnote.monospacedDigit()).foregroundStyle(Theme.warning) }
                    }
                    if t.needsChecking.count > 8 { Text("and \(t.needsChecking.count - 8) more").font(Theme.footnote).foregroundStyle(Theme.muted) }
                }
                if !t.approaching.isEmpty {
                    Text("Close to the withholding limit this year: " + t.approaching.map { "\($0.name) (\(inr($0.headroom ?? 0)) left)" }.joined(separator: ", "))
                        .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 4)
                }
            }
        }
    }

    private var headline: some View {
        KCard(tint: Theme.positive) {
            KStat(label: "Received, all time", value: inr(s.lifetime), size: .hero)
            HStack(alignment: .top) {
                KStat(label: "This year", value: inr(s.thisYear))
                Spacer()
                KStat(label: "Best full year", value: s.bestYear.map { inr($0.amount) } ?? "—", caption: s.bestYear?.year)
            }
            .padding(.top, 8)
            HStack(alignment: .top) {
                KStat(label: "Payers", value: "\(s.payerCount)", caption: s.lapsedCount > 0 ? "\(s.lapsedCount) gone quiet" : nil)
                Spacer()
                KStat(label: "Yield on cost", value: String(format: "%.2f%%", s.portfolioYieldOnCost), caption: "on what you paid")
            }
            .padding(.top, 8)
        }
    }

    private var lapsedNotice: some View {
        KNotice(message: "\(page.lapsed.count) payer\(page.lapsed.count == 1 ? " has" : "s have") gone two calendar years without paying: \(page.lapsed.map(\.name).joined(separator: ", ")). That usually means something changed at the company.")
    }

    private var byYear: some View {
        VStack(alignment: .leading, spacing: 8) {
            KSectionHeader(title: "By year")
            KCard {
                Chart(s.years, id: \.year) { y in
                    BarMark(x: .value("Year", y.year), y: .value("Received", y.amount)).foregroundStyle(Theme.positive.gradient).cornerRadius(4)
                }
                .chartYAxis { AxisMarks { v in AxisValueLabel { if let d = v.as(Double.self) { Text(Money.compact(d)).font(.system(size: 10)) } } } }
                .frame(height: 170)
            }
        }
    }

    private var byMonth: some View {
        let months = Dividends.incomeByMonth(page.stocks, year: selectedYear)
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                KSectionHeader(title: "Month by month")
                Picker("Year", selection: Binding(get: { selectedYear }, set: { year = $0 })) { ForEach(s.years.reversed(), id: \.year) { Text($0.year).tag($0.year) } }
                    .pickerStyle(.menu).tint(Theme.accent)
            }
            KCard {
                Chart(months) { m in
                    BarMark(x: .value("Month", String(m.month.prefix(3))), y: .value("Received", m.amount)).foregroundStyle(Theme.accent.gradient).cornerRadius(3)
                }
                .chartYAxis { AxisMarks { v in AxisValueLabel { if let d = v.as(Double.self) { Text(Money.compact(d)).font(.system(size: 10)) } } } }
                .frame(height: 170)
                Text("\(months.filter { $0.amount > 0 }.count) of 12 months paid anything. The gaps are the point: dividend income is lumpy, not a salary.")
                    .font(Theme.footnote).foregroundStyle(Theme.muted)
            }
        }
    }

    private var payers: some View {
        let list = showAllPayers ? page.payers : Array(page.payers.prefix(10))
        return VStack(alignment: .leading, spacing: 8) {
            KSectionHeader(title: "Payers", detail: "best yield on cost first")
            KList(items: list) { p in
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(p.name).font(Theme.body).foregroundStyle(.white).lineLimit(2)
                        if !p.held { KBadge(text: "sold", tone: .neutral) }
                        if p.lapsed && p.held { KBadge(text: "quiet", tone: .warning) }
                        Spacer()
                        Text(String(format: "%.1f%%", p.pct)).font(Theme.figure).foregroundStyle(Theme.positive)
                    }
                    Text("\(inr(p.total)) on \(inr(p.invested)) · paid in \(p.paidYears) of \(p.spanYears) years\(p.lastPaid.map { " · last \(Fmt.date($0))" } ?? "")")
                        .font(Theme.footnote).foregroundStyle(Theme.muted)
                }
            }
            if page.payers.count > 10 {
                Button(showAllPayers ? "Show fewer" : "Show all \(page.payers.count)") { withAnimation { showAllPayers.toggle() } }
                    .font(Theme.footnote.weight(.bold)).foregroundStyle(Theme.accent).frame(maxWidth: .infinity)
            }
        }
    }

    private var calendar: some View {
        VStack(alignment: .leading, spacing: 8) {
            KSectionHeader(title: "When it usually arrives", detail: "history, not a forecast")
            KList(items: page.busiest) { m in
                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text(m.name).font(Theme.body).foregroundStyle(.white)
                        Spacer()
                        Text(inr(m.typicalTotal)).font(Theme.figure).foregroundStyle(.white)
                    }
                    Text(m.payers.prefix(4).map { "\($0.name) \(Money.compact($0.averagePerYear))" }.joined(separator: " · ") + (m.payers.count > 4 ? " · +\(m.payers.count - 4) more" : ""))
                        .font(Theme.footnote).foregroundStyle(Theme.muted).lineLimit(2)
                }
            }
        }
    }

    private var sources: some View {
        let total = page.shares.reduce(0) { $0 + $1.value }
        return VStack(alignment: .leading, spacing: 8) {
            KSectionHeader(title: "Where the income comes from")
            KList(items: Array(page.shares.prefix(10))) { item in
                VStack(alignment: .leading, spacing: 5) {
                    HStack { Text(item.ticker).font(Theme.body).foregroundStyle(.white); Spacer(); Text(inr(item.value)).font(Theme.figure).foregroundStyle(.white) }
                    ProgressView(value: total > 0 ? item.value / total : 0).tint(Color(red: 0.18, green: 0.83, blue: 0.75))
                }
            }
        }
    }
}
