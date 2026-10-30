import Foundation

/// The Dashboard's figures: net worth, what it is made of, and how it has grown.
/// Port of `calculateNetWorth` / `outstandingDebt` (utils/financeCalculators.js),
/// `loanBalances` (utils/netWorthHistory.js), `processedMetals` in FinanceContext
/// and the `stats` block of Dashboard.jsx.
struct NetWorthSummary: Equatable {
    var netWorth = 0.0, debt = 0.0, gross = 0.0
    var totalSavings = 0.0, totalMetals = 0.0, totalAssets = 0.0
    var goldValue = 0.0, goldGrams = 0.0, silverValue = 0.0, silverGrams = 0.0
    var platinumValue = 0.0, platinumGrams = 0.0, antiqueCoinsValue = 0.0, currenciesValue = 0.0
    var fixedDeposits = 0.0, stocks = 0.0, mutualFunds = 0.0, ppf = 0.0, nps = 0.0, goldBonds = 0.0
    var growthPercent = 0.0
    var growthIndex = "0.0%"
    var assetHealth = "Stable"
}

enum NetWorth {
    private static func money(_ v: Double) -> Double { Money.round2(v) }

    /// Gold and silver rates: a rate typed in by hand wins, then the live feed,
    /// then a fixed fallback. 24K is the rate; everything else is valued at 22K.
    struct MetalRates {
        var manualGold = 0.0, manualSilver = 0.0
        var liveGold = 0.0, liveSilver = 0.0

        var gold24: Double { manualGold > 0 ? manualGold : (liveGold != 0 ? liveGold : 7600) }
        var silver: Double { manualSilver > 0 ? manualSilver : (liveSilver != 0 ? liveSilver : 95) }
    }

    static let metalKinds = ["gold", "silver", "platinum", "antique_coins", "currencies"]

    /// Items without a stored value are valued by weight at the rate in force.
    /// Platinum, coins and currencies carry whatever was entered by hand.
    static func processedMetals(_ metals: JSONValue, rates: MetalRates) -> [String: [JSONValue]] {
        func filled(_ item: JSONValue, rate: Double) -> JSONValue {
            if (item["currentValue"].jsNumber ?? 0) > 0 { return item }
            var fields = item.object
            fields["currentValue"] = .number(item["weightGm"].double * rate)
            return .object(fields)
        }
        let gold22 = rates.gold24 * (22.0 / 24.0)
        var result: [String: [JSONValue]] = [:]
        result["gold"] = metals["gold"].array.map { item in
            if case .number(24) = item["purity"] { return filled(item, rate: rates.gold24) }
            return filled(item, rate: gold22)
        }
        result["silver"] = metals["silver"].array.map { filled($0, rate: rates.silver) }
        for kind in ["platinum", "antique_coins", "currencies"] { result[kind] = metals[kind].array }
        return result
    }

    // MARK: Loans

    /// Outstanding principal month by month, amortised from the payments
    /// actually recorded rather than from the schedule.
    static func loanBalances(_ loan: JSONValue) -> [String: Double] {
        let principal = loan["principalAmount"].double
        if principal <= 0 { return [:] }
        let monthlyRate = loan["interestRate"].double / 100 / 12
        let payments = loan["payments"].array.enumerated()
            .filter { !$0.element.isNull && $0.element["date"].truthy }
            .sorted { a, b in
                let da = a.element["date"].text, db = b.element["date"].text
                return da == db ? a.offset < b.offset : da < db
            }.map(\.element)

        var byMonth: [String: Double] = [:]
        var balance = principal
        if let startKey = JSDate.monthKey(loan["startDate"]) ?? payments.first.flatMap({ JSDate.monthKey($0["date"]) }) {
            byMonth[startKey] = money(balance)
        }
        for payment in payments {
            let paid = payment["amount"].double
            let interest = balance * monthlyRate
            let toPrincipal = max(0, paid - interest)
            balance = max(0, balance - toPrincipal)
            if let key = JSDate.monthKey(payment["date"]) { byMonth[key] = money(balance) }
        }
        return byMonth
    }

