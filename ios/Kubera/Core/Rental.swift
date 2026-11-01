import Foundation

/// Rent, bills and costs recorded against a property or an owned good — a port of `utils/rental.js`.
/// Self-contained inside Assets: none of it flows into the monthly income or expense totals.
enum Rental {
    struct Kind: Equatable {
        let key: String, label: String
        let income: Bool                // direction: money in, otherwise out
        let countsAsYield: Bool
        var hasPeriod = false           // belongs to a month rather than to the day it was paid
        var scope: String               // "property", "goods" or "both"
        var legacy = false
    }

    /// In the Mac's order, which is the order the entry form offers them.
    static let kinds: [Kind] = [
        Kind(key: "rent", label: "Rent", income: true, countsAsYield: true, hasPeriod: true, scope: "property"),
        Kind(key: "advance", label: "Advance / Deposit", income: true, countsAsYield: false, scope: "property"),
        Kind(key: "advance_refund", label: "Advance Refunded", income: false, countsAsYield: false, scope: "property"),
        Kind(key: "current_bill", label: "Current Bill", income: false, countsAsYield: true, hasPeriod: true, scope: "property"),
        Kind(key: "bill_recovered", label: "Bill Recovered from Tenant", income: true, countsAsYield: true, hasPeriod: true, scope: "property", legacy: true),
        Kind(key: "property_tax", label: "Property Tax", income: false, countsAsYield: true, hasPeriod: true, scope: "property"),
        Kind(key: "maintenance", label: "Maintenance / Repairs", income: false, countsAsYield: true, scope: "both"),
        Kind(key: "installation", label: "Installation / Fitting", income: false, countsAsYield: true, scope: "both"),
        Kind(key: "consumables", label: "Consumables / Parts", income: false, countsAsYield: true, scope: "goods"),
        Kind(key: "amc", label: "AMC / Service Plan", income: false, countsAsYield: true, scope: "goods"),
        Kind(key: "resale", label: "Sold / Resale Value", income: true, countsAsYield: true, scope: "goods"),
        Kind(key: "other_income", label: "Other Income", income: true, countsAsYield: true, scope: "both"),
        Kind(key: "other_expense", label: "Other Expense", income: false, countsAsYield: true, scope: "both"),
    ]

    static func kind(_ key: String) -> Kind? { kinds.first { $0.key == key } }

    /// Entries saved before kinds existed carry only `type: income | expense`.
    static func kindOf(_ entry: JSONValue) -> String {
        if kind(entry["kind"].text) != nil { return entry["kind"].text }
        return entry["type"].text == "expense" ? "other_expense" : "other_income"
    }

    /// What the form offers for one sort of asset; the entry's own kind is always kept.
    static func kindsFor(isRealEstate: Bool, keep: String? = nil) -> [Kind] {
        kinds.filter { k in
            if k.key == keep { return true }
            if k.legacy { return false }
            let wanted = isRealEstate ? "property" : "goods"
            return k.scope == wanted || k.scope == "both"
        }
    }

    // MARK: Periods

