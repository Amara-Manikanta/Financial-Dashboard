import Foundation

/// Capital gains matched lot by lot (first in, first out) — a port of
/// `src/utils/capitalGains.js`. The rules and the reasons for them are
/// documented there: FIFO across buy / IPO / bonus / demerger lots, splits that
/// restate open lots, the twelve-month line per lot, the 23 July 2024 rate
/// change, the s.112A exemption, set-off and eight-year carry-forward, and
/// buybacks after 1 October 2024 taxed as dividend. It is a working estimate
/// from your own records, not a tax return.
enum CapitalGains {
    private static let rateChange = "2024-07-23"
    private static let buybackAsDividend = "2024-10-01"
    private static let carryForwardYears = 8
    private static let dayMs = 86_400_000.0
    private static let epsilon = 0.0000001
    private static let acquisitions = ["buy", "ipo", "bonus", "demerger"]
    private static let disposalTypes = ["sell", "buyback"]

    private static func money(_ v: Double) -> Double { Money.round2(v) }

    // MARK: Dates

    private static var localCalendar: Calendar { Calendar.current }
    private static let utc: Calendar = { var c = Calendar(identifier: .gregorian); c.timeZone = TimeZone(identifier: "UTC")!; return c }()

    /// Indian financial year, April to March, as `2026-27`.
    static func fyFor(_ date: Date) -> String {
        let c = localCalendar.dateComponents([.year, .month], from: date)
        let year = c.year ?? 0
        let start = (c.month ?? 1) - 1 >= 3 ? year : year - 1
        return String(format: "%d-%02d", start, (start + 1) % 100)
    }

    static func fyFor(_ value: JSONValue) -> String? { JSDate.parse(value).map(fyFor) }

    static func fyOrder(_ fy: String) -> Int { Int(fy.prefix(4)) ?? 0 }

    /// The same instant a year later, in local time — JavaScript's `setFullYear(+1)`,
    /// which rolls 29 February into 1 March.
    private static func anniversary(of date: Date) -> Date {
        var c = localCalendar.dateComponents([.year, .month, .day, .hour, .minute, .second, .nanosecond], from: date)
        let year = (c.year ?? 0) + 1
        c.year = year
        let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
        if c.month == 2 && c.day == 29 && !leap { c.month = 3; c.day = 1 }
        return localCalendar.date(from: c) ?? date
    }

    /// Long term when MORE than twelve months separate purchase and sale: a lot
    /// bought on 29 February and sold the next 28 February has not completed a year.
    static func isLongTerm(_ bought: Date, _ sold: Date) -> Bool { sold > anniversary(of: bought) }

    static func isLongTerm(_ bought: String, _ sold: String) -> Bool {
        guard let b = JSDate.parse(bought), let s = JSDate.parse(sold) else { return false }
        return isLongTerm(b, s)
    }

