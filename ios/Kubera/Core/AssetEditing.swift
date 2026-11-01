import Foundation

/// Adding, changing and deleting what the Mac's asset pages edit: the items of a category, an item's rent and cost entries,
/// its services and receipts, and a property's units. Each is built as an *intent* that is applied to an asset category as it
/// is now, so it works offline and is rebuilt against the Mac's record when sent — see `AccountOp`.
enum AssetOp {
    enum ListEdit { case add(JSONValue), replace(id: String, JSONValue), delete(id: String) }
    enum EntryEdit {
        case add(JSONValue)
        /// `from` is the unit the entry lived in when it was opened, so a move to another unit removes it from the first.
        case replace(JSONValue, from: String?)
        case delete(id: String)
    }

    /// A new item in the category.
    case addItem(JSONValue)
    case deleteItem(itemId: String)
    /// An item's own fields: what to set, what to drop, and what each held when the phone read it.
    case itemFields(itemId: String, set: [String: JSONValue], remove: [String], expected: [String: JSONValue])
    /// A rent or cost entry of the item (or of one of its units; nil is the building itself).
    case entry(itemId: String, unit: String?, EntryEdit)
    /// A row, by id, of `services` or `receipts`.
    case sublist(itemId: String, key: String, ListEdit)
    case unit(itemId: String, ListEdit)

    struct Failure: Error { let message: String }

    private static func gone(_ what: String) -> Failure { Failure(message: "That \(what) was changed or removed on your Mac. Nothing was saved — reopen it and try again.") }

    private static func apply(_ edit: ListEdit, to rows: [JSONValue], what: String) -> Result<[JSONValue], Failure> {
        var rows = rows
        switch edit {
        case .add(let r): rows.append(r)
        case .replace(let id, let r):
            guard let i = rows.firstIndex(where: { $0["id"].text == id }) else { return .failure(gone(what)) }
            rows[i] = r
        case .delete(let id):
            guard let i = rows.firstIndex(where: { $0["id"].text == id }) else { return .failure(gone(what)) }
            rows.remove(at: i)
        }
        return .success(rows)
    }

    // MARK: Entries live in the building or in a unit

    private static func unit(_ item: JSONValue, _ id: String?) -> JSONValue? {
        guard let id, !id.isEmpty else { return nil }
        return PropertyUnits.allUnits(item).first { $0["id"].text == id }
    }

    private static func withEntries(_ item: JSONValue, in unitId: String?, _ change: ([JSONValue]) -> Result<[JSONValue], Failure>) -> Result<JSONValue, Failure> {
        if let unitId, !unitId.isEmpty {
            guard let u = unit(item, unitId) else { return .failure(gone("unit")) }
            switch change(u["transactions"].array) {
            case .failure(let f): return .failure(f)
            case .success(let rows):
                var o = u.object; o["transactions"] = .array(rows)
                return .success(PropertyUnits.applyUnit(item, .object(o)))
            }
        }
        switch change(item["transactions"].array) {
        case .failure(let f): return .failure(f)
        case .success(let rows): var o = item.object; o["transactions"] = .array(rows); return .success(.object(o))
        }
    }

