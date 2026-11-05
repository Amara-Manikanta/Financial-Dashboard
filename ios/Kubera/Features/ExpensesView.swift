import SwiftUI
import Charts

struct ExpensesView: View {
    @ObservedObject var store: FinanceStore

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
    @State private var velocityLine = false
    @State private var adding = ProcessInfo.processInfo.arguments.contains("-addTransaction")

    /// Today if this is the current month, otherwise the 1st of it — where the Mac's month page opens its form.
    private var defaultDate: Date {
        let c = Calendar.current, now = Date()
        if c.component(.year, from: now) == month.year && c.component(.month, from: now) - 1 == month.index { return now }
        return c.date(from: DateComponents(year: month.year, month: month.index + 1, day: 1)) ?? now
    }

    private enum Tab: String, CaseIterable { case transactions = "Transactions", categories = "Categories", income = "Income", cards = "Cards" }

    /// The month page's category breakdown, worked out exactly as the Mac's month page does.
    private var detail: MonthCategories.Detail {
        let d = store.data, yearKey = String(month.year)
        let yearNode = d.expensesRaw[yearKey]
        guard let key = yearNode.object.keys.first(where: { ExpenseLedger.monthIndex($0) == month.index }) else { return .init() }
        let node = yearNode[key]
        let salary = ExpenseLedger.configuredSalary(year: yearKey, month: key, node: node, slips: ExpenseLedger.payslips(d.salaryRaw))
        return MonthCategories.detail(node: node, salary: salary, map: Budgets.categoryMap(appData: d.appDataRaw))
    }

    /// Spending velocity, credit card summary and wallets — the rest of the Mac's month page (`MonthExtras`).
    private var extras: MonthExtras.Result {
        let d = store.data, yearKey = String(month.year)
        guard let key = d.expensesRaw[yearKey].object.keys.first(where: { ExpenseLedger.monthIndex($0) == month.index }) else { return .init() }
        return MonthExtras.compute(expenses: d.expensesRaw, creditCards: d.creditCardsRaw, year: yearKey, month: key, grossSpent: month.spent)
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

            velocity(extras)

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
            case .cards:
                cards(extras)
            }
        }
        .searchable(text: $query, prompt: "Search title or category")
        .navigationTitle("\(month.name) \(String(month.year))")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .primaryAction) { Button { adding = true } label: { Image(systemName: "plus") } } }
        .sheet(isPresented: $adding) { AddTransactionView(store: store, defaultDate: defaultDate) }
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

    // MARK: Spending velocity, cards and wallets

    @ViewBuilder private func velocity(_ x: MonthExtras.Result) -> some View {
        if x.days.contains(where: { $0.amount != 0 }) {
            KSectionHeader(title: "Spending velocity", detail: "day by day")
            KCard {
                Picker("Chart", selection: $velocityLine) { Text("Bar").tag(false); Text("Line").tag(true) }.pickerStyle(.segmented)
                Chart(x.days) { d in
                    if velocityLine {
                        LineMark(x: .value("Day", d.day), y: .value("So far", d.cumulative)).foregroundStyle(Theme.negative).interpolationMethod(.monotone)
                    } else {
                        BarMark(x: .value("Day", d.day), y: .value("Spent", d.amount)).foregroundStyle(Theme.negative.opacity(0.85))
                    }
                }
                .chartYAxis { AxisMarks(position: .leading) { AxisGridLine().foregroundStyle(Theme.muted.opacity(0.15)); AxisValueLabel().foregroundStyle(Theme.muted) } }
                .chartXAxis { AxisMarks(values: [1, 5, 10, 15, 20, 25, x.days.count]) { AxisValueLabel().foregroundStyle(Theme.muted) } }
                .frame(height: 180).padding(.top, 8)
                Text(velocityLine ? "Running total through the month." : "Spent each day; category totals with no date count on the 1st.")
                    .font(Theme.footnote).foregroundStyle(Theme.muted)
            }
        }
    }

    @ViewBuilder private func cards(_ x: MonthExtras.Result) -> some View {
        if x.cards.isEmpty && x.wallets.isEmpty {
            KCard { Text("No card or wallet activity this month.").font(Theme.footnote).foregroundStyle(Theme.muted) }
        }
        if !x.cards.isEmpty {
            KSectionHeader(title: "Credit card summary", detail: "due this month")
            KList(items: x.cards) { c in
                VStack(alignment: .leading, spacing: 6) {
                    HStack { Text(c.name).font(Theme.body).foregroundStyle(.white); Spacer(); Text(Money.rupees(c.due)).font(Theme.figure).foregroundStyle(.white) }
                    HStack(alignment: .top) {
                        KStat(label: "Current spends", value: Money.rupees(c.spend))
                        Spacer()
                        if c.carryForward != 0 { KStat(label: c.carryForward > 0 ? "Carry forward due" : "Overpaid", value: Money.rupees(c.carryForward), tone: c.carryForward > 0 ? .warning : .positive) }
                        if c.payments > 0 { Spacer(); KStat(label: "Payments made", value: "−" + Money.rupees(c.payments), tone: .accent) }
                    }
                }
            }
            KCard { HStack { Text("Total current spends").font(Theme.footnote.weight(.bold)).foregroundStyle(Theme.muted); Spacer(); Text(Money.rupees(x.totalCardSpend)).font(Theme.figure).foregroundStyle(.white) } }
        }
        if !x.wallets.isEmpty {
            KSectionHeader(title: "Wallets summary", detail: "balance to the end of this month")
            KCard {
                ForEach(x.wallets, id: \.name) { w in
                    HStack { Text(w.name).font(Theme.footnote.weight(.bold)).foregroundStyle(Theme.muted); Spacer(); Text(Money.rupees(w.balance)).font(Theme.figure).foregroundStyle(Theme.positive) }.padding(.vertical, 3)
                }
                HStack { Text("Total wallet value").font(Theme.footnote.weight(.bold)).foregroundStyle(Theme.positive); Spacer()
                    Text(Money.rupees(x.wallets.reduce(0) { $0 + $1.balance })).font(Theme.figure).foregroundStyle(.white) }.padding(.top, 6)
            }
        }
    }
}
