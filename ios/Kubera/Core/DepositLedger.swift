import Foundation

/// Fixed and recurring deposits, and the instalment / interest rows inside them — the
/// calculations and saves of `FixedDepositDetails.jsx`, `SingleDepositDetails.jsx`,
/// `RecurringDepositDetails.jsx`, `SingleRecurringDepositDetails.jsx` and their modals.
///
/// Deposits live inside a savings account (`deposits[]` / `recurringDeposits[]`). Every change here
/// takes that account as it is on the Mac *now*, changes one row of one list, and returns the
/// fields to PATCH — the list, and the account `amount` where the web recomputes it.
enum DepositLedger {
    struct Failure: Error, Equatable { let message: String }
    enum ListChange { case add(JSONValue), replace(id: String, JSONValue), delete(id: String) }

    private static func num(_ v: JSONValue) -> Double { v.double }
    private static func money(_ v: Double) -> Double { v.rounded() }   // Math.round, for non-negative figures

    // MARK: Accrual (utils/fdAccrual.js)

    struct Accrual: Equatable { let accruedValue: Double; let accruedInterest: Double; let daysElapsed: Double; let totalDays: Double; let matured: Bool }

    private static func compoundsPerYear(_ bank: JSONValue) -> Double { bank.text.lowercased().contains("slice") ? 365 : 4 }

    static func accrual(_ d: JSONValue, asOf: Date = Date()) -> Accrual {
        let principal = num(d["originalAmount"])
        let fallback = Accrual(accruedValue: num(d["currentValue"]) != 0 ? num(d["currentValue"]) : principal,
                               accruedInterest: num(d["interestEarned"]), daysElapsed: 0, totalDays: 0, matured: false)
        guard principal != 0, d["startDate"].truthy, let start = JSDate.parse(d["startDate"]), let end = JSDate.parse(d["endDate"]) else { return fallback }
        let startDay = JSDate.midnight(start), endDay = JSDate.midnight(end), today = JSDate.midnight(asOf)
        let effectiveEnd = today < endDay ? today : endDay
        let elapsed = max(0, (effectiveEnd.timeIntervalSince(startDay) / 86400).rounded())
        let total = max(1, (endDay.timeIntervalSince(startDay) / 86400).rounded())
        let rate = num(d["interestRate"]) / 100, n = compoundsPerYear(d["bank"])
        let interest = principal * (pow(1 + rate / n, n * (elapsed / 365.25)) - 1)
        return Accrual(accruedValue: principal + interest, accruedInterest: interest, daysElapsed: elapsed, totalDays: total, matured: today >= endDay)
    }

    /// Value on the end date, from the same formula.
    static func maturity(_ d: JSONValue) -> Double {
        let principal = num(d["originalAmount"])
        guard principal != 0, d["startDate"].truthy, d["endDate"].truthy, let start = JSDate.parse(d["startDate"]), let end = JSDate.parse(d["endDate"]) else { return num(d["maturityAmount"]) }
        let years = max(0, JSDate.midnight(end).timeIntervalSince(JSDate.midnight(start)) / 86400 / 365.25)
        let rate = num(d["interestRate"]) / 100, n = compoundsPerYear(d["bank"])
        return principal * pow(1 + rate / n, n * years)
    }

    /// `2026-2027` for 1 Apr 2026 – 31 Mar 2027, the label interest rows carry.
    static func financialYear(_ iso: String) -> String {
        let parts = iso.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard parts.count >= 2 else { return "" }
        let start = parts[1] >= 4 ? parts[0] : parts[0] - 1
        return "\(start)-\(start + 1)"
    }

    static func banks(_ deposits: [JSONValue]) -> [String] {
        Array(Set(deposits.map { $0["bank"].text }.filter { !$0.isEmpty })).sorted { $0.lowercased() < $1.lowercased() }
    }

