import SwiftUI
import Charts

struct RDRoute: Hashable { let accountId: String; let rdId: String }

private func fact(_ label: String, _ value: String) -> some View {
    HStack(alignment: .firstTextBaseline) {
        Text(label).font(Theme.footnote).foregroundStyle(Theme.muted)
        Spacer(minLength: 12)
        Text(value).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white).multilineTextAlignment(.trailing)
    }
    .padding(.vertical, 2)
}

/// The recurring deposits of the account, laid out as the Mac's `RecurringDepositDetails.jsx` is: monthly instalments, what has
/// been paid against what the deposits mature to, a paid-vs-target chart, and each deposit as a card — soonest to mature first —
/// showing its term progress, days left, interest earned, what is still to pay, TDS and remarks. Each opens its own page.
struct RecurringDepositsView: View {
    @ObservedObject var store: FinanceStore
    let accountId: String
    @State private var adding = false

    private var account: JSONValue { store.data.savingsRaw.array.first { $0["id"].text == accountId } ?? .null }
    private let green = Color(red: 0.2, green: 0.83, blue: 0.6)
    private let blue = Color(red: 0.38, green: 0.65, blue: 0.98)
    private let amber = Color(red: 0.98, green: 0.75, blue: 0.14)

    var body: some View {
        let page = RDPage.page(account)
        let title = [account["title"], account["name"]].first { $0.truthy }?.text ?? "Recurring Deposits"
        return KScreen(refresh: { await store.load() }) {
            Text("Systematic monthly savings and interest accumulation · \(page.totals.count) deposit\(page.totals.count == 1 ? "" : "s")")
                .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)

            KCard(tint: Theme.accent) {
                KStat(label: "Monthly instalments", value: Money.rupees(page.totals.installment), caption: "across all deposits", size: .large)
                HStack(alignment: .top) {
                    KStat(label: "Total paid", value: Money.rupees(page.totals.paid))
                    Spacer()
                    KStat(label: "Maturity target", value: Money.rupees(page.totals.maturity), tone: .positive)
                }
                .padding(.top, 10)
                if page.totals.maturity > 0 {
                    ProgressView(value: min(1, page.totals.progress / 100)).tint(green).padding(.top, 8)
                    Text(String(format: "%.1f%% achieved", page.totals.progress)).font(Theme.footnote.weight(.semibold)).foregroundStyle(green)
                }
            }

            if !page.chart.isEmpty { chart(page) }

            KSectionHeader(title: "Recurring deposits", detail: "soonest to mature first")
            if page.cards.isEmpty { KCard { Text("No recurring deposits yet. Tap + to add one.").font(Theme.footnote).foregroundStyle(Theme.muted) } }
            ForEach(page.cards) { c in
                NavigationLink(value: RDRoute(accountId: accountId, rdId: c.id)) { card(c) }.buttonStyle(.plain)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .primaryAction) { Button { adding = true } label: { Image(systemName: "plus") } }
            ToolbarItem(placement: .secondaryAction) { EditRecordButton(store: store, collection: "savings", id: accountId, title: title) }
        }
        .sheet(isPresented: $adding) { RDFormSheet(store: store, accountId: accountId, editing: nil) }
        .navigationDestination(for: RDRoute.self) { RecurringDepositView(store: store, route: $0) }
    }

    private func chart(_ page: RDPage.Page) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            KSectionHeader(title: "Current paid vs target maturity")
            KCard {
                Chart {
                    ForEach(page.chart) { b in
                        BarMark(x: .value("Deposit", b.name), y: .value("Amount", b.paid)).foregroundStyle(by: .value("Series", "Current paid")).position(by: .value("Series", "Current paid"))
                        BarMark(x: .value("Deposit", b.name), y: .value("Amount", b.maturity)).foregroundStyle(by: .value("Series", "Maturity target")).position(by: .value("Series", "Maturity target"))
                    }
                }
                .chartForegroundStyleScale(["Current paid": green, "Maturity target": blue])
                .chartYAxis { AxisMarks(position: .leading) { AxisGridLine().foregroundStyle(Theme.muted.opacity(0.15)); AxisValueLabel().foregroundStyle(Theme.muted) } }
                .chartXAxis { AxisMarks { AxisValueLabel(orientation: .vertical).foregroundStyle(Theme.muted) } }
                .chartLegend(position: .bottom)
                .frame(height: 220)
            }
        }
    }

    private func card(_ c: RDPage.Card) -> some View {
        let tint: Color? = c.matured ? green : c.nearing ? amber : nil
        return KCard(tint: tint) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(c.name).font(Theme.body.weight(.bold)).foregroundStyle(.white)
                    Text("\(Money.rupees(c.installment)) / month").font(Theme.footnote).foregroundStyle(Theme.muted)
                }
                Spacer()
                KBadge(text: c.badge, tone: c.matured ? .positive : c.nearing ? .warning : (c.badge.lowercased() == "active" ? .positive : .neutral))
            }
            HStack(alignment: .top) {
                KStat(label: "Instalment", value: Money.rupees(c.installment))
                Spacer()
                KStat(label: "Paid", value: Money.rupees(c.paid), tone: .positive)
                Spacer()
                KStat(label: "Matures to", value: Money.rupees(c.maturity))
            }
            .padding(.top, 8)
            HStack {
                Text(c.daysText).font(Theme.footnote.weight(.bold)).foregroundStyle(c.matured ? green : c.nearing ? amber : Theme.muted)
                Spacer()
                Text("\(Int(min(100, max(0, c.progressPercent))))% of the term").font(Theme.footnote).foregroundStyle(Theme.muted)
            }
            .padding(.top, 8)
            ProgressView(value: min(1, max(0, c.progressPercent / 100))).tint(c.matured ? green : c.nearing ? amber : blue)
            HStack(alignment: .top) {
                KStat(label: "Interest earned", value: Money.rupees(c.interest), tone: .positive)
                Spacer()
                KStat(label: "Still to pay", value: Money.rupees(c.remaining))
                Spacer()
                KStat(label: "TDS", value: c.tds > 0 ? Money.rupees(c.tds) : "₹0")
            }
            .padding(.top, 8)
            if let r = c.remarks, !r.isEmpty { Text("“\(r)”").font(Theme.footnote).italic().foregroundStyle(Theme.muted).padding(.top, 6) }
        }
    }
}

