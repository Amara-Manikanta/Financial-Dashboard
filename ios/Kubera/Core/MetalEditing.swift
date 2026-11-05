import Foundation

/// Adding, changing and deleting precious-metal items — the rules of the Mac's `MetalModal` and `MetalDetails` handlers.
/// A category (`gold`, `silver`, `antique_coins`, `currencies`, `platinum`) is one list, saved whole.
enum MetalEditing {
    static let categories = ["gold", "silver", "antique_coins", "currencies", "platinum"]

    struct Form: Equatable {
        var name = "", weight = "", price = "", purity = "24", printedYear = "", quantity = "1"
        var currency = "USD", rate = "", foreign = "", date = ""
        var place = "", location = "", remarks = ""
    }

    private static func num(_ s: String) -> Double? {
        let t = s.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")
        return t.isEmpty ? nil : Double(t)
    }

    /// The form filled from an existing item, or empty (purity 24 for gold) for a new one.
    static func form(for item: JSONValue?, category: String, today: String) -> Form {
        guard let item, !item.isNull else {
            var f = Form(); f.date = today; f.purity = category == "gold" ? "24" : ""; return f
        }
        func t(_ k: String) -> String { item[k].truthy ? (item[k].double == item[k].double.rounded() && item[k].jsNumber != nil ? String(Int64(item[k].double)) : item[k].text) : "" }
        var f = Form()
        f.name = item["name"].text
        f.weight = item["weightGm"].double == 0 ? "" : RecordEditing.number(item["weightGm"].double)
        f.price = item["purchasePrice"].double == 0 ? "" : RecordEditing.number(item["purchasePrice"].double)
        f.purity = item["purity"].truthy ? t("purity") : (category == "gold" ? "24" : "")
        f.printedYear = item["printedYear"].truthy ? t("printedYear") : ""
        f.quantity = item["quantity"].truthy ? t("quantity") : "1"
        f.currency = item["currencyCode"].truthy ? item["currencyCode"].text : "USD"
        f.rate = item["conversionRate"].double == 0 ? "" : RecordEditing.number(item["conversionRate"].double)
        f.foreign = item["foreignValue"].double == 0 ? "" : RecordEditing.number(item["foreignValue"].double)
        f.date = item["purchaseDate"].truthy ? String(item["purchaseDate"].text.prefix(10)) : today
        f.place = item["place"].text; f.location = item["location"].text; f.remarks = item["remarks"].text
        return f
    }

    static func problems(_ f: Form, category: String) -> [String] {
        var out: [String] = []
        if f.name.trimmingCharacters(in: .whitespaces).isEmpty { out.append("Enter a name.") }
        for (label, v) in [("weight", f.weight), ("price", f.price), ("rate", f.rate), ("foreign value", f.foreign)] where !v.isEmpty && num(v) == nil { out.append("The \(label) is not a number.") }
        if !RecordEditing.isDate(f.date) { out.append("Pick a purchase date.") }
        return out
    }

    /// The item to store: the existing one first (so ids, photos and fields the form does not show survive), then the form —
    /// what `MetalModal.handleSubmit` builds. A currency's value is its foreign amount times the rate.
    static func item(_ f: Form, category: String, base: JSONValue?) -> [String: Any] {
        var o = (RecordEditing.foundation(base ?? .null) as? [String: Any]) ?? [:]
        let coinOrCash = category == "antique_coins" || category == "currencies"
        o["name"] = f.name.trimmingCharacters(in: .whitespaces)
        o["weightGm"] = coinOrCash ? 0 : (num(f.weight) ?? 0)
        o["purchasePrice"] = num(f.price) ?? 0
        o["purity"] = category == "gold" ? ((Int(f.purity) ?? Int(num(f.purity) ?? 0)) as Any) : (o["purity"] ?? NSNull())
        o["printedYear"] = category == "antique_coins" ? ((Int(f.printedYear) ?? 0) == 0 ? NSNull() : (Int(f.printedYear) as Any)) : NSNull()
        o["quantity"] = category == "antique_coins" ? max(1, Int(f.quantity) ?? 1) : 1
        o["currencyCode"] = category == "currencies" ? f.currency : NSNull()
        o["conversionRate"] = category == "currencies" ? (num(f.rate) ?? 0) : NSNull()
        o["foreignValue"] = category == "currencies" ? (num(f.foreign) ?? 0) : NSNull()
        o["purchaseDate"] = f.date
        o["place"] = f.place
        o["location"] = f.location
        o["remarks"] = f.remarks
        o["currentValue"] = category == "currencies" ? (num(f.foreign) ?? 0) * (num(f.rate) ?? 0) : (o["currentValue"] ?? 0)
        if base == nil || base!.isNull { o["id"] = Int64(Date().timeIntervalSince1970 * 1000) }
        return o
    }

    /// The category's list after one change: `item` replaces the one with its id, appends when it has no match, or `delete` removes it.
    static func apply(items: [JSONValue], item: [String: Any]?, deleting id: JSONValue?) -> [Any] {
        var out = items.map { RecordEditing.foundation($0) }
        if let id {
            return out.filter { ($0 as? [String: Any])?["id"].map { "\($0)" } != "\(RecordEditing.foundation(id))" }
        }
        guard let item else { return out }
        let key = "\(item["id"] ?? "")"
        if let i = out.firstIndex(where: { "\(($0 as? [String: Any])?["id"] ?? "")" == key }) { out[i] = item } else { out.append(item) }
        return out
    }
}
