import SwiftUI

/// A gold-bond account, laid out as the Mac's page is: units, invested, current value, gain and interest received,
/// a card per holding (issue, price, value, gain, maturity) and the interest history. Holdings and interest rows are
/// added, changed and deleted through the same version-checked, offline-capable ledger writes as other accounts.
struct SGBView: View {
    @ObservedObject var store: FinanceStore
    let accountId: String

    @State private var sheet: SheetRoute?
    @State private var deleting: Deletion?
    @State private var message: String?

    private struct SheetRoute: Identifiable { let id = UUID(); let spec: Int; let index: Int?; let row: JSONValue? }
    private struct Deletion { let spec: Int; let index: Int; let row: JSONValue; let what: String }

    private var account: JSONValue { store.data.savingsRaw.array.first { $0["id"].text == accountId } ?? .null }
    private var specs: [AccountLedger.ListSpec] { AccountLedger.lists(for: "sgb") }
    private let gold = Color(red: 0.98, green: 0.75, blue: 0.14)

    var body: some View {
        let raw = account
        let p = SGBPage.page(raw)
        let title = [raw["title"], raw["name"]].first { $0.truthy }?.text ?? "Gold Bonds"
        KScreen(refresh: { await store.load() }) {
            if let message { KNotice(message: message) { self.message = nil } }
            Text("SOVEREIGN GOLD BONDS").font(Theme.caption).tracking(0.8).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            Button { sheet = SheetRoute(spec: 0, index: nil, row: nil) } label: {
                Label("Add Holding", systemImage: "plus").font(Theme.footnote.weight(.heavy)).frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(.white)
            }

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                stat("Total gold units", "\(String(format: "%g", p.units)) g", gold)
                stat("Total invested", Money.rupees(p.invested), Theme.muted)
                stat("Current value", Money.rupees(p.current), Theme.accent)
                stat("Total gains", Money.rupees(p.gain), p.gain >= 0 ? Theme.positive : Theme.negative, sub: (p.gain >= 0 ? "+" : "") + String(format: "%.2f", p.gainPercent) + "%")
            }
            stat("Interest received", Money.rupees(p.interestReceived), Theme.positive)

            KSectionHeader(title: "Holdings", detail: "\(p.holdings.count)")
            if p.holdings.isEmpty { KCard { Text("No holdings yet.").font(Theme.footnote).foregroundStyle(Theme.muted) } }
            ForEach(p.holdings) { h in
                let lock = AccountLedger.rowLock(h.raw, type: "sgb")
                Button { if lock == nil { sheet = SheetRoute(spec: 0, index: h.index, row: h.raw) } } label: { holdingCard(h, lock: lock) }.buttonStyle(.plain)
                    .contextMenu { if lock == nil { Button(role: .destructive) { deleting = Deletion(spec: 0, index: h.index, row: h.raw, what: "gold bond holding") } label: { Label("Delete", systemImage: "trash") } } }
            }

            HStack {
                KSectionHeader(title: "Interest history", detail: "\(p.interest.count)")
                Button { sheet = SheetRoute(spec: 1, index: nil, row: nil) } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) }
            }
            if p.interest.isEmpty { KCard { Text("No interest recorded yet.").font(Theme.footnote).foregroundStyle(Theme.muted) } }
            else {
                KList(items: p.interest) { i in
                    let lock = AccountLedger.rowLock(i.raw, type: "sgb")
                    Button { if lock == nil { sheet = SheetRoute(spec: 1, index: i.index, row: i.raw) } } label: {
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(Fmt.date(i.date)).font(Theme.body).foregroundStyle(.white)
                                if !i.remarks.isEmpty { Text(i.remarks).font(Theme.footnote).foregroundStyle(Theme.muted) }
                            }
                            Spacer()
                            Text("+" + Money.rupees(i.amount)).font(Theme.figure).foregroundStyle(Theme.positive)
                        }
                    }.buttonStyle(.plain)
                    .contextMenu { if lock == nil { Button(role: .destructive) { deleting = Deletion(spec: 1, index: i.index, row: i.raw, what: "interest entry") } label: { Label("Delete", systemImage: "trash") } } }
                }
                Text("Tap a row to change it; long-press to delete. The account value is recalculated from the holdings.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
        .toolbar { EditRecordButton(store: store, collection: "savings", id: accountId, title: title) }
        .sheet(item: $sheet) { r in
            LedgerRowSheet(store: store, accountId: accountId, type: "sgb", spec: specs[r.spec], parentIndex: nil, index: r.index, editing: r.row)
        }
        .confirmationDialog(deleting.map { "Delete this \($0.what)?" } ?? "", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let d = deleting { Task { message = await store.saveAccount(accountId, .ledger(specId: specs[d.spec].id, parentIndex: nil, .delete(index: d.index, expected: d.row)), label: "Delete gold bond row") } }
            }
        }
    }

    private func stat(_ label: String, _ value: String, _ tint: Color, sub: String? = nil) -> some View {
        KCard(tint: tint) {
            VStack(alignment: .leading, spacing: 4) {
                Text(label.uppercased()).font(Theme.caption).tracking(0.8).foregroundStyle(tint).lineLimit(2)
                Text(value).font(.system(size: 20, weight: .heavy, design: .rounded).monospacedDigit()).foregroundStyle(.white).minimumScaleFactor(0.7).lineLimit(1)
                if let sub { Text(sub).font(Theme.footnote).foregroundStyle(tint) }
            }
            .frame(maxWidth: .infinity, minHeight: 64, alignment: .topLeading)
        }
    }

    private func holdingCard(_ h: SGBPage.Holding, lock: String?) -> some View {
        KCard(tint: gold) {
            VStack(alignment: .leading, spacing: 8) {
                Text(h.series).font(Theme.body.weight(.semibold)).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                Text("\(String(format: "%g", h.units)) g" + (h.date.isEmpty ? "" : " · issued \(Fmt.date(h.date))")).font(Theme.footnote).foregroundStyle(Theme.muted)
                HStack(alignment: .top) {
                    KStat(label: "Issue price", value: Money.rupees(h.issuePrice))
                    Spacer()
                    KStat(label: "Current price", value: Money.rupees(h.currentPrice))
                }
                HStack(alignment: .top) {
                    KStat(label: "Current value", value: Money.rupees(h.value))
                    Spacer()
                    KStat(label: "Gain", value: (h.gain >= 0 ? "+" : "") + Money.rupees(h.gain), tone: Tone.of(h.gain))
                }
                if !h.maturity.isEmpty { Text("Matures \(Fmt.date(h.maturity))").font(Theme.footnote).foregroundStyle(Theme.muted) }
                if let lock { Text(lock).font(Theme.footnote).foregroundStyle(Theme.muted) }
            }
        }
    }
}
