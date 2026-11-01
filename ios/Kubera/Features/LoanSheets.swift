import SwiftUI

/// Add or change one transaction with a person (a repayment, or lending / borrowing more).
struct LentTransactionSheet: View {
    @ObservedObject var store: FinanceStore
    let lentId: String
    let name: String
    let isLent: Bool
    let editing: JSONValue?

    @State private var draft = LoanLedger.LentDraft()
    @State private var loaded = false

    var body: some View {
        FormSheet(title: editing == nil ? "Add transaction" : "Edit transaction",
                  problems: LoanLedger.lentProblems(draft), touched: editing != nil || draft != LoanLedger.LentDraft(), save: save) {
            Section {
                Picker("Type", selection: $draft.type) {
                    Text(isLent ? "Received payment" : "You paid back").tag("repayment")
                    Text(isLent ? "Lent more" : "Borrowed more").tag("additional")
                }
                .pickerStyle(.segmented)
                NumberRow(label: "Amount ₹", text: $draft.amount)
                DayRow(label: "Date", day: $draft.date)
                TextRow(label: "Note", text: $draft.description)
            } footer: { Text(isLent ? "Money back lowers what \(name) owes you; lending more raises it." : "Paying back lowers what you owe \(name); borrowing more raises it.") }
        }
        .onAppear { guard !loaded else { return }; loaded = true; if let editing { draft = LoanLedger.lentDraft(from: editing) } }
    }

    private func save() async -> String? {
        let row = LoanLedger.lentRow(draft, id: String(Int64(Date().timeIntervalSince1970 * 1000)), base: editing ?? .null)
        let change: DepositLedger.ListChange = editing != nil ? .replace(id: editing!["id"].text, row) : .add(row)
        return await store.saveListRow(collection: "lents", id: lentId, key: "transactions", change, label: "\(editing == nil ? "Add" : "Change") transaction · \(name)")
    }
}

/// Record or change one EMI payment of a loan.
struct LoanPaymentSheet: View {
    @ObservedObject var store: FinanceStore
    let loan: JSONValue
    let editing: JSONValue?

    @State private var draft = LoanLedger.PaymentDraft()
    @State private var loaded = false

    var body: some View {
        FormSheet(title: editing == nil ? "Record EMI payment" : "Edit EMI payment",
                  problems: LoanLedger.paymentProblems(draft), touched: editing != nil || draft != LoanLoanDefault.draft(loan), save: save) {
            Section {
                NumberRow(label: "Instalment no.", text: $draft.emiNumber)
                DayRow(label: "Date", day: $draft.date)
                NumberRow(label: "Amount ₹", text: $draft.amount)
                Picker("Paid by", selection: $draft.mode) { ForEach(LoanLedger.paymentModes, id: \.id) { Text($0.label).tag($0.id) } }
                if draft.mode == "credit_card" { TextRow(label: "Card", text: $draft.card) }
            }
            Section("Charges, if any") {
                NumberRow(label: "Processing fee ₹", text: $draft.fee)
                NumberRow(label: "GST ₹", text: $draft.gst)
                TextRow(label: "Notes", text: $draft.notes)
            }
        }
        .onAppear {
            guard !loaded else { return }; loaded = true
            draft = editing.map(LoanLedger.paymentDraft(from:)) ?? LoanLedger.paymentDraft(newFor: loan)
        }
    }

    private func save() async -> String? {
        let row = LoanLedger.paymentRow(draft, base: editing ?? .null)
        let change: DepositLedger.ListChange = editing != nil ? .replace(id: editing!["id"].text, row) : .add(row)
        return await store.saveListRow(collection: "loans", id: loan["id"].text, key: "payments", change, label: "\(editing == nil ? "Record" : "Change") EMI payment · \(loan["name"].text)")
    }
}

private enum LoanLoanDefault {
    static func draft(_ loan: JSONValue) -> LoanLedger.PaymentDraft { LoanLedger.paymentDraft(newFor: loan) }
}
