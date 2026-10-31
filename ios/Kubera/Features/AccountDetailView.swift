import SwiftUI

struct AccountRoute: Hashable { let id: String }

/// One savings or investment account: its value and the stored records behind it. Adding or
/// editing records is done on the Mac.
struct AccountDetailView: View {
    @ObservedObject var store: FinanceStore
    let route: AccountRoute
    @State private var limit = 30

    var body: some View {
        let raw = store.data.savingsRaw.array.first { $0["id"].text == route.id } ?? .null
        let p = AccountDetail.page(raw)
        KScreen(refresh: { await store.load() }) {
            KCard(tint: Theme.accent) {
                KStat(label: p.kind.capitalized, value: Money.rupees(p.value), size: .hero)
                if p.showsInvested && p.invested > 0 {
                    HStack(alignment: .top) {
                        KStat(label: "Invested", value: Money.rupees(p.invested))
                        Spacer()
                        KStat(label: "Gain", value: Fmt.signed(p.value - p.invested), tone: Tone.of(p.value - p.invested), caption: Fmt.percent((p.value - p.invested) / p.invested * 100))
                    }.padding(.top, 8)
                }
                ForEach(Array(p.facts.enumerated()), id: \.offset) { _, f in
                    HStack(alignment: .firstTextBaseline) { Text(f.label).font(Theme.footnote).foregroundStyle(Theme.muted); Spacer(); Text(f.value).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white) }
                }
            }
            ForEach(p.sections) { s in
                KSectionHeader(title: s.title, detail: "\(s.rows.count)")
                KList(items: Array(s.rows.prefix(limit))) { r in
                    KRow(title: r.title, subtitle: r.subtitle, value: r.value, valueTone: r.tone > 0 ? .positive : .neutral)
                }
                if s.rows.count > limit { Button("Show 30 more") { limit += 30 }.font(Theme.footnote.weight(.bold)) }
            }
            Text("Records are added and edited on the Mac.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
        }
        .navigationTitle(p.title.isEmpty ? "Account" : p.title)
        .toolbar { EditRecordButton(store: store, collection: "savings", id: route.id, title: p.title.isEmpty ? "Account" : p.title) }
        .navigationBarTitleDisplayMode(.large)
    }
}
