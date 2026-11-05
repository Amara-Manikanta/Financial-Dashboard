import SwiftUI

/// The emergency fund, laid out as the Mac's page is: the current balance and the deposits and withdrawals
/// oldest first (NAV is 1, so units are the amount). Rows are added, changed and deleted through the same
/// version-checked, offline-capable ledger writes as other accounts.
struct EmergencyFundView: View {
    @ObservedObject var store: FinanceStore
    let accountId: String

    @State private var sheet: SheetRoute?
    @State private var deleting: (index: Int, row: JSONValue)?
    @State private var message: String?

    private struct SheetRoute: Identifiable { let id = UUID(); let index: Int?; let row: JSONValue? }
    private var account: JSONValue { store.data.savingsRaw.array.first { $0["id"].text == accountId } ?? .null }
    private var spec: AccountLedger.ListSpec { AccountLedger.lists(for: "liquid")[0] }
    private let green = Color(red: 0.2, green: 0.83, blue: 0.6)

    var body: some View {
        let raw = account
        let title = [raw["title"], raw["name"]].first { $0.truthy }?.text ?? "Emergency Fund"
        // Mac order: by date, oldest first (stable for equal dates).
        let rows = raw["transactions"].array.enumerated().sorted { ($0.element["date"].text, $0.offset) < ($1.element["date"].text, $1.offset) }
        KScreen(refresh: { await store.load() }) {
            if let message { KNotice(message: message) { self.message = nil } }
            Button { sheet = SheetRoute(index: nil, row: nil) } label: {
                Label("Add Transaction", systemImage: "plus").font(Theme.footnote.weight(.heavy)).frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(.white)
            }
            KCard(tint: green) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("CURRENT BALANCE").font(Theme.caption).tracking(0.8).foregroundStyle(green)
                    Text(Money.rupees(raw["amount"].double)).font(.system(size: 30, weight: .black, design: .rounded).monospacedDigit()).foregroundStyle(.white)
                }.frame(maxWidth: .infinity, alignment: .leading)
            }
            KSectionHeader(title: "Transactions", detail: "\(rows.count)")
            if rows.isEmpty { KCard { Text("No transactions recorded yet.").font(Theme.footnote).foregroundStyle(Theme.muted) } }
            else {
                KList(items: rows.map { Row(index: $0.offset, raw: $0.element) }) { r in
                    let lock = AccountLedger.rowLock(r.raw, type: "liquid")
                    let out = ["sell", "withdraw"].contains(r.raw["type"].text)
                    Button { if lock == nil { sheet = SheetRoute(index: r.index, row: r.raw) } } label: {
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(Fmt.date(r.raw["date"].text)).font(Theme.body).foregroundStyle(.white)
                                KBadge(text: out ? "Withdraw" : "Deposit", tone: out ? .warning : .positive)
                                if r.raw["remarks"].truthy { Text(r.raw["remarks"].text).font(Theme.footnote).foregroundStyle(Theme.muted) }
                                if let lock { Text(lock).font(Theme.footnote).foregroundStyle(Theme.muted) }
                            }
                            Spacer()
                            Text(Money.rupees(r.raw["amount"].double)).font(Theme.figure).foregroundStyle(out ? Theme.negative : .white)
                        }
                    }.buttonStyle(.plain)
                    .contextMenu { if lock == nil { Button(role: .destructive) { deleting = (r.index, r.raw) } label: { Label("Delete", systemImage: "trash") } } }
                }
                Text("Tap a row to change it; long-press to delete. The balance is recalculated from every deposit and withdrawal.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
        .toolbar { EditRecordButton(store: store, collection: "savings", id: accountId, title: title) }
        .sheet(item: $sheet) { r in LedgerRowSheet(store: store, accountId: accountId, type: "liquid", spec: spec, parentIndex: nil, index: r.index, editing: r.row) }
        .confirmationDialog("Delete this transaction?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let d = deleting { Task { message = await store.saveAccount(accountId, .ledger(specId: spec.id, parentIndex: nil, .delete(index: d.index, expected: d.row)), label: "Delete emergency fund row") } }
            }
        }
    }

    private struct Row: Identifiable { let index: Int; let raw: JSONValue; var id: Int { index } }
}
