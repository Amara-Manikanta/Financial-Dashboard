import Foundation

/// Dividends as income — a port of `utils/dividendAnalytics.js` and
/// `utils/dividendTax.js`. Payout amounts are read from the transactions (the payout
/// sits in `price` with quantity 0); the `dividends` object on a stock is derived from
/// those same rows, so anything summing both would count every payout twice.
enum Dividends {
    private static func money(_ v: Double) -> Double { Money.round2(v) }
    private static let calendar = Calendar.current
    private static let monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

    private static func year(of value: JSONValue) -> Int? { JSDate.parse(value).map { calendar.component(.year, from: $0) } }
    private static func monthIndex(of value: JSONValue) -> Int? { JSDate.parse(value).map { calendar.component(.month, from: $0) - 1 } }

    // MARK: Gross, tax and net (dividendTax.js)

    struct Reading: Equatable {
        let date: String?
        let fy: String?
        let gross: Double
        let tds: Double
        let net: Double
        let hasTds: Bool
        var txId = ""
    }

    /// The recorded figure is read as gross unless the row says it is net — the way a
    /// company declares and a REIT statement prints. Rows with no `tds` are unchanged.
    static func read(_ tx: JSONValue) -> Reading {
        let recorded = tx["amount"].double != 0 ? tx["amount"].double : tx["price"].double
        let tds = max(0, tx["tds"].double)
        let isNet = tx["amountIsNet"].isTrue
        let gross = isNet ? recorded + tds : recorded
        let net = isNet ? recorded : recorded - tds
        return Reading(date: tx["date"].truthy ? tx["date"].text : nil, fy: CapitalGains.fyFor(tx["date"]),
                       gross: money(gross), tds: money(tds), net: money(net), hasTds: tds > 0, txId: tx["id"].text)
    }

    private static func payout(_ tx: JSONValue) -> Double { read(tx).gross }
    private static func dividendRows(_ stock: JSONValue) -> [JSONValue] { stock["transactions"].array.filter { $0["type"].text == "dividend" } }

    // MARK: Tax withheld

    static func thresholdFor(_ fy: String) -> Double { (Int(fy.prefix(4)) ?? 0) >= 2025 ? 10_000 : 5_000 }

    /// REITs and InvITs, matched on the name as whole words: nothing in the record says so.
    static func isTrustUnit(_ holding: JSONValue) -> Bool {
        let t = "\(holding["name"].text) \(holding["ticker"].text)".lowercased()
        return t.range(of: "\\b(reit|riet|invit|inv-it)\\b", options: .regularExpression) != nil
    }

    struct TaxRow: Identifiable, Equatable {
        var id: String { "\(holdingId)::\(fy)" }
        let holdingId: String
        let name: String
        let ticker: String
        let fy: String
        let isTrust: Bool
        var gross = 0.0, tds = 0.0, net = 0.0
        var payments = 0
        var threshold = 0.0
        var expectsTds = false
        /// Expected but nothing recorded: either a payout below the line or a deduction nobody entered.
        var missingTds = false
        var headroom: Double?
        var effectiveRate: Double { gross > 0 ? tds / gross * 100 : 0 }
    }

    /// Per company, per financial year: what was paid, what was withheld, and whether
    /// withholding should have been expected. A trust withholds from the first rupee;
    /// an ordinary company only above the threshold.
    static func taxRows(_ holdings: [JSONValue]) -> [TaxRow] {
        var order: [String] = []
        var rows: [String: TaxRow] = [:]
        for h in holdings where !h.isNull {
            let trust = isTrustUnit(h)
            for tx in dividendRows(h) {
                let d = read(tx)
                guard let fy = d.fy else { continue }
                let key = "\(h["id"].text)::\(fy)"
                if rows[key] == nil {
                    order.append(key)
                    rows[key] = TaxRow(holdingId: h["id"].text, name: [h["name"], h["ticker"]].first { $0.truthy }?.text ?? "Unnamed",
                                       ticker: h["ticker"].text, fy: fy, isTrust: trust)
                }
                rows[key]!.gross = money(rows[key]!.gross + d.gross)
                rows[key]!.tds = money(rows[key]!.tds + d.tds)
                rows[key]!.net = money(rows[key]!.net + d.net)
                rows[key]!.payments += 1
            }
        }
        let built: [TaxRow] = order.map { key in
            var r = rows[key]!
            r.threshold = thresholdFor(r.fy)
            r.expectsTds = r.isTrust ? true : r.gross > r.threshold
            r.missingTds = r.expectsTds && r.tds == 0
            r.headroom = r.isTrust ? nil : money(max(0, r.threshold - r.gross))
            return r
        }
        return built.enumerated().sorted { a, b in
            if a.element.fy != b.element.fy { return a.element.fy > b.element.fy }
            if a.element.gross != b.element.gross { return a.element.gross > b.element.gross }
            return a.offset < b.offset
        }.map(\.element)
    }

