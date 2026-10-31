import SwiftUI

/// Every transaction ever recorded, newest first, with search and filters. Editing, bulk changes
/// and flagging a payment as a regret are done on the Mac; flags already set are shown.
struct AllTransactionsView: View {
    @ObservedObject var store: FinanceStore
    @State private var search = ""
    @State private var type = AllTransactions.TypeFilter.all
    @State private var year = "all"
    @State private var month = "all"
    @State private var category = "all"
    @State private var onlyWasteful = false
    @State private var limit = 40

    private func inr(_ v: Double) -> String { Money.rupees(v) }

    var body: some View {
        let d = store.data
        let all = AllTransactions.list(d.expensesRaw)
        let map = Budgets.categoryMap(appData: d.appDataRaw)
        let rows = AllTransactions.filter(all, search: search, type: type, year: year, month: month, category: category, onlyWasteful: onlyWasteful, map: map)
        let w = AllTransactions.waste(rows)
        KScreen(refresh: { await store.load() }) {
            TextField("Search title or category", text: $search).textInputAutocapitalization(.never).autocorrectionDisabled()
                .padding(10).background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 10, style: .continuous)).foregroundStyle(.white)
                .onChange(of: search) { _, _ in limit = 40 }
            Picker("Type", selection: $type) { ForEach(AllTransactions.TypeFilter.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.segmented)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack {
                    Menu { Button("All years") { year = "all" }; ForEach(AllTransactions.years(all), id: \.self) { y in Button(y) { year = y } } } label: { chip(year == "all" ? "All years" : year) }
                    Menu { Button("All months") { month = "all" }; ForEach(SalaryPage.months, id: \.self) { m in Button(m) { month = m } } } label: { chip(month == "all" ? "All months" : month) }
                    Menu { Button("All categories") { category = "all" }; ForEach(map.map(\.main), id: \.self) { c in Button(c) { category = c } } } label: { chip(category == "all" ? "All categories" : category) }
                    Button { onlyWasteful.toggle() } label: { chip(onlyWasteful ? "Regrets only ✓" : "Regrets only") }
                }
            }
            Text("\(rows.count.formatted()) of \(all.count.formatted()) transactions").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            if w.count > 0 { KNotice(message: "\(w.count) payment\(w.count == 1 ? "" : "s") here you flagged as a regret, \(inr(w.total)) in all.") }

            KList(items: Array(rows.prefix(limit))) { r in
                KRow(title: r.title.isEmpty ? "(no title)" : r.title,
                     subtitle: "\(r.date) · \(r.category.isEmpty ? "uncategorised" : r.category)\(r.isWasteful ? " · regret" : "")",
                     value: "\(r.isCredited ? "+" : "−")\(inr(abs(r.amount)))", valueTone: r.isCredited ? .positive : .neutral)
            }
            if rows.count > limit { Button("Show 40 more") { limit += 40 }.font(Theme.footnote.weight(.bold)) }
        }
        .navigationTitle("All Transactions")
        .navigationBarTitleDisplayMode(.large)
    }

    private func chip(_ text: String) -> some View {
        Text(text).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white).lineLimit(1).padding(.horizontal, 10).padding(.vertical, 6).background(Color.white.opacity(0.08), in: Capsule())
    }
}
