import SwiftUI

/// Capital gains matched first in, first out, as tax is actually computed.
/// A working estimate from your own records, not a tax return.
struct CapitalGainsView: View {
    @ObservedObject var store: FinanceStore

    private enum Tab: String, CaseIterable, Identifiable {
        case realised = "Tax", held = "Held", disposals = "Sales", funds = "Funds"
        var id: String { rawValue }
    }
    @State private var tab: Tab = .realised

    private var page: CapitalGainsPage.Page { store.capitalGains }

    /// Whole rupees, as the web page shows them.
    private func inr(_ value: Double) -> String { Money.rupees(Money.jsRound(value)) }

    var body: some View {
        KScreen(refresh: { await store.load() }) {
            if !page.unmatched.isEmpty { gap }
            headline
            if page.carriedTotal > 0 { carried }

            Picker("View", selection: $tab) { ForEach(Tab.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.segmented)

            switch tab {
            case .realised: years
            case .held: held
            case .disposals: disposals
            case .funds: funds
            }
        }
        .navigationTitle("Capital Gains")
        .navigationBarTitleDisplayMode(.large)
    }

    // MARK: Pieces

    /// Data gap first: everything below is only as good as the history.
    private var gap: some View {
        KCard(tint: Theme.warning) {
            let shares = page.unmatched.reduce(0) { $0 + $1.quantity }
            Label("\(Fmt.shares(shares)) shares were sold with no purchase on record", systemImage: "exclamationmark.triangle.fill")
                .font(Theme.body).foregroundStyle(Theme.warning)
            Text("They have no cost to match, so they are left out of every figure here rather than counted at zero cost, which would invent a gain equal to the whole sale. Add the missing purchases and the numbers complete themselves.")
                .font(Theme.footnote).foregroundStyle(Theme.muted)
            ForEach(Array(page.unmatched.enumerated()), id: \.offset) { _, u in
                Text("\(u.holding) — \(Fmt.shares(u.quantity)) sold on \(Fmt.date(u.soldOn))").font(Theme.footnote).foregroundStyle(.white)
            }
        }
    }

    private var headline: some View {
        let thisYear = page.thisYear.map { $0.grossShort + $0.grossLong } ?? 0
        return KCard(tint: Theme.accent) {
            KStat(label: "Realised in FY \(page.currentFy)", value: Fmt.signed(Money.jsRound(thisYear)), tone: Tone.of(thisYear), size: .hero)
            HStack(alignment: .top) {
                KStat(label: "All years", value: Fmt.signed(Money.jsRound(page.ledger.totalRealised)), tone: Tone.of(page.ledger.totalRealised))
                Spacer()
                KStat(label: "Estimated tax", value: inr(page.ledger.totalTax), tone: page.ledger.totalTax > 0 ? .negative : .positive, caption: "all years")
            }
            .padding(.top, 8)
        }
    }

    private var carried: some View {
        VStack(alignment: .leading, spacing: 8) {
            KSectionHeader(title: "Losses carried forward", detail: inr(page.carriedTotal))
            KCard {
                Text("A capital loss can be carried for eight assessment years and then expires unused.").font(Theme.footnote).foregroundStyle(Theme.muted)
                ForEach([("Short-term", page.ledger.carriedShort), ("Long-term", page.ledger.carriedLong)], id: \.0) { label, list in
                    ForEach(list, id: \.fy) { c in
                        KRow(title: "\(label) · FY \(c.fy)", subtitle: "Usable until FY \(c.expiresAfter)", value: inr(c.amount), valueTone: .warning)
                    }
                }
            }
        }
    }

    private var years: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(page.ledger.years.reversed(), id: \.fy) { y in
                KCard {
                    HStack {
                        Text("FY \(y.fy)").font(.system(size: 19, weight: .heavy, design: .rounded))
                        if y.fy == page.currentFy { KBadge(text: "Current") }
                        Spacer()
                        Text(inr(y.estimatedTax)).font(Theme.figure).foregroundStyle(y.estimatedTax > 0 ? Tone.negative.color : Tone.positive.color)
                    }
                    HStack(alignment: .top) {
                        KStat(label: "Short-term", value: Fmt.signed(Money.jsRound(y.grossShort)), tone: Tone.of(y.grossShort))
                        Spacer()
                        KStat(label: "Long-term", value: Fmt.signed(Money.jsRound(y.grossLong)), tone: Tone.of(y.grossLong))
                    }
                    .padding(.top, 6)
                    let setOff = y.setOffShortAgainstShort + y.setOffShortAgainstLong + y.setOffLongAgainstLong + y.setOffCurrentShortLossAgainstLong
                    line("Loss set off", setOff > 0 ? inr(setOff) : "—")
                    line("Taxable short-term", "\(inr(y.taxableShort)) at \(percent(y.shortRate))")
                    line("Taxable long-term", "\(inr(y.taxableLong)) at \(percent(y.longRate)) after ₹\(Int(y.exemption / 1000))K exemption")
                    line("Carried out", inr(y.closingCarriedShort + y.closingCarriedLong))
                    if y.lapsed > 0 { line("Lapsed unused", inr(y.lapsed)) }
                    if y.buybackDividend > 0 { line("Buyback taxed as dividend", inr(y.buybackDividend)) }
                }
            }
            Text("Set-off follows the Act's order; surcharge, cess and other income are not modelled, so treat tax as an estimate.")
                .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
        }
    }

    private func percent(_ rate: Double) -> String { String(format: "%g%%", rate * 100) }

    private func line(_ title: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(Theme.footnote).foregroundStyle(Theme.muted)
            Spacer()
            Text(value).font(Theme.footnote.monospacedDigit()).foregroundStyle(.white).multilineTextAlignment(.trailing)
        }
        .padding(.top, 4)
    }

    private var held: some View {
        let u = page.unrealised
        return VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                KCard { KStat(label: "Short-term", value: Fmt.signed(Money.jsRound(u.shortTerm.gain)), tone: Tone.of(u.shortTerm.gain), caption: "\(u.shortTerm.count) lots · \(Money.compact(u.shortTerm.value))", size: .large) }
                KCard { KStat(label: "Long-term", value: Fmt.signed(Money.jsRound(u.longTerm.gain)), tone: Tone.of(u.longTerm.gain), caption: "\(u.longTerm.count) lots · \(Money.compact(u.longTerm.value))", size: .large) }
            }
            if !u.crossingWithin90Days.isEmpty {
                KNotice(message: "\(u.crossingWithin90Days.count) lots cross into long term within 90 days.")
            }
            KSectionHeader(title: "Open lots", detail: "\(u.lots.count)")
            KList(items: u.lots) { lot in
                KRow(title: lot.holding, subtitle: "\(Fmt.shares(lot.quantity)) bought \(Fmt.date(lot.acquiredOn))" + (lot.isLong ? "" : " · long term in \(lot.daysToLongTerm)d"),
                     value: Fmt.signed(Money.jsRound(lot.gain)), valueTone: Tone.of(lot.gain), valueCaption: lot.isLong ? "long term" : "short term", captionTone: lot.isLong ? .positive : .warning)
            }
        }
    }

    private var disposals: some View {
        VStack(alignment: .leading, spacing: 8) {
            KSectionHeader(title: "Every sale", detail: "\(page.disposals.count)")
            KList(items: page.disposals.enumerated().map { Indexed(index: $0.offset, value: $0.element) }) { item in
                let d = item.value
                KRow(title: d.holding, subtitle: "\(Fmt.shares(d.quantity)) · bought \(Fmt.date(d.acquiredOn)) · sold \(Fmt.date(d.soldOn))",
                     value: d.treatedAsDividend ? "\(inr(d.dividendIncome)) dividend" : Fmt.signed(Money.jsRound(d.gain)),
                     valueTone: d.treatedAsDividend ? .accent : Tone.of(d.gain), valueCaption: "\(d.term) · FY \(d.fy)")
            }
        }
    }

    private var funds: some View {
        VStack(alignment: .leading, spacing: 8) {
            KSectionHeader(title: "Mutual fund sales", detail: "\(page.funds.count)")
            Text("Debt funds are taxed at the slab rate whatever the holding period, so they are not part of the equity figures above. The class is guessed from the fund's name.")
                .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            KList(items: page.funds.enumerated().map { Indexed(index: $0.offset, value: $0.element.disposal, assetClass: $0.element.assetClass) }) { item in
                let d = item.value
                KRow(title: d.holding, subtitle: "\(item.assetClass.capitalized) · sold \(Fmt.date(d.soldOn)) · bought \(Fmt.date(d.acquiredOn))",
                     value: Fmt.signed(Money.jsRound(d.gain)), valueTone: Tone.of(d.gain), valueCaption: d.term)
            }
        }
    }

    private struct Indexed: Identifiable {
        let index: Int
        let value: CapitalGains.Disposal
        var assetClass = ""
        var id: Int { index }
    }
}
