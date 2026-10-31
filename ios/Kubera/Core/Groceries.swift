import Foundation

/// Grocery purchase history — a port of the memos in `pages/GroceryAnalytics.jsx`. Itemised
/// baskets are read line by line; a grocery purchase with no items is kept as one general order.
enum Groceries {
    struct Item: Identifiable, Equatable {
        let id: String
        let name: String, subcategory: String, brand: String, flavour: String, quantity: String
        let price: Double
        let timestamp: Double
        let date: String
        let txId: String
    }

    struct Options: Equatable { var categories: [String] = [], items: [String] = [], brands: [String] = [], flavours: [String] = [] }
    struct Stats: Equatable { var totalSpent = 0.0, totalItems = 0, avgPrice = 0.0 }

    private static func looksLikeGrocery(_ tx: JSONValue) -> Bool {
        let cat = tx["category"].text.lowercased(), sub = tx["subCategory"].text.lowercased(), title = tx["title"].text.lowercased()
        return cat.contains("groc") || sub.contains("groc") || title.contains("groc") || ["dmart", "blinkit", "zepto", "instamart", "bigbasket", "supermarket"].contains { title.contains($0) }
    }

    static func all(_ expenses: JSONValue) -> [Item] {
        var items: [(Item, Int)] = []
        for tx in Recurring.allTransactions(expenses) where !tx.isNull {
            let ts = (JSDate.parse(tx["date"])?.timeIntervalSince1970 ?? 0) * 1000
            if !tx["groceryItems"].array.isEmpty {
                for gi in tx["groceryItems"].array {
                    if gi["name"].text == "GST / Carry Bag" || gi["name"].text == "Discount" { continue }
                    let qty = gi["quantity"].text == "Custom" ? gi["customQuantity"].text : (gi["quantity"].truthy ? gi["quantity"].text : "1 unit")
                    items.append((Item(id: gi["id"].text, name: gi["name"].truthy ? gi["name"].text : (tx["title"].truthy ? tx["title"].text : "Grocery Item"),
                                       subcategory: gi["subcategory"].truthy ? gi["subcategory"].text : "General Groceries", brand: gi["brand"].text, flavour: gi["flavour"].text,
                                       quantity: qty, price: gi["price"].double, timestamp: ts, date: tx["date"].text, txId: tx["id"].text), items.count))
                }
            } else if looksLikeGrocery(tx) {
                let brand = tx["creditCardName"].truthy ? tx["creditCardName"].text : (tx["paymentMode"].truthy ? tx["paymentMode"].text.replacingOccurrences(of: "_", with: " ") : "Grocery Store")
                items.append((Item(id: tx["id"].text, name: tx["title"].truthy ? tx["title"].text : "Grocery Store Purchase", subcategory: "General Groceries", brand: brand, flavour: "",
                                   quantity: "1 order", price: abs(tx["amount"].double), timestamp: ts, date: tx["date"].text, txId: tx["id"].text), items.count))
            }
        }
        return items.sorted { $0.0.timestamp != $1.0.timestamp ? $0.0.timestamp > $1.0.timestamp : $0.1 < $1.1 }.map(\.0)
    }

    static func options(_ all: [Item], category: String, item: String, brand: String) -> Options {
        var c = Set<String>(), i = Set<String>(), b = Set<String>(), f = Set<String>()
        for gi in all {
            c.insert(gi.subcategory)
            let catOK = category == "All" || gi.subcategory == category
            if catOK { i.insert(gi.name) }
            if catOK && (item == "All" || gi.name == item) && !gi.brand.isEmpty { b.insert(gi.brand) }
            if catOK && (item == "All" || gi.name == item) && (brand == "All" || gi.brand == brand) && !gi.flavour.isEmpty { f.insert(gi.flavour) }
        }
        return Options(categories: c.sorted(), items: i.sorted(), brands: b.sorted(), flavours: f.sorted())
    }

    static func filter(_ all: [Item], category: String = "All", item: String = "All", brand: String = "All", flavour: String = "All") -> [Item] {
        all.filter { (category == "All" || $0.subcategory == category) && (item == "All" || $0.name == item) && (brand == "All" || $0.brand == brand) && (flavour == "All" || $0.flavour == flavour) }
    }

    static func stats(_ rows: [Item]) -> Stats {
        let total = rows.reduce(0) { $0 + $1.price }
        return Stats(totalSpent: total, totalItems: rows.count, avgPrice: rows.isEmpty ? 0 : total / Double(rows.count))
    }
}
