import Foundation

/// Money-weighted return — a port of `src/utils/xirr.js` (read its header for why a
/// simple percentage is the wrong question). XIRR is the single annual rate at which
/// every cash flow, discounted from its own date, sums to zero. It is `nil`, not 0,
/// when it cannot be computed: a rate of zero is a claim.
enum Xirr {
    struct Flow: Equatable {
        var date: Double          // milliseconds since 1970, as JavaScript's getTime()
        var amount: Double
        var closing = false
    }

    private static let day = 86_400_000.0
    private static let maxIterations = 100
    private static let tolerance = 1e-7

    private static func npv(_ rate: Double, _ flows: [Flow], _ t0: Double) -> Double {
        flows.reduce(0) { sum, f in
            let years = (f.date - t0) / (365 * day)
            let base = 1 + rate
            // (1 + rate) can go non-positive during the search; guard rather than NaN.
            if base <= 0 { return sum + f.amount * pow(1e-10, years) }
            return sum + f.amount / pow(base, years)
        }
    }

    /// Newton–Raphson first (fast on well-behaved series), then bisection, which
    /// cannot fail once a bracket exists.
    static func rate(_ cashflows: [Flow]) -> Double? {
        let flows = cashflows.filter { !$0.date.isNaN && $0.amount != 0 }
            .enumerated().sorted { $0.element.date == $1.element.date ? $0.offset < $1.offset : $0.element.date < $1.element.date }.map(\.element)
        if flows.count < 2 { return nil }
        if !flows.contains(where: { $0.amount > 0 }) || !flows.contains(where: { $0.amount < 0 }) { return nil }

        let t0 = flows[0].date
        if (flows[flows.count - 1].date - t0) / day <= 0 { return nil }

        // Scale the tolerance to the size of the flows.
        let scale = max(1, flows.reduce(0) { $0 + abs($1.amount) } / Double(flows.count))
        let tol = tolerance * scale

        var rate = 0.1
        for _ in 0..<maxIterations {
            let f = npv(rate, flows, t0)
            if abs(f) < tol { return rate }
            let dRate = 1e-6
            let derivative = (npv(rate + dRate, flows, t0) - f) / dRate
            if !derivative.isFinite || derivative == 0 { break }
            let next = rate - f / derivative
            if !next.isFinite { break }
            // A small step is only an answer if the function is near zero there.
            if abs(next - rate) < tolerance { return abs(npv(next, flows, t0)) < tol ? next : nil }
            rate = next
        }

        var low = -0.9999, high = 100.0
        var fLow = npv(low, flows, t0)
        let fHigh = npv(high, flows, t0)
        if fLow * fHigh > 0 { return nil }
        for _ in 0..<200 {
            let mid = (low + high) / 2
            let fMid = npv(mid, flows, t0)
            if abs(fMid) < tol { return mid }
            if fLow * fMid < 0 { high = mid } else { low = mid; fLow = fMid }
        }
        return (low + high) / 2
    }

    /// For tests: the net present value at a rate, measured from the first flow.
    static func npvForTest(_ rate: Double, _ flows: [Flow]) -> Double { npv(rate, flows, flows.map(\.date).min() ?? 0) }

    // MARK: Cash flows

    private static let acquire = ["buy", "ipo"]
    private static let dispose = ["sell", "buyback"]

    private static func qty(_ tx: JSONValue) -> Double { [tx["quantity"], tx["shares"], tx["units"]].first { !$0.isNull }?.double ?? 0 }
    private static func cash(_ tx: JSONValue) -> Double {
        tx["amount"].double != 0 ? tx["amount"].double : qty(tx) * ([tx["price"], tx["nav"]].first { !$0.isNull }?.double ?? 0)
    }
    private static func ms(_ value: JSONValue) -> Double { (JSDate.parse(value)?.timeIntervalSince1970).map { $0 * 1000 } ?? .nan }

