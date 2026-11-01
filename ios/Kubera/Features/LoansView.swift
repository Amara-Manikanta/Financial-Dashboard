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
    @State private var paymentSheet: PaymentSheet?
    @State private var lentSheet: LentQuickAdd?
    @State private var deletingPayment: (loanId: String, paymentId: String, name: String)?
    @State private var message: String?

    private struct PaymentSheet: Identifiable { let id = UUID(); let loanId: String; let row: JSONValue? }
    private struct LentQuickAdd: Identifiable { let id = UUID(); let lentId: String; let name: String; let isLent: Bool }

    // The calculator starts where the web one does.
    @State private var principal = 3_000_000.0
    @State private var rate = 8.5
    @State private var years = 20.0

    var body: some View {
        KScreen(refresh: { await store.load() }) {
            if let message { KNotice(message: message) { self.message = nil } }
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
        .navigationDestination(for: LentRoute.self) { LentDetailView(store: store, route: $0) }
        .sheet(item: $paymentSheet) { p in
            if let loan = store.data.loansRaw.array.first(where: { $0["id"].text == p.loanId }) { LoanPaymentSheet(store: store, loan: loan, editing: p.row) }
        }
        .sheet(item: $lentSheet) { l in LentTransactionSheet(store: store, lentId: l.lentId, name: l.name, isLent: l.isLent, editing: nil) }
        .confirmationDialog("Delete this payment?", isPresented: Binding(get: { deletingPayment != nil }, set: { if !$0 { deletingPayment = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let d = deletingPayment { Task { message = await store.saveListRow(collection: "loans", id: d.loanId, key: "payments", .delete(id: d.paymentId), label: "Delete EMI payment · \(d.name)") } }
            }
        }
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
                NavigationLink(value: LentRoute(id: debt.id)) {
                    KRow(title: debt.name, subtitle: debt.detail.isEmpty ? (debt.isLent ? "Lent" : "Borrowed") : debt.detail,
                         value: Money.rupees(debt.outstanding), valueTone: debt.isLent ? .positive : .negative,
                         valueCaption: debt.isLent ? "owed to you" : "you owe", chevron: true)
                }
                .buttonStyle(.plain)
                .contextMenu { Button { lentSheet = LentQuickAdd(lentId: debt.id, name: debt.name, isLent: debt.isLent) } label: { Label("Add transaction", systemImage: "plus.circle") } }
            }
            Text("Open a person to see and change their history, or long-press a row to add a transaction.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
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
        ForEach(page.loans) { loan in loanCard(loan).editable(store, "loans", id: loan.id, title: loan.name) }
        Text("Tap Record EMI payment on a loan to add a payment. Open Payments to change or delete one.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
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

            Button { paymentSheet = PaymentSheet(loanId: loan.id, row: nil) } label: {
                Label("Record EMI payment", systemImage: "plus.circle.fill").font(Theme.footnote.weight(.semibold)).frame(maxWidth: .infinity).padding(.vertical, 9)
                    .background(Theme.accent.opacity(0.15), in: RoundedRectangle(cornerRadius: 10, style: .continuous)).foregroundStyle(Theme.accent)
            }
            .buttonStyle(.plain)
            .padding(.top, 8)

            if !loan.payments.isEmpty {
                DisclosureGroup(isExpanded: Binding(get: { openLoans.contains(loan.id) },
                                                    set: { if $0 { openLoans.insert(loan.id) } else { openLoans.remove(loan.id) } })) {
                    VStack(spacing: 0) {
                        ForEach(loan.payments) { payment in
                            let raw = store.data.loansRaw.array.first { $0["id"].text == loan.id }?["payments"].array.first { $0["id"].text == payment.id }
                            Button { if let raw { paymentSheet = PaymentSheet(loanId: loan.id, row: raw) } } label: {
                                KRow(title: payment.number.isEmpty ? "Payment" : "EMI #\(payment.number)", subtitle: Fmt.date(payment.date),
                                     value: Money.rupees(payment.amount), valueTone: .positive)
                                    .padding(.vertical, 8)
                            }
                            .buttonStyle(.plain)
                            .contextMenu { Button(role: .destructive) { deletingPayment = (loan.id, payment.id, loan.name) } label: { Label("Delete", systemImage: "trash") } }
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
