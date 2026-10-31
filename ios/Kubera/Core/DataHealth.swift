import Foundation

/// Data-quality checks over the history — a port of `utils/dataHealth.js`. Each check is
/// deterministic: a count, a sample of the offending rows, and a hint. Nothing is repaired.
enum DataHealth {
    static let vague: Set<String> = ["other", "others", "miscellaneous", "misc", "uncategorized", "uncategorised", "unknown", ""]
    enum Severity: String { case high, medium, low, ok
        var rank: Int { switch self { case .high: 0; case .medium: 1; case .low: 2; case .ok: 3 } } }

    struct Sample: Equatable { var date: String?; var amount: Double?; var label: String }
    struct Check: Identifiable, Equatable {
        let id: String, title: String
        let severity: Severity
        let count: Int
        var total = 0.0
        let detail: String, fix: String
        var sample: [Sample] = []
    }

    private static func money(_ v: Double) -> Double { v }
    private static func canonical(_ name: String) -> String {
        var s = String(name.lowercased().unicodeScalars.filter { ("a"..."z").contains($0) })
        if s.hasSuffix("s") { s.removeLast() }
        return s
    }

    static func run(expenses: JSONValue, salaryDetails: JSONValue, creditCards: JSONValue, assets: JSONValue, today: Date = Date()) -> [Check] {
        // `_year` / `_month` are the node a transaction was found under, as in the web code.
        struct Tx { let t: JSONValue; let year: String; let month: String }
        var tx: [Tx] = []
        let monthOrder = SalaryPage.months
        for (year, months) in expenses.object.sorted(by: { (Int($0.key) ?? 0) < (Int($1.key) ?? 0) }) {
            for (month, node) in months.object.sorted(by: { (monthOrder.firstIndex(of: $0.key) ?? 99) < (monthOrder.firstIndex(of: $1.key) ?? 99) }) {
                for t in node["transactions"].array where !t.isNull { tx.append(Tx(t: t, year: year, month: month)) }
            }
        }
        var checks: [Check] = []
        func cat(_ t: JSONValue) -> String { t["category"].text.trimmingCharacters(in: .whitespaces).lowercased() }
        func amount(_ t: JSONValue) -> Double { abs(t["amount"].double) }

        let vagueRows = tx.filter { vague.contains(cat($0.t)) }
        checks.append(Check(id: "vague-category", title: "Transactions with a vague category", severity: vagueRows.count > 200 ? .high : .medium, count: vagueRows.count,
                            total: vagueRows.reduce(0) { $0 + amount($1.t) },
                            detail: "Categorised \"other\" or left blank, so they are invisible in every category breakdown.",
                            fix: "Assign real categories, ideally by adding merchant rules so similar rows are handled once.",
                            sample: vagueRows.prefix(8).map { Sample(date: $0.t["date"].text, amount: $0.t["amount"].double, label: $0.t["title"].truthy ? $0.t["title"].text : "(no title)") }))

        let untitled = tx.filter { $0.t["title"].text.trimmingCharacters(in: .whitespaces).isEmpty }
        checks.append(Check(id: "no-title", title: "Transactions with no description", severity: untitled.count > 200 ? .high : .medium, count: untitled.count,
                            total: untitled.reduce(0) { $0 + amount($1.t) }, detail: "Nothing recorded about what the money was for — these cannot be recognised later.",
                            fix: "Add a merchant or purpose. Statement re-imports can often refill these.",
                            sample: untitled.prefix(8).map { Sample(date: $0.t["date"].text, amount: $0.t["amount"].double, label: $0.t["category"].truthy ? $0.t["category"].text : "uncategorised") }))

        var canon: [String: [String: Int]] = [:], canonOrder: [String] = []
        for x in tx {
            let raw = cat(x.t); if raw.isEmpty { continue }
            let key = canonical(raw); if key.isEmpty { continue }
            if canon[key] == nil { canon[key] = [:]; canonOrder.append(key) }
            canon[key]![raw, default: 0] += 1
        }
        let dup = canonOrder.compactMap { canon[$0] }.filter { $0.count > 1 }.map { $0.sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key } }
        checks.append(Check(id: "category-variants", title: "Categories that are the same thing spelled differently", severity: dup.count > 8 ? .medium : .low, count: dup.count,
                            detail: "Each of these splits one real category across two or more labels, so totals under-report.", fix: "Merge them from Budget Limits → Rename Category.",
                            sample: dup.prefix(8).map { Sample(label: $0.map { "\($0.key) (\($0.value))" }.joined(separator: "  ·  ")) }))

        var catCounts: [String: Int] = [:], catOrder: [String] = []
        for x in tx { let r = cat(x.t); if !r.isEmpty { if catCounts[r] == nil { catOrder.append(r) }; catCounts[r, default: 0] += 1 } }
        let rare = catOrder.filter { catCounts[$0]! <= 2 }
        checks.append(Check(id: "rare-categories", title: "Categories used two times or fewer", severity: rare.count > 60 ? .medium : .low, count: rare.count,
                            detail: "\(rare.reduce(0) { $0 + catCounts[$1]! }) transactions sit in \(rare.count) one-off categories, fragmenting your breakdowns.",
                            fix: "Fold them into an existing category unless the distinction genuinely matters.", sample: rare.prefix(10).map { Sample(label: "\($0) (\(catCounts[$0]!))") }))