    struct TaxYear: Equatable {
        var fy: String
        var gross = 0.0, tds = 0.0, net = 0.0
        var payments = 0, companies = 0, missing = 0
        var effectiveRate: Double { gross > 0 ? tds / gross * 100 : 0 }
    }

    struct TaxSummary: Equatable {
        var rows: [TaxRow] = []
        var years: [TaxYear] = []
        var currentFy = ""
        var thisYear: TaxYear?
        var lifetimeGross = 0.0, lifetimeTds = 0.0, lifetimeNet = 0.0
        var needsChecking: [TaxRow] = []
        /// Under threshold this year but close enough that a further payout crosses it.
        var approaching: [TaxRow] = []
        var trustHoldings: [String] = []
    }

    static func taxSummary(_ holdings: [JSONValue], now: Date = Date()) -> TaxSummary {
        let rows = taxRows(holdings)
        var byFy: [String: TaxYear] = [:]
        var fyOrder: [String] = []
        for r in rows {
            if byFy[r.fy] == nil { byFy[r.fy] = TaxYear(fy: r.fy); fyOrder.append(r.fy) }
            byFy[r.fy]!.gross = money(byFy[r.fy]!.gross + r.gross)
            byFy[r.fy]!.tds = money(byFy[r.fy]!.tds + r.tds)
            byFy[r.fy]!.net = money(byFy[r.fy]!.net + r.net)
            byFy[r.fy]!.payments += r.payments
            byFy[r.fy]!.companies += 1
            if r.missingTds { byFy[r.fy]!.missing += 1 }
        }
        let years = fyOrder.map { byFy[$0]! }.enumerated().sorted { $0.element.fy != $1.element.fy ? $0.element.fy > $1.element.fy : $0.offset < $1.offset }.map(\.element)
        let current = CapitalGains.fyFor(now)
        var trusts: [String] = []
        for r in rows where r.isTrust && !trusts.contains(r.name) { trusts.append(r.name) }
        return TaxSummary(
            rows: rows, years: years, currentFy: current, thisYear: years.first { $0.fy == current },
            lifetimeGross: money(rows.reduce(0) { $0 + $1.gross }), lifetimeTds: money(rows.reduce(0) { $0 + $1.tds }),
            lifetimeNet: money(rows.reduce(0) { $0 + $1.net }),
            needsChecking: rows.filter(\.missingTds),
            approaching: rows.filter { $0.fy == current && !$0.isTrust && !$0.expectsTds && ($0.headroom ?? .infinity) < $0.threshold * 0.4 },
            trustHoldings: trusts)
    }

    // MARK: Yield and consistency (dividendAnalytics.js)

    private static func investedIn(_ stock: JSONValue) -> Double {
        stock["transactions"].array.reduce(0) { sum, tx in
            guard ["buy", "ipo"].contains(tx["type"].text) else { return sum }
            let units = [tx["quantity"], tx["shares"]].first { !$0.isNull }?.double ?? 0
            return sum + (tx["amount"].double != 0 ? tx["amount"].double : units * tx["price"].double)
        }
    }

    struct Profile: Identifiable, Equatable {
        let id: String
        let name: String
        let shares: Double
        let held: Bool
        let invested: Double
        let total: Double
        /// Dividends against what YOU paid, not the yield a broker quotes on today's price.
        let pct: Double
        let everPaid: Bool
        let payments: Int
        let paidYears: Int
        let spanYears: Int
        let consistency: Double
        let lastPaid: String?
        let yearsSinceLast: Int?
        let lapsed: Bool
        let byYear: [String: Double]
    }

