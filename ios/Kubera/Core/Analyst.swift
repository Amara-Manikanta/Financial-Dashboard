import Foundation

/// The stock analyst — a port of `utils/stockAdvisor.js` (read its header: every
/// suggestion names the rule that raised it, tax comes from the Capital Gains ledger and
/// is never re-derived, and nothing predicts a price). Nothing here writes.
///
/// Fundamentals and the Nifty history are inputs, not fetched here: the screen loads them
/// from the Mac and passes whatever has arrived. Without them the fundamentals and
/// laggard findings are simply absent, as on the web page while they load.
enum Analyst {
    // MARK: Rules

    enum Rules {
        static let maxPositionPct = 10.0
        static let urgentPositionPct = 20.0
        static let minTrimValue = 5000.0
        static let minHarvestGain = 10000.0
        static let minHarvestPerHolding = 1000.0
        static let minTaxSaving = 1000.0
        static let waitWindowDays = 60
        static let minWaitSaving = 500.0
        static let roundTripCostPct = 0.25
        static let laggardGapPct = 20.0
        static let laggardMinGap = 5000.0
        static let laggardMinDays = 365
        static let fyEndUrgentDays = 45
        static let stalePriceHours = 24.0
    }

    enum Severity: String, CaseIterable { case act, review, info
        var rank: Int { switch self { case .act: 0; case .review: 1; case .info: 2 } }
    }

    struct Evidence: Equatable { let label: String; let value: String }

    struct Finding: Identifiable, Equatable {
        let id: String
        let kind: String
        let severity: Severity
        var holdingId: String?
        var watchlistId: String?
        var ticker: String?
        var name: String?
        let title: String
        let detail: String
        let action: String
        let rule: String
        let evidence: [Evidence]
        var deadline: String?
        let impact: Double
        var trimLongGain: Double?
    }

    struct Snapshot: Equatable {
        var fy = "", fyEnd = ""
        var daysToFyEnd = 0
        var value = 0.0, invested = 0.0, unrealised = 0.0, unrealisedPct = 0.0
        var heldCount = 0
        var largest: (name: String, weight: Double)?
        var topFiveShare = 0.0
        var sectors: [(sector: String, value: Double, pct: Double)] = []
        var realisedShort = 0.0, realisedLong = 0.0, estimatedTax = 0.0, exemption = 0.0, exemptionUsed = 0.0, carriedLosses = 0.0
        var pricesUpdatedAt: String?
        var pricesAgeHours: Double?
        var pricesStale = true
        var fundamentalsLoaded = 0
        var indexLoaded = false

        static func == (a: Snapshot, b: Snapshot) -> Bool {
            a.fy == b.fy && a.value == b.value && a.invested == b.invested && a.heldCount == b.heldCount && a.estimatedTax == b.estimatedTax
                && a.fundamentalsLoaded == b.fundamentalsLoaded && a.indexLoaded == b.indexLoaded && a.pricesAgeHours == b.pricesAgeHours
        }
    }

    struct Analysis: Equatable {
        var asOf = ""
        var findings: [Finding] = []
        var counts: [Severity: Int] = [:]
        var snapshot = Snapshot()
    }

    // MARK: Formatting (the web page's own strings)

    private static let day = 86_400_000.0
    private static func num(_ v: Double) -> Double { v.isNaN ? 0 : v }
    private static func money(_ v: Double) -> Double { Money.round2(num(v)) }

    private static let groupFormatter: NumberFormatter = {
        let f = NumberFormatter(); f.locale = Locale(identifier: "en_IN"); f.numberStyle = .decimal
        f.usesGroupingSeparator = true; f.maximumFractionDigits = 0; f.minimumFractionDigits = 0; return f
    }()
    private static func grouped(_ whole: Double) -> String { groupFormatter.string(from: NSNumber(value: whole)) ?? String(Int(whole)) }

    static func inr(_ v: Double) -> String { "\(num(v) < 0 ? "−" : "")₹\(grouped(Money.jsRound(abs(num(v)))))" }
    private static func fixed(_ v: Double, _ d: Int) -> String { String(format: "%.\(d)f", num(v)) }
    static func pct(_ v: Double, _ digits: Int = 1) -> String { "\(fixed(v, digits))%" }
    static func signedPct(_ v: Double, _ digits: Int = 1) -> String { "\(num(v) >= 0 ? "+" : "−")\(fixed(abs(num(v)), digits))%" }
    static func signedInr(_ v: Double) -> String { "\(num(v) >= 0 ? "+" : "")\(inr(v))" }
    private static func count(_ q: Double) -> String { q == q.rounded() ? grouped(q) : fixed(q, 2) }
    private static func sharesOf(_ q: Double) -> String { "\(count(q)) share\(q == 1 ? "" : "s")" }

