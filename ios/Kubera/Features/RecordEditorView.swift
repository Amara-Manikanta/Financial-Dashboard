import SwiftUI

/// Edits one record on the Mac: its plain fields, and the rows of its nested lists. The record is
/// loaded fresh with its version when the sheet opens; every save sends only what changed and
/// that version, so a record changed on the Mac in the meantime is refused, never overwritten.
struct RecordEditorView: View {
    @ObservedObject var store: FinanceStore
    let collection: String
    let id: String
    let title: String

    @Environment(\.dismiss) private var dismiss
    @State private var record: JSONValue = .null
    @State private var version: String?
    @State private var edits: [String: RecordEditing.Edit] = [:]
    @State private var loading = true
    @State private var saving = false
    @State private var message: String?
    @State private var confirmDelete = false

    private var fields: [RecordEditing.Field] { RecordEditing.fields(of: record, collection: collection) }
    private var patch: [String: Any] { RecordEditing.patch(fields: fields, edits: edits, record: record) }
    private var problems: [String: String] { RecordEditing.problems(fields: fields, edits: edits) }

    var body: some View {
        NavigationStack {
            Form {
                if let message { Section { Text(message).foregroundStyle(Tone.negative.color) } }
                if loading {
                    Section { ProgressView().frame(maxWidth: .infinity) }
                } else if !record.isNull {
                    Section {
                        FieldRows(fields: fields, edits: $edits, problems: problems)
                    } footer: {
                        Text("Only the fields you change are sent. Figures the Mac works out, links between records and photos stay as they are.")
                    }
                    if FinanceStore.deletable.contains(collection) {
                        Section {
                            Button(role: .destructive) { confirmDelete = true } label: { Label("Delete this record", systemImage: "trash") }
                        } footer: { Text("Removes it from your Mac. It can only be brought back from a backup there.") }
                    }
                    let lists = RecordEditing.nestedLists(of: record, collection: collection)
                    if !lists.isEmpty {
                        Section {
                            ForEach(lists, id: \.key) { list in
                                if let lock = list.lock {
                                    VStack(alignment: .leading, spacing: 2) {
                                        LabeledContent(RecordEditing.label(list.key), value: "\(list.count)")
                                        Text(lock).font(.footnote).foregroundStyle(.secondary)
                                    }
                                } else {
                                    NavigationLink {
                                        NestedRowsView(store: store, collection: collection, id: id, key: list.key,
                                                       record: $record, version: $version)
                                    } label: {
                                        LabeledContent(RecordEditing.label(list.key), value: "\(list.count)")
                                    }
                                    .disabled(!patch.isEmpty)
                                }
                            }
                        } header: { Text("Lists") } footer: {
                            if !patch.isEmpty { Text("Save or discard your field changes before editing a list.") }
                        }
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else {
                        Button("Save") { Task { await save() } }.disabled(patch.isEmpty || !problems.isEmpty)
                    }
                }
            }
            .task { await load() }
            .interactiveDismissDisabled(!patch.isEmpty)
            .confirmationDialog("Delete \(title)?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) { Task {
                    saving = true
                    if let failure = await store.deleteRecord(collection, id: id) { message = failure; saving = false } else { saving = false; dismiss() }
                } }
            } message: { Text("This removes it from your Mac.") }
        }
    }

    private func load() async {
        loading = true
        do {
            let r = try await store.record(collection, id: id)
            record = r.value; version = r.version; edits = [:]
        } catch { message = error.localizedDescription }
        loading = false
    }

    private func save() async {
        saving = true; message = nil
        let failure = await store.saveRecord(collection, id: id, fields: patch, original: record, stampUpdated: !record["updatedAt"].isNull, label: "Edit \(title)")
        saving = false
        if let failure {
            message = failure
            // A stale copy is reloaded so the next attempt is based on what the Mac holds now.
            if failure.contains("changed on your Mac") { await load(); message = failure }
        } else {
            dismiss()
        }
    }
}

/// A form row per field: text, number, switch or date.
struct FieldRows: View {
    let fields: [RecordEditing.Field]
    @Binding var edits: [String: RecordEditing.Edit]
    let problems: [String: String]

    var body: some View {
        ForEach(fields) { f in
            VStack(alignment: .leading, spacing: 2) {
                row(f)
                if let p = problems[f.key] { Text(p).font(.footnote).foregroundStyle(Tone.negative.color) }
            }
        }
    }

