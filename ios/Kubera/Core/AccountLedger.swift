import Foundation

/// Adding, changing and deleting the rows inside a savings or investment account — mutual-fund and
/// emergency-fund transactions, PPF and PF entries, savings-account transactions, policy premiums,
/// claims and benefits, gold-bond holdings and interest, and NPS schemes and transactions.
///
/// Each save works on the account as it is on the Mac now, changes one row, and returns the fields to
/// PATCH — the list plus whatever the Mac's own page recomputes alongside it (the account `amount`, running
/// balances, an NPS scheme's units). A row that has changed since the phone read it is refused, not overwritten.
enum AccountLedger {
    struct Failure: Error, Equatable { let message: String }

    enum Kind: Equatable { case text, number, date, choice([String]) }
    struct FieldSpec: Equatable { let key: String; let label: String; let kind: Kind; var required = false }

    /// One editable list. `parent` names a list of records whose rows hold it (NPS: holdings → transactions).
    struct ListSpec: Equatable, Identifiable {
        let key: String
        let title: String
        let fields: [FieldSpec]
        var parent: String? = nil
        var id: String { (parent.map { $0 + "." } ?? "") + key }
        /// What the row's headline figure is called, in the first of these keys that exists.
        var amountKeys: [String] = ["amount"]
    }

    private static func f(_ key: String, _ label: String, _ kind: Kind = .text, required: Bool = false) -> FieldSpec { FieldSpec(key: key, label: label, kind: kind, required: required) }

    static func lists(for type: String) -> [ListSpec] {
        switch type {
        case "mutual_fund":
            return [ListSpec(key: "transactions", title: "Transactions", fields: [f("date", "Date", .date, required: true), f("type", "Type", .choice(["buy", "sip", "sell", "withdraw"]), required: true),
                f("amount", "Amount ₹", .number, required: true), f("nav", "NAV ₹", .number), f("units", "Units", .number), f("remarks", "Remarks")])]
        case "liquid":
            return [ListSpec(key: "transactions", title: "Transactions", fields: [f("date", "Date", .date, required: true), f("type", "Type", .choice(["buy", "sell"]), required: true),
                f("amount", "Amount ₹", .number, required: true), f("remarks", "Remarks")])]
        case "ppf":
            return [ListSpec(key: "details", title: "Entries", fields: [f("date", "Date", .date, required: true), f("type", "Type", .choice(["investment", "interest"]), required: true),
                f("amount", "Deposit ₹", .number), f("interestEarned", "Interest ₹", .number)], amountKeys: ["amount", "interestEarned"])]
        case "pf":
            return [ListSpec(key: "details", title: "Entries", fields: [f("date", "Date", .date, required: true), f("type", "Type", .choice(["Contribution", "Interest"]), required: true),
                f("employeeContribution", "Employee ₹", .number), f("employerContribution", "Employer ₹", .number), f("epsContribution", "EPS ₹", .number), f("vpfContribution", "VPF ₹", .number),
                f("interestEarned", "Interest ₹", .number), f("employeeInterestEarned", "Employee interest ₹", .number), f("employerInterestEarned", "Employer interest ₹", .number)])]
        case "savings_account":
            return [ListSpec(key: "transactions", title: "Transactions", fields: [f("date", "Date", .date, required: true), f("type", "Type", .choice(["deposit", "withdraw", "interest", "monnies_redeemed"]), required: true),
                f("amount", "Amount ₹", .number, required: true), f("remarks", "Remarks")])]
        case "policy", "Policy":
            return [ListSpec(key: "premiums", title: "Premiums", fields: [f("dueDate", "Due date", .date, required: true), f("paidDate", "Paid date", .date), f("amount", "Amount ₹", .number, required: true),
                        f("status", "Status", .choice(["Paid", "Pending", "Overdue", "Received Back"]), required: true), f("receiptNo", "Receipt no")]),
                    ListSpec(key: "claims", title: "Claims", fields: [f("title", "Title", .text, required: true), f("category", "Category"), f("date", "Date", .date), f("amount", "Claimed ₹", .number),
                        f("status", "Status", .choice(["Open", "Submitted", "Settled", "Rejected"])), f("settledDate", "Settled on", .date), f("settledAmount", "Settled ₹", .number), f("reference", "Reference"), f("notes", "Notes")]),
                    ListSpec(key: "benefits", title: "Benefits", fields: [f("title", "Title", .text, required: true), f("date", "Date", .date), f("amount", "Amount ₹", .number), f("notes", "Notes")])]
        case "sgb":
            return [ListSpec(key: "holdings", title: "Holdings", fields: [f("issueName", "Issue", .text, required: true), f("issueDate", "Issued", .date), f("maturityDate", "Matures", .date),
                        f("units", "Units (grams)", .number, required: true), f("purchasePrice", "Issue price ₹", .number), f("currentPrice", "Current price ₹", .number)], amountKeys: ["currentPrice"]),
                    ListSpec(key: "interestTransactions", title: "Interest", fields: [f("date", "Date", .date, required: true), f("amount", "Amount ₹", .number, required: true), f("remarks", "Remarks")])]
        case "nps":
            return [ListSpec(key: "holdings", title: "Schemes", fields: [f("issueName", "Scheme", .text, required: true), f("currentPrice", "Latest NAV ₹", .number)], amountKeys: ["current"]),
                    ListSpec(key: "transactions", title: "Transactions", fields: [f("date", "Date", .date, required: true), f("type", "Type", .choice(["contribution", "billing"]), required: true),
                        f("amount", "Amount ₹", .number, required: true), f("units", "Units", .number, required: true), f("nav", "NAV ₹", .number)], parent: "holdings")]
        default: return []
        }
    }

