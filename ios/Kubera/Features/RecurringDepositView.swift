import SwiftUI

struct RDRoute: Hashable { let accountId: String; let rdId: String }

private func fact(_ label: String, _ value: String) -> some View {
    HStack(alignment: .firstTextBaseline) {
        Text(label).font(Theme.footnote).foregroundStyle(Theme.muted)
        Spacer(minLength: 12)
        Text(value).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white).multilineTextAlignment(.trailing)
    }
    .padding(.vertical, 2)
}

/// The recurring deposits of the account (`RecurringDepositDetails.jsx`): totals, each deposit as a card
/// that opens its own page, and adding a deposit.
struct RecurringDepositsView: View {
    @ObservedObject var store: FinanceStore
    let accountId: String
    @State private var adding = false

    private var account: JSONValue { store.data.savingsRaw.array.first { $0["id"].text == accountId } ?? .null }
    private var rds: [JSONValue] { account["recurringDeposits"].array.filter { !$0.isNull } }

    private func paid(_ rd: JSONValue) -> Double { rd["installments"].array.reduce(0) { $0 + $1["amount"].double } }

    var body: some View {
        let paidTotal = rds.reduce(0) { $0 + paid($1) }
        let maturity = rds.reduce(0) { $0 + $1["maturityAmount"].double }
        let monthly = rds.filter { $0["status"].text.lowercased() == "active" }.reduce(0) { $0 + $1["installmentAmount"].double }
        return KScreen(refresh: { await store.load() }) {
            KCard(tint: Theme.accent) {
                KStat(label: "Paid in so far", value: Money.rupees(paidTotal), size: .hero)
                if maturity > 0 { ProgressView(value: min(1, paidTotal / maturity)).tint(Theme.accent).padding(.top, 8) }
                HStack(alignment: .top) {
                    KStat(label: "Monthly", value: Money.rupees(monthly), caption: "active deposits")
                    Spacer()
                    KStat(label: "Matures to", value: Money.rupees(maturity), tone: .positive)
                }
                .padding(.top, 10)
            }
            KSectionHeader(title: "Recurring deposits", detail: "\(rds.count)")
            if rds.isEmpty { KCard { Text("No recurring deposits yet. Tap + to add one.").font(Theme.footnote).foregroundStyle(Theme.muted) } }
            ForEach(Array(rds.enumerated()), id: \.offset) { _, rd in
                NavigationLink(value: RDRoute(accountId: accountId, rdId: rd["id"].text)) {
                    KCard {
                        HStack(alignment: .firstTextBaseline) {
                            Text(rd["name"].text).font(Theme.body.weight(.bold)).foregroundStyle(.white)
                            Spacer()
                            KBadge(text: rd["status"].text.isEmpty ? "—" : rd["status"].text, tone: rd["status"].text.lowercased() == "active" ? .positive : .neutral)
                        }
                        Text("\(Money.rupees(rd["installmentAmount"].double))/mo · \(String(format: "%g", rd["interestRate"].double))% · \(rd["installments"].array.count) paid")
                            .font(Theme.footnote).foregroundStyle(Theme.muted)
                        HStack(alignment: .top) {
                            KStat(label: "Paid in", value: Money.rupees(paid(rd)))
                            Spacer()
                            KStat(label: "Matures to", value: Money.rupees(rd["maturityAmount"].double), tone: .positive)
                        }
                        .padding(.top, 6)
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .navigationTitle("Recurring Deposits")
        .navigationBarTitleDisplayMode(.large)
        .toolbar { ToolbarItem(placement: .primaryAction) { Button { adding = true } label: { Image(systemName: "plus") } } }
        .sheet(isPresented: $adding) { RDFormSheet(store: store, accountId: accountId, editing: nil) }
        .navigationDestination(for: RDRoute.self) { RecurringDepositView(store: store, route: $0) }
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