    static func outstandingDebt(_ loans: JSONValue) -> Double {
        money(loans.array.reduce(0) { sum, loan in
            let balances = loanBalances(loan)
            guard let last = balances.keys.sorted().last else { return sum }
            return sum + (balances[last] ?? 0)
        })
    }

    // MARK: Summary

    static func summary(savings: JSONValue, metals: JSONValue, assets: JSONValue, loans: JSONValue,
                        rates: MetalRates, asOf: Date = Date()) -> NetWorthSummary {
        var out = NetWorthSummary()
        let items = savings.array.filter { !$0.isNull }
        let processed = processedMetals(metals, rates: rates)

        let savingsTotal = items.reduce(0) { $0 + Valuation.currentValue($1, asOf: asOf) }
        let metalsTotal = metalKinds.reduce(0.0) { sum, kind in
            sum + (processed[kind] ?? []).reduce(0) { $0 + $1["currentValue"].double }
        }
        let assetsTotal = assets.array.reduce(0.0) { sum, cat in
            sum + cat["items"].array.reduce(0) { s, item in
                let value = item["currentValue"].double
                return s + (value != 0 ? value : item["purchasePrice"].double)
            }
        }
        let debt = outstandingDebt(loans)
        let gross = savingsTotal + metalsTotal + assetsTotal
        out.totalSavings = money(savingsTotal)
        out.totalMetals = money(metalsTotal)
        out.totalAssets = money(assetsTotal)
        out.gross = money(gross)
        out.debt = debt
        out.netWorth = money(gross - debt)

        func sum(_ kind: String, _ field: String) -> Double { (processed[kind] ?? []).reduce(0) { $0 + $1[field].double } }
        out.goldValue = sum("gold", "currentValue"); out.goldGrams = sum("gold", "weightGm")
        out.silverValue = sum("silver", "currentValue"); out.silverGrams = sum("silver", "weightGm")
        out.platinumValue = sum("platinum", "currentValue"); out.platinumGrams = sum("platinum", "weightGm")
        out.antiqueCoinsValue = sum("antique_coins", "currentValue")
        out.currenciesValue = sum("currencies", "currentValue")

        func total(_ type: String) -> Double {
            items.filter { $0["type"].text == type }.reduce(0) { $0 + Valuation.currentValue($1, asOf: asOf) }
        }
        out.fixedDeposits = total("fixed_deposit"); out.stocks = total("stock_market"); out.mutualFunds = total("mutual_fund")
        out.ppf = total("ppf"); out.nps = total("nps"); out.goldBonds = total("sgb")

        // Growth index: what everything is worth against what it cost.
        let investedSavings = items.reduce(0.0) { s, item in
            let invested = Valuation.investedValue(item)
            return s + (invested != 0 ? invested : Valuation.currentValue(item, asOf: asOf))
        }
        func cost(_ item: JSONValue) -> Double {
            let price = item["purchasePrice"].double
            return price != 0 ? price : item["currentValue"].double
        }
        let investedAssets = assets.array.reduce(0.0) { $0 + $1["items"].array.reduce(0) { $0 + cost($1) } }
        let investedMetals = metalKinds.reduce(0.0) { s, kind in s + (processed[kind] ?? []).reduce(0) { $0 + cost($1) } }
        let invested = investedSavings + investedAssets + investedMetals
        let growth = invested > 0 ? ((gross - invested) / invested) * 100 : 0
        out.growthPercent = growth
        out.growthIndex = growth > 0 ? "+\(toFixed1(growth))%" : "\(toFixed1(growth))%"
        out.assetHealth = growth > 15 ? "Excellent" : growth < -5 ? "Volatile" : growth > 5 ? "Good" : "Stable"
        return out
    }

    /// JavaScript's `toFixed(1)`: ties round away from zero.
    static func toFixed1(_ value: Double) -> String {
        let magnitude = abs(value)
        let rounded = (magnitude * 10).rounded(.toNearestOrAwayFromZero) / 10
        let text = String(format: "%.1f", rounded)
        return value < 0 ? "-\(text)" : text      // (-0.04).toFixed(1) is "-0.0" in JavaScript
    }
}
