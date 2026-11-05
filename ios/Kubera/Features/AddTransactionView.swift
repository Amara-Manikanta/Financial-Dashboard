import SwiftUI

/// Logs ONE transaction on the Mac. Nothing is saved until Save is pressed, and a failure says why
/// and leaves everything as it was — a failed write must never look like a successful one.
struct AddTransactionView: View {
    @ObservedObject var store: FinanceStore
    /// The date the form opens on: today when the month being viewed is this month, otherwise the 1st of it (as the Mac's month page does).
    var defaultDate = Date()
    /// Opens with this credit card already chosen (from a card's own page).
    var presetCard: String? = nil
    @Environment(\.dismiss) private var dismiss
    @State private var draft = NewTransaction.Draft()
    @State private var started = false
    @State private var saving = false
    @State private var failure: String?
    @State private var tried = false

    var body: some View {
        let d = store.data
        let map = Budgets.categoryMap(appData: d.appDataRaw)
        let cards = d.creditCardsRaw.array.filter { $0["type"].text != "wallet" }.map { $0["name"].text }
        let bad = tried ? NewTransaction.problems(draft) : []
        NavigationStack {
            Form {
                Section {
                    Picker("", selection: $draft.received) { Text("Spent").tag(false); Text("Received").tag(true) }.pickerStyle(.segmented)
                    TextField("Amount", text: $draft.amount).keyboardType(.decimalPad)
                        .foregroundStyle(bad.contains(.amount) ? Theme.negative : .primary)
                    TextField("What was it for? (optional)", text: $draft.title)
                    DatePicker("Date", selection: $draft.date, in: ...max(Date(), defaultDate), displayedComponents: .date)
                }
                Section("Category") {
                    Picker("Category", selection: $draft.category) {
                        Text("Choose…").tag("")
                        ForEach(map.filter { !$0.subs.isEmpty }, id: \.main) { m in
                            Section(m.main) { ForEach(m.subs, id: \.self) { Text($0).tag($0) } }
                        }
                    }
                    if bad.contains(.category) { Text("Pick a category.").font(.footnote).foregroundStyle(Theme.negative) }
                }
                Section("Paid with") {
                    Toggle("Credit card", isOn: $draft.onCard)
                    if draft.onCard {
                        Picker("Card", selection: $draft.card) { Text("Choose…").tag(""); ForEach(cards, id: \.self) { Text($0).tag($0) } }
                        if bad.contains(.card) { Text("Pick the card.").font(.footnote).foregroundStyle(Theme.negative) }
                    }
                }
                if let failure { Section { Label(failure, systemImage: "exclamationmark.triangle.fill").foregroundStyle(Theme.negative).font(.footnote) } header: { Text("Not saved") } }
                Section { Text("This adds one row. Away from your Mac it is kept on this phone and sent when the Mac is back.").font(.footnote).foregroundStyle(.secondary) }
            }
            .onAppear { if !started { started = true; draft.date = defaultDate; if let c = presetCard { draft.onCard = true; draft.card = c } } }
            .navigationTitle("Add transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(saving) }
                ToolbarItem(placement: .confirmationAction) {
                    Button(saving ? "Saving…" : "Save") { save(map: map) }.disabled(saving)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func save(map: [(main: String, subs: [String])]) {
        tried = true
        guard NewTransaction.problems(draft).isEmpty else { return }
        saving = true; failure = nil
        Task {
            let result = await store.addTransaction(draft)
            saving = false
            if let result { failure = result } else { dismiss() }
        }
    }
}