    /// The account's amount after a change to its fixed deposits: what the live ones are worth today.
    static func fdAccountAmount(_ deposits: [JSONValue], asOf: Date = Date()) -> Double {
        deposits.filter { !$0["isArchived"].truthy }.reduce(0) { sum, d in
            let v = accrual(d, asOf: asOf).accruedValue
            return sum + (v != 0 ? v : num(d["originalAmount"]))
        }
    }

    /// A recurring-deposit account's amount: what its deposits will mature to.
    static func rdAccountAmount(_ rds: [JSONValue]) -> Double { rds.reduce(0) { $0 + num($1["maturityAmount"]) } }

    // MARK: Lists

    static func apply(_ change: ListChange, to rows: [JSONValue], what: String) -> Result<[JSONValue], Failure> {
        var rows = rows
        switch change {
        case .add(let row): rows.append(row)
        case .replace(let id, let row):
            guard let i = rows.firstIndex(where: { $0["id"].text == id }) else { return .failure(Failure(message: "That \(what) was changed or removed on your Mac. Nothing was saved — reopen it and try again.")) }
            rows[i] = row
        case .delete(let id):
            guard let i = rows.firstIndex(where: { $0["id"].text == id }) else { return .failure(Failure(message: "That \(what) was already removed on your Mac. Nothing was changed.")) }
            rows.remove(at: i)
        }
        return .success(rows)
    }

    static func newId() -> String { String(Int64(Date().timeIntervalSince1970 * 1000)) }

    // MARK: Fixed deposit form (FixedDepositModal.jsx)

    struct FDDraft: Equatable {
        var accountNo = "", bank = "", branchName = ""
        var startDate = NewTransaction.isoDay(Date()), endDate = ""
        var originalAmount = "", interestRate = "", tds = "", remarks = ""
    }

    static func fdDraft(from d: JSONValue) -> FDDraft {
        func n(_ k: String) -> String { d[k].double == 0 ? "" : RecordEditing.number(d[k].double) }
        return FDDraft(accountNo: d["accountNo"].text, bank: d["bank"].text, branchName: d["branchName"].text,
                       startDate: String(d["startDate"].text.prefix(10)), endDate: String(d["endDate"].text.prefix(10)),
                       originalAmount: n("originalAmount"), interestRate: n("interestRate"), tds: n("tds"), remarks: d["remarks"].text)
    }