    static func profile(_ stock: JSONValue, now: Date = Date()) -> Profile {
        let invested = investedIn(stock)
        let rows = dividendRows(stock)
        let total = rows.reduce(0) { $0 + payout($1) }
        let name = [stock["name"], stock["ticker"]].first { $0.truthy }?.text ?? "Unnamed"
        let shares = stock["shares"].double
        func make(_ paid: Bool, _ payments: Int, _ paidYears: Int, _ span: Int, _ cons: Double, _ last: String?, _ since: Int?, _ lapsed: Bool, _ byYear: [String: Double]) -> Profile {
            Profile(id: stock["id"].text, name: name, shares: shares, held: shares > 0, invested: money(invested), total: money(total),
                    pct: invested > 0 ? total / invested * 100 : 0, everPaid: paid, payments: payments, paidYears: paidYears, spanYears: span,
                    consistency: cons, lastPaid: last, yearsSinceLast: since, lapsed: lapsed, byYear: byYear)
        }
        if rows.isEmpty { return make(false, 0, 0, 0, 0, nil, nil, false, [:]) }

        var byYear: [String: Double] = [:]
        for t in rows { if let y = year(of: t["date"]) { byYear[String(y), default: 0] = money((byYear[String(y)] ?? 0) + payout(t)) } }
        let years = byYear.keys.compactMap(Int.init).sorted()
        let thisYear = calendar.component(.year, from: now)
        let span = max(1, thisYear - (years.first ?? thisYear) + 1)
        let lastPaid = rows.map { $0["date"].text }.sorted().last
        let since = lastPaid.flatMap { year(of: .string($0)) }.map { thisYear - $0 }
        return make(true, rows.count, years.count, span, Double(years.count) / Double(span) * 100, lastPaid, since, (since ?? 0) >= 2, byYear)
    }

    /// Every dividend payer (not archived), best yield on cost first.
    static func payers(_ stocks: [JSONValue], now: Date = Date()) -> [Profile] {
        stocks.filter { !$0.isNull && !$0["isArchived"].truthy }.map { profile($0, now: now) }.filter(\.everPaid)
            .enumerated().sorted { $0.element.pct != $1.element.pct ? $0.element.pct > $1.element.pct : $0.offset < $1.offset }.map(\.element)
    }

    /// Payers still held that have gone quiet for two calendar years or more.
    static func lapsed(_ stocks: [JSONValue], now: Date = Date()) -> [Profile] { payers(stocks, now: now).filter { $0.lapsed && $0.held } }

    // MARK: Income by time

    struct YearAmount: Equatable { let year: String; let amount: Double }
    struct MonthAmount: Equatable, Identifiable { let month: String; var amount: Double; var payments: Int; var id: String { month } }

    /// Archived holdings are included: the cash arrived, whatever you did later.
    static func incomeByYear(_ stocks: [JSONValue]) -> [YearAmount] {
        var years: [String: Double] = [:]
        for s in stocks { for t in dividendRows(s) { if let y = year(of: t["date"]) { years[String(y), default: 0] += payout(t) } } }
        return years.map { YearAmount(year: $0.key, amount: money($0.value)) }.sorted { $0.year < $1.year }
    }

    /// Every month present, even the silent ones: dividend income is lumpy, and a chart
    /// that omits them makes it look like a salary.
    static func incomeByMonth(_ stocks: [JSONValue], year target: String) -> [MonthAmount] {
        var totals = monthNames.map { MonthAmount(month: $0, amount: 0, payments: 0) }
        for s in stocks {
            for t in dividendRows(s) {
                guard let d = JSDate.parse(t["date"]), String(calendar.component(.year, from: d)) == target else { continue }
                let m = calendar.component(.month, from: d) - 1
                totals[m].amount = money(totals[m].amount + payout(t))
                totals[m].payments += 1
            }
        }
        return totals
    }

