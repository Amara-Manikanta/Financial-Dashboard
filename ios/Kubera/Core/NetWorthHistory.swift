import Foundation

/// Net worth over time, rebuilt month by month from dated records — a port of
/// `utils/netWorthHistory.js` and the "steps worth checking" memo in `pages/NetWorthHistory.jsx`.
///
/// **Money contributed, not market value.** Each point is what had been put in by that date
/// (purchases at cost, deposits at face value) less the debt still owed. The database keeps
/// today's price for each holding and none for earlier days, so a historical market value
/// would have to be invented.
enum NetWorthHistory {
    static let components = ["equities", "deposits", "retirement", "gold", "property", "cash"]

    struct Point: Identifiable, Equatable {
        var id: String { month }
        let month: String
        let values: [String: Double]
        let debt: Double, gross: Double, net: Double
    }
    struct Undated: Equatable {
        struct Item: Equatable { let name: String; let amount: Double; let kind: String }
        var metals = 0.0, property = 0.0, total = 0.0
        var items: [Item] = []
    }
    struct Series: Equatable { var points: [Point] = []; var undated = Undated() }
    struct YearAdded: Identifiable, Equatable { var id: String { year }; let year: String; let net: Double; let added: Double }
    struct Step: Identifiable, Equatable { var id: String { month }; let month: String; let jump: Double; let from: Double; let to: Double }

    private static func money(_ v: Double) -> Double { Money.round2(v.isNaN ? 0 : v) }
    private static func firstDefined(_ vs: JSONValue...) -> JSONValue { vs.first { !$0.isNull } ?? .null }

    private struct Ev { let month: String; let component: String; let amount: Double }
    private static func event(_ date: JSONValue, _ component: String, _ amount: Double) -> Ev? {
        guard let key = JSDate.monthKey(date), amount != 0, !amount.isNaN else { return nil }
        return Ev(month: key, component: component, amount: amount)
    }
    private static func cash(_ tx: JSONValue) -> Double {
        tx["amount"].double != 0 ? tx["amount"].double : firstDefined(tx["quantity"], tx["shares"], tx["units"]).double * firstDefined(tx["price"], tx["nav"]).double
    }

    /// Outstanding principal at each month's last payment, amortised from the recorded payments.
    static func loanBalances(_ loan: JSONValue) -> [String: Double] {
        let principal = loan["principalAmount"].double
        if principal <= 0 { return [:] }
        let rate = loan["interestRate"].double / 100 / 12
        let payments = loan["payments"].array.filter { !$0.isNull && $0["date"].truthy }
            .enumerated().sorted { $0.element["date"].text != $1.element["date"].text ? $0.element["date"].text < $1.element["date"].text : $0.offset < $1.offset }.map(\.element)
        var by: [String: Double] = [:]
        var balance = principal
        if let start = JSDate.monthKey(loan["startDate"]) ?? (payments.first.flatMap { JSDate.monthKey($0["date"]) }) { by[start] = money(balance) }
        for p in payments {
            let interest = balance * rate
            balance = max(0, balance - max(0, p["amount"].double - interest))
            if let key = JSDate.monthKey(p["date"]) { by[key] = money(balance) }
        }
        return by
    }

    private static func monthRange(_ first: String, _ last: String) -> [String] {
        var out: [String] = []
        let f = first.split(separator: "-").compactMap { Int($0) }, l = last.split(separator: "-").compactMap { Int($0) }
        guard f.count == 2, l.count == 2 else { return out }
        var (y, m) = (f[0], f[1])
        while y < l[0] || (y == l[0] && m <= l[1]) { out.append(String(format: "%d-%02d", y, m)); m += 1; if m > 12 { m = 1; y += 1 } }
        return out
    }

