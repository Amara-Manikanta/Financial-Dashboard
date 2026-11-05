import Foundation

/// Adding, archiving and deleting a stock holding — the rules of `handleSaveStock`, `handleArchiveToggle` and `confirmDeleteStock` on the
/// Mac's Stocks page. A holding is one entry of the stock-market account's `stocks` list, saved as that list.
enum HoldingEditing {
    static let marketCaps = ["Large Cap", "Mid Cap", "Small Cap"]
    /// `OFFICIAL_SECTORS` in `utils/sectors.js`, in its order.
    static let sectors = ["Information Technology", "Financials", "Health Care", "Consumer Discretionary", "Consumer Staples", "Industrials", "Communication Services", "Energy", "Utilities", "Materials", "Real Estate", "Other"]

    struct Form: Equatable {
        var name = "", ticker = "", shares = "", avgCost = "", sector = "", marketCap = "Large Cap", remarks = ""
        var expectsDividends = false
    }

    private static func num(_ s: String) -> Double? {
        let t = s.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")
        return t.isEmpty ? nil : Double(t)
    }

    static func problems(_ f: Form) -> [String] {
        var out: [String] = []
        if f.name.trimmingCharacters(in: .whitespaces).isEmpty { out.append("Enter the company name.") }
        for (label, v) in [("shares", f.shares), ("average price", f.avgCost)] where !v.isEmpty && num(v) == nil { out.append("The \(label) is not a number.") }
        if (num(f.shares) ?? 0) > 0 && !((num(f.avgCost) ?? 0) > 0) { out.append("Enter the average price you paid.") }
        return out
    }

    /// The new holding. With shares it carries one opening buy dated today, as the Mac makes; the position's shares and average
    /// then come from replaying that buy, exactly as every holding's do.
    static func newHolding(_ f: Form, today: String, now: Date = Date()) -> [String: Any] {
        let ms = Int64(now.timeIntervalSince1970 * 1000)
        let shares = num(f.shares) ?? 0, avg = num(f.avgCost) ?? 0
        var h: [String: Any] = [
            "id": "s\(ms)", "name": f.name.trimmingCharacters(in: .whitespaces), "ticker": f.ticker.trimmingCharacters(in: .whitespaces).uppercased(),
            "shares": shares, "avgCost": avg, "currentPrice": 0, "remarks": f.remarks, "customValues": [String: Any](), "dividends": [String: Any](),
            "expectsDividends": f.expectsDividends, "marketCap": f.marketCap, "sector": f.sector, "transactions": [Any](),
        ]
        if shares > 0 {
            h["transactions"] = [["id": String(ms), "date": today, "type": "buy", "quantity": shares, "price": avg, "remarks": "Initial Balance"] as [String: Any]]
        }
        return h
    }

    /// Why a holding cannot be deleted from the phone, or nil. A holding whose transactions came from an expense is tied to that
    /// expense; removing it would leave the expense pointing at nothing.
    static func deleteBlock(_ holding: JSONValue) -> String? {
        let linked = holding["transactions"].array.contains { $0["expenseId"].truthy || $0["adoptedByExpense"].truthy || $0["investmentData"].truthy }
        return linked ? "Some of its purchases were logged from the Expenses page. Remove it on the Mac so those expenses stay in step." : nil
    }

    enum Change { case add([String: Any]), setArchived(id: String, Bool), delete(id: String) }

    /// The stocks list after one change.
    static func apply(_ change: Change, to stocks: [JSONValue]) -> [Any] {
        var out = stocks.map { RecordEditing.foundation($0) }
        switch change {
        case .add(let h): out.append(h)
        case .setArchived(let id, let on):
            out = out.map { var o = ($0 as? [String: Any]) ?? [:]; if "\(o["id"] ?? "")" == id { o["isArchived"] = on }; return o }
        case .delete(let id): out = out.filter { "\((($0 as? [String: Any]) ?? [:])["id"] ?? "")" != id }
        }
        return out
    }
}
