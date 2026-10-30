import Foundation

/// Where a price sits and which thresholds someone asked to be told about — a port
/// of `utils/priceRange.js`. Deliberately descriptive: a holding at its 52-week low
/// is a fact; whether that is an opportunity is not something a tracker can know.
enum PriceRange {
    /// Within this much of an extreme counts as "at" it, for flagging purposes.
    static let nearEdgePct = 15.0

    /// A finite JSON *number* — a numeric string is not one, as in the web code.
    static func strictNumber(_ v: JSONValue) -> Double? {
        if case let .number(n) = v, n.isFinite { return n }
        return nil
    }

    struct Quote: Equatable {
        var price: Double?
        var previousClose: Double?
        var low: Double?
        var high: Double?
        var hasRange = false
        /// 0 is sitting on the 52-week low, 100 on the high; nil when a bound is missing.
        var rangePct: Double?
        var dayChange: Double?
        var dayChangePct: Double?
        var aboveLowPct: Double?
        var belowHighPct: Double?
        var nearLow = false
        var nearHigh = false
        var tradedAt: String?
    }

    static func readQuote(_ holding: JSONValue) -> Quote {
        let q = holding["quote"]
        let price = strictNumber(q["price"]) ?? strictNumber(holding["currentPrice"])
        let low = strictNumber(q["fiftyTwoWeekLow"]), high = strictNumber(q["fiftyTwoWeekHigh"]), prev = strictNumber(q["previousClose"])

        var out = Quote(price: price, previousClose: prev, low: low, high: high)
        if let low, let high, let price, high > low {
            out.hasRange = true
            out.rangePct = (price - low) / (high - low) * 100
            if low > 0 { out.aboveLowPct = (price - low) / low * 100 }
            if high > 0 { out.belowHighPct = (high - price) / high * 100 }
        }
        if let prev, let price {
            out.dayChange = Money.round2(price - prev)
            if prev > 0 { out.dayChangePct = (price - prev) / prev * 100 }
        }
        if let r = out.rangePct { out.nearLow = r <= nearEdgePct; out.nearHigh = r >= 100 - nearEdgePct }
        out.tradedAt = q["tradedAt"].truthy ? q["tradedAt"].text : nil
        return out
    }

    struct Alert: Equatable { let id: String; let type: String; let price: Double; let note: String; let currentPrice: Double }

    /// Which of a holding's alerts the current price has crossed. A zero price means
    /// the quote failed, not that the stock is free, so it is treated as no price.
    static func triggeredAlerts(_ holding: JSONValue) -> [Alert] {
        func priced(_ v: JSONValue) -> Double? { strictNumber(v).flatMap { $0 > 0 ? $0 : nil } }
        guard let price = priced(holding["quote"]["price"]) ?? priced(holding["currentPrice"]) else { return [] }
        return holding["alerts"].array.compactMap { a in
            guard let target = strictNumber(a["price"]) else { return nil }
            let crossed = a["type"].text == "below" ? price <= target : price >= target
            return crossed ? Alert(id: a["id"].text, type: a["type"].text, price: target, note: a["note"].text, currentPrice: price) : nil
        }
    }

    struct Edge: Equatable { let id: String; let name: String; let ticker: String; let quote: Quote }

    /// Holdings sitting at either end of their 52-week range.
    static func atRangeEdges(_ holdings: [JSONValue]) -> (nearLow: [Edge], nearHigh: [Edge]) {
        let rows = holdings.filter { !$0.isNull && !$0["isArchived"].truthy }.compactMap { h -> Edge? in
            let q = readQuote(h)
            guard q.hasRange else { return nil }
            return Edge(id: h["id"].text, name: [h["name"], h["ticker"]].first { $0.truthy }?.text ?? "", ticker: h["ticker"].text, quote: q)
        }
        func stable(_ list: [Edge], by less: (Edge, Edge) -> Bool) -> [Edge] {
            list.enumerated().sorted { less($0.element, $1.element) || (!less($1.element, $0.element) && $0.offset < $1.offset) }.map(\.element)
        }
        return (stable(rows.filter { $0.quote.nearLow }) { $0.quote.rangePct! < $1.quote.rangePct! },
                stable(rows.filter { $0.quote.nearHigh }) { $0.quote.rangePct! > $1.quote.rangePct! })
    }
}
