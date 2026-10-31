import SwiftUI

struct LentRoute: Hashable { let id: String }
struct AssetCategoryRoute: Hashable { let id: String }
struct MetalRoute: Hashable { let key: String }

private struct Line: Identifiable { let id: Int; let title: String; let subtitle: String; let value: String; let tone: Tone }
private func assetValue(_ i: JSONValue) -> Double { [i["currentValue"], i["purchasePrice"], i["purchasedValue"]].map(\.double).first { $0 != 0 } ?? 0 }
private func inr(_ v: Double) -> String { Money.rupees(v) }

/// One person's debt: what is outstanding and every repayment or top-up behind it.
struct LentDetailView: View {
    @ObservedObject var store: FinanceStore
    let route: LentRoute

    var body: some View {
        let d = store.data.lentsRaw.array.first { $0["id"].text == route.id } ?? .null
        let isLent = d["type"].text == "lent"
        let txs = d["transactions"].array.enumerated().sorted { a, b in
            let x = JSDate.parse(a.element["date"])?.timeIntervalSince1970 ?? 0, y = JSDate.parse(b.element["date"])?.timeIntervalSince1970 ?? 0
            return x != y ? x > y : a.offset > b.offset
        }.map(\.element)
        let lines = txs.enumerated().map { i, t -> Line in
            let back = t["type"].text == "repayment"
            return Line(id: i, title: t["description"].text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? t["type"].text.capitalized : t["description"].text.trimmingCharacters(in: .whitespacesAndNewlines),
                        subtitle: "\(t["date"].text) · \(back ? "repayment" : "added")", value: "\(back ? "−" : "+")\(inr(t["amount"].double))", tone: back ? .positive : .neutral)
        }
        KScreen(refresh: { await store.load() }) {
            KCard(tint: isLent ? Theme.positive : Theme.negative) {
                KStat(label: isLent ? "Owed to you" : "You owe", value: inr(LoansPage.outstanding(d)), size: .hero)
                if d["description"].truthy { Text(d["description"].text).font(Theme.footnote).foregroundStyle(Theme.muted) }
                KRow(title: "Opening amount", subtitle: String(d["created"].text.prefix(10)), value: inr(d["amount"].double))
            }
            if !lines.isEmpty {
                KSectionHeader(title: "History", detail: "\(lines.count)")
                KList(items: lines) { l in KRow(title: l.title, subtitle: l.subtitle, value: l.value, valueTone: l.tone) }
            }
        }
        .navigationTitle(d["name"].text)
        .navigationBarTitleDisplayMode(.large)
    }
}

/// One asset category (plots, apartments, other): every item with its cost, value and warranty.
struct AssetCategoryView: View {
    @ObservedObject var store: FinanceStore
    let route: AssetCategoryRoute

    var body: some View {
        let cat = store.data.assetsRaw.array.first { $0["id"].text == route.id } ?? .null
        let items = cat["items"].array
        let total = items.reduce(0) { $0 + assetValue($1) }, cost = items.reduce(0) { $0 + $1["purchasePrice"].double }
        let lines = items.enumerated().map { i, it -> Line in
            let st = cat["type"].text == "real_estate" ? nil : Warranty.status(it)
            let warranty = st.map { $0.state == .unknown ? "" : " · \($0.state.label.lowercased())" } ?? ""
            return Line(id: i, title: it["name"].text, subtitle: "\(it["purchaseDate"].truthy ? "bought \(it["purchaseDate"].text)" : "undated")\(it["location"].truthy ? " · \(it["location"].text)" : "")\(warranty)",
                        value: inr(assetValue(it)), tone: .neutral)
        }
        KScreen(refresh: { await store.load() }) {
            KCard(tint: Theme.accent) {
                KStat(label: "Total valuation", value: inr(total), size: .hero)
                if cost > 0 { Text("cost \(inr(cost)) · \(Fmt.signed(total - cost))").font(Theme.footnote).foregroundStyle(Theme.muted) }
            }
            KList(items: lines) { l in KRow(title: l.title, subtitle: l.subtitle, value: l.value) }
            Text("Photos, bills and service history are on the Mac.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
        }
        .navigationTitle(cat["title"].text)
        .navigationBarTitleDisplayMode(.large)
    }
}

/// One metal: every item with its weight, purity, cost and value at the rate in force.
struct MetalDetailView: View {
    @ObservedObject var store: FinanceStore
    let route: MetalRoute