    /// One stock's flows from your side: money out negative, money in positive, and
    /// whatever is still held as a final inflow at today's price.
    static func stockCashflows(_ stock: JSONValue, asOf: Date) -> [Flow] {
        var flows: [Flow] = []
        for tx in stock["transactions"].array {
            let type = tx["type"].text.lowercased()
            // A payout sits in `price` with quantity 0, so handle it before the zero-cash return.
            if type == "dividend" {
                let payout = tx["amount"].double != 0 ? tx["amount"].double : tx["price"].double
                if payout != 0 { flows.append(Flow(date: ms(tx["date"]), amount: payout)) }
                continue
            }
            let c = cash(tx)
            if c == 0 { continue }
            if acquire.contains(type) { flows.append(Flow(date: ms(tx["date"]), amount: -c)) }
            else if dispose.contains(type) { flows.append(Flow(date: ms(tx["date"]), amount: c)) }
            else if type == "merger_out" { flows.append(Flow(date: ms(tx["date"]), amount: c)) }
            else if type == "merger_in" { flows.append(Flow(date: ms(tx["date"]), amount: -c)) }
        }
        let value = stock["shares"].double * stock["currentPrice"].double
        if value > 0 { flows.append(Flow(date: asOf.timeIntervalSince1970 * 1000, amount: value, closing: true)) }
        return flows
    }

    static func fundCashflows(_ fund: JSONValue, asOf: Date) -> [Flow] {
        var flows: [Flow] = []
        var units = 0.0
        for tx in fund["transactions"].array {
            let type = tx["type"].text.lowercased()
            let c = cash(tx), u = qty(tx)
            if type == "sell" || type == "withdraw" {
                units -= u
                if c != 0 { flows.append(Flow(date: ms(tx["date"]), amount: c)) }
            } else {
                units += u
                if c != 0 { flows.append(Flow(date: ms(tx["date"]), amount: -c)) }
            }
        }
        let value = max(0, units) * fund["currentNav"].double
        if value > 0 { flows.append(Flow(date: asOf.timeIntervalSince1970 * 1000, amount: value, closing: true)) }
        return flows
    }

    // MARK: Profiles

    struct Profile: Identifiable, Equatable {
        var id: String
        var name: String
        var invested = 0.0, returned = 0.0, closing = 0.0, profit = 0.0
        var simplePct: Double?
        /// Annualised, as a percentage; nil when it cannot be computed.
        var xirrPct: Double?
        var firstFlow: String?
        var lastFlow: String?
        var days = 0
        /// Under a quarter, annualising turns noise into a headline.
        var tooShortToAnnualise = false
        var flowCount = 0
        var kind = ""
        var archived = false
    }

    private static func isoDay(_ ms: Double) -> String {
        let c = Calendar(identifier: .gregorian)
        var utc = c; utc.timeZone = TimeZone(identifier: "UTC")!
        let p = utc.dateComponents([.year, .month, .day], from: Date(timeIntervalSince1970: ms / 1000))
        return String(format: "%04d-%02d-%02d", p.year ?? 0, p.month ?? 0, p.day ?? 0)
    }

    static func profile(_ flows: [Flow], id: String, name: String) -> Profile {
        let invested = Money.round2(flows.filter { $0.amount < 0 }.reduce(0) { $0 - $1.amount })
        let returned = Money.round2(flows.filter { $0.amount > 0 && !$0.closing }.reduce(0) { $0 + $1.amount })
        let closing = Money.round2(flows.filter(\.closing).reduce(0) { $0 + $1.amount })
        let dates = flows.map(\.date).filter { !$0.isNaN }
        let first = dates.min(), last = dates.max()
        // First flow to LAST flow, not to today: a six-day trade closed years ago
        // must not be read as a multi-year holding.
        let days = (first != nil && last != nil) ? Int(Money.jsRound((last! - first!) / day)) : 0
        let rate = rate(flows)
        return Profile(
            id: id, name: name, invested: invested, returned: returned, closing: closing,
            profit: Money.round2(returned + closing - invested),
            simplePct: invested > 0 ? ((returned + closing - invested) / invested) * 100 : nil,
            xirrPct: rate.map { $0 * 100 },
            firstFlow: first.map(isoDay), lastFlow: last.map(isoDay), days: days,
            tooShortToAnnualise: days > 0 && days < 90, flowCount: flows.count)
    }