    private static let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"]
    private static let utc: Calendar = { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "UTC")!; return c }()
    /// "31 Mar 2027" — a calendar day read in UTC, with en-IN's "Sept".
    static func readable(_ iso: String) -> String {
        guard let d = JSDate.parse(iso) else { return "Invalid Date" }
        let c = utc.dateComponents([.year, .month, .day], from: d)
        return "\(c.day ?? 0) \(months[(c.month ?? 1) - 1]) \(c.year ?? 0)"
    }
    private static func isoDay(_ d: Date) -> String {
        let c = utc.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
    private static func daysBetween(_ from: String, _ to: String) -> Int {
        guard let a = JSDate.parse(from), let b = JSDate.parse(to) else { return 0 }
        return Int(Money.jsRound(b.timeIntervalSince(a) * 1000 / day))
    }

    static func symbolFor(_ item: JSONValue) -> String? {
        let t = (item["ticker"].truthy ? item["ticker"].text : item["symbol"].text).trimmingCharacters(in: .whitespaces)
        if t.isEmpty { return nil }
        return t.contains(".") ? t : "\(t).NS"
    }

    // MARK: Per-stock summary (stockAnalytics.js stockSummary)

    struct Position {
        let stock: JSONValue
        let id: String, name: String, ticker: String
        let shares: Double, avgCost: Double, currentPrice: Double
        let invested: Double, value: Double, unrealised: Double, unrealisedPct: Double
        var held: Bool { shares > 0 }
        var priceUnknown: Bool { shares > 0 && !(currentPrice > 0) }
    }

    static func position(_ stock: JSONValue) -> Position {
        let shares = stock["shares"].double
        let avg = Stocks.position(of: stock).avgCost
        let price = stock["currentPrice"].double
        let invested = shares * avg, value = shares * price
        return Position(stock: stock, id: stock["id"].text, name: [stock["name"], stock["ticker"]].first { $0.truthy }?.text ?? "Unnamed",
                        ticker: stock["ticker"].text, shares: shares, avgCost: avg, currentPrice: price,
                        invested: money(invested), value: money(value), unrealised: money(value - invested),
                        unrealisedPct: invested > 0 ? (value - invested) / invested * 100 : 0)
    }

    // MARK: Sectors (sectorLimits.js)

    struct SectorRow: Equatable { let sector: String; let value: Double; let pct: Double }
    struct Breach: Equatable { let sector: String; let value: Double; let pct: Double; let limit: Double; let overBy: Double; let excessValue: Double }

    static func sectorWeights(_ stocks: [JSONValue]) -> (total: Double, rows: [SectorRow]) {
        var order: [String] = [], by: [String: Double] = [:], total = 0.0
        for s in stocks where !s.isNull && !s["isArchived"].truthy && s["shares"].double > 0 {
            let value = s["shares"].double * s["currentPrice"].double
            if value <= 0 { continue }
            let key = Sectors.sectorFor(s["sector"].text, benchmark: "")
            if by[key] == nil { order.append(key) }
            by[key, default: 0] += value
            total += value
        }
        let rows = order.map { SectorRow(sector: $0, value: money(by[$0]!), pct: total > 0 ? by[$0]! / total * 100 : 0) }
        return (money(total), rows.enumerated().sorted { $0.element.value != $1.element.value ? $0.element.value > $1.element.value : $0.offset < $1.offset }.map(\.element))
    }

    static func sectorBreaches(_ stocks: [JSONValue], limits: JSONValue) -> (total: Double, rows: [SectorRow], breaches: [Breach], limitedCount: Int) {
        let (total, rows) = sectorWeights(stocks)
        let limited = rows.filter { limits[$0.sector].double > 0 }
        let breaches = limited.filter { $0.pct > limits[$0.sector].double }.map { r -> Breach in
            let limit = limits[r.sector].double
            return Breach(sector: r.sector, value: r.value, pct: r.pct, limit: limit, overBy: r.pct - limit, excessValue: money((r.pct - limit) / 100 * total))
        }
        return (total, rows, breaches.enumerated().sorted { $0.element.overBy != $1.element.overBy ? $0.element.overBy > $1.element.overBy : $0.offset < $1.offset }.map(\.element), limited.count)
    }

    // MARK: Tax, by asking the ledger

    private static let probeId = "__analyst_probe__"

    struct Sale: Equatable {
        var disposals: [CapitalGains.Disposal] = []
        var gain = 0.0, shortGain = 0.0, longGain = 0.0, proceeds = 0.0, unmatched = 0.0
    }

    static func simulateSale(_ stock: JSONValue, quantity: Double, price: Double, date: String) -> Sale {
        let probe = JSONValue.object(["id": .string(probeId), "type": .string("sell"), "date": .string(date), "quantity": .number(quantity), "price": .number(price)])
        let name = [stock["name"], stock["ticker"]].first { $0.truthy }?.text ?? ""
        let m = CapitalGains.matchLots(.array(stock["transactions"].array + [probe]), name: name, id: stock["id"].text)
        let mine = m.disposals.filter { $0.txId == probeId }
        func sum(_ rows: [CapitalGains.Disposal], _ f: (CapitalGains.Disposal) -> Double) -> Double { rows.reduce(0) { $0 + f($1) } }
        return Sale(disposals: mine, gain: money(sum(mine) { $0.gain }), shortGain: money(sum(mine.filter { $0.term == "short" }) { $0.gain }),
                    longGain: money(sum(mine.filter { $0.term == "long" }) { $0.gain }), proceeds: money(sum(mine) { $0.proceeds }),
                    unmatched: money(m.unmatched.filter { $0.txId == probeId }.reduce(0) { $0 + $1.quantity }))
    }

    private static func yearAnchor(_ fy: String) -> CapitalGains.Disposal {
        CapitalGains.Disposal(holding: "", holdingId: "", txId: "", type: "", acquiredOn: "", acquiredAs: "", soldOn: "", quantity: 0, costPerShare: 0,
                              salePerShare: 0, cost: 0, proceeds: 0, gain: 0, isLong: false, fy: fy, dividendIncome: 0, treatedAsDividend: false)
    }

    struct TaxYear { let row: CapitalGains.LedgerYear?; let short: [CapitalGains.Carried]; let long: [CapitalGains.Carried] }

    static func taxYear(_ disposals: [CapitalGains.Disposal], _ fy: String) -> TaxYear {
        let l = CapitalGains.ledger(disposals + [yearAnchor(fy)])
        return TaxYear(row: l.years.first { $0.fy == fy }, short: l.carriedShort, long: l.carriedLong)
    }
    private static func carriedTotal(_ r: CapitalGains.LedgerYear?) -> Double { num(r?.closingCarriedShort ?? 0) + num(r?.closingCarriedLong ?? 0) }
    private static func fyEndOf(_ fy: String) -> String { "\((Int(fy.prefix(4)) ?? 0) + 1)-03-31" }

    // MARK: Context

    private final class Context {
        let today: String, todayDate: Date, fy: String, fyEnd: String, daysToFyEnd: Int
        let own: [JSONValue], active: [JSONValue]
        let positions: [Position], priced: [Position]
        let total: Double
        let disposals: [CapitalGains.Disposal]
        let unmatchedSales: [CapitalGains.Unmatched]
        let watchlist: [JSONValue]
        let sectorLimits: JSONValue
        let fundamentals: [String: JSONValue]
        let indexCloses: [String: Double]?
        let pricesUpdatedAt: String?
        let asOf: Date
        private var baselines: [String: TaxYear] = [:]

        init(stocks: [JSONValue], watchlist: [JSONValue], sectorLimits: JSONValue, fundamentals: [String: JSONValue], indexCloses: [String: Double]?, pricesUpdatedAt: String?, asOf: Date) {
            todayDate = CapitalGains.calendarDay(asOf)
            today = Analyst.isoDay(todayDate)
            fy = CapitalGains.fyFor(JSONValue.string(today)) ?? ""
            own = stocks.filter { !$0.isNull }
            active = own.filter { !$0["isArchived"].truthy }
            positions = active.map(Analyst.position).filter(\.held)
            priced = positions.filter { !$0.priceUnknown && $0.value > 0 }
            total = priced.reduce(0) { $0 + $1.value }
            let d = CapitalGains.disposals(forStocks: own)
            disposals = d.disposals; unmatchedSales = d.unmatched
            fyEnd = Analyst.fyEndOf(fy)
            daysToFyEnd = Analyst.daysBetween(today, fyEnd)
            self.watchlist = watchlist.filter { !$0.isNull && !$0["isArchived"].truthy }
            self.sectorLimits = sectorLimits
            self.fundamentals = fundamentals
            self.indexCloses = (indexCloses?.isEmpty == false) ? indexCloses : nil
            self.pricesUpdatedAt = pricesUpdatedAt
            self.asOf = asOf
        }

        func weight(_ p: Position) -> Double { total > 0 ? p.value / total * 100 : 0 }
        func baseline(_ year: String) -> TaxYear {
            if let b = baselines[year] { return b }
            let b = Analyst.taxYear(disposals, year); baselines[year] = b; return b
        }
        func taxImpact(_ extra: [CapitalGains.Disposal], year: String? = nil) -> (extraTax: Double, carriedUsed: Double, exemptionUsed: Double) {
            let y = year ?? fy
            let before = baseline(y).row, after = Analyst.taxYear(disposals + extra, y).row
            return (Analyst.money((after?.estimatedTax ?? 0) - (before?.estimatedTax ?? 0)),
                    Analyst.money(Analyst.carriedTotal(before) - Analyst.carriedTotal(after)),
                    Analyst.money((after?.exemptUsed ?? 0) - (before?.exemptUsed ?? 0)))
        }
    }

    private static let taxTolerance = 1.0
    private static func taxSeverity(_ ctx: Context) -> Severity { ctx.daysToFyEnd <= Rules.fyEndUrgentDays ? .act : .review }

    private static func describeSaleTax(_ sale: Sale, _ impact: (extraTax: Double, carriedUsed: Double, exemptionUsed: Double)) -> String {
        if sale.gain <= 0 { return "That sale books a \(inr(-sale.gain)) loss, so no tax." }
        let split = sale.longGain > 0 && sale.shortGain > 0 ? " (\(inr(sale.longGain)) long-term, \(inr(sale.shortGain)) short-term)"
            : sale.longGain > 0 ? " of long-term gain" : " of short-term gain"
        if impact.extraTax > taxTolerance { return "That sale books \(inr(sale.gain))\(split): estimated tax \(inr(impact.extraTax))." }
        if impact.carriedUsed > taxTolerance { return "That sale books \(inr(sale.gain))\(split), set against losses on record — no tax this year." }
        if impact.exemptionUsed > taxTolerance { return "That sale books \(inr(sale.gain))\(split), inside this year's ₹1.25L long-term exemption — no tax." }
        return "That sale books \(inr(sale.gain))\(split) and adds no tax this year."
    }

    private static func waitAlternative(_ ctx: Context, _ stock: JSONValue, _ quantity: Double, _ price: Double, _ now: Sale,
                                        _ impactNow: (extraTax: Double, carriedUsed: Double, exemptionUsed: Double)) -> (date: String, days: Int, saving: Double)? {
        let pending = now.disposals.filter { $0.term == "short" && $0.gain > 0 }
        if pending.isEmpty { return nil }
        let dates = pending.compactMap { CapitalGains.longTermFrom($0.acquiredOn) }.sorted()
        guard let date = dates.last else { return nil }
        let days = daysBetween(ctx.today, date)
        if days <= 0 || days > Rules.waitWindowDays { return nil }
        let later = simulateSale(stock, quantity: quantity, price: price, date: date)
        let impactLater = ctx.taxImpact(later.disposals, year: CapitalGains.fyFor(JSONValue.string(date)) ?? "")
        let saving = money(impactNow.extraTax - impactLater.extraTax)
        return saving < Rules.minWaitSaving ? nil : (date, days, saving)
    }

    // MARK: Analysers

    private static func concentrationFindings(_ ctx: Context) -> [Finding] {
        ctx.priced.compactMap { p -> Finding? in
            let weight = ctx.weight(p)
            guard weight > Rules.maxPositionPct else { return nil }
            let excess = p.value - Rules.maxPositionPct / 100 * ctx.total
            if excess < Rules.minTrimValue { return nil }
            let quantity = min(p.shares, (excess / p.currentPrice).rounded(.up))
            let sale = simulateSale(p.stock, quantity: quantity, price: p.currentPrice, date: ctx.today)
            let impact = ctx.taxImpact(sale.disposals)
            let wait = waitAlternative(ctx, p.stock, quantity, p.currentPrice, sale, impact)
            let action = [
                "Selling about \(sharesOf(quantity)) (≈\(inr(quantity * p.currentPrice))) brings it back to \(Int(Rules.maxPositionPct))%.",
                describeSaleTax(sale, impact),
                wait.map { "Waiting until \(readable($0.date)) (\($0.days) days), when those shares turn long term, would save about \(inr($0.saving)) if the price holds." },
                sale.unmatched > 0 ? "\(sharesOf(sale.unmatched)) of it have no recorded purchase, so their tax is not included." : nil,
                "Or keep it and send new money elsewhere until it drifts back under \(Int(Rules.maxPositionPct))%.",
            ].compactMap { $0 }.joined(separator: " ")
            var f = Finding(id: "concentration:\(p.id)", kind: "concentration", severity: weight > Rules.urgentPositionPct ? .act : .review,
                            title: "\(p.name) is \(pct(weight)) of your stock portfolio",
                            detail: "SEBI caps a diversified mutual fund at \(Int(Rules.maxPositionPct))% in any one company. Above that line, one company's bad year moves your whole portfolio.",
                            action: action, rule: "SEBI \(Int(Rules.maxPositionPct))% single-company cap",
                            evidence: [Evidence(label: "Weight", value: pct(weight)), Evidence(label: "Value", value: inr(p.value)),
                                       Evidence(label: "Unrealised", value: "\(signedInr(p.unrealised)) (\(signedPct(p.unrealisedPct)))"),
                                       Evidence(label: "Suggested trim", value: "\(sharesOf(quantity)) ≈ \(inr(quantity * p.currentPrice))"),
                                       Evidence(label: "Tax on trim", value: inr(max(0, impact.extraTax)))],
                            impact: money(excess))
            f.holdingId = p.id; f.ticker = p.ticker; f.name = p.name; f.trimLongGain = sale.longGain
            return f
        }
    }

    private static func sectorFindings(_ ctx: Context) -> [Finding] {
        let r = sectorBreaches(ctx.active, limits: ctx.sectorLimits)
        if r.rows.isEmpty { return [] }
        if r.limitedCount == 0 {
            let largest = r.rows[0]
            return [Finding(id: "sector:no-limits", kind: "sector", severity: .info, title: "Set sector limits so sector concentration can be checked",
                            detail: "Your largest sector is \(largest.sector) at \(pct(largest.pct)). No sector has a limit, so the analyst has no line of yours to hold it to — and it will not invent one.",
                            action: "Set a cap for the sectors you care about on the stock account’s Analytics tab.", rule: "Your sector limits",
                            evidence: r.rows.prefix(3).map { Evidence(label: $0.sector, value: pct($0.pct)) }, impact: 0)]
        }
        return r.breaches.map { b in
            let members = ctx.priced.filter { Sectors.sectorFor($0.stock["sector"].text, benchmark: "") == b.sector }
                .enumerated().sorted { $0.element.value != $1.element.value ? $0.element.value > $1.element.value : $0.offset < $1.offset }.map(\.element).prefix(3)
            return Finding(id: "sector:\(b.sector)", kind: "sector", severity: b.overBy >= 5 ? .act : .review,
                           title: "\(b.sector) is \(pct(b.pct)) of your portfolio — over your \(fixedLimit(b.limit))% limit",
                           detail: "A limit you set yourself, and \(b.sector) is \(fixed(b.overBy, 1)) percentage points over it.",
                           action: "About \(inr(b.excessValue)) is over the line. Its largest holdings: \(members.map { "\($0.name) \(inr($0.value))" }.joined(separator: " · ")). Trim those, or add to other sectors, to bring it back.",
                           rule: "Your sector limit",
                           evidence: [Evidence(label: "Weight", value: pct(b.pct)), Evidence(label: "Your limit", value: "\(fixedLimit(b.limit))%"), Evidence(label: "Over by", value: inr(b.excessValue))],
                           impact: money(b.excessValue))
        }
    }
    /// A JavaScript number printed bare: 25 not 25.0.
    private static func fixedLimit(_ v: Double) -> String { v == v.rounded() ? String(Int(v)) : String(v) }

    private static func alertFindings(_ ctx: Context) -> [Finding] {
        func describe(_ alert: PriceRange.Alert, _ item: JSONValue, _ name: String, holding: Bool, value: Double) -> Finding {
            let q = PriceRange.readQuote(item)
            let below = alert.type == "below"
            let verb = below ? "below" : "above"
            let next = holding ? (below ? "Decide whether this is a chance to add or a reason to exit." : "Decide whether to book some profit — this is the level you chose.")
                : (below ? "The price you were waiting for. Check the fundamentals before buying." : "It has run past your level — decide whether it is still worth buying.")
            var ev = [Evidence(label: "Price", value: inr(alert.currentPrice)), Evidence(label: "Your level", value: "\(verb) \(inr(alert.price))")]
            if q.hasRange { ev.append(Evidence(label: "52-week range", value: "\(inr(q.low ?? 0))–\(inr(q.high ?? 0)) (\(pct(q.rangePct ?? 0, 0)) up)")) }
            var f = Finding(id: "alert:\(holding ? "holding" : "watchlist"):\(item["id"].text):\(alert.id)", kind: "alert", severity: .act,
                            title: "\(name) is \(verb) your \(inr(alert.price)) alert",
                            detail: "Now \(inr(alert.currentPrice)).\(alert.note.isEmpty ? "" : " Your note: “\(alert.note)”")",
                            action: next, rule: "Your price alert", evidence: ev, impact: num(value))
            if holding { f.holdingId = item["id"].text } else { f.watchlistId = item["id"].text }
            f.ticker = item["ticker"].text; f.name = name
            return f
        }
        func priced(_ item: JSONValue) -> Bool { num(PriceRange.readQuote(item).price ?? 0) > 0 }
        return ctx.positions.filter { priced($0.stock) }.flatMap { p in PriceRange.triggeredAlerts(p.stock).map { describe($0, p.stock, p.name, holding: true, value: p.value) } }
            + ctx.watchlist.filter(priced).flatMap { w in PriceRange.triggeredAlerts(w).map { describe($0, w, w["name"].truthy ? w["name"].text : w["ticker"].text, holding: false, value: 0) } }
    }

    private static func watchlistFindings(_ ctx: Context) -> [Finding] {
        ctx.watchlist.compactMap { w -> Finding? in
            if num(PriceRange.readQuote(w).price ?? 0) > 0 && !PriceRange.triggeredAlerts(w).isEmpty { return nil }
            let priority = WatchlistRisk.priority(of: w)
            guard priority == "ready" || priority == "interested" else { return nil }
            let q = PriceRange.readQuote(w)
            guard q.hasRange, q.nearLow else { return nil }
            let name = w["name"].truthy ? w["name"].text : w["ticker"].text
            let f = symbolFor(w).flatMap { ctx.fundamentals[$0] }
            let signal = f?["signal"] ?? .null
            let weak = signal["action"].text == "sell"
            var ev = [Evidence(label: "Price", value: inr(q.price ?? 0)), Evidence(label: "Above 52-week low", value: pct(q.aboveLowPct ?? 0)),
                      Evidence(label: "Your risk rating", value: WatchlistRisk.risk(of: w) == "unrated" ? "not set" : WatchlistRisk.risk(of: w))]
            if let f, !signal.isNull { ev.append(Evidence(label: "Fundamentals", value: "\(signal["label"].text) (\(scoreText(f["healthScore"]["total"], "?"))/\(scoreText(f["healthScore"]["max"], "5")))")) }
            var out = Finding(id: "watchlist:\(w["id"].text)", kind: "watchlist", severity: priority == "ready" ? .review : .info,
                              title: "\(name) is near its 52-week low — you marked it \(priority == "ready" ? "Ready" : "Interested")",
                              detail: "\(inr(q.price ?? 0)) is \(pct(q.rangePct ?? 0, 0)) of the way up its \(inr(q.low ?? 0))–\(inr(q.high ?? 0)) range.\(weak ? " The fundamentals check says “\(signal["label"].text)”, so the low price may be the market’s verdict rather than an opportunity." : "")",
                              action: priority == "ready" ? "You decided on this in principle and were waiting on price. Re-check the business and decide on a starting amount."
                                  : "Worth the closer look you were planning before it moves.",
                              rule: "Your watchlist priority", evidence: ev, impact: 0)
            out.watchlistId = w["id"].text; out.ticker = w["ticker"].text; out.name = name
            return out
        }
    }
    /// `x ?? fallback` for a figure that may be missing.
    private static func scoreText(_ v: JSONValue, _ fallback: String) -> String { v.isNull ? fallback : v.text }

    private static func fundamentalsFindings(_ ctx: Context) -> [Finding] {
        ctx.priced.compactMap { p -> Finding? in
            guard let key = symbolFor(p.stock), let f = ctx.fundamentals[key] else { return nil }
            let action = f["signal"]["action"].text
            guard action == "sell" || action == "trim" else { return nil }
            let checks = f["healthScore"]["checks"].array
            let bad = checks.filter { $0["status"].text == "bad" }
            let failing = !bad.isEmpty ? bad : checks.filter { $0["status"].text == "caution" }
            let down = p.unrealised < 0
            let total = f["healthScore"]["total"].truthy ? f["healthScore"]["total"].text : "0"
            let max = scoreText(f["healthScore"]["max"], "5")
            var out = Finding(id: "fundamentals:\(p.id)", kind: "fundamentals", severity: action == "sell" ? .review : .info,
                              title: "\(p.name): the fundamentals check says “\(f["signal"]["label"].text)” (\(total)/\(max))",
                              detail: f["signal"]["reasons"].array.map(\.text).joined(separator: " · "),
                              action: down ? "You are \(inr(-p.unrealised)) (\(pct(-p.unrealisedPct))) below cost. Re-read why you own it; if you sell, that loss offsets other gains."
                                  : "You are up \(inr(p.unrealised)) (\(pct(p.unrealisedPct))). Re-read why you own it before adding more.",
                              rule: "Fundamentals scorecard (revenue, profit, margins, debt, valuation)",
                              evidence: failing.map { Evidence(label: $0["name"].text, value: $0["detail"].text) }
                                  + [Evidence(label: "Weight", value: pct(ctx.weight(p))), Evidence(label: "Unrealised", value: "\(signedInr(p.unrealised)) (\(signedPct(p.unrealisedPct)))")],
                              impact: money(p.value))
            out.holdingId = p.id; out.ticker = p.ticker; out.name = p.name
            return out
        }
    }

    // MARK: Tax findings

    private struct PlanItem { let holdingId: String; let name: String; let quantity: Double; let gain: Double; let longGain: Double; let shortGain: Double; let proceeds: Double }
    private static let breakEvenGainRatio = (Rules.roundTripCostPct / 100) / 0.125

    private static func taxFreeHarvest(_ ctx: Context, longOnly: Bool, cap: Double = .infinity) -> (plan: [PlanItem], booked: Double, disposals: [CapitalGains.Disposal], extraTax: Double) {
        var extra: [CapitalGains.Disposal] = [], plan: [PlanItem] = [], booked = 0.0
        struct Candidate { let p: Position; let gain: Double; let maxQty: Double; let ratio: Double }
        var candidates: [Candidate] = ctx.priced.map { p in
            let lots = CapitalGains.matchLots(p.stock["transactions"], name: p.name, id: p.id).openLots
            var quantity = 0.0, gain = 0.0
            for lot in lots {
                if longOnly && !CapitalGains.isLongTerm(JSDate.parse(lot.date) ?? ctx.todayDate, ctx.todayDate) { break }
                quantity += lot.quantity
                gain += lot.quantity * (p.currentPrice - lot.costPerShare)
            }
            let maxQty = (min(quantity, p.shares) + 1e-9).rounded(.down)
            return Candidate(p: p, gain: gain, maxQty: maxQty, ratio: maxQty > 0 ? gain / (maxQty * p.currentPrice) : 0)
        }.filter { $0.maxQty > 0 && $0.gain > 0 && $0.ratio > breakEvenGainRatio }
        candidates = candidates.enumerated().sorted { $0.element.ratio != $1.element.ratio ? $0.element.ratio > $1.element.ratio : $0.offset < $1.offset }.map(\.element)

        for c in candidates {
            if cap - booked < Rules.minHarvestPerHolding { break }
            func trial(_ q: Double) -> (q: Double, sale: Sale, ok: Bool) {
                let sale = simulateSale(c.p.stock, quantity: q, price: c.p.currentPrice, date: ctx.today)
                let impact = ctx.taxImpact(extra + sale.disposals)
                return (q, sale, impact.extraTax <= taxTolerance && sale.unmatched == 0 && booked + sale.gain <= cap + taxTolerance)
            }
            var best: (q: Double, sale: Sale, ok: Bool)?
            let whole = trial(c.maxQty)
            if whole.ok { best = whole } else {
                var lo = 0.0, hi = c.maxQty
                while hi - lo > 1 {
                    let mid = ((lo + hi) / 2).rounded(.down)
                    let t = trial(mid)
                    if t.ok { lo = mid; best = t } else { hi = mid }
                }
            }
            if let best, best.sale.gain >= Rules.minHarvestPerHolding {
                extra += best.sale.disposals
                booked += best.sale.gain
                plan.append(PlanItem(holdingId: c.p.id, name: c.p.name, quantity: best.q, gain: best.sale.gain, longGain: best.sale.longGain, shortGain: best.sale.shortGain, proceeds: best.sale.proceeds))
            }
        }
        return (plan, money(booked), extra, ctx.taxImpact(extra).extraTax)
    }

    private static func planText(_ plan: [PlanItem]) -> String { plan.map { "\($0.name) \(sharesOf($0.quantity)) (gain \(inr($0.gain)))" }.joined(separator: " · ") }

    private static func harvestFindings(_ ctx: Context, trims: [Finding]) -> [Finding] {
        let base = ctx.baseline(ctx.fy)
        struct Pooled { let fy: String; let amount: Double; let expiresAfter: String; let term: String }
        let pool = base.short.map { Pooled(fy: $0.fy, amount: $0.amount, expiresAfter: $0.expiresAfter, term: "short") }
            + base.long.map { Pooled(fy: $0.fy, amount: $0.amount, expiresAfter: $0.expiresAfter, term: "long") }
        func total(_ rows: [Pooled]) -> Double { rows.reduce(0) { $0 + $1.amount } }
        let poolTotal = money(total(pool))

        if poolTotal > taxTolerance {
            let lapsing = pool.filter { $0.expiresAfter == ctx.fy }
            let lapsingTotal = money(total(lapsing))
            let oldest = pool.enumerated().sorted { $0.element.expiresAfter != $1.element.expiresAfter ? $0.element.expiresAfter < $1.element.expiresAfter : $0.offset < $1.offset }[0].element

            if lapsingTotal > taxTolerance {
                let lapsingLong = total(lapsing.filter { $0.term == "long" })
                let shortPool = total(pool.filter { $0.term == "short" })
                let h = lapsingLong > 0 ? taxFreeHarvest(ctx, longOnly: true, cap: shortPool + lapsingLong) : taxFreeHarvest(ctx, longOnly: false, cap: lapsingTotal)
                let after = taxYear(ctx.disposals + h.disposals, ctx.fy)
                let stillLapsing = (after.short + after.long).filter { $0.expiresAfter == ctx.fy }.reduce(0) { $0 + $1.amount }
                let rescued = money(lapsingTotal - stillLapsing)
                return [Finding(id: "tax:carried-lapsing:\(ctx.fy)", kind: "tax", severity: .act,
                                title: "\(inr(lapsingTotal)) of carried-forward losses lapse after 31 March",
                                detail: "Losses can be carried forward for eight years, and these reach the end of theirs this financial year. Gains booked before then are set against them tax-free; after 31 March they are simply gone.",
                                action: !h.plan.isEmpty
                                    ? "Sell and rebuy \(planText(h.plan)) before \(readable(ctx.fyEnd)): \(inr(h.booked)) of gain, tax-free, using \(inr(rescued)) of the losses that would otherwise lapse. Buying back resets the cost to today’s price, so they become a permanently higher cost basis."
                                    : "There are no unrealised gains in the portfolio to set against them at today’s prices.",
                                rule: "Income Tax Act s.74: capital losses carry forward 8 years",
                                evidence: [Evidence(label: "Lapsing", value: inr(lapsingTotal)), Evidence(label: "Used by this plan", value: inr(rescued)),
                                           Evidence(label: "All losses on record", value: inr(poolTotal)),
                                           Evidence(label: "Deadline", value: "\(readable(ctx.fyEnd)) (\(ctx.daysToFyEnd) days)")],
                                deadline: ctx.fyEnd, impact: money(lapsingTotal))]
            }
            return [Finding(id: "tax:carried:\(ctx.fy)", kind: "tax", severity: .info,
                            title: "\(inr(poolTotal)) of capital losses on record shelter your next gains from tax",
                            detail: "Losses are set against gains before any tax is due, for up to eight years after the year they arose. The oldest (\(inr(oldest.amount)), from FY \(oldest.fy)) can be used until FY \(oldest.expiresAfter).",
                            action: "While they last, gains you book are tax-free — so selling and rebuying winners raises your cost basis for nothing. Worth doing only for losses nothing else will use in time: they also shelter other capital gains, such as a property or gold sale.",
                            rule: "Income Tax Act: capital losses carry forward 8 years",
                            evidence: [Evidence(label: "Short-term losses", value: inr(total(pool.filter { $0.term == "short" }))),
                                       Evidence(label: "Long-term losses", value: inr(total(pool.filter { $0.term == "long" }))),
                                       Evidence(label: "First expiry", value: "after FY \(oldest.expiresAfter)")], impact: 0)]
        }

        let exemption = CapitalGains.exemption(for: ctx.fy)
        let exemptionLeft = money(max(0, exemption - num(base.row?.exemptUsed ?? 0)))
        if exemptionLeft < Rules.minHarvestGain { return [] }
        let h = taxFreeHarvest(ctx, longOnly: true)
        if h.booked < Rules.minHarvestGain { return [] }

        let proceeds = h.plan.reduce(0) { $0 + $1.proceeds }
        let futureTax = money(h.booked * 0.125)
        let charges = money(proceeds * Rules.roundTripCostPct / 100)
        let trimmedLong = trims.filter { ($0.trimLongGain ?? 0) > 0 }
        let trimNote = trimmedLong.isEmpty ? "" : " The trims suggested for \(trimmedLong.map { $0.name ?? "" }.joined(separator: " and ")) would use \(inr(trimmedLong.reduce(0) { $0 + ($1.trimLongGain ?? 0) })) of the same allowance — make those first and harvest what is left."
        let used = num(base.row?.exemptUsed ?? 0)
        return [Finding(id: "tax:harvest-exemption:\(ctx.fy)", kind: "tax", severity: taxSeverity(ctx),
                        title: "Book up to \(inr(h.booked)) of long-term gains tax-free before 31 March",
                        detail: "This year's \(inr(exemption)) long-term exemption has \(inr(exemptionLeft)) unused\(used > 0 ? " (\(inr(used)) already used by sales since April)" : ""). It does not carry over — unused, it is gone on 1 April.",
                        action: "Sell and buy back: \(planText(h.plan)). The gain is taxed at 0% now instead of 12.5% whenever you eventually sell. The repurchased shares restart the 12-month clock, so sell them within a year and the gain on them is short term.\(trimNote)",
                        rule: "Income Tax Act s.112A: ₹1.25L long-term exemption a year",
                        evidence: [Evidence(label: "Exemption left", value: inr(exemptionLeft)), Evidence(label: "Gain booked", value: inr(h.booked)),
                                   Evidence(label: "Future tax avoided", value: "up to \(inr(futureTax))"), Evidence(label: "Charges (approx.)", value: inr(charges)),
                                   Evidence(label: "Tax now", value: inr(max(0, h.extraTax))), Evidence(label: "Deadline", value: "\(readable(ctx.fyEnd)) (\(ctx.daysToFyEnd) days)")],
                        deadline: ctx.fyEnd, impact: money(futureTax - charges))]
    }

    private static func lossHarvestFindings(_ ctx: Context) -> [Finding] {
        let taxDue = num(ctx.baseline(ctx.fy).row?.estimatedTax ?? 0)
        if taxDue <= taxTolerance { return [] }
        let found: [Finding] = ctx.priced.compactMap { p -> Finding? in
            let lots = CapitalGains.matchLots(p.stock["transactions"], name: p.name, id: p.id).openLots
            var quantity = 0.0
            for lot in lots { if p.currentPrice >= lot.costPerShare { break }; quantity += lot.quantity }
            quantity = (min(quantity, p.shares) + 1e-9).rounded(.down)
            if quantity <= 0 { return nil }
            let sale = simulateSale(p.stock, quantity: quantity, price: p.currentPrice, date: ctx.today)
            if sale.unmatched > 0 || sale.gain >= 0 { return nil }
            let saving = money(-ctx.taxImpact(sale.disposals).extraTax)
            if saving < Rules.minTaxSaving { return nil }
            let term = sale.shortGain < 0 && sale.longGain < 0 ? "short- and long-term" : sale.shortGain < 0 ? "short-term" : "long-term"
            var f = Finding(id: "tax:loss:\(p.id):\(ctx.fy)", kind: "tax", severity: taxSeverity(ctx),
                            title: "Booking the \(inr(-sale.gain)) loss on \(p.name) cuts this year's tax by \(inr(saving))",
                            detail: "You owe an estimated \(inr(taxDue)) on gains booked since April. Selling \(sharesOf(quantity)) books a \(term) loss that is set against them.",
                            action: "Sell \(sharesOf(quantity)) of \(p.name) (≈\(inr(sale.proceeds))). Buy back only if you still want to own it — India has no wash-sale rule, but the new shares restart the 12-month clock. Savings from several holdings do not add up: together they cannot exceed the \(inr(taxDue)) due.",
                            rule: "Income Tax Act: set-off of capital losses",
                            evidence: [Evidence(label: "Loss booked", value: inr(-sale.gain)), Evidence(label: "Tax saved", value: inr(saving)),
                                       Evidence(label: "Tax due this year", value: inr(taxDue)), Evidence(label: "Deadline", value: "\(readable(ctx.fyEnd)) (\(ctx.daysToFyEnd) days)")],
                            impact: saving)
            f.holdingId = p.id; f.ticker = p.ticker; f.name = p.name; f.deadline = ctx.fyEnd
            return f
        }
        return Array(found.enumerated().sorted { $0.element.impact != $1.element.impact ? $0.element.impact > $1.element.impact : $0.offset < $1.offset }.map(\.element).prefix(5))
    }

    private static func waitFindings(_ ctx: Context, skip: Set<String>) -> [Finding] {
        ctx.priced.compactMap { p -> Finding? in
            if skip.contains(p.id) { return nil }
            let lots = CapitalGains.matchLots(p.stock["transactions"], name: p.name, id: p.id).openLots
            var through = -1
            for (i, lot) in lots.enumerated() {
                if CapitalGains.isLongTerm(JSDate.parse(lot.date) ?? ctx.todayDate, ctx.todayDate) { continue }
                let days = daysBetween(ctx.today, CapitalGains.longTermFrom(lot.date) ?? ctx.today)
                if days > Rules.waitWindowDays { break }
                if p.currentPrice > lot.costPerShare { through = i }
            }
            if through < 0 { return nil }
            var quantity = lots[0...through].reduce(0) { $0 + $1.quantity }
            quantity = (min(quantity, p.shares) + 1e-9).rounded(.down)
            if quantity <= 0 { return nil }
            let now = simulateSale(p.stock, quantity: quantity, price: p.currentPrice, date: ctx.today)
            let impactNow = ctx.taxImpact(now.disposals)
            guard let wait = waitAlternative(ctx, p.stock, quantity, p.currentPrice, now, impactNow) else { return nil }
            var f = Finding(id: "tax:wait:\(p.id):\(wait.date)", kind: "tax", severity: .info,
                            title: "\(p.name): selling after \(readable(wait.date)) saves about \(inr(wait.saving)) in tax",
                            detail: "Selling the first \(sharesOf(quantity)) now books \(inr(now.shortGain)) of short-term gain, taxed at 20%. From \(readable(wait.date)) it is long term — 12.5%, and inside the ₹1.25L exemption while that lasts.",
                            action: "If you were planning to sell, waiting \(wait.days) days saves about \(inr(wait.saving)), as long as the price holds.",
                            rule: "Income Tax Act: 12-month holding period for listed shares",
                            evidence: [Evidence(label: "Short-term gain", value: inr(now.shortGain)), Evidence(label: "Turns long term", value: readable(wait.date)),
                                       Evidence(label: "Tax if sold now", value: inr(max(0, impactNow.extraTax))), Evidence(label: "Saving", value: inr(wait.saving))],
                            impact: wait.saving)
            f.holdingId = p.id; f.ticker = p.ticker; f.name = p.name; f.deadline = wait.date
            return f
        }
    }

    // MARK: Index mirror

    struct Mirror: Equatable { let invested: Double; let returned: Double; let mirrorValue: Double; let firstFlow: String }

    private static func closeOnOrBefore(_ closes: [String: Double], _ date: String, maxBackDays: Int = 10) -> Double? {
        guard let d = JSDate.parse(date) else { return nil }
        for i in 0...maxBackDays {
            let key = isoDay(d.addingTimeInterval(-Double(i) * day / 1000))
            if let v = closes[key] { return v }
        }
        return nil
    }

    static func indexMirror(_ stock: JSONValue, closes: [String: Double], asOf: Date) -> Mirror? {
        let flows = Xirr.stockCashflows(stock, asOf: asOf).filter { !$0.closing }
        if flows.isEmpty { return nil }
        let dates = closes.keys.sorted()
        guard let earliest = dates.first, let latest = dates.last, let latestClose = closes[latest] else { return nil }
        var units = 0.0, invested = 0.0, returned = 0.0
        for f in flows.enumerated().sorted(by: { $0.element.date != $1.element.date ? $0.element.date < $1.element.date : $0.offset < $1.offset }).map(\.element) {
            let dayKey = isoDay(Date(timeIntervalSince1970: f.date / 1000))
            guard dayKey >= earliest, let close = closeOnOrBefore(closes, dayKey) else { return nil }
            if f.amount < 0 { units += -f.amount / close; invested += -f.amount } else { units -= f.amount / close; returned += f.amount }
        }
        if units < 0 || invested <= 0 { return nil }
        return Mirror(invested: money(invested), returned: money(returned), mirrorValue: money(units * latestClose),
                      firstFlow: isoDay(Date(timeIntervalSince1970: flows[0].date / 1000)))
    }

    private static func laggardFindings(_ ctx: Context) -> [Finding] {
        guard let closes = ctx.indexCloses else { return [] }
        let found: [Finding] = ctx.priced.compactMap { p -> Finding? in
            guard let m = indexMirror(p.stock, closes: closes, asOf: ctx.asOf), daysBetween(m.firstFlow, ctx.today) >= Rules.laggardMinDays else { return nil }
            let holdingPct = (m.returned + p.value - m.invested) / m.invested * 100
            let indexPct = (m.returned + m.mirrorValue - m.invested) / m.invested * 100
            let gap = money(m.mirrorValue - p.value)
            if indexPct - holdingPct < Rules.laggardGapPct || gap < Rules.laggardMinGap { return nil }
            var f = Finding(id: "laggard:\(p.id)", kind: "performance", severity: .info,
                            title: "\(p.name) has returned \(signedPct(holdingPct, 0)) on your money; the Nifty 50 would have returned \(signedPct(indexPct, 0))",
                            detail: "The same rupees on the same dates — every purchase, sale and dividend — mirrored in the index would be worth \(inr(gap)) more today. The index figure leaves out its own dividends, so the real gap is a little wider.",
                            action: "If the reason you bought it still holds, keep it — but the index is the bar each holding has to clear.",
                            rule: "Same cash flows in the Nifty 50",
                            evidence: [Evidence(label: "You put in", value: inr(m.invested)), Evidence(label: "Holding return", value: signedPct(holdingPct)),
                                       Evidence(label: "Index return", value: signedPct(indexPct)), Evidence(label: "Behind by", value: inr(gap))],
                            impact: gap)
            f.holdingId = p.id; f.ticker = p.ticker; f.name = p.name
            return f
        }
        return Array(found.enumerated().sorted { $0.element.impact != $1.element.impact ? $0.element.impact > $1.element.impact : $0.offset < $1.offset }.map(\.element).prefix(3))
    }

    private static func incomeFindings(_ ctx: Context) -> [Finding] {
        Dividends.lapsed(ctx.active, now: ctx.asOf).map { d in
            let year = JSDate.parse(d.lastPaid ?? "").map { Calendar.current.component(.year, from: $0) } ?? 0
            var f = Finding(id: "income:lapsed:\(d.id)", kind: "income", severity: .info,
                            title: "\(d.name) last paid a dividend in \(year)",
                            detail: "It paid in \(d.paidYears) of the \(d.spanYears) years since its first payout, and nothing for \(d.yearsSinceLast ?? 0) years. A payer going quiet usually means something changed at the company.",
                            action: "Check the latest results before counting on it for income.", rule: "Your dividend history",
                            evidence: [Evidence(label: "Last paid", value: readable(String((d.lastPaid ?? "").prefix(10)))), Evidence(label: "Received in total", value: inr(d.total)),
                                       Evidence(label: "Yield on cost", value: pct(d.pct, 2))], impact: 0)
            f.holdingId = d.id; f.name = d.name
            return f
        }
    }

    private static func dataFindings(_ ctx: Context) -> [Finding] {
        var out: [Finding] = []
        let noPrice = ctx.positions.filter(\.priceUnknown)
        if !noPrice.isEmpty {
            out.append(Finding(id: "data:no-price", kind: "data", severity: .review, title: "\(noPrice.count) holding\(noPrice.count == 1 ? " has" : "s have") no current price",
                               detail: "\(noPrice.map(\.name).joined(separator: ", ")) \(noPrice.count == 1 ? "is" : "are") left out of every figure here — weights, trims and tax — rather than counted as worth nothing.",
                               action: "Refresh prices. If one still fails, its ticker has probably changed.", rule: "Data completeness",
                               evidence: [Evidence(label: "Cost left out", value: inr(noPrice.reduce(0) { $0 + $1.invested }))], impact: 0))
        }
        let noSector = ctx.priced.filter { Sectors.sectorFor($0.stock["sector"].text, benchmark: "") == "Other" && $0.stock["sector"].text.trimmingCharacters(in: .whitespaces).isEmpty }
        if !noSector.isEmpty {
            out.append(Finding(id: "data:no-sector", kind: "data", severity: .info, title: "\(noSector.count) holding\(noSector.count == 1 ? " has" : "s have") no sector",
                               detail: "\(noSector.map(\.name).joined(separator: ", ")) \(noSector.count == 1 ? "counts" : "count") as “Other”, so sector limits cannot see \(inr(noSector.reduce(0) { $0 + $1.value })).",
                               action: "Set a sector on each holding.", rule: "Data completeness",
                               evidence: noSector.prefix(4).map { Evidence(label: $0.name, value: inr($0.value)) }, impact: 0))
        }
        if !ctx.unmatchedSales.isEmpty {
            out.append(Finding(id: "data:unmatched-sales", kind: "data", severity: .info, title: "Tax figures leave out sales with no purchase on record",
                               detail: "\(ctx.unmatchedSales.map { "\($0.holding) (\(count($0.quantity)) on \($0.soldOn))" }.joined(separator: ", ")). With no cost to match, they are left out rather than taxed as pure profit.",
                               action: "Add the missing purchases and every tax figure here completes itself.", rule: "Data completeness", evidence: [], impact: 0))
        }
        let unpriced = ctx.watchlist.filter { $0["ticker"].truthy && PriceRange.readQuote($0).price == nil }
        if !unpriced.isEmpty {
            out.append(Finding(id: "data:watchlist-no-price", kind: "data", severity: .info, title: "\(unpriced.count) watchlist \(unpriced.count == 1 ? "entry has" : "entries have") no price",
                               detail: "\(unpriced.map { $0["name"].truthy ? $0["name"].text : $0["ticker"].text }.joined(separator: ", ")) cannot be checked against their range or alerts.",
                               action: "Refresh prices, or correct the ticker.", rule: "Data completeness", evidence: [], impact: 0))
        }
        return out
    }

    // MARK: The analysis

    static func analyse(stocks: [JSONValue], watchlist: [JSONValue], sectorLimits: JSONValue, fundamentals: [String: JSONValue] = [:],
                        indexCloses: [String: Double]? = nil, pricesUpdatedAt: String? = nil, asOf: Date = Date()) -> Analysis {
        let ctx = Context(stocks: stocks, watchlist: watchlist, sectorLimits: sectorLimits, fundamentals: fundamentals, indexCloses: indexCloses, pricesUpdatedAt: pricesUpdatedAt, asOf: asOf)
        let concentration = concentrationFindings(ctx)
        let trimmed = Set(concentration.compactMap(\.holdingId))
        let all = alertFindings(ctx) + concentration + sectorFindings(ctx) + harvestFindings(ctx, trims: concentration) + lossHarvestFindings(ctx)
            + waitFindings(ctx, skip: trimmed) + fundamentalsFindings(ctx) + watchlistFindings(ctx) + laggardFindings(ctx) + incomeFindings(ctx) + dataFindings(ctx)
        let findings = all.enumerated().sorted { a, b in
            if a.element.severity.rank != b.element.severity.rank { return a.element.severity.rank < b.element.severity.rank }
            if a.element.impact != b.element.impact { return a.element.impact > b.element.impact }
            return a.offset < b.offset
        }.map(\.element)

        let row = ctx.baseline(ctx.fy).row
        let invested = ctx.priced.reduce(0) { $0 + $1.invested }
        let ranked = ctx.priced.enumerated().sorted { $0.element.value != $1.element.value ? $0.element.value > $1.element.value : $0.offset < $1.offset }.map(\.element)
        var snap = Snapshot()
        snap.fy = ctx.fy; snap.fyEnd = ctx.fyEnd; snap.daysToFyEnd = ctx.daysToFyEnd
        snap.value = money(ctx.total); snap.invested = money(invested); snap.unrealised = money(ctx.total - invested)
        snap.unrealisedPct = invested > 0 ? (ctx.total - invested) / invested * 100 : 0
        snap.heldCount = ctx.positions.count
        snap.largest = ranked.first.map { ($0.name, ctx.weight($0)) }
        snap.topFiveShare = ctx.total > 0 ? ranked.prefix(5).reduce(0) { $0 + $1.value } / ctx.total * 100 : 0
        snap.sectors = sectorWeights(ctx.active).rows.prefix(5).map { ($0.sector, $0.value, $0.pct) }
        snap.realisedShort = money(row?.grossShort ?? 0); snap.realisedLong = money(row?.grossLong ?? 0); snap.estimatedTax = money(row?.estimatedTax ?? 0)
        snap.exemption = CapitalGains.exemption(for: ctx.fy); snap.exemptionUsed = money(row?.exemptUsed ?? 0); snap.carriedLosses = money(carriedTotal(row))
        snap.pricesUpdatedAt = ctx.pricesUpdatedAt
        if let at = ctx.pricesUpdatedAt, let d = JSDate.parse(at) { snap.pricesAgeHours = max(0, (ctx.asOf.timeIntervalSince(d)) / 3600) }
        snap.pricesStale = snap.pricesAgeHours.map { $0 > Rules.stalePriceHours } ?? true
        snap.fundamentalsLoaded = ctx.priced.filter { symbolFor($0.stock).flatMap { ctx.fundamentals[$0] } != nil }.count
        snap.indexLoaded = ctx.indexCloses != nil

        var counts: [Severity: Int] = [.act: 0, .review: 0, .info: 0]
        findings.forEach { counts[$0.severity, default: 0] += 1 }
        return Analysis(asOf: ctx.today, findings: findings, counts: counts, snapshot: snap)
    }
}
