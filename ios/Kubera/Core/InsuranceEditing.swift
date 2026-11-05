import Foundation

/// Editing on the insurance analysis page: the profile (age, dependents, income, liabilities) and a policy's own details,
/// following `InsuranceAnalysis.jsx` (`handleSaveProfile`) and `PolicyScannerModal.jsx` (`handleSubmit`).
enum InsuranceEditing {
    /// JavaScript's `Number(x) || fallback`.
    private static func number(_ s: String, fallback: Double) -> Double {
        let v = Double(s.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")) ?? 0
        return v.isNaN || v == 0 ? fallback : v
    }

    // MARK: Profile

    static func profileFields(age: String, dependents: String, income: String, liabilities: String) -> [String: Any] {
        ["age": number(age, fallback: 30), "dependents": number(dependents, fallback: 0), "annualIncome": number(income, fallback: 0), "liabilities": number(liabilities, fallback: 0)]
    }

    // MARK: Policy

    static let categories: [(id: String, label: String)] = [("bike", "Two-wheeler"), ("car", "Car"), ("health", "Health"), ("life", "Life"), ("home", "Home"), ("other", "Other")]

    struct Form: Equatable {
        var category = "bike", planName = "", insurer = "", policyNumber = "", vehicleNo = "", sumAssured = "", premiumAmount = ""
        var startDate = "", expiryDate = "", policyTerm = "", premiumPayingTerm = "", premiumDeductionDate = "", ncb = "0", notes = "", payoutSchedule = ""
        var benefitPoints: [String] = []
        var isVehicle: Bool { category == "bike" || category == "car" }
    }

    /// The form as the Mac's modal opens it for an existing policy.
    static func form(from policy: JSONValue) -> Form {
        let d = policy["policyDetails"]
        func text(_ v: JSONValue) -> String { v.truthy ? (v.double != 0 || v.text != "0" ? (Double(v.text) != nil ? RecordEditing.number(v.double) : v.text) : "") : "" }
        var f = Form()
        f.category = d["category"].truthy ? d["category"].text : "bike"
        f.planName = d["planName"].truthy ? d["planName"].text : policy["title"].text
        f.insurer = d["insurer"].text; f.policyNumber = d["policyNumber"].text; f.vehicleNo = d["vehicleNo"].text
        f.sumAssured = text(d["sumAssured"].truthy ? d["sumAssured"] : policy["amount"]); f.premiumAmount = text(d["premiumAmount"])
        f.startDate = d["startDate"].text
        f.expiryDate = [d["maturityDate"], d["expiryDate"]].first { $0.truthy }?.text ?? ""
        f.policyTerm = d["policyTerm"].truthy ? d["policyTerm"].text : ""; f.premiumPayingTerm = d["premiumPayingTerm"].truthy ? d["premiumPayingTerm"].text : ""
        f.premiumDeductionDate = d["premiumDeductionDate"].text
        f.ncb = d["ncb"].truthy ? d["ncb"].text : "0"
        f.notes = d["notes"].text; f.payoutSchedule = d["payoutSchedule"].text
        f.benefitPoints = d["benefitPoints"].array.map(\.text)
        return f
    }

    static func problems(_ f: Form) -> [String] {
        var out: [String] = []
        if f.planName.trimmingCharacters(in: .whitespaces).isEmpty { out.append("Enter the plan name.") }
        if !(number(f.sumAssured, fallback: 0) > 0) { out.append(f.isVehicle ? "Enter the insured value." : "Enter the sum assured.") }
        return out
    }

    /// The fields a save writes. `editing` keeps every field the form does not show (premiums, benefits, claims, documents, and inside
    /// `policyDetails` the plan notes and tax benefit), exactly as the Mac's form spreads the existing record first.
    static func fields(_ f: Form, editing: JSONValue = .null, now: String) -> [String: Any] {
        var d = editing["policyDetails"].object.mapValues { RecordEditing.foundation($0) }
        let sum = number(f.sumAssured, fallback: 0)
        func orDefault(_ s: String, _ fallback: String) -> String { s.isEmpty ? fallback : s }
        d["category"] = f.category
        d["planName"] = f.planName
        d["insurer"] = orDefault(f.insurer, "General Insurance")
        d["policyNumber"] = orDefault(f.policyNumber, "POL-UNSPECIFIED")
        d["vehicleNo"] = f.isVehicle ? f.vehicleNo : ""
        d["sumAssured"] = sum
        d["premiumAmount"] = number(f.premiumAmount, fallback: 0)
        d["startDate"] = f.startDate
        // Left as typed so "Whole Life (100 Years)" survives a round trip.
        d["policyTerm"] = f.policyTerm.trimmingCharacters(in: .whitespaces)
        let ppt = number(f.premiumPayingTerm, fallback: 0)
        d["premiumPayingTerm"] = f.premiumPayingTerm.isEmpty || ppt == 0 ? "" : ppt as Any
        d["premiumDeductionDate"] = f.premiumDeductionDate.isEmpty ? NSNull() : f.premiumDeductionDate
        d["maturityDate"] = f.expiryDate; d["expiryDate"] = f.expiryDate
        d["ncb"] = number(f.ncb, fallback: 0)
        d["status"] = "Active"
        d["notes"] = f.notes; d["payoutSchedule"] = f.payoutSchedule
        d["benefitPoints"] = f.benefitPoints.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        return ["title": f.planName, "amount": sum, "policyDetails": d, "updatedAt": now]
    }

    /// A whole new policy record, as the Mac adds one.
    static func newPolicy(_ f: Form, id: String, now: String) -> [String: Any] {
        var r = fields(f, now: now); r["id"] = id; r["type"] = "Policy"; return r
    }
}
