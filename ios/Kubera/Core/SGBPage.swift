import Foundation

/// The gold-bond page as the Mac's `GoldBondDetails.jsx` computes it, reading holdings through the same
/// stored-name fallbacks as `utils/sgb.js` (`issueName`/`series`, `issueDate`/`date`, `purchasePrice`/`issuePrice`).
enum SGBPage {
    struct Holding: Identifiable { let id: String; let index: Int; let series: String; let date: String; let maturity: String
        let units: Double; let issuePrice: Double; let currentPrice: Double; let raw: JSONValue
        var value: Double { units * currentPrice }
        var gain: Double { (currentPrice - issuePrice) * units } }
    struct Interest: Identifiable { let id: String; let index: Int; let date: String; let amount: Double; let remarks: String; let raw: JSONValue }
    struct Page { var holdings: [Holding] = []; var interest: [Interest] = []
        var units = 0.0; var invested = 0.0; var current = 0.0; var interestReceived = 0.0
        var gain: Double { current - invested }
        var gainPercent: Double { invested > 0 ? gain / invested * 100 : 0 } }

    private static func first(_ vs: JSONValue...) -> JSONValue? { vs.first { $0.truthy } }

    static func holding(_ h: JSONValue, index: Int) -> Holding {
        Holding(id: h["id"].text, index: index, series: first(h["issueName"], h["series"])?.text ?? "", date: first(h["issueDate"], h["date"])?.text ?? "",
                maturity: h["maturityDate"].text, units: h["units"].double, issuePrice: first(h["purchasePrice"], h["issuePrice"])?.double ?? 0,
                currentPrice: h["currentPrice"].double, raw: h)
    }

    static func page(_ a: JSONValue) -> Page {
        var p = Page()
        p.holdings = a["holdings"].array.enumerated().map { holding($1, index: $0) }
        p.interest = a["interestTransactions"].array.enumerated().map { Interest(id: $1["id"].text, index: $0, date: $1["date"].text, amount: $1["amount"].double, remarks: $1["remarks"].text, raw: $1) }
        p.units = p.holdings.reduce(0) { $0 + $1.units }
        p.invested = p.holdings.reduce(0) { $0 + $1.units * $1.issuePrice }
        p.current = p.holdings.reduce(0) { $0 + $1.value }
        p.interestReceived = p.interest.reduce(0) { $0 + $1.amount }
        return p
    }
}
