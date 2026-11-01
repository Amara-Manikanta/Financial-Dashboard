import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

/// A date that may be left blank: a switch, and the picker when it is on.
struct OptionalDayRow: View {
    let label: String
    @Binding var day: String
    var body: some View {
        Toggle(label, isOn: Binding(get: { !day.isEmpty }, set: { day = $0 ? NewTransaction.isoDay(Date()) : "" }))
        if !day.isEmpty { DayRow(label: "  \(label)", day: $day) }
    }
}

/// The tenancy fields, shared by the item form and the unit form.
struct RentalFields: View {
    @Binding var rental: AssetEditing.RentalDraft
    var showUnitName = true

    var body: some View {
        Section("Tenancy") {
            if showUnitName { TextRow(label: "Unit name", text: $rental.unitName) }
            TextRow(label: "Tenant", text: $rental.tenantName)
            TextRow(label: "Contact", text: $rental.tenantContact)
            NumberRow(label: "Monthly rent ₹", text: $rental.monthlyRent)
            NumberRow(label: "Rent due day", text: $rental.rentDueDay)
            NumberRow(label: "Advance ₹", text: $rental.advanceAmount)
            OptionalDayRow(label: "Lease start", day: $rental.leaseStart)
            OptionalDayRow(label: "Lease end", day: $rental.leaseEnd)
        }
        Section {
            Picker("Rent rises by", selection: $rental.escalationType) { Text("A percentage").tag("percent"); Text("A fixed amount").tag("fixed") }
            NumberRow(label: rental.escalationType == "fixed" ? "Increase ₹" : "Increase %", text: $rental.escalationValue)
            NumberRow(label: "Every (months)", text: $rental.escalationEveryMonths)
        } header: { Text("Escalation") } footer: { Text("Counted from the lease start; leave the increase blank for a flat rent.") }
        Section("Terms") {
            ForEach(rental.terms.indices, id: \.self) { i in
                TextField("Term", text: Binding(get: { rental.terms.indices.contains(i) ? rental.terms[i] : "" }, set: { if rental.terms.indices.contains(i) { rental.terms[i] = $0 } }), axis: .vertical)
            }
            .onDelete { rental.terms.remove(atOffsets: $0) }
            Button { rental.terms.append("") } label: { Label("Add a term", systemImage: "plus.circle") }
            TextRow(label: "Rules", text: $rental.rules)
        }
    }
}

/// Add or change an item of an asset category — the Mac's `AssetItemModal`.
struct AssetItemSheet: View {
    @ObservedObject var store: FinanceStore
    let categoryId: String
    let isRealEstate: Bool
    let editing: JSONValue?

    @State private var draft = AssetEditing.ItemDraft()
    @State private var loaded = false

    var body: some View {
        let hasUnits = editing.map(PropertyUnits.hasUnits) ?? false
        FormSheet(title: editing == nil ? "Add asset" : "Edit asset", problems: AssetEditing.itemProblems(draft, isRealEstate: isRealEstate, hasUnits: hasUnits),
                  touched: editing != nil || draft != AssetEditing.ItemDraft(), save: save) {
            Section {
                TextRow(label: "Name", text: $draft.name)
                OptionalDayRow(label: "Purchase date", day: $draft.purchaseDate)
                NumberRow(label: "Purchase price ₹", text: $draft.purchasePrice)
                NumberRow(label: "Current value ₹", text: $draft.currentValue)
                if isRealEstate { TextRow(label: "Place", text: $draft.place); TextRow(label: "Dimensions", text: $draft.dimensions) }
                TextRow(label: "Remarks", text: $draft.remarks)
            }
            if !isRealEstate {
                Section {
                    TextRow(label: "Serial number", text: $draft.serialNumber)
                    TextRow(label: "Bought from", text: $draft.seller)
                    NumberRow(label: "Warranty (months)", text: $draft.warrantyMonths)
                    OptionalDayRow(label: "Warranty ends on", day: $draft.warrantyExpiry)
                    NumberRow(label: "Extended (months)", text: $draft.extendedMonths)
                    OptionalDayRow(label: "Extended ends on", day: $draft.extendedExpiry)
                    NumberRow(label: "Extended cover cost ₹", text: $draft.extendedCost)
                } header: { Text("Warranty") } footer: { Text("Months are counted from the purchase date, so the expiry stays right if that date is corrected. An exact end date wins when both are given.") }
            }
            if isRealEstate && !hasUnits {
                Section { Toggle("Let out", isOn: $draft.isLet) } footer: { Text("A property split into units keeps each tenancy on its unit.") }
                if draft.isLet { RentalFields(rental: $draft.rental) }
            }
        }
        .onAppear { guard !loaded else { return }; loaded = true; if let editing { draft = AssetEditing.itemDraft(from: editing) } }
    }

