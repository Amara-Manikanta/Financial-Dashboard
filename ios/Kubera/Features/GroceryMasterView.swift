import SwiftUI

/// The grocery master lists: categories, their items, and the brands and variants recorded for
/// each. Items, brands and variants — and whole categories — can be added and deleted here; renaming, moving and linking brands to items are done on the Mac.
struct GroceryMasterView: View {
    @ObservedObject var store: FinanceStore
    private enum Tab: String, CaseIterable, Identifiable { case items = "Items", brands = "Brands", flavours = "Variants"; var id: String { rawValue } }
    @State private var category: String?
    @State private var tab = Tab.items
    @State private var query = ""
    @State private var open: Set<String> = []
    @State private var adding = false
    @State private var newCategory = false
    @State private var deleteCategory = false
    @State private var message: String?

    var body: some View {
        let d = store.data
        let cats = GroceryMaster.categories(appData: d.appDataRaw)
        let selected = category ?? cats.first?.category ?? ""
        let items = GroceryMaster.items(of: selected, base: cats, appData: d.appDataRaw, expenses: d.expensesRaw)
        let list: [String] = tab == .items ? items : tab == .brands ? GroceryMaster.brands(of: selected, appData: d.appDataRaw) : GroceryMaster.flavours(of: selected, appData: d.appDataRaw)
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        let shown = q.isEmpty ? list : list.filter { $0.lowercased().contains(q) }
        KScreen(refresh: { await store.load() }) {
            if let message { KNotice(message: message) { self.message = nil } }
            Menu {
                ForEach(cats, id: \.category) { c in Button(c.category) { category = c.category; open = [] } }
                Divider()
                Button { newCategory = true } label: { Label("New category…", systemImage: "plus") }
                Button(role: .destructive) { deleteCategory = true } label: { Label("Delete \(selected)…", systemImage: "trash") }
            } label: {
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
                .contextMenu {
                    Button(role: .destructive) { Task { message = await remove(e.name, from: selected) } } label: { Label("Delete", systemImage: "trash") }
                }
            }
            Text("Tap + to add. Long-press a name to delete it. Renaming and linking brands to items are on the Mac.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
        }
        .navigationTitle("Grocery Builder")
        .toolbar { ToolbarItem(placement: .primaryAction) { Button { adding = true } label: { Image(systemName: "plus") } } }
        .alert("Add \(noun)", isPresented: $adding) {
            TextField(noun.capitalized, text: $newName)
            Button("Add") { let n = newName; newName = ""; Task { message = await add(n, to: category ?? cats.first?.category ?? "") } }
            Button("Cancel", role: .cancel) { newName = "" }
        } message: { Text("to \(selected)") }
        .alert("New category", isPresented: $newCategory) {
            TextField("Category", text: $newName)
            Button("Add") { let n = newName; newName = ""; Task { message = await store.saveGrocery(key: "groceryCategories") { GroceryEditing.addingCategory(n, to: $0) }; if message == nil { category = n.trimmingCharacters(in: .whitespaces) } } }
            Button("Cancel", role: .cancel) { newName = "" }
        }
        .confirmationDialog("Delete the whole category \"\(selected)\"?", isPresented: $deleteCategory, titleVisibility: .visible) {
            Button("Delete category", role: .destructive) { Task { message = await store.saveGrocery(key: "groceryCategories") { .saved(GroceryEditing.deletingCategory(selected, from: $0)) }; if message == nil { category = nil } } }
        } message: { Text("Its items are removed from the list. Past purchases are kept.") }
        .navigationBarTitleDisplayMode(.large)
    }
    private struct Entry: Identifiable { let name: String; var id: String { name } }
    @State private var newName = ""

    private var noun: String { tab == .items ? "item" : tab == .brands ? "brand" : "variant" }
    private var key: String { tab == .items ? "groceryCategories" : tab == .brands ? "groceryBrands" : "groceryFlavours" }

    private func add(_ name: String, to cat: String) async -> String? {
        await store.saveGrocery(key: key) { GroceryEditing.adding(name, to: cat, in: $0, noun: noun) }
    }

    private func remove(_ name: String, from cat: String) async -> String? {
        await store.saveGrocery(key: key) { .saved(GroceryEditing.removing(name, from: cat, in: $0)) }
    }
}
