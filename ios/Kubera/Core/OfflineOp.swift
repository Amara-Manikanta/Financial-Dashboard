import Foundation

/// Changes made on the phone while the Mac was out of reach, kept as *intent* rather than as final
/// patches. When the Mac is back each one is rebuilt against the record as it is then — the same pure
/// functions that built it the first time — so a change to a row that has since moved or vanished is
/// reported, and a change to anything else lands on top of whatever the Mac did meanwhile.
enum AccountOp {
    case deposits(DepositLedger.ListChange)
    case recurring(DepositLedger.ListChange)
    case nested(listKey: String, depositId: String, subKey: String, DepositLedger.ListChange)
    case ledger(specId: String, parentIndex: Int?, AccountLedger.Change)
    case stock(holdingId: String, StockLedger.Change)
    /// A change to an asset category: an item, its entries, services or units.
    case asset(AssetOp)
    /// One row, by id, of a list inside any record — a person's transactions, a loan's payments.
    case list(key: String, DepositLedger.ListChange)
    /// Plain fields of any record, with what each one held when the phone read it.
    case fields([String: Any], expected: [String: JSONValue])

    /// The fields to PATCH for `record` as it is now, or why this change can no longer be made.
    func patch(for record: JSONValue, asOf: Date = Date()) -> Result<[String: Any], DepositLedger.Failure> {
        switch self {
        case .deposits(let c): return DepositLedger.depositsPatch(account: record, change: c, asOf: asOf)
        case .recurring(let c): return DepositLedger.recurringPatch(account: record, change: c)
        case .nested(let listKey, let depositId, let subKey, let c):
            return DepositLedger.nestedPatch(account: record, listKey: listKey, depositId: depositId, subKey: subKey, change: c)
        case .ledger(let specId, let parentIndex, let c):
            guard let spec = AccountLedger.lists(for: record["type"].text).first(where: { $0.id == specId }) else {
                return .failure(DepositLedger.Failure(message: "That kind of change is not available for this account any more."))
            }
            return AccountLedger.patch(account: record, spec: spec, parentIndex: parentIndex, change: c).mapError { DepositLedger.Failure(message: $0.message) }
        case .stock(let holdingId, let c):
            switch StockLedger.updatedStocks(account: record, stockId: holdingId, change: c) {
            case .failure(let f): return .failure(DepositLedger.Failure(message: f.message))
            case .success(let stocks): return .success(["stocks": stocks])
            }
        case .asset(let a):
            return a.patch(for: record).mapError { DepositLedger.Failure(message: $0.message) }
        case .list(let key, let c):
            switch DepositLedger.apply(c, to: record[key].array, what: key == "payments" ? "payment" : "transaction") {
            case .failure(let f): return .failure(f)
            case .success(let rows): return .success([key: rows.map(RecordEditing.foundation)])
            }
        case .fields(let fields, let expected):
            for (key, old) in expected where record[key] != old {
                return .failure(DepositLedger.Failure(message: "“\(RecordEditing.label(key))” was changed on your Mac since you edited it, so this change was not applied."))
            }
            return .success(fields)
        }
    }
}

/// One pending change.
struct OfflineOp: Identifiable {
    enum Kind {
        case account(collection: String, id: String, AccountOp)
        case txPost([String: Any])
        case txPatch(id: String, [String: Any])
        case txDelete(id: String)
        case createAccount([String: Any])
    }
    enum State: String { case pending, conflict }

    let id: String
    let created: Date
    var label: String
    var kind: Kind
    var state: State = .pending
    var message: String? = nil

    /// The savings or other record this touches, for grouping.
    var target: String {
        switch kind {
        case .account(let c, let id, _): return "\(c)/\(id)"
        case .txPost: return "transaction"
        case .txPatch(let id, _), .txDelete(let id): return "tx/\(id)"
        case .createAccount: return "new account"
        }
    }
}

// MARK: Storage form — plain JSON so it survives app updates and can be read back without the type that wrote it

enum OfflineCoding {
    static func any(_ v: JSONValue) -> Any { RecordEditing.foundation(v) }

    static func value(_ a: Any) -> JSONValue {
        guard JSONSerialization.isValidJSONObject([a]), let d = try? JSONSerialization.data(withJSONObject: [a]),
              let v = try? JSONValue.parse(d), case .array(let items) = v, let first = items.first else { return .null }
        return first
    }

