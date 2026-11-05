import Foundation

/// Refreshing stock prices — the merge step of `refreshStockPrices` / `refreshWatchlistPrices` in `FinanceContext.jsx`. Quotes come from the
/// Mac's own `/api/quote`; only `currentPrice` and `quote` of a matched entry change, and a quote with no price changes nothing.
enum PriceRefresh {
    struct Outcome: Equatable {
        var updated = 0, total = 0
        var missing: [String] = []     // no quote came back: still showing their previous price
        var stale: [String] = []       // a delisted or renamed ticker answering with its final price
    }

    static func symbol(_ ticker: String) -> String { ticker.contains(".") ? ticker : ticker + ".NS" }

    /// Entries that can be priced: a ticker, and not archived.
    static func refreshable(_ entries: [JSONValue]) -> [JSONValue] { entries.filter { $0["ticker"].truthy && !$0["isArchived"].truthy } }

    static func symbols(_ entries: [JSONValue]) -> [String] { refreshable(entries).map { symbol($0["ticker"].text) } }

    /// `entries` with the matched ones' price and quote replaced (others untouched), and what happened.
    /// `quotes` is `{ "INFY.NS": { price, … } }`; `stale` is the route's list of `{ symbol, ageDays }`.
    static func merge(_ entries: [JSONValue], quotes: JSONValue, stale: JSONValue, fetchedAt: String) -> (list: [Any], outcome: Outcome) {
        var out = Outcome()
        let staleSymbols = Set(stale.array.map { $0["symbol"].text })
        let list: [Any] = entries.map { e in
            guard e["ticker"].truthy, !e["isArchived"].truthy else { return RecordEditing.foundation(e) }
            out.total += 1
            let sym = symbol(e["ticker"].text)
            let q = quotes[sym]
            let name = e["name"].truthy ? e["name"].text : e["ticker"].text
            guard case .number(let price) = q["price"], price > 0 else {
                if staleSymbols.contains(sym) { out.stale.append("\(name) (\(sym))") } else { out.missing.append(name) }
                return RecordEditing.foundation(e)
            }
            out.updated += 1
            var o = (RecordEditing.foundation(e) as? [String: Any]) ?? [:]
            var quote = (RecordEditing.foundation(q) as? [String: Any]) ?? [:]
            quote["fetchedAt"] = fetchedAt
            o["currentPrice"] = price
            o["quote"] = quote
            return o
        }
        return (list, out)
    }

    /// One sentence for the screen: how many moved, and who did not.
    static func summary(holdings: Outcome?, watchlist: Outcome?) -> String {
        var parts: [String] = []
        if let h = holdings { parts.append("\(h.updated)/\(h.total) holdings") }
        if let w = watchlist, w.total > 0 { parts.append("\(w.updated)/\(w.total) watchlist") }
        var s = "Prices updated: " + parts.joined(separator: " · ") + "."
        let missing = (holdings?.missing ?? []) + (watchlist?.missing ?? [])
        if !missing.isEmpty { s += " No quote for \(missing.prefix(5).joined(separator: ", "))\(missing.count > 5 ? " and \(missing.count - 5) more" : "") — they keep their previous price." }
        let stale = (holdings?.stale ?? []) + (watchlist?.stale ?? [])
        if !stale.isEmpty { s += " No longer trading: \(stale.prefix(3).joined(separator: "; ")). Correct the ticker." }
        return s
    }
}
