import Foundation

/// A property let in parts — shops, floors, flats, rooms — each with its own tenancy and entries.
/// A port of `utils/propertyUnits.js`. A property let as a whole keeps its tenancy on the item itself
/// (the "main" unit); further units live in `item.units`. Nothing is migrated between the two.
enum PropertyUnits {
    static let mainId = "__main__"

    static let types: [(id: String, label: String, icon: String)] = [
        ("shop", "Shop", "🏪"), ("floor", "Floor", "🏢"), ("flat", "Flat", "🚪"), ("room", "Room", "🛏️"), ("portion", "Portion", "🧱"), ("other", "Other", "📦")]

    static func typeMeta(_ id: String) -> (id: String, label: String, icon: String) { types.first { $0.id == id } ?? types.last! }

    private static func money(_ v: Double) -> Double { Money.round2(v) }

    static func hasUnits(_ item: JSONValue) -> Bool { !item["units"].array.isEmpty }

    /// The main tenancy (when the property itself is let) followed by every further unit.
    static func allUnits(_ item: JSONValue) -> [JSONValue] {
        var out: [JSONValue] = []
        if item["rental"].truthy {
            let name = item["rental"]["unitName"].truthy ? item["rental"]["unitName"].text : (item["name"].truthy ? item["name"].text : "Main unit")
            out.append(.object(["id": .string(mainId), "isMain": .bool(true), "name": .string(name), "unitType": .string("portion"), "selfOccupied": .bool(false),
                                "rental": item["rental"], "transactions": .array(item["transactions"].array)]))
        }
        out.append(contentsOf: item["units"].array)
        return out
    }

    enum Status: String { case `let`, vacant, selfOccupied = "self_occupied"
        var label: String { switch self { case .let: "Let"; case .vacant: "Vacant"; case .selfOccupied: "Self-occupied" } } }

    static func status(_ unit: JSONValue) -> Status {
        if unit["selfOccupied"].truthy { return .selfOccupied }
        if unit["rental"].truthy && unit["rental"]["monthlyRent"].double > 0 { return .let }
        return .vacant
    }

    struct UnitSummary {
        let unit: JSONValue
        let status: Status
        let summary: Rental.Summary
        let ledger: Rental.RentLedger
        let bills: Rental.BillLedger
        let arrears: Double
        let currentRent: Double
        let entryCount: Int
    }

    static func summariseUnit(_ unit: JSONValue, asOf: Date = Date()) -> UnitSummary {
        let entries = unit["transactions"].array
        let st = status(unit)
        let summary = Rental.summarise(entries)
        let ledger = st == .let ? Rental.rentLedger(unit["rental"], entries: entries, asOf: asOf) : Rental.RentLedger()
        return UnitSummary(unit: unit, status: st, summary: summary, ledger: ledger, bills: Rental.billLedger(entries), arrears: money(ledger.arrears),
                           currentRent: st == .let ? money(Rental.expectedRent(unit["rental"], on: Rental.utcDay(asOf))) : 0, entryCount: entries.count)
    }

    struct PropertySummary {
        var units: [UnitSummary] = []
        var propertySummary = Rental.Summary()
        var propertyEntries: [JSONValue] = []
        var total = 0, letCount = 0, vacant = 0, selfOccupied = 0, lettable = 0
        var occupancyPct: Double?
        var monthlyRentRoll = 0.0, rentReceived = 0.0, billsBorne = 0.0, taxPaid = 0.0, maintenancePaid = 0.0, depositHeld = 0.0
        var income = 0.0, expense = 0.0, net = 0.0, arrears = 0.0
        var yieldOnValue: Double?
    }

    /// The whole property at once: rent roll, occupancy, what came in and went out across every unit and the building itself.
    static func summariseProperty(_ item: JSONValue, asOf: Date = Date()) -> PropertySummary {
        let units = allUnits(item).map { summariseUnit($0, asOf: asOf) }
        let propertyEntries = item["rental"].truthy ? [] : item["transactions"].array
        let ps = Rental.summarise(propertyEntries)
        let letU = units.filter { $0.status == .let }, vacantU = units.filter { $0.status == .vacant }, selfU = units.filter { $0.status == .selfOccupied }
        let lettable = units.filter { $0.status != .selfOccupied }
        func add(_ key: KeyPath<Rental.Summary, Double>) -> Double { units.reduce(0) { $0 + $1.summary[keyPath: key] } + ps[keyPath: key] }
        var p = PropertySummary(units: units, propertySummary: ps, propertyEntries: propertyEntries)
        p.total = units.count; p.letCount = letU.count; p.vacant = vacantU.count; p.selfOccupied = selfU.count; p.lettable = lettable.count
        p.occupancyPct = lettable.isEmpty ? nil : Double(letU.count) / Double(lettable.count) * 100
        p.monthlyRentRoll = money(units.reduce(0) { $0 + $1.currentRent })
        p.rentReceived = money(add(\.rentReceived)); p.billsBorne = money(add(\.billsBorne)); p.taxPaid = money(add(\.taxPaid))
        p.maintenancePaid = money(add(\.maintenancePaid)); p.depositHeld = money(add(\.depositHeld))
        let income = add(\.income), expense = add(\.expense)
        p.income = money(income); p.expense = money(expense); p.net = money(income - expense)
        p.arrears = money(units.reduce(0) { $0 + $1.arrears })
        p.yieldOnValue = item["currentValue"].double > 0 ? (income - expense) / item["currentValue"].double * 100 : nil
        return p
    }

    /// Writes one unit back into the item: the main tenancy onto the item itself, any other into `units`.
    static func applyUnit(_ item: JSONValue, _ unit: JSONValue) -> JSONValue {
        var o = item.object
        if unit["id"].text == mainId || unit["isMain"].truthy {
            var rental = item["rental"].object
            for (k, v) in unit["rental"].object { rental[k] = v }
            rental["unitName"] = unit["name"]
            o["rental"] = .object(rental)
            o["transactions"] = unit["transactions"].isNull ? (item["transactions"].isNull ? .array([]) : item["transactions"]) : unit["transactions"]
            return .object(o)
        }
        var units = item["units"].array
        if let i = units.firstIndex(where: { $0["id"].text == unit["id"].text }) { units[i] = unit } else { units.append(unit) }
        o["units"] = .array(units)
        return .object(o)
    }

    static func blankUnit(now: Date = Date()) -> JSONValue {
        .object(["id": .string("u_\(Int64(now.timeIntervalSince1970 * 1000))_\(String(UUID().uuidString.prefix(4)).lowercased())"), "name": .string(""),
                 "unitType": .string("shop"), "selfOccupied": .bool(false), "rental": .null, "transactions": .array([])])
    }
}
