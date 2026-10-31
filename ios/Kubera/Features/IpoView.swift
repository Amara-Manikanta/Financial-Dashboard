import SwiftUI

/// Every IPO applied for, not only the ones that came through: the failures are the
/// denominator without which an allotment rate means nothing.
struct IpoView: View {
    @ObservedObject var store: FinanceStore
    private var s: IpoPage.Summary { store.ipos }

    private func statusTone(_ status: String) -> Tone {
        switch status {
        case "allotted", "partial": return .positive
        case "not-allotted": return .negative
        case "applied": return .warning
        default: return .neutral
        }
    }

    var body: some View {
        KScreen(refresh: { await store.load() }) {
            KCard(tint: Theme.accent) {
                KStat(label: "Allotment rate", value: s.allotmentRate.map { String(format: "%.0f%%", $0) } ?? "—", size: .hero)
                Text("\(s.allottedCount) of \(s.decidedCount) decided\(s.pendingCount > 0 ? " · \(s.pendingCount) pending" : "")")
                    .font(Theme.footnote).foregroundStyle(Theme.muted)
            }
            HStack(spacing: 12) {
                KCard { KStat(label: "Blocked now", value: Money.compact(s.capitalBlockedNow), tone: s.capitalBlockedNow > 0 ? .warning : .neutral, caption: "waiting on a result", size: .large) }
                KCard { KStat(label: "Ever applied", value: Money.compact(s.totalApplied), caption: "\(s.total) applications", size: .large) }
            }
            HStack(spacing: 12) {
                KCard { KStat(label: "Invested", value: Money.compact(s.totalInvested), caption: "at allotment", size: .large) }
                KCard { KStat(label: "Listing gain", value: Fmt.signed(Money.jsRound(s.listingGain)), tone: Tone.of(s.listingGain),
                               caption: "\(s.listingGainCount) with a listing price", size: .large) }
            }

            if s.missingListingPrice > 0 {
                KNotice(message: "\(s.missingListingPrice) allotted \(s.missingListingPrice == 1 ? "IPO has" : "IPOs have") no listing price recorded, so \(s.missingListingPrice == 1 ? "its" : "their") gain is not counted.")
            }
            if !s.unlinkedAllotments.isEmpty {
                KNotice(message: "Allotments on record with no application behind them: \(s.unlinkedAllotments.map(\.name).joined(separator: ", ")). That is a gap in this record, not a missing holding.")
            }

            KSectionHeader(title: "Applications", detail: "newest first")
            if s.applications.isEmpty {
                KCard { Text("No IPO applications recorded.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            } else {
                KList(items: s.applications) { app in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(app.company).font(Theme.body).foregroundStyle(.white).lineLimit(2)
                            Spacer()
                            KBadge(text: app.status.replacingOccurrences(of: "-", with: " "), tone: statusTone(app.status))
                        }
                        Text("\([app.symbol, app.category.capitalized].filter { !$0.isEmpty }.joined(separator: " · ")) · \(Fmt.shares(app.lots)) lot\(app.lots == 1 ? "" : "s") @ \(Money.rupees(app.cutOffPrice)) · applied \(Fmt.date(app.appliedDate))")
                            .font(Theme.footnote).foregroundStyle(Theme.muted)
                        HStack {
                            Text("Blocked \(Money.rupees(app.amountBlocked))").font(Theme.footnote.monospacedDigit()).foregroundStyle(.white)
                            Spacer()
                            if app.allotted {
                                Text("Allotted \(Fmt.shares(app.sharesAllotted)) · \(Money.rupees(app.investedAtAllotment))").font(Theme.footnote.monospacedDigit()).foregroundStyle(Theme.positive)
                            } else if app.refunded > 0 && !app.pending {
                                Text("Refunded \(Money.rupees(app.refunded))").font(Theme.footnote.monospacedDigit()).foregroundStyle(Theme.muted)
                            }
                        }
                        if app.hasListing, let pct = app.listingGainPct {
                            Text("Listed at \(Money.rupees(app.listingPrice)) · \(Fmt.signed(app.listingGain)) (\(Fmt.percent(pct)))")
                                .font(Theme.footnote.weight(.semibold)).foregroundStyle(Tone.of(app.listingGain).color)
                        }
                        if let days = app.daysBlocked { Text("Money tied up for \(days) day\(days == 1 ? "" : "s")").font(Theme.footnote).foregroundStyle(Theme.muted) }
                    }
                    .editable(store, "ipoApplications", id: app.id, title: app.company)
                }
            }
        }
        .navigationTitle("IPO Applications")
        .navigationBarTitleDisplayMode(.large)
    }
}
