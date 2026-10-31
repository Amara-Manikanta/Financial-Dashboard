import SwiftUI
import Charts

/// Prices and purchase history of groceries, narrowed by category, product, brand and variant.
struct GroceriesView: View {
    @ObservedObject var store: FinanceStore
    @State private var category = "All"
    @State private var item = "All"
    @State private var brand = "All"
    @State private var flavour = "All"
    @State private var shown = 20

    private func inr(_ v: Double) -> String { Money.rupees(v) }
    private static func day(_ iso: String) -> Date { JSDate.parse(iso) ?? Date() }

    var body: some View {
        let all = Groceries.all(store.data.expensesRaw)
        let o = Groceries.options(all, category: category, item: item, brand: brand)
        let rows = Groceries.filter(all, category: category, item: item, brand: brand, flavour: flavour)
        let st = Groceries.stats(rows)
        KScreen(refresh: { await store.load() }) {
            KCard(tint: Theme.accent) {
                KStat(label: "Spent on these", value: inr(st.totalSpent), size: .hero)
                HStack(alignment: .top) {
                    KStat(label: "Purchases", value: "\(st.totalItems)")
                    Spacer(); KStat(label: "Average price", value: inr(st.avgPrice))
                }.padding(.top, 8)
            }
            VStack(spacing: 8) {
                picker("Category", all: "All categories", value: $category, options: o.categories) { item = "All"; brand = "All"; flavour = "All" }
                picker("Product", all: "All products", value: $item, options: o.items) { brand = "All"; flavour = "All" }
                if !o.brands.isEmpty { picker("Brand", all: "All brands", value: $brand, options: o.brands) { flavour = "All" } }
                if !o.flavours.isEmpty { picker("Variant", all: "All variants", value: $flavour, options: o.flavours) {} }
            }
            if rows.count > 1 {
                KCard {
                    Chart(rows.reversed()) { r in LineMark(x: .value("Date", Self.day(r.date)), y: .value("Price", r.price)).foregroundStyle(Theme.accent)
                        PointMark(x: .value("Date", Self.day(r.date)), y: .value("Price", r.price)).foregroundStyle(Theme.accent).symbolSize(14) }
                        .chartYAxis { AxisMarks { v in AxisGridLine().foregroundStyle(Color.white.opacity(0.06)); AxisValueLabel { if let n = v.as(Double.self) { Text(Money.compact(n)).foregroundStyle(Theme.muted) } } } }
                        .chartXAxis { AxisMarks(values: .automatic(desiredCount: 4)) { _ in AxisValueLabel(format: .dateTime.month(.abbreviated).year(.twoDigits)).foregroundStyle(Theme.muted) } }
                        .frame(height: 160)
                }
            }
            KSectionHeader(title: "Purchases")
            if rows.isEmpty { KCard { Text("Nothing matches those filters.").font(Theme.body).foregroundStyle(Theme.muted) } }
            KList(items: Array(rows.prefix(shown))) { r in
                KRow(title: r.name, subtitle: "\(r.date) · \(r.subcategory)\(r.brand.isEmpty ? "" : " · \(r.brand)")\(r.flavour.isEmpty ? "" : " · \(r.flavour)") · \(r.quantity)", value: inr(r.price))
            }
            if rows.count > shown { Button("Show 20 more") { shown += 20 }.font(Theme.footnote.weight(.bold)) }
        }
        .navigationTitle("Grocery Analytics")
        .navigationBarTitleDisplayMode(.large)
    }

    private func picker(_ title: String, all: String, value: Binding<String>, options: [String], onChange: @escaping () -> Void) -> some View {
        HStack {
            Text(title).font(Theme.footnote).foregroundStyle(Theme.muted)
            Spacer()
            Menu {
                Button(all) { value.wrappedValue = "All"; onChange(); shown = 20 }
                ForEach(options, id: \.self) { o in Button(o) { value.wrappedValue = o; onChange(); shown = 20 } }
            } label: { Text(value.wrappedValue == "All" ? all : value.wrappedValue).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white).lineLimit(1).padding(.horizontal, 10).padding(.vertical, 6).background(Color.white.opacity(0.08), in: Capsule()) }
        }
    }
}
