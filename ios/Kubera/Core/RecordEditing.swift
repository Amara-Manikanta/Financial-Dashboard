import Foundation

/// Editing one record of an array collection (`/savings/<id>`, `/goals/<id>`…) from the phone.
///
/// Only plain fields are offered — text, numbers, switches, dates. Anything the Mac derives
/// (units, prices, cost, the keys a page computes) or that links two records stays locked, and
/// so do nested ledgers whose totals another page replays. A save sends only what changed, as
/// `PATCH /<collection>/<id>` with the record's version as `If-Match`, so a record changed on the
/// Mac since the phone loaded it is refused rather than overwritten.
enum RecordEditing {
    /// Collections a phone may edit. `users` holds passwords and `snapshots` are history.
    static let collections: Set<String> = ["savings", "goals", "lents", "loans", "creditCards", "taxes",
                                           "salaryDetails", "ipoApplications", "watchlist", "assets"]

    /// Never editable anywhere: identity, links between records, timestamps and photos.
    static let lockedEverywhere: Set<String> = ["id", "type", "expenseId", "adoptedByExpense", "linkedStockId", "itemId",
        "created", "createdAt", "updatedAt", "addedAt", "pricesUpdatedAt", "password", "username", "role",
        "images", "imageUrl", "image", "photo", "receipts", "documents", "url", "_raw"]

    /// Fields a page works out or fetches, per collection.
    static let derived: [String: Set<String>] = [
        "savings": ["profitLoss", "currentNav", "investedAmount", "shares", "avgPrice", "schemeCode", "units", "currentPrice"],
        "watchlist": ["q", "fired", "sectorKey", "riskKey", "capKey", "priorityKey", "currentPrice", "quote", "marketCap"],
    ]

    /// Savings accounts whose ledgers are replayed into units or shares (`utils/investmentSync.js`).
    static let replayedTypes: Set<String> = ["stock_market", "mutual_fund", "nps", "sgb"]

    enum Kind: Equatable { case text, number, numericText, toggle, date }

    struct Field: Identifiable, Equatable {
        var id: String { key }
        let key: String
        let kind: Kind
        let value: String
        let on: Bool
        var label: String { RecordEditing.label(key) }
    }

    static func label(_ key: String) -> String {
        var out = ""
        for (i, ch) in key.enumerated() {
            if ch.isUppercase && i > 0 { out.append(" ") }
            out.append(i == 0 ? Character(ch.uppercased()) : Character(ch.lowercased()))
        }
        return out.replacingOccurrences(of: "_", with: " ")
    }

    static func isDate(_ s: String) -> Bool {
        s.count == 10 && s.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil
    }

    static func number(_ v: Double) -> String {
        v == v.rounded() && abs(v) < 1e15 ? String(Int64(v)) : String(v)
    }

    static func isLocked(_ key: String, collection: String, record: JSONValue, nested: Bool = false) -> Bool {
        // A row's type (given / received) is ordinary data; a record's type decides which page it is.
        if nested && key == "type" { return false }
        if lockedEverywhere.contains(key) { return true }
        if derived[collection]?.contains(key) == true { return true }
        // A fund's or stock account's amount is its value, worked out from its holdings.
        if collection == "savings" && key == "amount" && replayedTypes.contains(record["type"].text) { return true }
        return false
    }

    /// The plain fields of a record (or a nested row), in a stable order, with locked ones left out.
    static func fields(of record: JSONValue, collection: String, parent: JSONValue? = nil) -> [Field] {
        let owner = parent ?? record
        var out: [Field] = []
        for (key, value) in record.object.sorted(by: { $0.key < $1.key }) where !isLocked(key, collection: collection, record: owner, nested: parent != nil) {
            switch value {
            case .bool(let b): out.append(Field(key: key, kind: .toggle, value: "", on: b))
            case .number(let n): out.append(Field(key: key, kind: .number, value: number(n), on: false))
            case .string(let s):
                if isDate(String(s.prefix(10))) && (s.count == 10 || s.dropFirst(10).first == "T") {
                    out.append(Field(key: key, kind: .date, value: s, on: false))
                } else if !s.isEmpty, Double(s) != nil {
                    // Stored as text (the tax forms do this); edited as a number, saved back as text.
                    out.append(Field(key: key, kind: .numericText, value: s, on: false))
                } else {
                    out.append(Field(key: key, kind: .text, value: s, on: false))
                }
            case .null: out.append(Field(key: key, kind: .text, value: "", on: false))
            case .array, .object: continue
            }
        }
        // Names and titles first, the rest alphabetically.
        let first = ["name", "title", "company", "description", "bankName", "lender"]
        return out.sorted { a, b in
            let ia = first.firstIndex(of: a.key) ?? first.count, ib = first.firstIndex(of: b.key) ?? first.count
            return ia != ib ? ia < ib : a.key < b.key
        }
    }

    /// Nested lists of rows that can be edited row by row, with a reason for those that cannot.
    static func nestedLists(of record: JSONValue, collection: String) -> [(key: String, count: Int, lock: String?)] {
        record.object.sorted(by: { $0.key < $1.key }).compactMap { key, value in
            guard case .array(let rows) = value, !rows.isEmpty, rows.allSatisfy({ if case .object = $0 { return true }; return false }) else { return nil }
            return (key, rows.count, nestedLock(key: key, collection: collection, record: record))
        }
    }

