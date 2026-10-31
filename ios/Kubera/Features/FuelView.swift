import SwiftUI
import Charts

/// Fuel spend, litres, distance and mileage by vehicle and period. Mileage needs an odometer
/// reading and litres on consecutive fill-ups of the same vehicle; anything implausible is left out.
struct FuelView: View {
    @ObservedObject var store: FinanceStore
    @State private var vehicle = "All"
    @State private var year = "All"
    @State private var month = "All"
    @State private var shown = 15

    private func inr(_ v: Double) -> String { Money.rupees(v) }
    private static func day(_ iso: String) -> Date { JSDate.parse(iso) ?? Date() }

    var body: some View {
        let base = Fuel.page(expenses: store.data.expensesRaw, vehicle: vehicle, year: year, month: month)
        let years = Fuel.page(expenses: store.data.expensesRaw).years
        let mileage = base.rows.filter { $0.mileageCalculated && ($0.mileage ?? 0) > 0 && ($0.mileage ?? 0) < 150 }
        KScreen(refresh: { await store.load() }) {
            Picker("Vehicle", selection: $vehicle) { ForEach(["All", "scooty", "bike", "car", "other"], id: \.self) { Text($0 == "All" ? "All" : $0.capitalized).tag($0) } }.pickerStyle(.segmented)
            HStack {
                Menu { Button("All years") { year = "All"; month = "All" }; ForEach(years, id: \.self) { y in Button(String(y)) { year = String(y); month = "All" } } } label: { chip(year == "All" ? "All years" : year) }
                if year != "All" { Menu { Button("All months") { month = "All" }; ForEach(base.months, id: \.self) { m in Button(m) { month = m } } } label: { chip(month == "All" ? "All months" : month) } }
                Spacer()
            }
            if base.rows.isEmpty { KCard { Text("No fuel data for \(vehicle). Add expenses under the Fuel category.").font(Theme.body).foregroundStyle(Theme.muted) } }
            else {
                KCard(tint: Theme.warning) {
                    KStat(label: "Fuel spend", value: inr(base.totalSpent), size: .hero)
                    HStack(alignment: .top) {
                        KStat(label: "Avg mileage", value: base.avgMileage > 0 ? String(format: "%.1f kmpl", base.avgMileage) : "—", tone: .warning)
                        Spacer(); KStat(label: "Avg price / L", value: base.avgPrice > 0 ? inr(base.avgPrice) : "—")
                    }.padding(.top, 8)
                    HStack(alignment: .top) {
                        KStat(label: "Distance", value: "\(Int(base.totalDistance).formatted()) km")
                        Spacer(); KStat(label: "Fuel", value: String(format: "%.1f L", base.totalLiters))
                    }.padding(.top, 8)
                }
                if mileage.count > 1 {
                    KSectionHeader(title: "Mileage")
                    KCard {
                        Chart(mileage) { r in LineMark(x: .value("Date", Self.day(r.date)), y: .value("kmpl", r.mileage ?? 0)).foregroundStyle(Theme.warning).interpolationMethod(.monotone)
                            PointMark(x: .value("Date", Self.day(r.date)), y: .value("kmpl", r.mileage ?? 0)).foregroundStyle(Theme.warning).symbolSize(18) }
                            .chartYAxis { AxisMarks { v in AxisGridLine().foregroundStyle(Color.white.opacity(0.06)); AxisValueLabel().foregroundStyle(Theme.muted) } }
                            .chartXAxis { AxisMarks(values: .automatic(desiredCount: 4)) { _ in AxisValueLabel(format: .dateTime.month(.abbreviated).year(.twoDigits)).foregroundStyle(Theme.muted) } }
                            .frame(height: 170)
                    }
                    Text("Fill-ups with no litres or odometer reading, or a gap over 1,000 km, are left out of mileage.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
                }
                KSectionHeader(title: "Fill-ups")
                KList(items: Array(base.rows.reversed().prefix(shown))) { r in
                    KRow(title: r.title.isEmpty ? "Fuel" : r.title,
                         subtitle: "\(r.date)\(r.liters.map { String(format: " · %.1f L", $0) } ?? "")\(r.pricePerLiter.map { " · \(inr($0))/L" } ?? "")\(r.mileage.map { String(format: " · %.1f kmpl", $0) } ?? "")\(r.distance.map { " · \(Int($0)) km" } ?? "")",
                         value: inr(r.amount))
                }
                if base.rows.count > shown { Button("Show 15 more") { shown += 15 }.font(Theme.footnote.weight(.bold)) }
            }
        }
        .navigationTitle("Fuel Analytics")
        .navigationBarTitleDisplayMode(.large)
    }

    private func chip(_ text: String) -> some View {
        Text(text).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white).padding(.horizontal, 10).padding(.vertical, 6).background(Color.white.opacity(0.08), in: Capsule())
    }
}