    struct IncomeSummary: Equatable {
        var lifetime = 0.0, thisYear = 0.0
        var bestYear: YearAmount?
        var payerCount = 0, lapsedCount = 0
        var portfolioYieldOnCost = 0.0
        var years: [YearAmount] = []
    }

    static func incomeSummary(_ stocks: [JSONValue], now: Date = Date()) -> IncomeSummary {
        let years = incomeByYear(stocks)
        let thisYear = String(calendar.component(.year, from: now))
        let lifetime = money(years.reduce(0) { $0 + $1.amount })
        let list = payers(stocks, now: now)
        let invested = list.reduce(0) { $0 + $1.invested }
        // The best full year on record: a part-year compared with complete ones would understate it every January.
        let best = years.filter { $0.year != thisYear }.enumerated().sorted { $0.element.amount != $1.element.amount ? $0.element.amount > $1.element.amount : $0.offset < $1.offset }.first?.element
        return IncomeSummary(lifetime: lifetime, thisYear: money(years.first { $0.year == thisYear }?.amount ?? 0), bestYear: best,
                             payerCount: list.count, lapsedCount: list.filter { $0.lapsed && $0.held }.count,
                             portfolioYieldOnCost: invested > 0 ? lifetime / invested * 100 : 0, years: years)
    }

    // MARK: When dividends arrive

    struct PayoutMonth: Equatable { let month: Int; let payments: Int; let total: Double; let years: Int; let averagePerYear: Double }

    /// The months a holding has historically paid in. A description of history: a payout is
    /// declared by a board, so no amount is projected forward.
    static func payoutMonths(_ stock: JSONValue) -> [PayoutMonth] {
        var count: [Int: Int] = [:], total: [Int: Double] = [:], years: [Int: Set<String>] = [:]
        for t in dividendRows(stock) {
            guard let d = JSDate.parse(t["date"]) else { continue }
            let m = calendar.component(.month, from: d) - 1
            count[m, default: 0] += 1
            total[m] = money((total[m] ?? 0) + payout(t))
            years[m, default: []].insert(String(calendar.component(.year, from: d)))
        }
        return count.keys.sorted().map { m in
            PayoutMonth(month: m, payments: count[m]!, total: total[m]!, years: years[m]!.count, averagePerYear: money(total[m]! / Double(years[m]!.count)))
        }
    }

    struct CalendarPayer: Equatable { let id: String; let name: String; let held: Bool; let averagePerYear: Double; let years: Int; let payments: Int }
    struct CalendarMonth: Identifiable, Equatable {
        let month: Int
        let name: String
        var payers: [CalendarPayer] = []
        var typicalTotal = 0.0
        var payments = 0
        var id: Int { month }
    }

    static func calendarMonths(_ stocks: [JSONValue]) -> [CalendarMonth] {
        var months = monthNames.enumerated().map { CalendarMonth(month: $0.offset, name: $0.element) }
        for s in stocks where !s.isNull && !s["isArchived"].truthy {
            let held = s["shares"].double > 0
            for m in payoutMonths(s) {
                months[m.month].payers.append(CalendarPayer(id: s["id"].text, name: [s["name"], s["ticker"]].first { $0.truthy }?.text ?? "",
                                                            held: held, averagePerYear: m.averagePerYear, years: m.years, payments: m.payments))
                months[m.month].typicalTotal = money(months[m.month].typicalTotal + m.averagePerYear)
                months[m.month].payments += m.payments
            }
        }
        for i in months.indices {
            months[i].payers = months[i].payers.enumerated().sorted { $0.element.averagePerYear != $1.element.averagePerYear ? $0.element.averagePerYear > $1.element.averagePerYear : $0.offset < $1.offset }.map(\.element)
        }
        return months
    }

    static func busiestMonths(_ stocks: [JSONValue]) -> [CalendarMonth] {
        calendarMonths(stocks).filter { $0.payments > 0 }
            .enumerated().sorted { $0.element.typicalTotal != $1.element.typicalTotal ? $0.element.typicalTotal > $1.element.typicalTotal : $0.offset < $1.offset }.map(\.element)
    }
}

