import Foundation

/// A read-only view of one savings or investment account: what it is worth and the records
/// behind it. The figures come from `Valuation` (already checked against the Mac's own
/// valuation for every account); the ledgers are the stored rows, newest first.
enum AccountDetail {
    struct Fact: Equatable { let label: String; let value: String }
    struct Row: Identifiable, Equatable { let id: Int; let title: String; var subtitle = ""; var value = ""; var tone = 0 }   // tone: -1 out, 0 plain, 1 in
    struct Section: Identifiable, Equatable { var id: String { title }; let title: String; var rows: [Row] }
    struct Page: Equatable { var title = "", kind = ""; var value = 0.0, invested = 0.0; var showsInvested = true; var facts: [Fact] = []; var sections: [Section] = [] }

    private static func inr(_ v: Double) -> String { Money.rupees(v) }
    private static func newestFirst(_ rows: [JSONValue], key: String = "date") -> [JSONValue] {
        rows.enumerated().sorted { a, b in
            let x = JSDate.parse(a.element[key])?.timeIntervalSince1970 ?? 0, y = JSDate.parse(b.element[key])?.timeIntervalSince1970 ?? 0
            return x != y ? x > y : a.offset > b.offset
        }.map(\.element)
    }
    private static func fact(_ label: String, _ v: JSONValue) -> Fact? { v.truthy ? Fact(label: label, value: v.text) : nil }
    private static func ledger(_ title: String, _ rows: [JSONValue], _ make: (JSONValue) -> (String, String, String, Int)) -> Section {
        Section(title: title, rows: rows.enumerated().map { i, r in let m = make(r); return Row(id: i, title: m.0, subtitle: m.1, value: m.2, tone: m.3) })
    }

