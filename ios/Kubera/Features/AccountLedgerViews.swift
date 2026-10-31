import SwiftUI

/// Editable lists of one account (see `AccountLedger`): each row can be changed or deleted, each list has a +.
struct AccountLedgerSections: View {
    @ObservedObject var store: FinanceStore
    let account: JSONValue
    let specs: [AccountLedger.ListSpec]

    @State private var sheet: SheetRoute?
    @State private var deleting: DeleteRoute?
    @State private var message: String?
    @State private var limit: [String: Int] = [:]

    private struct SheetRoute: Identifiable { let id = UUID(); let spec: AccountLedger.ListSpec; let parent: Int?; let index: Int?; let row: JSONValue? }
    private struct DeleteRoute { let spec: AccountLedger.ListSpec; let parent: Int?; let index: Int; let row: JSONValue }
    private struct Item: Identifiable { let id: String; let index: Int; let row: JSONValue }

    private var type: String { account["type"].text }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.sectionSpacing) {
            if let message { KNotice(message: message) { self.message = nil } }
            ForEach(specs.filter { $0.parent == nil }) { spec in section(spec, parent: nil, rows: account[spec.key].array) }
            // Nested lists (NPS transactions) sit under the record that holds them.
            ForEach(specs.filter { $0.parent != nil }) { spec in
                ForEach(Array(account[spec.parent!].array.enumerated()), id: \.offset) { pi, holder in
                    section(spec, parent: pi, rows: holder[spec.key].array, heading: holder["issueName"].text.isEmpty ? "Scheme \(pi + 1)" : holder["issueName"].text)
                }
            }
        }
        .sheet(item: $sheet) { r in
            LedgerRowSheet(store: store, accountId: account["id"].text, type: type, spec: r.spec, parentIndex: r.parent, index: r.index, editing: r.row)
        }
        .confirmationDialog("Delete this row?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let d = deleting {
                    Task { message = await store.saveAccount(account["id"].text, .ledger(specId: d.spec.id, parentIndex: d.parent, .delete(index: d.index, expected: d.row)), label: "Delete \(d.spec.title.lowercased()) row · \(account["title"].text)") }
                }
            }
        }
    }

    @ViewBuilder private func section(_ spec: AccountLedger.ListSpec, parent: Int?, rows: [JSONValue], heading: String? = nil) -> some View {
        let key = spec.id + (parent.map { "#\($0)" } ?? "")
        let items = order(rows, spec).map { Item(id: "\($0.offset)", index: $0.offset, row: $0.element) }
        let shown = Array(items.prefix(limit[key] ?? 30))
        HStack {
            KSectionHeader(title: heading.map { "\(spec.title) · \($0)" } ?? spec.title, detail: "\(rows.count)")
            Button { sheet = SheetRoute(spec: spec, parent: parent, index: nil, row: nil) } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) }
        }
        if rows.isEmpty {
            KCard { Text("None recorded yet.").font(Theme.footnote).foregroundStyle(Theme.muted) }
        } else {
            KList(items: shown) { it in
                let lock = AccountLedger.rowLock(it.row, type: type)
                Button { if lock == nil { sheet = SheetRoute(spec: spec, parent: parent, index: it.index, row: it.row) } } label: { rowView(it.row, spec, lock: lock) }
                    .buttonStyle(.plain)
                    .contextMenu { if lock == nil { Button(role: .destructive) { deleting = DeleteRoute(spec: spec, parent: parent, index: it.index, row: it.row) } label: { Label("Delete", systemImage: "trash") } } }
            }
            if items.count > shown.count { Button("Show 30 more") { limit[key] = (limit[key] ?? 30) + 30 }.font(Theme.footnote.weight(.bold)) }
            Text("Tap a row to change it; long-press to delete.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
        }
    }

    /// Newest first by the row's date, otherwise as stored.
    private func order(_ rows: [JSONValue], _ spec: AccountLedger.ListSpec) -> [(offset: Int, element: JSONValue)] {
        let dateKey = ["date", "dueDate", "issueDate"].first { k in rows.contains { $0[k].truthy } }
        let enumerated = Array(rows.enumerated())
        guard let dateKey else { return enumerated }
        return enumerated.sorted { a, b in
            let x = a.element[dateKey].text, y = b.element[dateKey].text
            return x != y ? x > y : a.offset > b.offset
        }
    }

    private func rowView(_ r: JSONValue, _ spec: AccountLedger.ListSpec, lock: String?) -> some View {
        let name = ["title", "issueName", "type", "status", "category"].map { r[$0].text }.first { !$0.isEmpty } ?? ""
        let date = ["date", "dueDate", "issueDate"].map { r[$0].text }.first { !$0.isEmpty } ?? ""
        let amountKey = spec.amountKeys.first { r[$0].truthy }
        let extra = ["remarks", "notes", "status", "maturityDate"].map { r[$0].text }.first { !$0.isEmpty && $0 != name } ?? ""
        let sub = [date.isEmpty ? "" : Fmt.date(date), spec.key == "details" ? "" : extra, lock ?? ""].filter { !$0.isEmpty }.joined(separator: " · ")
        let inflow = ["withdraw", "sell", "withdrawal"].contains(r["type"].text.lowercased())
        return KRow(title: name.isEmpty ? Fmt.date(date) : name.capitalized, subtitle: sub.isEmpty ? nil : sub,
                    value: amountKey.map { Money.rupees(r[$0].double) }, valueTone: inflow ? .negative : .neutral, valueCaption: spec.parent != nil && r["units"].truthy ? "\(Fmt.shares(r["units"].double)) units" : nil)
    }
}

