import Foundation

/// Not every debit is money spent. Port of `src/utils/transactionKind.js`; the
/// rules and their reasons are documented there, and any change must be made in
/// both places (the parity test in Tests/ fails if they drift).
enum Kind: String, CaseIterable {
    case spend, transfer, settlement, lending, payroll
}

enum TransactionKind {
    /// Exact lowercased category names whose meaning is unambiguous.
    static let defaults: [String: Kind] = [
        "credit card payment": .settlement, "credit card bill": .settlement, "credit card": .settlement,
        "card payment": .settlement, "slice": .settlement, "bnpl": .settlement,

        "fixed deposit": .transfer, "recurring deposit": .transfer, "savings account": .transfer,
        "mutual funds": .transfer, "mutual fund": .transfer, "stocks": .transfer, "stock": .transfer,
        "sip": .transfer, "ppf": .transfer, "nps": .transfer, "gold scheme": .transfer,
        "gold bond": .transfer, "sovereign gold bond": .transfer, "cash reserve": .transfer,
        "investment": .transfer, "investments": .transfer, "emergency fund": .transfer,
        "kitty amount": .transfer, "food wallet": .transfer, "wallet load": .transfer,

        "loan given": .lending, "family borrowed": .lending, "friend borrowed": .lending,
        "money lent": .lending, "lent": .lending, "family lent": .lending, "friend lent": .lending,
        "loan repaid": .lending, "money received back": .lending,
    ]

    /// Too large to ignore and too vague to classify; reported, never guessed.
    static let vague: Set<String> = ["other", "others", "bank transfer", "transfers", "transfer",
                                     "miscellaneous", "misc", "general", "uncategorized", "uncategorised", ""]

    static func clean(_ value: JSONValue) -> String {
        value.text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    /// The user's own category → kind map from `appData.categoryKinds`.
    static func categoryKinds(from appData: JSONValue) -> [String: Kind] {
        var result: [String: Kind] = [:]
        for (category, value) in appData["categoryKinds"].object {
            if let kind = Kind(rawValue: value.text) { result[category] = kind }
        }
        return result
    }

    static func defaultKind(forCategory category: String) -> Kind {
        defaults[category.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()] ?? .spend
    }

    /// Most specific first: the row's own `kind`, the older `deductFromSalary: false`
    /// flag, the user's category map, the built-in table, then `spend`.
    static func kind(for tx: JSONValue, categoryKinds: [String: Kind] = [:]) -> Kind {
        if let own = Kind(rawValue: tx["kind"].text), case .string = tx["kind"] { return own }
        if tx["deductFromSalary"].isFalse { return .payroll }
        let category = clean(tx["category"])
        if let chosen = categoryKinds[category] { return chosen }
        return defaults[category] ?? .spend
    }

    /// Money out. Refunds and income are credits.
    static func isDebit(_ tx: JSONValue) -> Bool {
        !tx.isNull && !tx["isCredited"].isTrue && tx["transactionType"].text != "credit"
    }

    struct Buckets: Equatable {
        var spent: Double
        var invested: Double
        var excluded: Double
        var spentCategories: Int
        var investedCategories: Int
    }

    /// `expenseBuckets`: what was spent, what moved into something still owned
    /// (savings or money lent), and what was excluded (card settlements and
    /// payroll deductions, already counted elsewhere).
    static func buckets(_ transactions: [JSONValue], categoryKinds: [String: Kind] = [:]) -> Buckets {
        var totals: [Kind: Double] = [:]
        var categories: [Kind: [String: Double]] = [:]
        for tx in transactions where isDebit(tx) {
            let amount = abs(tx["amount"].double)
            if amount == 0 { continue }
            let kind = self.kind(for: tx, categoryKinds: categoryKinds)
            totals[kind, default: 0] += amount
            var name = clean(tx["category"])
            if name.isEmpty { name = "uncategorised" }
            categories[kind, default: [:]][name] = Money.round2((categories[kind]?[name] ?? 0) + amount)
        }
        func total(_ kind: Kind) -> Double { Money.round2(totals[kind] ?? 0) }
        func used(_ kinds: Kind...) -> Int {
            var names = Set<String>()
            for kind in kinds { for (name, amount) in categories[kind] ?? [:] where amount != 0 { names.insert(name) } }
            return names.count
        }
        return Buckets(
            spent: total(.spend),
            invested: Money.round2(total(.transfer) + total(.lending)),
            excluded: Money.round2(total(.settlement) + total(.payroll)),
            spentCategories: used(.spend),
            investedCategories: used(.transfer, .lending)
        )
    }
}