    // MARK: Drafts

    typealias Draft = [String: String]

    private static func parse(_ s: String?) -> Double? {
        guard let s else { return nil }
        let t = s.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")
        return t.isEmpty ? nil : Double(t)
    }

    static func draft(for spec: ListSpec, from row: JSONValue? = nil) -> Draft {
        var d: Draft = [:]
        for fs in spec.fields {
            if let row, !row[fs.key].isNull {
                switch fs.kind {
                case .number: d[fs.key] = row[fs.key].double == 0 ? "" : RecordEditing.number(row[fs.key].double)
                case .date: d[fs.key] = String(row[fs.key].text.prefix(10))
                default: d[fs.key] = row[fs.key].text
                }
            } else {
                switch fs.kind {
                case .date: d[fs.key] = fs.required ? NewTransaction.isoDay(Date()) : ""
                case .choice(let o): d[fs.key] = o.first ?? ""
                default: d[fs.key] = ""
                }
            }
        }
        return d
    }

    static func problems(_ d: Draft, spec: ListSpec) -> [String] {
        var out: [String] = []
        for fs in spec.fields {
            let v = d[fs.key] ?? ""
            switch fs.kind {
            case .number:
                if fs.required && !((parse(v) ?? 0) > 0) { out.append("Enter \(fs.label.lowercased()).") }
                else if !v.isEmpty && parse(v) == nil { out.append("\(fs.label) is not a number.") }
            case .date:
                if fs.required && !RecordEditing.isDate(v) { out.append("Pick \(fs.label.lowercased()).") }
            case .text:
                if fs.required && v.trimmingCharacters(in: .whitespaces).isEmpty { out.append("Enter \(fs.label.lowercased()).") }
            case .choice: break
            }
        }
        return out
    }

    // MARK: Rows

    static func newId() -> String { String(Int64(Date().timeIntervalSince1970 * 1000)) }

    /// The stored row: the existing row first (so ids, links and fields the form does not show survive), then the form.
    static func row(_ d: Draft, spec: ListSpec, type: String, base: JSONValue = .null) -> JSONValue {
        var o = base.object
        if base.isNull, !spec.fields.contains(where: { $0.key == "id" }) { o["id"] = .string(newId()) }
        for fs in spec.fields {
            let v = d[fs.key] ?? ""
            switch fs.kind {
            case .number: if let n = parse(v) { o[fs.key] = .number(n) } else if !v.isEmpty || base[fs.key].isNull == false { o[fs.key] = v.isEmpty ? .number(0) : .null } else if fs.required { o[fs.key] = .number(0) }
            case .date: if !v.isEmpty { o[fs.key] = .string(v) } else if !base[fs.key].isNull { o[fs.key] = .string("") }
            default: if !v.isEmpty || !base[fs.key].isNull { o[fs.key] = .string(v.trimmingCharacters(in: .whitespaces)) }
            }
        }
        switch (type, spec.key) {
        case ("mutual_fund", "transactions"):
            // Units follow from amount and NAV unless typed; the Mac's form does the same.
            let amount = o["amount"]?.double ?? 0, nav = o["nav"]?.double ?? 0
            if (o["units"]?.double ?? 0) == 0, nav > 0 { o["units"] = .number((amount / nav * 1000).rounded() / 1000) }
        case ("liquid", "transactions"):
            o["units"] = .number(o["amount"]?.double ?? 0); o["nav"] = .number(1)
        case ("pf", "details"):
            let parts = ["employeeContribution", "employerContribution", "epsContribution", "vpfContribution", "interestEarned"]
            o["amount"] = .number(parts.reduce(0) { $0 + (o[$1]?.double ?? 0) })
        case ("policy", "premiums"), ("policy", "claims"), ("policy", "benefits"):
            break
        default: break
        }
        return .object(o)
    }