    private static func listChange(_ c: DepositLedger.ListChange) -> [String: Any] {
        switch c {
        case .add(let r): return ["t": "add", "row": any(r)]
        case .replace(let id, let r): return ["t": "replace", "id": id, "row": any(r)]
        case .delete(let id): return ["t": "delete", "id": id]
        }
    }
    private static func listChange(_ d: [String: Any]) -> DepositLedger.ListChange? {
        switch d["t"] as? String {
        case "add": return .add(value(d["row"] as Any))
        case "replace": return (d["id"] as? String).map { .replace(id: $0, value(d["row"] as Any)) }
        case "delete": return (d["id"] as? String).map { .delete(id: $0) }
        default: return nil
        }
    }
    private static func ledgerChange(_ c: AccountLedger.Change) -> [String: Any] {
        switch c {
        case .add(let r): return ["t": "add", "row": any(r)]
        case .replace(let i, let e, let r): return ["t": "replace", "index": i, "expected": any(e), "row": any(r)]
        case .delete(let i, let e): return ["t": "delete", "index": i, "expected": any(e)]
        }
    }
    private static func ledgerChange(_ d: [String: Any]) -> AccountLedger.Change? {
        switch d["t"] as? String {
        case "add": return .add(value(d["row"] as Any))
        case "replace": return (d["index"] as? Int).map { .replace(index: $0, expected: value(d["expected"] as Any), value(d["row"] as Any)) }
        case "delete": return (d["index"] as? Int).map { .delete(index: $0, expected: value(d["expected"] as Any)) }
        default: return nil
        }
    }
    private static func stockChange(_ c: StockLedger.Change) -> [String: Any] {
        switch c {
        case .add(let r): return ["t": "add", "row": any(r)]
        case .replace(let id, let r): return ["t": "replace", "id": id, "row": any(r)]
        case .delete(let id): return ["t": "delete", "id": id]
        }
    }
    private static func stockChange(_ d: [String: Any]) -> StockLedger.Change? {
        switch d["t"] as? String {
        case "add": return .add(value(d["row"] as Any))
        case "replace": return (d["id"] as? String).map { .replace(id: $0, value(d["row"] as Any)) }
        case "delete": return (d["id"] as? String).map { .delete(id: $0) }
        default: return nil
        }
    }

    static func encode(_ op: AccountOp) -> [String: Any] {
        switch op {
        case .deposits(let c): return ["k": "deposits", "c": listChange(c)]
        case .recurring(let c): return ["k": "recurring", "c": listChange(c)]
        case .nested(let l, let d, let s, let c): return ["k": "nested", "list": l, "dep": d, "sub": s, "c": listChange(c)]
        case .ledger(let spec, let p, let c): var o: [String: Any] = ["k": "ledger", "spec": spec, "c": ledgerChange(c)]; if let p { o["parent"] = p }; return o
        case .stock(let h, let c): return ["k": "stock", "holding": h, "c": stockChange(c)]
        case .asset(let a): return ["k": "asset", "a": encodeAsset(a)]
        case .list(let k, let c): return ["k": "list", "key": k, "c": listChange(c)]
        case .fields(let f, let e): return ["k": "fields", "fields": f, "expected": e.mapValues(any)]
        }
    }

    static func decodeAccount(_ d: [String: Any]) -> AccountOp? {
        let c = d["c"] as? [String: Any] ?? [:]
        switch d["k"] as? String {
        case "deposits": return listChange(c).map { .deposits($0) }
        case "recurring": return listChange(c).map { .recurring($0) }
        case "nested": guard let l = d["list"] as? String, let dep = d["dep"] as? String, let s = d["sub"] as? String, let ch = listChange(c) else { return nil }
            return .nested(listKey: l, depositId: dep, subKey: s, ch)
        case "ledger": guard let spec = d["spec"] as? String, let ch = ledgerChange(c) else { return nil }
            return .ledger(specId: spec, parentIndex: d["parent"] as? Int, ch)
        case "stock": guard let h = d["holding"] as? String, let ch = stockChange(c) else { return nil }
            return .stock(holdingId: h, ch)
        case "asset": return (d["a"] as? [String: Any]).flatMap(decodeAsset).map { .asset($0) }
        case "list": guard let k = d["key"] as? String, let ch = listChange(c) else { return nil }
            return .list(key: k, ch)
        case "fields": guard let f = d["fields"] as? [String: Any] else { return nil }
            return .fields(f, expected: (d["expected"] as? [String: Any] ?? [:]).mapValues(value))
        default: return nil
        }
    }

    // MARK: Asset changes

