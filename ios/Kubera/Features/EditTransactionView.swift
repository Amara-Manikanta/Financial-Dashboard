import SwiftUI

/// Changes or removes ONE transaction on the Mac. Only the fields you changed are sent; removing asks
/// first; a refusal says why and leaves everything as it was.
struct EditTransactionView: View {
    @ObservedObject var store: FinanceStore
    let row: AllTransactions.Row
    let lock: String?
    @Environment(\.dismiss) private var dismiss
    @State private var draft: EditTransaction.Draft
    @State private var busy = false
    @State private var failure: String?
    @State private var confirmDelete = false
    @State private var tried = false

    init(store: FinanceStore, row: AllTransactions.Row, lock: String?) {
        self.store = store; self.row = row; self.lock = lock
        _draft = State(initialValue: EditTransaction.draft(from: row.raw))
    }

    var body: some View {
        let map = Budgets.categoryMap(appData: store.data.appDataRaw)
        let bad = tried ? EditTransaction.problems(draft) : []
        let changes = EditTransaction.patch(original: row.raw, draft: draft, map: map)
        NavigationStack {
            Form {
                if let lock { Section { Label(lock, systemImage: "lock.fill").font(.footnote).foregroundStyle(Theme.warning) } }
                Section {
                    LabeledContent("Kind", value: row.isCredited ? "Received" : "Spent")
                    TextField("Amount", text: $draft.amount).keyboardType(.decimalPad).foregroundStyle(bad.contains(.amount) ? Theme.negative : .primary)
                    TextField("Title", text: $draft.title)
                    DatePicker("Date", selection: $draft.date, displayedComponents: .date)
                    Picker("Category", selection: $draft.category) {
                        if !map.contains(where: { $0.subs.contains { $0.lowercased() == draft.category.lowercased() } }) { Text(draft.category.isEmpty ? "Choose…" : draft.category).tag(draft.category) }
                        ForEach(map.filter { !$0.subs.isEmpty }, id: \.main) { m in Section(m.main) { ForEach(m.subs, id: \.self) { Text($0).tag($0.lowercased()) } } }
                    }
                }.disabled(lock != nil)
                if let failure { Section { Label(failure, systemImage: "exclamationmark.triangle.fill").foregroundStyle(Theme.negative).font(.footnote) } header: { Text("Not saved") } }
                if lock == nil {
                    Section {
                        Button(role: .destructive) { confirmDelete = true } label: { Label("Delete this transaction", systemImage: "trash") }.disabled(busy)
                    } footer: { Text("Changes only this one row on your Mac.") }
                }
            }
            .navigationTitle("Transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() }.disabled(busy) }
                if lock == nil { ToolbarItem(placement: .confirmationAction) { Button(busy ? "Saving…" : "Save") { save(changes) }.disabled(busy || changes.isEmpty) } }
            }
            .confirmationDialog("Delete this transaction from your Mac?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) { remove() }
            } message: { Text("\(row.title.isEmpty ? "(no title)" : row.title) · \(Money.rupees(abs(row.amount))) · \(row.date)") }
        }
        .preferredColorScheme(.dark)
    }

    private func save(_ changes: [String: Any]) {
        tried = true
        guard EditTransaction.problems(draft).isEmpty, !changes.isEmpty else { return }
        busy = true; failure = nil
        Task {
            let result = await store.updateTransaction(id: row.raw["id"].text, patch: changes)
            busy = false
            if let result { failure = result } else { dismiss() }
        }
    }

    private func remove() {
        busy = true; failure = nil
        Task {
            let result = await store.deleteTransaction(id: row.raw["id"].text)
            busy = false
            if let result { failure = result } else { dismiss() }
        }
    }
}
