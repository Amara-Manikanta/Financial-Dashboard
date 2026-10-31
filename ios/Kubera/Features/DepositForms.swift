import SwiftUI

/// Shared bits of the deposit forms: a date row that stores `yyyy-MM-dd`, a number row, and the
/// save/cancel chrome. Every form shows what is wrong before Save is enabled and what the Mac refused after.
private let dayFormatter: DateFormatter = {
    let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"; return f
}()

struct DayRow: View {
    let label: String
    @Binding var day: String
    var body: some View {
        DatePicker(label, selection: Binding(get: { dayFormatter.date(from: String(day.prefix(10))) ?? Date() }, set: { day = dayFormatter.string(from: $0) }), displayedComponents: .date)
    }
}

struct NumberRow: View {
    let label: String
    @Binding var text: String
    var body: some View {
        LabeledContent(label) { TextField(label, text: $text).keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
    }
}

struct TextRow: View {
    let label: String
    @Binding var text: String
    var body: some View {
        LabeledContent(label) { TextField(label, text: $text, axis: .vertical).multilineTextAlignment(.trailing) }
    }
}

/// A sheet with Cancel / Save, a list of problems once something was typed, and the refusal from the Mac.
struct FormSheet<Content: View>: View {
    let title: String
    let problems: [String]
    let touched: Bool
    let save: () async -> String?
    @ViewBuilder var content: Content

    @Environment(\.dismiss) private var dismiss
    @State private var saving = false
    @State private var message: String?

    var body: some View {
        NavigationStack {
            Form {
                if let message { Section { Text(message).foregroundStyle(Tone.negative.color) } }
                content
                if touched && !problems.isEmpty {
                    Section { ForEach(problems, id: \.self) { Text($0).font(.footnote).foregroundStyle(Tone.negative.color) } }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else {
                        Button("Save") {
                            Task { saving = true; message = nil; message = await save(); saving = false; if message == nil { dismiss() } }
                        }
                        .disabled(!problems.isEmpty)
                    }
                }
            }
        }
    }
}

// MARK: Fixed deposit

struct FDFormSheet: View {
    @ObservedObject var store: FinanceStore
    let accountId: String
    /// nil adds; otherwise the stored deposit being changed or renewed.
    let editing: JSONValue?
    var renewal = false

    @State private var draft = DepositLedger.FDDraft()
    @State private var loaded = false

    var body: some View {
        let proj = DepositLedger.fdProjection(draft)
        FormSheet(title: renewal ? "Renew fixed deposit" : editing == nil ? "Add fixed deposit" : "Edit fixed deposit",
                  problems: DepositLedger.fdProblems(draft), touched: editing != nil || draft != DepositLedger.FDDraft(), save: save) {
            Section {
                TextRow(label: "Account no", text: $draft.accountNo)
                TextRow(label: "Bank", text: $draft.bank)
                TextRow(label: "Branch (optional)", text: $draft.branchName)
            }
            Section {
                DayRow(label: "Start date", day: $draft.startDate)
                DayRow(label: "Maturity date", day: $draft.endDate)
                NumberRow(label: "Principal ₹", text: $draft.originalAmount)
                NumberRow(label: "Interest rate %", text: $draft.interestRate)
                NumberRow(label: "TDS ₹", text: $draft.tds)
                TextRow(label: "Remarks", text: $draft.remarks)
            } footer: {
                if proj.maturity > 0 {
                    Text("Matures to \(Money.rupees(proj.maturity)) · interest \(Money.rupees(proj.interest)) · accrued so far \(Money.rupees(proj.accrued)). Worked out from the bank's compounding, as on the Mac.")
                }
            }
        }
        .onAppear {
            guard !loaded else { return }; loaded = true
            guard let editing else { return }
            draft = DepositLedger.fdDraft(from: editing)
            if renewal {
                // A renewal starts where the old one ended, on what it matured to, at a rate to be entered.
                draft.startDate = String(editing["endDate"].text.prefix(10)); draft.endDate = ""
                draft.originalAmount = editing["maturityAmount"].double == 0 ? draft.originalAmount : RecordEditing.number(editing["maturityAmount"].double)
                draft.interestRate = ""; draft.tds = ""
            }
        }
    }

    private func save() async -> String? {
        let id = DepositLedger.newId()
        var row = DepositLedger.fdRow(draft, id: id, base: editing ?? .null)
        if renewal, let editing, case .object(var f) = row { f["renewalCount"] = .number(editing["renewalCount"].double + 1); row = .object(f) }
        let change: DepositLedger.ListChange = editing != nil ? .replace(id: editing!["id"].text, row) : .add(row)
        return await store.saveAccount(accountId, .deposits(change), label: "\(editing == nil ? "Add" : renewal ? "Renew" : "Change") fixed deposit \(draft.bank)")
    }
}

struct FDCloseSheet: View {
    @ObservedObject var store: FinanceStore
    let accountId: String
    let deposit: JSONValue

