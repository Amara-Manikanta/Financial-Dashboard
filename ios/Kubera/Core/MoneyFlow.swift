import Foundation

/// Money Flow — what each debit *was* (consumption, a move into savings, a card bill, money
/// lent, a payroll deduction). Ports of `flowBreakdown` and `averageMonthlySpend` in
/// `utils/transactionKind.js` and the memos in `pages/MoneyFlow.jsx`.
enum MoneyFlow {
    static let labels: [Kind: String] = [.spend: "Spending", .transfer: "Moved to savings", .settlement: "Bill settlement", .lending: "Lent out", .payroll: "Taken from salary"]
    static let blurbs: [Kind: String] = [
        .spend: "Money consumed. This is what a budget is about.",
        .transfer: "Moved into something you still own — an FD, a SIP, a savings account.",
        .settlement: "Paying off a card. The purchases on it were already counted individually.",
        .lending: "Handed to someone who is expected to return it.",
        .payroll: "Deducted before the salary arrived, so it never left the bank.",
    ]

    enum Period: String, CaseIterable, Identifiable { case twelve = "Last 12 months", year = "This year", all = "All time"; var id: String { rawValue } }

    struct KindRow: Identifiable, Equatable {
        var id: String { kind.rawValue }
        let kind: Kind
        var total = 0.0, pct = 0.0
        var count = 0
        var categories: [(category: String, amount: Double)] = []
        static func == (a: KindRow, b: KindRow) -> Bool { a.kind == b.kind && a.total == b.total && a.count == b.count }
    }

    struct Unreviewed: Equatable { var total = 0.0, pctOfSpend = 0.0; var count = 0; var categories: [(category: String, amount: Double)] = []
        static func == (a: Unreviewed, b: Unreviewed) -> Bool { a.total == b.total && a.count == b.count } }

    struct Breakdown: Equatable {
        var gross = 0.0
        var rows: [KindRow] = []
        var unreviewed = Unreviewed()
        func total(_ k: Kind) -> Double { rows.first { $0.kind == k }?.total ?? 0 }
    }

    private static func money(_ v: Double) -> Double { Money.round2(v.isNaN ? 0 : v) }
    private static func cat(_ tx: JSONValue) -> String { let c = TransactionKind.clean(tx["category"]); return c.isEmpty ? "uncategorised" : c }

    static func breakdown(_ txs: [JSONValue], _ kinds: [String: Kind]) -> Breakdown {
        var totals: [Kind: Double] = [:], counts: [Kind: Int] = [:]
        var cats: [Kind: SpendingAnalytics.Ordered] = [:]
        var un = SpendingAnalytics.Ordered(); var unTotal = 0.0, unCount = 0
        for tx in txs where TransactionKind.isDebit(tx) {
            let amount = abs(tx["amount"].double)
            if amount == 0 || amount.isNaN { continue }
            let kind = TransactionKind.kind(for: tx, categoryKinds: kinds)
            totals[kind, default: 0] += amount; counts[kind, default: 0] += 1
            let c = cat(tx)
            cats[kind, default: SpendingAnalytics.Ordered()].set(c, money((cats[kind]?[c] ?? 0) + amount))
            if kind == .spend && TransactionKind.vague.contains(TransactionKind.clean(tx["category"])) && kinds[c] == nil && !tx["kind"].truthy {
                unTotal += amount; unCount += 1
                un.set(c, money(un[c] + amount))
            }
        }
        let gross = Kind.allCases.reduce(0) { $0 + (totals[$1] ?? 0) }
        func sorted(_ o: SpendingAnalytics.Ordered) -> [(category: String, amount: Double)] {
            o.keys.map { ($0, o[$0]) }.enumerated().sorted { $0.element.1 != $1.element.1 ? $0.element.1 > $1.element.1 : $0.offset < $1.offset }.map { (category: $0.element.0, amount: $0.element.1) }
        }
        var out = Breakdown(gross: money(gross))
        out.rows = Kind.allCases.map { k in
            KindRow(kind: k, total: money(totals[k] ?? 0), pct: gross > 0 ? (totals[k] ?? 0) / gross * 100 : 0, count: counts[k] ?? 0, categories: sorted(cats[k] ?? .init()))
        }
        out.unreviewed = Unreviewed(total: money(unTotal), pctOfSpend: (totals[.spend] ?? 0) > 0 ? unTotal / totals[.spend]! * 100 : 0, count: unCount, categories: sorted(un))
        return out
    }

    struct CategoryRow: Identifiable, Equatable {
        var id: String { category }
        let category: String
        let amount: Double
        let count: Int
        let kind: Kind
        let assigned: Kind?
        let suggested: Kind
        let vague: Bool
    }

    struct Page: Equatable {
        var breakdown = Breakdown()
        var naive = 0.0
        var averageSpend = 0.0, averageMonths = 0
        var categories: [CategoryRow] = []
    }

    static func page(expenses: JSONValue, kinds: [String: Kind], period: Period, now: Date = Date()) -> Page {
        var scoped = Recurring.allTransactions(expenses)
        if period != .all {
            let c = Calendar.current.component(.year, from: now)
            let cutoff = period == .year ? "\(c)-01-01" : Recurring.isoDay(now.addingTimeInterval(-365 * 86400))
            scoped = scoped.filter { $0["date"].text >= cutoff }
        }
        var p = Page()
        p.breakdown = breakdown(scoped, kinds)
        p.naive = scoped.filter(TransactionKind.isDebit).reduce(0) { $0 + abs($1["amount"].double) }
        let avg = averageMonthlySpend(expenses, kinds, months: 6, now: now)
        p.averageSpend = avg.average; p.averageMonths = avg.months

        var order: [String] = [], amounts: [String: Double] = [:], counts: [String: Int] = [:]
        for t in scoped where TransactionKind.isDebit(t) {
            let c = cat(t)
            if amounts[c] == nil { order.append(c) }
            amounts[c, default: 0] += abs(t["amount"].double); counts[c, default: 0] += 1
        }
        p.categories = order.map { c in
            CategoryRow(category: c, amount: money(amounts[c]!), count: counts[c]!, kind: kinds[c] ?? TransactionKind.defaultKind(forCategory: c), assigned: kinds[c],
                        suggested: TransactionKind.defaultKind(forCategory: c), vague: TransactionKind.vague.contains(c))
        }.enumerated().sorted { $0.element.amount != $1.element.amount ? $0.element.amount > $1.element.amount : $0.offset < $1.offset }.map(\.element)
        return p
    }

    static func averageMonthlySpend(_ expenses: JSONValue, _ kinds: [String: Kind], months: Int = 6, now: Date = Date()) -> (average: Double, months: Int) {
        var by: [String: Double] = [:]
        for tx in Recurring.allTransactions(expenses) where TransactionKind.isDebit(tx) && TransactionKind.kind(for: tx, categoryKinds: kinds) == .spend {
            let key = String(tx["date"].text.prefix(7))
            if key.range(of: "^\\d{4}-\\d{2}$", options: .regularExpression) == nil { continue }
            by[key] = money((by[key] ?? 0) + abs(tx["amount"].double))
        }
        let c = Calendar.current.dateComponents([.year, .month], from: now)
        let current = String(format: "%04d-%02d", c.year ?? 0, c.month ?? 0)
        let window = Array(by.keys.filter { $0 < current }.sorted().suffix(months))
        if window.isEmpty { return (0, 0) }
        return (money(window.reduce(0) { $0 + by[$1]! } / Double(window.count)), window.count)
    }
}
