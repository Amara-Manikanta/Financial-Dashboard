import SwiftUI
import Charts

/// A PPF account, laid out as the Mac's PPF page is: balance and accumulated interest, the yearly
/// interest chart with "Add Interest", financial-year tabs, and the entries with contribution,
/// yield and running balance. Adding, changing and deleting an entry go through the same
/// version-checked, offline-capable ledger writes as every other account.
struct PPFView: View {
    @ObservedObject var store: FinanceStore
    let accountId: String

    @State private var year = "All"
    @State private var sheet: SheetRoute?
    @State private var deleting: PPF.Entry?
    @State private var message: String?
    @State private var shown = 20
    @State private var working = false

    private struct SheetRoute: Identifiable { let id = UUID(); let entry: PPF.Entry? }

    private var account: JSONValue { store.data.savingsRaw.array.first { $0["id"].text == accountId } ?? .null }
    private var spec: AccountLedger.ListSpec { AccountLedger.lists(for: "ppf")[0] }
    private var green: Color { Color(red: 0.2, green: 0.83, blue: 0.6) }
    private var blue: Color { Color(red: 0.38, green: 0.65, blue: 0.98) }

    var body: some View {
        let raw = account
        let page = PPF.page(raw)
        let title = [raw["name"], raw["title"]].first { $0.truthy }?.text ?? "PPF"
        let sub = [raw["accountNo"].truthy ? "Account: \(raw["accountNo"].text)" : nil, raw["bank"].truthy ? "Bank: \(raw["bank"].text)" : nil,
                   raw["folioNumber"].truthy ? "Folio: \(raw["folioNumber"].text)" : nil].compactMap { $0 }.joined(separator: "  |  ")
        let selected = page.years.contains(year) ? year : "All"
        let entries = PPF.entries(raw, year: selected)

        KScreen(refresh: { await store.load() }) {
            if let message { KNotice(message: message) { self.message = nil } }
            if !sub.isEmpty { Text(sub).font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4) }

            HStack(alignment: .top, spacing: 12) {
                KCard(tint: blue) { KStat(label: "Portfolio balance", value: Money.rupees(page.balance), size: .large) }
                KCard(tint: green) { KStat(label: "Accumulated interest", value: Money.rupees(page.totalInterest), tone: .positive, size: .large) }
            }

            interestCard(raw, page)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) { ForEach(page.years, id: \.self) { chip($0, on: selected == $0) } }
            }

            HStack {
                KSectionHeader(title: "Transactions", detail: "\(entries.count)")
                Button { sheet = SheetRoute(entry: nil) } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) }
            }
            if entries.isEmpty {
                KCard { Text("No transactions identified for the selected interval.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            } else {
                KList(items: Array(entries.prefix(shown))) { e in
                    let lock = AccountLedger.rowLock(e.raw, type: "ppf")
                    Button { if lock == nil { sheet = SheetRoute(entry: e) } } label: { row(e, lock: lock) }
                        .buttonStyle(.plain)
                        .contextMenu { if lock == nil { Button(role: .destructive) { deleting = e } label: { Label("Delete", systemImage: "trash") } } }
                }
                if entries.count > shown { Button("Show 20 more") { shown += 20 }.font(Theme.footnote.weight(.bold)) }
                Text("Tap an entry to change it; long-press to delete. Balances are recalculated from every entry in date order.")
                    .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
        .toolbar { EditRecordButton(store: store, collection: "savings", id: accountId, title: title) }
        .sheet(item: $sheet) { r in
            LedgerRowSheet(store: store, accountId: accountId, type: "ppf", spec: spec, parentIndex: nil, index: r.entry?.index, editing: r.entry?.raw)
        }
        .confirmationDialog("Delete this transaction?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let d = deleting {
                    Task { message = await store.saveAccount(accountId, .ledger(specId: spec.id, parentIndex: nil, .delete(index: d.index, expected: d.raw)), label: "Delete PPF entry") }
                }
            }
        }
    }

    // MARK: Yearly interest

    @ViewBuilder private func interestCard(_ raw: JSONValue, _ page: PPF.Page) -> some View {
        KSectionHeader(title: "Yearly PPF interest earned", detail: nil)
        KCard {
            HStack {
                Text("Total \(Money.rupees(page.totalInterest))").font(Theme.footnote.weight(.bold)).foregroundStyle(green)
                Spacer()
                Menu {
                    Section("Select FY to calculate") {
                        ForEach(PPF.offeredYears(), id: \.self) { fy in Button("FY \(fy)") { Task { await addInterest(fy, raw) } } }
                    }
                } label: {
                    Label(working ? "Working…" : "Add interest", systemImage: "plus").font(Theme.footnote.weight(.bold))
                        .padding(.horizontal, 12).padding(.vertical, 6).background(green.opacity(0.15), in: Capsule()).foregroundStyle(green)
                }
                .disabled(working)
            }
            if page.chart.isEmpty {
                Text("No interest recorded yet.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 6)
            } else {
                Chart(page.chart) { y in
                    BarMark(x: .value("Year", y.year), y: .value("Interest", y.amount))
                        .foregroundStyle(y.year == page.chart.last?.year ? green : green.opacity(0.75))
                        .annotation(position: .top) {
                            if y.amount > 0 { Text(Money.compact(y.amount)).font(.system(size: 9, weight: .semibold)).foregroundStyle(Theme.muted) }
                        }
                }
                .chartYAxis { AxisMarks(position: .leading) { AxisGridLine().foregroundStyle(Theme.muted.opacity(0.15)); AxisValueLabel().foregroundStyle(Theme.muted) } }
                .chartXAxis { AxisMarks { AxisValueLabel().foregroundStyle(Theme.muted) } }
                .frame(height: 180)
                .padding(.top, 8)
            }
            Text("Add interest works out a financial year's interest at 7.1% on the balance on the 5th of each month, and files it on 31 March. If that year already has an interest entry, it is updated.")
                .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 6)
        }
    }

    private func addInterest(_ fy: String, _ raw: JSONValue) async {
        working = true; message = nil
        let amount = PPF.yearlyInterest(fy: fy, details: raw["details"].array)
        let change = PPF.interestChange(fy: fy, details: raw["details"].array, amount: amount, newId: AccountLedger.newId())
        message = await store.saveAccount(accountId, .ledger(specId: spec.id, parentIndex: nil, change), label: "PPF interest FY \(fy)")
        working = false
    }

    // MARK: Rows

    private func row(_ e: PPF.Entry, lock: String?) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(Fmt.date(e.date)).font(Theme.body).foregroundStyle(.white)
                HStack(spacing: 6) {
                    KBadge(text: e.type.isEmpty ? "entry" : e.type, tone: e.type == "interest" ? .positive : .accent)
                    if let lock { Text(lock).font(Theme.footnote).foregroundStyle(Theme.muted).lineLimit(1) }
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                if e.contribution > 0 { Text(Money.rupees(e.contribution)).font(Theme.figure).foregroundStyle(.white) }
                if e.interest > 0 { Text("+\(Money.rupees(e.interest))").font(Theme.figure).foregroundStyle(green) }
                if e.contribution <= 0 && e.interest <= 0 { Text("—").font(Theme.figure).foregroundStyle(Theme.muted) }
                Text("Balance \(Money.rupees(e.balance))").font(Theme.footnote).foregroundStyle(Theme.muted)
            }
        }
    }

    private func chip(_ title: String, on: Bool) -> some View {
        Button { year = title; shown = 20 } label: {
            Text(title == "All" ? "All" : "FY \(title)").font(Theme.footnote.weight(.semibold))
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background((on ? Theme.accent : Color.white).opacity(on ? 0.25 : 0.07), in: Capsule())
                .foregroundStyle(on ? Theme.accent : Theme.muted)
        }
        .buttonStyle(.plain)
    }
}