    var body: some View {
        let d = store.data
        let manual = d.appDataRaw["manualMetalRates"]
        let items = NetWorth.processedMetals(d.metalsRaw, rates: NetWorth.MetalRates(manualGold: manual["gold"].double, manualSilver: manual["silver"].double))[route.key] ?? []
        let total = items.reduce(0) { $0 + $1["currentValue"].double }, cost = items.reduce(0) { $0 + $1["purchasePrice"].double }
        let weight = items.reduce(0) { $0 + $1["weightGm"].double }
        let lines = items.sorted { $0["currentValue"].double > $1["currentValue"].double }.enumerated().map { i, it -> Line in
            var bits: [String] = []
            if it["weightGm"].double > 0 { bits.append("\(String(format: "%g", (it["weightGm"].double * 1000).rounded() / 1000)) g") }
            if it["purity"].truthy { bits.append("\(it["purity"].text)K") }
            if it["location"].truthy { bits.append(it["location"].text) }
            if it["purchaseDate"].truthy { bits.append("bought \(it["purchaseDate"].text)") }
            return Line(id: i, title: it["name"].text, subtitle: bits.joined(separator: " · "), value: inr(it["currentValue"].double), tone: .neutral)
        }
        KScreen(refresh: { await store.load() }) {
            KCard(tint: Theme.warning) {
                KStat(label: "Current valuation", value: inr(total), size: .hero)
                Text("\(items.count) positions\(weight > 0 ? " · \(String(format: "%g", (weight * 1000).rounded() / 1000)) g" : "")\(cost > 0 ? " · cost \(inr(cost))" : "")").font(Theme.footnote).foregroundStyle(Theme.muted)
            }
            KList(items: lines) { l in KRow(title: l.title, subtitle: l.subtitle, value: l.value) }
            Text("Photos, bills and edits are on the Mac.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
        }
        .navigationTitle(route.key.replacingOccurrences(of: "_", with: " ").capitalized)
        .navigationBarTitleDisplayMode(.large)
    }
}

struct CardRoute: Hashable { let id: String }

/// One card: what is owed, how it is used, and month by month what was charged and paid.
struct CardDetailView: View {
    @ObservedObject var store: FinanceStore
    let route: CardRoute
    @State private var limit = 12

    var body: some View {
        let d = store.data
        let card = d.creditCardsRaw.array.first { $0["id"].text == route.id } ?? .null
        let p = Cards.profile(card, Cards.transactions(d.expensesRaw), now: Date())
        let months = Array(p.history.reversed())
        let lines = months.enumerated().map { i, m -> Line in
            Line(id: i, title: m.month, subtitle: "spent \(inr(m.spend)) · paid \(inr(m.payment))\(m.interest > 0 ? " · interest \(inr(m.interest))" : "")\(m.refund > 0 ? " · refunds \(inr(m.refund))" : "")",
                 value: m.closing.map { inr($0) } ?? "—", tone: m.revolved && m.shortfall > 1 ? .warning : .neutral)
        }
        KScreen(refresh: { await store.load() }) {
            KCard(tint: Theme.accent) {
                KStat(label: p.isWallet ? "Wallet" : "Owed now", value: inr(p.outstanding), size: .hero)
                if let u = p.utilisation { ProgressView(value: min(1, u / 100)).tint(u > 30 ? Theme.warning : Theme.accent); Text(String(format: "%.0f%% of a %@ limit", u, inr(p.limit))).font(Theme.footnote).foregroundStyle(Theme.muted) }
                HStack(alignment: .top) {
                    KStat(label: "Lifetime spend", value: inr(p.lifetimeSpend), caption: "\(p.transactionCount) payments")
                    Spacer(); KStat(label: "Interest paid", value: inr(p.interestPaid), tone: p.interestPaid > 0 ? .negative : .positive)
                }.padding(.top, 8)
                if let c = p.cycle { KRow(title: "Next statement", subtitle: "billing day \(c.billingDay)", value: "\(c.nextStatement)", valueCaption: "\(c.daysToNext) days") }
            }
            if !p.topCategories.isEmpty {
                KSectionHeader(title: "Used for")
                KList(items: p.topCategories.enumerated().map { Line(id: $0.offset, title: $0.element.category.capitalized, subtitle: "", value: inr($0.element.amount), tone: .neutral) }) { l in KRow(title: l.title, value: l.value) }
            }
            KSectionHeader(title: "Month by month", detail: "balance at month end")
            KList(items: Array(lines.prefix(limit))) { l in KRow(title: l.title, subtitle: l.subtitle, value: l.value, valueTone: l.tone) }
            if lines.count > limit { Button("Show 12 more") { limit += 12 }.font(Theme.footnote.weight(.bold)) }
            Text("Statements, edits and payments are on the Mac.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
        }
        .navigationTitle(card["name"].text)
        .navigationBarTitleDisplayMode(.large)
    }
}
