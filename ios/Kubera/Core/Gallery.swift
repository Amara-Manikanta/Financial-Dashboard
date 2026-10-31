import Foundation

/// Every photographed ornament across the metal categories — a port of `utils/ornamentPhotos.js`.
/// An item can keep its photos in `images[]`, `imageUrl`, `image` or `photo` (the shape changed twice
/// and nothing migrated); no placeholder is ever mixed in, so "has a photo" means a real file.
enum Gallery {
    static let labels = ["gold": "Gold", "silver": "Silver", "platinum": "Platinum", "antique_coins": "Antique Coins", "currencies": "Currencies"]

    static func photos(of item: JSONValue) -> [String] {
        let list = item["images"].array.filter { $0.truthy }
        if !list.isEmpty { return list.map(url) }
        let single = [item["imageUrl"], item["image"], item["photo"]].first { $0.truthy }
        return single.map { [url($0)] } ?? []
    }
    private static func url(_ v: JSONValue) -> String { if case .string(let s) = v { return s }; return v["url"].text }

    struct Shot: Identifiable, Equatable {
        let id: String
        let category: String, url: String, name: String, purity: String
        let index: Int, total: Int
        let weight: Double
    }
    struct Result: Equatable { var shots: [Shot] = []; var withoutPhotos: [(category: String, name: String)] = []
        static func == (a: Result, b: Result) -> Bool { a.shots == b.shots && a.withoutPhotos.count == b.withoutPhotos.count } }

    static func items(_ metals: JSONValue) -> Result {
        var r = Result()
        for (category, list) in metals.object.sorted(by: { $0.key < $1.key }) {
            for item in list.array {
                let ps = photos(of: item)
                if ps.isEmpty { r.withoutPhotos.append((category, item["name"].truthy ? item["name"].text : item["title"].text)); continue }
                for (i, p) in ps.enumerated() where !p.isEmpty {
                    r.shots.append(Shot(id: "\(category):\(item["id"].text):\(i)", category: category, url: p, name: [item["name"], item["title"]].first { $0.truthy }?.text ?? "Unnamed",
                                        purity: item["purity"].text, index: i, total: ps.count, weight: item["weight"].double))
                }
            }
        }
        return r
    }
}
