import SwiftUI

/// Real estate and other valuable assets by category. An item's own page (photos, receipts,
/// warranty and service history) is on the Mac.
struct AssetsView: View {
    @ObservedObject var store: FinanceStore
    @Environment(\.openWebPage) private var openWebPage

    private struct Cat: Identifiable { let raw: JSONValue; var id: String { raw["id"].text } }
    private func inr(_ v: Double) -> String { Money.rupees(v) }
    private func value(_ item: JSONValue) -> Double {
        for k in ["currentValue", "purchasePrice", "purchasedValue"] { let v = item[k].double; if v != 0 && !v.isNaN { return v } }
        return 0
    }

    var body: some View {
        let d = store.data
        let w = Warranty.summary(assets: d.assetsRaw)
        let cats = d.assetsRaw.array.filter { !$0.isNull }
        let total = cats.reduce(0) { $0 + $1["items"].array.reduce(0) { $0 + value($1) } }
        KScreen(refresh: { await store.load() }) {
            KCard(tint: Theme.accent) {
                KStat(label: "Total valuation", value: inr(total), size: .hero)
                Text("\(cats.reduce(0) { $0 + $1["items"].array.count }) items in \(cats.count) categories").font(Theme.footnote).foregroundStyle(Theme.muted)
            }
            if w.expiring > 0 || w.expired > 0 || w.unknown > 0 {
                KCard {
                    Text("Warranties").font(Theme.footnote.weight(.bold)).foregroundStyle(Theme.muted)
                    if w.expiring > 0 { Text("\(w.expiring) expiring soon").font(Theme.footnote.weight(.semibold)).foregroundStyle(Theme.warning) }
                    if w.active > 0 { Text("\(w.active) in warranty").font(Theme.footnote.weight(.semibold)).foregroundStyle(Theme.positive) }
                    if w.expired > 0 { Text("\(w.expired) expired").font(Theme.footnote).foregroundStyle(Theme.muted) }
                    if w.unknown > 0 { Text("\(w.unknown) not recorded").font(Theme.footnote).foregroundStyle(Theme.muted) }
                    if w.missingReceipt > 0 { Text("\(w.missingReceipt) without a receipt").font(Theme.footnote).foregroundStyle(Theme.warning) }
                }
            }
            KList(items: cats.map { Cat(raw: $0) }) { cat in
                let c = cat.raw
                let items = c["items"].array
                NavigationLink(value: AssetCategoryRoute(id: c["id"].text)) {
                    KRow(title: c["title"].text, subtitle: "\(items.count) items", value: inr(items.reduce(0) { $0 + value($1) }))
                }.buttonStyle(.plain)
            }
        }
        .navigationTitle("Assets")
        .navigationBarTitleDisplayMode(.large)
        .navigationDestination(for: AssetCategoryRoute.self) { AssetCategoryView(store: store, route: $0) }
    }
}