    static func stockReturn(_ stock: JSONValue, asOf: Date) -> Profile {
        let name = [stock["name"], stock["ticker"]].first { $0.truthy }?.text ?? "Unnamed"
        return profile(stockCashflows(stock, asOf: asOf), id: stock["id"].text, name: name)
    }

    static func fundReturn(_ fund: JSONValue, asOf: Date) -> Profile {
        let name = [fund["title"], fund["name"]].first { $0.truthy }?.text ?? "Unnamed fund"
        return profile(fundCashflows(fund, asOf: asOf), id: fund["id"].text, name: name)
    }

    /// Every holding ranked by money-weighted return. A holding whose rate cannot
    /// be computed is kept, sorted last: a position with no valuation is a gap in
    /// the records, and hiding it would make the list look complete.
    static func ranked(stocks: [JSONValue], funds: [JSONValue], asOf: Date) -> [Profile] {
        var rows = stocks.filter { !$0.isNull }.map { s -> Profile in var p = stockReturn(s, asOf: asOf); p.kind = "stock"; p.archived = s["isArchived"].truthy; return p }
        rows += funds.filter { !$0.isNull }.map { f -> Profile in var p = fundReturn(f, asOf: asOf); p.kind = "fund"; p.archived = f["isArchived"].truthy; return p }
        return rows.enumerated().sorted { a, b in
            let x = a.element, y = b.element
            switch (x.xirrPct, y.xirrPct) {
            case (nil, nil): return x.invested != y.invested ? x.invested > y.invested : a.offset < b.offset
            case (nil, _): return false
            case (_, nil): return true
            case let (p?, q?): return p != q ? p > q : a.offset < b.offset
            }
        }.map(\.element)
    }

    /// The portfolio's own XIRR: every holding's flows pooled, not an average of rates
    /// (an average would weight a ₹500 position the same as a ₹2 lakh one).
    static func portfolio(stocks: [JSONValue], funds: [JSONValue], asOf: Date) -> Profile {
        let flows = stocks.filter { !$0.isNull }.flatMap { stockCashflows($0, asOf: asOf) }
            + funds.filter { !$0.isNull }.flatMap { fundCashflows($0, asOf: asOf) }
        return profile(flows, id: "portfolio", name: "Whole portfolio")
    }
}

/// The Returns page: your own stocks and every mutual fund, ranked.
enum ReturnsPage {
    enum Sort: String, CaseIterable, Identifiable {
        case xirr = "Annualised", simple = "Total", invested = "Money in", profit = "Profit"
        var id: String { rawValue }
    }

    struct Page: Equatable {
        var rows: [Xirr.Profile] = []
        var portfolio = Xirr.Profile(id: "portfolio", name: "Whole portfolio")
        var notComputable: [Xirr.Profile] { rows.filter { $0.xirrPct == nil } }
        var tooShort: [Xirr.Profile] { rows.filter(\.tooShortToAnnualise) }
    }

    static func page(savings: JSONValue, asOf: Date = Date()) -> Page {
        let market = savings.array.first { $0["type"].text == "stock_market" } ?? .null
        let stocks = market["stocks"].array.filter(Stocks.isOwn)
        let funds = savings.array.filter { $0["type"].text == "mutual_fund" }
        return Page(rows: Xirr.ranked(stocks: stocks, funds: funds, asOf: asOf), portfolio: Xirr.portfolio(stocks: stocks, funds: funds, asOf: asOf))
    }

    /// Descending, with rows that have no value for the key last.
    static func sorted(_ rows: [Xirr.Profile], by sort: Sort) -> [Xirr.Profile] {
        func key(_ p: Xirr.Profile) -> Double? {
            switch sort { case .xirr: return p.xirrPct; case .simple: return p.simplePct; case .invested: return p.invested; case .profit: return p.profit }
        }
        return rows.enumerated().sorted { a, b in
            switch (key(a.element), key(b.element)) {
            case (nil, nil): return a.offset < b.offset
            case (nil, _): return false
            case (_, nil): return true
            case let (x?, y?): return x != y ? x > y : a.offset < b.offset
            }
        }.map(\.element)
    }
}
