import Foundation

/// What each kind of account is worth today and what was put into it — a port
/// of `calculateItemCurrentValue` / `calculateItemInvestedValue` in
/// FinanceContext.jsx and the helpers they call (fdAccrual.js, sgb.js,
/// `policyContributed`). The rules and the reasons for them live there.
enum Valuation {
    // MARK: Fixed deposits (utils/fdAccrual.js)

    private static func compoundsPerYear(_ bank: JSONValue) -> Double {
        bank.text.lowercased().contains("slice") ? 365 : 4
    }

    /// Today's value of one deposit. Interest stops at the end date.
    static func depositValue(_ d: JSONValue, asOf: Date) -> Double {
        let principal = d["originalAmount"].double
        let fallback = d["currentValue"].double != 0 ? d["currentValue"].double : principal
        guard principal != 0, d["startDate"].truthy,
              let start = JSDate.parse(d["startDate"]), let end = JSDate.parse(d["endDate"]) else { return fallback }
        let startDay = JSDate.midnight(start), endDay = JSDate.midnight(end), today = JSDate.midnight(asOf)
        let effectiveEnd = today < endDay ? today : endDay
        let daysElapsed = max(0, (effectiveEnd.timeIntervalSince(startDay) / 86400).rounded())
        let rate = d["interestRate"].double / 100
        let n = compoundsPerYear(d["bank"])
        let periods = n * (daysElapsed / 365.25)
        return principal + principal * (pow(1 + rate / n, periods) - 1)
    }

    static func totalAccrued(_ deposits: JSONValue, asOf: Date) -> Double {
        deposits.array.filter { !$0.isNull && !$0["isArchived"].truthy }.reduce(0) { $0 + depositValue($1, asOf: asOf) }
    }

    static func totalPrincipal(_ deposits: JSONValue) -> Double {
        deposits.array.filter { !$0.isNull && !$0["isArchived"].truthy }.reduce(0) { $0 + $1["originalAmount"].double }
    }

    // MARK: Gold bonds (utils/sgb.js)

    struct SgbHolding { var units: Double; var issuePrice: Double; var currentPrice: Double }

    private static func firstDefined(_ values: JSONValue...) -> JSONValue { values.first { !$0.isMissing } ?? .null }

    static func sgbHolding(_ h: JSONValue) -> SgbHolding {
        SgbHolding(units: firstDefined(h["units"], .number(0)).double,
                   issuePrice: firstDefined(h["purchasePrice"], h["issuePrice"], .number(0)).double,
                   currentPrice: firstDefined(h["currentPrice"], .number(0)).double)
    }

    // MARK: Policies

    /// Pure cover returns nothing at maturity, so it is an expense, not savings.
    static func isProtectionOnly(_ policy: JSONValue) -> Bool {
        if case let .bool(flag) = policy["isProtectionOnly"] { return flag }
        return ["bike", "car", "health", "home"].contains(policy["policyDetails"]["category"].text.lowercased())
    }

    /// Premiums paid, less anything the policy has paid back. A policy's `amount`
    /// is usually the sum assured, which is not money invested.
    static func policyContributed(_ policy: JSONValue) -> Double {
        if policy.isNull || isProtectionOnly(policy) { return 0 }
        let premiums = policy["premiums"].array
        let paid = premiums.filter { $0["status"].text == "Paid" }.reduce(0) { $0 + $1["amount"].double }
        let back = premiums.filter { ["Received Back", "Received"].contains($0["status"].text) }.reduce(0) { $0 + $1["amount"].double }
        return paid - back
    }

    // MARK: Current value

