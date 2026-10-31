import SwiftUI

struct RDRoute: Hashable { let accountId: String; let index: Int }

/// One recurring deposit inside a recurring-deposit account: what is paid in, what it matures to,
/// and the instalments and interest credited so far. Read from the Mac; the pencil edits the account.
struct RecurringDepositView: View {
    @ObservedObject var store: FinanceStore
    let route: RDRoute

    private var account: JSONValue { store.data.savingsRaw.array.first { $0["id"].text == route.accountId } ?? .null }
    private var rd: JSONValue { account["recurringDeposits"].array.indices.contains(route.index) ? account["recurringDeposits"].array[route.index] : .null }

    private struct Line: Identifiable { let id: Int; let date: String; let amount: Double; let note: String }

    private func lines(_ key: String) -> [Line] {
        rd[key].array.enumerated()
            .sorted { $0.element["date"].text > $1.element["date"].text }
            .map { Line(id: $0.offset, date: $0.element["date"].text, amount: $0.element["amount"].double, note: $0.element["remarks"].text) }
    }

    private var totalMonths: Int {
        guard let start = JSDate.parse(rd["startDate"]), let end = JSDate.parse(rd["endDate"]) else { return 0 }
        let c = Calendar.current
        let m = c.dateComponents([.month], from: start, to: end).month ?? 0
        return max(0, m)
    }

    var body: some View {
        let installments = lines("installments"), interest = lines("interestTransactions")
        let paid = installments.reduce(0) { $0 + $1.amount }
        let credited = interest.reduce(0) { $0 + $1.amount }
        return KScreen(refresh: { await store.load() }) {
            if rd.isNull {
                KCard { Text("This recurring deposit is no longer on your Mac.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            } else {
                KCard(tint: Theme.accent) {
                    HStack(alignment: .firstTextBaseline) {
                        KStat(label: "Paid in", value: Money.rupees(paid), size: .hero)
                        Spacer()
                        if rd["status"].truthy { KBadge(text: rd["status"].text, tone: rd["status"].text.lowercased() == "active" ? .positive : .neutral) }
                    }
                    if totalMonths > 0 {
                        ProgressView(value: min(1, Double(installments.count) / Double(totalMonths))).tint(Theme.accent).padding(.top, 8)
                        Text("\(installments.count) of \(totalMonths) instalments").font(Theme.footnote).foregroundStyle(Theme.muted)
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
                if !installments.isEmpty {
                    KSectionHeader(title: "Instalments", detail: "\(installments.count)")
                    KList(items: installments) { l in KRow(title: Fmt.date(l.date), subtitle: l.note.isEmpty ? nil : l.note, value: Money.rupees(l.amount)) }
                }
                if !interest.isEmpty {
                    KSectionHeader(title: "Interest credited", detail: "\(interest.count)")
                    KList(items: interest) { l in KRow(title: Fmt.date(l.date), subtitle: l.note.isEmpty ? nil : l.note, value: Money.rupees(l.amount), valueTone: .positive) }
                }
            }
        }
        .navigationTitle(rd["name"].text.isEmpty ? "Recurring deposit" : rd["name"].text)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { EditRecordButton(store: store, collection: "savings", id: route.accountId, title: account["title"].text) }
    }

    private func fact(_ label: String, _ value: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label).font(Theme.footnote).foregroundStyle(Theme.muted)
            Spacer()
            Text(value).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white)
        }
        .padding(.vertical, 2)
    }
}