/// One row of one list, as a form. The fields come from the list's spec; Save is disabled until the row is valid.
struct LedgerRowSheet: View {
    @ObservedObject var store: FinanceStore
    let accountId: String
    let type: String
    let spec: AccountLedger.ListSpec
    let parentIndex: Int?
    let index: Int?
    let editing: JSONValue?

    @State private var draft: AccountLedger.Draft = [:]
    @State private var loaded = false

    var body: some View {
        FormSheet(title: (editing == nil ? "Add " : "Edit ") + singular(spec.title),
                  problems: AccountLedger.problems(draft, spec: spec), touched: editing != nil || draft != AccountLedger.draft(for: spec), save: save) {
            Section {
                ForEach(spec.fields, id: \.key) { fs in
                    switch fs.kind {
                    case .date: DayRow(label: fs.label, day: binding(fs.key))
                    case .number: NumberRow(label: fs.label, text: binding(fs.key))
                    case .text: TextRow(label: fs.label, text: binding(fs.key))
                    case .choice(let options):
                        Picker(fs.label, selection: binding(fs.key)) {
                            ForEach(Array(Set(options + [draft[fs.key] ?? ""].filter { !$0.isEmpty })).sorted { (options.firstIndex(of: $0) ?? 99) < (options.firstIndex(of: $1) ?? 99) }, id: \.self) { Text($0.capitalized).tag($0) }
                        }
                    }
                }
            } footer: { footer }
        }
        .onAppear { guard !loaded else { return }; loaded = true; draft = AccountLedger.draft(for: spec, from: editing) }
    }

    @ViewBuilder private var footer: some View {
        switch (type, spec.key) {
        case ("mutual_fund", "transactions"): Text("Leave units blank and they are worked out from the amount and NAV.")
        case ("pf", "details"): Text("The row's total and the running EPF and EPS balances are worked out for you.")
        case ("ppf", "details"): Text("Balances are recalculated from every entry in date order.")
        default: EmptyView()
        }
    }

    private func singular(_ t: String) -> String {
        let l = t.lowercased()
        return l.hasSuffix("ies") ? String(l.dropLast(3)) + "y" : l.hasSuffix("s") ? String(l.dropLast()) : l
    }

    private func binding(_ key: String) -> Binding<String> { Binding(get: { draft[key] ?? "" }, set: { draft[key] = $0 }) }

    private func save() async -> String? {
        let row = AccountLedger.row(draft, spec: spec, type: type, base: editing ?? .null)
        let change: AccountLedger.Change = {
            if let index, let editing { return .replace(index: index, expected: editing, row) }
            return .add(row)
        }()
        return await store.saveAccount(accountId, .ledger(specId: spec.id, parentIndex: parentIndex, change), label: "\(editing == nil ? "Add" : "Change") \(spec.title.lowercased()) row")
    }
}

/// Add a new savings account (SavingsItemModal.jsx).
struct NewAccountSheet: View {
    @ObservedObject var store: FinanceStore
    @State private var type = "savings_account"
    @State private var title = ""
    @State private var amount = ""
    @State private var date = NewTransaction.isoDay(Date())
    @State private var bank = ""
    @State private var insurer = ""
    @State private var policyNo = ""
    @State private var pran = ""

    var body: some View {
        FormSheet(title: "Add account", problems: title.trimmingCharacters(in: .whitespaces).isEmpty ? ["Enter a name."] : (amount.isEmpty || Double(amount.replacingOccurrences(of: ",", with: "")) != nil ? [] : ["Amount is not a number."]),
                  touched: !title.isEmpty, save: save) {
            Section {
                Picker("Type", selection: $type) { ForEach(AccountLedger.newAccountTypes, id: \.id) { Text($0.label).tag($0.id) } }
                TextRow(label: "Name", text: $title)
                NumberRow(label: "Opening amount ₹", text: $amount)
                DayRow(label: "Date", day: $date)
                if type == "savings_account" { TextRow(label: "Bank", text: $bank) }
                if type == "policy" { TextRow(label: "Insurer", text: $insurer); TextRow(label: "Policy no", text: $policyNo) }
                if type == "nps" { TextRow(label: "PRAN", text: $pran) }
            } footer: { Text("Deposits, instalments, entries and transactions are added inside the account afterwards.") }
        }
    }

    private func save() async -> String? {
        let a = AccountLedger.newAccount(type: type, title: title.trimmingCharacters(in: .whitespaces), amount: Double(amount.replacingOccurrences(of: ",", with: "")) ?? 0, date: date, bank: bank, insurer: insurer, policyNo: policyNo, pran: pran)
        return await store.createAccount(a)
    }
}