    private static let monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]

    private static func match(_ pattern: String, _ s: String) -> [String]? {
        guard let re = try? NSRegularExpression(pattern: pattern), let m = re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) else { return nil }
        return (0..<m.numberOfRanges).map { i in Range(m.range(at: i), in: s).map { String(s[$0]) } ?? "" }
    }

    private static func pad(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }

    /// The `YYYY-MM` a period refers to, whatever shape it was typed in.
    static func parsePeriod(_ value: String) -> String? {
        let raw = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.isEmpty { return nil }
        if let iso = match(#"^(\d{4})-(\d{1,2})(?:-\d{1,2})?$"#, raw) {
            let month = Int(iso[2]) ?? 0
            return (1...12).contains(month) ? "\(iso[1])-\(pad(month))" : nil
        }
        guard let year = match(#"\b(19|20)\d{2}\b"#, raw)?[0] else { return nil }
        let lower = raw.lowercased()
        if let i = monthNames.firstIndex(where: { lower.contains($0.prefix(3)) }) { return "\(year)-\(pad(i + 1))" }
        if let n = match(#"^\s*(\d{1,2})\s*[/\-.\s]\s*(\d{4})\s*$"#, raw) ?? match(#"^\s*(\d{4})\s*[/\-.\s]\s*(\d{1,2})\s*$"#, raw) {
            let month = Int(n[1].count == 4 ? n[2] : n[1]) ?? 0
            if (1...12).contains(month) { return "\(year)-\(pad(month))" }
        }
        return nil
    }

    static func formatPeriod(_ value: String) -> String {
        guard let key = parsePeriod(value) else { return value }
        let p = key.split(separator: "-")
        let name = monthNames[(Int(p[1]) ?? 1) - 1]
        return "\(name.prefix(1).uppercased())\(name.dropFirst()) \(p[0])"
    }

    private static func ymd(_ iso: String) -> (Int, Int, Int)? {
        let p = iso.prefix(10).split(separator: "-").compactMap { Int($0) }
        return p.count >= 3 ? (p[0], p[1], p[2]) : nil
    }

    private static func monthsBetween(_ from: String, _ to: String) -> Int {
        guard !from.isEmpty, !to.isEmpty, let (fy, fm, fd) = ymd(from), let (ty, tm, td) = ymd(to), fy != 0, ty != 0 else { return 0 }
        var months = (ty - fy) * 12 + (tm - fm)
        if td < fd { months -= 1 }
        return months
    }

    /// `asOf.toISOString().slice(0, 10)` — the UTC calendar day.
    static func utcDay(_ d: Date) -> String {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.timeZone = TimeZone(identifier: "UTC"); f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"; return f.string(from: d)
    }

    // MARK: Rent

    /// The monthly rent due on a date, once escalation has applied.
    static func expectedRent(_ rental: JSONValue, on iso: String) -> Double {
        let base = rental["monthlyRent"].double
        if base == 0 || !rental["leaseStart"].truthy { return base }
        let every = rental["escalationEveryMonths"].double != 0 ? rental["escalationEveryMonths"].double : 12
        let value = rental["escalationValue"].double
        if value == 0 || every <= 0 { return base }
        let elapsed = monthsBetween(rental["leaseStart"].text, iso)
        if elapsed < 0 { return base }
        let steps = Int((Double(elapsed) / every).rounded(.down))
        if steps <= 0 { return base }
        if rental["escalationType"].text == "fixed" { return base + value * Double(steps) }
        return base * pow(1 + value / 100, Double(steps))
    }

    // MARK: Who bears a cost

    enum Borne: String, CaseIterable { case owner, recovered, tenant
        var label: String { switch self { case .owner: "I paid it, and I am carrying it"; case .recovered: "I paid it, and the tenant pays me back"; case .tenant: "The tenant paid it directly" } }
        var short: String { switch self { case .owner: "You paid"; case .recovered: "Recovered"; case .tenant: "Tenant paid" } }
        var blurb: String { switch self {
            case .owner: "Counts as your expense in full."
            case .recovered: "Costs you nothing once repaid — enter a part amount if only some has come back."
            case .tenant: "Kept for the record. Never counted as your expense." } }
    }

    /// Whether the form asks who pays: an expense on a let property, other than returning a deposit.
    static func asksWhoPays(kind key: String, isRealEstate: Bool) -> Bool {
        isRealEstate && kind(key).map { !$0.income } == true && key != "advance_refund"
    }

    static func borneBy(_ entry: JSONValue) -> Borne { Borne(rawValue: entry["borne"].text.trimmingCharacters(in: .whitespaces).lowercased()) ?? .owner }

    /// What an entry cost you after the tenant's share.
    static func netCost(_ entry: JSONValue) -> Double {
        let amount = abs(entry["amount"].double)
        switch borneBy(entry) {
        case .tenant: return 0
        case .recovered:
            let raw = entry["recoveredAmount"]
            let back = raw.isNull || raw.text.isEmpty ? amount : min(amount, max(0, raw.double))
            return amount - back
        case .owner: return amount
        }
    }

    static func recoveredFrom(_ entry: JSONValue) -> Double { abs(entry["amount"].double) - netCost(entry) }

    // MARK: Summary

    struct KindTotals: Equatable { var total = 0.0, net = 0.0, recovered = 0.0; var count = 0 }

    struct Summary: Equatable {
        var byKind: [String: KindTotals] = [:]
        var rentReceived = 0.0, billsPaid = 0.0, billsRecovered = 0.0, billsBorne = 0.0, taxPaid = 0.0
        var maintenancePaid = 0.0, maintenanceBilled = 0.0, maintenanceRecovered = 0.0
        var depositHeld = 0.0, income = 0.0, expense = 0.0, coveredByTenant = 0.0, net = 0.0
    }

    static func summarise(_ entries: [JSONValue]) -> Summary {
        var by: [String: KindTotals] = Dictionary(uniqueKeysWithValues: kinds.map { ($0.key, KindTotals()) })
        for e in entries {
            let k = kindOf(e), meta = kind(k)!
            let amount = abs(e["amount"].double)
            var t = by[k]!
            t.total += amount
            t.net += meta.income ? amount : netCost(e)
            t.recovered += meta.income ? 0 : recoveredFrom(e)
            t.count += 1
            by[k] = t
        }
        let income = kinds.filter { $0.income && $0.countsAsYield }.reduce(0) { $0 + by[$1.key]!.total }
        let expense = kinds.filter { !$0.income && $0.countsAsYield }.reduce(0) { $0 + by[$1.key]!.net }
        let separate = by["bill_recovered"]!.total
        let adjExpense = max(0, expense - separate)
        var s = Summary(byKind: by)
        s.rentReceived = by["rent"]!.total
        s.billsPaid = by["current_bill"]!.total
        s.billsRecovered = by["current_bill"]!.recovered + separate
        s.billsBorne = max(0, by["current_bill"]!.net - separate)
        s.taxPaid = by["property_tax"]!.net
        s.maintenancePaid = by["maintenance"]!.net
        s.maintenanceBilled = by["maintenance"]!.total
        s.maintenanceRecovered = by["maintenance"]!.recovered
        s.depositHeld = by["advance"]!.total - by["advance_refund"]!.total
        s.income = income
        s.expense = adjExpense
        s.coveredByTenant = by.values.reduce(0) { $0 + $1.recovered } + separate
        s.net = income - adjExpense
        return s
    }

    // MARK: Ledgers

    private static func periodKey(_ e: JSONValue) -> String? {
        e["period"].truthy ? parsePeriod(e["period"].text) : parsePeriod(String(e["date"].text.prefix(7)))
    }

    struct BillRow: Equatable { let month: String; var billed = 0.0, recovered = 0.0, tenantPaid = 0.0; var borne: Double { billed - recovered } }
    struct BillLedger: Equatable { var rows: [BillRow] = []; var unplaced: [JSONValue] = [] }

    /// Bills by the month they belong to — what was billed, what came back, what the tenant paid directly.
    static func billLedger(_ entries: [JSONValue]) -> BillLedger {
        var months: [String: BillRow] = [:]
        var unplaced: [JSONValue] = []
        for e in entries {
            let k = kindOf(e)
            if k != "current_bill" && k != "bill_recovered" { continue }
            guard let key = periodKey(e) else { unplaced.append(e); continue }
            var row = months[key] ?? BillRow(month: key)
            let amount = abs(e["amount"].double)
            if k == "bill_recovered" { row.recovered += amount; months[key] = row; continue }
            if borneBy(e) == .tenant { row.tenantPaid += amount; months[key] = row; continue }
            row.billed += amount
            row.recovered += recoveredFrom(e)
            months[key] = row
        }
        return BillLedger(rows: months.values.sorted { $0.month > $1.month }, unplaced: unplaced)
    }

    struct RentRow: Equatable { let month: String; let due: Double; let received: Double; var shortfall: Double { max(0, due - received) } }
    struct RentLedger: Equatable { var rows: [RentRow] = []; var unplaced: [(entry: JSONValue, outsideLease: Bool)] = []
        static func == (a: RentLedger, b: RentLedger) -> Bool { a.rows == b.rows && a.unplaced.count == b.unplaced.count }
        var arrears: Double { rows.reduce(0) { $0 + $1.shortfall } }
    }

    /// Month by month from the lease start to today (or the lease end): what was due, what arrived.
    static func rentLedger(_ rental: JSONValue, entries: [JSONValue], asOf: Date = Date()) -> RentLedger {
        guard rental["leaseStart"].truthy, rental["monthlyRent"].double != 0 else { return RentLedger() }
        let today = utcDay(asOf)
        let end = rental["leaseEnd"].truthy && rental["leaseEnd"].text < today ? rental["leaseEnd"].text : today
        var received: [String: Double] = [:]
        var unplaced: [(JSONValue, Bool)] = []
        let rentEntries = entries.filter { kindOf($0) == "rent" }
        for e in rentEntries {
            if let key = periodKey(e) { received[key, default: 0] += abs(e["amount"].double) } else { unplaced.append((e, false)) }
        }
        guard let (sy, sm, _) = ymd(rental["leaseStart"].text) else { return RentLedger() }
        let total = monthsBetween(rental["leaseStart"].text, end)
        var rows: [RentRow] = []
        if total >= 0 {
            for i in 0...total {
                let index = sm - 1 + i
                let year = sy + Int((Double(index) / 12).rounded(.down)), month = ((index % 12) + 12) % 12 + 1
                let key = "\(year)-\(pad(month))"
                rows.append(RentRow(month: key, due: expectedRent(rental, on: "\(key)-01"), received: received[key] ?? 0))
            }
        }
        rows.reverse()
        let covered = Set(rows.map(\.month))
        for e in rentEntries { if let key = periodKey(e), !covered.contains(key) { unplaced.append((e, true)) } }
        return RentLedger(rows: rows, unplaced: unplaced.map { (entry: $0.0, outsideLease: $0.1) })
    }
}
