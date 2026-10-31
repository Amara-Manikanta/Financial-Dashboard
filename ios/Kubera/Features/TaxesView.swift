import SwiftUI

/// Filed returns and Form 16 records, and the old-versus-new regime calculator. Records are
/// entered on the Mac; the calculator is the same arithmetic and the same assumptions as the
/// Mac's page, with the figures it fills in from your latest return.
struct TaxesView: View {
    @ObservedObject var store: FinanceStore
    private enum Tab: String, CaseIterable, Identifiable { case planning = "Regime", itr = "ITR", partA = "16 · A", partB = "16 · B"; var id: String { rawValue } }
    @State private var tab = Tab.planning
    @State private var fy: String?
    @State private var inputs: TaxesPage.Inputs?

    private func inr(_ v: Double) -> String { Money.rupees(v) }

    var body: some View {
        let d = store.data
        let rows = TaxesPage.records(d.taxesRaw)
        KScreen(refresh: { await store.load() }) {
            Picker("View", selection: $tab) { ForEach(Tab.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.segmented)
            if tab == .planning { planning(rows, d) } else { records(rows) }
        }
        .navigationTitle("Taxes")
        .navigationBarTitleDisplayMode(.large)
    }

    // MARK: Calculator

    @ViewBuilder private func planning(_ rows: [TaxesPage.Record], _ d: Derived) -> some View {
        let selected = fy ?? rows.first?.fy ?? "2026-2027"
        let i = inputs ?? TaxesPage.prefill(fy: selected, taxes: d.taxesRaw, salaryDetails: d.salaryRaw, savings: d.savingsRaw)
        let r = TaxesPage.calculate(i)

        if !rows.isEmpty {
            Menu {
                ForEach(rows) { row in Button("FY \(row.fy)") { fy = row.fy; inputs = nil } }
            } label: { Label("Figures from FY \(selected)", systemImage: "calendar").font(Theme.footnote.weight(.semibold)) }
        }

        KCard(tint: r.newIsBetter ? Theme.positive : Theme.accent) {
            Text(r.newIsBetter ? "New regime is cheaper" : "Old regime is cheaper").font(Theme.body.weight(.bold)).foregroundStyle(.white)
            Text("You save \(inr(r.difference)) by choosing it.").font(Theme.footnote).foregroundStyle(Theme.muted)
            HStack(alignment: .top) {
                KStat(label: "Old regime tax", value: inr(r.oldTax), tone: r.oldTax > r.newTax ? .negative : .positive)
                Spacer()
                KStat(label: "New regime tax", value: inr(r.newTax), tone: r.newTax > r.oldTax ? .negative : .positive)
            }.padding(.top, 8)
        }
        KCard {
            KStat(label: "Tax already deducted (Form 16)", value: inr(i.tdsPaid))
            HStack(alignment: .top) {
                KStat(label: "Old regime", value: settle(r.oldRefundOrPayable), tone: r.oldRefundOrPayable >= 0 ? .positive : .negative)
                Spacer()
                KStat(label: "New regime", value: settle(r.newRefundOrPayable), tone: r.newRefundOrPayable >= 0 ? .positive : .negative)
            }.padding(.top, 8)
        }

        KSectionHeader(title: "Income")
        KCard {
            field("Basic salary", i.basic) { var n = i; n.basic = $0; inputs = n }
            field("HRA", i.hra) { var n = i; n.hra = $0; inputs = n }
            field("Other allowances", i.other) { var n = i; n.other = $0; inputs = n }
            field("Bonus", i.bonus) { var n = i; n.bonus = $0; inputs = n }
            KRow(title: "Gross income", value: inr(r.gross))
        }
        KSectionHeader(title: "Deductions (old regime)")
        KCard {
            field("Section 80C", i.sec80C) { var n = i; n.sec80C = $0; inputs = n }
            field("Section 80D", i.sec80D) { var n = i; n.sec80D = $0; inputs = n }
            field("NPS 80CCD(1B)", i.nps) { var n = i; n.nps = $0; inputs = n }
            field("Home-loan interest", i.homeLoanInterest) { var n = i; n.homeLoanInterest = $0; inputs = n }
            field("Rent paid in the year", i.rent) { var n = i; n.rent = $0; inputs = n }
            Toggle("Metro city (HRA 50% of basic)", isOn: Binding(get: { i.metro }, set: { var n = i; n.metro = $0; inputs = n })).font(Theme.footnote).tint(Theme.accent)
            KRow(title: "HRA exemption", value: inr(r.hraExemption))
            KRow(title: "Total deductions", value: inr(r.oldDeductions))
        }
        KSectionHeader(title: "Taxable income")
        KCard {
            KRow(title: "Old regime", value: inr(r.oldTaxable))
            KRow(title: "New regime", value: inr(r.newTaxable))
        }
        Text("New regime: ₹75,000 standard deduction and full rebate up to ₹12 lakh of taxable income (FY 2026-27 slabs). Old regime: ₹50,000 standard deduction. Estimates only; they change nothing in your records.")
            .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
    }

    private func settle(_ v: Double) -> String { v >= 0 ? "+\(inr(v)) refund" : "−\(inr(abs(v))) payable" }

    private func field(_ title: String, _ value: Double, set: @escaping (Double) -> Void) -> some View {
        HStack {
            Text(title).font(Theme.footnote).foregroundStyle(Theme.muted)
            Spacer()
            TextField("0", value: Binding(get: { value }, set: set), format: .number.precision(.fractionLength(0)))
                .keyboardType(.numberPad).multilineTextAlignment(.trailing).foregroundStyle(.white).frame(maxWidth: 140)
        }
    }

    // MARK: Records

    @ViewBuilder private func records(_ rows: [TaxesPage.Record]) -> some View {
        let t = TaxesPage.totals(rows)
        if rows.isEmpty {
            KCard { Text("No tax records yet. Add a financial year on the Mac.").font(Theme.body).foregroundStyle(Theme.muted) }
        } else {
            if tab == .itr {
                KCard(tint: Theme.accent) {
                    KStat(label: "Tax paid, all years", value: inr(t.taxPaid), size: .hero)
                    HStack(alignment: .top) {
                        KStat(label: "Refunds received", value: inr(t.refundReceived), tone: .positive,
                              caption: "\(inr(t.refundDue)) due on returns")
                        Spacer()
                        KStat(label: "Still awaited", value: inr(t.refundAwaited), tone: t.refundAwaited > 0 ? .warning : .neutral)
                    }.padding(.top, 10)
                }
            }
            ForEach(rows) { r in
                KCard {
                    HStack { Text("FY \(r.fy)").font(Theme.body.weight(.bold)).foregroundStyle(.white); Spacer()
                        if tab == .itr { KBadge(text: r.raw["itrStatus"].text.isEmpty ? "—" : r.raw["itrStatus"].text, tone: status(r.raw["itrStatus"].text)) } }
                    Text(tab == .itr ? "Filed on \(r.raw["itrFilingDate"].truthy ? r.raw["itrFilingDate"].text : "not specified")" : "Form 16: \(r.raw["form16Status"].text)")
                        .font(Theme.footnote).foregroundStyle(Theme.muted)
                    if tab == .itr {
                        KRow(title: "Total income", value: inr(r.n("totalIncome")))
                        KRow(title: "Taxes paid", value: inr(r.n("taxesPaid")))
                        if r.isRefund || r.isPayable {
                            KRow(title: r.isRefund ? "Refund due" : "Tax payable", value: inr(abs(r.n("taxPayableRefundable"))), valueTone: r.isRefund ? .positive : .negative)
                        }
                        if r.isRefund {
                            Text("Received\(r.raw["refundReceivedDate"].truthy ? " on \(r.raw["refundReceivedDate"].text)" : ""): \(r.refundReceived > 0 ? inr(r.refundReceived) : "not yet recorded")"
                                 + (r.refundDue - r.refundReceived > 0 ? " · \(inr(r.refundDue - r.refundReceived)) awaited" : "")
                                 + (r.refundReceived > r.refundDue ? " · \(inr(r.refundReceived - r.refundDue)) more than the return shows (interest?)" : ""))
                                .font(Theme.footnote).foregroundStyle(Theme.muted)
                        }
                    } else if tab == .partA {
                        ForEach(1...4, id: \.self) { q in KRow(title: "Q\(q)", subtitle: "Paid \(inr(r.n("f16Q\(q)Paid")))", value: "TDS \(inr(r.n("f16Q\(q)Tds")))") }
                        KRow(title: "Total amount paid", value: inr(r.n("f16AmountPaidPartA")))
                        KRow(title: "Total TDS deducted", value: inr(r.n("f16TdsPartA")), valueTone: .accent)
                    } else {
                        KRow(title: "Gross salary", value: inr(r.n("f16GrossSalary")))
                        KRow(title: "Taxable income", value: inr(r.n("f16TotalTaxableIncome")))
                        KRow(title: "80C deductions", value: inr(r.n("f1680C")))
                        KRow(title: "Total Chapter VI-A", value: inr(r.n("f16TotalChapterVIA")))
                        KRow(title: "Net tax payable", value: inr(r.n("f16NetTaxPayable")), valueTone: .negative)
                    }
                }
            }
            Text("Attached documents are on the Mac.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
        }
    }

    private func status(_ s: String) -> Tone { s == "Processed" ? .positive : s == "Filed" ? .accent : .warning }
}
