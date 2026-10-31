import Foundation

/// Every transaction, newest first, with the page's filters and the "wasteful" tally — a port
/// of the memos in `pages/AllTransactions.jsx` and `utils/wasteful.js`. A wasteful flag is set by
/// hand, never inferred, and only counts on debits.
enum AllTransactions {
    struct Row: Identifiable, Equatable {
        let raw: JSONValue
        let year: String, month: String
        let time: Double
        var id: String { "\(raw["id"].text)#\(offset)" }
        let offset: Int
        var title: String { raw["title"].text }
        var category: String { raw["category"].text }
        var date: String { raw["date"].text }
        var amount: Double { raw["amount"].double }
        var isCredited: Bool { raw["isCredited"].truthy }
        var isWasteful: Bool { raw["wasteful"].isTrue }
    }

    static func list(_ expenses: JSONValue) -> [Row] {
        var rows: [Row] = []
        let monthOrder = SalaryPage.months
        for (year, months) in expenses.object.sorted(by: { (Int($0.key) ?? 0) < (Int($1.key) ?? 0) }) {
            for (month, data) in months.object.sorted(by: { (monthOrder.firstIndex(of: $0.key) ?? 99) < (monthOrder.firstIndex(of: $1.key) ?? 99) }) {
                for t in data["transactions"].array {
                    guard let d = JSDate.parse(t["date"]) else { continue }
                    rows.append(Row(raw: t, year: year, month: month, time: d.timeIntervalSince1970, offset: rows.count))
                }
            }
        }
        return rows.sorted { $0.time != $1.time ? $0.time > $1.time : $0.offset < $1.offset }
    }

    enum TypeFilter: String, CaseIterable, Identifiable { case all = "All", credit = "In", debit = "Out"; var id: String { rawValue } }

    static func years(_ rows: [Row]) -> [String] { Array(Set(rows.map(\.year))).sorted(by: >) }
    static func categories(_ rows: [Row]) -> [String] { Array(Set(rows.compactMap { $0.category.isEmpty ? nil : $0.category.lowercased() })).sorted() }

    static func filter(_ rows: [Row], search: String = "", type: TypeFilter = .all, year: String = "all", month: String = "all", category: String = "all",
                       subCategory: String = "all", onlyWasteful: Bool = false, issue: String? = nil, map: [(main: String, subs: [String])] = []) -> [Row] {
        let q = search.lowercased()
        let subs = map.first { $0.main == category }?.subs.map { $0.lowercased() } ?? []
        return rows.filter { t in
            let matchesSearch = q.isEmpty || t.title.lowercased().contains(q) || t.category.lowercased().contains(q)
            let matchesType = type == .all || (type == .credit ? t.isCredited : !t.isCredited)
            if !matchesSearch || !matchesType { return false }
            if year != "all" && t.year != year { return false }
            if month != "all" && t.month != month { return false }
            if let issue {
                if issue == "vague-category" { if !DataHealth.vague.contains(t.category.trimmingCharacters(in: .whitespaces).lowercased()) { return false } }
                else if issue == "no-title" { if !t.title.trimmingCharacters(in: .whitespaces).isEmpty { return false } }
            }
            if category != "all" {
                if subCategory != "all" { if t.category.lowercased() != subCategory.lowercased() { return false } }
                else if !(t.raw["mainCategory"].text == category || subs.contains(t.category.lowercased())) { return false }
            }
            if onlyWasteful && !t.isWasteful { return false }
            return true
        }
    }

    struct Waste: Equatable {
        var total = 0.0
        var count = 0
        var byCategory: [(category: String, amount: Double)] = []
        static func == (a: Waste, b: Waste) -> Bool { a.total == b.total && a.count == b.count }
    }

    static func waste(_ rows: [Row]) -> Waste {
        var w = Waste(), by: [String: Double] = [:], order: [String] = []
        for r in rows where r.isWasteful && TransactionKind.isDebit(r.raw) {
            let amount = abs(r.amount)
            w.total += amount; w.count += 1
            let c = r.raw["category"].truthy ? r.category.lowercased() : "uncategorised"
            if by[c] == nil { order.append(c) }
            by[c, default: 0] += amount
        }
        w.total = Money.round2(w.total)
        w.byCategory = order.map { ($0, Money.round2(by[$0]!)) }.enumerated().sorted { $0.element.1 != $1.element.1 ? $0.element.1 > $1.element.1 : $0.offset < $1.offset }.map { (category: $0.element.0, amount: $0.element.1) }
        return w
    }
}
