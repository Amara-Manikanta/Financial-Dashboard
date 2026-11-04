import SwiftUI
import Charts

/// A mutual fund, laid out as the Mac's fund page is: net invested, value and profit (booked and paper), units
/// and average cost against the NAV, two "what if" calculators, where the money went in by NAV level, the yearly
/// profit and loss, and every transaction with its value and gain. Transactions are added, changed and deleted
/// through the same version-checked, offline-capable ledger writes as every other account.
struct FundView: View {
    @ObservedObject var store: FinanceStore
    let accountId: String

    @State private var year = "All"
    @State private var planned = ""
    @State private var target = ""
    @State private var sheet: SheetRoute?
    @State private var deleting: FundPage.Tx?
    @State private var message: String?
    @State private var confirmation: String?
    @State private var refreshing = false
    @State private var shown = 20

    private struct SheetRoute: Identifiable { let id = UUID(); let tx: FundPage.Tx? }

    private var account: JSONValue { store.data.savingsRaw.array.first { $0["id"].text == accountId } ?? .null }
    private var spec: AccountLedger.ListSpec { AccountLedger.lists(for: "mutual_fund")[0] }
    private var up: Color { Theme.positive }
    private var down: Color { Theme.negative }
    private let amber = Color(red: 0.98, green: 0.75, blue: 0.14)

