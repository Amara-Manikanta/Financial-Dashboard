import SwiftUI

/// A savings account, laid out as the Mac's page is: the rate and bank, balance and the four totals, the earnings
/// distribution by year and month, any recurring deposits linked to the account, and the transaction history with
/// year / month / type filters. Rows are added, changed and deleted through the version-checked ledger writes.
/// Not on the phone: the Mac's automatic daily-interest credit when the page opens, and editing linked recurring deposits.
struct SavingsAccountView: View {
    @ObservedObject var store: FinanceStore
    let accountId: String

    @State private var year = "All"
    @State private var month = 0
    @State private var type = "All"
    @State private var sheet: SheetRoute?
    @State private var deleting: SavingsAccountPage.Row?
    @State private var message: String?
    @State private var shown = 30

    private struct SheetRoute: Identifiable { let id = UUID(); let index: Int?; let row: JSONValue? }
    private var account: JSONValue { store.data.savingsRaw.array.first { $0["id"].text == accountId } ?? .null }
    private var spec: AccountLedger.ListSpec { AccountLedger.lists(for: "savings_account")[0] }
    private let purple = Color(red: 0.75, green: 0.52, blue: 0.99)

    var body: some View {
        let raw = account
        let title = [raw["title"], raw["name"]].first { $0.truthy }?.text ?? "Savings account"
        let years = SavingsAccountPage.years(raw)
        let y = years.contains(year) ? year : "All"
        let rows = SavingsAccountPage.rows(raw, year: y, month: month == 0 ? nil : month, type: type)
        let t = SavingsAccountPage.totals(raw, shown: rows)
        let earnings = SavingsAccountPage.earnings(raw)
        let rds = raw["recurringDeposits"].array
        let isSlice = title == "Slice Account"
        let rate = raw["interestRate"].truthy ? String(format: "%g", raw["interestRate"].double) : "5.4"

        KScreen(refresh: { await store.load() }) {
            if let message { KNotice(message: message) { self.message = nil } }
            HStack(spacing: 8) {
                KBadge(text: "\(rate)% annual interest", tone: .accent)
                KBadge(text: raw["bank"].truthy ? raw["bank"].text : "Savings account", tone: .neutral)
                Spacer()
            }
            KCard(tint: Theme.accent) {
                KStat(label: "Available balance", value: Money.rupees(raw["amount"].double), size: .hero)
            }
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                if !isSlice { stat("Principal deposits", t.deposits, Theme.muted) }
                stat("Monnies redeemed", t.monnies, purple)
                stat("Accrued interest", t.lifetimeInterest, Theme.positive)
                stat("Total withdrawals", t.withdrawals, Theme.negative)
            }

            if !earnings.isEmpty {
                KSectionHeader(title: "Earnings distribution")
                KCard {
                    ForEach(earnings) { e in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack { Text(e.year).font(Theme.body.weight(.bold)).foregroundStyle(.white); Spacer()
                                Text(Money.rupees(e.total)).font(Theme.footnote.weight(.bold)).foregroundStyle(Theme.positive) }
                            ForEach(Array(e.months.enumerated()), id: \.offset) { _, m in
                                HStack { Text(m.name).font(Theme.footnote).foregroundStyle(Theme.muted); Spacer()
                                    Text(Money.rupees(m.amount)).font(Theme.footnote).foregroundStyle(.white) }
                            }
                        }
                        if e.year != earnings.last?.year { Divider().overlay(Theme.muted.opacity(0.2)) }
                    }
                }
            }

