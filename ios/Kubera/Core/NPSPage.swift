import Foundation

/// The NPS page, as the Mac's `NPSDetails.jsx` computes it: each scheme's units, invested amount, NAV and
/// current value (`getSchemeCalculations`), the allocation share (`processAndSyncHoldings`), the pie slices,
/// the statements newest first with the scheme filter, and the account's value and invested totals
/// (`calculateItemCurrentValue` / `calculateItemInvestedValue` in FinanceContext).
enum NPSPage {
    struct Scheme: Identifiable { let id: String; let index: Int; let name: String; let shortName: String
        let units: Double; let invested: Double; let nav: Double; let current: Double; let percentage: Double; let raw: JSONValue }
    struct Statement: Identifiable { let id: String; let schemeId: String; let schemeIndex: Int; let txIndex: Int
        let scheme: String; let date: String; let type: String; let amount: Double; let units: Double; let nav: Double; let raw: JSONValue }
    struct Slice: Identifiable { let id = UUID(); let name: String; let value: Double }
    struct Page { var schemes: [Scheme] = []; var statements: [Statement] = []; var slices: [Slice] = []
        var totalUnits = 0.0; var current = 0.0; var invested = 0.0; var xirr = 0.0
        var profit: Double { current - invested } }

    static func schemeName(_ h: JSONValue) -> String {
        let n = [h["issueName"], h["scheme"], h["name"]].first { $0.truthy }?.text ?? ""
        return n.isEmpty ? "NPS Scheme" : n
    }
    static func shortName(_ h: JSONValue) -> String {
        schemeName(h).components(separatedBy: "-")[0].trimmingCharacters(in: .whitespaces)
    }

    /// `getSchemeCalculations`.
    static func calc(_ h: JSONValue) -> (units: Double, invested: Double, current: Double, nav: Double) {
        let txs = h["transactions"].array
        var units = 0.0, invested = 0.0, lastNav = 0.0
        if !txs.isEmpty {
            for t in txs { units += t["units"].double; if t["type"].text != "billing" && t["amount"].double > 0 { invested += t["amount"].double } }
            if let w = txs.reversed().first(where: { $0["nav"].double > 0 }) { lastNav = w["nav"].double }
        } else {
            units = h.has("totalunits") ? h["totalunits"].double : h.has("totalUnits") ? h["totalUnits"].double : h["units"].double
            invested = h["amount"].double != 0 ? h["amount"].double : h["investedAmount"].double
        }
        let nav = [h["nav"], h["currentPrice"], .number(lastNav)].first { $0.truthy }?.double ?? 0
        return (units, invested, units * nav, nav)
    }

    static func page(_ a: JSONValue) -> Page {
        var p = Page()
        let holdings = a["holdings"].array
        let computed = holdings.map { calc($0) }
        let totalCurrent = computed.reduce(0) { $0 + $1.current }
        for (i, h) in holdings.enumerated() {
            let c = computed[i]
            let cur2 = (c.current * 100).rounded() / 100
            let pct = totalCurrent > 0 ? ((cur2 / totalCurrent * 100) * 100).rounded() / 100 : 0
            p.schemes.append(Scheme(id: h["id"].text, index: i, name: schemeName(h), shortName: shortName(h), units: c.units, invested: c.invested, nav: c.nav, current: c.current, percentage: pct, raw: h))
            if c.current > 0 { p.slices.append(Slice(name: shortName(h), value: c.current)) }
            p.totalUnits += c.units
            for (ti, t) in h["transactions"].array.enumerated() {
                p.statements.append(Statement(id: "\(h["id"].text)#\(ti)", schemeId: h["id"].text, schemeIndex: i, txIndex: ti, scheme: schemeName(h), date: t["date"].text,
                                              type: t["type"].text, amount: t["amount"].double, units: t["units"].double, nav: t["nav"].double, raw: t))
            }
        }
        p.statements.sort { $0.date > $1.date }
        // Mac: calculateItemCurrentValue — units × NAV summed, or the stored amount when that is zero.
        let sum = computed.reduce(0) { $0 + $1.units * $1.nav }
        p.current = sum != 0 ? sum : a["amount"].double
        // Mac: calculateItemInvestedValue — every non-billing amount, or the stored investedAmount with no statements at all.
        var any = false, tx = 0.0
        for h in holdings { let t = h["transactions"].array; if !t.isEmpty { any = true; tx += t.reduce(0) { $0 + ($1["type"].text == "billing" ? 0 : $1["amount"].double) } } }
        p.invested = any ? tx : a["investedAmount"].double
        p.xirr = a["xirr"].double
        return p
    }

    static func statements(_ p: Page, scheme: String) -> [Statement] { scheme == "all" ? p.statements : p.statements.filter { $0.schemeId == scheme } }
}
