import Foundation

/// Employment tenures (`appData.employments`) as the Salary page's modal edits them (`handleSaveEmployment`,
/// `handleDeleteEmployment`). Each save is applied to the list as it is on the Mac now, so a tenure added there
/// meanwhile is never lost.
enum EmploymentEditing {
    struct Form: Equatable {
        var companyName = "", designation = "", startDate = "", endDate = ""
        var isCurrent = true
        var status = "active"
        var lastDrawnBasic = "", notes = ""
    }
    enum Change { case add(Form), replace(id: String, Form), delete(id: String) }

    static let statuses: [(id: String, label: String)] = [("active", "Active (accruing)"), ("claimed", "Claimed & paid out"), ("forfeited", "Forfeited (left under 5 years)")]

    static func form(from emp: JSONValue) -> Form {
        Form(companyName: emp["companyName"].text, designation: emp["designation"].text, startDate: emp["startDate"].text, endDate: emp["endDate"].text,
             isCurrent: emp["isCurrent"].isNull ? true : emp["isCurrent"].truthy, status: emp["status"].truthy ? emp["status"].text : "active",
             lastDrawnBasic: emp["lastDrawnBasic"].truthy ? RecordEditing.number(emp["lastDrawnBasic"].double) : "", notes: emp["notes"].text)
    }

    static func problems(_ f: Form) -> [String] {
        var out: [String] = []
        if f.companyName.trimmingCharacters(in: .whitespaces).isEmpty { out.append("Enter the company name.") }
        if !f.isCurrent, !f.startDate.isEmpty, !f.endDate.isEmpty, f.endDate < f.startDate { out.append("The end date is before the start date.") }
        if !f.lastDrawnBasic.isEmpty, Double(f.lastDrawnBasic.replacingOccurrences(of: ",", with: "")) == nil { out.append("Last drawn basic is not a number.") }
        return out
    }

    /// One stored tenure. An end date is dropped while the job is current, as the Mac's form blanks it.
    static func row(_ f: Form, id: String) -> [String: Any] {
        let basic = Double(f.lastDrawnBasic.replacingOccurrences(of: ",", with: ""))
        return ["id": id, "companyName": f.companyName.trimmingCharacters(in: .whitespaces), "designation": f.designation, "startDate": f.startDate,
                "endDate": f.isCurrent ? "" : f.endDate, "isCurrent": f.isCurrent, "status": f.status, "lastDrawnBasic": basic.map { $0 as Any } ?? "", "notes": f.notes]
    }

    /// The new list, or nil when the tenure being changed is no longer there.
    static func apply(_ change: Change, to list: [JSONValue], newId: String) -> [Any]? {
        let fo = RecordEditing.foundation
        switch change {
        case .add(let f): return list.map(fo) + [row(f, id: newId)]
        case .replace(let id, let f):
            guard list.contains(where: { $0["id"].text == id }) else { return nil }
            return list.map { $0["id"].text == id ? row(f, id: id) : fo($0) }
        case .delete(let id):
            guard list.contains(where: { $0["id"].text == id }) else { return nil }
            return list.filter { $0["id"].text != id }.map(fo)
        }
    }
}