    /// The first date a sale of this lot is long term: the day AFTER the anniversary.
    static func longTermFrom(_ bought: String) -> String? {
        guard let b = JSDate.parse(bought) else { return nil }
        let next = anniversary(of: b).addingTimeInterval(dayMs / 1000)
        let c = utc.dateComponents([.year, .month, .day], from: next)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// A moment reduced to the calendar day it falls on locally, read as midnight UTC —
    /// a sale is dated, not timed.
    static func calendarDay(_ moment: Date) -> Date {
        let c = localCalendar.dateComponents([.year, .month, .day], from: moment)
        return utc.date(from: DateComponents(year: c.year, month: c.month, day: c.day)) ?? moment
    }

    // MARK: Rates

    private static func rates(saleDate: String) -> (short: Double, long: Double) {
        saleDate >= rateChange ? (0.20, 0.125) : (0.15, 0.10)
    }

    /// The s.112A exemption for a financial year.
    static func exemption(for fy: String) -> Double { fyOrder(fy) >= 2024 ? 125_000 : 100_000 }

    // MARK: Lots and disposals

    struct Lot: Equatable {
        var date: String
        var quantity: Double
        var costPerShare: Double
        var source: String
        var txId: String
    }

    struct Disposal: Equatable {
        let holding: String
        let holdingId: String
        let txId: String
        let type: String
        let acquiredOn: String
        let acquiredAs: String
        let soldOn: String
        let quantity: Double
        let costPerShare: Double
        let salePerShare: Double
        let cost: Double
        let proceeds: Double
        let gain: Double
        let isLong: Bool
        let fy: String
        let dividendIncome: Double
        let treatedAsDividend: Bool
        var term: String { isLong ? "long" : "short" }
    }

    struct Unmatched: Equatable { let holding: String; let holdingId: String; let txId: String; let soldOn: String; let quantity: Double }

    struct Matched: Equatable { var disposals: [Disposal] = []; var openLots: [Lot] = []; var unmatched: [Unmatched] = [] }

    /// Units on a row, however it spells them: `quantity ?? shares ?? units`.
    private static func qty(_ tx: JSONValue) -> Double {
        [tx["quantity"], tx["shares"], tx["units"]].first { !$0.isNull }?.double ?? 0
    }

    private static func price(_ tx: JSONValue) -> Double {
        let q = qty(tx)
        if tx["amount"].double != 0 && q != 0 { return tx["amount"].double / q }
        return [tx["price"], tx["nav"]].first { !$0.isNull }?.double ?? 0
    }

    private static func lotsSorted(_ lots: inout [Lot]) {
        lots = lots.enumerated().sorted { a, b in a.element.date == b.element.date ? a.offset < b.offset : a.element.date < b.element.date }.map(\.element)
    }

    static func matchLots(_ transactions: JSONValue, name: String = "", id: String = "") -> Matched {
        // Date order; on one day an acquisition lands before a disposal, or an IPO
        // allotment sold on listing day would have nothing to match against.
        func rank(_ t: JSONValue) -> Int { acquisitions.contains(t["type"].text) || t["type"].text == "merger_in" ? 0 : 1 }
        let ordered = transactions.array.enumerated()
            .filter { !$0.element.isNull && $0.element["date"].truthy }
            .sorted { a, b in
                let da = a.element["date"].text, db = b.element["date"].text
                if da != db { return da < db }
                let ra = rank(a.element), rb = rank(b.element)
                return ra != rb ? ra < rb : a.offset < b.offset
            }.map(\.element)

        var lots: [Lot] = []
        var out = Matched()

        for tx in ordered {
            let type = tx["type"].text.lowercased()

            if type == "split" {
                let from = tx["splitFrom"].double != 0 ? tx["splitFrom"].double : 1
                let to = tx["splitTo"].double != 0 ? tx["splitTo"].double : 1
                if from > 0 && to > 0 && from != to {
                    let factor = to / from
                    for i in lots.indices { lots[i].quantity *= factor; lots[i].costPerShare /= factor }
                }
                continue
            }

            if type == "merger_in" {
                // Shares received in a merger keep the cost and date of those given up.
                let given = tx["lots"].array
                let carried: [JSONValue] = !given.isEmpty ? given
                    : [.object(["date": tx["date"], "quantity": .number(qty(tx)), "costPerShare": .number(price(tx))])]
                for l in carried where l["quantity"].double > 0 {
                    lots.append(Lot(date: l["date"].truthy ? l["date"].text : tx["date"].text, quantity: l["quantity"].double,
                                    costPerShare: l["costPerShare"].double, source: "merger", txId: tx["id"].text))
                }
                lotsSorted(&lots)
                continue
            }

            if type == "merger_out" {
                var remaining = qty(tx)
                while remaining > epsilon && !lots.isEmpty {
                    let take = min(remaining, lots[0].quantity)
                    lots[0].quantity -= take
                    remaining -= take
                    if lots[0].quantity <= epsilon { lots.removeFirst() }
                }
                continue
            }

            if acquisitions.contains(type) {
                let q = qty(tx)
                if q <= 0 { continue }
                // A bonus share costs nothing, and its holding period starts on allotment.
                lots.append(Lot(date: tx["date"].text, quantity: q, costPerShare: type == "bonus" ? 0 : price(tx), source: type, txId: tx["id"].text))
                continue
            }

            guard disposalTypes.contains(type) else { continue }
            var remaining = qty(tx)
            if remaining <= 0 { continue }
            let perShare = price(tx)
            // A buyback after 1 Oct 2024 is dividend income, and the shares' cost a capital loss.
            let asDividend = type == "buyback" && tx["date"].text >= buybackAsDividend

            while remaining > epsilon && !lots.isEmpty {
                let take = min(remaining, lots[0].quantity)
                let cost = take * lots[0].costPerShare
                let proceeds = asDividend ? 0 : take * perShare
                let long = isLongTerm(lots[0].date, tx["date"].text)
                out.disposals.append(Disposal(
                    holding: name, holdingId: id, txId: tx["id"].text, type: type, acquiredOn: lots[0].date, acquiredAs: lots[0].source,
                    soldOn: tx["date"].text, quantity: money(take), costPerShare: money(lots[0].costPerShare),
                    salePerShare: money(asDividend ? 0 : perShare), cost: money(cost), proceeds: money(proceeds),
                    gain: money(proceeds - cost), isLong: long, fy: fyFor(tx["date"]) ?? "",
                    dividendIncome: asDividend ? money(take * perShare) : 0, treatedAsDividend: asDividend))
                lots[0].quantity -= take
                remaining -= take
                if lots[0].quantity <= epsilon { lots.removeFirst() }
            }

            if remaining > epsilon {
                out.unmatched.append(Unmatched(holding: name, holdingId: id, txId: tx["id"].text, soldOn: tx["date"].text, quantity: money(remaining)))
            }
        }
        out.openLots = lots.map { Lot(date: $0.date, quantity: money($0.quantity), costPerShare: money($0.costPerShare), source: $0.source, txId: $0.txId) }
        return out
    }

    /// Every stock matched. Archived holdings are included: the sale happened.
    static func disposals(forStocks stocks: [JSONValue]) -> (disposals: [Disposal], unmatched: [Unmatched]) {
        var all: [Disposal] = []
        var unmatched: [Unmatched] = []
        for s in stocks where !s.isNull {
            let name = [s["name"], s["ticker"]].first { $0.truthy }?.text ?? "Unnamed"
            let r = matchLots(s["transactions"], name: name, id: s["id"].text)
            all += r.disposals
            unmatched += r.unmatched
        }
        // Newest sale first; ties keep their order.
        let sorted = all.enumerated().sorted { a, b in a.element.soldOn == b.element.soldOn ? a.offset < b.offset : a.element.soldOn > b.element.soldOn }.map(\.element)
        return (sorted, unmatched)
    }

    // MARK: The ledger

    struct YearSummary: Equatable {
        var fy: String
        var short = 0.0, long = 0.0, buybackDividend = 0.0, proceeds = 0.0, cost = 0.0
        var disposalCount = 0
    }

    static func summariseYear(_ disposals: [Disposal], fy: String) -> YearSummary {
        let rows = disposals.filter { $0.fy == fy && !$0.treatedAsDividend }
        let dividendRows = disposals.filter { $0.fy == fy && $0.treatedAsDividend }
        let shortGross = rows.filter { $0.term == "short" }.reduce(0) { $0 + $1.gain }
        let longGross = rows.filter { $0.term == "long" }.reduce(0) { $0 + $1.gain }
        // A buyback's cost is a capital loss of the lot's own term.
        let shortLoss = dividendRows.filter { $0.term == "short" }.reduce(0) { $0 - $1.cost }
        let longLoss = dividendRows.filter { $0.term == "long" }.reduce(0) { $0 - $1.cost }
        return YearSummary(fy: fy, short: money(shortGross + shortLoss), long: money(longGross + longLoss),
                           buybackDividend: money(dividendRows.reduce(0) { $0 + $1.dividendIncome }),
                           proceeds: money(rows.reduce(0) { $0 + $1.proceeds }), cost: money(rows.reduce(0) { $0 + $1.cost }),
                           disposalCount: rows.count + dividendRows.count)
    }

    struct Carried: Equatable { var fy: String; var amount: Double; var expiresAfter: String { Self.label(fyOrder(fy) + carryForwardYears) }
        static func label(_ year: Int) -> String { String(format: "%d-%02d", year, (year + 1) % 100) } }

    struct LedgerYear: Equatable {
        var fy: String
        var grossShort = 0.0, grossLong = 0.0
        var openingCarriedShort = 0.0, openingCarriedLong = 0.0
        var setOffCurrentShortLossAgainstLong = 0.0, setOffShortAgainstShort = 0.0, setOffShortAgainstLong = 0.0, setOffLongAgainstLong = 0.0
        var netShort = 0.0, netLong = 0.0
        var exemption = 0.0, exemptUsed = 0.0
        var taxableShort = 0.0, taxableLong = 0.0
        var shortRate = 0.0, longRate = 0.0
        var estimatedTax = 0.0, buybackDividend = 0.0
        var disposalCount = 0
        var proceeds = 0.0, cost = 0.0, lapsed = 0.0
        var closingCarriedShort = 0.0, closingCarriedLong = 0.0
    }

    struct Ledger: Equatable {
        var years: [LedgerYear] = []
        var carriedShort: [Carried] = []
        var carriedLong: [Carried] = []
        var totalRealised = 0.0, totalShort = 0.0, totalLong = 0.0, totalTax = 0.0
        var totalDisposals = 0
    }

    /// Year by year, carrying losses forward. Losses expire after eight assessment
    /// years; tracking them by the year they arose is the only way to know which
    /// part is about to lapse.
    static func ledger(_ disposals: [Disposal]) -> Ledger {
        let years = Array(Set(disposals.map(\.fy).filter { !$0.isEmpty })).sorted()
        guard let firstFy = years.first, let lastFy = years.last else { return Ledger() }

        var carriedShort: [Carried] = []
        var carriedLong: [Carried] = []
        var rows: [LedgerYear] = []

        func total(_ pool: [Carried]) -> Double { pool.reduce(0) { $0 + $1.amount } }
        func consume(_ pool: [Carried], _ amount: Double) -> (pool: [Carried], used: Double) {
            var left = amount
            var next: [Carried] = []
            for entry in pool {
                if left <= 0 { next.append(entry); continue }
                let used = min(entry.amount, left)
                left -= used
                let rest = entry.amount - used
                if rest > 0.005 { next.append(Carried(fy: entry.fy, amount: money(rest))) }
            }
            return (next, money(amount - left))
        }

        for y in fyOrder(firstFy)...fyOrder(lastFy) {
            let fy = String(format: "%d-%02d", y, (y + 1) % 100)
            let s = summariseYear(disposals, fy: fy)
            let openingShort = total(carriedShort), openingLong = total(carriedLong)

            // A loss can be set off in the eight years after the one it arose in, and not a ninth.
            let cutoff = fyOrder(fy) - carryForwardYears
            let lapsedShort = carriedShort.filter { fyOrder($0.fy) < cutoff }
            let lapsedLong = carriedLong.filter { fyOrder($0.fy) < cutoff }
            carriedShort = carriedShort.filter { fyOrder($0.fy) >= cutoff }
            carriedLong = carriedLong.filter { fyOrder($0.fy) >= cutoff }
            let availableShort = total(carriedShort), availableLong = total(carriedLong)

            var netShort = s.short, netLong = s.long

            // A short-term loss meets this year's long-term gain first; the rest is carried.
            var setOffAgainstLong = 0.0
            if netShort < 0 && netLong > 0 {
                setOffAgainstLong = min(-netShort, netLong)
                netShort = money(netShort + setOffAgainstLong)
                netLong = money(netLong - setOffAgainstLong)
            }
            let currentShortLoss = netShort < 0 ? -netShort : 0
            let currentLongLoss = netLong < 0 ? -netLong : 0
            if netShort < 0 { netShort = 0 }
            if netLong < 0 { netLong = 0 }

            let shortOnShort = consume(carriedShort, min(availableShort, netShort))
            carriedShort = shortOnShort.pool
            netShort = money(netShort - shortOnShort.used)

            let shortLeft = total(carriedShort)
            let shortOnLong = consume(carriedShort, min(shortLeft, netLong))
            carriedShort = shortOnLong.pool
            netLong = money(netLong - shortOnLong.used)

            let longOnLong = consume(carriedLong, min(availableLong, netLong))
            carriedLong = longOnLong.pool
            netLong = money(netLong - longOnLong.used)

            if currentShortLoss > 0 { carriedShort.append(Carried(fy: fy, amount: money(currentShortLoss))) }
            if currentLongLoss > 0 { carriedLong.append(Carried(fy: fy, amount: money(currentLongLoss))) }

            let exemption = exemption(for: fy)
            let exemptUsed = min(netLong, exemption)
            let taxableLong = money(max(0, netLong - exemption))
            // One pair of rates per year: the exemption and set-off are annual.
            let r = rates(saleDate: "\(fyOrder(fy))-07-24")
            let tax = money(netShort * r.short + taxableLong * r.long)

            rows.append(LedgerYear(
                fy: fy, grossShort: s.short, grossLong: s.long,
                openingCarriedShort: money(openingShort), openingCarriedLong: money(openingLong),
                setOffCurrentShortLossAgainstLong: money(setOffAgainstLong),
                setOffShortAgainstShort: shortOnShort.used, setOffShortAgainstLong: shortOnLong.used, setOffLongAgainstLong: longOnLong.used,
                netShort: money(netShort), netLong: money(netLong), exemption: exemption, exemptUsed: money(exemptUsed),
                taxableShort: money(netShort), taxableLong: taxableLong, shortRate: r.short, longRate: r.long, estimatedTax: tax,
                buybackDividend: s.buybackDividend, disposalCount: s.disposalCount, proceeds: s.proceeds, cost: s.cost,
                lapsed: money(total(lapsedShort) + total(lapsedLong)),
                closingCarriedShort: money(total(carriedShort)), closingCarriedLong: money(total(carriedLong))))
        }

        return Ledger(years: rows, carriedShort: carriedShort, carriedLong: carriedLong,
                      totalRealised: money(rows.reduce(0) { $0 + $1.grossShort + $1.grossLong }),
                      totalShort: money(rows.reduce(0) { $0 + $1.grossShort }), totalLong: money(rows.reduce(0) { $0 + $1.grossLong }),
                      totalTax: money(rows.reduce(0) { $0 + $1.estimatedTax }), totalDisposals: rows.reduce(0) { $0 + $1.disposalCount })
    }

    // MARK: Still held

    struct OpenLot: Identifiable, Equatable {
        var id: String { "\(holdingId)-\(acquiredOn)-\(acquiredAs)-\(quantity)" }
        let holding: String
        let holdingId: String
        let acquiredOn: String
        let acquiredAs: String
        let quantity: Double
        let costPerShare: Double
        let cost: Double
        let value: Double
        let gain: Double
        let isLong: Bool
        let longTermFrom: String
        let daysToLongTerm: Int
        var term: String { isLong ? "long" : "short" }
    }

    /// Unrealised gains on what is still held, by how they would be taxed if sold
    /// today and, for short-term lots, when they cross into long term.
    static func openLots(forStocks stocks: [JSONValue], asOf: Date = Date()) -> [OpenLot] {
        let today = calendarDay(asOf)
        var rows: [OpenLot] = []
        for s in stocks where !s.isNull && !s["isArchived"].truthy {
            let price = s["currentPrice"].double
            let name = [s["name"], s["ticker"]].first { $0.truthy }?.text ?? ""
            for lot in matchLots(s["transactions"], name: name, id: s["id"].text).openLots where lot.quantity > 0 {
                let long = isLongTerm(JSDate.parse(lot.date) ?? today, today)
                let from = longTermFrom(lot.date) ?? ""
                let days = long ? 0 : Int(Money.jsRound(((JSDate.parse(from) ?? today).timeIntervalSince(today) * 1000) / dayMs))
                rows.append(OpenLot(holding: name, holdingId: s["id"].text, acquiredOn: lot.date, acquiredAs: lot.source,
                                    quantity: lot.quantity, costPerShare: lot.costPerShare, cost: money(lot.quantity * lot.costPerShare),
                                    value: money(lot.quantity * price), gain: money(lot.quantity * (price - lot.costPerShare)),
                                    isLong: long, longTermFrom: from, daysToLongTerm: days))
            }
        }
        return rows.enumerated().sorted { a, b in a.element.daysToLongTerm == b.element.daysToLongTerm ? a.offset < b.offset : a.element.daysToLongTerm < b.element.daysToLongTerm }.map(\.element)
    }

    struct TermTotals: Equatable { var count = 0; var cost = 0.0; var value = 0.0; var gain = 0.0 }

    struct Unrealised: Equatable {
        var lots: [OpenLot] = []
        var shortTerm = TermTotals()
        var longTerm = TermTotals()
        var crossingWithin90Days: [OpenLot] = []
    }

    static func unrealised(forStocks stocks: [JSONValue], asOf: Date = Date()) -> Unrealised {
        let lots = openLots(forStocks: stocks, asOf: asOf)
        func totals(_ list: [OpenLot]) -> TermTotals {
            TermTotals(count: list.count, cost: money(list.reduce(0) { $0 + $1.cost }), value: money(list.reduce(0) { $0 + $1.value }), gain: money(list.reduce(0) { $0 + $1.gain }))
        }
        let short = lots.filter { $0.term == "short" }
        return Unrealised(lots: lots, shortTerm: totals(short), longTerm: totals(lots.filter { $0.term == "long" }),
                          crossingWithin90Days: short.filter { $0.daysToLongTerm > 0 && $0.daysToLongTerm <= 90 })
    }
}

/// The Capital Gains page: your own stocks matched FIFO, and mutual funds shown
/// separately because their gains do not follow the equity rules.
enum CapitalGainsPage {
    /// A debt fund's gains are taxed at the slab rate however long it was held. The
    /// class is inferred from the scheme name, which is a guess: a hybrid fund's
    /// treatment depends on its real equity allocation, which is not in the database.
    static func assetClass(of title: String) -> String {
        let t = title.lowercased()
        if ["liquid", "debt", "bond", "gilt", "money market", "overnight", "corporate bond"].contains(where: t.contains) { return "debt" }
        if ["balanced", "hybrid", "advantage", "asset allocat"].contains(where: t.contains) { return "hybrid" }
        return "equity"
    }

