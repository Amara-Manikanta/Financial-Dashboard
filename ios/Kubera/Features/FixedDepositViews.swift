import SwiftUI

struct FDRoute: Hashable { let accountId: String; let depositId: String }

private func fact(_ label: String, _ value: String) -> some View {
    HStack(alignment: .firstTextBaseline) {
        Text(label).font(Theme.footnote).foregroundStyle(Theme.muted)
        Spacer(minLength: 12)
        Text(value).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white).multilineTextAlignment(.trailing)
    }
    .padding(.vertical, 2)
}

/// Every fixed deposit of the account, as on the Mac's Fixed Deposits page: totals, a filter by bank,
/// active and archived, and each deposit as a card that opens its own page. Adding is here too.
struct FixedDepositsView: View {
    @ObservedObject var store: FinanceStore
    let accountId: String

    @State private var bank = "ALL"
    @State private var archived = false
    @State private var adding = false

    private var account: JSONValue { store.data.savingsRaw.array.first { $0["id"].text == accountId } ?? .null }
    private var all: [JSONValue] { account["deposits"].array.filter { !$0.isNull } }
    private var active: [JSONValue] { all.filter { !$0["isArchived"].truthy } }
    private var past: [JSONValue] { all.filter { $0["isArchived"].truthy } }
    private var banks: [String] { DepositLedger.banks(archived ? past : active) }

    private var shown: [JSONValue] {
        let base = archived ? past : active
        let filtered = bank == "ALL" ? base : base.filter { $0["bank"].text == bank }
        return filtered.sorted { $0["endDate"].text < $1["endDate"].text }
    }

    var body: some View {
        let totals = shown.reduce((principal: 0.0, value: 0.0, maturity: 0.0, interest: 0.0)) { t, d in
            let a = DepositLedger.accrual(d)
            return (t.principal + d["originalAmount"].double, t.value + a.accruedValue, t.maturity + d["maturityAmount"].double, t.interest + a.accruedInterest)
        }
        return KScreen(refresh: { await store.load() }) {
            KCard(tint: Theme.accent) {
                KStat(label: bank == "ALL" ? "Fixed deposits today" : bank, value: Money.rupees(totals.value), size: .hero)
                HStack(alignment: .top) {
                    KStat(label: "Principal", value: Money.rupees(totals.principal))
                    Spacer()
                    KStat(label: "Interest so far", value: Money.rupees(totals.interest), tone: .positive)
                }
                .padding(.top, 10)
                HStack(alignment: .top) {
                    KStat(label: "Matures to", value: Money.rupees(totals.maturity))
                    Spacer()
                    KStat(label: "Deposits", value: "\(shown.count)")
                }
                .padding(.top, 8)
            }

            Picker("Show", selection: $archived) { Text("Active \(active.count)").tag(false); Text("Archived \(past.count)").tag(true) }
                .pickerStyle(.segmented)
                .onChange(of: archived) { bank = "ALL" }

            if banks.count > 1 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        chip("All", count: (archived ? past : active).count, on: bank == "ALL") { bank = "ALL" }
                        ForEach(banks, id: \.self) { b in
                            chip(b, count: (archived ? past : active).filter { $0["bank"].text == b }.count, on: bank == b) { bank = b }
                        }
                    }
                }
            }

            if shown.isEmpty {
                KCard { Text(archived ? "No closed deposits." : "No fixed deposits here yet. Tap + to add one.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            }
            ForEach(Array(shown.enumerated()), id: \.offset) { _, d in
                NavigationLink(value: FDRoute(accountId: accountId, depositId: d["id"].text)) { card(d) }.buttonStyle(.plain)
            }
        }
        .navigationTitle("Fixed Deposits")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .primaryAction) { Button { adding = true } label: { Image(systemName: "plus") } }
            ToolbarItem(placement: .secondaryAction) { EditRecordButton(store: store, collection: "savings", id: accountId, title: "Fixed Deposits") }
        }
        .sheet(isPresented: $adding) { FDFormSheet(store: store, accountId: accountId, editing: nil) }
        .navigationDestination(for: FDRoute.self) { FixedDepositView(store: store, route: $0) }
    }

    private func chip(_ title: String, count: Int, on: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text("\(title) \(count)").font(Theme.footnote.weight(.semibold))
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(on ? Theme.accent : Color.white.opacity(0.08), in: Capsule())
                .foregroundStyle(on ? Color.black : .white)
        }
        .buttonStyle(.plain)
    }

    private func card(_ d: JSONValue) -> some View {
        let a = DepositLedger.accrual(d)
        let left = Int(max(0, a.totalDays - a.daysElapsed))
        return KCard {
            HStack(alignment: .firstTextBaseline) {
                Text(d["bank"].text).font(Theme.body.weight(.bold)).foregroundStyle(.white)
                Spacer()
                Text(Money.rupees(a.accruedValue)).font(Theme.figure).foregroundStyle(.white)
            }
            Text([d["accountNo"].text, d["branchName"].text].filter { !$0.isEmpty }.joined(separator: " · ")).font(Theme.footnote).foregroundStyle(Theme.muted).lineLimit(1)
            HStack(alignment: .top) {
                KStat(label: "Principal", value: Money.rupees(d["originalAmount"].double))
                Spacer()
                KStat(label: "Rate", value: String(format: "%g%%", d["interestRate"].double))
                Spacer()
                KStat(label: "Matures to", value: Money.rupees(d["maturityAmount"].double), tone: .positive)
            }
            .padding(.top, 6)
            if !archived && a.totalDays > 0 {
                ProgressView(value: min(1, a.daysElapsed / a.totalDays)).tint(a.matured ? Theme.warning : Theme.accent).padding(.top, 6)
                Text(a.matured ? "Matured on \(Fmt.date(d["endDate"].text))" : "\(left) days left · matures \(Fmt.date(d["endDate"].text))")
                    .font(Theme.footnote).foregroundStyle(a.matured ? Tone.warning.color : Theme.muted)
            } else {
                Text("\(Fmt.date(d["startDate"].text)) → \(Fmt.date(d["endDate"].text))").font(Theme.footnote).foregroundStyle(Theme.muted)
            }
        }
    }
}

