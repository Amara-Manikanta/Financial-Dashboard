import Foundation

/// Consolidated stock and fund overlap — a port of the logic in `pages/Nifty50Exposure.jsx`
/// and `utils/fundComposition.js`. Your direct shares are added to what each of four index
/// and equity funds holds in the same company, so one company's whole weight in the
/// portfolio shows as one row rather than five.
///
/// A composition stored on the fund record wins; the built-in tables are only the fallback
/// while none has been entered (`readComposition`). Only equity rows count towards a share
/// overlap: a debt fund's issuers are credit exposure, not shares.
enum NiftyOverlap {
    enum Basis: String, CaseIterable, Identifiable { case current = "Market value", invested = "Cost"; var id: String { rawValue } }

    /// The four funds the page looks through, in the order the web page applies them.
    enum Fund: String, CaseIterable, Identifiable {
        case nippon = "Nippon Nifty 50", icici = "ICICI Nifty Next 50", hdfc = "HDFC Flexi Cap", sbi = "SBI Small Cap"
        var id: String { rawValue }
        var short: String { switch self { case .nippon: "Nippon"; case .icici: "ICICI"; case .hdfc: "HDFC"; case .sbi: "SBI" } }
        var defaultCap: String { switch self { case .nippon: "Large Cap"; case .icici: "Mid Cap"; case .hdfc: "Large Cap"; case .sbi: "Small Cap" } }

        func matches(_ title: String) -> Bool {
            let t = title.lowercased()
            switch self {
            case .nippon: return t.contains("nippon") && t.contains("nifty 50")
            case .icici: return t.contains("icici") && t.contains("next 50")
            case .hdfc: return t.contains("hdfc flexi")
            case .sbi: return t.contains("sbi small")
            }
        }
    }

    /// One disclosed holding of a fund.
    struct Row: Equatable {
        let symbol: String
        let name: String
        let weight: Double
        let sector: String
        let assetClass: String
    }

    // MARK: Composition (fundComposition.js)

    private static func staticRows(_ fund: Fund) -> [Row] {
        func rows(_ list: [BenchmarkStock]) -> [Row] {
            list.map { Row(symbol: $0.symbol.uppercased(), name: $0.name.isEmpty ? $0.symbol : $0.name,
                           weight: Money.round2($0.weight ?? 0), sector: $0.sector.isEmpty ? "Other" : $0.sector, assetClass: "equity") }
        }
        switch fund {
        case .nippon: return rows(BenchmarkData.nifty50)
        case .icici: return rows(BenchmarkData.niftyNext50)
        case .sbi: return rows(BenchmarkData.sbiSmallCap)
        case .hdfc:
            return BenchmarkData.hdfcFlexiCapWeights.map { Row(symbol: $0.symbol.uppercased(), name: $0.symbol, weight: Money.round2($0.weight), sector: "Other", assetClass: "equity") }
        }
    }

    private static func storedRows(_ record: JSONValue) -> [Row]? {
        let list = record["composition"]["holdings"].array
        if list.isEmpty { return nil }
        return list.compactMap { h -> Row? in
            let symbol = h["symbol"].text.uppercased()
            if symbol.isEmpty { return nil }
            let name = h["name"].truthy ? h["name"].text : h["symbol"].text
            let sector = h["sector"].truthy ? h["sector"].text : "Other"
            let cls = h["assetClass"].truthy ? h["assetClass"].text : "equity"
            return Row(symbol: symbol, name: name, weight: Money.round2(h["weight"].double), sector: sector, assetClass: cls)
        }
    }

    /// Heaviest first. JavaScript's sort is stable, so equal weights keep their listed order.
    static func composition(of record: JSONValue, fund: Fund) -> [Row] {
        let rows = storedRows(record) ?? staticRows(fund)
        return rows.enumerated().sorted { a, b in a.element.weight != b.element.weight ? a.element.weight > b.element.weight : a.offset < b.offset }.map(\.element)
    }

    // MARK: Matching a holding to the benchmark lists

