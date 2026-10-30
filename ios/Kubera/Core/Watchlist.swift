import Foundation

/// How risky *you* think an entry is, and how much you want it. Both are stored,
/// never derived (`utils/watchlistRisk.js`): the app has no view on either, and an
/// entry nobody has rated is *unrated*, which is not the same as low.
enum WatchlistRisk {
    static let riskLevels = ["low", "medium", "high"]
    static let priorityLevels = ["watching", "interested", "ready"]

    static func risk(of item: JSONValue) -> String {
        let r = item["risk"].text.trimmingCharacters(in: .whitespaces).lowercased()
        return riskLevels.contains(r) ? r : "unrated"
    }

    static func priority(of item: JSONValue) -> String {
        let p = item["priority"].text.trimmingCharacters(in: .whitespaces).lowercased()
        return priorityLevels.contains(p) ? p : "unset"
    }

    static let priorityOrder = ["ready": 0, "interested": 1, "watching": 2, "unset": 3]
    static func priorityLabel(_ key: String) -> String {
        ["ready": "Ready", "interested": "Interested", "watching": "Watching", "unset": "No priority"][key] ?? key
    }
    static func riskLabel(_ key: String) -> String { key == "unrated" ? "Unrated" : key.capitalized }
    static func priorityBlurb(_ key: String) -> String {
        ["ready": "Decided in principle — waiting on price or cash.", "interested": "Worth more work before doing anything.",
         "watching": "Following out of curiosity, no intent.", "unset": "Not ranked yet."][key] ?? ""
    }
}

/// One sector vocabulary: the picker's GICS names, with NSE-flavoured names mapped
/// onto them so one exposure is never split across two rows (`utils/sectors.js`).
enum Sectors {
    static let canonical = ["Information Technology", "Financials", "Health Care", "Consumer Discretionary", "Consumer Staples",
                            "Industrials", "Communication Services", "Energy", "Utilities", "Materials", "Real Estate", "Other"]
    static let unclassified = "Other"

    static let icons: [String: String] = [
        "Information Technology": "💻", "Financials": "🏦", "Health Care": "🩺", "Consumer Discretionary": "🛍️",
        "Consumer Staples": "🛒", "Industrials": "⚙️", "Communication Services": "📡", "Energy": "⚡", "Utilities": "🚰",
        "Materials": "🏗️", "Real Estate": "🏢", "Other": "📁", "Unclassified": "📁",
    ]

    private static let aliases: [String: String] = [
        "financial services": "Financials", "finance": "Financials", "banking": "Financials",
        "healthcare": "Health Care", "pharma": "Health Care", "pharmaceuticals": "Health Care",
        "automobile": "Consumer Discretionary", "auto": "Consumer Discretionary", "consumer durables": "Consumer Discretionary",
        "consumer goods (fmcg)": "Consumer Staples", "fmcg": "Consumer Staples", "consumer goods": "Consumer Staples",
        "capital goods": "Industrials", "construction": "Industrials", "services": "Industrials", "infrastructure": "Industrials",
        "chemicals": "Materials", "construction materials": "Materials", "metals & mining": "Materials", "metals": "Materials", "cement": "Materials",
        "oil & gas": "Energy", "oil and gas": "Energy", "power": "Utilities",
        "telecommunication": "Communication Services", "telecom": "Communication Services", "media": "Communication Services",
        "realty": "Real Estate", "it": "Information Technology", "technology": "Information Technology",
    ]

    /// Anything unrecognised becomes `Other`, so a typo cannot create a sector that looks legitimate.
    static func normalise(_ sector: String) -> String {
        let raw = sector.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.isEmpty { return unclassified }
        if let exact = canonical.first(where: { $0.lowercased() == raw.lowercased() }) { return exact }
        return aliases[raw.lowercased()] ?? unclassified
    }

    /// The record's own sector wins; the benchmark table is the fallback.
    static func sectorFor(_ own: String, benchmark: String) -> String {
        let a = normalise(own)
        return a != unclassified ? a : normalise(benchmark)
    }

    static func icon(_ sector: String) -> String { icons[sector] ?? icons[normalise(sector)] ?? "📁" }
}

enum Benchmark {
    static let marketCaps = ["Large Cap", "Mid Cap", "Small Cap"]

    private static func clean(_ value: String) -> String {
        var s = value.lowercased()
        for word in ["limited", "ltd", "corporation", "corp", "company", "co"] {
            s = s.replacingOccurrences(of: "\\b\(word)\\b", with: "", options: .regularExpression)
        }
        return String(s.unicodeScalars.filter { ("a"..."z").contains($0) || ("0"..."9").contains($0) })
    }