    /// Rows locked from editing, with the reason.
    static func rowLock(_ row: JSONValue, type: String) -> String? {
        if row["expenseId"].truthy || row["adoptedByExpense"].truthy || row["investmentData"].truthy {
            return "This row is linked to an expense. Change it on the Mac so both stay in step."
        }
        return nil
    }

    // MARK: Changes

    enum Change { case add(JSONValue), replace(index: Int, expected: JSONValue, JSONValue), delete(index: Int, expected: JSONValue) }

    private static func stale(_ what: String) -> Failure { Failure(message: "That \(what) was changed or removed on your Mac. Nothing was saved — reopen it and try again.") }

    static func apply(_ change: Change, to rows: [JSONValue]) -> Result<[JSONValue], Failure> {
        var rows = rows
        switch change {
        case .add(let r): rows.append(r)
        case .replace(let i, let expected, let r):
            guard rows.indices.contains(i), rows[i] == expected else { return .failure(stale("row")) }
            rows[i] = r
        case .delete(let i, let expected):
            guard rows.indices.contains(i), rows[i] == expected else { return .failure(stale("row")) }
            rows.remove(at: i)
        }
        return .success(rows)
    }

    private static func byDate(_ rows: [JSONValue], key: String = "date", ascending: Bool) -> [JSONValue] {
        func t(_ r: JSONValue) -> Double { JSDate.parse(r[key])?.timeIntervalSince1970 ?? 0 }
        let sorted = rows.enumerated().sorted { a, b in t(a.element) != t(b.element) ? (ascending ? t(a.element) < t(b.element) : t(a.element) > t(b.element)) : a.offset < b.offset }
        return sorted.map(\.element)
    }

    // MARK: Recomputes shared with the Mac's pages

    /// `recomputeFundUnits` in utils/investmentSync.js.
    static func fundUnits(_ rows: [JSONValue]) -> Double {
        var units = 0.0
        for t in rows {
            let type = t["type"].truthy ? t["type"].text : (t["remarks"].text.lowercased().contains("sip") ? "sip" : "buy")
            if type == "buy" || type == "sip" { units += t["units"].double }
            if type == "sell" || type == "withdraw" { units -= t["units"].double }
        }
        return units < 0.0001 ? 0 : units
    }

    /// PPF: running balance of amount + interest, in date order.
    static func ppfBalances(_ rows: [JSONValue]) -> [JSONValue] {
        var running = 0.0
        return byDate(rows, ascending: true).map { r in
            running += r["amount"].double + r["interestEarned"].double
            var o = r.object; o["balance"] = .number(running); return .object(o)
        }
    }

    /// PF: EPF running balance (own + employer + VPF + interest) from the account's stored amount, and the EPS one.
    static func pfBalances(_ rows: [JSONValue], opening: Double) -> [JSONValue] {
        var epf = opening, eps = 0.0
        return byDate(rows, ascending: true).map { r in
            epf += r["employeeContribution"].double + r["employerContribution"].double + r["vpfContribution"].double + r["interestEarned"].double
            eps += r["epsContribution"].double
            var o = r.object; o["balance"] = .number(epf); o["epfBalance"] = .number(epf); o["epsBalance"] = .number(eps); return .object(o)
        }
    }

    private static func r2(_ v: Double) -> Double { (v * 100).rounded() / 100 }
    private static func r4(_ v: Double) -> Double { (v * 10000).rounded() / 10000 }

    /// NPS `processAndSyncHoldings`: each scheme's units, invested amount and value, and its share of the total.
    static func npsSync(_ holdings: [JSONValue]) -> (current: Double, invested: Double, holdings: [JSONValue]) {
        var current = 0.0, invested = 0.0
        let computed: [(JSONValue, Double)] = holdings.map { h in
            let txs = h["transactions"].array
            var units = 0.0, amount = 0.0, lastNav = 0.0
            if !txs.isEmpty {
                for t in txs { units += t["units"].double; if t["type"].text != "billing" && t["amount"].double > 0 { amount += t["amount"].double } }
                if let w = txs.reversed().first(where: { $0["nav"].double > 0 }) { lastNav = w["nav"].double }
            } else {
                units = h.has("totalunits") ? h["totalunits"].double : h.has("totalUnits") ? h["totalUnits"].double : h["units"].double
                amount = h["amount"].double != 0 ? h["amount"].double : h["investedAmount"].double
            }
            let nav = [h["nav"], h["currentPrice"], .number(lastNav)].first { $0.truthy }?.double ?? 0
            let cur = units * nav
            current += cur; invested += amount
            var o = h.object
            o["totalunits"] = .number(r4(units)); o["totalUnits"] = .number(r4(units)); o["amount"] = .number(r2(amount)); o["current"] = .number(r2(cur))
            return (.object(o), r2(cur))
        }
        return (current, invested, computed.map { h, cur in
            var o = h.object; o["percentage"] = .number(current > 0 ? r2(cur / current * 100) : 0); return .object(o)
        })
    }

