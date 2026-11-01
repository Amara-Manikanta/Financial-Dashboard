import Foundation

/// Adding, changing and deleting a person's transactions (`LentTransactionModal.jsx`) and a loan's EMI payments
/// (`LoanPaymentModal.jsx`). Both live as a list inside the person's or loan's record; a change is one row of
/// that list, applied through `AccountOp.list` so it is rebuilt against the Mac's record when sent.
enum LoanLedger {
    private static func parse(_ s: String) -> Double? { Double(s.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")) }
    private static func num(_ v: Double) -> String { v == 0 ? "" : RecordEditing.number(v) }

    // MARK: A person's transactions

    struct LentDraft: Equatable {
        /// `repayment` (money back) or `additional` (lent or borrowed more).
        var type = "repayment"
        var amount = ""
        var date = NewTransaction.isoDay(Date())
        var description = ""
    }

    static func lentDraft(from row: JSONValue) -> LentDraft {
        LentDraft(type: row["type"].text == "additional" ? "additional" : "repayment", amount: num(row["amount"].double),
                  date: String(row["date"].text.prefix(10)), description: row["description"].text)
    }

    static func lentProblems(_ d: LentDraft) -> [String] {
        var out: [String] = []
        if !((parse(d.amount) ?? 0) > 0) { out.append("Enter an amount above zero.") }
        if !RecordEditing.isDate(d.date) { out.append("Pick a date.") }
        return out
    }

    /// The stored row: the existing row first (so nothing the form does not show is dropped), then the form.
    static func lentRow(_ d: LentDraft, id: String, base: JSONValue = .null) -> JSONValue {
        var o = base.object
        o["id"] = base["id"].isNull ? .string(id) : base["id"]
        o["amount"] = .number(parse(d.amount) ?? 0)
        o["date"] = .string(d.date)
        o["type"] = .string(d.type)
        o["description"] = .string(d.description)
        return .object(o)
    }

    // MARK: A loan's payments

    static let paymentModes: [(id: String, label: String)] = [
        ("auto_debit", "Bank auto-debit"), ("credit_card", "Credit card EMI"), ("net_banking", "Net banking / NEFT"),
        ("upi", "UPI / GPay / PhonePe"), ("cash", "Cash / cheque")]

    struct PaymentDraft: Equatable {
        var date = NewTransaction.isoDay(Date())
        var amount = ""
        var emiNumber = ""
        var mode = "auto_debit"
        var card = ""
        var fee = ""
        var gst = ""
        var notes = ""
    }

    /// A new payment starts as the Mac's form does: today, the loan's EMI, the next instalment number, the lender as the card.
    static func paymentDraft(newFor loan: JSONValue) -> PaymentDraft {
        PaymentDraft(amount: num(loan["emiAmount"].double), emiNumber: String(loan["payments"].array.count + 1), card: loan["lender"].text)
    }

    static func paymentDraft(from p: JSONValue) -> PaymentDraft {
        PaymentDraft(date: String(p["date"].text.prefix(10)), amount: num(p["amount"].double), emiNumber: num(p["emiNumber"].double),
                     mode: p["paymentMode"].truthy ? p["paymentMode"].text : "auto_debit", card: p["creditCardName"].text,
                     fee: num(p["processingFee"].double), gst: num(p["gstAmount"].double), notes: p["notes"].text)
    }

    static func paymentProblems(_ d: PaymentDraft) -> [String] {
        var out: [String] = []
        if !((parse(d.amount) ?? 0) > 0) { out.append("Enter the amount paid.") }
        if !RecordEditing.isDate(d.date) { out.append("Pick the payment date.") }
        if !((parse(d.emiNumber) ?? 0) >= 1) { out.append("Instalment number starts at 1.") }
        for (v, name) in [(d.fee, "Processing fee"), (d.gst, "GST")] where !v.isEmpty && parse(v) == nil { out.append("\(name) is not a number.") }
        return out
    }

    static func paymentRow(_ d: PaymentDraft, base: JSONValue = .null, now: Date = Date()) -> JSONValue {
        var o = base.object
        o["id"] = base["id"].isNull ? .string("pay_\(Int64(now.timeIntervalSince1970 * 1000))") : base["id"]
        o["date"] = .string(d.date)
        o["amount"] = .number(parse(d.amount) ?? 0)
        o["emiNumber"] = .number(max(1, (parse(d.emiNumber) ?? 1).rounded()))
        o["paymentMode"] = .string(d.mode)
        o["creditCardName"] = .string(d.card)
        o["processingFee"] = .number(parse(d.fee) ?? 0)
        o["gstAmount"] = .number(parse(d.gst) ?? 0)
        o["notes"] = .string(d.notes)
        if base["createdAt"].isNull { o["createdAt"] = .string(ISO8601DateFormatter.jsString(now)) }
        return .object(o)
    }
}

extension ISO8601DateFormatter {
    /// `2026-10-31T09:15:00.000Z`, the form JavaScript's `toISOString()` writes.
    static func jsString(_ d: Date) -> String {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f.string(from: d)
    }
}