    @ViewBuilder private func row(_ f: RecordEditing.Field) -> some View {
        switch f.kind {
        case .toggle:
            Toggle(f.label, isOn: Binding(
                get: { if case .toggle(let b)? = edits[f.key] { return b }; return f.on },
                set: { edits[f.key] = .toggle($0) }))
        case .date:
            DatePicker(f.label, selection: Binding(
                get: { Self.date(text(f)) ?? Date() },
                set: { d in edits[f.key] = .text(Self.write(d, like: f.value)) }), displayedComponents: .date)
        case .number, .numericText:
            LabeledContent(f.label) {
                TextField(f.label, text: binding(f)).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
            }
        case .text:
            LabeledContent(f.label) {
                TextField(f.label, text: binding(f), axis: .vertical).multilineTextAlignment(.trailing)
            }
        }
    }

    private func text(_ f: RecordEditing.Field) -> String {
        if case .text(let s)? = edits[f.key] { return s }
        return f.value
    }

    private func binding(_ f: RecordEditing.Field) -> Binding<String> {
        Binding(get: { text(f) }, set: { edits[f.key] = .text($0) })
    }

    private static let day: DateFormatter = {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"; return f
    }()

    static func date(_ s: String) -> Date? { day.date(from: String(s.prefix(10))) }

    /// Keeps the stored form: a bare day stays a bare day, a timestamp keeps its time of day.
    static func write(_ d: Date, like original: String) -> String {
        let dayText = day.string(from: d)
        return original.count > 10 ? dayText + original.dropFirst(10) : dayText
    }
}

/// The rows of one nested list (a lent's transactions, a loan's payments, a card's months…).
/// Each change re-sends that list with the record's version, so a stale phone cannot clobber it.
private struct NestedRowsView: View {
    @ObservedObject var store: FinanceStore
    let collection: String
    let id: String
    let key: String
    @Binding var record: JSONValue
    @Binding var version: String?

    @State private var editing: Int?
    @State private var deleting: Int?
    @State private var message: String?

    private var rows: [JSONValue] { record[key].array }

    private struct Row: Identifiable { let id: Int; let value: JSONValue }

    var body: some View {
        List {
            if let message { Section { Text(message).foregroundStyle(Tone.negative.color) } }
            Section {
                ForEach(rows.enumerated().map { Row(id: $0.offset, value: $0.element) }) { row in
                    let lock = RecordEditing.rowLock(row.value)
                    Button { if lock == nil { editing = row.id } } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(summary(row.value)).foregroundStyle(.primary)
                            if let lock { Text(lock).font(.footnote).foregroundStyle(.secondary) }
                        }
                    }
                    .swipeActions {
                        if lock == nil { Button("Delete", role: .destructive) { deleting = row.id } }
                    }
                }
            } footer: { Text("Tap a row to change it; swipe to delete.") }
        }
        .navigationTitle(RecordEditing.label(key))
        .sheet(item: Binding(get: { editing.map { Row(id: $0, value: rows.indices.contains($0) ? rows[$0] : .null) } }, set: { editing = $0?.id })) { row in
            RowEditor(row: row.value, collection: collection, parent: record) { patch in
                await write(RecordEditing.replacingRow(rows, at: row.id, with: patch))
            }
        }
        .confirmationDialog("Delete this row?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let i = deleting { Task { _ = await write(RecordEditing.replacingRow(rows, at: i, with: nil)) } }
            }
        } message: {
            if let i = deleting, rows.indices.contains(i) { Text(summary(rows[i])) }
        }
    }

    private func summary(_ row: JSONValue) -> String {
        let date = ["date", "paymentDate", "month"].map { row[$0].text }.first { !$0.isEmpty } ?? ""
        let what = ["description", "name", "title", "note", "notes", "type"].map { row[$0].text }.first { !$0.isEmpty } ?? ""
        let amount = ["amount", "emi", "value", "paidAmount"].map { row[$0] }.first { !$0.isNull }
        return [date, what, amount.map { Money.rupees($0.double) } ?? ""].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    /// Nil when saved; the record and its version are refreshed either way.
    private func write(_ list: [Any]) async -> String? {
        message = nil
        let failure = await store.saveRecord(collection, id: id, fields: [key: list], original: record, stampUpdated: !record["updatedAt"].isNull, label: "Edit \(RecordEditing.label(key)) list")
        if let r = try? await store.record(collection, id: id) { record = r.value; version = r.version }
        if let failure { message = failure }
        return failure
    }
}

private struct RowEditor: View {
    let row: JSONValue
    let collection: String
    let parent: JSONValue
    let save: ([String: Any]) async -> String?