    // MARK: Patch

    /// The fields to PATCH for a change to `spec`'s list. `parentIndex` picks the NPS scheme a transaction belongs to.
    static func patch(account: JSONValue, spec: ListSpec, parentIndex: Int? = nil, change: Change) -> Result<[String: Any], Failure> {
        let type = account["type"].text
        let fo = RecordEditing.foundation
        if let parent = spec.parent {
            // NPS transactions: one scheme's list, then the whole account is re-synced.
            var holdings = account[parent].array
            guard let pi = parentIndex, holdings.indices.contains(pi) else { return .failure(Failure(message: "That scheme is no longer on your Mac. Nothing was changed.")) }
            switch apply(change, to: holdings[pi][spec.key].array) {
            case .failure(let e): return .failure(e)
            case .success(let rows):
                var h = holdings[pi].object; h[spec.key] = .array(rows); holdings[pi] = .object(h)
                let s = npsSync(holdings)
                return .success(["holdings": s.holdings.map(fo), "amount": r2(s.current), "investedAmount": r2(s.invested)])
            }
        }
        switch apply(change, to: account[spec.key].array) {
        case .failure(let e): return .failure(e)
        case .success(var rows):
            var patch: [String: Any] = [:]
            var isDelete = false; if case .delete = change { isDelete = true }
            switch (type, spec.key) {
            case ("mutual_fund", "transactions"):
                if !isDelete { rows = byDate(rows, ascending: true) }
                var a = account.object; a["transactions"] = .array(rows)
                patch["amount"] = isDelete ? Valuation.currentValue(.object(a)) : fundUnits(rows) * account["currentNav"].double
            case ("liquid", "transactions"):
                rows = byDate(rows, ascending: true)
                patch["amount"] = rows.reduce(0.0) { sum, t in
                    let ty = t["type"].truthy ? t["type"].text : "buy"
                    return (ty == "buy" || ty == "sip") ? sum + t["amount"].double : (ty == "sell" || ty == "withdraw") ? sum - t["amount"].double : sum
                }
            case ("ppf", "details"):
                rows = ppfBalances(rows); patch["amount"] = rows.last?["balance"].double ?? 0
            case ("pf", "details"):
                rows = pfBalances(rows, opening: account["amount"].double)
            case ("savings_account", "transactions"):
                patch["amount"] = rows.reduce(0.0) { sum, t in
                    let v = t["amount"].double
                    switch t["type"].text { case "deposit", "interest", "monnies_redeemed": return sum + v; case "withdraw": return sum - v; default: return sum }
                }
            case (_, "premiums"):
                patch["amount"] = rows.filter { $0["status"].text == "Paid" }.reduce(0.0) { $0 + $1["amount"].double }
            case ("sgb", "holdings"):
                var a = account.object; a["holdings"] = .array(rows)
                patch["amount"] = Valuation.currentValue(.object(a))
            case ("sgb", "interestTransactions"):
                rows = byDate(rows, ascending: false)
            case ("nps", "holdings"):
                let s = npsSync(rows); rows = s.holdings
                patch["amount"] = r2(s.current); patch["investedAmount"] = r2(s.invested)
            default: break
            }
            patch[spec.key] = rows.map(fo)
            return .success(patch)
        }
    }

    // MARK: A new account (SavingsItemModal.jsx)

    static let newAccountTypes: [(id: String, label: String)] = [
        ("savings_account", "Savings account"), ("policy", "Insurance policy"), ("fixed_deposit", "Fixed deposit account"), ("recurring_deposit", "Recurring deposit account"),
        ("nps", "NPS account"), ("ppf", "PPF account"), ("pf", "PF account")]

    static func newAccount(type: String, title: String, amount: Double, date: String, bank: String = "", insurer: String = "", policyNo: String = "", pran: String = "") -> [String: Any] {
        var a: [String: Any] = ["id": newId(), "title": title, "name": title, "amount": amount, "type": type, "date": date]
        if !bank.isEmpty { a["bank"] = bank }; if !insurer.isEmpty { a["insurer"] = insurer }
        if !policyNo.isEmpty { a["policyNo"] = policyNo }; if !pran.isEmpty { a["pran"] = pran }
        switch type {
        case "nps": a["holdings"] = [Any](); a["transactions"] = [Any](); a["investedAmount"] = amount
        case "ppf", "pf": a["details"] = [Any]()
        case "recurring_deposit": a["recurringDeposits"] = [Any](); a["amount"] = 0.0
        case "fixed_deposit": a["deposits"] = [Any]()
        case "savings_account": a["transactions"] = [Any](); a["interestRate"] = 5.4
        default: break
        }
        return a
    }
}
