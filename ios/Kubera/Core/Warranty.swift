import Foundation

/// Warranty, receipts and service history for owned items — a port of `utils/warranty.js`.
/// Everything is derived from fields on the asset item; `unknown` (nobody recorded a warranty)
/// is deliberately not `expired` (a fact), and land is excluded because it can never carry cover.
enum Warranty {
    static let expiringSoonDays = 60

    private static func toDate(_ v: JSONValue) -> Date? { v.truthy ? JSDate.parse(v) : nil }
    private static func iso(_ d: Date) -> String { Recurring.isoDay(d) }
    private static let cal = Calendar.current

    static func addMonths(_ date: Date, _ months: Int) -> Date { cal.date(byAdding: .month, value: months, to: date) ?? date }

    private static func periodExpiry(_ item: JSONValue, _ explicit: String, _ monthsField: String) -> Date? {
        if let e = toDate(item[explicit]) { return e }
        let months = item[monthsField].double
        guard months > 0, let purchased = toDate(item["purchaseDate"]) else { return nil }
        return addMonths(purchased, Int(months))
    }
    static func manufacturerExpiry(_ item: JSONValue) -> Date? { periodExpiry(item, "warrantyExpiry", "warrantyMonths") }
    static func extendedExpiry(_ item: JSONValue) -> Date? { periodExpiry(item, "extendedExpiry", "extendedMonths") }
    static func coverExpiry(_ item: JSONValue) -> Date? {
        let base = manufacturerExpiry(item), ext = extendedExpiry(item)
        switch (base, ext) { case (nil, nil): return nil; case let (b?, nil): return b; case let (nil, e?): return e; case let (b?, e?): return e > b ? e : b }
    }

    enum State: String { case active, expiring, expired, unknown
        var label: String { switch self { case .active: "In warranty"; case .expiring: "Expiring soon"; case .expired: "Out of warranty"; case .unknown: "Not recorded" } } }

    struct Status: Equatable { let state: State; let expiryIso: String?; let daysLeft: Int?; let extended: Bool }

    static func status(_ item: JSONValue, today: Date = Date()) -> Status {
        guard let expiry = coverExpiry(item) else { return Status(state: .unknown, expiryIso: nil, daysLeft: nil, extended: false) }
        let now = cal.startOfDay(for: today)
        let days = Int(Money.jsRound(expiry.timeIntervalSince(now) * 1000 / 86_400_000))
        let ext = extendedExpiry(item)
        let extended = ext != nil && ext! == expiry && ext! > (manufacturerExpiry(item) ?? Date(timeIntervalSince1970: 0))
        let state: State = days < 0 ? .expired : days <= expiringSoonDays ? .expiring : .active
        return Status(state: state, expiryIso: iso(expiry), daysLeft: days, extended: extended)
    }

    static func receipts(_ item: JSONValue) -> [JSONValue] {
        if case .array(let list) = item["receipts"] { return list.filter { $0.truthy } }
        return item["receiptUrl"].truthy ? [.object(["url": item["receiptUrl"], "name": .string("Receipt")])] : []
    }

    struct ServiceTotals: Equatable { var count = 0; var paid = 0.0, covered = 0.0; var total: Double { paid + covered } }
    static func serviceTotals(_ item: JSONValue) -> ServiceTotals {
        var t = ServiceTotals()
        for s in item["services"].array where s.truthy { t.count += 1; if s["underWarranty"].truthy { t.covered += s["cost"].double } else { t.paid += s["cost"].double } }
        return t
    }

    struct Row: Identifiable, Equatable {
        let item: JSONValue
        let categoryId: String, categoryName: String
        let status: Status
        let services: ServiceTotals
        var id: String { "\(categoryId)/\(item["id"].text)/\(item["name"].text)" }
        var name: String { item["name"].text }
    }

    static func rows(assets: JSONValue, today: Date = Date()) -> [Row] {
        var out: [Row] = []
        for category in assets.array where !category.isNull {
            let name = [category["title"], category["category"], category["name"]].first { $0.truthy }?.text ?? "Assets"
            if category["type"].text == "real_estate" || name.range(of: "plot|apartment|land", options: [.regularExpression, .caseInsensitive]) != nil { continue }
            for item in category["items"].array where item.truthy {
                out.append(Row(item: item, categoryId: category["id"].text, categoryName: name, status: status(item, today: today), services: serviceTotals(item)))
            }
        }
        return out.enumerated().sorted { a, b in
            let (x, y) = (a.element, b.element)
            let xu = x.status.state == .unknown, yu = y.status.state == .unknown
            if xu != yu { return yu }
            if xu { let c = x.name.compare(y.name, locale: Locale(identifier: "en")); return c != .orderedSame ? c == .orderedAscending : a.offset < b.offset }
            if x.status.daysLeft! != y.status.daysLeft! { return x.status.daysLeft! < y.status.daysLeft! }
            return a.offset < b.offset
        }.map(\.element)
    }

    struct Summary: Equatable {
        var total = 0, active = 0, expiring = 0, expired = 0, unknown = 0, missingReceipt = 0
        var rows: [Row] = []
    }
    static func summary(assets: JSONValue, today: Date = Date()) -> Summary {
        var s = Summary(); s.rows = rows(assets: assets, today: today); s.total = s.rows.count
        for r in s.rows {
            switch r.status.state { case .active: s.active += 1; case .expiring: s.expiring += 1; case .expired: s.expired += 1; case .unknown: s.unknown += 1 }
            if receipts(r.item).isEmpty { s.missingReceipt += 1 }
        }
        return s
    }
}
