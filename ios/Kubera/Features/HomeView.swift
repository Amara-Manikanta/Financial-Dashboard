import SwiftUI

struct HomeView: View {
    @ObservedObject var store: FinanceStore
    let openMore: () -> Void

    private var currentMonth: Int { Calendar.current.component(.month, from: Date()) - 1 }

    private var thisYear: YearSummary? {
        let current = Calendar.current.component(.year, from: Date())
        return store.years.first { $0.year == current } ?? store.years.first
    }

    var body: some View {
        NavigationStack {
            KScreen(refresh: { await store.load() }) {
                if let message = store.errorMessage { KNotice(message: message) { Task { await store.load() } } }

                if store.loadedAt == nil && store.errorMessage == nil {
                    KCard { HStack { ProgressView().tint(Theme.muted); Text("Loading from your Mac…").font(Theme.footnote).foregroundStyle(Theme.muted) } }
                }

                if store.loadedAt != nil {
                    KCard(tint: Theme.positive) {
                        KStat(label: "Stock portfolio", value: Money.rupees(store.portfolio.value), size: .hero)
                        HStack(spacing: 8) {
                            Text(Fmt.signed(store.portfolio.gain)).foregroundStyle(Tone.of(store.portfolio.gain).color)
                            Text(Fmt.percent(store.portfolio.gainPercent)).foregroundStyle(Tone.of(store.portfolio.gain).color)
                            Spacer()
                            Text("\(store.portfolio.holdings.count) holdings").foregroundStyle(Theme.muted)
                        }
                        .font(Theme.footnote.weight(.semibold))
                        .padding(.top, 6)
                    }

                    if let year = thisYear {
                        KSectionHeader(title: String(year.year), detail: "income · spent · invested")
                        KCard {
                            HStack(alignment: .top) {
                                KStat(label: "Income", value: Money.compact(year.income), tone: .positive, size: .large)
                                Spacer()
                                KStat(label: "Spent", value: Money.compact(year.spent), tone: .negative, size: .large)
                                Spacer()
                                KStat(label: "Invested", value: Money.compact(year.invested), tone: .accent, size: .large)
                            }
                            // The latest month that has actually begun: a payslip or a planned entry
                            // can exist for a month that has not happened yet.
                            if let latest = year.months.last(where: { $0.spent > 0 && $0.index <= currentMonth }) {
                                Divider().overlay(Color.white.opacity(0.06)).padding(.vertical, 10)
                                KRow(title: latest.name, subtitle: "Latest month",
                                     value: Fmt.signed(latest.balance), valueTone: Tone.of(latest.balance), valueCaption: "left after spending & investing")
                            }
                        }
                    }

                    KSectionHeader(title: "More on your Mac")
                    Button(action: openMore) {
                        KCard {
                            KRow(title: "Net worth, savings, loans, tax and more",
                                 subtitle: "Every page is in More — native ones are being added screen by screen.",
                                 systemImage: "square.grid.2x2", chevron: true)
                        }
                    }
                    .buttonStyle(.plain)

                    if let loadedAt = store.loadedAt {
                        Text("Updated \(loadedAt.formatted(date: .omitted, time: .shortened)) · pull down to refresh")
                            .font(Theme.footnote).foregroundStyle(Theme.muted).frame(maxWidth: .infinity)
                    }
                }
            }
            .navigationTitle("Kubera")
            .navigationBarTitleDisplayMode(.large)
        }
    }
}
