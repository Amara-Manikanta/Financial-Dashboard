import SwiftUI

/// Subscriptions, EMIs and standing transfers found in your history (deterministic rules,
/// see `Core/Recurring.swift`). Marking one cancelled or ignored is done on the Mac.
struct RecurringView: View {
    @ObservedObject var store: FinanceStore
    private enum View_: String, CaseIterable, Identifiable { case active = "Active", stopped = "Stopped", ignored = "Ignored"; var id: String { rawValue } }
    @State private var view = View_.active
    @State private var query = ""
    @State private var open: Set<String> = []

    private func inr(_ v: Double) -> String { Money.rupees(v) }

    var body: some View {
        let d = store.data
        let series = Recurring.applyOverrides(Recurring.detect(d.expensesRaw), d.appDataRaw["recurringOverrides"])
        let active = series.filter { $0.status == "active" }
        let stopped = series.filter { $0.status == "stopped" }
        let ignored = series.filter { $0.status == "ignored" }
        let still = series.filter(\.chargedAfterCancel)
        let rises = active.filter { $0.priceChangePct > 10 && ($0.lastAmount - $0.firstAmount) >= 25 }
            .enumerated().sorted { $0.element.priceChangePct != $1.element.priceChangePct ? $0.element.priceChangePct > $1.element.priceChangePct : $0.offset < $1.offset }.map(\.element)
        let pool = view == .stopped ? stopped : view == .ignored ? ignored : active
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        let shown = q.isEmpty ? pool : pool.filter { $0.label.lowercased().contains(q) || $0.key.contains(q) }

        KScreen(refresh: { await store.load() }) {
            if series.isEmpty {
                KCard { Text("No repeating charges detected yet. A series needs at least three charges at a steady interval.").font(Theme.body).foregroundStyle(Theme.muted) }
            } else {
                KCard(tint: Theme.accent) {
                    KStat(label: "Annual run-rate", value: inr(active.reduce(0) { $0 + $1.annualRunRate }), size: .hero)
                    Text("if every active series keeps billing").font(Theme.footnote).foregroundStyle(Theme.muted)
                    HStack(alignment: .top) {
                        KStat(label: "Active", value: "\(active.count)", caption: "\(stopped.count) stopped")
                        Spacer()
                        KStat(label: "Price rises", value: "\(rises.count)", tone: rises.isEmpty ? .neutral : .warning)
                    }.padding(.top, 10)
                }
                if !still.isEmpty {
                    KSectionHeader(title: "Still charging after you cancelled")
                    KList(items: still) { s in KRow(title: s.label, subtitle: "marked cancelled \(s.markedOn ?? "") · charged again \(s.last)", value: inr(s.typical), valueTone: .negative) }
                }
                if !rises.isEmpty {
                    KSectionHeader(title: "Charging more than they used to")
                    KList(items: rises) { s in KRow(title: s.label, subtitle: "\(inr(s.firstAmount)) → \(inr(s.lastAmount))", value: "+\(Int(Money.jsRound(s.priceChangePct)))%", valueTone: .warning) }
                }

                Picker("Show", selection: $view) { ForEach(View_.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.segmented)
                TextField("Search", text: $query).textInputAutocapitalization(.never).autocorrectionDisabled()
                    .padding(10).background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 10, style: .continuous)).foregroundStyle(.white)
                if shown.isEmpty { KCard { Text("Nothing here.").font(Theme.body).foregroundStyle(Theme.muted) } }
                KList(items: shown) { s in
                    VStack(alignment: .leading, spacing: 6) {
                        Button { if open.contains(s.id) { open.remove(s.id) } else { open.insert(s.id) } } label: {
                            KRow(title: s.label, subtitle: "\(s.kind) · \(s.cadence) · \(s.count) charges", value: inr(s.typical), valueCaption: "\(inr(s.annualRunRate)) a year", chevron: false)
                        }.buttonStyle(.plain)
                        if open.contains(s.id) {
                            Text("First \(s.first) · last \(s.last) · next expected \(s.nextExpected)").font(Theme.footnote).foregroundStyle(Theme.muted)
                            Text("Range \(inr(s.min))–\(inr(s.max)) · total paid \(inr(s.total))").font(Theme.footnote).foregroundStyle(Theme.muted)
                            if !s.cards.isEmpty { Text("Billed to \(Set(s.cards).sorted().joined(separator: ", "))").font(Theme.footnote).foregroundStyle(Theme.muted) }
                            if s.overridden { Text("You marked it \(s.overrideStatus ?? "")\(s.markedOn.map { " on \($0)" } ?? "")\(s.note.isEmpty ? "" : " — \(s.note)")").font(Theme.footnote).foregroundStyle(Theme.accent) }
                        }
                    }
                }
            }
        }
        .navigationTitle("Recurring")
        .navigationBarTitleDisplayMode(.large)
    }
}