    private static func assetList(_ e: AssetOp.ListEdit) -> [String: Any] {
        switch e {
        case .add(let r): return ["t": "add", "row": any(r)]
        case .replace(let id, let r): return ["t": "replace", "id": id, "row": any(r)]
        case .delete(let id): return ["t": "delete", "id": id]
        }
    }
    private static func assetList(_ d: [String: Any]) -> AssetOp.ListEdit? {
        switch d["t"] as? String {
        case "add": return .add(value(d["row"] as Any))
        case "replace": return (d["id"] as? String).map { .replace(id: $0, value(d["row"] as Any)) }
        case "delete": return (d["id"] as? String).map { .delete(id: $0) }
        default: return nil
        }
    }

    static func encodeAsset(_ a: AssetOp) -> [String: Any] {
        switch a {
        case .addItem(let r): return ["a": "addItem", "row": any(r)]
        case .deleteItem(let id): return ["a": "deleteItem", "item": id]
        case .itemFields(let id, let set, let remove, let expected):
            return ["a": "itemFields", "item": id, "set": set.mapValues(any), "remove": remove, "expected": expected.mapValues(any)]
        case .entry(let id, let unit, let e):
            var o: [String: Any] = ["a": "entry", "item": id]
            if let unit { o["unit"] = unit }
            switch e {
            case .add(let r): o["e"] = ["t": "add", "row": any(r)]
            case .delete(let rid): o["e"] = ["t": "delete", "id": rid]
            case .replace(let r, let from): var x: [String: Any] = ["t": "replace", "row": any(r)]; if let from { x["from"] = from }; o["e"] = x
            }
            return o
        case .sublist(let id, let key, let e): return ["a": "sublist", "item": id, "key": key, "e": assetList(e)]
        case .unit(let id, let e): return ["a": "unit", "item": id, "e": assetList(e)]
        }
    }

    static func decodeAsset(_ d: [String: Any]) -> AssetOp? {
        let item = d["item"] as? String ?? ""
        switch d["a"] as? String {
        case "addItem": return .addItem(value(d["row"] as Any))
        case "deleteItem": return .deleteItem(itemId: item)
        case "itemFields":
            return .itemFields(itemId: item, set: (d["set"] as? [String: Any] ?? [:]).mapValues(value), remove: d["remove"] as? [String] ?? [],
                               expected: (d["expected"] as? [String: Any] ?? [:]).mapValues(value))
        case "entry":
            guard let e = d["e"] as? [String: Any] else { return nil }
            switch e["t"] as? String {
            case "add": return .entry(itemId: item, unit: d["unit"] as? String, .add(value(e["row"] as Any)))
            case "delete": return (e["id"] as? String).map { .entry(itemId: item, unit: d["unit"] as? String, .delete(id: $0)) }
            case "replace": return .entry(itemId: item, unit: d["unit"] as? String, .replace(value(e["row"] as Any), from: e["from"] as? String))
            default: return nil
            }
        case "sublist": guard let key = d["key"] as? String, let e = (d["e"] as? [String: Any]).flatMap(assetList) else { return nil }; return .sublist(itemId: item, key: key, e)
        case "unit": guard let e = (d["e"] as? [String: Any]).flatMap(assetList) else { return nil }; return .unit(itemId: item, e)
        default: return nil
        }
    }

    static func encode(_ op: OfflineOp) -> [String: Any] {
        var o: [String: Any] = ["id": op.id, "created": op.created.timeIntervalSince1970, "label": op.label, "state": op.state.rawValue]
        if let m = op.message { o["message"] = m }
        switch op.kind {
        case .account(let c, let id, let a): o["kind"] = "account"; o["collection"] = c; o["rid"] = id; o["op"] = encode(a)
        case .txPost(let b): o["kind"] = "txPost"; o["body"] = b
        case .txPatch(let id, let b): o["kind"] = "txPatch"; o["rid"] = id; o["body"] = b
        case .txDelete(let id): o["kind"] = "txDelete"; o["rid"] = id
        case .createAccount(let a): o["kind"] = "createAccount"; o["body"] = a
        }
        return o
    }