    private func number(_ s: String) -> Double { Double(s.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "")) ?? 0 }
    private func signed(_ v: Double) -> String { (v >= 0 ? "+" : "−") + Money.rupees(abs(v)) }

    var body: some View {
        let raw = account
        let page = FundPage.page(raw)
        let title = [raw["title"], raw["name"]].first { $0.truthy }?.text ?? "Mutual fund"
        let selected = page.years.contains(year) ? year : "All"
        let rows = FundPage.rows(page, year: selected)
        let more = FundPage.investMore(page, amount: number(planned))
        let atTarget = FundPage.atTarget(page, target: number(target), planned: more)

        KScreen(refresh: { await store.load() }) {
            if let message { KNotice(message: message) { self.message = nil } }
            if let confirmation { Label(confirmation, systemImage: "checkmark.circle.fill").font(Theme.footnote.weight(.semibold)).foregroundStyle(up).padding(.horizontal, 4) }
            HStack(spacing: 8) {
                Text("Folio: \(raw["folioNumber"].truthy ? raw["folioNumber"].text : "N/A")").font(Theme.footnote).foregroundStyle(Theme.muted)
                if raw["isArchived"].truthy { KBadge(text: "Archived", tone: .warning) }
                Spacer()
                Button { Task { await refreshNav() } } label: {
                    Label(refreshing ? "Refreshing…" : "Refresh NAV", systemImage: "arrow.clockwise").font(Theme.footnote.weight(.bold))
                        .padding(.horizontal, 12).padding(.vertical, 6).background(up.opacity(0.15), in: Capsule()).foregroundStyle(up)
                }
                .disabled(refreshing)
            }
            .padding(.horizontal, 4)

            stats(page)
            calculators(page, more: more, atTarget: atTarget)
            bandsCard(page)
            yearlyCard(page)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) { ForEach(page.years, id: \.self) { chip($0, on: selected == $0) } }
            }

            HStack {
                KSectionHeader(title: "Transactions", detail: "\(rows.count)")
                Button { sheet = SheetRoute(tx: nil) } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) }
            }
            if rows.isEmpty {
                KCard { Text("No transactions identified for the selected interval.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            } else {
                KList(items: Array(rows.prefix(shown))) { t in
                    let lock = AccountLedger.rowLock(t.raw, type: "mutual_fund")
                    Button { if lock == nil { sheet = SheetRoute(tx: t) } } label: { row(t, lock: lock) }
                        .buttonStyle(.plain)
                        .contextMenu { if lock == nil { Button(role: .destructive) { deleting = t } label: { Label("Delete", systemImage: "trash") } } }
                }
                if rows.count > shown { Button("Show 20 more") { shown += 20 }.font(Theme.footnote.weight(.bold)) }
                Text("Tap a transaction to change it; long-press to delete. Value and gain are at today's NAV; a sale shows the profit it booked.")
                    .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
        .toolbar { EditRecordButton(store: store, collection: "savings", id: accountId, title: title) }
        .sheet(item: $sheet) { r in
            LedgerRowSheet(store: store, accountId: accountId, type: "mutual_fund", spec: spec, parentIndex: nil, index: r.tx?.index, editing: r.tx?.raw)
        }
        .confirmationDialog("Delete this transaction?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let d = deleting {
                    Task { message = await store.saveAccount(accountId, .ledger(specId: spec.id, parentIndex: nil, .delete(index: d.index, expected: d.raw)), label: "Delete fund transaction · \(title)") }
                }
            }
        }
    }

    private func refreshNav() async {
        refreshing = true; message = nil; confirmation = nil
        switch await store.refreshFundNav(accountId) {
        case .success(let nav): confirmation = "NAV updated to \(String(format: "%.4f", nav))."
        case .failure(let f): message = f.message
        }
        refreshing = false
    }

    // MARK: Totals

    @ViewBuilder private func stats(_ p: FundPage.Page) -> some View {
        let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
        LazyVGrid(columns: columns, spacing: 12) {
            tile("Total invested (net)", Money.rupees(p.costHeld), "Active capital")
            tile("Current value", Money.rupees(p.currentValue), "At current NAV", tint: Theme.accent)
            tile("Total profit", signed(p.totalProfit), "Realised + unrealised", tone: p.totalProfit >= 0 ? up : down)
            tile("Unrealised P/L", signed(p.unrealised), "Paper profits", tone: p.unrealised >= 0 ? up : down)
            tile("Realised P/L", signed(p.realised), "Booked", tone: p.realised >= 0 ? up : down)
            tile("Units held", String(format: "%.3f", p.unitsHeld), "Accumulated units")
            tile("Average cost (NAV)", String(format: "%.4f", p.avgNav), "Weighted average")
            tile("Current NAV", String(format: "%.4f", p.currentNav), "Refresh NAV updates it")
        }
    }

    private func tile(_ label: String, _ value: String, _ caption: String, tone: Color = .white, tint: Color? = nil) -> some View {
        KCard(tint: tint) {
            VStack(alignment: .leading, spacing: 4) {
                Text(label.uppercased()).font(Theme.caption).tracking(0.8).foregroundStyle(Theme.muted).lineLimit(2).fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                Text(value).font(.system(size: 18, weight: .heavy, design: .rounded).monospacedDigit()).foregroundStyle(tone).minimumScaleFactor(0.7).lineLimit(1)
                Text(caption).font(Theme.footnote).foregroundStyle(Theme.muted.opacity(0.8)).lineLimit(1)
            }
            .frame(maxWidth: .infinity, minHeight: 84, alignment: .topLeading)
        }
    }

    // MARK: What-if calculators

    @ViewBuilder private func calculators(_ p: FundPage.Page, more: FundPage.MoreToday?, atTarget: FundPage.AtTarget?) -> some View {
        KSectionHeader(title: "If I invest more today", detail: "nothing is saved")
        KCard {
            field("Amount to invest ₹", $planned)
            if let m = more {
                HStack(alignment: .top) {
                    KStat(label: "Units you'd get", value: String(format: "%.3f", m.unitsGained))
                    Spacer()
                    KStat(label: "Units after", value: String(format: "%.3f", m.newUnits))
                }.padding(.top, 8)
                KStat(label: "New average NAV", value: String(format: "%.4f", m.newAvgNav), tone: m.change <= 0 ? .positive : .warning,
                      caption: m.change == 0 ? "unchanged" : String(format: "%@%.4f vs %.4f now", m.change < 0 ? "−" : "+", abs(m.change), p.avgNav)).padding(.top, 6)
                Text(m.change < 0 ? "Today's NAV is below your average of \(String(format: "%.4f", p.avgNav)), so this pulls it down."
                                  : "Today's NAV is above your average of \(String(format: "%.4f", p.avgNav)), so this pushes it up.")
                    .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 4)
            } else {
                Text("Enter an amount to see the effect on your average.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 6)
            }
        }
        KSectionHeader(title: "If the NAV reaches…", detail: more != nil ? "counts the amount above" : nil)
        KCard {
            field("Target NAV ₹", $target)
            if let t = atTarget {
                HStack(alignment: .top) {
                    KStat(label: "Position then", value: Money.rupees(t.value))
                    Spacer()
                    KStat(label: "Profit / loss", value: signed(t.profit), tone: t.profit >= 0 ? .positive : .negative, caption: Fmt.percent(t.percent))
                }.padding(.top, 8)
                Text("On \(String(format: "%.3f", t.units)) units that cost \(Money.rupees(t.cost)). Break-even NAV \(String(format: "%.4f", t.breakEven)).")
                    .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 4)
            } else {
                Text("Enter a NAV to see the profit or loss at that level.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 6)
            }
        }
    }

    private func field(_ label: String, _ text: Binding<String>) -> some View {
        HStack {
            Text(label).font(Theme.footnote).foregroundStyle(Theme.muted)
            Spacer()
            TextField("0", text: text).keyboardType(.decimalPad).multilineTextAlignment(.trailing).font(Theme.figure).frame(maxWidth: 140)
        }
    }

    // MARK: Charts

    @ViewBuilder private func bandsCard(_ p: FundPage.Page) -> some View {
        KSectionHeader(title: "Invested by NAV level", detail: p.bands.isEmpty ? nil : "\(p.bands.count) bands")
        KCard {
            if p.bands.isEmpty {
                Text("Needs at least two purchases at different NAVs.").font(Theme.footnote).foregroundStyle(Theme.muted)
            } else {
                HStack(spacing: 14) {
                    Label("Bought below your \(String(format: "%.2f", p.avgNav)) average", systemImage: "square.fill").foregroundStyle(up)
                    Label("Above it", systemImage: "square.fill").foregroundStyle(amber)
                }
                .font(Theme.footnote).labelStyle(FundSwatchStyle())
                Chart(p.bands) { b in
                    BarMark(x: .value("NAV", b.label), y: .value("Invested", b.amount)).foregroundStyle(b.belowAverage ? up : amber)
                        .annotation(position: .top) { Text(Money.compact(b.amount)).font(.system(size: 9, weight: .semibold)).foregroundStyle(Theme.muted) }
                }
                .chartYAxis { AxisMarks(position: .leading) { AxisGridLine().foregroundStyle(Theme.muted.opacity(0.15)); AxisValueLabel().foregroundStyle(Theme.muted) } }
                .chartXAxis { AxisMarks { AxisValueLabel(orientation: .vertical).foregroundStyle(Theme.muted) } }
                .frame(height: 200).padding(.top, 8)
            }
        }
    }

    @ViewBuilder private func yearlyCard(_ p: FundPage.Page) -> some View {
        if !p.yearly.isEmpty {
            KSectionHeader(title: "Yearly profit / loss", detail: "by financial year")
            KCard {
                Chart(p.yearly) { y in
                    BarMark(x: .value("Year", y.year), y: .value("Net", y.total)).foregroundStyle(y.total >= 0 ? up : down)
                        .annotation(position: y.total >= 0 ? .top : .bottom) { Text(Money.compact(y.total)).font(.system(size: 9, weight: .semibold)).foregroundStyle(Theme.muted) }
                }
                .chartYAxis { AxisMarks(position: .leading) { AxisGridLine().foregroundStyle(Theme.muted.opacity(0.15)); AxisValueLabel().foregroundStyle(Theme.muted) } }
                .chartXAxis { AxisMarks { AxisValueLabel(orientation: .vertical).foregroundStyle(Theme.muted) } }
                .frame(height: 200)
                Text("Gains on purchases at today's NAV, and the profit booked on sales.").font(Theme.footnote).foregroundStyle(Theme.muted)
            }
        }
    }

    // MARK: Rows

    private func chip(_ title: String, on: Bool) -> some View {
        Button { year = title; shown = 20 } label: {
            Text(title == "All" ? "All years" : "FY \(title)").font(Theme.footnote.weight(.semibold))
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background((on ? Theme.accent : Color.white).opacity(on ? 0.25 : 0.07), in: Capsule())
                .foregroundStyle(on ? Theme.accent : Theme.muted)
        }
        .buttonStyle(.plain)
    }

    private func row(_ t: FundPage.Tx, lock: String?) -> some View {
        let kind = t.raw["type"].truthy ? t.raw["type"].text : "buy"
        let remarks = t.raw["remarks"].text
        return HStack(alignment: .firstTextBaseline, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(Fmt.date(t.date)).font(Theme.body).foregroundStyle(.white)
                HStack(spacing: 6) {
                    KBadge(text: kind, tone: t.isSell ? .negative : .accent)
                    Text("\(String(format: "%.3f", abs(t.units))) units @ \(String(format: "%.4f", t.nav))").font(Theme.footnote).foregroundStyle(Theme.muted)
                }
                if !remarks.isEmpty { Text(remarks).font(Theme.footnote).foregroundStyle(Theme.muted.opacity(0.8)).lineLimit(1) }
                if let lock { Text(lock).font(Theme.footnote).foregroundStyle(Theme.muted).lineLimit(2) }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text("\(t.isSell ? "−" : "")\(Money.rupees(t.amount))").font(Theme.figure).foregroundStyle(.white)
                Text(t.isSell ? "Profit \(signed(t.profit))" : "Now \(Money.rupees(t.value))").font(Theme.footnote).foregroundStyle(Theme.muted)
                Text(signed(t.profit)).font(Theme.footnote.weight(.bold)).foregroundStyle(t.profit >= 0 ? up : down)
            }
        }
    }
}

private struct FundSwatchStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 5) { configuration.icon.font(.system(size: 9)); configuration.title.foregroundStyle(Theme.muted) }
    }
}
