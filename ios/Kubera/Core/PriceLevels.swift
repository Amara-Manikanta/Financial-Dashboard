import Foundation

/// How the money put into a stock is spread across the prices it was paid at — a port of the
/// `priceDistribution` memo on the Mac's stock page (the same view the mutual-fund page gives for NAV).
/// Buys and IPO allotments only: a sale returns money and a bonus costs none.
enum PriceLevels {
    struct Band: Identifiable, Equatable {
        let from: Double
        let to: Double
        let amount: Double
        let shares: Double
        let count: Int
        let belowAverage: Bool
        var id: Double { from }
        var label: String { from == to ? String(format: "%.2f", from) : String(format: "%.0f–%.0f", from, to) }
    }

    static func bands(_ transactions: [JSONValue], avgCost: Double) -> [Band] {
        let buys = transactions.compactMap { t -> (price: Double, quantity: Double)? in
            guard ["buy", "ipo"].contains(t["type"].text), t["price"].double > 0, t["quantity"].double > 0 else { return nil }
            return (t["price"].double, t["quantity"].double)
        }
        guard !buys.isEmpty else { return [] }
        let minPrice = buys.map(\.price).min()!, maxPrice = buys.map(\.price).max()!
        // Everything bought at one price: one band, so the chart still says so.
        guard maxPrice > minPrice else {
            return [Band(from: minPrice, to: minPrice, amount: buys.reduce(0) { $0 + $1.price * $1.quantity },
                         shares: buys.reduce(0) { $0 + $1.quantity }, count: buys.count, belowAverage: minPrice < avgCost)]
        }
        let count = max(3, min(10, buys.count))
        let width = (maxPrice - minPrice) / Double(count)
        var amount = [Double](repeating: 0, count: count), shares = [Double](repeating: 0, count: count), n = [Int](repeating: 0, count: count)
        for b in buys {
            let i = min(count - 1, Int(floor((b.price - minPrice) / width)))
            amount[i] += b.price * b.quantity; shares[i] += b.quantity; n[i] += 1
        }
        return (0..<count).filter { n[$0] > 0 }.map { i in
            let from = minPrice + Double(i) * width, to = minPrice + Double(i + 1) * width
            return Band(from: from, to: to, amount: amount[i], shares: shares[i], count: n[i], belowAverage: (from + to) / 2 < avgCost)
        }
    }
}
