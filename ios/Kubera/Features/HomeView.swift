import SwiftUI

struct HomeView: View {
    @ObservedObject var store: FinanceStore
    let select: (AppTab) -> Void

    private var worth: NetWorthSummary { store.netWorth }
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
                    hero
                    composition
                    savingsBreakdown
                    metalsBreakdown
                    yearCard
                    if let loadedAt = store.loadedAt {
                        Text("Updated \(loadedAt.formatted(date: .omitted, time: .shortened)) · pull down to refresh")
                            .font(Theme.footnote).foregroundStyle(Theme.muted).frame(maxWidth: .infinity)
                    }
                }
            }
            .navigationTitle("Kubera")
            .navigationBarTitleDisplayMode(.large)
            .navigationDestination(for: NativeScreen.self) { NativeDestination(screen: $0, store: store) }
        }
    }

    // MARK: Sections

    private var hero: some View {
        KCard(tint: Theme.positive) {
            KStat(label: "Total combined net worth", value: Money.rupees(worth.netWorth), size: .hero)
            if worth.debt > 0 {
                Text("net of \(Money.rupees(worth.debt)) still owed").font(Theme.footnote).foregroundStyle(Theme.muted)
            }
            HStack(alignment: .top) {
                KStat(label: "Growth index", value: worth.growthIndex, tone: Tone.of(worth.growthPercent), size: .large)
                Spacer()
                KStat(label: "Asset health", value: worth.assetHealth, tone: healthTone, size: .large)
            }
            .padding(.top, 10)
        }
    }

    private var healthTone: Tone {
        switch worth.assetHealth {
        case "Excellent", "Good": return .positive
        case "Volatile": return .negative
        default: return .neutral
        }
    }

    private struct Line: Identifiable {
        let title: String
        var subtitle: String? = nil
        let value: Double
        var icon: String? = nil
        var tone: Tone = .neutral
        var opens: AppTab? = nil
        var screen: NativeScreen? = nil
        var id: String { title }
    }

    private var composition: some View {
        VStack(alignment: .leading, spacing: 8) {
            KSectionHeader(title: "What it's made of")
            lines([
                Line(title: "Savings & investments", value: worth.totalSavings, icon: "banknote", screen: .savings),
                Line(title: "Gold, silver & coins", value: worth.totalMetals, icon: "circle.hexagongrid"),
                Line(title: "Assets", value: worth.totalAssets, icon: "car"),
            ] + (worth.debt > 0 ? [Line(title: "Loans owed", value: -worth.debt, icon: "arrow.up.right.circle", tone: .negative, screen: .loans)] : []))
        }
    }

    private var savingsBreakdown: some View {
        VStack(alignment: .leading, spacing: 8) {
            KSectionHeader(title: "Savings & investments", detail: Money.compact(worth.totalSavings))
            lines([
                Line(title: "Fixed deposits", value: worth.fixedDeposits, icon: "lock"),
                Line(title: "Equity stocks", value: worth.stocks, icon: "chart.bar.xaxis", screen: .stocks),
                Line(title: "Mutual funds", value: worth.mutualFunds, icon: "chart.pie"),
                Line(title: "PPF", value: worth.ppf, icon: "building.columns"),
                Line(title: "Retirement (NPS)", value: worth.nps, icon: "figure.walk"),
                Line(title: "Gold bonds (SGB)", value: worth.goldBonds, icon: "seal"),
            ])
        }
    }

    private var metalsBreakdown: some View {
        VStack(alignment: .leading, spacing: 8) {
            KSectionHeader(title: "Gold, silver & coins", detail: Money.compact(worth.totalMetals))
            lines([
                Line(title: "Physical gold", subtitle: String(format: "%.2f g", worth.goldGrams), value: worth.goldValue, icon: "sparkle"),
                Line(title: "Physical silver", subtitle: String(format: "%.2f g", worth.silverGrams), value: worth.silverValue, icon: "circle.dotted"),
            ] + (worth.platinumValue > 0 ? [Line(title: "Physical platinum", subtitle: String(format: "%.2f g", worth.platinumGrams), value: worth.platinumValue, icon: "diamond")] : [])
              + [
                Line(title: "Antique coins", value: worth.antiqueCoinsValue, icon: "centsign.circle"),
                Line(title: "Currencies", value: worth.currenciesValue, icon: "dollarsign.circle"),
            ])
        }
    }

    private func lines(_ items: [Line]) -> some View {
        KList(items: items) { line in
            if let tab = line.opens {
                Button { select(tab) } label: { row(line, chevron: true) }.buttonStyle(.plain)
            } else if let screen = line.screen {
                NavigationLink(value: screen) { row(line, chevron: true) }.buttonStyle(.plain)
            } else {
                row(line, chevron: false)
            }
        }
    }

    private func row(_ line: Line, chevron: Bool) -> some View {
        KRow(title: line.title, subtitle: line.subtitle, value: Money.rupees(line.value), valueTone: line.tone,
             systemImage: line.icon, chevron: chevron)
    }

    @ViewBuilder private var yearCard: some View {
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
    }
}