/// One recurring deposit: progress, terms, and its instalments and interest credits, which can be added,
/// changed and deleted. The deposit itself can be edited or deleted from the menu.
struct RecurringDepositView: View {
    @ObservedObject var store: FinanceStore
    let route: RDRoute
    @Environment(\.dismiss) private var dismiss

    private enum Sheet: Identifiable {
        case edit, addInstalment, addInterest, editInstalment(JSONValue), editInterest(JSONValue)
        var id: String { switch self { case .edit: "edit"; case .addInstalment: "ai"; case .addInterest: "an"; case .editInstalment(let e): "i" + e["id"].text; case .editInterest(let e): "n" + e["id"].text } }
    }
    @State private var sheet: Sheet?
    @State private var confirmDelete = false
    @State private var deleting: (key: String, row: JSONValue)?
    @State private var message: String?

    private var account: JSONValue { store.data.savingsRaw.array.first { $0["id"].text == route.accountId } ?? .null }
    private var rd: JSONValue { account["recurringDeposits"].array.first { $0["id"].text == route.rdId } ?? .null }

    private func sorted(_ key: String) -> [IndexedRow] {
        rd[key].array.sorted { $0["date"].text > $1["date"].text }.enumerated().map { IndexedRow(id: $0.offset, value: $0.element) }
    }

    private var totalMonths: Int {
        guard let start = JSDate.parse(rd["startDate"]), let end = JSDate.parse(rd["endDate"]) else { return 0 }
        return max(0, Calendar.current.dateComponents([.month], from: start, to: end).month ?? 0)
    }