    private static func cleanName(_ value: String) -> String {
        var s = value.lowercased()
        s = s.replacingOccurrences(of: "\\blimited\\b|\\bltd\\b|\\bcorp\\b|\\bcorporation\\b", with: "", options: .regularExpression)
        s = String(s.unicodeScalars.map { ("a"..."z").contains($0) || ("0"..."9").contains($0) || $0 == "&" ? Character($0) : " " })
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func benchmarkMatch(symbol: String, rawClean: String) -> BenchmarkStock? {
        let own = symbol.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        return BenchmarkData.all.first { s in
            if s.symbol.isEmpty { return false }
            if !own.isEmpty && own == s.symbol.uppercased() { return true }
            if rawClean == cleanName(s.symbol) || rawClean == cleanName(s.name) { return true }
            return s.aliases.contains { alias in
                let a = cleanName(alias)
                if a.count < 3 { return false }
                return rawClean == a || rawClean.hasPrefix(a + " ") || rawClean.hasSuffix(" " + a)
            }
        }
    }

    // MARK: The page

    struct Exposure: Identifiable, Equatable {
        var id: String { symbol }
        let symbol: String
        var name: String
        var sector: String
        var cap: String
        var directVal = 0.0, directShares = 0.0
        var byFund: [Fund: Double] = [:]
        var totalIndirect = 0.0, total = 0.0
        var totalPct = 0.0, directPct = 0.0, indirectPct = 0.0
        var status = Status.none

        enum Status: String { case none, both, directOnly = "direct_only", indirectOnly = "indirect_only" }
        func value(in fund: Fund) -> Double { byFund[fund] ?? 0 }
    }

    struct Slice: Identifiable, Equatable { var id: String { name }; let name: String; let value: Double; let pct: Double }

    struct SectorRow: Identifiable, Equatable {
        var id: String { sector }
        let sector: String
        var direct = 0.0, indirect = 0.0, total = 0.0
        var count = 0
        var pct = 0.0
    }

    struct Page: Equatable {
        var fundValues: [Fund: Double] = [:]
        var fundFound: [Fund: Bool] = [:]
        var stockValue = 0.0
        var equityFundValue = 0.0
        var portfolioValue = 0.0
        var exposures: [Exposure] = []
        var caps: [Slice] = []
        var sectors: [SectorRow] = []
        var top: Exposure? { exposures.enumerated().sorted { $0.element.total != $1.element.total ? $0.element.total > $1.element.total : $0.offset < $1.offset }.first?.element }
        var sectorNames: [String] { ["all"] + Set(exposures.map(\.sector)).sorted() }
    }

    static func page(savings: JSONValue, basis: Basis = .current, view: Fund? = nil, asOf: Date = Date()) -> Page {
        var page = Page()
        let active = savings.array.filter { !$0["isArchived"].truthy }
        let stockAccounts = active.filter { $0["type"].text == "stock_market" }
        let funds = active.filter { $0["type"].text == "mutual_fund" }

        func worth(_ item: JSONValue) -> Double { basis == .current ? Valuation.currentValue(item, asOf: asOf) : Valuation.investedValue(item) }

        var records: [Fund: JSONValue] = [:]
        for fund in Fund.allCases {
            guard let record = funds.first(where: { fund.matches($0["title"].text) }) else { page.fundFound[fund] = false; page.fundValues[fund] = 0; continue }
            records[fund] = record
            page.fundFound[fund] = true
            page.fundValues[fund] = worth(record)
        }
        page.stockValue = stockAccounts.reduce(0) { $0 + worth($1) }
        page.equityFundValue = Fund.allCases.reduce(0) { $0 + (page.fundValues[$1] ?? 0) }
        page.portfolioValue = page.stockValue + page.equityFundValue

        // Registered in the order the web page builds them: direct holdings, then each fund.
        var order: [String] = []
        var map: [String: Exposure] = [:]
        func ensure(_ symbol: String, _ name: String, _ sector: String, _ cap: String) -> String {
            if map[symbol] == nil { map[symbol] = Exposure(symbol: symbol, name: name, sector: sector, cap: cap.isEmpty ? "Mid Cap" : cap); order.append(symbol) }
            return symbol
        }

        // Direct holdings, merged when two records resolve to the same company.
        var directOrder: [String] = []
        var direct: [String: (symbol: String, name: String, sector: String, cap: String, shares: Double, value: Double)] = [:]
        for account in stockAccounts {
            for stock in account["stocks"].array where Stocks.isOwn(stock) && !stock["isArchived"].truthy {
                let position = Stocks.position(of: stock)
                if position.shares <= 0 { continue }
                let value = basis == .current ? position.shares * stock["currentPrice"].double : position.shares * position.avgCost
                let title = [stock["name"], stock["title"], stock["symbol"]].first { $0.truthy }?.text ?? ""
                let rawTitle = title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                let matched = benchmarkMatch(symbol: stock["symbol"].text, rawClean: cleanName(rawTitle))
                let key = matched?.symbol ?? rawTitle
                if direct[key] == nil {
                    let ownCap = stock["marketCap"].truthy ? stock["marketCap"].text.trimmingCharacters(in: .whitespacesAndNewlines) : ""
                    direct[key] = (matched?.symbol ?? rawTitle.uppercased(), matched?.name ?? title,
                                   Sectors.sectorFor(stock["sector"].text, benchmark: matched?.sector ?? ""),
                                   !ownCap.isEmpty ? ownCap : (matched?.cap ?? "Mid Cap"), 0, 0)
                    directOrder.append(key)
                }
                direct[key]!.shares += position.shares
                direct[key]!.value += value
            }
        }
        for key in directOrder {
            let d = direct[key]!
            let symbol = ensure(d.symbol, d.name, d.sector, d.cap)
            map[symbol]!.directVal = d.value
            map[symbol]!.directShares = d.shares
        }

        for fund in Fund.allCases where view == nil || view == fund {
            guard let record = records[fund], let value = page.fundValues[fund], value > 0 else { continue }
            for h in composition(of: record, fund: fund) where h.assetClass == "equity" {
                let known = BenchmarkData.all.first { $0.symbol == h.symbol }
                let symbol = ensure(h.symbol, h.name.isEmpty ? (known?.name ?? h.symbol) : h.name,
                                    Sectors.sectorFor(h.sector, benchmark: known?.sector ?? ""),
                                    (known?.cap?.isEmpty == false ? known?.cap : nil) ?? fund.defaultCap)
                map[symbol]!.byFund[fund] = value * (h.weight / 100)
            }
        }

        let total = page.portfolioValue
        page.exposures = order.compactMap { map[$0] }.map { e in
            var e = e
            e.totalIndirect = Fund.allCases.reduce(0) { $0 + e.value(in: $1) }
            e.total = e.directVal + e.totalIndirect
            e.totalPct = total > 0 ? e.total / total * 100 : 0
            e.directPct = total > 0 ? e.directVal / total * 100 : 0
            e.indirectPct = total > 0 ? e.totalIndirect / total * 100 : 0
            e.status = e.directVal > 0 && e.totalIndirect > 0 ? .both : e.directVal > 0 ? .directOnly : e.totalIndirect > 0 ? .indirectOnly : .none
            return e
        }.filter { $0.total > 0 }

        var large = 0.0, mid = 0.0, small = 0.0
        for e in page.exposures { if e.cap == "Large Cap" { large += e.total } else if e.cap == "Small Cap" { small += e.total } else { mid += e.total } }
        let bands = large + mid + small
        func share(_ v: Double) -> Double { bands > 0 ? v / bands * 100 : 0 }
        page.caps = [Slice(name: "Large Cap", value: large, pct: share(large)), Slice(name: "Mid Cap", value: mid, pct: share(mid)), Slice(name: "Small Cap", value: small, pct: share(small))]

        var sectorOrder: [String] = []
        var sectors: [String: SectorRow] = [:]
        for e in page.exposures {
            if sectors[e.sector] == nil { sectors[e.sector] = SectorRow(sector: e.sector); sectorOrder.append(e.sector) }
            sectors[e.sector]!.direct += e.directVal
            sectors[e.sector]!.indirect += e.totalIndirect
            sectors[e.sector]!.total += e.total
            sectors[e.sector]!.count += 1
        }
        page.sectors = sectorOrder.compactMap { sectors[$0] }.map { var s = $0; s.pct = total > 0 ? s.total / total * 100 : 0; return s }
            .enumerated().sorted { $0.element.total != $1.element.total ? $0.element.total > $1.element.total : $0.offset < $1.offset }.map(\.element)
        return page
    }

    // MARK: Filtering and order

    enum Holding: String, CaseIterable, Identifiable { case all = "All", direct = "Direct", indirect = "Via funds"; var id: String { rawValue } }
    enum Sort: String, CaseIterable, Identifiable { case total = "Total", direct = "Direct", indirect = "Via funds", name = "Name"; var id: String { rawValue } }

    static func filtered(_ rows: [Exposure], search: String = "", cap: String = "all", holding: Holding = .all, sector: String = "all",
                         sort: Sort = .total, descending: Bool = true) -> [Exposure] {
        let q = search.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let kept = rows.filter { e in
            let hit = q.isEmpty || e.name.lowercased().contains(q) || e.symbol.lowercased().contains(q) || e.sector.lowercased().contains(q)
            let held = holding == .all || (holding == .direct && e.directVal > 0) || (holding == .indirect && e.totalIndirect > 0)
            return hit && held && (sector == "all" || e.sector == sector) && (cap == "all" || e.cap == cap)
        }
        func order(_ a: Exposure, _ b: Exposure) -> Double {
            switch sort {
            case .total: return b.total - a.total
            case .direct: return b.directVal - a.directVal
            case .indirect: return b.totalIndirect - a.totalIndirect
            case .name: return a.name.compare(b.name, locale: Locale(identifier: "en")) == .orderedAscending ? -1 : a.name.compare(b.name, locale: Locale(identifier: "en")) == .orderedSame ? 0 : 1
            }
        }
        return kept.enumerated().sorted { x, y in
            let r = descending ? order(x.element, y.element) : -order(x.element, y.element)
            return r != 0 ? r < 0 : x.offset < y.offset
        }.map(\.element)
    }
}