    @Environment(\.dismiss) private var dismiss
    @State private var edits: [String: RecordEditing.Edit] = [:]
    @State private var saving = false
    @State private var message: String?

    private var fields: [RecordEditing.Field] { RecordEditing.fields(of: row, collection: collection, parent: parent) }
    private var patch: [String: Any] { RecordEditing.patch(fields: fields, edits: edits, record: row) }
    private var problems: [String: String] { RecordEditing.problems(fields: fields, edits: edits) }

    var body: some View {
        NavigationStack {
            Form {
                if let message { Section { Text(message).foregroundStyle(Tone.negative.color) } }
                Section { FieldRows(fields: fields, edits: $edits, problems: problems) }
            }
            .navigationTitle("Edit row")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else {
                        Button("Save") {
                            Task {
                                saving = true
                                message = await save(patch)
                                saving = false
                                if message == nil { dismiss() }
                            }
                        }
                        .disabled(patch.isEmpty || !problems.isEmpty)
                    }
                }
            }
        }
    }
}

/// Long-press any record's row for Edit, which opens it in `RecordEditorView`.
struct EditableRecord: ViewModifier {
    @ObservedObject var store: FinanceStore
    let collection: String
    let id: String
    let title: String
    @State private var open = false

    func body(content: Content) -> some View {
        content
            .contextMenu { Button { open = true } label: { Label("Edit", systemImage: "pencil") } }
            .sheet(isPresented: $open) { RecordEditorView(store: store, collection: collection, id: id, title: title) }
    }
}

extension View {
    /// Adds Edit to a row's long-press menu. Does nothing for a record without an id.
    @ViewBuilder func editable(_ store: FinanceStore, _ collection: String, id: String, title: String) -> some View {
        if id.isEmpty || !RecordEditing.collections.contains(collection) { self }
        else { modifier(EditableRecord(store: store, collection: collection, id: id, title: title)) }
    }
}

/// A pencil in the navigation bar that opens the page's record for editing.
struct EditRecordButton: View {
    @ObservedObject var store: FinanceStore
    let collection: String
    let id: String
    let title: String
    @State private var open = false

    var body: some View {
        Button { open = true } label: { Image(systemName: "pencil") }
            .disabled(id.isEmpty)
            .sheet(isPresented: $open) { RecordEditorView(store: store, collection: collection, id: id, title: title) }
    }
}


/// A new record of a collection, as a form of the same plain fields an existing one has. Saved to the Mac as one record.
struct NewRecordSheet: View {
    @ObservedObject var store: FinanceStore
    let collection: String
    let records: [JSONValue]
    @Environment(\.dismiss) private var dismiss
    @State private var base: JSONValue = .null
    @State private var edits: [String: RecordEditing.Edit] = [:]
    @State private var saving = false
    @State private var message: String?

    private var noun: String { RecordEditing.creatable[collection] ?? "record" }
    // Nested: a new record's `type` is chosen here, unlike an existing record's.
    private var fields: [RecordEditing.Field] { RecordEditing.fields(of: base, collection: collection, parent: base) }
    private var problems: [String: String] { RecordEditing.problems(fields: fields, edits: edits) }

    var body: some View {
        NavigationStack {
            Form {
                if let message { Section { Text(message).foregroundStyle(Tone.negative.color) } }
                Section { FieldRows(fields: fields, edits: $edits, problems: problems) } footer: {
                    Text("The same fields as your other \(noun)s. Anything the Mac works out (prices, totals, links) is filled in there.")
                }
            }
            .navigationTitle("New \(noun)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else {
                        Button("Add") { Task { await save() } }.disabled(edits.isEmpty || !problems.isEmpty)
                    }
                }
            }
            .onAppear { if base.isNull { base = RecordEditing.template(collection: collection, records: records) } }
        }
    }

    private func save() async {
        saving = true; message = nil
        var record = (RecordEditing.foundation(base) as? [String: Any]) ?? [:]
        for (k, v) in RecordEditing.patch(fields: fields, edits: edits, record: base) { record[k] = v }
        let failure = await store.createRecord(collection, record, label: noun)
        saving = false
        if let failure { message = failure } else { dismiss() }
    }
}

/// A + that opens `NewRecordSheet` for a collection.
struct NewRecordButton: View {
    @ObservedObject var store: FinanceStore
    let collection: String
    let records: [JSONValue]
    var icon = "plus"
    @State private var open = false
    var body: some View {
        Button { open = true } label: { Image(systemName: icon) }
            .sheet(isPresented: $open) { NewRecordSheet(store: store, collection: collection, records: records) }
    }
}
