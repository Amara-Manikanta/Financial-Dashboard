import SwiftUI
import Charts

struct SavingsView: View {
    @ObservedObject var store: FinanceStore
    @Environment(\.openWebPage) private var openWebPage
    @State private var showArchived = false

    private var summary: SavingsPage.Summary { store.savings }

    private struct Slice: Identifiable { let name: String; let value: Double; var id: String { name } }

    /// The biggest holdings by name, the rest gathered, so the donut stays readable.
    private var slices: [Slice] {
        var items = summary.active.filter { $0.value > 0 }.map { Slice(name: $0.title, value: $0.value) }
        if summary.gratuity > 0 { items.append(Slice(name: "Employee gratuity", value: summary.gratuity)) }
        items.sort { $0.value > $1.value }
        let top = Array(items.prefix(7))
        let rest = items.dropFirst(7).reduce(0) { $0 + $1.value }
        return rest > 0 ? top + [Slice(name: "Other", value: rest)] : top
    }

    private static let palette: [Color] = [
        Color(red: 0.55, green: 0.36, blue: 0.96), Color(red: 0.93, green: 0.28, blue: 0.60), Color(red: 0.23, green: 0.51, blue: 0.96),
        Color(red: 0.06, green: 0.73, blue: 0.51), Color(red: 0.96, green: 0.62, blue: 0.04), Color(red: 0.94, green: 0.27, blue: 0.27),
        Color(red: 0.03, green: 0.71, blue: 0.83), Color(red: 0.52, green: 0.80, blue: 0.09),
    ]

    var body: some View {
        KScreen(refresh: { await store.load() }) {
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

            if !slices.isEmpty { allocation }

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
    }

    private struct GratuityLine: Identifiable { let amount: Double; var id: String { "gratuity" } }

    private var allocation: some View {
        VStack(alignment: .leading, spacing: 8) {
            KSectionHeader(title: "Allocation")
            KCard {
                Chart(slices) { slice in
                    SectorMark(angle: .value("Value", slice.value), innerRadius: .ratio(0.62), angularInset: 1.5)
                        .cornerRadius(4)
                        .foregroundStyle(by: .value("Account", slice.name))
                }
                .chartForegroundStyleScale(domain: slices.map(\.name), range: Array(Self.palette.prefix(slices.count)))
                .chartLegend(.hidden)
                .frame(height: 190)
                .padding(.vertical, 4)

                VStack(spacing: 8) {
                    ForEach(Array(slices.enumerated()), id: \.element.id) { index, slice in
                        HStack(spacing: 10) {
                            Circle().fill(Self.palette[index % Self.palette.count]).frame(width: 9, height: 9)
                            Text(slice.name).font(Theme.footnote).foregroundStyle(.white).lineLimit(1)
                            Spacer()
                            Text(String(format: "%.1f%%", slice.value / summary.totalValue * 100))
                                .font(Theme.footnote.monospacedDigit()).foregroundStyle(Theme.muted)
                        }
                    }
                }
                .padding(.top, 6)
            }
        }
    }

    @ViewBuilder private func accountRow(_ account: SavingsPage.Account) -> some View {
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
            Button { openWebPage(AppPage(title: account.title, path: path, icon: "banknote")) } label: { row }.buttonStyle(.plain)
        } else {
            row
        }
    }
}
