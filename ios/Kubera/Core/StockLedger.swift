import Foundation

/// Adding, changing and removing one transaction of a stock holding — the stock page's
/// `handleSaveTransaction` / `confirmDeleteTransaction`. The holding's `shares`, `avgCost` and
/// `dividends` are replayed from the whole history afterwards (`Stocks.replay`, the port of
/// `recomputeStockMetrics`), exactly as the Mac does, so the stored figures never drift from it.
///
/// Mergers (`merger_in` / `merger_out`) carry cost between two holdings and are relinked on the
/// Mac; a holding with one in its history is locked here rather than edited out of step.
enum StockLedger {
    /// The types the phone offers. Demerger and merger move cost between holdings; they stay on the Mac.
    enum Kind: String, CaseIterable, Identifiable {
        case buy, sell, dividend, bonus, split, ipo, buyback
        var id: String { rawValue }
        var label: String { rawValue == "ipo" ? "IPO" : rawValue.capitalized }
        var needsQuantity: Bool { self != .dividend && self != .split }
        var needsPrice: Bool { [.buy, .sell, .ipo, .buyback, .dividend].contains(self) }
        var removesShares: Bool { self == .sell || self == .buyback }
    }

    struct Draft: Equatable {
        var kind: Kind = .buy
        var date = NewTransaction.isoDay(Date())
        var quantity = ""
        var price = ""
        var splitFrom = ""
        var splitTo = ""
        var tds = ""
        var amountIsNet = false
    }

    enum Change {
        case add(JSONValue)
        case replace(id: String, JSONValue)
        case delete(id: String)
    }

    struct Failure: Error, Equatable { let message: String }