    var body: some View {
        KScreen(refresh: { await store.load() }) {
            if let message { KNotice(message: message) { self.message = nil } }
            if rd.isNull {
                KCard { Text("This recurring deposit is no longer on your Mac.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            } else {
                content
            }
        }
        .navigationTitle(rd["name"].text.isEmpty ? "Recurring deposit" : rd["name"].text)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if !rd.isNull {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button { sheet = .edit } label: { Label("Edit deposit", systemImage: "pencil") }
                        Button(role: .destructive) { confirmDelete = true } label: { Label("Delete deposit", systemImage: "trash") }
                    } label: { Image(systemName: "ellipsis.circle") }
                }
            }
        }
        .sheet(item: $sheet) { s in
            switch s {
            case .edit: RDFormSheet(store: store, accountId: route.accountId, editing: rd)
            case .addInstalment: entry("installments", nil)
            case .editInstalment(let e): entry("installments", e)
            case .addInterest: entry("interestTransactions", nil)
            case .editInterest(let e): entry("interestTransactions", e)
            }
        }
        .confirmationDialog("Delete this recurring deposit?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task {
                    let failure = await store.saveAccount(route.accountId, .recurring(.delete(id: route.rdId)), label: "Delete recurring deposit")
                    if let failure { message = failure } else { dismiss() }
                }
            }
        } message: { Text("It is removed from your Mac with all its instalments and interest.") }
        .confirmationDialog("Delete this entry?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let d = deleting {
                    Task { message = await store.saveAccount(route.accountId, .nested(listKey: "recurringDeposits", depositId: route.rdId, subKey: d.key, .delete(id: d.row["id"].text)), label: "Delete entry from \(rd["name"].text)") }
                }
            }
        }
    }

    private func entry(_ key: String, _ editing: JSONValue?) -> some View {
        EntrySheet(store: store, accountId: route.accountId, listKey: "recurringDeposits", depositId: route.rdId, subKey: key, editing: editing)
    }

    @ViewBuilder private var content: some View {
        let installments = sorted("installments"), interest = sorted("interestTransactions")
        let paid = installments.reduce(0) { $0 + $1.value["amount"].double }
        let credited = interest.reduce(0) { $0 + $1.value["amount"].double }
        KCard(tint: Theme.accent) {
            HStack(alignment: .firstTextBaseline) {
                KStat(label: "Paid in", value: Money.rupees(paid), size: .hero)
                Spacer()
                if rd["status"].truthy { KBadge(text: rd["status"].text, tone: rd["status"].text.lowercased() == "active" ? .positive : .neutral) }
            }
            if rd["maturityAmount"].double > 0 {
                ProgressView(value: min(1, paid / rd["maturityAmount"].double)).tint(Theme.accent).padding(.top, 8)
                Text("\(Int(min(100, paid / rd["maturityAmount"].double * 100)))% of the maturity amount" + (totalMonths > 0 ? " · \(installments.count) of \(totalMonths) instalments" : ""))
                    .font(Theme.footnote).foregroundStyle(Theme.muted)
            }
            HStack(alignment: .top) {
                KStat(label: "Instalment", value: Money.rupees(rd["installmentAmount"].double), caption: "per month")
                Spacer()
                KStat(label: "Rate", value: String(format: "%g%%", rd["interestRate"].double))
                Spacer()
                KStat(label: "Matures to", value: Money.rupees(rd["maturityAmount"].double), tone: .positive)
            }
            .padding(.top, 10)
        }
        KCard {
            fact("Starts", Fmt.date(rd["startDate"].text))
            fact("Ends", Fmt.date(rd["endDate"].text))
            if rd["deductionDay"].truthy { fact("Deducted on day", rd["deductionDay"].text) }
            if rd["tds"].double > 0 { fact("TDS", Money.rupees(rd["tds"].double)) }
            if credited > 0 { fact("Interest credited", Money.rupees(credited)) }
        }
        if installments.count > 1 {
            KSectionHeader(title: "Instalment contribution history", detail: "oldest to newest")
            KCard {
                Chart(installments.reversed()) { r in
                    BarMark(x: .value("Date", r.value["date"].text), y: .value("Paid", r.value["amount"].double)).foregroundStyle(Theme.accent)
                }
                .chartYAxis { AxisMarks(position: .leading) { AxisGridLine().foregroundStyle(Theme.muted.opacity(0.15)); AxisValueLabel().foregroundStyle(Theme.muted) } }
                .chartXAxis(.hidden)
                .frame(height: 160)
            }
        }
        section("Instalments", "installments", installments, total: nil, add: .addInstalment) { .editInstalment($0) }
        section("Interest credited", "interestTransactions", interest, total: credited, add: .addInterest) { .editInterest($0) }
    }

    @ViewBuilder private func section(_ title: String, _ key: String, _ rows: [IndexedRow], total: Double?, add: Sheet, edit: @escaping (JSONValue) -> Sheet) -> some View {
        HStack {
            KSectionHeader(title: title, detail: rows.isEmpty ? nil : (total.map { "\(Money.rupees($0)) · " } ?? "") + "\(rows.count)")
            Button { sheet = add } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) }
        }
        if rows.isEmpty {
            KCard { Text("None recorded yet.").font(Theme.footnote).foregroundStyle(Theme.muted) }
        } else {
            KList(items: rows) { row in
                Button { sheet = edit(row.value) } label: {
                    KRow(title: Fmt.date(row.value["date"].text), subtitle: row.value["remarks"].truthy ? row.value["remarks"].text : nil,
                         value: Money.rupees(row.value["amount"].double), valueTone: key == "interestTransactions" ? .positive : .neutral)
                }
                .buttonStyle(.plain)
                .contextMenu { Button(role: .destructive) { deleting = (key, row.value) } label: { Label("Delete", systemImage: "trash") } }
            }
        }
    }
}
