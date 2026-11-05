import SwiftUI

struct LentRoute: Hashable { let id: String }
struct AssetCategoryRoute: Hashable { let id: String }
struct MetalRoute: Hashable { let key: String }

private struct Line: Identifiable { let id: Int; var raw: JSONValue = .null; let title: String; let subtitle: String; let value: String; let tone: Tone; var photo: String? = nil }
private func assetValue(_ i: JSONValue) -> Double { [i["currentValue"], i["purchasePrice"], i["purchasedValue"]].map(\.double).first { $0 != 0 } ?? 0 }
private func inr(_ v: Double) -> String { Money.rupees(v) }

/// One person's debt: what is outstanding and every repayment or top-up behind it.
struct LentDetailView: View {
    @ObservedObject var store: FinanceStore
    let route: LentRoute

    @State private var sheet: LentSheet?
    @State private var deleting: JSONValue?
    @State private var message: String?

    private struct LentSheet: Identifiable { let id = UUID(); let row: JSONValue? }

    var body: some View {
        let d = store.data.lentsRaw.array.first { $0["id"].text == route.id } ?? .null
        let isLent = d["type"].text == "lent"
        let txs = d["transactions"].array.enumerated().sorted { a, b in
            let x = JSDate.parse(a.element["date"])?.timeIntervalSince1970 ?? 0, y = JSDate.parse(b.element["date"])?.timeIntervalSince1970 ?? 0
            return x != y ? x > y : a.offset > b.offset
        }.map(\.element)
        let rows = txs.enumerated().map { IndexedRow(id: $0.offset, value: $0.element) }
        KScreen(refresh: { await store.load() }) {
            if let message { KNotice(message: message) { self.message = nil } }
            KCard(tint: isLent ? Theme.positive : Theme.negative) {
                KStat(label: isLent ? "Owed to you" : "You owe", value: inr(LoansPage.outstanding(d)), size: .hero)
                if d["description"].truthy { Text(d["description"].text).font(Theme.footnote).foregroundStyle(Theme.muted) }
                KRow(title: "Opening amount", subtitle: String(d["created"].text.prefix(10)), value: inr(d["amount"].double))
            }
            HStack {
                KSectionHeader(title: "History", detail: rows.isEmpty ? nil : "\(rows.count)")
                Button { sheet = LentSheet(row: nil) } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) }
            }
            if rows.isEmpty {
                KCard { Text("No transactions yet. Tap + to record a repayment or more lending.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            } else {
                KList(items: rows) { r in
                    let t = r.value, back = t["type"].text == "repayment"
                    let note = t["description"].text.trimmingCharacters(in: .whitespacesAndNewlines)
                    Button { sheet = LentSheet(row: t) } label: {
                        KRow(title: note.isEmpty ? (back ? "Repayment" : "Added") : note, subtitle: "\(Fmt.date(t["date"].text)) · \(back ? "repayment" : "added")",
                             value: "\(back ? "−" : "+")\(inr(t["amount"].double))", valueTone: back ? .positive : .neutral)
                    }
                    .buttonStyle(.plain)
                    .contextMenu { Button(role: .destructive) { deleting = t } label: { Label("Delete", systemImage: "trash") } }
                }
                Text("Tap to change; long-press to delete.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            }
        }
        .navigationTitle(d["name"].text)
        .toolbar {
            ToolbarItem(placement: .primaryAction) { Button { sheet = LentSheet(row: nil) } label: { Image(systemName: "plus") } }
            ToolbarItem(placement: .secondaryAction) { EditRecordButton(store: store, collection: "lents", id: route.id, title: d["name"].text) }
        }
        .navigationBarTitleDisplayMode(.large)
        .sheet(item: $sheet) { s in LentTransactionSheet(store: store, lentId: route.id, name: d["name"].text, isLent: isLent, editing: s.row) }
        .confirmationDialog("Delete this transaction?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let t = deleting { Task { message = await store.saveListRow(collection: "lents", id: route.id, key: "transactions", .delete(id: t["id"].text), label: "Delete transaction · \(d["name"].text)") } }
            }
        }
    }
}

/// One metal: every item with its weight, purity, cost and value at the rate in force.
struct MetalDetailView: View {
    @ObservedObject var store: FinanceStore
    let route: MetalRoute
    private struct Sheet: Identifiable { let id = UUID(); let item: JSONValue? }
    @State private var sheet: Sheet?
    @State private var showRates = false
    @State private var deleting: JSONValue?
    @State private var message: String?

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
            return Line(id: i, raw: it, title: it["name"].text, subtitle: bits.joined(separator: " · "), value: inr(it["currentValue"].double), tone: .neutral, photo: Gallery.photos(of: it).first { !$0.isEmpty })
        }
        KScreen(refresh: { await store.load() }) {
            if let message { KNotice(message: message) { self.message = nil } }
            KCard(tint: Theme.warning) {
                KStat(label: "Current valuation", value: inr(total), size: .hero)
                Text("\(items.count) positions\(weight > 0 ? " · \(String(format: "%g", (weight * 1000).rounded() / 1000)) g" : "")\(cost > 0 ? " · cost \(inr(cost))" : "")").font(Theme.footnote).foregroundStyle(Theme.muted)
            }
            KList(items: lines) { l in
                HStack(spacing: 12) {
                    // The item's first photo, fetched from the Mac; a placeholder stays when it has none or the file is missing.
                    Group {
                        if let path = l.photo { Photo(store: store, path: path, maxPixel: 160, failed: {}) }
                        else { Color.white.opacity(0.05).overlay(Image(systemName: "photo").foregroundStyle(Theme.muted)) }
                    }
                    .frame(width: 52, height: 52)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    KRow(title: l.title, subtitle: l.subtitle, value: l.value)
                }
                .contentShape(Rectangle())
                .onTapGesture { sheet = Sheet(item: store.data.metalsRaw[route.key].array.first { $0["id"].text == l.raw["id"].text }) }
                .contextMenu {
                    Button { sheet = Sheet(item: store.data.metalsRaw[route.key].array.first { $0["id"].text == l.raw["id"].text }) } label: { Label("Edit", systemImage: "pencil") }
                    Button(role: .destructive) { deleting = l.raw } label: { Label("Delete", systemImage: "trash") }
                }
            }
            Text("Tap an item to change it; long-press to delete. Photos and bills are added on the Mac.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
        }
        .navigationTitle(route.key.replacingOccurrences(of: "_", with: " ").capitalized)
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .primaryAction) { Button { sheet = Sheet(item: nil) } label: { Image(systemName: "plus") } }
            if route.key == "gold" || route.key == "silver" {
                ToolbarItem(placement: .secondaryAction) { Button { showRates = true } label: { Label("Manual rates", systemImage: "indianrupeesign.circle") } }
            }
        }
        .sheet(item: $sheet) { MetalItemSheet(store: store, category: route.key, editing: $0.item) }
        .sheet(isPresented: $showRates) { ManualRatesSheet(store: store) }
        .confirmationDialog("Delete this item?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let d = deleting {
                    let id = store.data.metalsRaw[route.key].array.first { $0["id"].text == d["id"].text }?["id"] ?? d["id"]
                    Task { message = await store.saveMetal(category: route.key, deleting: id) }
                }
            }
        } message: { Text(deleting?["name"].text ?? "") }
    }
}

