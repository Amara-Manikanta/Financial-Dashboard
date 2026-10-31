import Foundation

/// Analytics that answer a question — a port of `utils/spendingAnalytics.js` (read its header:
/// real consumption only, and every "normal" is a median month, never a mean).
enum SpendingAnalytics {
    private static func money(_ v: Double) -> Double { Money.round2(v.isNaN ? 0 : v) }
    private static func clean(_ v: JSONValue) -> String { v.text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
    private static func category(_ tx: JSONValue) -> String { let c = clean(tx["category"]); return c.isEmpty ? "uncategorised" : c }

    private static let incomeCategories: Set<String> = ["salary received", "salary", "income", "bonus", "interest income", "dividend", "dividends",
                                                        "rental income", "rent received", "freelance", "commission", "incentive", "arrears"]

    static func creditKind(_ tx: JSONValue, _ kinds: [String: Kind]) -> String {
        let cat = clean(tx["category"])
        if incomeCategories.contains(cat) { return "earned" }
        var fields = tx.object; fields["deductFromSalary"] = nil
        let kind = TransactionKind.kind(for: .object(fields), categoryKinds: kinds)
        if kind == .transfer || kind == .settlement { return "transfer-in" }
        if kind == .lending { return "repayment" }
        if TransactionKind.vague.contains(cat) { return "unclassified" }
        return "refund"
    }

    private static func isCredit(_ tx: JSONValue) -> Bool { tx["isCredited"].isTrue || tx["transactionType"].text == "credit" }
    private static func monthOf(_ tx: JSONValue) -> String? {
        let key = String(tx["date"].text.prefix(7))
        return key.range(of: "^\\d{4}-\\d{2}$", options: .regularExpression) != nil ? key : nil
    }
    private static let pctFloor = 100.0
    private static func pctChange(_ before: Double, _ after: Double) -> Double? { before >= pctFloor ? (after - before) / before * 100 : nil }

    static func median(_ values: [Double]) -> Double {
        let s = values.filter { $0.isFinite }.sorted()
        if s.isEmpty { return 0 }
        let mid = s.count / 2
        return s.count % 2 == 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2
    }

    /// A dictionary that remembers the order keys first arrived in, as a JavaScript object does.
    struct Ordered: Equatable {
        private(set) var keys: [String] = []
        private(set) var values: [String: Double] = [:]
        mutating func add(_ key: String, _ amount: Double) { if values[key] == nil { keys.append(key) }; values[key, default: 0] += amount }
        mutating func set(_ key: String, _ amount: Double) { if values[key] == nil { keys.append(key) }; values[key] = amount }
        subscript(key: String) -> Double { values[key] ?? 0 }
    }

    // MARK: Month by month

    struct Month: Identifiable, Equatable {
        var id: String { month }
        let month: String
        var income = 0.0, spend = 0.0, netSpend = 0.0, refunds = 0.0, transfers = 0.0, settlements = 0.0, lending = 0.0, transfersIn = 0.0, payroll = 0.0, surplus = 0.0
        var count = 0
        var incomeIncomplete = false, noIncomeRecorded = false
        var savingsRate: Double?
    }

    static func monthlySeries(_ expenses: JSONValue, _ kinds: [String: Kind]) -> [Month] {
        struct Acc { var m: Month; var spendBy: [String: Double] = [:]; var refundBy: [String: Double] = [:] }
        var months: [String: Acc] = [:]
        for tx in Recurring.allTransactions(expenses) where !tx.isNull {
            guard let month = monthOf(tx) else { continue }
            let amount = abs(tx["amount"].double)
            if amount == 0 || amount.isNaN { continue }
            if months[month] == nil { months[month] = Acc(m: Month(month: month)) }
            let cat = category(tx)
            if isCredit(tx) {
                switch creditKind(tx, kinds) {
                case "earned": months[month]!.m.income += amount
                case "refund": months[month]!.refundBy[cat, default: 0] += amount
                case "unclassified": break
                default: months[month]!.m.transfersIn += amount
                }
                continue
            }
            if !TransactionKind.isDebit(tx) { continue }
            switch TransactionKind.kind(for: tx, categoryKinds: kinds) {
            case .spend: months[month]!.m.spend += amount; months[month]!.spendBy[cat, default: 0] += amount; months[month]!.m.count += 1
            case .transfer: months[month]!.m.transfers += amount
            case .settlement: months[month]!.m.settlements += amount
            case .lending: months[month]!.m.lending += amount
            case .payroll: months[month]!.m.payroll += amount
            }
        }
        return months.values.sorted { $0.m.month < $1.m.month }.map { acc in
            var m = acc.m
            let refunds = acc.refundBy.reduce(0) { $0 + min($1.value, acc.spendBy[$1.key] ?? 0) }
            let net = max(0, m.spend - refunds)
            let surplus = m.income - net
            let incomplete = m.income > 0 && net > 0 && m.income < net * 0.25
            let rawIncome = m.income
            m.refunds = money(refunds); m.netSpend = money(net); m.surplus = money(surplus)
            m.income = money(m.income); m.spend = money(m.spend); m.transfers = money(m.transfers); m.settlements = money(m.settlements)
            m.lending = money(m.lending); m.transfersIn = money(m.transfersIn); m.payroll = money(m.payroll)
            m.incomeIncomplete = incomplete
            m.noIncomeRecorded = rawIncome == 0
            m.savingsRate = rawIncome > 0 && !incomplete ? surplus / rawIncome * 100 : nil
            return m
        }
    }

    // MARK: Categories

    static func categoryByMonth(_ expenses: JSONValue, _ kinds: [String: Kind]) -> [String: Ordered] {
        var by: [String: Ordered] = [:]
        for tx in Recurring.allTransactions(expenses) where !tx.isNull {
            guard let month = monthOf(tx), TransactionKind.isDebit(tx), TransactionKind.kind(for: tx, categoryKinds: kinds) == .spend else { continue }
            let cat = category(tx)
            let prev = by[month]?[cat] ?? 0
            by[month, default: Ordered()].set(cat, money(prev + abs(tx["amount"].double)))
        }
        return by
    }

    struct Mover: Identifiable, Equatable {
        var id: String { category }
        let category: String
        let current: Double, normal: Double, change: Double
        let changePct: Double?
        let monthsSeen: Int, baselineMonths: Int
        let established: Bool, isNew: Bool, stopped: Bool
    }
    struct Movers: Equatable { var month: String?; var baseline: [String] = []; var rows: [Mover] = []; var increases: [Mover] = []; var decreases: [Mover] = [] }

    static func movers(_ expenses: JSONValue, _ kinds: [String: Kind], month: String? = nil, baselineMonths: Int = 6, minMonths: Int = 3) -> Movers {
        let by = categoryByMonth(expenses, kinds)
        let all = by.keys.sorted()
        if all.isEmpty { return Movers(month: nil) }
        let target = month ?? all.last!
        guard let idx = all.firstIndex(of: target) else { return Movers(month: target) }
        let baseline = Array(all[max(0, idx - baselineMonths)..<idx])
        let current = by[target] ?? Ordered()
        var seenCats = Set<String>(), cats: [String] = []
        for c in current.keys + baseline.flatMap({ by[$0]?.keys ?? [] }) where seenCats.insert(c).inserted { cats.append(c) }
        let rows = cats.map { c -> Mover in
            let history = baseline.map { by[$0]?[c] ?? 0 }
            let seen = history.filter { $0 > 0 }.count
            let normal = median(history), now = current[c]
            return Mover(category: c, current: money(now), normal: money(normal), change: money(now - normal), changePct: pctChange(normal, now),
                         monthsSeen: seen, baselineMonths: baseline.count, established: seen >= minMonths, isNew: seen == 0 && now > 0, stopped: seen >= minMonths && now == 0)
        }
        func sorted(_ list: [Mover], _ by: (Mover, Mover) -> Bool) -> [Mover] { list.enumerated().sorted { by($0.element, $1.element) || (!by($1.element, $0.element) && $0.offset < $1.offset) }.map(\.element) }
        return Movers(month: target, baseline: baseline, rows: sorted(rows) { abs($0.change) > abs($1.change) },
                      increases: sorted(rows.filter { $0.change > 0 }) { $0.change > $1.change }, decreases: sorted(rows.filter { $0.change < 0 }) { $0.change < $1.change })
    }

    struct Trend: Identifiable, Equatable {
        var id: String { category }
        let category: String
        let total: Double, before: Double, after: Double, change: Double
        let changePct: Double?
        let direction: String
        let months: [(month: String, amount: Double)]
        let activeMonths: Int
        static func == (a: Trend, b: Trend) -> Bool { a.category == b.category && a.total == b.total && a.change == b.change }
    }

    static func trends(_ expenses: JSONValue, _ kinds: [String: Kind], windowMonths: Int = 12) -> [Trend] {
        let by = categoryByMonth(expenses, kinds)
        let months = Array(by.keys.sorted().suffix(windowMonths))
        if months.count < 4 { return [] }
        let half = months.count / 2
        let earlier = Array(months[..<half]), recent = Array(months[half...])
        var seen = Set<String>(), cats: [String] = []
        for c in months.flatMap({ by[$0]?.keys ?? [] }) where seen.insert(c).inserted { cats.append(c) }
        let rows = cats.map { c -> Trend in
            let e = earlier.map { by[$0]?[c] ?? 0 }, r = recent.map { by[$0]?[c] ?? 0 }
            let before = median(e), after = median(r)
            return Trend(category: c, total: money((e + r).reduce(0, +)), before: money(before), after: money(after), change: money(after - before),
                         changePct: pctChange(before, after), direction: after > before ? "up" : after < before ? "down" : "flat",
                         months: months.map { ($0, by[$0]?[c] ?? 0) }, activeMonths: (e + r).filter { $0 > 0 }.count)
        }
        return rows.enumerated().sorted { $0.element.total != $1.element.total ? $0.element.total > $1.element.total : $0.offset < $1.offset }.map(\.element)
    }

    struct Outlier: Identifiable, Equatable {
        var id: String { "\(txId)-\(date)-\(amount)" }
        let txId: String, date: String, month: String, title: String, category: String
        let amount: Double, typical: Double, timesTypical: Double
    }

    static func outliers(_ expenses: JSONValue, _ kinds: [String: Kind], sinceMonths: Int = 12, multiple: Double = 4, minSample: Int = 5, limit: Int = 20) -> [Outlier] {
        let all = Recurring.allTransactions(expenses).filter { TransactionKind.isDebit($0) && TransactionKind.kind(for: $0, categoryKinds: kinds) == .spend }
        let months = Array(Set(all.compactMap(monthOf))).sorted()
        let cutoff = months.suffix(sinceMonths).first ?? "0000-00"
        var order: [String] = [], by: [String: [JSONValue]] = [:]
        for tx in all { let c = category(tx); if by[c] == nil { order.append(c) }; by[c, default: []].append(tx) }
        var out: [Outlier] = []
        for c in order {
            let txs = by[c]!
            if txs.count < minSample { continue }
            let typical = median(txs.map { abs($0["amount"].double) })
            if typical <= 0 { continue }
            for tx in txs {
                guard let month = monthOf(tx), month >= cutoff else { continue }
                let amount = abs(tx["amount"].double)
                if amount < typical * multiple { continue }
                out.append(Outlier(txId: tx["id"].text, date: tx["date"].text, month: month, title: tx["title"].truthy ? tx["title"].text : c, category: c,
                                   amount: money(amount), typical: money(typical), timesTypical: amount / typical))
            }
        }
        return Array(out.enumerated().sorted { $0.element.amount != $1.element.amount ? $0.element.amount > $1.element.amount : $0.offset < $1.offset }.map(\.element).prefix(limit))
    }

    struct Concentration: Equatable {
        struct Row: Identifiable, Equatable { var id: String { category }; let category: String; let amount: Double; let share: Double; let cumulativeShare: Double; let perMonth: Double }
        var rows: [Row] = []
        var total = 0.0
        var months = 0, categoryCount = 0
        var topFiveShare = 0.0
        var categoriesTo80 = 0
    }

    static func concentration(_ expenses: JSONValue, _ kinds: [String: Kind], months: Int = 12) -> Concentration {
        let by = categoryByMonth(expenses, kinds)
        let window = Array(by.keys.sorted().suffix(months))
        var totals = Ordered()
        for m in window { for k in by[m]!.keys { totals.add(k, by[m]![k]) } }
        let rows = totals.keys.map { ($0, money(totals[$0])) }.enumerated().sorted { $0.element.1 != $1.element.1 ? $0.element.1 > $1.element.1 : $0.offset < $1.offset }.map(\.element)
        let total = rows.reduce(0) { $0 + $1.1 }
        var running = 0.0
        let withShare = rows.map { r -> Concentration.Row in
            running += r.1
            return .init(category: r.0, amount: r.1, share: total > 0 ? r.1 / total * 100 : 0, cumulativeShare: total > 0 ? running / total * 100 : 0, perMonth: window.isEmpty ? 0 : money(r.1 / Double(window.count)))
        }
        let top5 = withShare.prefix(5).reduce(0) { $0 + $1.amount }
        return Concentration(rows: withShare, total: money(total), months: window.count, categoryCount: rows.count, topFiveShare: total > 0 ? top5 / total * 100 : 0,
                             categoriesTo80: (withShare.firstIndex { $0.cumulativeShare >= 80 } ?? -1) + 1)
    }

    // MARK: Overview

    struct Overview: Equatable {
        var series: [Month] = [], complete: [Month] = []
        var inProgress: Month?, lastComplete: Month?
        var normalSpend = 0.0, normalIncome = 0.0, normalSurplus = 0.0
        var medianSavingsRate: Double?
        var monthsWithIncome = 0, monthsTracked = 0
        var monthsMissingIncome: [String] = []
        var lastVsNormal: (change: Double, pct: Double)?
        static func == (a: Overview, b: Overview) -> Bool { a.series == b.series && a.normalSpend == b.normalSpend && a.normalIncome == b.normalIncome && a.medianSavingsRate == b.medianSavingsRate }
    }

    static func overview(_ expenses: JSONValue, _ kinds: [String: Kind], now: Date = Date()) -> Overview? {
        let series = monthlySeries(expenses, kinds)
        if series.isEmpty { return nil }
        let c = Calendar.current.dateComponents([.year, .month], from: now)
        let currentKey = String(format: "%04d-%02d", c.year ?? 0, c.month ?? 0)
        var o = Overview()
        o.series = series
        o.complete = series.filter { $0.month < currentKey }
        o.inProgress = series.first { $0.month == currentKey }
        let last6 = Array(o.complete.suffix(6)), last12 = Array(o.complete.suffix(12))
        let normalSpend = median(last6.map(\.netSpend))
        let normalIncome = median(last6.filter { !$0.noIncomeRecorded && !$0.incomeIncomplete }.map(\.income))
        o.lastComplete = o.complete.last
        let rates = last12.compactMap(\.savingsRate)
        o.normalSpend = money(normalSpend); o.normalIncome = money(normalIncome); o.normalSurplus = money(normalIncome - normalSpend)
        o.medianSavingsRate = rates.isEmpty ? nil : median(rates)
        o.monthsWithIncome = rates.count; o.monthsTracked = series.count
        o.monthsMissingIncome = last12.filter { $0.noIncomeRecorded || $0.incomeIncomplete }.map(\.month)
        if let last = o.lastComplete, normalSpend > 0 { o.lastVsNormal = (money(last.netSpend - normalSpend), (last.netSpend - normalSpend) / normalSpend * 100) }
        return o
    }
}