/// The Dividend Income page, on your own stocks in the open account.
enum DividendPage {
    struct Treemap: Identifiable, Equatable { let name: String; let ticker: String; let value: Double; var id: String { ticker + name } }

    struct Page: Equatable {
        var summary = Dividends.IncomeSummary()
        var payers: [Dividends.Profile] = []
        var lapsed: [Dividends.Profile] = []
        var calendar: [Dividends.CalendarMonth] = []
        var busiest: [Dividends.CalendarMonth] = []
        var tax = Dividends.TaxSummary()
        var shares: [Treemap] = []
        var stocks: [JSONValue] = []
        static func == (a: Page, b: Page) -> Bool { a.summary == b.summary && a.payers == b.payers && a.tax == b.tax }
    }

    static func page(savings: JSONValue, asOf: Date = Date()) -> Page {
        let market = savings.array.first { $0["type"].text == "stock_market" && !$0["isArchived"].truthy } ?? .null
        let stocks = market["stocks"].array.filter(Stocks.isOwn)
        let shares = stocks.map { s in
            Treemap(name: s["name"].text, ticker: [s["ticker"], s["symbol"], s["name"]].first { $0.truthy }?.text ?? "",
                    value: s["dividends"].object.values.reduce(0) { $0 + $1.double })
        }.filter { $0.value > 0 }.enumerated().sorted { $0.element.value != $1.element.value ? $0.element.value > $1.element.value : $0.offset < $1.offset }.map(\.element)
        return Page(summary: Dividends.incomeSummary(stocks, now: asOf), payers: Dividends.payers(stocks, now: asOf), lapsed: Dividends.lapsed(stocks, now: asOf),
                    calendar: Dividends.calendarMonths(stocks), busiest: Dividends.busiestMonths(stocks), tax: Dividends.taxSummary(stocks, now: asOf),
                    shares: shares, stocks: stocks)
    }
}

/// How much of a holding's cost has already come back out of it — a port of
/// `utils/costRecovery.js`. Cash in, cash out: nothing is marked to market, because the
/// point is what has actually been recovered. Average cost cannot say "is any of my own
/// money still at risk here?", because it keeps every remaining share at its original price.
enum CostRecovery {
    private static func money(_ v: Double) -> Double { Money.round2(v) }
    private static func qty(_ tx: JSONValue) -> Double { [tx["quantity"], tx["shares"]].first { !$0.isNull }?.double ?? 0 }
    private static func cash(_ tx: JSONValue) -> Double { tx["amount"].double != 0 ? tx["amount"].double : qty(tx) * tx["price"].double }

    static let nearlyFreeFrom = 75.0

    struct Recovery: Identifiable, Equatable {
        let id: String
        let name: String
        let invested: Double
        let salesProceeds: Double
        let dividends: Double
        let recovered: Double
        let outstandingCost: Double
        let recoveredPct: Double
        let rawPct: Double
        let surplus: Double
        let shares: Double
        let value: Double
        let bonusShares: Double
        let receivedShares: Double
        let allocatedBasis: Double
        /// Nothing was ever paid for this holding — it arrived by demerger or bonus — so it
        /// has no cost to recover and sits outside the ranking rather than at 0% or 100%.
        let cashless: Bool
        let held: Bool
        let isFree: Bool
        let netCostPerShare: Double
    }