    static func currentValue(_ item: JSONValue, asOf: Date = Date()) -> Double {
        if item.isNull { return 0 }
        switch item["type"].text {
        case "stock_market":
            return item["stocks"].array
                .filter { Stocks.isOwn($0) && !$0["isArchived"].truthy && $0["shares"].double > 0 }
                .reduce(0) { $0 + $1["shares"].double * $1["currentPrice"].double }

        case "mutual_fund":
            var units = 0.0
            for tx in item["transactions"].array {
                let sell = ["sell", "withdraw"].contains(tx["type"].text)
                units += sell ? -tx["units"].double : tx["units"].double
            }
            return max(0, units) * item["currentNav"].double

        case "fixed_deposit":
            return totalAccrued(item["deposits"], asOf: asOf)

        case "recurring_deposit":
            return item["recurringDeposits"].array.reduce(0) { sum, rd in
                sum + rd["installments"].array.reduce(0) { $0 + $1["amount"].double }
            }

        case "ppf":
            return item["details"].array.last?["balance"].double ?? 0

        case "pf":
            let sum = item["details"].array.reduce(0) { $0 + $1["amount"].double }
            return sum != 0 ? sum : item["amount"].double

        case "nps":
            let total = item["holdings"].array.reduce(0.0) { sum, h in
                let txs = h["transactions"].array
                var lastTxNav = 0.0
                if let withNav = txs.reversed().first(where: { $0["nav"].double > 0 }) { lastTxNav = withNav["nav"].double }
                let nav = [h["nav"], h["currentPrice"], .number(lastTxNav)].first { $0.truthy }?.double ?? 0
                let units: Double
                if !txs.isEmpty {
                    units = txs.reduce(0) { $0 + $1["units"].double }
                } else if h.has("totalunits") { units = h["totalunits"].double }
                else if h.has("totalUnits") { units = h["totalUnits"].double }
                else { units = h["units"].double }
                return sum + units * nav
            }
            return total != 0 ? total : item["amount"].double

        case "sgb":
            return item["holdings"].array.reduce(0) { sum, h in
                let holding = sgbHolding(h)
                return sum + holding.units * holding.currentPrice
            }

        case "policy", "Policy":
            return policyContributed(item)

        case "savings_account":
            return item["transactions"].array.reduce(0) { sum, t in
                let value = t["amount"].double
                switch t["type"].text.lowercased() {
                case "deposit", "monnies_redeemed": return sum + value
                case "withdraw": return sum - value
                default: return sum
                }
            }

        default:
            return item["amount"].double
        }
    }

    // MARK: Invested value

    static func investedValue(_ item: JSONValue) -> Double {
        if item.isNull { return 0 }
        switch item["type"].text {
        case "stock_market":
            return item["stocks"].array
                .filter { Stocks.isOwn($0) && !$0["isArchived"].truthy && $0["shares"].double > 0 }
                .reduce(0) { sum, stock in
                    let position = Stocks.position(of: stock)
                    return sum + position.shares * position.avgCost
                }

        case "mutual_fund":
            var units = 0.0, cost = 0.0
            let ordered = item["transactions"].array.enumerated().sorted { a, b in
                let da = JSDate.parse(a.element["date"])?.timeIntervalSince1970 ?? 0
                let db = JSDate.parse(b.element["date"])?.timeIntervalSince1970 ?? 0
                return da == db ? a.offset < b.offset : da < db
            }.map(\.element)
            for tx in ordered {
                let sell = ["sell", "withdraw"].contains(tx["type"].text)
                let txUnits = tx["units"].double
                let amount = tx["amount"].double != 0 ? tx["amount"].double : txUnits * tx["nav"].double
                if sell {
                    let avg = units > 0 ? cost / units : 0
                    units -= txUnits
                    cost -= avg * txUnits
                    if units < 0 { units = 0 }
                    if cost < 0 { cost = 0 }
                } else {
                    units += txUnits
                    cost += amount
                }
            }
            return max(0, cost)

        case "fixed_deposit":
            return totalPrincipal(item["deposits"])

        case "recurring_deposit":
            return item["recurringDeposits"].array.reduce(0) { sum, rd in
                sum + rd["installments"].array.reduce(0) { $0 + $1["amount"].double }
            }

        case "ppf":
            return item["details"].array.reduce(0) { $0 + (($1["type"].text.lowercased() == "interest") ? 0 : $1["amount"].double) }

        case "pf":
            return item["details"].array.reduce(item["amount"].double) { $0 + (($1["type"].text != "Interest") ? $1["amount"].double : 0) }

        case "nps":
            var any = false
            let invested = item["holdings"].array.reduce(0.0) { sum, h in
                let txs = h["transactions"].array
                if txs.isEmpty { return sum }
                any = true
                return sum + txs.reduce(0) { $0 + ($1["type"].text == "billing" ? 0 : $1["amount"].double) }
            }
            return any ? invested : item["investedAmount"].double

        case "sgb":
            return item["holdings"].array.reduce(0) { sum, h in
                let holding = sgbHolding(h)
                return sum + holding.units * holding.issuePrice
            }

        case "policy", "Policy":
            return policyContributed(item)

        default:
            return item["investedAmount"].truthy ? item["investedAmount"].double : item["amount"].double
        }
    }
}
