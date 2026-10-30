import Foundation

/// IPOs applied for, including the ones that came to nothing. Port of
/// `utils/ipoApplications.js`. The failures are the point: without them an
/// allotment rate has no denominator and blocked capital is invisible.
enum IpoPage {
    struct Application: Identifiable, Equatable {
        let id: String
        let company: String
        let symbol: String
        let category: String
        let status: String
        let appliedDate: String
        let lots: Double
        let sharesApplied: Double
        let sharesAllotted: Double
        let cutOffPrice: Double
        let listingPrice: Double
        let amountBlocked: Double
        let investedAtAllotment: Double
        let refunded: Double
        let listingGain: Double
        let listingGainPct: Double?
        let hasListing: Bool
        let daysBlocked: Int?
        let notes: String
        let linkedStockId: String?
        var pending: Bool { status == "applied" }
        var allotted: Bool { status == "allotted" || status == "partial" }
        var decided: Bool { allotted || status == "not-allotted" }
    }

    /// One application with what it cost and what it returned. Listing gain is
    /// measured against the price actually paid, not the upper band.
    static func application(_ app: JSONValue) -> Application {
        let lots = app["lots"].double, perLot = app["sharesPerLot"].double, price = app["cutOffPrice"].double
        let sharesApplied = lots * perLot
        // ASBA blocks the full application value whatever is later allotted.
        let blocked = app["amountBlocked"].double != 0 ? app["amountBlocked"].double : sharesApplied * price
        let status = app["status"].truthy ? app["status"].text : "applied"
        let allottedStatus = status == "allotted" || status == "partial"
        let allotted = allottedStatus ? app["sharesAllotted"].double : 0
        let invested = allotted * price
        let refunded = max(0, blocked - invested)
        let listing = app["listingPrice"].double
        let hasListing = allottedStatus && listing > 0 && price > 0
        let gain = hasListing ? allotted * (listing - price) : 0

        var days: Int?
        let endRaw = app["refundDate"].truthy ? app["refundDate"] : app["allotmentDate"]
        if app["appliedDate"].truthy, endRaw.truthy, let start = JSDate.parse(app["appliedDate"]), let end = JSDate.parse(endRaw) {
            days = max(0, Int(Money.jsRound(end.timeIntervalSince(start) * 1000 / 86_400_000)))
        }
        return Application(
            id: app["id"].text, company: app["company"].truthy ? app["company"].text : "Unnamed IPO", symbol: app["symbol"].text,
            category: app["category"].truthy ? app["category"].text : "retail", status: status, appliedDate: app["appliedDate"].text,
            lots: lots, sharesApplied: sharesApplied, sharesAllotted: allotted, cutOffPrice: price, listingPrice: listing,
            amountBlocked: Money.round2(blocked), investedAtAllotment: Money.round2(invested), refunded: Money.round2(refunded),
            listingGain: Money.round2(gain), listingGainPct: hasListing && price > 0 ? (listing - price) / price * 100 : nil,
            hasListing: hasListing, daysBlocked: days, notes: app["notes"].text,
            linkedStockId: app["linkedStockId"].truthy ? app["linkedStockId"].text : nil)
    }

    struct Summary: Equatable {
        var applications: [Application] = []
        var decidedCount = 0, allottedCount = 0, pendingCount = 0
        var allotmentRate: Double?
        var capitalBlockedNow = 0.0, totalApplied = 0.0, totalInvested = 0.0, totalRefunded = 0.0, listingGain = 0.0
        var listingGainCount = 0, missingListingPrice = 0
        var unlinkedAllotments: [(id: String, name: String)] = []
        var total: Int { applications.count }
        static func == (a: Summary, b: Summary) -> Bool { a.applications == b.applications && a.totalApplied == b.totalApplied }
    }

    /// The account's stocks are needed to spot an allotment no application points at.
    static func summary(applications raw: JSONValue, stocks: [JSONValue]) -> Summary {
        // Newest application first.
        let rows = raw.array.filter { !$0.isNull }.map(application).enumerated()
            .sorted { $0.element.appliedDate == $1.element.appliedDate ? $0.offset < $1.offset : $0.element.appliedDate > $1.element.appliedDate }.map(\.element)
        let decided = rows.filter(\.decided), allotted = rows.filter(\.allotted), pending = rows.filter(\.pending)
        let withListing = allotted.filter(\.hasListing)
        let linked = Set(rows.compactMap(\.linkedStockId))
        let unlinked = stocks.filter { s in
            !s.isNull && s["transactions"].array.contains { $0["type"].text == "ipo" } && !linked.contains(s["id"].text)
        }
        var out = Summary(applications: rows)
        out.decidedCount = decided.count; out.allottedCount = allotted.count; out.pendingCount = pending.count
        out.allotmentRate = decided.isEmpty ? nil : Double(allotted.count) / Double(decided.count) * 100
        out.capitalBlockedNow = Money.round2(pending.reduce(0) { $0 + $1.amountBlocked })
        out.totalApplied = Money.round2(rows.reduce(0) { $0 + $1.amountBlocked })
        out.totalInvested = Money.round2(allotted.reduce(0) { $0 + $1.investedAtAllotment })
        out.totalRefunded = Money.round2(rows.reduce(0) { $0 + $1.refunded })
        out.listingGain = Money.round2(withListing.reduce(0) { $0 + $1.listingGain })
        out.listingGainCount = withListing.count
        out.missingListingPrice = allotted.count - withListing.count
        out.unlinkedAllotments = unlinked.map { (id: $0["id"].text, name: [$0["name"], $0["ticker"]].first { $0.truthy }?.text ?? "") }
        return out
    }
}