    static func page(_ a: JSONValue, asOf: Date = Date()) -> Page {
        var p = Page()
        p.title = [a["title"], a["name"]].first { $0.truthy }?.text ?? (["ppf", "nps", "sgb", "pf"].contains(a["type"].text) ? a["type"].text.uppercased() : a["type"].text.replacingOccurrences(of: "_", with: " ").capitalized)
        p.kind = a["type"].text.replacingOccurrences(of: "_", with: " ")
        p.value = Valuation.currentValue(a, asOf: asOf)
        p.invested = Valuation.investedValue(a)
        switch a["type"].text {
        case "mutual_fund", "liquid":
            if a["type"].text == "mutual_fund" {
                let units = a["transactions"].array.reduce(0) { $0 + (["sell", "withdraw"].contains($1["type"].text) ? -$1["units"].double : $1["units"].double) }
                p.facts = [Fact(label: "Units", value: String(format: "%.3f", max(0, units))), Fact(label: "NAV", value: inr(a["currentNav"].double))] + [fact("Folio", a["folioNumber"]), fact("Scheme code", a["schemeCode"])].compactMap { $0 }
            } else { p.showsInvested = false }
            p.sections = [ledger("Transactions", newestFirst(a["transactions"].array)) { t in
                let sell = ["sell", "withdraw"].contains(t["type"].text)
                let amount = t["amount"].double != 0 ? t["amount"].double : t["units"].double * t["nav"].double
                return (t["remarks"].truthy ? t["remarks"].text : t["type"].text.capitalized, "\(t["date"].text) · \(String(format: "%.3f", t["units"].double)) units @ \(inr(t["nav"].double))", "\(sell ? "−" : "+")\(inr(abs(amount)))", sell ? -1 : 1)
            }]
        case "fixed_deposit":
            p.facts = [Fact(label: "Deposits", value: "\(a["deposits"].array.count)"), Fact(label: "Principal", value: inr(Valuation.totalPrincipal(a["deposits"])))]
            p.sections = [ledger("Deposits", newestFirst(a["deposits"].array, key: "startDate")) { d in
                ("\(d["bank"].text)\(d["accountNo"].truthy ? " · \(d["accountNo"].text)" : "")", "\(inr(d["originalAmount"].double)) at \(d["interestRate"].text)% · to \(d["endDate"].text)", inr(Valuation.depositValue(d, asOf: asOf)), 0)
            }]
        case "recurring_deposit":
            p.showsInvested = false
            p.sections = [ledger("Recurring deposits", a["recurringDeposits"].array) { rd in
                let paid = rd["installments"].array.reduce(0) { $0 + $1["amount"].double }
                return (rd["name"].text, "\(inr(rd["installmentAmount"].double))/mo · \(rd["interestRate"].text)% · \(rd["installments"].array.count) paid · \(rd["status"].text)", inr(paid), 0)
            }]
        case "ppf", "pf":
            p.showsInvested = a["type"].text == "pf" ? false : false
            p.facts = [fact("Folio", a["folioNumber"]), fact("UAN", a["uan"])].compactMap { $0 }
            p.sections = [ledger("Entries", newestFirst(a["details"].array)) { d in
                (d["type"].text.capitalized, "\(d["date"].text)\(d["balance"].truthy ? " · balance \(inr(d["balance"].double))" : "")", inr(d["amount"].double), d["amount"].double >= 0 ? 1 : -1)
            }]
        case "nps":
            p.facts = [fact("PRAN", a["pran"])].compactMap { $0 }
            p.sections = [ledger("Funds", a["holdings"].array) { h in
                let txs = h["transactions"].array
                let units = txs.isEmpty ? (h.has("totalunits") ? h["totalunits"].double : h.has("totalUnits") ? h["totalUnits"].double : h["units"].double) : txs.reduce(0) { $0 + $1["units"].double }
                let nav = [h["nav"], h["currentPrice"], .number(txs.reversed().first { $0["nav"].double > 0 }?["nav"].double ?? 0)].first { $0.truthy }?.double ?? 0
                return (h["issueName"].text, "\(String(format: "%.3f", units)) units @ \(inr(nav))", inr(units * nav), 0)
            }]
        case "sgb":
            p.sections = [ledger("Bonds", a["holdings"].array) { h in
                let s = Valuation.sgbHolding(h)
                return (h["issueName"].text, "\(String(format: "%g", s.units)) units @ \(inr(s.currentPrice)) · matures \(h["maturityDate"].text)", inr(s.units * s.currentPrice), 0)
            }, ledger("Interest received", newestFirst(a["interestTransactions"].array)) { t in (t["remarks"].truthy ? t["remarks"].text : "Interest", t["date"].text, inr(t["amount"].double), 1) }]
        case "savings_account":
            p.showsInvested = false
            p.facts = [fact("Bank", a["bank"]), a["interestRate"].truthy ? Fact(label: "Interest", value: "\(a["interestRate"].text)%") : nil].compactMap { $0 }
            p.sections = [ledger("Transactions", newestFirst(a["transactions"].array)) { t in
                let out = t["type"].text.lowercased() == "withdraw"
                return (t["remarks"].truthy ? t["remarks"].text : t["type"].text.capitalized, t["date"].text, "\(out ? "−" : "+")\(inr(abs(t["amount"].double)))", out ? -1 : 1)
            }]
        case "policy", "Policy":
            p.showsInvested = false
            let d = a["policyDetails"]
            p.facts = [fact("Insurer", d["insurer"]), fact("Policy number", d["policyNumber"].truthy ? d["policyNumber"] : a["policyNo"]), fact("Plan", d["planName"]),
                       d["sumAssured"].truthy ? Fact(label: "Cover", value: inr(d["sumAssured"].double)) : nil, d["premiumAmount"].truthy ? Fact(label: "Premium", value: inr(d["premiumAmount"].double)) : nil,
                       fact("Expires", d["expiryDate"].truthy ? d["expiryDate"] : d["maturityDate"]), fact("Status", d["status"])].compactMap { $0 }
            p.sections = [ledger("Premiums", newestFirst(a["premiums"].array, key: "dueDate")) { x in
                ("Due \(x["dueDate"].text)", "\(x["status"].text)\(x["paidDate"].truthy ? " · paid \(x["paidDate"].text)" : "")", inr(x["amount"].double), 0)
            }]
        default:
            p.showsInvested = false
        }
        p.sections = p.sections.filter { !$0.rows.isEmpty }
        return p
    }
}