            if !isSlice && !rds.isEmpty {
                KSectionHeader(title: "Linked recurring deposits", detail: "\(rds.count)")
                ForEach(Array(rds.enumerated()), id: \.offset) { _, rd in
                    let paid = rd["installments"].array.reduce(0.0) { $0 + $1["amount"].double }
                    KCard {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack { Text(rd["name"].text).font(Theme.body.weight(.bold)).foregroundStyle(.white); Spacer(); KBadge(text: rd["status"].text, tone: rd["status"].text == "Active" ? .positive : .neutral) }
                            line("Installment", Money.rupees(rd["installmentAmount"].double) + "/mo")
                            line("Interest rate", "\(String(format: "%g", rd["interestRate"].double))%")
                            line("Current paid", Money.rupees(paid))
                            line("Dates", "\(Fmt.date(rd["startDate"].text)) – \(rd["endDate"].truthy ? Fmt.date(rd["endDate"].text) : "Ongoing")")
                            line("Maturity value", Money.rupees(rd["maturityAmount"].double))
                        }
                    }
                }
                Text("Linked recurring deposits are edited on the Mac.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            }

            HStack {
                KSectionHeader(title: "Transaction history", detail: "\(rows.count)")
                Button { sheet = SheetRoute(index: nil, row: nil) } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) }
            }
            HStack(spacing: 8) {
                Menu { ForEach(years, id: \.self) { v in Button(v == "All" ? "All years" : v) { year = v; shown = 30 } } } label: { filterChip(y == "All" ? "All years" : y) }
                Menu { Button("All months") { month = 0; shown = 30 }
                       ForEach(1...12, id: \.self) { m in Button(SavingsAccountPage.monthNames[m - 1]) { month = m; shown = 30 } } } label: { filterChip(month == 0 ? "All months" : SavingsAccountPage.monthNames[month - 1]) }
                Menu { ForEach([("All", "All types"), ("deposit", "Deposits"), ("withdraw", "Withdrawals"), ("interest", "Interest"), ("monnies_redeemed", "Monnies")], id: \.0) { v in Button(v.1) { type = v.0; shown = 30 } } }
                    label: { filterChip(["All": "All types", "deposit": "Deposits", "withdraw": "Withdrawals", "interest": "Interest", "monnies_redeemed": "Monnies"][type] ?? "All types") }
                Spacer()
            }
            if rows.isEmpty { KCard { Text("No entries found for this period.").font(Theme.footnote).foregroundStyle(Theme.muted) } }
            else {
                KList(items: Array(rows.prefix(shown))) { r in
                    let lock = AccountLedger.rowLock(r.raw, type: "savings_account")
                    let ty = r.raw["type"].text
                    Button { if lock == nil { sheet = SheetRoute(index: r.index, row: r.raw) } } label: {
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(Fmt.date(r.raw["date"].text)).font(Theme.body).foregroundStyle(.white)
                                KBadge(text: ty == "monnies_redeemed" ? "Monnies" : ty.capitalized, tone: ty == "withdraw" ? .warning : ty == "interest" ? .positive : .accent)
                                if r.raw["remarks"].truthy { Text(r.raw["remarks"].text).font(Theme.footnote).foregroundStyle(Theme.muted) }
                                if let lock { Text(lock).font(Theme.footnote).foregroundStyle(Theme.muted) }
                            }
                            Spacer()
                            Text((ty == "withdraw" ? "-" : "+") + Money.rupees(r.raw["amount"].double)).font(Theme.figure).foregroundStyle(ty == "withdraw" ? Theme.negative : .white)
                        }
                    }.buttonStyle(.plain)
                    .contextMenu { if lock == nil { Button(role: .destructive) { deleting = r } label: { Label("Delete", systemImage: "trash") } } }
                }
                if rows.count > shown { Button("Show 30 more") { shown += 30 }.font(Theme.footnote.weight(.bold)) }
                Text("Tap a row to change it; long-press to delete. Daily interest is credited by the Mac when the account is opened there.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
        .toolbar { EditRecordButton(store: store, collection: "savings", id: accountId, title: title) }
        .sheet(item: $sheet) { r in LedgerRowSheet(store: store, accountId: accountId, type: "savings_account", spec: spec, parentIndex: nil, index: r.index, editing: r.row) }
        .confirmationDialog("Delete transaction?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let d = deleting { Task { message = await store.saveAccount(accountId, .ledger(specId: spec.id, parentIndex: nil, .delete(index: d.index, expected: d.raw)), label: "Delete savings account row") } }
            }
        }
    }

    private func stat(_ label: String, _ value: Double, _ tint: Color) -> some View {
        KCard(tint: tint) {
            VStack(alignment: .leading, spacing: 4) {
                Text(label.uppercased()).font(Theme.caption).tracking(0.8).foregroundStyle(tint).lineLimit(2)
                Text(Money.rupees(value)).font(.system(size: 20, weight: .heavy, design: .rounded).monospacedDigit()).foregroundStyle(.white).minimumScaleFactor(0.7).lineLimit(1)
            }.frame(maxWidth: .infinity, minHeight: 56, alignment: .topLeading)
        }
    }
    private func line(_ l: String, _ v: String) -> some View {
        HStack { Text(l.uppercased()).font(Theme.caption).tracking(0.6).foregroundStyle(Theme.muted); Spacer(); Text(v).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white) }
    }
    private func filterChip(_ text: String) -> some View {
        HStack(spacing: 4) { Text(text).lineLimit(1); Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold)) }
            .font(Theme.footnote.weight(.semibold)).padding(.horizontal, 10).padding(.vertical, 6)
            .background(Color.white.opacity(0.08), in: Capsule()).foregroundStyle(Theme.muted)
    }
}