    private func save() async -> String? {
        let row = AssetEditing.itemRow(draft, isRealEstate: isRealEstate, id: AssetEditing.newId(), base: editing ?? .null)
        guard let editing else { return await store.saveAsset(category: categoryId, .addItem(row), label: "Add asset \(draft.name)") }
        return await store.saveAsset(category: categoryId, AssetEditing.itemEdit(itemId: editing["id"].text, old: editing, new: row), label: "Edit asset \(draft.name)")
    }
}

/// Add or change a rent, bill, tax or cost entry — the Mac's `AssetTransactionModal`.
struct AssetEntrySheet: View {
    @ObservedObject var store: FinanceStore
    let categoryId: String
    let item: JSONValue
    let isRealEstate: Bool
    let editing: JSONValue?
    /// Where the entry lives now (blank is the building itself).
    let unit: String?

    @State private var draft = AssetEditing.EntryDraft()
    @State private var loaded = false

    var body: some View {
        let units = PropertyUnits.allUnits(item)
        let kinds = Rental.kindsFor(isRealEstate: isRealEstate, keep: editing.map(Rental.kindOf))
        let meta = Rental.kind(draft.kind)
        FormSheet(title: editing == nil ? "Add entry" : "Edit entry", problems: AssetEditing.entryProblems(draft),
                  touched: editing != nil || !draft.amount.isEmpty, save: save) {
            if !units.isEmpty {
                Section {
                    Picker("Belongs to", selection: $draft.unit) {
                        ForEach(Array(units.enumerated()), id: \.offset) { _, u in Text("\(u["name"].text)\(u["selfOccupied"].truthy ? " (self-occupied)" : "")").tag(u["id"].text) }
                        Text("The building itself").tag("")
                    }
                } footer: { Text(draft.unit.isEmpty ? "A cost for the whole property — tax on the structure, a shared repair." : "This unit's rent, deposit or meter.") }
            }
            Section {
                Picker("Kind", selection: $draft.kind) { ForEach(kinds, id: \.key) { Text($0.label).tag($0.key) } }
                DayRow(label: "Date", day: $draft.date)
                NumberRow(label: "Amount ₹", text: $draft.amount)
                if meta?.hasPeriod == true { TextRow(label: "For the month", text: $draft.period) }
                TextRow(label: "Note", text: $draft.description)
            } footer: {
                Text((meta?.income == true ? "Money received" : "Money paid out") + (meta?.countsAsYield == false ? " · held on the tenant's behalf, not counted as return" : "")
                     + (meta?.hasPeriod == true ? ". The month is the one it belongs to, not the day it was paid — try 2026-08 or August 2026." : ""))
            }
            if Rental.asksWhoPays(kind: draft.kind, isRealEstate: isRealEstate) {
                Section {
                    Picker("Who pays", selection: $draft.borne) { ForEach(Rental.Borne.allCases, id: \.rawValue) { Text($0.short).tag($0.rawValue) } }
                    if draft.borne == "recovered" { NumberRow(label: "Recovered so far ₹", text: $draft.recoveredAmount) }
                } footer: { Text(Rental.Borne(rawValue: draft.borne)?.blurb ?? "") }
            }
        }
        .onAppear {
            guard !loaded else { return }; loaded = true
            draft = editing.map { AssetEditing.entryDraft(from: $0, unit: unit) } ?? AssetEditing.entryDraft(newFor: isRealEstate, unit: unit)
        }
    }

    private func save() async -> String? {
        let row = AssetEditing.entryRow(draft, isRealEstate: isRealEstate, id: AssetEditing.newId(), base: editing ?? .null)
        let target = draft.unit.isEmpty ? nil : draft.unit
        let edit: AssetOp.EntryEdit = editing == nil ? .add(row) : .replace(row, from: unit)
        return await store.saveAsset(category: categoryId, .entry(itemId: item["id"].text, unit: target, edit), label: "\(editing == nil ? "Add" : "Change") entry · \(item["name"].text)")
    }
}