struct CardRoute: Hashable { let id: String }

/// One card: what is owed, how it is used, and month by month what was charged and paid.
struct CardDetailView: View {
    @ObservedObject var store: FinanceStore
    let route: CardRoute
    @State private var limit = 12
    @State private var txLimit = 15
    @State private var adding = false
    @State private var editing: AllTransactions.Row?
    @State private var showBaseline = false

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
            if !card["type"].text.isEmpty && card["type"].text == "wallet" {
                // A wallet has no statement baseline.
            } else {
                KSectionHeader(title: "Carry-forward baseline")
                Button { showBaseline = true } label: {
                    KCard { KRow(title: card["carryForwardBaseline"].truthy ? card["carryForwardBaseline"].text.replacingOccurrences(of: "/", with: " ") : "Not set",
                                 subtitle: card["carryForwardBaseline"].truthy ? "opening balance \(inr(card["baselineOpeningBalance"].double))" : "What was owed before this month is not counted",
                                 systemImage: "calendar.badge.clock", chevron: true) }
                }.buttonStyle(.plain)
            }
            cardTransactions(card, expenses: d.expensesRaw)
            KSectionHeader(title: "Month by month", detail: "balance at month end")
            KList(items: Array(lines.prefix(limit))) { l in KRow(title: l.title, subtitle: l.subtitle, value: l.value, valueTone: l.tone) }
            if lines.count > limit { Button("Show 12 more") { limit += 12 }.font(Theme.footnote.weight(.bold)) }
            Text("Statement imports are done on the Mac.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
        }
        .navigationTitle(card["name"].text)
        .toolbar {
            ToolbarItem(placement: .primaryAction) { Button { adding = true } label: { Image(systemName: "plus") } }
            ToolbarItem(placement: .secondaryAction) { EditRecordButton(store: store, collection: "creditCards", id: route.id, title: card["name"].text) }
        }
        .navigationBarTitleDisplayMode(.large)
        .sheet(isPresented: $adding) { AddTransactionView(store: store, presetCard: card["name"].text) }
        .sheet(item: $editing) { r in
            EditTransactionView(store: store, row: r, lock: EditTransaction.lockReason(r.raw, idCount: AllTransactions.list(store.data.expensesRaw).filter { $0.raw["id"].text == r.raw["id"].text }.count))
        }
        .sheet(isPresented: $showBaseline) { CardBaselineSheet(store: store, card: card) }
    }

    /// This card's own transactions, newest first — the Mac's "Recent Transactions (Expenses)". Tap to change or remove one.
    @ViewBuilder private func cardTransactions(_ card: JSONValue, expenses: JSONValue) -> some View {
        let name = card["name"].text.trimmingCharacters(in: .whitespaces)
        let rows = AllTransactions.list(expenses).filter { $0.raw["paymentMode"].text == "credit_card" && $0.raw["creditCardName"].text.trimmingCharacters(in: .whitespaces) == name }
            .sorted { $0.time != $1.time ? $0.time > $1.time : $0.offset < $1.offset }
        KSectionHeader(title: "Recent transactions", detail: rows.isEmpty ? nil : "\(rows.count)")
        if rows.isEmpty {
            KCard { Text("No transactions on this card yet. Tap + to add one.").font(Theme.footnote).foregroundStyle(Theme.muted) }
        } else {
            KList(items: Array(rows.prefix(txLimit))) { r in
                Button { editing = r } label: {
                    KRow(title: r.title.isEmpty ? r.category.capitalized : r.title, subtitle: "\(Fmt.date(r.date)) · \(r.category)",
                         value: (r.isCredited ? "+" : "") + inr(r.amount), valueTone: r.isCredited ? .positive : .neutral)
                }.buttonStyle(.plain)
            }
            if rows.count > txLimit { Button("Show 15 more") { txLimit += 15 }.font(Theme.footnote.weight(.bold)) }
            Text("Tap a transaction to change or delete it.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
        }
    }
}