    static func recovery(_ stock: JSONValue) -> Recovery {
        let txs = stock["transactions"].array
        // Dividends come from the replay, not from the stored `dividends` object: that is
        // derived from the same rows, so counting both would double every payout.
        let replay = Stocks.replay(txs)
        var invested = 0.0, sales = 0.0, bonus = 0.0, received = 0.0, basis = 0.0
        for tx in txs {
            switch tx["type"].text {
            case "buy", "ipo": invested += cash(tx)
            case "sell", "buyback": sales += cash(tx)
            case "bonus": bonus += qty(tx); received += qty(tx)
            case "merger_in": invested += cash(tx)
            case "merger_out": invested = max(0, invested - cash(tx))      // that cost now sits in the acquirer
            case "demerger": received += qty(tx); basis += qty(tx) * tx["price"].double   // no cash, but not free either
            default: break
            }
        }
        let dividends = replay.dividends.values.reduce(0, +)
        let recovered = sales + dividends
        let shares = stock["shares"].double
        let value = shares * stock["currentPrice"].double
        let outstanding = invested - recovered
        return Recovery(
            id: stock["id"].text, name: [stock["name"], stock["ticker"]].first { $0.truthy }?.text ?? "Unnamed",
            invested: money(invested), salesProceeds: money(sales), dividends: money(dividends), recovered: money(recovered),
            outstandingCost: money(outstanding), recoveredPct: invested > 0 ? min(100, recovered / invested * 100) : 0,
            rawPct: invested > 0 ? recovered / invested * 100 : 0, surplus: money(max(0, -outstanding)), shares: shares, value: money(value),
            bonusShares: bonus, receivedShares: received, allocatedBasis: money(basis),
            cashless: invested == 0 && shares > 0 && received > 0, held: shares > 0,
            isFree: invested > 0 && recovered >= invested && shares > 0,
            netCostPerShare: shares > 0 ? money(max(0, outstanding) / shares) : 0)
    }

    private static func live(_ stocks: [JSONValue]) -> [JSONValue] { stocks.filter { !$0.isNull && !$0["isArchived"].truthy } }

    /// Positions still held that were bought with cash, ranked by how much of their cost is back.
    static func ranking(_ stocks: [JSONValue]) -> [Recovery] {
        live(stocks).map(recovery).filter { $0.held && $0.invested > 0 }
            .enumerated().sorted { $0.element.rawPct != $1.element.rawPct ? $0.element.rawPct > $1.element.rawPct : $0.offset < $1.offset }.map(\.element)
    }

    /// Holdings that arrived without a payment — kept visible rather than vanishing from the ranking.
    static func cashlessHoldings(_ stocks: [JSONValue]) -> [Recovery] {
        live(stocks).map(recovery).filter(\.cashless)
            .enumerated().sorted { $0.element.value != $1.element.value ? $0.element.value > $1.element.value : $0.offset < $1.offset }.map(\.element)
    }

    static func freePositions(_ stocks: [JSONValue]) -> [Recovery] { ranking(stocks).filter(\.isFree) }
    static func nearlyFree(_ stocks: [JSONValue]) -> [Recovery] { ranking(stocks).filter { !$0.isFree && $0.rawPct >= nearlyFreeFrom } }

    struct Totals: Equatable {
        var invested = 0.0, recovered = 0.0, stillAtRisk = 0.0, freeValue = 0.0, bonusShares = 0.0
        var freeCount = 0
    }

    static func totals(_ stocks: [JSONValue]) -> Totals {
        let held = ranking(stocks), free = held.filter(\.isFree)
        return Totals(invested: money(held.reduce(0) { $0 + $1.invested }), recovered: money(held.reduce(0) { $0 + $1.recovered }),
                      stillAtRisk: money(held.reduce(0) { $0 + max(0, $1.outstandingCost) }), freeValue: money(free.reduce(0) { $0 + $1.value }),
                      bonusShares: held.reduce(0) { $0 + $1.bonusShares }, freeCount: free.count)
    }
}

enum FreeHoldingsPage {
    struct Page: Equatable {
        var free: [CostRecovery.Recovery] = []
        var almost: [CostRecovery.Recovery] = []
        var all: [CostRecovery.Recovery] = []
        var cashless: [CostRecovery.Recovery] = []
        var totals = CostRecovery.Totals()
        var recoveredPctOfPortfolio: Double { totals.invested > 0 ? totals.recovered / totals.invested * 100 : 0 }
    }

    static func page(savings: JSONValue) -> Page {
        let market = savings.array.first { $0["type"].text == "stock_market" && !$0["isArchived"].truthy } ?? .null
        let stocks = market["stocks"].array.filter(Stocks.isOwn)
        return Page(free: CostRecovery.freePositions(stocks), almost: CostRecovery.nearlyFree(stocks), all: CostRecovery.ranking(stocks),
                    cashless: CostRecovery.cashlessHoldings(stocks), totals: CostRecovery.totals(stocks))
    }
}
