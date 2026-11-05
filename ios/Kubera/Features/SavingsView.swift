import SwiftUI
import Charts

struct SavingsView: View {
    @ObservedObject var store: FinanceStore
    @Environment(\.openWebPage) private var openWebPage
    @State private var showArchived = false
    @State private var accountMessage: String?
    @State private var addingAccount = false

    private var summary: SavingsPage.Summary { store.savings }

    /// The web page splits the savings valuation (accounts plus gratuity) the same way.
    private var slices: [AllocationSlice] {
        var items = summary.active.map { AllocationSlice(name: $0.title, value: $0.value) }
        if summary.gratuity > 0 { items.append(AllocationSlice(name: "Employee gratuity", value: summary.gratuity)) }
        return AllocationCard.condensed(items)
    }

    var body: some View {
        KScreen(refresh: { await store.load() }) {
            if let accountMessage { KNotice(message: accountMessage) { self.accountMessage = nil } }
            KCard(tint: Theme.accent) {
                KStat(label: "Total savings valuation", value: Money.rupees(summary.totalValue), size: .hero)
                Text("Combined value of all savings accounts & deposits").font(Theme.footnote).foregroundStyle(Theme.muted)
                HStack(alignment: .top) {
                    KStat(label: "Growth / interest", value: Fmt.signed(summary.profitLoss), tone: Tone.of(summary.profitLoss),
                          caption: String(format: "%.2f%% on invested principal", summary.roiPercent))
                    Spacer()
                    KStat(label: "Accounts", value: "\(summary.active.count)")
                }
                .padding(.top, 10)
            }

            AllocationCard(slices: slices)

            KSectionHeader(title: "Accounts & deposits", detail: "\(summary.active.count)")
            KList(items: summary.active.sorted { $0.value > $1.value }) { account in accountRow(account) }

            if summary.gratuity > 0 {
                KList(items: [GratuityLine(amount: summary.gratuity)]) { line in
                    KRow(title: "Employee gratuity", subtitle: "Accrued so far, from your salary records",
                         value: Money.rupees(line.amount), systemImage: "briefcase")
                }
            }

            if !summary.archived.isEmpty {
                Button { withAnimation { showArchived.toggle() } } label: {
                    KSectionHeader(title: showArchived ? "Hide archived" : "Show archived", detail: "\(summary.archived.count)")
                }
                .buttonStyle(.plain)
                if showArchived { KList(items: summary.archived) { account in accountRow(account) } }
            }
        }
        .navigationTitle("Savings")
        .navigationBarTitleDisplayMode(.large)
        .toolbar { ToolbarItem(placement: .primaryAction) { Button { addingAccount = true } label: { Image(systemName: "plus") } } }
        .sheet(isPresented: $addingAccount) { NewAccountSheet(store: store) }
        .navigationDestination(for: AccountRoute.self) { AccountDetailView(store: store, route: $0) }
    }

    private struct GratuityLine: Identifiable { let amount: Double; var id: String { "gratuity" } }

    @ViewBuilder private func accountRow(_ account: SavingsPage.Account) -> some View {
        accountRowBody(account).accountMenu(store, account.id, message: $accountMessage)
    }

    @ViewBuilder private func accountRowBody(_ account: SavingsPage.Account) -> some View {
        let caption: String? = {
            guard account.showsReturn else { return nil }
            return account.earnsInterest
                ? "\(Money.rupees(account.gain)) interest"
                : "\(Fmt.signed(account.gain)) · \(Fmt.percent(account.gainPercent))"
        }()
        let row = KRow(title: account.title, subtitle: account.typeLabel.capitalized, value: Money.rupees(account.value),
                       valueCaption: caption, captionTone: account.showsReturn ? Tone.of(account.gain) : nil,
                       chevron: account.webPath != nil)
        if let path = account.webPath {
            // The account's own screen still comes from the Mac until it is rebuilt here.
            NavigationLink(value: AccountRoute(id: account.id)) { row }.buttonStyle(.plain)
        } else {
            row
        }
    }
}