    @State private var date = NewTransaction.isoDay(Date())
    @State private var interest = ""
    @State private var remarks = ""

    var body: some View {
        let value = Double(interest.replacingOccurrences(of: ",", with: ""))
        FormSheet(title: "Close deposit", problems: value == nil || value! < 0 ? ["Enter the final interest earned."] : [], touched: !interest.isEmpty, save: save) {
            Section {
                DayRow(label: "Closure date", day: $date)
                NumberRow(label: "Final interest ₹", text: $interest)
                TextRow(label: "Remarks", text: $remarks)
            } footer: { Text("The deposit moves to Archived with its final value fixed at principal plus this interest.") }
        }
        .onAppear { if interest.isEmpty { interest = RecordEditing.number(DepositLedger.accrual(deposit).accruedInterest.rounded()) } }
    }

    private func save() async -> String? {
        let row = DepositLedger.closedRow(deposit, closureDate: date, finalInterest: Double(interest.replacingOccurrences(of: ",", with: "")) ?? 0, remarks: remarks)
        return await store.saveAccount(accountId, .deposits(.replace(id: deposit["id"].text, row)), label: "Close deposit \(deposit["bank"].text)")
    }
}

// MARK: Recurring deposit

struct RDFormSheet: View {
    @ObservedObject var store: FinanceStore
    let accountId: String
    let editing: JSONValue?

    @State private var draft = DepositLedger.RDDraft()
    @State private var loaded = false

    var body: some View {
        FormSheet(title: editing == nil ? "Add recurring deposit" : "Edit recurring deposit",
                  problems: DepositLedger.rdProblems(draft), touched: editing != nil || draft != DepositLedger.RDDraft(), save: save) {
            Section {
                TextRow(label: "Name", text: $draft.name)
                NumberRow(label: "Instalment ₹ / month", text: $draft.installmentAmount)
                DayRow(label: "Start date", day: $draft.startDate)
                DayRow(label: "End date", day: $draft.endDate)
                NumberRow(label: "Interest rate %", text: $draft.interestRate)
                NumberRow(label: "Maturity amount ₹", text: $draft.maturityAmount)
                NumberRow(label: "Deduction day (1–31)", text: $draft.deductionDay)
                Picker("Status", selection: $draft.status) { ForEach(["Active", "Matured", "Closed"], id: \.self) { Text($0).tag($0) } }
            } footer: { Text("Leave the deduction day blank if you don't know it; the reminder then works it out from the last instalment.") }
        }
        .onAppear { guard !loaded else { return }; loaded = true; if let editing { draft = DepositLedger.rdDraft(from: editing) } }
    }

    private func save() async -> String? {
        let row = DepositLedger.rdRow(draft, id: DepositLedger.newId(), base: editing ?? .null)
        let change: DepositLedger.ListChange = editing != nil ? .replace(id: editing!["id"].text, row) : .add(row)
        return await store.saveAccount(accountId, .recurring(change), label: "\(editing == nil ? "Add" : "Change") recurring deposit \(draft.name)")
    }
}

// MARK: Instalment / interest row

struct EntrySheet: View {
    @ObservedObject var store: FinanceStore
    let accountId: String
    let listKey: String          // "deposits" or "recurringDeposits"
    let depositId: String
    let subKey: String           // "installments" or "interestTransactions"
    let editing: JSONValue?

    @State private var draft = DepositLedger.EntryDraft()
    @State private var loaded = false

    private var isInterest: Bool { subKey == "interestTransactions" }

    var body: some View {
        FormSheet(title: (editing == nil ? "Add " : "Edit ") + (isInterest ? "interest" : "instalment"),
                  problems: DepositLedger.entryProblems(draft), touched: editing != nil || draft != DepositLedger.EntryDraft(), save: save) {
            Section {
                DayRow(label: "Date", day: $draft.date)
                NumberRow(label: "Amount ₹", text: $draft.amount)
                TextRow(label: "Remarks", text: $draft.remarks)
            } footer: { if isInterest { Text("Financial year \(DepositLedger.financialYear(draft.date)).") } }
        }
        .onAppear { guard !loaded else { return }; loaded = true; if let editing { draft = DepositLedger.entryDraft(from: editing) } }
    }

    private func save() async -> String? {
        let row = DepositLedger.entryRow(draft, id: DepositLedger.newId(), base: editing ?? .null, interest: isInterest)
        let change: DepositLedger.ListChange = editing != nil ? .replace(id: editing!["id"].text, row) : .add(row)
        return await store.saveAccount(accountId, .nested(listKey: listKey, depositId: depositId, subKey: subKey, change), label: "\(editing == nil ? "Add" : "Change") \(isInterest ? "interest" : "instalment")")
    }
}
