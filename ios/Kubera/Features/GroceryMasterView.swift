import SwiftUI

/// The grocery master lists: categories, their items, and the brands and variants recorded for
/// each. Read-only here — adding, renaming and merging are done on the Mac.
struct GroceryMasterView: View {
    @ObservedObject var store: FinanceStore
    private enum Tab: String, CaseIterable, Identifiable { case items = "Items", brands = "Brands", flavours = "Variants"; var id: String { rawValue } }
    @State private var category: String?
    @State private var tab = Tab.items
    @State private var query = ""
    @State private var open: Set<String> = []

    var body: some View {
        let d = store.data
        let cats = GroceryMaster.categories(appData: d.appDataRaw)
        let selected = category ?? cats.first?.category ?? ""
        let items = GroceryMaster.items(of: selected, base: cats, appData: d.appDataRaw, expenses: d.expensesRaw)
        let list: [String] = tab == .items ? items : tab == .brands ? GroceryMaster.brands(of: selected, appData: d.appDataRaw) : GroceryMaster.flavours(of: selected, appData: d.appDataRaw)
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        let shown = q.isEmpty ? list : list.filter { $0.lowercased().contains(q) }
        KScreen(refresh: { await store.load() }) {
            Menu { ForEach(cats, id: \.category) { c in Button(c.category) { category = c.category; open = [] } } } label: {
                Label("\(selected) · \(items.count) items", systemImage: "list.bullet").font(Theme.footnote.weight(.semibold))
            }
            Picker("Show", selection: $tab) { ForEach(Tab.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.segmented)
            TextField("Search", text: $query).textInputAutocapitalization(.never).autocorrectionDisabled()
                .padding(10).background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 10, style: .continuous)).foregroundStyle(.white)
            if shown.isEmpty { KCard { Text("Nothing here.").font(Theme.body).foregroundStyle(Theme.muted) } }
            KList(items: shown.map { Entry(name: $0) }) { e in
                VStack(alignment: .leading, spacing: 4) {
                    Button { if tab == .items { if open.contains(e.name) { open.remove(e.name) } else { open.insert(e.name) } } } label: {
                        HStack { Text(e.name).font(Theme.body).foregroundStyle(.white); Spacer(); if tab == .items { Image(systemName: open.contains(e.name) ? "chevron.up" : "chevron.down").font(.footnote).foregroundStyle(Theme.muted) } }
                    }.buttonStyle(.plain)
                    if tab == .items && open.contains(e.name) {
                        let b = GroceryMaster.brands(for: e.name, in: selected, appData: d.appDataRaw), f = GroceryMaster.flavours(for: e.name, in: selected, appData: d.appDataRaw)
                        Text(b.isEmpty ? "No brands linked." : "Brands: \(b.joined(separator: ", "))").font(Theme.footnote).foregroundStyle(Theme.muted)
                        if !f.isEmpty { Text("Variants: \(f.joined(separator: ", "))").font(Theme.footnote).foregroundStyle(Theme.muted) }
                    }
                }
            }
        }
        .navigationTitle("Grocery Builder")
        .navigationBarTitleDisplayMode(.large)
    }
    private struct Entry: Identifiable { let name: String; var id: String { name } }
}