    /// The item after the change, or why it can no longer be made.
    func apply(toItem item: JSONValue) -> Result<JSONValue, Failure> {
        switch self {
        case .addItem, .deleteItem: return .success(item)
        case .itemFields(_, let set, let remove, let expected):
            for (k, old) in expected where item[k] != old && !(item[k].isNull && old.isNull) {
                return .failure(Failure(message: "“\(RecordEditing.label(k))” was changed on your Mac since you edited it, so this change was not applied."))
            }
            var o = item.object
            for (k, v) in set { o[k] = v }
            for k in remove { o.removeValue(forKey: k) }
            return .success(.object(o))
        case .entry(_, let unitId, let edit):
            switch edit {
            case .add(let row): return Self.withEntries(item, in: unitId) { .success($0 + [row]) }
            case .delete(let id): return Self.withEntries(item, in: unitId) { Self.apply(.delete(id: id), to: $0, what: "entry") }
            case .replace(let row, let from):
                if (from ?? "") != (unitId ?? "") {
                    // Moved to another unit: out of the first before into the second, or the same row could be deleted again.
                    switch Self.withEntries(item, in: from, { Self.apply(.delete(id: row["id"].text), to: $0, what: "entry") }) {
                    case .failure(let f): return .failure(f)
                    case .success(let moved): return Self.withEntries(moved, in: unitId) { .success($0 + [row]) }
                    }
                }
                return Self.withEntries(item, in: unitId) { Self.apply(.replace(id: row["id"].text, row), to: $0, what: "entry") }
            }
        case .sublist(_, let key, let edit):
            // Receipts have no id of their own — the Mac removes one by its file's url.
            if key == "receipts", case .delete(let ref) = edit {
                let rows = item[key].array
                guard rows.contains(where: { $0["url"].text == ref || $0["id"].text == ref }) else { return .failure(Self.gone("receipt")) }
                var o = item.object; o[key] = .array(rows.filter { $0["url"].text != ref && $0["id"].text != ref }); return .success(.object(o))
            }
            switch Self.apply(edit, to: item[key].array, what: key == "services" ? "service" : "receipt") {
            case .failure(let f): return .failure(f)
            case .success(let rows): var o = item.object; o[key] = .array(rows); return .success(.object(o))
            }
        case .unit(_, let edit):
            switch edit {
            case .add(let u), .replace(_, let u): return .success(PropertyUnits.applyUnit(item, u))
            case .delete(let id):
                if id == PropertyUnits.mainId { return .failure(Failure(message: "This tenancy is stored on the property itself. Remove it by editing the property and unticking “let out”.")) }
                var o = item.object
                o["units"] = .array(item["units"].array.filter { $0["id"].text != id })
                return .success(.object(o))
            }
        }
    }

    var itemId: String? {
        switch self {
        case .addItem: return nil
        case .deleteItem(let id), .itemFields(let id, _, _, _), .entry(let id, _, _), .sublist(let id, _, _), .unit(let id, _): return id
        }
    }

    /// The fields to PATCH on the category record (`items`), from the category as it is now.
    func patch(for category: JSONValue) -> Result<[String: Any], Failure> {
        var items = category["items"].array
        switch self {
        case .addItem(let item): items.append(item)
        case .deleteItem(let id):
            guard let i = items.firstIndex(where: { $0["id"].text == id }) else { return .failure(Self.gone("item")) }
            items.remove(at: i)
        default:
            guard let id = itemId, let i = items.firstIndex(where: { $0["id"].text == id }) else { return .failure(Self.gone("item")) }
            switch apply(toItem: items[i]) {
            case .failure(let f): return .failure(f)
            case .success(let updated): items[i] = updated
            }
        }
        return .success(["items": items.map(RecordEditing.foundation)])
    }
}