    /// An explicit `marketCap` on the record wins; otherwise it is looked up in the
    /// benchmark lists by symbol, name or alias, with names normalised on both sides.
    static func marketCap(of stock: JSONValue) -> String {
        if stock.isNull { return "Unclassified" }
        if stock["marketCap"].truthy { return stock["marketCap"].text }
        let symbol = clean(stock["symbol"].text), name = clean(stock["name"].text)
        if symbol.isEmpty && name.isEmpty { return "Unclassified" }
        for entry in BenchmarkData.all {
            guard let cap = entry.cap, !cap.isEmpty else { continue }
            let candidates = ([entry.symbol, entry.name] + entry.aliases).map(clean)
            if candidates.contains(where: { !$0.isEmpty && ($0 == symbol || $0 == name) }) { return cap }
        }
        return "Unclassified"
    }
}

/// The Watchlist page: each entry with the figures drawn from it, the order you work
/// through them in, and the counts behind the filters. Port of Watchlist.jsx.
enum WatchlistPage {
    struct Row: Identifiable, Equatable {
        let id: String
        let name: String
        let ticker: String
        let notes: String
        let quote: PriceRange.Quote
        let fired: [PriceRange.Alert]
        let alerts: [JSONValue]
        let sector: String
        let risk: String
        let cap: String
        let priority: String
        let raw: JSONValue
        static func == (a: Row, b: Row) -> Bool { a.id == b.id && a.quote == b.quote && a.fired == b.fired }
    }

    enum Sort: String, CaseIterable, Identifiable { case priority = "Priority", range = "Nearest 52w low", name = "Name"; var id: String { rawValue } }

    struct Summary: Equatable {
        var rows: [Row] = []
        var nearLow = 0
        var nearHigh = 0
        var firedCount = 0
        var riskCounts: [String: Int] = [:]
        var priorityCounts: [String: Int] = [:]
        var sectorCounts: [(name: String, count: Int)] = []
        var capCounts: [(name: String, count: Int)] = []
        static func == (a: Summary, b: Summary) -> Bool { a.rows == b.rows && a.nearLow == b.nearLow && a.firedCount == b.firedCount }
    }

    static func summary(_ watchlist: JSONValue) -> Summary {
        let items = watchlist.array.filter { !$0.isNull }
        let rows = items.map { w in
            Row(id: w["id"].text, name: w["name"].text, ticker: w["ticker"].text, notes: w["notes"].text,
                quote: PriceRange.readQuote(w), fired: PriceRange.triggeredAlerts(w), alerts: w["alerts"].array,
                sector: Sectors.normalise(w["sector"].text), risk: WatchlistRisk.risk(of: w), cap: Benchmark.marketCap(of: w),
                priority: WatchlistRisk.priority(of: w), raw: w)
        }
        var out = Summary(rows: rows)
        let edges = PriceRange.atRangeEdges(items)
        out.nearLow = edges.nearLow.count
        out.nearHigh = edges.nearHigh.count
        out.firedCount = rows.reduce(0) { $0 + $1.fired.count }
        for level in WatchlistRisk.riskLevels + ["unrated"] { out.riskCounts[level] = rows.filter { $0.risk == level }.count }
        for level in WatchlistRisk.priorityLevels + ["unset"] { out.priorityCounts[level] = rows.filter { $0.priority == level }.count }

        var sectors: [String: Int] = [:]
        rows.forEach { sectors[$0.sector, default: 0] += 1 }
        out.sectorCounts = sectors.map { (name: $0.key, count: $0.value) }.sorted { $0.count != $1.count ? $0.count > $1.count : $0.name < $1.name }
        var caps: [String: Int] = [:]
        rows.forEach { caps[$0.cap, default: 0] += 1 }
        out.capCounts = (Benchmark.marketCaps + ["Unclassified"]).compactMap { band in caps[band].map { count in (name: band, count: count) } }
        return out
    }

    /// Priority puts the ones you want most first, nearest its 52-week low within a band
    /// (the useful tie-break for a list you are working down).
    static func sorted(_ rows: [Row], by sort: Sort) -> [Row] {
        func byRange(_ a: Row, _ b: Row) -> Int {
            switch (a.quote.rangePct, b.quote.rangePct) {
            case (nil, nil): return 0
            case (nil, _): return 1
            case (_, nil): return -1
            case let (x?, y?): return x < y ? -1 : (x > y ? 1 : 0)
            }
        }
        func byPriority(_ a: Row, _ b: Row) -> Int { WatchlistRisk.priorityOrder[a.priority]! - WatchlistRisk.priorityOrder[b.priority]! }
        let order: (Row, Row) -> Int
        switch sort {
        case .priority: order = { let p = byPriority($0, $1); return p != 0 ? p : byRange($0, $1) }
        case .range: order = byRange
        case .name: order = { $0.name.compare($1.name, locale: Locale(identifier: "en")).rawValue }
        }
        return rows.enumerated().sorted { let c = order($0.element, $1.element); return c != 0 ? c < 0 : $0.offset < $1.offset }.map(\.element)
    }
}