/// The card's carry-forward baseline, as the Mac's "Set Carry Forward Baseline" form. Saved to the card record under its version.
struct CardBaselineSheet: View {
    @ObservedObject var store: FinanceStore
    let card: JSONValue
    @State private var d = CardBaseline.Draft()
    @State private var loaded = false

    var body: some View {
        FormSheet(title: "Carry-forward baseline", problems: CardBaseline.problems(d), touched: true, save: {
            await store.saveRecord("creditCards", id: card["id"].text, fields: CardBaseline.fields(d, card: card), original: card, stampUpdated: !card["updatedAt"].isNull, label: "Baseline · \(card["name"].text)")
        }) {
            Section {
                Toggle("Count only from a chosen month", isOn: $d.enabled)
                if d.enabled {
                    Picker("Month", selection: $d.month) { ForEach(MonthExtras.months, id: \.self) { Text($0).tag($0) } }
                    TextRow(label: "Year", text: $d.year)
                    NumberRow(label: "Owed at that point ₹", text: $d.opening)
                }
            } footer: { Text("Spending and payments before the baseline month are left out of what carries forward; the balance owed then is the opening balance. Leave the balance blank to keep the one already saved.") }
        }
        .onAppear { guard !loaded else { return }; loaded = true; d = CardBaseline.draft(from: card) }
    }
}
