import Foundation

/// The Savings page's numbers. Port of `calculateGratuity` (utils/financeCalculators.js)
/// and the block at the top of Savings.jsx that decides what counts as savings.
enum SavingsPage {
    // MARK: Gratuity

    /// (15 × last drawn basic × completed years) / 26 per tenure, if the five-year
    /// rule is met; with no tenures recorded, the gratuity line of each annual CTC.
    static func gratuity(employments: JSONValue, salaryDetails: JSONValue, now: Date = Date()) -> Double {
        var total = 0.0
        let tenures = employments.array
        if !tenures.isEmpty {
            let calendar = Calendar.current
            for emp in tenures {
                let start = emp["startDate"].truthy ? JSDate.parse(emp["startDate"]) : nil
                let end = (emp["isCurrent"].truthy || !emp["endDate"].truthy) ? now : (JSDate.parse(emp["endDate"]) ?? now)
                var totalYears = 0.0, fullYears = 0.0
                if let start {
                    let diff = max(0, end.timeIntervalSince(start) * 1000)
                    totalYears = diff / (1000 * 60 * 60 * 24 * 365.25)
                    fullYears = totalYears.rounded(.down)
                }
                let eligible = totalYears >= 5.0
                var status = emp["status"].truthy ? emp["status"].text : "active"
                if !emp["isCurrent"].truthy && !eligible && status == "active" { status = "forfeited" }

                var amount = 0.0
                if status != "forfeited" && status != "claimed" {
                    if emp["lastDrawnBasic"].double > 0 && fullYears > 0 {
                        amount = (15 * emp["lastDrawnBasic"].double * fullYears) / 26
                    } else {
                        let startYear = start.map { Double(calendar.component(.year, from: $0)) } ?? 0
                        let endYear = Double(calendar.component(.year, from: end))
                        for row in salaryDetails.array where row["month"].text == "Annual" {
                            let year = row["year"].double
                            if year >= startYear && year <= endYear { amount += row["gratuity"].double }
                        }
                    }
                }
                total += amount
            }
        } else {
            for row in salaryDetails.array where row["month"].text == "Annual" { total += row["gratuity"].double }
        }
        return Money.round2(total)
    }

    // MARK: Which accounts are savings

    /// Mutual funds, stocks and gold bonds live on the Investments page, and pure
    /// cover (motor, health, term) returns nothing at maturity, so it is not savings.
    static func isSavings(_ item: JSONValue) -> Bool {
        !["mutual_fund", "stock_market", "sgb"].contains(item["type"].text) && !Valuation.isProtectionOnly(item)
    }

    struct Account: Identifiable, Equatable {
        let id: String
        let title: String
        let typeLabel: String
        let type: String
        let value: Double
        let invested: Double
        let isArchived: Bool
        /// Fixed and recurring deposits, PPF and savings accounts earn interest; the rest are gains.
        var earnsInterest: Bool { ["fixed_deposit", "recurring_deposit", "ppf", "savings_account"].contains(type) }
        var showsReturn: Bool { earnsInterest || ["stock_market", "mutual_fund", "nps", "sgb", "pf"].contains(type) }
        var gain: Double { value - invested }
        var gainPercent: Double { invested > 0 ? gain / invested * 100 : 0 }

        /// Where the Mac's own page for this account lives.
        var webPath: String? {
            let type = self.type
            switch type {
            case "mutual_fund": return "/savings/mutual-fund/\(id)"
            case "fixed_deposit": return "/savings/fixed-deposit/\(id)"
            case "policy", "Policy": return "/savings/policy/\(id)"
            case "stock_market": return "/savings/stock-market/\(id)"
            case "ppf": return "/savings/ppf/\(id)"
            case "nps": return "/savings/nps/\(id)"
            case "sgb": return "/savings/sgb/\(id)"
            case "liquid": return "/savings/emergency-fund/\(id)"
            case "savings_account": return "/savings/savings-account/\(id)"
            case "recurring_deposit": return "/savings/recurring-deposit/\(id)"
            case "pf": return "/savings/pf/\(id)"
            default: return nil
            }
        }
    }

