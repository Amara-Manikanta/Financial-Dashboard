import SwiftUI

/// Gold, silver and the rest, valued the way the Mac's page values them (see `NetWorth`):
/// a stored value wins, otherwise weight at the rate in force. A rate typed in by hand beats
/// the live feed; the phone does not fetch the live feed, so without a typed rate it says so.
struct MetalsView: View {
    @ObservedObject var store: FinanceStore
    @Environment(\.openWebPage) private var openWebPage

    private func inr(_ v: Double) -> String { Money.rupees(v) }
    private static let titles: [(key: String, title: String)] = [("gold", "Gold"), ("silver", "Silver"), ("platinum", "Platinum"), ("antique_coins", "Antique Coins"), ("currencies", "Currencies")]

    var body: some View {
        let d = store.data
        let manual = d.appDataRaw["manualMetalRates"]
        let rates = NetWorth.MetalRates(manualGold: manual["gold"].double, manualSilver: manual["silver"].double)
        let processed = NetWorth.processedMetals(d.metalsRaw, rates: rates)
        let total = Self.titles.reduce(0) { $0 + Self.sum(processed, $1.key, "currentValue") }
        KScreen(refresh: { await store.load() }) {
            KCard(tint: Theme.warning) {
                KStat(label: "Total metals value", value: inr(total), size: .hero)
                HStack(alignment: .top) {
                    KStat(label: "Gold rate (24K)", value: "\(inr(rates.gold24))/g", caption: manual["gold"].double > 0 ? "Your own rate" : "Placeholder — set your own rate on the Mac")
                    Spacer()
                    KStat(label: "Silver rate", value: "\(inr(rates.silver))/g", caption: manual["silver"].double > 0 ? "Your own rate" : "Placeholder — set your own rate on the Mac")
                }.padding(.top, 8)
            }
            KList(items: Self.titles.filter { !(processed[$0.key] ?? []).isEmpty }.map { Kind_(key: $0.key, title: $0.title) }) { k in
                let items = processed[k.key] ?? []
                let hideWeight = k.key == "antique_coins" || k.key == "currencies"
                NavigationLink(value: MetalRoute(key: k.key)) {
                    KRow(title: k.title, subtitle: "\(items.count) positions\(hideWeight ? "" : " · \(String(format: "%g", (Self.sum(processed, k.key, "weightGm") * 10000).rounded() / 10000))g")", value: inr(Self.sum(processed, k.key, "currentValue")))
                }.buttonStyle(.plain)
            }
            Text("Tap a metal for its items, photos and bills on the Mac.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
        }
        .navigationTitle("Precious Metals")
        .navigationBarTitleDisplayMode(.large)
        .navigationDestination(for: MetalRoute.self) { MetalDetailView(store: store, route: $0) }
    }
    private static func sum(_ p: [String: [JSONValue]], _ k: String, _ f: String) -> Double { (p[k] ?? []).reduce(0) { $0 + $1[f].double } }
    private struct Kind_: Identifiable { let key: String; let title: String; var id: String { key } }
}