    static func series(savings: JSONValue, metals: JSONValue, assets: JSONValue, loans: JSONValue, now: Date = Date()) -> Series {
        var events: [Ev] = []
        var undated = Undated()
        func push(_ e: Ev?) { if let e { events.append(e) } }

        for item in savings.array where !item.isNull {
            switch item["type"].text {
            case "stock_market":
                for s in item["stocks"].array.filter(Stocks.isOwn) {
                    for tx in s["transactions"].array {
                        let type = tx["type"].text.lowercased(), c = cash(tx)
                        if c == 0 { continue }
                        if ["buy", "ipo"].contains(type) { push(event(tx["date"], "equities", c)) }
                        else if ["sell", "buyback"].contains(type) { push(event(tx["date"], "equities", -c)) }
                    }
                }
            case "mutual_fund":
                for tx in item["transactions"].array {
                    let type = tx["type"].text.lowercased(), c = cash(tx)
                    if c == 0 { continue }
                    push(event(tx["date"], "equities", type == "sell" || type == "withdraw" ? -c : c))
                }
            case "fixed_deposit":
                for d in item["deposits"].array {
                    push(event(d["startDate"].truthy ? d["startDate"] : d["date"], "deposits", firstDefined(d["originalAmount"], d["principal"], d["amount"]).double))
                }
            case "recurring_deposit":
                for rd in item["recurringDeposits"].array { for i in rd["installments"].array { push(event(i["date"], "deposits", i["amount"].double)) } }
            case "ppf", "pf":
                for d in item["details"].array { push(event(d["date"], "retirement", d["amount"].double)) }
            case "nps":
                for h in item["holdings"].array { for tx in h["transactions"].array where tx["type"].text.lowercased() != "billing" { push(event(tx["date"], "retirement", tx["amount"].double)) } }
            case "sgb":
                for h in item["holdings"].array {
                    push(event(h["purchaseDate"].truthy ? h["purchaseDate"] : h["issueDate"], "gold",
                               firstDefined(h["units"], h["grams"]).double * firstDefined(h["purchasePrice"], h["issuePrice"]).double))
                }
            case "savings_account":
                for tx in item["transactions"].array {
                    let amount = tx["amount"].double
                    push(event(tx["date"], "cash", tx["type"].text.lowercased() == "withdraw" ? -amount : amount))
                }
            default: break
            }
        }

        for (_, list) in metals.object.sorted(by: { $0.key < $1.key }) {
            for item in list.array {
                let cost = item["purchasePrice"].double
                if cost == 0 || cost.isNaN { continue }
                if item["purchaseDate"].truthy { push(event(item["purchaseDate"], "gold", cost)) }
                else { undated.metals += cost; undated.items.append(.init(name: item["name"].truthy ? item["name"].text : "Unnamed", amount: money(cost), kind: "metal")) }
            }
        }
        for category in assets.array {
            for item in category["items"].array {
                let cost = item["purchasePrice"].double
                if cost == 0 || cost.isNaN { continue }
                if item["purchaseDate"].truthy { push(event(item["purchaseDate"], "property", cost)) }
                else { undated.property += cost; undated.items.append(.init(name: item["name"].truthy ? item["name"].text : "Unnamed", amount: money(cost), kind: category["category"].truthy ? category["category"].text : "asset")) }
            }
        }

        let loanMonths = loans.array.map { (id: $0["id"].text, balances: loanBalances($0)) }
        var months = events.map(\.month)
        for l in loanMonths { months += l.balances.keys }
        var result = Series()
        if months.isEmpty { return result }
        months.sort()
        let span = monthRange(months[0], JSDate.monthKey(.string(ISO8601DateFormatter().string(from: now))) ?? months[0])

        var running: [String: Double] = Dictionary(uniqueKeysWithValues: components.map { ($0, 0.0) })
        var lastLoan: [String: Double] = [:]
        for month in span {
            for e in events where e.month == month { running[e.component, default: 0] += e.amount }
            for l in loanMonths { if let b = l.balances[month] { lastLoan[l.id] = b } }
            let debt = lastLoan.values.reduce(0, +)
            let gross = components.reduce(0) { $0 + max(0, running[$1] ?? 0) }
            result.points.append(Point(month: month, values: Dictionary(uniqueKeysWithValues: components.map { ($0, money(max(0, running[$0] ?? 0))) }),
                                       debt: money(debt), gross: money(gross), net: money(gross - debt)))
        }
        undated.metals = money(undated.metals); undated.property = money(undated.property)
        undated.total = money(undated.metals + undated.property)
        undated.items = undated.items.enumerated().sorted { $0.element.amount != $1.element.amount ? $0.element.amount > $1.element.amount : $0.offset < $1.offset }.map(\.element)
        result.undated = undated
        return result
    }

    /// The change between each year's last point — money saved that year.
    static func contributionByYear(_ points: [Point]) -> [YearAdded] {
        var last: [String: (m: String, net: Double)] = [:]
        for p in points {
            let parts = p.month.split(separator: "-").map(String.init)
            if last[parts[0]] == nil || parts[1] > last[parts[0]]!.m { last[parts[0]] = (parts[1], p.net) }
        }
        let years = last.keys.sorted()
        return years.enumerated().map { i, y in YearAdded(year: y, net: last[y]!.net, added: money(last[y]!.net - (i > 0 ? last[years[i - 1]]!.net : 0))) }
    }

    /// Months that jump by over a quarter of what came before — usually the day a batch of
    /// older holdings was entered, not the month they were acquired.
    static func bigSteps(_ points: [Point]) -> [Step] {
        var out: [Step] = []
        if points.count > 1 {
            for i in 1..<points.count {
                let prev = points[i - 1], cur = points[i], jump = cur.net - prev.net
                if prev.net > 0 && jump > prev.net * 0.25 && jump > 200_000 { out.append(Step(month: cur.month, jump: jump, from: prev.net, to: cur.net)) }
            }
        }
        return Array(out.enumerated().sorted { $0.element.jump != $1.element.jump ? $0.element.jump > $1.element.jump : $0.offset < $1.offset }.map(\.element).prefix(4))
    }
}