    struct FundDisposal: Equatable { let disposal: CapitalGains.Disposal; let assetClass: String }

    struct Page: Equatable {
        var currentFy = ""
        var disposals: [CapitalGains.Disposal] = []
        var unmatched: [CapitalGains.Unmatched] = []
        var ledger = CapitalGains.Ledger()
        var unrealised = CapitalGains.Unrealised()
        var funds: [FundDisposal] = []

        var thisYear: CapitalGains.LedgerYear? { ledger.years.first { $0.fy == currentFy } }
        var carriedTotal: Double { ledger.carriedShort.reduce(0) { $0 + $1.amount } + ledger.carriedLong.reduce(0) { $0 + $1.amount } }
    }

    static func page(savings: JSONValue, asOf: Date = Date()) -> Page {
        let market = savings.array.first { $0["type"].text == "stock_market" } ?? .null
        let stocks = market["stocks"].array.filter(Stocks.isOwn)
        let matched = CapitalGains.disposals(forStocks: stocks)

        var funds: [FundDisposal] = []
        for fund in savings.array where fund["type"].text == "mutual_fund" {
            let name = [fund["title"], fund["name"]].first { $0.truthy }?.text ?? "Unnamed fund"
            for d in CapitalGains.matchLots(fund["transactions"], name: name, id: fund["id"].text).disposals {
                funds.append(FundDisposal(disposal: d, assetClass: assetClass(of: name)))
            }
        }
        funds = funds.enumerated().sorted { a, b in
            a.element.disposal.soldOn == b.element.disposal.soldOn ? a.offset < b.offset : a.element.disposal.soldOn > b.element.disposal.soldOn
        }.map(\.element)

        return Page(currentFy: CapitalGains.fyFor(asOf), disposals: matched.disposals, unmatched: matched.unmatched,
                    ledger: CapitalGains.ledger(matched.disposals), unrealised: CapitalGains.unrealised(forStocks: stocks, asOf: asOf), funds: funds)
    }
}
