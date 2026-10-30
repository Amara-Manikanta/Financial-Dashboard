import SwiftUI

/// Loans & Lents: money owed between you and other people, bank loans and EMIs,
/// and an EMI calculator. Port of LentsAndLoans.jsx and EMICalculator.jsx.
struct LoansView: View {
    @ObservedObject var store: FinanceStore
    @Environment(\.openWebPage) private var openWebPage

    private enum Section: String, CaseIterable, Identifiable {
        case people = "People", loans = "Loans", calculator = "Calculator"
        var id: String { rawValue }
    }

    @State private var section: Section = .people
    @State private var query = ""
    @State private var openLoans: Set<String> = []

    // The calculator starts where the web one does.
    @State private var principal = 3_000_000.0
    @State private var rate = 8.5
    @State private var years = 20.0

    var body: some View {
        KScreen(refresh: { await store.load() }) {
            Picker("Section", selection: $section) {
                ForEach(Section.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)

            switch section {
            case .people: people
            case .loans: loans
            case .calculator: calculator
            }
        }
        .navigationTitle("Loans & Lents")
        .navigationBarTitleDisplayMode(.large)
    }

    // MARK: People

    private var filteredDebts: [LoansPage.PeerDebt] {
        let all = store.people.debts
        guard !query.isEmpty else { return all }
        return all.filter { $0.name.localizedCaseInsensitiveContains(query) || $0.detail.localizedCaseInsensitiveContains(query) }
    }

    @ViewBuilder private var people: some View {
        let people = store.people
        HStack(spacing: 12) {
            KCard(tint: Theme.positive) { KStat(label: "Receivable", value: Money.compact(people.totalLent), tone: .positive, size: .large) }
            KCard(tint: Theme.negative) { KStat(label: "Payable", value: Money.compact(people.totalBorrowed), tone: .negative, size: .large) }
        }
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundStyle(Theme.muted)
            TextField("Search people", text: $query).textInputAutocapitalization(.never).autocorrectionDisabled()
        }
        .padding(12)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        KSectionHeader(title: "People", detail: "\(people.debts.count)")
        if people.debts.isEmpty {
            KCard { Text("No peer-to-peer debts recorded.").font(Theme.footnote).foregroundStyle(Theme.muted) }
        } else {
            KList(items: filteredDebts) { debt in
                Button { openWebPage(AppPage(title: debt.name, path: "/lents-loans/\(debt.id)", icon: "arrow.up.right.circle")) } label: {
                    KRow(title: debt.name, subtitle: debt.detail.isEmpty ? (debt.isLent ? "Lent" : "Borrowed") : debt.detail,
                         value: Money.rupees(debt.outstanding), valueTone: debt.isLent ? .positive : .negative,
                         valueCaption: debt.isLent ? "owed to you" : "you owe", chevron: true)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: Loans

    @ViewBuilder private var loans: some View {
        let page = store.loans
        KCard(tint: Theme.accent) {
            HStack(alignment: .top) {
                KStat(label: "Total principal", value: Money.compact(page.totalPrincipal), tone: .negative, size: .large)
                Spacer()
                KStat(label: "Monthly EMI", value: Money.compact(page.totalMonthlyEmi), tone: .accent, size: .large)
            }
            KStat(label: "Fees & GST paid", value: Money.rupees(page.totalFeesAndGst), tone: .warning).padding(.top, 8)
        }
        if page.loans.isEmpty {
            KCard { Text("No loans or EMIs recorded.").font(Theme.footnote).foregroundStyle(Theme.muted) }
        }
        ForEach(page.loans) { loan in loanCard(loan) }
    }

    private func loanCard(_ loan: LoansPage.Loan) -> some View {
        KCard {
            HStack(alignment: .firstTextBaseline) {
                Text(loan.name).font(.system(size: 19, weight: .heavy, design: .rounded)).foregroundStyle(.white)
                Spacer()
                if loan.paidThisMonth { KBadge(text: "Paid this month", tone: .positive) }
                else if loan.dueThisMonth { KBadge(text: "Due this month", tone: .warning) }
            }
            Text("\(loan.badge.emoji) \(loan.badge.label)\(loan.lender.isEmpty ? "" : " · \(loan.lender)")")
                .font(Theme.footnote).foregroundStyle(Theme.muted)

            ProgressView(value: loan.progressPercent, total: 100).tint(Theme.accent).padding(.top, 6)
            Text("\(loan.paidCount) of \(Int(loan.tenureMonths)) instalments · \(Int(loan.progressPercent))%")
                .font(Theme.footnote).foregroundStyle(Theme.muted)

            HStack(alignment: .top) {
                KStat(label: "EMI", value: Money.rupees(loan.emi), tone: .accent)
                Spacer()
                KStat(label: "Principal", value: Money.rupees(loan.principal))
            }
            .padding(.top, 8)
            HStack(alignment: .top) {
                KStat(label: "Paid so far", value: Money.rupees(loan.totalPaid), tone: .positive)
                Spacer()
                KStat(label: "Still to pay", value: Money.rupees(loan.pendingBalance), tone: .negative)
            }
            .padding(.top, 8)

            if loan.processingFee > 0 || loan.gst > 0 {
                Text("Processing fee \(Money.rupees(loan.processingFee)) · GST \(Money.rupees(loan.gst))")
                    .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 6)
            }

            if !loan.payments.isEmpty {
                DisclosureGroup(isExpanded: Binding(get: { openLoans.contains(loan.id) },
                                                    set: { if $0 { openLoans.insert(loan.id) } else { openLoans.remove(loan.id) } })) {
                    VStack(spacing: 0) {
                        ForEach(loan.payments) { payment in
                            KRow(title: payment.number.isEmpty ? "Payment" : "EMI #\(payment.number)", subtitle: Fmt.date(payment.date),
                                 value: Money.rupees(payment.amount), valueTone: .positive)
                                .padding(.vertical, 8)
                        }
                    }
                    .padding(.top, 4)
                } label: {
                    Text("Payments (\(loan.payments.count))").font(Theme.body).foregroundStyle(.white)
                }
                .tint(Theme.muted)
                .padding(.top, 6)
            }
        }
    }

    // MARK: Calculator

    @ViewBuilder private var calculator: some View {
        let result = EMI.calculate(principal: principal, annualRatePercent: rate, years: years)
        KCard(tint: Theme.accent) {
            KStat(label: "Monthly EMI", value: Money.rupees(result.emi), size: .hero)
            HStack(alignment: .top) {
                KStat(label: "Total interest", value: Money.rupees(result.totalInterest), tone: .negative)
                Spacer()
                KStat(label: "Total payable", value: Money.rupees(result.totalPayment))
            }
            .padding(.top, 8)
            Text("Interest is \(Int(result.interestPercent))% of everything you would pay.").font(Theme.footnote).foregroundStyle(Theme.muted)
        }
        KCard {
            slider("Loan amount", value: $principal, range: 50_000...20_000_000, step: 50_000, text: Money.rupees(principal))
            slider("Interest rate (% a year)", value: $rate, range: 5...20, step: 0.1, text: String(format: "%.1f%%", rate))
            slider("Tenure", value: $years, range: 1...30, step: 1, text: "\(Int(years)) years")
        }
        if !result.schedule.isEmpty {
            KSectionHeader(title: "First two years", detail: "interest · principal · balance")
            KList(items: result.schedule) { row in
                KRow(title: "Month \(row.month)", subtitle: "\(Money.compact(row.interest)) interest · \(Money.compact(row.principal)) principal",
                     value: Money.compact(row.balance), valueCaption: "balance")
            }
        }
    }

    private func slider(_ title: String, value: Binding<Double>, range: ClosedRange<Double>, step: Double, text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack { Text(title).font(Theme.footnote).foregroundStyle(Theme.muted); Spacer(); Text(text).font(Theme.figure).foregroundStyle(.white) }
            Slider(value: value, in: range, step: step).tint(Theme.accent)
        }
        .padding(.vertical, 4)
    }
}
