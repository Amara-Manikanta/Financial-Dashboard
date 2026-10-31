import SwiftUI

struct ExpensesView: View {
    @ObservedObject var store: FinanceStore
    @State private var adding = ProcessInfo.processInfo.arguments.contains("-addTransaction")

    var body: some View {
        NavigationStack {
            KScreen(refresh: { await store.load() }) {
                if let message = store.errorMessage { KNotice(message: message) { Task { await store.load() } } }
                ForEach(store.years) { year in
                    NavigationLink(value: year.year) {
                        KCard {
                            HStack {
                                Text(String(year.year)).font(.system(size: 26, weight: .heavy, design: .rounded))
                                Spacer()
                                Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.muted.opacity(0.6))
                            }
                            HStack(alignment: .top) {
                                KStat(label: "Income", value: Money.compact(year.income), tone: .positive)
                                Spacer()
                                KStat(label: "Spent", value: Money.compact(year.spent), tone: .negative)
                                Spacer()
                                KStat(label: "Invested", value: Money.compact(year.invested), tone: .accent)
                            }
                            .padding(.top, 6)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .navigationTitle("Expenses")
            .toolbar { ToolbarItem(placement: .primaryAction) { Button { adding = true } label: { Image(systemName: "plus") } } }
            .sheet(isPresented: $adding) { AddTransactionView(store: store) }
            .navigationDestination(for: Int.self) { year in
                if let summary = store.years.first(where: { $0.year == year }) { YearView(store: store, year: summary) }
            }
        }
    }
}

private struct YearView: View {
    @ObservedObject var store: FinanceStore
    let year: YearSummary

    var body: some View {
        KScreen {
            KCard {
                HStack(alignment: .top) {
                    KStat(label: "Income", value: Money.rupees(year.income), tone: .positive)
                    Spacer()
                    KStat(label: "Spent", value: Money.rupees(year.spent), tone: .negative)
                }
                KStat(label: "Invested", value: Money.rupees(year.invested), tone: .accent).padding(.top, 8)
            }
            KSectionHeader(title: "Months")
            // A month with nothing in it (one not yet reached) is not worth a row.
            KList(items: year.months.filter { $0.spent > 0 || $0.income > 0 || $0.invested > 0 }.reversed()) { month in
                NavigationLink(value: month) {
                    KRow(title: month.name,
                         subtitle: "In \(Money.compact(month.income)) · Inv \(Money.compact(month.invested))",
                         value: Money.rupees(month.spent), valueTone: .negative,
                         valueCaption: month.income > 0 || month.spent > 0 ? "\(Fmt.signed(month.balance)) left" : nil,
                         chevron: true)
                }
                .buttonStyle(.plain)
            }
        }
        .navigationTitle(String(year.year))
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: MonthSummary.self) { MonthView(store: store, month: $0) }
    }
}

extension MonthSummary: Hashable {
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

private struct MonthView: View {
    @ObservedObject var store: FinanceStore
    let month: MonthSummary
    @State private var query = ""
    @State private var tab = Tab.transactions

    private enum Tab: String, CaseIterable { case transactions = "Transactions", categories = "Categories", income = "Income" }

    /// The month page's category breakdown, worked out exactly as the Mac's month page does.
    private var detail: MonthCategories.Detail {
        let d = store.data, yearKey = String(month.year)
        let yearNode = d.expensesRaw[yearKey]
        guard let key = yearNode.object.keys.first(where: { ExpenseLedger.monthIndex($0) == month.index }) else { return .init() }
        let node = yearNode[key]
        let salary = ExpenseLedger.configuredSalary(year: yearKey, month: key, node: node, slips: ExpenseLedger.payslips(d.salaryRaw))
        return MonthCategories.detail(node: node, salary: salary, map: Budgets.categoryMap(appData: d.appDataRaw))
    }

    private struct Row: Identifiable { let id: String; let tx: JSONValue }

    private var rows: [Row] {
        month.transactions.enumerated()
            .filter { _, tx in
                query.isEmpty || [tx["title"].text, tx["category"].text].contains { $0.localizedCaseInsensitiveContains(query) }
            }
            .sorted { $0.element["date"].text > $1.element["date"].text }
            .map { Row(id: $0.element["id"].isNull ? "row-\($0.offset)" : $0.element["id"].text, tx: $0.element) }
    }

    private var days: [(date: String, rows: [Row])] {
        var order: [String] = []
        var grouped: [String: [Row]] = [:]
        for row in rows {
            let day = String(row.tx["date"].text.prefix(10))
            if grouped[day] == nil { order.append(day) }
            grouped[day, default: []].append(row)
        }
        return order.map { ($0, grouped[$0] ?? []) }
    }

    var body: some View {
        KScreen {
            KCard {
                HStack(alignment: .top) {
                    KStat(label: "Spent", value: Money.rupees(month.spent), tone: .negative, size: .large)
                    Spacer()
                    KStat(label: "Income", value: Money.rupees(month.income), tone: .positive, size: .large)
                }
                HStack(alignment: .top) {
                    KStat(label: "Invested", value: Money.rupees(month.invested), tone: .accent)
                    Spacer()
                    KStat(label: "Left", value: Fmt.signed(month.balance), tone: Tone.of(month.balance))
                }
                .padding(.top, 10)
            }

            Picker("View", selection: $tab) {
                ForEach(Tab.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)

            switch tab {
            case .transactions:
                if month.transactions.isEmpty {
                    KCard { Text("This month only kept category totals, so there are no individual transactions to show.").font(Theme.footnote).foregroundStyle(Theme.muted) }
                }
                ForEach(days, id: \.date) { day in
                    KSectionHeader(title: Fmt.dayHeading(day.date))
                    KList(items: day.rows) { row in transaction(row.tx) }
                }
            case .categories:
                categories(detail)
            case .income:
                income(detail)
            }
        }
        .searchable(text: $query, prompt: "Search title or category")
        .navigationTitle("\(month.name) \(String(month.year))")
        .navigationBarTitleDisplayMode(.inline)
    }

    @ViewBuilder private func categories(_ d: MonthCategories.Detail) -> some View {
        let total = d.mainItems.filter { $0.amount > 0 }.reduce(0) { $0 + $1.amount }
        if d.mainItems.isEmpty {
            KCard { Text("Nothing was spent in this month.").font(Theme.footnote).foregroundStyle(Theme.muted) }
        }
        ForEach(d.mainItems) { main in
            let subs = d.items.filter { $0.mainCategory == main.category }
            KSectionHeader(title: main.category, detail: total > 0 && main.amount > 0 ? "\(Int((main.amount / total * 100).rounded()))%" : nil)
            KCard {
                HStack(alignment: .firstTextBaseline) {
                    KStat(label: "Total", value: Money.rupees(main.amount), tone: main.amount < 0 ? .positive : .neutral)
                    Spacer()
                    if main.deductibleAmount != main.amount {
                        KStat(label: "From your pocket", value: Money.rupees(main.deductibleAmount), caption: "excl. card spends")
                    }
                }
                if total > 0 && main.amount > 0 {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Theme.muted.opacity(0.18))
                            Capsule().fill(Theme.accent).frame(width: geo.size.width * min(1, main.amount / total))
                        }
                    }
                    .frame(height: 6)
                    .padding(.top, 4)
                }
                ForEach(subs) { sub in
                    HStack {
                        Text(Fmt.title(sub.category)).font(Theme.footnote).foregroundStyle(.white.opacity(0.85))
                        Spacer()
                        Text(Money.rupees(sub.amount)).font(Theme.footnote.monospacedDigit()).foregroundStyle(sub.amount < 0 ? Tone.positive.color : Theme.muted)
                    }
                    .padding(.top, 6)
                }
            }
        }
    }

    @ViewBuilder private func income(_ d: MonthCategories.Detail) -> some View {
        KCard { KStat(label: "Income this month", value: Money.rupees(d.salary), tone: .positive, size: .large) }
        if d.income.isEmpty {
            KCard { Text("No income recorded for this month.").font(Theme.footnote).foregroundStyle(Theme.muted) }
        } else {
            KList(items: d.income) { row in
                KRow(title: Fmt.title(row.category), value: Money.rupees(row.amount), valueTone: .positive, valueCaption: "\(row.percentage)%")
            }
        }
    }

    private func transaction(_ tx: JSONValue) -> some View {
        let credit = !TransactionKind.isDebit(tx)
        let amount = abs(tx["amount"].double)
        let kind = TransactionKind.kind(for: tx)
        return KRow(
            title: tx["title"].text.isEmpty ? Fmt.title(tx["category"].text) : tx["title"].text,
            subtitle: [Fmt.title(tx["category"].text), tx["paymentMode"].text].filter { !$0.isEmpty }.joined(separator: " · "),
            value: (credit ? "+" : "") + Money.rupees(amount),
            valueTone: credit ? .positive : (kind == .spend ? .neutral : .accent),
            valueCaption: credit || kind == .spend ? nil : kind.rawValue
        )
    }
}
