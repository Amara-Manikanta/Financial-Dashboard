import Foundation

/// A stock's daily closes (`GET /api/history`) turned into a series, its range statistics, and the
/// days money went in, for the price-history chart. Nothing here is stored or written.
enum PriceHistory {
    struct Point: Identifiable, Equatable {
        let day: String        // yyyy-MM-dd
        let date: Date
        let close: Double
        var id: String { day }
    }

    struct Buy: Identifiable, Equatable {
        let date: Date
        let price: Double
        let quantity: Double
        var id: Double { date.timeIntervalSince1970 + price }
    }

    struct Stats: Equatable {
        let first: Double, last: Double, high: Double, low: Double
        var changePercent: Double { first > 0 ? (last - first) / first * 100 : 0 }
    }

    static let ranges: [(id: String, label: String)] = [("1mo", "1M"), ("3mo", "3M"), ("6mo", "6M"), ("1y", "1Y"), ("5y", "5Y")]

    private static let formatter: DateFormatter = {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC"); f.dateFormat = "yyyy-MM-dd"; return f
    }()

    /// `{ "closes": { "2026-10-30": 1182.5, … } }`, oldest first. Days that are not a number are dropped.
    static func series(_ body: JSONValue) -> [Point] {
        body["closes"].object.compactMap { day, value -> Point? in
            guard case .number(let close) = value, close.isFinite, let d = formatter.date(from: day) else { return nil }
            return Point(day: day, date: d, close: close)
        }.sorted { $0.day < $1.day }
    }

    static func stats(_ points: [Point]) -> Stats? {
        guard points.count >= 2, let first = points.first, let last = points.last else { return nil }
        let values = points.map(\.close)
        return Stats(first: first.close, last: last.close, high: values.max()!, low: values.min()!)
    }

    /// Buys and IPO allotments that fall inside the series, at the price actually paid and placed on the
    /// first trading day on or after the purchase so the dot sits on the chart's axis.
    static func buys(_ transactions: [JSONValue], in points: [Point]) -> [Buy] {
        guard let first = points.first?.day, let last = points.last?.day else { return [] }
        return transactions.compactMap { t -> Buy? in
            guard ["buy", "ipo"].contains(t["type"].text), t["price"].double > 0 else { return nil }
            let day = String(t["date"].text.prefix(10))
            guard day >= first, day <= last, let on = points.first(where: { $0.day >= day }) else { return nil }
            return Buy(date: on.date, price: t["price"].double, quantity: t["quantity"].double)
        }
    }
}
