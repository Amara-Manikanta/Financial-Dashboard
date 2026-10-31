import Foundation

/// The grocery master lists — a read-only port of `pages/GroceryMasterList.jsx`: categories with
/// their items, the brands and variants recorded for each, and which brands and variants go
/// with which item. Items come from the base list, the ones you added, and every name that has
/// appeared on a purchase. Editing and merging are done on the Mac.
enum GroceryMaster {
    /// `DEFAULT_GROCERY_CATEGORIES` in FinanceContext.jsx, in its order.
    static let defaults: [(category: String, items: [String])] = [
        ("Milk Products", ["Milk", "Paneer", "Curd", "Cheese", "Butter", "Ghee"]),
        ("Vegetables", ["Onion", "Potato", "Tomato", "Carrot", "Beans", "Cabbage", "Cauliflower", "Capsicum", "Green Chilli", "Garlic", "Ginger", "Coriander", "Lemon"]),
        ("Fruits", ["Apple", "Banana", "Mango", "Grapes", "Orange", "Papaya", "Watermelon"]),
        ("Dals/Pulses", ["Toor Dal", "Moong Dal", "Urad Dal", "Chana Dal", "Masoor Dal", "Rajma", "Kabuli Chana"]),
        ("Rice/Atta", ["Sona Masoori Rice", "Basmati Rice", "Brown Rice", "Wheat Atta", "Maida", "Besan", "Suji/Rava"]),
        ("Oils/Ghee", ["Sunflower Oil", "Groundnut Oil", "Mustard Oil", "Olive Oil", "Sesame Oil"]),
        ("Snacks", ["Biscuits", "Chips", "Namkeen", "Chocolates", "Cookies"]),
        ("Cleaning Supplies", ["Detergent Powder", "Dishwash Liquid", "Floor Cleaner", "Toilet Cleaner", "Glass Cleaner", "Scrub Pad"]),
        ("Personal Care", ["Soap", "Shampoo", "Toothpaste", "Toothbrush", "Body Wash", "Face Wash", "Deodorant", "Hair Oil"]),
        ("Non-Veg", ["Chicken", "Mutton", "Fish", "Prawns", "Eggs", "Chicken Boneless", "Egg Tray (30)"]),
        ("Others", ["Sugar", "Salt", "Tea Powder", "Coffee Powder", "Jaggery"])
    ]

    /// Defaults first, overridden or extended by what is saved (`{ ...DEFAULTS, ...saved }`).
    static func categories(appData: JSONValue) -> [(category: String, items: [String])] {
        var out = defaults
        let saved = appData["groceryCategories"]
        for (name, list) in saved.object.sorted(by: { $0.key < $1.key }) {
            let items = list.array.map(\.text)
            if let i = out.firstIndex(where: { $0.category == name }) { out[i].items = items } else { out.append((name, items)) }
        }
        return out
    }

    static func items(of category: String, base: [(category: String, items: [String])], appData: JSONValue, expenses: JSONValue) -> [String] {
        var set = Set(base.first { $0.category == category }?.items ?? [])
        appData["customGroceryItems"][category].array.forEach { set.insert($0.text) }
        for tx in Recurring.allTransactions(expenses) {
            for gi in tx["groceryItems"].array {
                let cat = gi["subcategory"].truthy ? gi["subcategory"].text : "General Groceries"
                if cat == category && gi["name"].truthy && gi["name"].text != "GST / Carry Bag" && gi["name"].text != "Discount" { set.insert(gi["name"].text) }
            }
        }
        return set.sorted { Array($0.utf16).lexicographicallyPrecedes(Array($1.utf16)) }
    }

    static func brands(of category: String, appData: JSONValue) -> [String] { appData["groceryBrands"][category].array.map(\.text) }
    static func flavours(of category: String, appData: JSONValue) -> [String] { appData["groceryFlavours"][category].array.map(\.text) }
    static func brands(for item: String, in category: String, appData: JSONValue) -> [String] { appData["groceryItemBrandMap"][category][item].array.map(\.text) }
    static func flavours(for item: String, in category: String, appData: JSONValue) -> [String] { appData["groceryItemFlavourMap"][category][item].array.map(\.text) }
}
