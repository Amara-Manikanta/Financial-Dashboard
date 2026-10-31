import Foundation

/// Fuel spend, litres, distance and mileage — a port of the memos in `pages/FuelAnalytics.jsx`.
/// A reading only counts as the "previous" one when it was a real fill-up, distances over
/// 1,000 km are treated as a missed fill-up rather than reported, and a mileage of 150 or more
/// is dropped from the average.
enum Fuel {
    struct Fill: Identifiable, Equatable {
        var id: String { "\(txId)-\(date)-\(amount)" }
        let txId: String, year: Int, month: String, date: String, title: String
        let amount: Double
        let liters: Double?, km: Double?, distance: Double?, mileage: Double?, pricePerLiter: Double?
        let mileageCalculated: Bool
        let vehicle: String
    }

    struct Page: Equatable {
        var all: [Fill] = []
        var years: [Int] = []
        var months: [String] = []
        var filtered: [Fill] = []
        var rows: [Fill] = []      // the filtered fill-ups with their figures
        var totalSpent = 0.0, totalLiters = 0.0, totalDistance = 0.0, avgMileage = 0.0, avgPrice = 0.0
        var validMileage = 0
    }

    private static func isFuel(_ tx: JSONValue) -> Bool {
        let cat = tx["category"].text.lowercased(), sub = tx["subCategory"].text.lowercased(), title = tx["title"].text.lowercased()
        return cat.contains("fuel") || sub.contains("fuel") || title.contains("fuel") || title.contains("petrol") || title.contains("diesel")
            || title.contains("bharat petroleum") || title.contains("indian oil") || title.contains("hpcl")
    }
    private static func positive(_ values: JSONValue...) -> Double? {
        for v in values where v.truthy { let d = v.double; if d.isFinite && d != 0 { return d } }
        return nil
    }

    static func page(expenses: JSONValue, vehicle: String = "All", year: String = "All", month: String = "All") -> Page {
        var p = Page()
        var collected: [(date: Double, fill: JSONValue, year: Int, month: String)] = []
        for (y, months) in expenses.object.sorted(by: { (Int($0.key) ?? 0) < (Int($1.key) ?? 0) }) {
            for (m, data) in months.object.sorted(by: { (SalaryPage.months.firstIndex(of: $0.key) ?? 99) < (SalaryPage.months.firstIndex(of: $1.key) ?? 99) }) {
                for tx in data["transactions"].array where isFuel(tx) {
                    collected.append((JSDate.parse(tx["date"])?.timeIntervalSince1970 ?? .nan, tx, Int(y) ?? 0, m))
                }
            }
        }
        collected = collected.enumerated().sorted { a, b in
            let (x, y) = (a.element.date, b.element.date)
            if x.isNaN || y.isNaN { return a.offset < b.offset }
            return x != y ? x < y : a.offset < b.offset
        }.map(\.element)
        p.years = Array(Set(collected.map(\.year))).sorted(by: >)
        if year != "All" { var seen = Set<String>(); p.months = collected.filter { $0.year == Int(year) }.map(\.month).filter { seen.insert($0).inserted } }

        let kept = collected.filter { c in
            let tx = c.fill
            let matchVehicle = vehicle == "All" || (tx["vehicleType"].truthy && tx["vehicleType"].text.lowercased() == vehicle.lowercased()) || (tx["title"].truthy && tx["title"].text.lowercased().contains(vehicle.lowercased()))
            return matchVehicle && (year == "All" || c.year == Int(year)) && (month == "All" || c.month == month)
        }

        let maxDistance = 1000.0
        var previousKm: Double?, previousLiters: Double?, previousVehicle: String?
        var spentWithLiters = 0.0
        for c in kept {
            let tx = c.fill
            let amt = abs(tx["amount"].double)
            let l = positive(tx["liters"], tx["litres"], tx["fuelLiters"])
            let k = positive(tx["km"], tx["odometer"], tx["reading"], tx["odometerReading"])
            p.totalSpent += amt
            var mileage: Double?, price: Double?, distance: Double?, calculated = false
            if let l, l > 0 { p.totalLiters += l; spentWithLiters += amt; price = amt / l }
            let current = (tx["vehicleType"].truthy ? tx["vehicleType"].text : tx["title"].text).lowercased()
            if let k, k > 0 {
                if let pk = previousKm, previousVehicle == current, k > pk {
                    distance = k - pk
                    if distance! <= maxDistance {
                        p.totalDistance += distance!
                        let used = (previousLiters ?? 0) > 0 ? previousLiters : l
                        if let used, used > 0 { mileage = distance! / used; calculated = true }
                    } else { distance = nil; mileage = nil; calculated = false }
                }
                if let l, l > 0 { previousKm = k; previousVehicle = current; previousLiters = l }
            } else if let l, l > 0 { previousLiters = l }
            p.rows.append(Fill(txId: tx["id"].text, year: c.year, month: c.month, date: tx["date"].text, title: tx["title"].text, amount: amt, liters: l, km: k, distance: distance,
                               mileage: mileage, pricePerLiter: price, mileageCalculated: calculated, vehicle: current))
        }
        let valid = p.rows.filter { $0.mileageCalculated && ($0.mileage ?? 0) > 0 && ($0.mileage ?? 0) < 150 }
        p.validMileage = valid.count
        p.avgMileage = valid.isEmpty ? 0 : valid.reduce(0) { $0 + ($1.mileage ?? 0) } / Double(valid.count)
        p.avgPrice = p.totalLiters > 0 ? spentWithLiters / p.totalLiters : 0
        p.filtered = p.rows
        p.all = []
        return p
    }
}