    static func decode(_ o: [String: Any]) -> OfflineOp? {
        guard let id = o["id"] as? String, let t = o["created"] as? Double, let label = o["label"] as? String, let kind = o["kind"] as? String else { return nil }
        let k: OfflineOp.Kind
        switch kind {
        case "account":
            guard let c = o["collection"] as? String, let rid = o["rid"] as? String, let d = o["op"] as? [String: Any], let a = decodeAccount(d) else { return nil }
            k = .account(collection: c, id: rid, a)
        case "txPost": guard let b = o["body"] as? [String: Any] else { return nil }; k = .txPost(b)
        case "txPatch": guard let rid = o["rid"] as? String, let b = o["body"] as? [String: Any] else { return nil }; k = .txPatch(id: rid, b)
        case "txDelete": guard let rid = o["rid"] as? String else { return nil }; k = .txDelete(id: rid)
        case "createAccount": guard let b = o["body"] as? [String: Any] else { return nil }; k = .createAccount(b)
        default: return nil
        }
        return OfflineOp(id: id, created: Date(timeIntervalSince1970: t), label: label, kind: k,
                         state: OfflineOp.State(rawValue: o["state"] as? String ?? "pending") ?? .pending, message: o["message"] as? String)
    }
}

// MARK: Applying a change to the phone's own copy, so the screens show it before the Mac has it

enum LocalApply {
    private static let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

    /// Merges `fields` into the record with `id` in a collection array. False when there is no such record.
    @discardableResult
    static func patchRecord(_ collection: inout Any, id: String, fields: [String: Any]) -> Bool {
        guard var rows = collection as? [Any] else { return false }
        for i in rows.indices {
            guard var row = rows[i] as? [String: Any], "\(row["id"] ?? "")" == id else { continue }
            for (k, v) in fields { row[k] = v }
            rows[i] = row; collection = rows; return true
        }
        return false
    }

    static func appendRecord(_ collection: inout Any, record: [String: Any]) {
        var rows = (collection as? [Any]) ?? []
        rows.append(record); collection = rows
    }

    private static func bucket(_ date: String) -> (year: String, month: String)? {
        let p = date.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard p.count >= 2, (1...12).contains(p[1]) else { return nil }
        return (String(p[0]), months[p[1] - 1])
    }

    private static func insert(_ tx: [String: Any], into e: inout [String: Any]) {
        guard let b = bucket("\(tx["date"] ?? "")") else { return }
        var year = e[b.year] as? [String: Any] ?? [:]
        var month = year[b.month] as? [String: Any] ?? ["categories": [String: Any](), "transactions": [Any]()]
        var list = month["transactions"] as? [Any] ?? []
        list.append(tx); month["transactions"] = list
        year[b.month] = month; e[b.year] = year
    }

    /// `POST /api/tx`: the new row lands in its month. (The month's `categories` total is the Mac's to recompute.)
    static func addTransaction(_ expenses: inout Any, body: [String: Any]) {
        guard var e = expenses as? [String: Any], let tx = body["transaction"] as? [String: Any] else { return }
        insert(tx, into: &e); expenses = e
    }

    /// Finds a transaction by id and hands it, with where it lives, to `change`.
    private static func locate(_ e: [String: Any], id: String) -> (year: String, month: String, index: Int)? {
        for (y, yv) in e { for (m, mv) in (yv as? [String: Any]) ?? [:] {
            let list = ((mv as? [String: Any])?["transactions"] as? [Any]) ?? []
            if let i = list.firstIndex(where: { "\(($0 as? [String: Any])?["id"] ?? "")" == id }) { return (y, m, i) }
        } }
        return nil
    }

    @discardableResult
    static func patchTransaction(_ expenses: inout Any, id: String, fields: [String: Any]) -> Bool {
        guard var e = expenses as? [String: Any], let at = locate(e, id: id) else { return false }
        var year = e[at.year] as! [String: Any], month = year[at.month] as! [String: Any]
        var list = month["transactions"] as! [Any]
        var tx = list[at.index] as! [String: Any]
        for (k, v) in fields { tx[k] = v }
        // A new date can mean a new month.
        if fields["date"] != nil, let b = bucket("\(tx["date"] ?? "")"), b.year != at.year || b.month != at.month {
            list.remove(at: at.index); month["transactions"] = list; year[at.month] = month; e[at.year] = year
            insert(tx, into: &e)
        } else {
            list[at.index] = tx; month["transactions"] = list; year[at.month] = month; e[at.year] = year
        }
        expenses = e; return true
    }

    @discardableResult
    static func deleteTransaction(_ expenses: inout Any, id: String) -> Bool {
        guard var e = expenses as? [String: Any], let at = locate(e, id: id) else { return false }
        var year = e[at.year] as! [String: Any], month = year[at.month] as! [String: Any]
        var list = month["transactions"] as! [Any]
        list.remove(at: at.index); month["transactions"] = list; year[at.month] = month; e[at.year] = year
        expenses = e; return true
    }
}
