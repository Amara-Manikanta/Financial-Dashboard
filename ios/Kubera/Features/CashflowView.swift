import SwiftUI

/// What is already spoken for over the next 30, 60 or 90 days, one pay cycle at a time.
/// It does not predict a bank balance — there is none in the database.
struct CashflowView: View {
    @ObservedObject var store: FinanceStore
    @State private var horizon = 90

    private func inr(_ v: Double) -> String { Money.rupees(v) }

    var body: some View {
        let d = store.data
        let f = Cashflow.build(expenses: d.expensesRaw, creditCards: d.creditCardsRaw, loans: d.loansRaw, overrides: d.appDataRaw["recurringOverrides"], days: horizon)
        KScreen(refresh: { await store.load() }) {
            Picker("Horizon", selection: $horizon) { Text("30 days").tag(30); Text("60 days").tag(60); Text("90 days").tag(90) }.pickerStyle(.segmented)

            if f.cycles.isEmpty {
                KCard { Text("Nothing to project yet — this needs recurring charges, a billing day on a card, or a salary history to work from.").font(Theme.body).foregroundStyle(Theme.muted) }
            } else {
                KCard(tint: Theme.accent) {
                    KStat(label: "Left after commitments", value: inr(max(0, f.salaryAmount - f.monthlyCommitted)), caption: "each month, before card bills, which vary", size: .hero)
                    HStack(alignment: .top) {
                        KStat(label: "Salary", value: inr(f.salaryAmount), tone: .positive, caption: "average of recent credits")
                        Spacer()
                        KStat(label: "Committed", value: inr(f.monthlyCommitted), tone: .warning, caption: "subscriptions and EMIs")
                    }.padding(.top, 10)
                }
                Text("A subscription billed to a card is shown inside that card's bill rather than beside it, so nothing is counted twice.")
                    .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)

                ForEach(f.cycles) { c in
                    let tight = c.income > 0 && c.income - c.committed < 0
                    VStack(alignment: .leading, spacing: 8) {
                        KSectionHeader(title: "\(c.from) → \(c.to)")
                        KCard(padding: 0, tint: tight ? Theme.negative : nil) {
                            VStack(alignment: .leading, spacing: 0) {
                                HStack {
                                    Text(c.income > 0 ? "Pay cycle" : "Before the next payday").font(Theme.footnote).foregroundStyle(Theme.muted)
                                    Spacer()
                                    Text("In \(inr(c.income))").font(Theme.footnote.weight(.semibold)).foregroundStyle(Theme.positive)
                                    Text("Out \(inr(c.committed))\(c.unknown > 0 ? " +?" : "")").font(Theme.footnote.weight(.semibold)).foregroundStyle(Theme.warning)
                                }.padding(Theme.cardPadding)
                                if tight {
                                    Text("Commitments exceed the income landing in this cycle by \(inr(abs(c.income - c.committed)))")
                                        .font(Theme.footnote.weight(.bold)).foregroundStyle(Theme.negative).padding(.horizontal, Theme.cardPadding).padding(.bottom, 8)
                                }
                                ForEach(c.events) { e in
                                    Divider().overlay(Color.white.opacity(0.06))
                                    VStack(alignment: .leading, spacing: 3) {
                                        HStack(alignment: .firstTextBaseline) {
                                            Text(String(e.date.suffix(5))).font(.system(.footnote, design: .monospaced)).foregroundStyle(Theme.muted)
                                            Text(e.label).font(Theme.body).foregroundStyle(.white).lineLimit(1)
                                            Spacer()
                                            Text(e.amount.map(inr) ?? "—").font(Theme.figure).foregroundStyle(e.kind == "income" ? Theme.positive : .white)
                                        }
                                        Text(e.detail).font(Theme.footnote).foregroundStyle(Theme.muted)
                                        if !e.includes.isEmpty {
                                            Text("includes " + e.includes.map { "\($0.label) \(inr($0.amount))" }.joined(separator: " · ")).font(Theme.footnote).foregroundStyle(Theme.muted.opacity(0.8))
                                        }
                                    }.padding(.horizontal, Theme.cardPadding).padding(.vertical, 10)
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Cashflow")
        .navigationBarTitleDisplayMode(.large)
    }
}
