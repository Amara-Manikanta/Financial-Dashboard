import Foundation

/// What the credit cards are actually doing — a port of `utils/creditCards.js` (read its
/// header: utilisation, revolving months, interest paid, concentration, dormancy, and where
/// the ledger cannot say — due dates, rates and fees are not recorded, so none are assumed).
enum Cards {
    private static func money(_ v: Double) -> Double { Money.round2(v.isNaN ? 0 : v) }
    private static let aliases: [String: [String]] = ["coral rupay": ["icici rupay"], "hpcl": ["icici hp card"]]
    private static let paymentCategories: Set<String> = ["credit card bill", "credit card payment"]

    private static func isInterest(_ cat: String) -> Bool {
        let c = cat.lowercased()
        if c.contains("income") { return false }
        return c.contains("interest") || c.contains("finance charge") || c.contains("late payment")
    }

    static func matches(_ txCard: String, _ card: JSONValue) -> Bool {
        if txCard.isEmpty || !card["name"].truthy { return false }
        let t = txCard.trimmingCharacters(in: .whitespaces).lowercased(), c = card["name"].text.trimmingCharacters(in: .whitespaces).lowercased()
        return t == c || c.contains(t) || t.contains(c) || (aliases[c] ?? []).contains(t)
    }

    /// `Month/Year` as local midnight on the 1st, or nil.
    private static func baseline(_ card: JSONValue) -> Date? {
        guard card["carryForwardBaseline"].truthy else { return nil }
        let parts = card["carryForwardBaseline"].text.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
        guard parts.count >= 2 else { return nil }
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "MMMM d, yyyy"
        return f.date(from: "\(parts[0]) 1, \(parts[1])")
    }