        let wallets = creditCards.array.filter { $0["type"].text == "wallet" }.map { $0["name"].text.trimmingCharacters(in: .whitespaces) }
        if !wallets.isEmpty {
            var loads: [String: Double] = [:], loadOrder: [String] = []
            for x in tx where x.t["paymentMode"].text == "credit_card" && wallets.contains(x.t["creditCardName"].text.trimmingCharacters(in: .whitespaces)) && (x.t["isCredited"].truthy || x.t["transactionType"].text == "credit") {
                let key = "\(x.year)|\(x.month)"
                if loads[key] == nil { loadOrder.append(key) }
                loads[key, default: 0] += x.t["amount"].double
            }
            var payslip: [String: Double] = [:]
            for s in salaryDetails.array where s["type"].text == "monthly" { payslip["\(s["year"].text)|\(s["month"].text)"] = s["foodWallet"].double }
            let miss = loadOrder.filter { (payslip[$0] ?? 0) == 0 }
            checks.append(Check(id: "wallet-vs-payslip", title: "Wallet loaded, but the payslip shows no food allowance", severity: miss.count > 6 ? .high : .low, count: miss.count,
                                total: miss.reduce(0) { $0 + loads[$1]! },
                                detail: "The card was topped up in these months but foodWallet is blank on the payslip, so that income is missing from your inflow totals.",
                                fix: "Fill in foodWallet on those payslips from Salary.",
                                sample: miss.sorted().prefix(8).map { k in let p = k.split(separator: "|"); return Sample(amount: loads[k], label: "\(p[1]) \(p[0])") }))
        }

        func batchOf(_ id: String) -> String? {
            guard let r = id.range(of: "^import_\\d{10}", options: .regularExpression) else { return nil }
            return String(id[r].dropFirst(7))
        }
        var batches: [String: [JSONValue]] = [:], batchOrder: [String] = []
        for x in tx { if let b = batchOf(x.t["id"].text) { if batches[b] == nil { batchOrder.append(b) }; batches[b, default: []].append(x.t) } }
        func sig(_ t: JSONValue) -> String {
            let card = t["creditCardName"].truthy ? t["creditCardName"].text.trimmingCharacters(in: .whitespaces) : "-"
            return [card, String(t["date"].text.prefix(10)), String(Int(Money.jsRound(abs(t["amount"].double) * 100))), t["isCredited"].truthy || t["transactionType"].text == "credit" ? "c" : "d"].joined(separator: "|")
        }
        var overlaps: [(label: String, count: Int)] = []
        for i in 0..<batchOrder.count {
            for j in (i + 1)..<max(i + 1, batchOrder.count) {
                var a: [String: Int] = [:]
                batches[batchOrder[i]]!.forEach { a[sig($0), default: 0] += 1 }
                var shared = 0
                for t in batches[batchOrder[j]]! { let k = sig(t); if (a[k] ?? 0) > 0 { shared += 1; a[k]! -= 1 } }
                if shared > 2 { overlaps.append(("Batch \(batchOrder[i]) and \(batchOrder[j]) share \(shared) identical rows", shared)) }
            }
        }
        checks.append(Check(id: "duplicate-imports", title: "Statement imported twice", severity: overlaps.isEmpty ? .ok : .high, count: overlaps.reduce(0) { $0 + $1.count },
                            detail: overlaps.isEmpty ? "No import batch overlaps another. Every statement appears once." : "Two import runs contain the same card, date, amount and direction — the same statement was almost certainly loaded twice.",
                            fix: "Keep the batch with better descriptions and delete the rows the other duplicates.", sample: overlaps.prefix(6).map { Sample(label: $0.label) }))

        let noBilling = creditCards.array.filter { $0["type"].text != "wallet" && !$0["billingDay"].truthy }
        checks.append(Check(id: "card-billing-day", title: "Cards with no billing day", severity: noBilling.isEmpty ? .ok : .medium, count: noBilling.count,
                            detail: noBilling.isEmpty ? "Every credit card has a billing day." : "Without a billing day, statement periods and due-date forecasting cannot be calculated for these cards.",
                            fix: "Set the billing day on the card.", sample: noBilling.map { Sample(label: $0["name"].text) }))

        let w = Warranty.summary(assets: assets, today: today)
        let lapsing = w.rows.filter { $0.status.state == .expiring }
        checks.append(Check(id: "warranty-expiring", title: "Warranties expiring soon", severity: lapsing.isEmpty ? .ok : .medium, count: lapsing.count,
                            detail: lapsing.isEmpty ? "No warranty lapses in the next two months." : "Cover on these ends within \(Warranty.expiringSoonDays) days. Anything worth claiming or extending has to be done before then.",
                            fix: "Claim outstanding faults, or decide whether to buy extended cover before the window closes.",
                            sample: lapsing.prefix(8).map { Sample(date: $0.status.expiryIso, label: "\($0.name) — \($0.status.daysLeft ?? 0) days left") }))

        let noReceipt = w.rows.filter { Warranty.receipts($0.item).isEmpty && $0.status.state != .expired }
        checks.append(Check(id: "missing-receipt", title: "Items in warranty with no receipt", severity: noReceipt.count > 5 ? .medium : noReceipt.isEmpty ? .ok : .low, count: noReceipt.count,
                            detail: noReceipt.isEmpty ? "Every item still under cover has its receipt attached." : "Still covered, but with no bill attached — a claim is usually refused without proof of purchase.",
                            fix: "Attach the invoice on the item page. Expired items are excluded: the bill no longer helps there.", sample: noReceipt.prefix(8).map { Sample(label: $0.name) }))

        return checks.enumerated().sorted { a, b in
            if a.element.severity.rank != b.element.severity.rank { return a.element.severity.rank < b.element.severity.rank }
            if a.element.count != b.element.count { return a.element.count > b.element.count }
            return a.offset < b.offset
        }.map(\.element)
    }
}