/// Forms for the above — the same fields and the same stored shape as the Mac's `AssetItemModal`,
/// `AssetTransactionModal`, `PropertyUnitModal` and the warranty panel.
enum AssetEditing {
    private static func parse(_ s: String) -> Double? { Double(s.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")) }
    private static func text(_ v: JSONValue) -> String { v.isNull ? "" : v.text }
    private static func numText(_ v: JSONValue) -> String { v.isNull || v.text.isEmpty ? "" : (v.jsNumber.map { $0 == 0 ? "" : RecordEditing.number($0) } ?? v.text) }
    static func newId(_ now: Date = Date()) -> String { String(Int64(now.timeIntervalSince1970 * 1000)) }

    // MARK: Tenancy

    struct RentalDraft: Equatable {
        var unitName = "", tenantName = "", tenantContact = ""
        var monthlyRent = "", rentDueDay = "", advanceAmount = ""
        var escalationType = "percent", escalationValue = "", escalationEveryMonths = "12"
        var leaseStart = "", leaseEnd = "", rules = ""
        var terms: [String] = []
    }

    static func rentalDraft(from r: JSONValue) -> RentalDraft {
        RentalDraft(unitName: text(r["unitName"]), tenantName: text(r["tenantName"]), tenantContact: text(r["tenantContact"]),
                    monthlyRent: numText(r["monthlyRent"]), rentDueDay: numText(r["rentDueDay"]), advanceAmount: numText(r["advanceAmount"]),
                    escalationType: r["escalationType"].truthy ? r["escalationType"].text : "percent", escalationValue: numText(r["escalationValue"]),
                    escalationEveryMonths: r["escalationEveryMonths"].truthy ? numText(r["escalationEveryMonths"]) : "12",
                    leaseStart: String(text(r["leaseStart"]).prefix(10)), leaseEnd: String(text(r["leaseEnd"]).prefix(10)), rules: text(r["rules"]),
                    terms: r["terms"].array.map(\.text))
    }

    /// The stored tenancy: the existing one first (so fields the form does not show survive), then the form.
    static func rentalValue(_ d: RentalDraft, base: JSONValue = .null) -> JSONValue {
        var o = base.object
        o["unitName"] = .string(d.unitName); o["tenantName"] = .string(d.tenantName); o["tenantContact"] = .string(d.tenantContact)
        o["monthlyRent"] = .number(parse(d.monthlyRent) ?? 0)
        o["advanceAmount"] = .number(parse(d.advanceAmount) ?? 0)
        o["escalationType"] = .string(d.escalationType)
        o["escalationValue"] = .number(parse(d.escalationValue) ?? 0)
        o["escalationEveryMonths"] = .number((parse(d.escalationEveryMonths) ?? 0) != 0 ? parse(d.escalationEveryMonths)! : 12)
        o["rentDueDay"] = (parse(d.rentDueDay) ?? 0) != 0 ? .number(parse(d.rentDueDay)!) : .string("")
        o["leaseStart"] = .string(d.leaseStart); o["leaseEnd"] = .string(d.leaseEnd); o["rules"] = .string(d.rules)
        o["terms"] = .array(d.terms.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }.map { .string($0) })
        return .object(o)
    }

    static func rentalProblems(_ d: RentalDraft) -> [String] {
        var out: [String] = []
        if !((parse(d.monthlyRent) ?? 0) > 0) { out.append("Enter the monthly rent.") }
        if !d.rentDueDay.isEmpty, !(1...31).contains(Int(d.rentDueDay) ?? 0) { out.append("Rent due day is 1 to 31, or blank.") }
        if !d.leaseStart.isEmpty && !RecordEditing.isDate(d.leaseStart) { out.append("Lease start is not a date.") }
        if !d.leaseEnd.isEmpty && !RecordEditing.isDate(d.leaseEnd) { out.append("Lease end is not a date.") }
        if RecordEditing.isDate(d.leaseStart) && RecordEditing.isDate(d.leaseEnd) && d.leaseEnd < d.leaseStart { out.append("The lease ends before it starts.") }
        return out
    }

    // MARK: An item

    struct ItemDraft: Equatable {
        var name = ""
        var purchaseDate = ""          // blank = not recorded
        var purchasePrice = "", currentValue = ""
        var place = "", dimensions = "", remarks = ""
        var isLet = false
        var rental = RentalDraft()
        var serialNumber = "", seller = ""
        var warrantyMonths = "", warrantyExpiry = "", extendedMonths = "", extendedExpiry = "", extendedCost = ""
    }

    static func itemDraft(from i: JSONValue) -> ItemDraft {
        var d = ItemDraft(name: text(i["name"]), purchaseDate: String(text(i["purchaseDate"]).prefix(10)),
                          purchasePrice: numText(i["purchasePrice"].truthy ? i["purchasePrice"] : i["purchasedValue"]), currentValue: numText(i["currentValue"]),
                          place: text(i["place"]), dimensions: text(i["dimensions"].truthy ? i["dimensions"] : i["Dimensions"]), remarks: text(i["remarks"]),
                          isLet: i["rental"].truthy, serialNumber: text(i["serialNumber"]), seller: text(i["seller"]),
                          warrantyMonths: numText(i["warrantyMonths"]), warrantyExpiry: String(text(i["warrantyExpiry"]).prefix(10)),
                          extendedMonths: numText(i["extendedMonths"]), extendedExpiry: String(text(i["extendedExpiry"]).prefix(10)), extendedCost: numText(i["extendedCost"]))
        if i["rental"].truthy { d.rental = rentalDraft(from: i["rental"]) }
        return d
    }

    static func itemProblems(_ d: ItemDraft, isRealEstate: Bool, hasUnits: Bool) -> [String] {
        var out: [String] = []
        if d.name.trimmingCharacters(in: .whitespaces).isEmpty { out.append("Enter a name.") }
        if !d.purchaseDate.isEmpty && !RecordEditing.isDate(d.purchaseDate) { out.append("Purchase date is not a date.") }
        for (v, n) in [(d.purchasePrice, "Purchase price"), (d.currentValue, "Current value"), (d.extendedCost, "Extended cover cost"), (d.warrantyMonths, "Warranty months"), (d.extendedMonths, "Extended months")]
        where !v.isEmpty && parse(v) == nil { out.append("\(n) is not a number.") }
        if !isRealEstate {
            for (v, n) in [(d.warrantyExpiry, "Warranty expiry"), (d.extendedExpiry, "Extended expiry")] where !v.isEmpty && !RecordEditing.isDate(v) { out.append("\(n) is not a date.") }
        }
        if isRealEstate && d.isLet && !hasUnits { out += rentalProblems(d.rental) }
        return out
    }

    /// The stored item, as the Mac's form saves it: the existing item first, so the receipts, services, entries and units this form does not edit survive.
    static func itemRow(_ d: ItemDraft, isRealEstate: Bool, id: String, base: JSONValue = .null) -> JSONValue {
        var o = base.object
        o["id"] = base["id"].isNull ? .string(id) : base["id"]
        o["name"] = .string(d.name.trimmingCharacters(in: .whitespaces))
        o["purchaseDate"] = .string(d.purchaseDate)
        o["purchasePrice"] = .number(parse(d.purchasePrice) ?? 0)
        o["currentValue"] = .number(parse(d.currentValue) ?? 0)
        o["place"] = isRealEstate ? .string(d.place) : .null
        o["dimensions"] = isRealEstate ? .string(d.dimensions) : .null
        o["remarks"] = .string(d.remarks)
        if !isRealEstate {
            // Blank stays blank: 0 months would read as "expired the day it was bought" rather than "not recorded".
            func months(_ s: String) -> JSONValue { s.isEmpty ? .string("") : ((parse(s) ?? 0) != 0 ? .number(parse(s)!) : .string("")) }
            o["serialNumber"] = .string(d.serialNumber.trimmingCharacters(in: .whitespaces))
            o["seller"] = .string(d.seller.trimmingCharacters(in: .whitespaces))
            o["warrantyMonths"] = months(d.warrantyMonths); o["warrantyExpiry"] = .string(d.warrantyExpiry)
            o["extendedMonths"] = months(d.extendedMonths); o["extendedExpiry"] = .string(d.extendedExpiry)
            o["extendedCost"] = months(d.extendedCost)
            o["receipts"] = .array(base["receipts"].array); o["services"] = .array(base["services"].array)
        }
        if isRealEstate && d.isLet { o["rental"] = rentalValue(d.rental, base: base["rental"]) } else { o.removeValue(forKey: "rental") }
        o["transactions"] = .array(base["transactions"].array)
        if base["units"].isNull { o.removeValue(forKey: "units") } else { o["units"] = base["units"] }
        return .object(o)
    }

    /// The change from `old` to `new` as an intent: what to set, what to drop, and what each changed field held.
    static func itemEdit(itemId: String, old: JSONValue, new: JSONValue) -> AssetOp {
        var set: [String: JSONValue] = [:], remove: [String] = [], expected: [String: JSONValue] = [:]
        let keys = Set(old.object.keys).union(new.object.keys)
        for k in keys where old[k] != new[k] {
            expected[k] = old[k]
            if new.object[k] == nil { remove.append(k) } else { set[k] = new[k] }
        }
        return .itemFields(itemId: itemId, set: set, remove: remove, expected: expected)
    }

    // MARK: An entry (rent, bill, tax, repair…)

    struct EntryDraft: Equatable {
        var kind = "rent"
        var date = NewTransaction.isoDay(Date())
        var amount = "", period = "", description = ""
        var borne = "owner", recoveredAmount = ""
        /// The unit it belongs to; blank is the building itself.
        var unit = ""
    }

    static func entryDraft(newFor isRealEstate: Bool, unit: String?) -> EntryDraft {
        EntryDraft(kind: isRealEstate ? "rent" : "maintenance", unit: unit ?? "")
    }

    static func entryDraft(from e: JSONValue, unit: String?) -> EntryDraft {
        EntryDraft(kind: Rental.kindOf(e), date: String(text(e["date"]).prefix(10)), amount: numText(e["amount"]), period: text(e["period"]), description: text(e["description"]),
                   borne: Rental.borneBy(e).rawValue, recoveredAmount: e["recoveredAmount"].isNull ? "" : numText(e["recoveredAmount"]), unit: unit ?? "")
    }

    static func entryProblems(_ d: EntryDraft) -> [String] {
        var out: [String] = []
        if !((parse(d.amount) ?? 0) > 0) { out.append("Enter an amount above zero.") }
        if !RecordEditing.isDate(d.date) { out.append("Pick a date.") }
        if let k = Rental.kind(d.kind), k.hasPeriod, !d.period.isEmpty, Rental.parsePeriod(d.period) == nil { out.append("The month is not one I can read — try 2026-08 or August 2026.") }
        if d.borne == "recovered", !d.recoveredAmount.isEmpty, parse(d.recoveredAmount) == nil { out.append("Recovered amount is not a number.") }
        return out
    }

    static func entryRow(_ d: EntryDraft, isRealEstate: Bool, id: String, base: JSONValue = .null) -> JSONValue {
        var o = base.object
        let kind = Rental.kind(d.kind) ?? Rental.kind("other_income")!
        o["id"] = base["id"].isNull ? .string(id) : base["id"]
        o["date"] = .string(d.date)
        o["kind"] = .string(kind.key)
        o["type"] = .string(kind.income ? "income" : "expense")
        o["amount"] = .number(parse(d.amount) ?? 0)
        // Stored as YYYY-MM whatever was typed, so the rent ledger can match it to a month.
        o["period"] = .string(kind.hasPeriod ? (Rental.parsePeriod(d.period) ?? "") : "")
        o["description"] = .string(d.description)
        if Rental.asksWhoPays(kind: kind.key, isRealEstate: isRealEstate) {
            o["borne"] = .string(d.borne.isEmpty ? "owner" : d.borne)
            if d.borne == "recovered" && !d.recoveredAmount.isEmpty { o["recoveredAmount"] = .number(parse(d.recoveredAmount) ?? 0) } else { o.removeValue(forKey: "recoveredAmount") }
        } else {
            o.removeValue(forKey: "borne"); o.removeValue(forKey: "recoveredAmount")
        }
        return .object(o)
    }

    // MARK: A service

    struct ServiceDraft: Equatable {
        var date = NewTransaction.isoDay(Date()), description = "", provider = "", cost = ""
        var underWarranty = false
    }

    static func serviceDraft(from s: JSONValue) -> ServiceDraft {
        ServiceDraft(date: String(text(s["date"]).prefix(10)), description: text(s["description"]), provider: text(s["provider"]), cost: numText(s["cost"]), underWarranty: s["underWarranty"].truthy)
    }

    static func serviceProblems(_ d: ServiceDraft) -> [String] {
        var out: [String] = []
        if d.description.trimmingCharacters(in: .whitespaces).isEmpty { out.append("Describe what was done.") }
        if !RecordEditing.isDate(d.date) { out.append("Pick a date.") }
        if !d.cost.isEmpty && parse(d.cost) == nil { out.append("Cost is not a number.") }
        return out
    }

    static func serviceRow(_ d: ServiceDraft, id: String, base: JSONValue = .null) -> JSONValue {
        var o = base.object
        o["id"] = base["id"].isNull ? .string(id) : base["id"]
        o["date"] = .string(d.date)
        o["description"] = .string(d.description.trimmingCharacters(in: .whitespaces))
        o["provider"] = .string(d.provider.trimmingCharacters(in: .whitespaces))
        o["cost"] = .number(parse(d.cost) ?? 0)
        o["underWarranty"] = .bool(d.underWarranty)
        return .object(o)
    }

    // MARK: A unit

    struct UnitDraft: Equatable {
        var name = "", unitType = "shop"
        var selfOccupied = false
        var rental = RentalDraft()
    }

    static func unitDraft(from u: JSONValue) -> UnitDraft {
        UnitDraft(name: text(u["name"]), unitType: u["unitType"].truthy ? u["unitType"].text : "shop", selfOccupied: u["selfOccupied"].truthy,
                  rental: u["rental"].truthy ? rentalDraft(from: u["rental"]) : RentalDraft())
    }

    static func unitProblems(_ d: UnitDraft) -> [String] { d.selfOccupied ? [] : (d.rental.monthlyRent.isEmpty ? [] : rentalProblems(d.rental)) }

    static func unitRow(_ d: UnitDraft, base: JSONValue = .null) -> JSONValue {
        var o = (base.isNull ? PropertyUnits.blankUnit() : base).object
        o["name"] = .string(d.name.trimmingCharacters(in: .whitespaces).isEmpty ? "Unnamed unit" : d.name.trimmingCharacters(in: .whitespaces))
        o["unitType"] = .string(d.unitType)
        o["selfOccupied"] = .bool(d.selfOccupied)
        o["rental"] = d.selfOccupied ? .null : rentalValue(d.rental, base: base["rental"])
        o["transactions"] = .array(base["transactions"].array)
        return .object(o)
    }
}
