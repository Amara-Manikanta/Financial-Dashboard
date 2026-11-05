import SwiftUI
import Charts

/// An NPS account, laid out as the Mac's NPS page is: invested, current value, profit and units, the current
/// allocation pie, a card per scheme, and the statements with a per-scheme filter. Schemes and statements are
/// added, changed and deleted through the same version-checked, offline-capable ledger writes as other accounts.
struct NPSView: View {
    @ObservedObject var store: FinanceStore
    let accountId: String

    @State private var filter = "all"
    @State private var sheet: SheetRoute?
    @State private var pickingScheme = false
    @State private var deletingScheme: NPSPage.Scheme?
    @State private var deletingStatement: NPSPage.Statement?
    @State private var message: String?
    @State private var shown = 20

    private struct SheetRoute: Identifiable { let id = UUID(); let spec: Int; let parent: Int?; let index: Int?; let row: JSONValue? }

    private var account: JSONValue { store.data.savingsRaw.array.first { $0["id"].text == accountId } ?? .null }
    private var specs: [AccountLedger.ListSpec] { AccountLedger.lists(for: "nps") }
    private let palette: [Color] = [Color(red: 0.23, green: 0.51, blue: 0.96), Color(red: 0.06, green: 0.73, blue: 0.51), Color(red: 0.96, green: 0.62, blue: 0.04),
                                    Color(red: 0.55, green: 0.36, blue: 0.96), Color(red: 0.93, green: 0.28, blue: 0.6)]

