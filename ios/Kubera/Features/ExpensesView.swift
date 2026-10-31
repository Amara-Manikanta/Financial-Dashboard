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
                if let summary = store.years.first(where: { $0.year == year }) { YearView(year: summary) }
            }
        }
    }
}

private struct YearView: View {
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
        .navigationDestination(for: MonthSummary.self) { MonthView(month: $0) }
    }
}

extension MonthSummary: Hashable {
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

private struct MonthView: View {
    let month: MonthSummary
    @State private var query = ""

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

            if month.transactions.isEmpty {
                KCard { Text("This month only kept category totals, so there are no individual transactions to show.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            }

            ForEach(days, id: \.date) { day in
                KSectionHeader(title: Fmt.dayHeading(day.date))
                KList(items: day.rows) { row in transaction(row.tx) }
            }
        }
        .searchable(text: $query, prompt: "Search title or category")
        .navigationTitle("\(month.name) \(String(month.year))")
        .navigationBarTitleDisplayMode(.inline)
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
