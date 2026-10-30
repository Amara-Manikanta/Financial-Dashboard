import Foundation

/// A stock's position replayed from its transactions — port of
/// `recomputeStockMetrics` / `effectiveStockPosition` in `utils/investmentSync.js`.
/// The replay, not the stored `shares`/`avgCost`, is the truth: those fields are
/// only as fresh as whichever write last touched them.
struct StockPosition: Equatable {
    var shares: Double
    var avgCost: Double
    var totalCost: Double
    var realised: Double
    var avgCostIsManual: Bool
    /// Gross dividends by calendar year, replayed from the dividend rows.
    var dividends: [String: Double] = [:]
}

enum Stocks {
    static func replay(_ transactions: [JSONValue]) -> StockPosition {
        var shares = 0.0, totalCost = 0.0, realised = 0.0
        var dividends: [String: Double] = [:]
        // A split applies to whatever was held at the time, so order matters.
        let ordered = transactions.enumerated().sorted { a, b in
            let da = date(a.element["date"]), db = date(b.element["date"])
            return da == db ? a.offset < b.offset : da < db
        }.map(\.element)

        for tx in ordered {
            let qty = tx["quantity"].double
            let price = tx["price"].double
            switch tx["type"].text {
            case "buy", "ipo":
                totalCost = shares == 0 ? qty * price : totalCost + qty * price
                shares += qty
            case "sell", "buyback":
                let avg = shares > 0 ? totalCost / shares : 0
                realised += min(qty, shares) * (price - avg)
                shares = max(0, shares - qty)
                totalCost = shares * avg
            case "bonus":
                shares += qty
            case "split":
                let from = tx["splitFrom"].double, to = tx["splitTo"].double
                if tx["splitFrom"].truthy && tx["splitTo"].truthy { shares = shares * (to / from) } else { shares += qty }
            case "demerger":
                shares += qty
                totalCost = shares * price
            case "merger_out":
                let avg = shares > 0 ? totalCost / shares : 0
                shares = max(0, shares - qty)
                totalCost = shares * avg
            case "merger_in":
                totalCost = shares == 0 ? qty * price : totalCost + qty * price
                shares += qty
            case "dividend":
                guard let when = JSDate.parse(tx["date"]) else { break }
                let year = String(Calendar.current.component(.year, from: when))
                // Gross, before any tax withheld: the same basis as dividendAnalytics.
                let gross = tx["amountIsNet"].isTrue ? price + tx["tds"].double : price
                dividends[year, default: 0] += gross
            default:
                break
            }
        }
        let avgCost = shares > 0 ? Money.round2(totalCost / shares) : 0
        return StockPosition(shares: shares, avgCost: avgCost, totalCost: shares > 0 ? totalCost : 0,
                             realised: Money.round2(realised), avgCostIsManual: false, dividends: dividends)
    }

    /// Replay when there is history; the stored fields only for a holding with none.
    /// A typed-in `manualAvgCost` outranks the replay.
    static func position(of stock: JSONValue) -> StockPosition {
        let rows = stock["transactions"].array
        var result: StockPosition
        if rows.isEmpty {
            let stored = stock["avgCost"].isNull ? stock["avgPrice"] : stock["avgCost"]
            result = StockPosition(shares: stock["shares"].double, avgCost: stored.double, totalCost: 0, realised: 0, avgCostIsManual: false)
        } else {
            result = replay(rows)
        }
        let manual = stock["manualAvgCost"].jsNumber ?? .nan
        if manual.isFinite && manual > 0 { result.avgCost = manual; result.avgCostIsManual = true }
        return result
    }

    private static func date(_ value: JSONValue) -> Double {
        let text = value.text
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        if let day = formatter.date(from: String(text.prefix(10))) { return day.timeIntervalSince1970 }
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: text)?.timeIntervalSince1970 ?? 0
    }

    // MARK: Portfolio

    /// A holding with no `owner` is the user's own; family and paper holdings
    /// are tracked but are not this portfolio (`utils/holdingOwner.js`).
    static func isOwn(_ holding: JSONValue) -> Bool {
        let owner = holding["owner"].truthy ? holding["owner"].text : "self"
        return owner == "self"
    }

    struct Holding: Identifiable, Equatable {
        let id: String
        let name: String
        let ticker: String
        let sector: String
        let shares: Double
        let avgCost: Double
        let price: Double
        let invested: Double
        let value: Double
        let raw: JSONValue
        var gain: Double { value - invested }
        var gainPercent: Double { invested > 0 ? gain / invested * 100 : 0 }
    }

    struct Portfolio: Equatable {
        var holdings: [Holding]
        var value: Double { holdings.reduce(0) { $0 + $1.value } }
        var invested: Double { holdings.reduce(0) { $0 + $1.invested } }
        var gain: Double { value - invested }
        var gainPercent: Double { invested > 0 ? gain / invested * 100 : 0 }
    }

    /// Active holdings of the user's own, valued as the web Dashboard does:
    /// stored shares × last price for value, replayed position for cost.
    static func portfolio(account: JSONValue) -> Portfolio {
        let holdings = account["stocks"].array
            .filter { isOwn($0) && !$0["isArchived"].truthy && $0["shares"].double > 0 }
            .map { stock -> Holding in
                let position = self.position(of: stock)
                return Holding(
                    id: stock["id"].text, name: stock["name"].text, ticker: stock["ticker"].text,
                    sector: stock["sector"].text, shares: stock["shares"].double, avgCost: position.avgCost,
                    price: stock["currentPrice"].double,
                    invested: position.shares * position.avgCost,
                    value: stock["shares"].double * stock["currentPrice"].double, raw: stock)
            }
        return Portfolio(holdings: holdings)
    }
}