    private static func parseLocal(_ s: String) -> Date? {
        let p = s.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return JSDate.parse(s) }
        return Calendar.current.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))
    }

    static func transactions(_ expenses: JSONValue) -> [JSONValue] {
        Recurring.allTransactions(expenses).filter { $0["paymentMode"].text == "credit_card" && $0["creditCardName"].truthy }
    }

    enum Kind: String { case payment, interest, reward, refund, spend }
    private static func classify(_ tx: JSONValue) -> Kind {
        let cat = tx["category"].text.lowercased()
        if paymentCategories.contains(cat) { return .payment }
        if isInterest(cat) { return .interest }
        if tx["isRewardPoints"].truthy { return .reward }
        if tx["isCredited"].isTrue || tx["transactionType"].text == "credit" { return .refund }
        return .spend
    }

    struct Cycle: Equatable { let billingDay: Int; let lastStatement: String; let nextStatement: String; let daysToNext: Int; let cycleStart: String }

    private static func utcISO(_ d: Date) -> String { Recurring.isoDay(d) }

    static func cycle(_ card: JSONValue, now: Date) -> Cycle? {
        let day = Int(card["billingDay"].double)
        if day == 0 { return nil }
        let cal = Calendar.current
        func on(_ y: Int, _ m0: Int) -> Date {
            let base = cal.date(from: DateComponents(year: y, month: m0 + 1, day: 1))!
            let dim = cal.range(of: .day, in: .month, for: base)!.count
            return cal.date(from: DateComponents(year: cal.component(.year, from: base), month: cal.component(.month, from: base), day: min(day, dim)))!
        }
        let c = cal.dateComponents([.year, .month], from: now)
        var last = on(c.year!, c.month! - 1)
        if last > now { last = on(c.year!, c.month! - 2) }
        let lc = cal.dateComponents([.year, .month], from: last)
        let next = on(lc.year!, lc.month!)   // month after `last`: m0 = lc.month (1-based) is next month's 0-based index
        return Cycle(billingDay: day, lastStatement: utcISO(last), nextStatement: utcISO(next),
                     daysToNext: max(0, Int((next.timeIntervalSince(now) / 86400).rounded(.up))), cycleStart: utcISO(last))
    }

    struct Month: Identifiable, Equatable {
        var id: String { month }
        let month: String
        var spend = 0.0, payment = 0.0, interest = 0.0, refund = 0.0, reward = 0.0
        var count = 0
        var opening: Double?, closing: Double?
        var tracked = false, revolved = false
        var shortfall = 0.0
    }

    static func history(_ card: JSONValue, _ txs: [JSONValue]) -> [Month] {
        let base = baseline(card)
        let baselineKey = base.map { d -> String in let c = Calendar.current.dateComponents([.year, .month], from: d); return String(format: "%04d-%02d", c.year!, c.month!) }
        var months: [String: Month] = [:]
        for tx in txs where matches(tx["creditCardName"].text, card) {
            let key = String(tx["date"].text.prefix(7))
            if key.range(of: "^\\d{4}-\\d{2}$", options: .regularExpression) == nil { continue }
            if months[key] == nil { months[key] = Month(month: key) }
            let amount = abs(tx["amount"].double)
            switch classify(tx) {
            case .spend: months[key]!.spend += amount; months[key]!.count += 1
            case .payment: months[key]!.payment += amount
            case .interest: months[key]!.interest += amount
            case .refund: months[key]!.refund += amount
            case .reward: months[key]!.reward += amount
            }
        }
        var balance: Double?
        return months.values.sorted { $0.month < $1.month }.map { m in
            var m = m
            if let baselineKey, m.month == baselineKey { balance = card["baselineOpeningBalance"].double }
            else if baselineKey == nil && balance == nil { balance = 0 }
            let opening = balance
            if let b = balance { balance = b + m.spend + m.interest - m.payment - m.refund }
            let spend = m.spend, pay = m.payment, interest = m.interest, refund = m.refund
            m.revolved = pay + refund < spend + interest
            m.shortfall = money(max(0, (spend + interest) - (pay + refund)))
            m.spend = money(spend); m.payment = money(pay); m.interest = money(interest); m.refund = money(refund); m.reward = money(m.reward)
            m.opening = opening.map(money); m.closing = balance.map(money); m.tracked = balance != nil
            return m
        }
    }

    struct Profile: Identifiable, Equatable {
        var id: String
        let name: String, bank: String
        let isWallet: Bool
        let limit: Double
        var outstanding = 0.0
        var available: Double?, utilisation: Double?
        var peakBalance = 0.0
        var peakUtilisation: Double?
        var lifetimeSpend = 0.0, interestPaid = 0.0, rewards = 0.0
        var transactionCount = 0
        var lastUsed: String?
        var daysIdle: Int?
        var cycle: Cycle?
        var history: [Month] = []
        var averageMonthlySpend = 0.0
        var revolvingMonths = 0
        var worstShortfall = 0.0
        var interestMonths: [(month: String, amount: Double)] = []
        var topCategories: [(category: String, amount: Double)] = []
        static func == (a: Profile, b: Profile) -> Bool { a.id == b.id && a.outstanding == b.outstanding && a.lifetimeSpend == b.lifetimeSpend }
    }

    static func profile(_ card: JSONValue, _ txs: [JSONValue], now: Date) -> Profile {
        let hist = history(card, txs)
        let mine = txs.filter { matches($0["creditCardName"].text, card) }
        let tracked = hist.filter(\.tracked)
        let outstanding = tracked.last.map { max(0, $0.closing ?? 0) } ?? 0
        let limit = card["creditLimit"].double
        var p = Profile(id: card["id"].text, name: card["name"].text, bank: card["bankName"].text, isWallet: card["type"].text == "wallet" || limit == 0, limit: limit)
        p.outstanding = money(outstanding)
        p.available = limit > 0 ? money(max(0, limit - outstanding)) : nil
        p.utilisation = limit > 0 ? outstanding / limit * 100 : nil
        p.lifetimeSpend = money(hist.reduce(0) { $0 + $1.spend }); p.interestPaid = money(hist.reduce(0) { $0 + $1.interest }); p.rewards = money(hist.reduce(0) { $0 + $1.reward })
        p.peakBalance = money(tracked.reduce(0) { max($0, $1.closing ?? 0) })
        p.peakUtilisation = limit > 0 ? p.peakBalance / limit * 100 : nil
        p.transactionCount = mine.count
        let dates = mine.map { $0["date"].text }.filter { !$0.isEmpty }.sorted()
        p.lastUsed = dates.last
        p.daysIdle = p.lastUsed.flatMap(parseLocal).map { Int((now.timeIntervalSince($0) / 86400).rounded(.down)) }
        p.cycle = cycle(card, now: now)
        p.history = hist
        let recent = hist.suffix(6)
        p.averageMonthlySpend = recent.isEmpty ? 0 : money(recent.reduce(0) { $0 + $1.spend } / Double(recent.count))
        let rev = hist.filter { $0.revolved && $0.shortfall > 1 }
        p.revolvingMonths = rev.count; p.worstShortfall = rev.reduce(0) { max($0, $1.shortfall) }
        p.interestMonths = hist.filter { $0.interest > 0 }.map { ($0.month, $0.interest) }
        var order: [String] = [], by: [String: Double] = [:]
        for t in mine where classify(t) == .spend {
            let c = t["category"].truthy ? t["category"].text.lowercased() : "uncategorised"
            if by[c] == nil { order.append(c) }
            by[c] = money((by[c] ?? 0) + abs(t["amount"].double))
        }
        p.topCategories = Array(order.map { ($0, by[$0]!) }.enumerated().sorted { $0.element.1 != $1.element.1 ? $0.element.1 > $1.element.1 : $0.offset < $1.offset }.map { (category: $0.element.0, amount: $0.element.1) }.prefix(8))
        return p
    }

    static func profiles(creditCards: JSONValue, expenses: JSONValue, now: Date = Date()) -> [Profile] {
        let txs = transactions(expenses)
        return creditCards.array.filter { !$0.isNull }.map { profile($0, txs, now: now) }
            .enumerated().sorted { $0.element.lifetimeSpend != $1.element.lifetimeSpend ? $0.element.lifetimeSpend > $1.element.lifetimeSpend : $0.offset < $1.offset }.map(\.element)
    }

    struct Totals: Equatable {
        var cards = 0, wallets = 0
        var limit = 0.0, outstanding = 0.0, available = 0.0, utilisation = 0.0, interestPaid = 0.0, lifetimeSpend = 0.0
        var revolvingMonths = 0
        var idle: [String] = []
        var highestUtilisation: String?
    }

    static func totals(_ ps: [Profile]) -> Totals {
        let real = ps.filter { !$0.isWallet }
        var t = Totals()
        t.cards = real.count; t.wallets = ps.count - real.count
        let limit = real.reduce(0) { $0 + $1.limit }, out = real.reduce(0) { $0 + $1.outstanding }
        t.limit = money(limit); t.outstanding = money(out); t.available = money(max(0, limit - out)); t.utilisation = limit > 0 ? out / limit * 100 : 0
        t.interestPaid = money(ps.reduce(0) { $0 + $1.interestPaid }); t.lifetimeSpend = money(ps.reduce(0) { $0 + $1.lifetimeSpend })
        t.revolvingMonths = ps.reduce(0) { $0 + $1.revolvingMonths }
        t.idle = ps.filter { ($0.daysIdle ?? -1) > 90 && !$0.isWallet }.map(\.name)
        t.highestUtilisation = real.filter { $0.utilisation != nil }.enumerated().sorted { $0.element.utilisation! != $1.element.utilisation! ? $0.element.utilisation! > $1.element.utilisation! : $0.offset < $1.offset }.first?.element.name
        return t
    }

    // MARK: The Cards page (`pages/CreditCardDetails.jsx`)

    /// What each card shows on the list: what is due, wallet balance, reward points. Matching
    /// here is the page's own looser rule (names contained in one another), kept as written.
    struct ListCard: Identifiable, Equatable {
        let raw: JSONValue
        var id: String { raw["id"].text }
        var name: String { raw["name"].text }
        var isWallet: Bool { raw["type"].text == "wallet" }
        var spend = 0.0, wallet = 0.0, points = 0.0, pending = 0.0
        var due: Double { pending > 0 ? pending : spend }
        var unbilled: Bool { pending <= 0 }
    }

    private static func listMatch(_ txName: String, _ card: String, aliases known: [String] = []) -> Bool {
        txName == card || card.contains(txName) || txName.contains(card) || known.contains(txName)
    }

    static func listCards(creditCards: JSONValue, expenses: JSONValue) -> (cards: [ListCard], totalDue: Double) {
        let txs = transactions(expenses)
        var out: [ListCard] = []
        var totalDue = 0.0
        for card in creditCards.array where !card.isNull {
            var c = ListCard(raw: card)
            let name = card["name"].text.trimmingCharacters(in: .whitespaces).lowercased()
            let base = baseline(card)
            // Spend since the baseline, excluding reward-point redemptions.
            var spend = 0.0
            for tx in txs {
                let txName = tx["creditCardName"].text.trimmingCharacters(in: .whitespaces).lowercased()
                guard listMatch(txName, name, aliases: aliases[name] ?? []) else { continue }
                if tx["isRewardPoints"].truthy { continue }
                if let base, let d = parseLocal(tx["date"].text), d < base { continue }
                let cat = tx["category"].text.lowercased(), amt = tx["amount"].double
                if paymentCategories.contains(cat) { spend -= amt } else { spend += tx["isCredited"].truthy ? -amt : amt }
            }
            c.spend = max(0, spend)
            // Wallet balance: money loaded less money spent from it.
            var wallet = 0.0
            for tx in txs {
                let txName = tx["creditCardName"].text.trimmingCharacters(in: .whitespaces).lowercased()
                guard listMatch(txName, name) else { continue }
                let cat = tx["category"].text.lowercased(), amt = tx["amount"].double
                if !paymentCategories.contains(cat) { wallet += tx["isCredited"].truthy ? amt : -amt }
            }
            c.wallet = wallet
            c.pending = card["monthlyData"].array.filter { !$0["isPaid"].truthy }.reduce(0) { $0 + $1["billAmount"].double }
            // Reward points: statement points plus anything entered, less points spent; or earned from spend at 2% (Scapia 10%).
            let ptsSpent = txs.filter { $0["creditCardName"].text.trimmingCharacters(in: .whitespaces).lowercased() == name && $0["isRewardPoints"].truthy }.reduce(0) { $0 + $1["amount"].double * 5 }
            let stmt = card["monthlyData"].array.reduce(0) { $0 + $1["points"].double }
            let manual = card["manualPoints"].double != 0 ? card["manualPoints"].double : card["rewardPoints"].double
            if stmt > 0 || manual > 0 { c.points = max(0, stmt + manual - ptsSpent) }
            else {
                var earned = 0.0
                for tx in txs {
                    let txName = tx["creditCardName"].text.trimmingCharacters(in: .whitespaces).lowercased()
                    guard listMatch(txName, name) else { continue }
                    let cat = tx["category"].text.lowercased()
                    if !paymentCategories.contains(cat) && !tx["isCredited"].truthy && !tx["isRewardPoints"].truthy {
                        earned += Money.jsRound(tx["amount"].double * (name.contains("scapia") ? 0.10 : 0.02))
                    }
                }
                c.points = max(0, earned - ptsSpent)
            }
            if !c.isWallet { totalDue += c.pending > 0 ? c.pending : c.spend }
            out.append(c)
        }
        return (out, totalDue)
    }
}
