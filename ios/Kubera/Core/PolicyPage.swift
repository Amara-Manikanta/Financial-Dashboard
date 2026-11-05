import Foundation

/// The policy page's figures as `PolicyDetails.jsx` computes them (`policyCalcs`): premiums paid and received back,
/// the contract value and what is still to be paid, pending and overdue premiums, benefits and claims.
enum PolicyPage {
    struct Calcs {
        var totalPaid = 0.0, amountReceivedBack = 0.0, currentValue = 0.0, totalToBePaid = 0.0, remainingToBePaid = 0.0
        var pendingAmount = 0.0, overdue = 0, upcoming = 0, nextDue: String?
        var benefitsReceived = 0.0, benefitsExpected = 0.0, claimsSettled = 0.0, claimsOpenCount = 0, claimsOpenAmount = 0.0
    }

    /// JavaScript's `Number(x) || 0`.
    private static func n(_ v: JSONValue) -> Double { let d = v.double; return d.isNaN ? 0 : d }

    static func calcs(_ policy: JSONValue, today: String) -> Calcs {
        var c = Calcs()
        let details = policy["policyDetails"], premiums = policy["premiums"].array
        c.totalPaid = premiums.filter { $0["status"].text == "Paid" }.reduce(0) { $0 + n($1["amount"]) }
        c.amountReceivedBack = premiums.filter { ["Received Back", "Received"].contains($0["status"].text) }.reduce(0) { $0 + n($1["amount"]) }
        c.currentValue = c.totalPaid - c.amountReceivedBack
        c.totalToBePaid = n(details["premiumAmount"]) * n(details["premiumPayingTerm"])
        c.remainingToBePaid = c.totalToBePaid - c.totalPaid

        let pending = premiums.filter { $0["status"].text == "To Pay" }
        c.overdue = pending.filter { $0["dueDate"].truthy && $0["dueDate"].text < today }.count
        c.upcoming = pending.filter { !$0["dueDate"].truthy || $0["dueDate"].text >= today }.count
        c.pendingAmount = pending.reduce(0) { $0 + n($1["amount"]) }
        c.nextDue = pending.filter { $0["dueDate"].truthy }.map { $0["dueDate"].text }.sorted().first

        let benefits = policy["benefits"].array, claims = policy["claims"].array
        c.benefitsReceived = benefits.filter { $0["status"].text == "Received" }.reduce(0) { $0 + (n($1["settledAmount"]) != 0 ? n($1["settledAmount"]) : n($1["amount"])) }
        c.benefitsExpected = benefits.filter { $0["status"].text != "Received" }.reduce(0) { $0 + n($1["amount"]) }
        c.claimsSettled = claims.filter { $0["status"].text == "Settled" }.reduce(0) { $0 + (n($1["settledAmount"]) != 0 ? n($1["settledAmount"]) : n($1["amount"])) }
        let open = claims.filter { !["Settled", "Rejected"].contains($0["status"].text) }
        c.claimsOpenCount = open.count
        c.claimsOpenAmount = open.reduce(0) { $0 + n($1["amount"]) }
        return c
    }
}