/// One fixed deposit with everything stored about it: terms, accrual, interest credited, and the
/// actions the Mac's page has — edit, renew, close, restore, delete.
struct FixedDepositView: View {
    @ObservedObject var store: FinanceStore
    let route: FDRoute
    @Environment(\.dismiss) private var dismiss

    private enum Sheet: Identifiable {
        case edit, renew, close, addInterest, editInterest(JSONValue)
        var id: String { switch self { case .edit: "edit"; case .renew: "renew"; case .close: "close"; case .addInterest: "addInterest"; case .editInterest(let e): "i" + e["id"].text } }
    }
    @State private var sheet: Sheet?
    @State private var confirmDelete = false
    @State private var deletingEntry: JSONValue?
    @State private var message: String?

    private var account: JSONValue { store.data.savingsRaw.array.first { $0["id"].text == route.accountId } ?? .null }
    private var deposit: JSONValue { account["deposits"].array.first { $0["id"].text == route.depositId } ?? .null }

    var body: some View {
        let d = deposit
        return KScreen(refresh: { await store.load() }) {
            if let message { KNotice(message: message) { self.message = nil } }
            if d.isNull {
                KCard { Text("This deposit is no longer on your Mac.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            } else {
                content(d)
            }
        }
        .navigationTitle(d["bank"].text.isEmpty ? "Fixed deposit" : d["bank"].text)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if !d.isNull {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button { sheet = .edit } label: { Label("Edit", systemImage: "pencil") }
                        if d["isArchived"].truthy {
                            Button { Task { message = await restore(d) } } label: { Label("Restore", systemImage: "arrow.uturn.backward") }
                        } else {
                            Button { sheet = .renew } label: { Label("Renew", systemImage: "arrow.triangle.2.circlepath") }
                            Button { sheet = .close } label: { Label("Close deposit", systemImage: "checkmark.circle") }
                        }
                        Button(role: .destructive) { confirmDelete = true } label: { Label("Delete", systemImage: "trash") }
                    } label: { Image(systemName: "ellipsis.circle") }
                }
            }
        }
        .sheet(item: $sheet) { s in
            switch s {
            case .edit: FDFormSheet(store: store, accountId: route.accountId, editing: deposit)
            case .renew: FDFormSheet(store: store, accountId: route.accountId, editing: deposit, renewal: true)
            case .close: FDCloseSheet(store: store, accountId: route.accountId, deposit: deposit)
            case .addInterest: EntrySheet(store: store, accountId: route.accountId, listKey: "deposits", depositId: route.depositId, subKey: "interestTransactions", editing: nil)
            case .editInterest(let e): EntrySheet(store: store, accountId: route.accountId, listKey: "deposits", depositId: route.depositId, subKey: "interestTransactions", editing: e)
            }
        }
        .confirmationDialog("Delete this deposit?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task {
                    let failure = await store.saveAccountChange(accountId: route.accountId) { DepositLedger.depositsPatch(account: $0, change: .delete(id: route.depositId)) }
                    if let failure { message = failure } else { dismiss() }
                }
            }
        } message: { Text("It is removed from your Mac, with its interest history. Close it instead to keep the record.") }
        .confirmationDialog("Delete this entry?", isPresented: Binding(get: { deletingEntry != nil }, set: { if !$0 { deletingEntry = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let e = deletingEntry {
                    Task { message = await store.saveAccountChange(accountId: route.accountId) {
                        DepositLedger.nestedPatch(account: $0, listKey: "deposits", depositId: route.depositId, subKey: "interestTransactions", change: .delete(id: e["id"].text)) } }
                }
            }
        }
    }

    private func restore(_ d: JSONValue) async -> String? {
        guard case .object(var f) = d else { return nil }
        f["isArchived"] = .bool(false)
        return await store.saveAccountChange(accountId: route.accountId) { DepositLedger.depositsPatch(account: $0, change: .replace(id: route.depositId, .object(f))) }
    }

    @ViewBuilder private func content(_ d: JSONValue) -> some View {
        let a = DepositLedger.accrual(d)
        let archived = d["isArchived"].truthy
        let interest = d["interestTransactions"].array.sorted { $0["date"].text > $1["date"].text }
        let credited = interest.reduce(0) { $0 + $1["amount"].double }
        let left = Int(max(0, a.totalDays - a.daysElapsed))
        KCard(tint: Theme.accent) {
            HStack(alignment: .firstTextBaseline) {
                KStat(label: archived ? "Closed at" : "Worth today", value: Money.rupees(a.accruedValue), size: .hero)
                Spacer()
                KBadge(text: archived ? "Closed" : a.matured ? "Matured" : "Active", tone: archived ? .neutral : a.matured ? .warning : .positive)
            }
            if !archived && a.totalDays > 0 {
                ProgressView(value: min(1, a.daysElapsed / a.totalDays)).tint(Theme.accent).padding(.top, 8)
                Text(a.matured ? "Matured on \(Fmt.date(d["endDate"].text))" : "\(Int(a.daysElapsed)) of \(Int(a.totalDays)) days · \(left) left")
                    .font(Theme.footnote).foregroundStyle(Theme.muted)
            }
            HStack(alignment: .top) {
                KStat(label: "Principal", value: Money.rupees(d["originalAmount"].double))
                Spacer()
                KStat(label: "Interest so far", value: Money.rupees(a.accruedInterest), tone: .positive)
                Spacer()
                KStat(label: "Matures to", value: Money.rupees(d["maturityAmount"].double))
            }
            .padding(.top, 10)
        }
        KCard {
            fact("Bank", d["bank"].text)
            if d["branchName"].truthy { fact("Branch", d["branchName"].text) }
            fact("Account no", d["accountNo"].text)
            fact("Interest rate", String(format: "%g%% a year", d["interestRate"].double))
            fact("Started", Fmt.date(d["startDate"].text))
            fact("Matures", Fmt.date(d["endDate"].text))
            fact("Interest to maturity", Money.rupees(d["interestEarned"].double))
            if d["tds"].double > 0 { fact("TDS", Money.rupees(d["tds"].double)) }
            if d["renewalCount"].double > 0 { fact("Renewals", RecordEditing.number(d["renewalCount"].double)) }
            if d["remarks"].truthy { fact("Remarks", d["remarks"].text) }
        }
        HStack {
            KSectionHeader(title: "Interest credited", detail: interest.isEmpty ? nil : "\(Money.rupees(credited)) · \(interest.count)")
            Button { sheet = .addInterest } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) }
        }
        if interest.isEmpty {
            KCard { Text("No interest credits recorded.").font(Theme.footnote).foregroundStyle(Theme.muted) }
        } else {
            KList(items: interest.enumerated().map { IndexedRow(id: $0.offset, value: $0.element) }) { row in
                Button { sheet = .editInterest(row.value) } label: {
                    KRow(title: Fmt.date(row.value["date"].text), subtitle: [DepositLedger.financialYear(row.value["date"].text), row.value["remarks"].text].filter { !$0.isEmpty }.joined(separator: " · "),
                         value: Money.rupees(row.value["amount"].double), valueTone: .positive)
                }
                .buttonStyle(.plain)
                .contextMenu { Button(role: .destructive) { deletingEntry = row.value } label: { Label("Delete", systemImage: "trash") } }
            }
            Text("Tap to change; long-press to delete.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
        }
    }
}

struct IndexedRow: Identifiable { let id: Int; let value: JSONValue }