    static func nestedLock(key: String, collection: String, record: JSONValue) -> String? {
        if lockedEverywhere.contains(key) { return "Files are managed on the Mac." }
        if collection == "savings" && replayedTypes.contains(record["type"].text) {
            return "Units and value are replayed from this ledger on the Mac; change it there so they stay right."
        }
        if collection == "watchlist" { return "Alerts are managed on the Mac." }
        return nil
    }

    static func rowLock(_ row: JSONValue) -> String? {
        if row["expenseId"].truthy || row["adoptedByExpense"].truthy || row["investmentData"].truthy {
            return "This row is linked to an expense. Change it on the Mac so both stay in step."
        }
        return nil
    }

    enum Edit: Equatable { case text(String), toggle(Bool) }

    /// Problems that stop a save, by field key.
    static func problems(fields: [Field], edits: [String: Edit]) -> [String: String] {
        var out: [String: String] = [:]
        for f in fields {
            guard case .text(let raw)? = edits[f.key] else { continue }
            let s = raw.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")
            if (f.kind == .number || f.kind == .numericText) && !s.isEmpty && Double(s) == nil { out[f.key] = "Not a number" }
            if f.kind == .number && s.isEmpty { out[f.key] = "Enter a number" }
        }
        return out
    }

    /// Only the fields that changed, typed as they are stored. Empty means nothing to save.
    static func patch(fields: [Field], edits: [String: Edit], record: JSONValue) -> [String: Any] {
        var out: [String: Any] = [:]
        for f in fields {
            guard let e = edits[f.key] else { continue }
            switch (f.kind, e) {
            case (.toggle, .toggle(let b)) where b != f.on: out[f.key] = b
            case (.number, .text(let raw)):
                let s = raw.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")
                if let n = Double(s), n != record[f.key].double { out[f.key] = n }
            case (.numericText, .text(let raw)):
                let s = raw.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")
                if s != f.value { out[f.key] = s }
            case (.text, .text(let raw)), (.date, .text(let raw)):
                let s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
                if s != f.value { out[f.key] = s }
            default: continue
            }
        }
        return out
    }

    /// The record's raw value as Foundation objects, for re-sending a nested list.
    static func foundation(_ v: JSONValue) -> Any {
        switch v {
        case .null: return NSNull()
        case .bool(let b): return b
        case .number(let n): return n
        case .string(let s): return s
        case .array(let a): return a.map(foundation)
        case .object(let o): return o.mapValues(foundation)
        }
    }

    /// A nested list with one row changed (`patch` merged in) or removed (`patch` nil).
    static func replacingRow(_ rows: [JSONValue], at index: Int, with patch: [String: Any]?) -> [Any] {
        var out = rows.map(foundation)
        guard out.indices.contains(index) else { return out }
        if let patch {
            var row = (out[index] as? [String: Any]) ?? [:]
            for (k, v) in patch { row[k] = v }
            out[index] = row
        } else {
            out.remove(at: index)
        }
        return out
    }

    // MARK: New records

    /// Collections a phone may add a whole record to, with the word the screen uses for one.
    static let creatable: [String: String] = ["goals": "goal", "loans": "loan", "lents": "person", "watchlist": "watchlist entry",
                                              "ipoApplications": "IPO application", "taxes": "tax year", "creditCards": "card", "salaryDetails": "payslip"]

    /// A blank record shaped like the newest one already in the collection — the same keys the Mac's own form writes —
    /// with text emptied, numbers zeroed, switches off and lists empty. Fields a page works out (prices, quotes, keys) are left
    /// out for the Mac to fill. Enum-like text the form cannot invent (a loan's or card's `type`, a status) keeps its value as a default.
    static func template(collection: String, records: [JSONValue], now: Date = Date()) -> JSONValue {
        guard let last = records.last(where: { !$0.object.isEmpty }) else { return .object([:]) }
        let keep: Set<String> = ["type", "status", "itrStatus", "form16Status", "priority", "risk", "category", "icon", "fundingSource"]
        let stamps: Set<String> = ["created", "createdAt", "updatedAt", "addedAt"]
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let iso = f.string(from: now)
        var out: [String: JSONValue] = [:]
        for (key, value) in last.object {
            if key == "id" { continue }
            if stamps.contains(key) { out[key] = .string(iso); continue }
            if derived[collection]?.contains(key) == true || ["images", "imageUrl", "image", "photo", "receipts", "documents", "quote"].contains(key) { continue }
            switch value {
            case .string(let s): out[key] = .string(keep.contains(key) ? s : (isDate(String(s.prefix(10))) ? String(iso.prefix(10)) : ""))
            case .number: out[key] = .number(0)
            case .bool: out[key] = .bool(false)
            case .array: out[key] = .array([])
            case .null: out[key] = .null
            case .object: continue
            }
        }
        out["id"] = .string(newId(like: last["id"].text, now: now))
        return .object(out)
    }

    /// An id in the collection's own style: `goal_1786…` stays `goal_<ms>`, a bare number stays a bare number.
    static func newId(like existing: String, now: Date = Date()) -> String {
        let ms = String(Int64(now.timeIntervalSince1970 * 1000))
        if let r = existing.range(of: #"^[A-Za-z]+_"#, options: .regularExpression) { return String(existing[r]) + ms }
        return ms
    }
}