    var body: some View {
        let raw = account
        let p = NPSPage.page(raw)
        let title = [raw["title"], raw["name"]].first { $0.truthy }?.text ?? "NPS"
        let selected = p.schemes.contains { $0.id == filter } ? filter : "all"
        let rows = NPSPage.statements(p, scheme: selected)
        let tone = Tone.of(p.profit)

        KScreen(refresh: { await store.load() }) {
            if let message { KNotice(message: message) { self.message = nil } }
            if raw["pran"].truthy { Text("PRAN: \(raw["pran"].text)").font(Theme.footnote).tracking(0.8).foregroundStyle(Theme.muted).padding(.horizontal, 4) }

            HStack(spacing: 10) {
                Button { if p.schemes.isEmpty { message = "Add a scheme first." } else { pickingScheme = true } } label: {
                    Label("Add Statement", systemImage: "plus").font(Theme.footnote.weight(.heavy)).frame(maxWidth: .infinity).padding(.vertical, 12)
                        .background(Color(red: 0.06, green: 0.73, blue: 0.51), in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(.white)
                }
                Button { sheet = SheetRoute(spec: 0, parent: nil, index: nil, row: nil) } label: {
                    Label("Add Scheme", systemImage: "gearshape").font(Theme.footnote.weight(.heavy)).frame(maxWidth: .infinity).padding(.vertical, 12)
                        .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(.white)
                }
            }

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                stat("Total invested", Money.rupees(p.invested), Theme.muted)
                stat("Current value", Money.rupees(p.current), Theme.accent)
                stat(p.profit >= 0 ? "Total profit" : "Total loss", Money.rupees(abs(p.profit)), tone == .negative ? Theme.negative : Theme.positive, sub: p.invested > 0 ? Fmt.percent(p.profit / p.invested * 100) : nil)
                stat("Accumulated units", String(format: "%.3f", p.totalUnits), Color(red: 0.75, green: 0.52, blue: 0.99))
            }
            stat("XIRR", "\(String(format: "%g", p.xirr))%", Theme.positive)

            KSectionHeader(title: "Current allocation")
            KCard {
                if p.slices.isEmpty { Text("NO HOLDINGS YET").font(Theme.caption).tracking(0.8).foregroundStyle(Theme.muted).frame(maxWidth: .infinity, minHeight: 90) }
                else {
                    Chart(Array(p.slices.enumerated()), id: \.offset) { i, s in
                        SectorMark(angle: .value("Value", s.value), innerRadius: .ratio(0.6), angularInset: 2).foregroundStyle(palette[i % palette.count])
                    }
                    .frame(height: 190)
                    ForEach(Array(p.slices.enumerated()), id: \.offset) { i, s in
                        HStack { Circle().fill(palette[i % palette.count]).frame(width: 9, height: 9)
                            Text(s.name).font(Theme.footnote).foregroundStyle(.white).lineLimit(1); Spacer()
                            Text(Money.rupees(s.value)).font(Theme.footnote.weight(.semibold)).foregroundStyle(Theme.muted) }
                    }
                }
            }

            KSectionHeader(title: "Scheme holdings", detail: "\(p.schemes.count)")
            ForEach(p.schemes) { s in
                let lock = AccountLedger.rowLock(s.raw, type: "nps")
                Button { filter = s.id } label: { schemeCard(s, on: selected == s.id) }.buttonStyle(.plain)
                    .contextMenu {
                        if lock == nil {
                            Button { sheet = SheetRoute(spec: 0, parent: nil, index: s.index, row: s.raw) } label: { Label("Edit scheme", systemImage: "pencil") }
                            Button(role: .destructive) { deletingScheme = s } label: { Label("Delete scheme", systemImage: "trash") }
                        }
                    }
            }

            KSectionHeader(title: "Statements", detail: "\(rows.count)")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    chip("All Schemes", on: selected == "all") { filter = "all"; shown = 20 }
                    ForEach(p.schemes) { s in chip(s.shortName, on: selected == s.id) { filter = s.id; shown = 20 } }
                }
            }
            if rows.isEmpty { KCard { Text("No statements for this selection.").font(Theme.footnote).foregroundStyle(Theme.muted) } }
            else {
                KList(items: Array(rows.prefix(shown))) { st in
                    let lock = AccountLedger.rowLock(st.raw, type: "nps")
                    Button { if lock == nil { sheet = SheetRoute(spec: 1, parent: st.schemeIndex, index: st.txIndex, row: st.raw) } } label: { statementRow(st, lock: lock) }.buttonStyle(.plain)
                        .contextMenu { if lock == nil { Button(role: .destructive) { deletingStatement = st } label: { Label("Delete", systemImage: "trash") } } }
                }
                if rows.count > shown { Button("Show 20 more") { shown += 20 }.font(Theme.footnote.weight(.bold)) }
                Text("Tap a statement to change it; long-press to delete. Units, invested amount and each scheme's share are recalculated after every change.")
                    .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
        .toolbar { EditRecordButton(store: store, collection: "savings", id: accountId, title: title) }
        .sheet(item: $sheet) { r in
            LedgerRowSheet(store: store, accountId: accountId, type: "nps", spec: specs[r.spec], parentIndex: r.parent, index: r.index, editing: r.row)
        }
        .confirmationDialog("Add a statement to which scheme?", isPresented: $pickingScheme, titleVisibility: .visible) {
            ForEach(p.schemes) { s in Button(s.shortName) { sheet = SheetRoute(spec: 1, parent: s.index, index: nil, row: nil) } }
        }
        .confirmationDialog("Delete this scheme and all its transactions?", isPresented: Binding(get: { deletingScheme != nil }, set: { if !$0 { deletingScheme = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let d = deletingScheme { Task { message = await store.saveAccount(accountId, .ledger(specId: specs[0].id, parentIndex: nil, .delete(index: d.index, expected: d.raw)), label: "Delete NPS scheme") } }
            }
        }
        .confirmationDialog("Delete this transaction?", isPresented: Binding(get: { deletingStatement != nil }, set: { if !$0 { deletingStatement = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let d = deletingStatement { Task { message = await store.saveAccount(accountId, .ledger(specId: specs[1].id, parentIndex: d.schemeIndex, .delete(index: d.txIndex, expected: d.raw)), label: "Delete NPS statement") } }
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

    private func schemeCard(_ s: NPSPage.Scheme, on: Bool) -> some View {
        KCard(tint: on ? Theme.accent : nil) {
            VStack(alignment: .leading, spacing: 8) {
                Text(s.name).font(Theme.body.weight(.semibold)).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                Text("\(String(format: "%g", s.percentage))% ALLOCATION").font(Theme.caption).tracking(0.8).foregroundStyle(Theme.muted)
                HStack(alignment: .top) {
                    KStat(label: "Invested", value: Money.rupees(s.invested))
                    Spacer()
                    KStat(label: "Current", value: Money.rupees(s.current), tone: .positive)
                }
                HStack {
                    Text("NAV \(Money.rupees(s.nav))").font(Theme.footnote).foregroundStyle(Theme.muted); Spacer()
                    Text("\(String(format: "%.3f", s.units)) units").font(Theme.footnote).foregroundStyle(Theme.muted)
                }
            }
        }
    }

    private func chip(_ title: String, on: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(Theme.footnote.weight(.semibold)).lineLimit(1).padding(.horizontal, 12).padding(.vertical, 6)
                .background((on ? Theme.accent : Color.white).opacity(on ? 0.25 : 0.07), in: Capsule()).foregroundStyle(on ? Theme.accent : Theme.muted)
        }.buttonStyle(.plain)
    }

    private func statementRow(_ st: NPSPage.Statement, lock: String?) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(Fmt.date(st.date)).font(Theme.body).foregroundStyle(.white)
                Text(st.scheme).font(Theme.footnote).foregroundStyle(Theme.muted).lineLimit(1)
                KBadge(text: st.type == "billing" ? "Billing" : "Contribution", tone: st.type == "billing" ? .warning : .accent)
                Text("\(String(format: "%.4f", st.units)) units @ \(Money.rupees(st.nav))").font(Theme.footnote).foregroundStyle(Theme.muted)
                if let lock { Text(lock).font(Theme.footnote).foregroundStyle(Theme.muted).lineLimit(2) }
            }
            Spacer()
            Text(Money.rupees(st.amount)).font(Theme.figure).foregroundStyle(st.type == "billing" ? Theme.negative : .white)
        }
    }
}