    private static func number(_ s: String) -> Double? { Double(s.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")) }

    // MARK: Locks

    static func holdingLock(_ stock: JSONValue) -> String? {
        let types = Set(stock["transactions"].array.map { $0["type"].text })
        if types.contains("merger_in") || types.contains("merger_out") || stock["transactions"].array.contains(where: { $0["mergerId"].truthy }) {
            return "This holding is part of a merger, whose cost is carried between companies. Change it on the Mac."
        }
        return nil
    }

    static func rowLock(_ tx: JSONValue) -> String? {
        if tx["id"].text.isEmpty { return "This row has no id, so the Mac cannot be told which one to change." }
        if tx["mergerId"].truthy || ["merger_in", "merger_out", "demerger"].contains(tx["type"].text) {
            return "Mergers and demergers move cost between holdings. Change them on the Mac."
        }
        if tx["expenseId"].truthy || tx["adoptedByExpense"].truthy || tx["investmentData"].truthy {
            return "This purchase is linked to an expense. Change it on the Mac so both stay in step."
        }
        return nil
    }

    // MARK: Draft ⇄ row

    static func draft(from tx: JSONValue) -> Draft {
        var d = Draft()
        d.kind = Kind(rawValue: tx["type"].text) ?? .buy
        d.date = String(tx["date"].text.prefix(10))
        d.quantity = tx["quantity"].double == 0 ? "" : RecordEditing.number(tx["quantity"].double)
        d.price = tx["price"].double == 0 ? "" : RecordEditing.number(tx["price"].double)
        d.splitFrom = tx["splitFrom"].truthy ? RecordEditing.number(tx["splitFrom"].double) : ""
        d.splitTo = tx["splitTo"].truthy ? RecordEditing.number(tx["splitTo"].double) : ""
        d.tds = tx["tds"].double > 0 ? RecordEditing.number(tx["tds"].double) : ""
        d.amountIsNet = tx["amountIsNet"].isTrue
        return d
    }

    /// Shares held on `date`, before the row `excluding` — so a sale cannot exceed what was owned.
    static func sharesHeld(_ rows: [JSONValue], on date: String, excluding id: String?) -> Double {
        let earlier = rows.filter { id == nil || $0["id"].text != id }.filter { String($0["date"].text.prefix(10)) <= date }
        return Stocks.replay(earlier).shares
    }

    static func problems(_ d: Draft, history: [JSONValue], editing id: String?) -> [String] {
        var out: [String] = []
        if !RecordEditing.isDate(d.date) { out.append("Pick a date.") }
        if d.kind.needsQuantity && !((number(d.quantity) ?? 0) > 0) { out.append("Enter a quantity above zero.") }
        if d.kind.needsPrice && !((number(d.price) ?? 0) > 0) {
            out.append(d.kind == .dividend ? "Enter the dividend amount." : "Enter the price per share.")
        }
        if d.kind == .split && !((number(d.splitFrom) ?? 0) > 0 && (number(d.splitTo) ?? 0) > 0) { out.append("Enter both sides of the split ratio.") }
        if !d.tds.isEmpty && (number(d.tds) ?? -1) < 0 { out.append("Tax deducted must be a number.") }
        if d.kind.removesShares, let q = number(d.quantity), q > 0, RecordEditing.isDate(d.date) {
            let held = sharesHeld(history, on: d.date, excluding: id)
            if q > held { out.append("You held only \(RecordEditing.number(held)) shares on that date.") }
        }
        return out
    }

    /// The row as the Mac's form stores it: the stored row first (so `amount`, `remarks`, `expenseId`
    /// and the rest survive an edit), then the form's fields; tax only on a dividend, ratio only on a split.
    static func row(_ d: Draft, id: String, base: JSONValue = .null) -> JSONValue {
        var fields = base.object
        fields["id"] = .string(id)
        fields["date"] = .string(d.date)
        fields["type"] = .string(d.kind.rawValue)
        fields["quantity"] = .number(d.kind.needsQuantity ? (number(d.quantity) ?? 0) : 0)
        fields["price"] = .number(d.kind.needsPrice ? (number(d.price) ?? 0) : 0)
        if d.kind == .split {
            fields["splitFrom"] = .number(number(d.splitFrom) ?? 0); fields["splitTo"] = .number(number(d.splitTo) ?? 0)
        } else { fields["splitFrom"] = nil; fields["splitTo"] = nil }
        if d.kind == .dividend {
            fields["tds"] = .number(max(0, number(d.tds) ?? 0)); fields["amountIsNet"] = .bool(d.amountIsNet)
        } else { fields["tds"] = nil; fields["amountIsNet"] = nil }
        return .object(fields)
    }

    static func newId() -> String { String(Int64(Date().timeIntervalSince1970 * 1000)) }

    // MARK: Applying a change

    /// The account's `stocks` list with the change applied to one holding and its figures replayed.
    /// Everything else in the account, and every other holding, is passed through untouched.
    static func updatedStocks(account: JSONValue, stockId: String, change: Change) -> Result<[Any], Failure> {
        let stocks = account["stocks"].array
        guard let index = stocks.firstIndex(where: { $0["id"].text == stockId }) else {
            return .failure(Failure(message: "That holding is no longer on your Mac. Nothing was changed."))
        }
        let stock = stocks[index]
        if let lock = holdingLock(stock) { return .failure(Failure(message: lock)) }

        var rows = stock["transactions"].array
        switch change {
        case .add(let row):
            rows.append(row)
        case .replace(let id, let row):
            guard let i = rows.firstIndex(where: { $0["id"].text == id }) else {
                return .failure(Failure(message: "That transaction was changed or removed on your Mac. Nothing was saved — reopen it and try again."))
            }
            if let lock = rowLock(rows[i]) { return .failure(Failure(message: lock)) }
            rows[i] = row
        case .delete(let id):
            guard let i = rows.firstIndex(where: { $0["id"].text == id }) else {
                return .failure(Failure(message: "That transaction was already removed on your Mac. Nothing was changed."))
            }
            if let lock = rowLock(rows[i]) { return .failure(Failure(message: lock)) }
            rows.remove(at: i)
        }

        let position = Stocks.replay(rows)
        var updated = (RecordEditing.foundation(stock) as? [String: Any]) ?? [:]
        updated["transactions"] = rows.map(RecordEditing.foundation)
        updated["shares"] = position.shares
        updated["avgCost"] = position.avgCost
        // `{ ...s.dividends, ...replayed }`: a year typed in by hand survives unless history now says otherwise.
        var dividends = stock["dividends"].object.mapValues { $0.double }
        for (year, amount) in position.dividends { dividends[year] = amount }
        updated["dividends"] = dividends

        var all = stocks.map(RecordEditing.foundation)
        all[index] = updated
        return .success(all)
    }
}