    private static func parse(_ s: String) -> Double? { Double(s.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")) }

    static func fdProblems(_ d: FDDraft) -> [String] {
        var out: [String] = []
        if d.accountNo.trimmingCharacters(in: .whitespaces).isEmpty { out.append("Enter the account number.") }
        if d.bank.trimmingCharacters(in: .whitespaces).isEmpty { out.append("Enter the bank name.") }
        if !RecordEditing.isDate(d.startDate) || !RecordEditing.isDate(d.endDate) { out.append("Pick the start and maturity dates.") }
        else if d.endDate < d.startDate { out.append("Maturity must be after the start date.") }
        if !((parse(d.originalAmount) ?? 0) > 0) { out.append("Enter the principal.") }
        if !((parse(d.interestRate) ?? 0) > 0) { out.append("Enter the interest rate.") }
        return out
    }

    /// The projected figures the modal shows while typing: interest to maturity, maturity, and interest accrued so far.
    static func fdProjection(_ d: FDDraft, asOf: Date = Date()) -> (interest: Double, maturity: Double, accrued: Double) {
        guard let p = parse(d.originalAmount), let r = parse(d.interestRate), p > 0, r > 0, RecordEditing.isDate(d.startDate), RecordEditing.isDate(d.endDate) else { return (0, 0, 0) }
        let probe: JSONValue = .object(["originalAmount": .number(p), "interestRate": .number(r), "startDate": .string(d.startDate), "endDate": .string(d.endDate), "bank": .string(d.bank)])
        let m = maturity(probe)
        return (money(m - p), money(m), money(accrual(probe, asOf: asOf).accruedInterest))
    }

    /// The stored row. The stored deposit is spread first so fields the form does not show
    /// (`interestTransactions`, `renewalCount`, `isArchived`…) survive an edit.
    static func fdRow(_ d: FDDraft, id: String, base: JSONValue = .null, asOf: Date = Date()) -> JSONValue {
        var f = base.object
        let p = parse(d.originalAmount) ?? 0
        let proj = fdProjection(d, asOf: asOf)
        f["id"] = base["id"].isNull ? (Int64(id).map { .number(Double($0)) } ?? .string(id)) : base["id"]
        f["accountNo"] = .string(d.accountNo.trimmingCharacters(in: .whitespaces))
        f["bank"] = .string(d.bank.trimmingCharacters(in: .whitespaces))
        f["branchName"] = .string(d.branchName.trimmingCharacters(in: .whitespaces))
        f["startDate"] = .string(d.startDate); f["endDate"] = .string(d.endDate)
        f["originalAmount"] = .number(p)
        f["interestRate"] = .number(parse(d.interestRate) ?? 0)
        f["interestEarned"] = .number(proj.interest)
        f["maturityAmount"] = .number(proj.maturity)
        f["tds"] = .number(parse(d.tds) ?? 0)
        f["remarks"] = .string(d.remarks)
        f["currentValue"] = .number(p + proj.accrued)
        if f["renewalCount"] == nil { f["renewalCount"] = .number(0) }
        return .object(f)
    }

    /// Close early or at maturity: archived, with the final interest fixed (CloseDepositModal / handleConfirmCloseModal).
    static func closedRow(_ d: JSONValue, closureDate: String, finalInterest: Double, remarks: String) -> JSONValue {
        var f = d.object
        let p = num(d["originalAmount"])
        f["isArchived"] = .bool(true)
        if RecordEditing.isDate(closureDate) { f["endDate"] = .string(closureDate) }
        f["interestEarned"] = .number(finalInterest)
        f["currentValue"] = .number(p + finalInterest)
        f["maturityAmount"] = .number(p + finalInterest)
        if !remarks.isEmpty { f["remarks"] = .string(remarks) }
        return .object(f)
    }

    /// Fields to PATCH after a change to the account's fixed deposits.
    static func depositsPatch(account: JSONValue, change: ListChange, asOf: Date = Date()) -> Result<[String: Any], Failure> {
        switch apply(change, to: account["deposits"].array, what: "deposit") {
        case .failure(let f): return .failure(f)
        case .success(let rows):
            return .success(["deposits": rows.map(RecordEditing.foundation), "amount": fdAccountAmount(rows, asOf: asOf)])
        }
    }

    // MARK: Recurring deposit form (RecurringDepositModal.jsx)

    struct RDDraft: Equatable {
        var name = "", installmentAmount = "", interestRate = "", maturityAmount = "", deductionDay = "", status = "Active"
        var startDate = NewTransaction.isoDay(Date()), endDate = ""
    }

    static func rdDraft(from d: JSONValue) -> RDDraft {
        func n(_ k: String) -> String { d[k].double == 0 ? "" : RecordEditing.number(d[k].double) }
        return RDDraft(name: d["name"].text, installmentAmount: n("installmentAmount"), interestRate: n("interestRate"), maturityAmount: n("maturityAmount"),
                       deductionDay: d["deductionDay"].isNull ? "" : RecordEditing.number(d["deductionDay"].double), status: d["status"].truthy ? d["status"].text : "Active",
                       startDate: String(d["startDate"].text.prefix(10)), endDate: String(d["endDate"].text.prefix(10)))
    }

    static func rdProblems(_ d: RDDraft) -> [String] {
        var out: [String] = []
        if d.name.trimmingCharacters(in: .whitespaces).isEmpty { out.append("Enter a name.") }
        if !((parse(d.installmentAmount) ?? 0) > 0) { out.append("Enter the monthly instalment.") }
        if !RecordEditing.isDate(d.startDate) || !RecordEditing.isDate(d.endDate) { out.append("Pick the start and end dates.") }
        else if d.endDate < d.startDate { out.append("The end date must be after the start date.") }
        if !((parse(d.interestRate) ?? 0) > 0) { out.append("Enter the interest rate.") }
        if !((parse(d.maturityAmount) ?? 0) > 0) { out.append("Enter the maturity amount.") }
        if !d.deductionDay.isEmpty, !(1...31).contains(Int(d.deductionDay) ?? 0) { out.append("Deduction day is 1 to 31, or blank.") }
        return out
    }

    /// Spread first: the form knows eight fields; the stored deposit also carries its instalments and interest.
    static func rdRow(_ d: RDDraft, id: String, base: JSONValue = .null) -> JSONValue {
        var f = base.object
        f["id"] = base["id"].isNull ? (Int64(id).map { .number(Double($0)) } ?? .string(id)) : base["id"]
        f["name"] = .string(d.name.trimmingCharacters(in: .whitespaces))
        f["installmentAmount"] = .number(parse(d.installmentAmount) ?? 0)
        f["startDate"] = .string(d.startDate); f["endDate"] = .string(d.endDate)
        f["interestRate"] = .number(parse(d.interestRate) ?? 0)
        f["maturityAmount"] = .number(parse(d.maturityAmount) ?? 0)
        f["status"] = .string(d.status)
        f["deductionDay"] = d.deductionDay.isEmpty ? .null : .number(Double(d.deductionDay) ?? 0)
        return .object(f)
    }

    static func recurringPatch(account: JSONValue, change: ListChange) -> Result<[String: Any], Failure> {
        switch apply(change, to: account["recurringDeposits"].array, what: "recurring deposit") {
        case .failure(let f): return .failure(f)
        case .success(let rows): return .success(["recurringDeposits": rows.map(RecordEditing.foundation), "amount": rdAccountAmount(rows)])
        }
    }

    // MARK: Instalments and interest inside one deposit

    struct EntryDraft: Equatable {
        var date = NewTransaction.isoDay(Date()), amount = "", remarks = ""
    }

    static func entryDraft(from e: JSONValue) -> EntryDraft {
        EntryDraft(date: String(e["date"].text.prefix(10)), amount: e["amount"].double == 0 ? "" : RecordEditing.number(e["amount"].double), remarks: e["remarks"].text)
    }

    static func entryProblems(_ d: EntryDraft) -> [String] {
        var out: [String] = []
        if !RecordEditing.isDate(d.date) { out.append("Pick a date.") }
        if !((parse(d.amount) ?? 0) > 0) { out.append("Enter an amount above zero.") }
        return out
    }

    /// An instalment (`interest: false`) or an interest credit, which also carries its financial year.
    static func entryRow(_ d: EntryDraft, id: String, base: JSONValue = .null, interest: Bool) -> JSONValue {
        var f = base.object
        f["id"] = base["id"].isNull ? (Int64(id).map { .number(Double($0)) } ?? .string(id)) : base["id"]
        f["date"] = .string(d.date)
        f["amount"] = .number(parse(d.amount) ?? 0)
        f["remarks"] = .string(d.remarks)
        if interest { f["financialYear"] = .string(financialYear(d.date)) }
        return .object(f)
    }

    /// Changes one row of a list inside one deposit (`installments` or `interestTransactions`),
    /// leaving the deposit's other fields, the other deposits and the account's `amount` alone.
    static func nestedPatch(account: JSONValue, listKey: String, depositId: String, subKey: String, change: ListChange) -> Result<[String: Any], Failure> {
        var deposits = account[listKey].array
        guard let i = deposits.firstIndex(where: { $0["id"].text == depositId }) else {
            return .failure(Failure(message: "That deposit is no longer on your Mac. Nothing was changed."))
        }
        switch apply(change, to: deposits[i][subKey].array, what: subKey == "installments" ? "instalment" : "entry") {
        case .failure(let f): return .failure(f)
        case .success(let rows):
            var d = deposits[i].object
            d[subKey] = .array(rows)
            deposits[i] = .object(d)
            return .success([listKey: deposits.map(RecordEditing.foundation)])
        }
    }
}