/// Log a service or repair against an item.
struct ServiceSheet: View {
    @ObservedObject var store: FinanceStore
    let categoryId: String
    let itemId: String
    let itemName: String
    let editing: JSONValue?

    @State private var draft = AssetEditing.ServiceDraft()
    @State private var loaded = false

    var body: some View {
        FormSheet(title: editing == nil ? "Log a service" : "Edit service", problems: AssetEditing.serviceProblems(draft), touched: editing != nil || !draft.description.isEmpty, save: save) {
            Section {
                DayRow(label: "Date", day: $draft.date)
                TextRow(label: "What was done", text: $draft.description)
                TextRow(label: "Done by", text: $draft.provider)
                NumberRow(label: "Cost ₹", text: $draft.cost)
                Toggle("Covered by warranty", isOn: $draft.underWarranty)
            } footer: { Text("Work under warranty is counted as cover used, not as money spent.") }
        }
        .onAppear { guard !loaded else { return }; loaded = true; if let editing { draft = AssetEditing.serviceDraft(from: editing) } }
    }

    private func save() async -> String? {
        let row = AssetEditing.serviceRow(draft, id: AssetEditing.newId(), base: editing ?? .null)
        let edit: AssetOp.ListEdit = editing == nil ? .add(row) : .replace(id: editing!["id"].text, row)
        return await store.saveAsset(category: categoryId, .sublist(itemId: itemId, key: "services", edit), label: "\(editing == nil ? "Log" : "Change") service · \(itemName)")
    }
}

/// Add or change one unit of a property — the Mac's `PropertyUnitModal`.
struct UnitSheet: View {
    @ObservedObject var store: FinanceStore
    let categoryId: String
    let itemId: String
    let editing: JSONValue?

    @State private var draft = AssetEditing.UnitDraft()
    @State private var loaded = false

    var body: some View {
        FormSheet(title: editing == nil ? "Add unit" : "Edit unit", problems: AssetEditing.unitProblems(draft), touched: editing != nil || !draft.name.isEmpty, save: save) {
            Section {
                TextRow(label: "Name", text: $draft.name)
                Picker("Type", selection: $draft.unitType) { ForEach(PropertyUnits.types, id: \.id) { Text("\($0.icon) \($0.label)").tag($0.id) } }
                Toggle("Self-occupied", isOn: $draft.selfOccupied)
            } footer: { Text("A part you live in counts as fully occupied, not as vacant.") }
            if !draft.selfOccupied { RentalFields(rental: $draft.rental, showUnitName: false) }
        }
        .onAppear { guard !loaded else { return }; loaded = true; if let editing { draft = AssetEditing.unitDraft(from: editing) } }
    }

    private func save() async -> String? {
        let row = AssetEditing.unitRow(draft, base: editing ?? .null)
        let edit: AssetOp.ListEdit = editing == nil ? .add(row) : .replace(id: editing!["id"].text, row)
        return await store.saveAsset(category: categoryId, .unit(itemId: itemId, edit), label: "\(editing == nil ? "Add" : "Change") unit \(draft.name)")
    }
}

/// A receipt or other file kept on the Mac, fetched to view.
struct DocumentViewer: View {
    @ObservedObject var store: FinanceStore
    let receipt: JSONValue
    @Environment(\.dismiss) private var dismiss
    @State private var data: Data?
    @State private var done = false

    var body: some View {
        NavigationStack {
            Group {
                if let data, let image = UIImage(data: data) {
                    ScrollView([.horizontal, .vertical]) { Image(uiImage: image).resizable().scaledToFit().frame(maxWidth: .infinity) }
                } else if let data, receipt["url"].text.lowercased().hasSuffix(".pdf") {
                    PDFPreview(data: data)
                } else if done {
                    Text("This file is kept on your Mac and could not be fetched. Connect to it and try again.").multilineTextAlignment(.center).padding()
                } else { ProgressView() }
            }
            .navigationTitle(receipt["name"].text.isEmpty ? "Receipt" : receipt["name"].text)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .task { data = await store.documentData(receipt["url"].text); done = true }
        }
    }
}

import PDFKit
struct PDFPreview: UIViewRepresentable {
    let data: Data
    func makeUIView(context: Context) -> PDFView { let v = PDFView(); v.autoScales = true; v.document = PDFDocument(data: data); return v }
    func updateUIView(_ v: PDFView, context: Context) {}
}