    struct Summary: Equatable {
        var active: [Account] = []
        var archived: [Account] = []
        var valueFromItems = 0.0
        var invested = 0.0
        var gratuity = 0.0
        var totalValue: Double { valueFromItems + gratuity }
        var profitLoss: Double { valueFromItems - invested }
        var roiPercent: Double { invested > 0 ? profitLoss / invested * 100 : 0 }
    }

    static func summary(savings: JSONValue, salaryDetails: JSONValue, employments: JSONValue, asOf: Date = Date()) -> Summary {
        func account(_ item: JSONValue) -> Account {
            let type = item["type"].text
            let name = item["title"].truthy ? item["title"].text : (item["name"].truthy ? item["name"].text : "")
            // JavaScript's `replace('_', ' ')` changes the first underscore only.
            let label = type.replacingOccurrences(of: "_", with: " ", options: [], range: type.range(of: "_"))
            return Account(id: item["id"].text, title: name.isEmpty ? label : name, typeLabel: label, type: type,
                           value: Valuation.currentValue(item, asOf: asOf), invested: Valuation.investedValue(item),
                           isArchived: item["isArchived"].truthy)
        }
        let all = savings.array.filter { !$0.isNull && isSavings($0) }.map(account)
        var result = Summary()
        result.active = all.filter { !$0.isArchived }
        result.archived = all.filter { $0.isArchived }
        result.valueFromItems = result.active.reduce(0) { $0 + $1.value }
        result.invested = result.active.reduce(0) { $0 + $1.invested }
        result.gratuity = gratuity(employments: employments, salaryDetails: salaryDetails, now: asOf)
        return result
    }
}

/// The Investments page: mutual funds, stock accounts and gold bonds.
/// Port of the top of Investments.jsx.
enum InvestmentsPage {
    struct Slice: Equatable { let name: String; let value: Double }

    struct Summary: Equatable {
        var active: [SavingsPage.Account] = []
        var archived: [SavingsPage.Account] = []
        var value = 0.0
        var invested = 0.0
        var allocation: [Slice] = []
        var profitLoss: Double { value - invested }
        var returnPercent: Double { invested > 0 ? profitLoss / invested * 100 : 0 }
    }

    static func isInvestment(_ item: JSONValue) -> Bool {
        ["mutual_fund", "stock_market", "sgb"].contains(item["type"].text)
    }

    static func summary(savings: JSONValue, asOf: Date = Date()) -> Summary {
        func account(_ item: JSONValue) -> SavingsPage.Account {
            let type = item["type"].text
            let name = item["title"].truthy ? item["title"].text : (item["name"].truthy ? item["name"].text : "")
            let label = type.replacingOccurrences(of: "_", with: " ", options: [], range: type.range(of: "_"))
            return SavingsPage.Account(id: item["id"].text, title: name.isEmpty ? label : name, typeLabel: label, type: type,
                                       value: Valuation.currentValue(item, asOf: asOf), invested: Valuation.investedValue(item),
                                       isArchived: item["isArchived"].truthy)
        }
        let items = savings.array.filter { !$0.isNull && isInvestment($0) }
        let all = items.map(account)
        var result = Summary()
        result.active = all.filter { !$0.isArchived }
        result.archived = all.filter { $0.isArchived }
        result.value = result.active.reduce(0) { $0 + $1.value }
        result.invested = result.active.reduce(0) { $0 + $1.invested }

        // Every stock account is one slice; each gold bond and fund stands alone.
        var slices: [Slice] = []
        let stocks = result.active.filter { $0.type == "stock_market" }.reduce(0) { $0 + $1.value }
        if stocks > 0 { slices.append(Slice(name: "Stock Market", value: stocks)) }
        for a in result.active where a.type == "sgb" && a.value > 0 {
            slices.append(Slice(name: a.title == "sgb" ? "Gold Bonds (SGB)" : a.title, value: a.value))
        }
        for a in result.active where a.type == "mutual_fund" && a.value > 0 {
            slices.append(Slice(name: a.title == "mutual fund" ? "Mutual Fund" : a.title, value: a.value))
        }
        result.allocation = slices.enumerated().sorted { $0.element.value == $1.element.value ? $0.offset < $1.offset : $0.element.value > $1.element.value }.map(\.element)
        return result
    }
}
