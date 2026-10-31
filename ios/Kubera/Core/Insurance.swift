import Foundation

/// Insurance gap analysis — a port of the computation in `pages/InsuranceAnalysis.jsx`.
/// Cover is summed per kind from each policy's own details; the "recommended" figures are
/// the page's rules of thumb (12× annual income plus liabilities for life, ₹10L plus ₹3L a
/// dependent for health), not advice. Archived policies are lapsed cover and are left out
/// of the totals unless you ask to see them. The page's sample policies are not carried
/// over: demo rows must never reach an analysis.
enum InsurancePage {
    struct Profile: Equatable { var age = 30.0, dependents = 2.0, annualIncome = 1_200_000.0, liabilities = 0.0 }

    /// What the page shows in its editor: the stored profile (blank fields back to defaults),
    /// or — when none was ever saved — an income taken from an `annual` payslip.
    static func profile(appData: JSONValue, salaryDetails: JSONValue) -> Profile {
        var p = Profile()
        let stored = appData["insuranceProfile"]
        if !stored.object.isEmpty {
            p.age = stored["age"].truthy ? stored["age"].double : 30
            p.dependents = stored["dependents"].truthy ? stored["dependents"].double : 2
            p.annualIncome = stored["annualIncome"].truthy ? stored["annualIncome"].double : 1_200_000
            p.liabilities = stored["liabilities"].truthy ? stored["liabilities"].double : 0
        } else if let annual = salaryDetails.array.first(where: { $0["type"].text == "annual" }) {
            let total = annual.object.filter { !["id", "year", "month", "type"].contains($0.key) }.reduce(0) { $0 + $1.value.double }
            if total > 0 { p.annualIncome = total }
        }
        return p
    }

    enum Tab: String, CaseIterable, Identifiable { case all = "All", bike = "Bike & motor", life = "Life / term", health = "Health", home = "Home"; var id: String { rawValue } }

    struct Policy: Identifiable, Equatable {
        let raw: JSONValue
        var id: String { raw["id"].text }
        var details: JSONValue { raw["policyDetails"] }
        var category: String { details["category"].text.lowercased() }
        var name: String { details["planName"].truthy ? details["planName"].text : raw["title"].text }
        var cover: Double {
            if details["sumAssured"].truthy { return details["sumAssured"].double }
            if details["termCover"].truthy { return details["termCover"].double }
            return raw["amount"].double
        }
        var premium: Double { details["premiumAmount"].double }
        var expiry: String { details["expiryDate"].truthy ? details["expiryDate"].text : details["maturityDate"].text }
        var isArchived: Bool { raw["isArchived"].truthy }
    }

    struct Page: Equatable {
        var policies: [Policy] = []          // after the archive toggle, before the tab
        var shown: [Policy] = []             // after the tab too
        var archivedCount = 0
        var life = 0.0, health = 0.0, bike = 0.0, car = 0.0, home = 0.0, premiums = 0.0
        var vehicles: [String] = []
        var recommendedLife = 0.0, recommendedHealth = 0.0
        var lifeGap = 0.0, healthGap = 0.0
        var lifePct = 100.0, healthPct = 100.0
        var premiumToIncomePct = 0.0
    }

    private static func plan(_ p: Policy) -> String { (p.details["planName"].truthy ? p.details["planName"].text : p.raw["title"].text).lowercased() }

    static func page(savings: JSONValue, profile: Profile, tab: Tab = .all, showArchived: Bool = false) -> Page {
        var page = Page()
        let all = savings.array.filter { $0["type"].text == "Policy" || $0["type"].text == "policy" }.map { Policy(raw: $0) }
        page.archivedCount = all.filter(\.isArchived).count
        page.policies = showArchived ? all : all.filter { !$0.isArchived }

        for p in page.policies {
            let cat = p.category, name = plan(p), cover = p.cover
            page.premiums += p.premium
            if cat == "bike" || name.contains("bike") || name.contains("two wheeler") {
                page.bike += cover
                if p.details["vehicleNo"].truthy { page.vehicles.append(p.details["vehicleNo"].text) }
            } else if cat == "car" || name.contains("car") || name.contains("four wheeler") { page.car += cover }
            else if cat == "health" || name.contains("health") || name.contains("mediclaim") { page.health += cover }
            else if cat == "home" || name.contains("home") || name.contains("fire") || name.contains("property") { page.home += cover }
            else { page.life += cover }
        }
        page.recommendedLife = max(0, profile.annualIncome * 12 + profile.liabilities)
        page.recommendedHealth = 1_000_000 + profile.dependents * 300_000
        page.lifeGap = max(0, page.recommendedLife - page.life)
        page.healthGap = max(0, page.recommendedHealth - page.health)
        page.lifePct = page.recommendedLife > 0 ? min(100, Money.jsRound(page.life / page.recommendedLife * 100)) : 100
        page.healthPct = page.recommendedHealth > 0 ? min(100, Money.jsRound(page.health / page.recommendedHealth * 100)) : 100
        page.premiumToIncomePct = profile.annualIncome > 0 ? page.premiums / profile.annualIncome * 100 : 0

        page.shown = page.policies.filter { p in
            if tab == .all { return true }
            let cat = p.category, title = plan(p)
            switch tab {
            case .bike: return cat == "bike" || cat == "car" || title.contains("bike") || title.contains("car") || title.contains("wheeler")
            case .life: return cat == "life" || ["term", "lic", "life", "jeevan", "moneyback"].contains { title.contains($0) }
            case .health: return cat == "health" || title.contains("health") || title.contains("mediclaim")
            case .home: return cat == "home" || title.contains("home") || title.contains("fire") || title.contains("property")
            case .all: return true
            }
        }
        return page
    }

    /// Expired by date, not by flag: `YYYY-MM-DD` strings compare as dates.
    static func isExpired(_ p: Policy, today: String) -> Bool { !p.expiry.isEmpty && p.expiry < today }
}
