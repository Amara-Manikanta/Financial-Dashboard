import SwiftUI

/// One metal item as a form — the fields of the Mac's `MetalModal` for that category. Saved to the Mac as the whole category's
/// list under the version it was read at.
struct MetalItemSheet: View {
    @ObservedObject var store: FinanceStore
    let category: String
    let editing: JSONValue?
    @State private var f = MetalEditing.Form()
    @State private var loaded = false

    private var title: String { category.replacingOccurrences(of: "_", with: " ") }
    private var coinOrCash: Bool { category == "antique_coins" || category == "currencies" }

    var body: some View {
        FormSheet(title: (editing == nil ? "Add " : "Edit ") + (category == "antique_coins" ? "coin" : category == "currencies" ? "currency" : "\(category) item"),
                  problems: MetalEditing.problems(f, category: category), touched: editing != nil || f != MetalEditing.form(for: nil, category: category, today: today), save: save) {
            Section {
                TextRow(label: "Name", text: $f.name)
                if !coinOrCash { NumberRow(label: "Weight (g)", text: $f.weight) }
                if category == "gold" {
                    Picker("Purity", selection: $f.purity) { ForEach(["24", "22", "20", "18", "14"], id: \.self) { Text("\($0)K").tag($0) } }
                }
                if category == "antique_coins" { TextRow(label: "Printed year", text: $f.printedYear); TextRow(label: "Quantity", text: $f.quantity) }
                if category == "currencies" {
                    TextRow(label: "Currency code", text: $f.currency)
                    NumberRow(label: "Foreign amount", text: $f.foreign)
                    NumberRow(label: "Rate to ₹", text: $f.rate)
                }
                NumberRow(label: "Purchase price ₹", text: $f.price)
                DayRow(label: "Purchase date", day: $f.date)
            }
            Section("Where") { TextRow(label: "Bought at", text: $f.place); TextRow(label: "Kept at", text: $f.location) }
            Section("Notes") { TextRow(label: "Remarks", text: $f.remarks) }
        } 
        .onAppear { guard !loaded else { return }; loaded = true; f = MetalEditing.form(for: editing, category: category, today: today) }
    }

    private var today: String { NewTransaction.isoDay(Date()) }

    private func save() async -> String? {
        await store.saveMetal(category: category, item: MetalEditing.item(f, category: category, base: editing))
    }
}

/// The manual gold and silver rate per gram. Blank or 0 goes back to the live rate.
struct ManualRatesSheet: View {
    @ObservedObject var store: FinanceStore
    @State private var gold = ""
    @State private var silver = ""
    @State private var loaded = false

    var body: some View {
        FormSheet(title: "Manual rates", problems: [], touched: true, save: {
            await store.saveManualRates(gold: Double(gold.replacingOccurrences(of: ",", with: "")) ?? 0, silver: Double(silver.replacingOccurrences(of: ",", with: "")) ?? 0)
        }) {
            Section {
                NumberRow(label: "Gold ₹ per gram", text: $gold)
                NumberRow(label: "Silver ₹ per gram", text: $silver)
            } footer: { Text("Used instead of the live rate for every gold and silver value. Leave blank to use the live rate again.") }
        }
        .onAppear {
            guard !loaded else { return }; loaded = true
            let m = store.data.appDataRaw["manualMetalRates"]
            gold = m["gold"].double > 0 ? RecordEditing.number(m["gold"].double) : ""
            silver = m["silver"].double > 0 ? RecordEditing.number(m["silver"].double) : ""
        }
    }
}
