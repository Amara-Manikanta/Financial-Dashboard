import SwiftUI

/// Cover against the rule-of-thumb need, and every policy. Policies are added here and opened for
/// their premiums, claims and documents; scanning a policy PDF stays on the Mac.
struct InsuranceView: View {
    @ObservedObject var store: FinanceStore
    @State private var tab = InsurancePage.Tab.all
    @State private var showArchived = false
    @State private var sheet: Sheet?
    @State private var message: String?
    private enum Sheet: Identifiable { case profile, policy; var id: Int { self == .profile ? 0 : 1 } }

    private func inr(_ v: Double) -> String { Money.rupees(v) }
    private var today: String { ISO8601DateFormatter().string(from: Date()).prefix(10).description }

    var body: some View {
        let d = store.data
        let profile = InsurancePage.profile(appData: d.appDataRaw, salaryDetails: d.salaryRaw)
        let page = InsurancePage.page(savings: d.savingsRaw, profile: profile, tab: tab, showArchived: showArchived)
        KScreen(refresh: { await store.load() }) {
            if let message { KNotice(message: message) { self.message = nil } }
            HStack(alignment: .top) {
                Text("Based on age \(Int(profile.age)), \(Int(profile.dependents)) dependents, income \(inr(profile.annualIncome)) and liabilities \(inr(profile.liabilities)).")
                    .font(Theme.footnote).foregroundStyle(Theme.muted)
                Spacer()
                Button { sheet = .profile } label: { Label("Edit", systemImage: "pencil").font(Theme.footnote.weight(.bold)) }
            }.padding(.horizontal, 4)

            cover("Term / life cover", have: page.life, need: page.recommendedLife, pct: page.lifePct, gap: page.lifeGap, warn: Theme.negative)
            cover("Health cover", have: page.health, need: page.recommendedHealth, pct: page.healthPct, gap: page.healthGap, warn: Theme.warning)

            KCard {
                KStat(label: "Vehicle cover (IDV)", value: inr(page.bike + page.car), caption: page.vehicles.isEmpty ? nil : page.vehicles.reduce(into: [String]()) { if !$0.contains($1) { $0.append($1) } }.joined(separator: ", "))
                HStack(alignment: .top) {
                    KStat(label: "Annual premiums", value: inr(page.premiums), caption: "across \(page.policies.count) policies")
                    Spacer()
                    KStat(label: "Of income", value: String(format: "%.1f%%", page.premiumToIncomePct), tone: page.premiumToIncomePct > 5 ? .warning : .neutral, caption: "ideal under 5%")
                }.padding(.top, 8)
                if page.home > 0 { KRow(title: "Home cover", value: inr(page.home)) }
            }

            HStack { KSectionHeader(title: "Policies"); Button { sheet = .policy } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) } }
            Picker("Kind", selection: $tab) { ForEach(InsurancePage.Tab.allCases) { Text($0.rawValue).tag($0) } }.pickerStyle(.menu)
            if page.archivedCount > 0 {
                Toggle("Show archived (\(page.archivedCount)) — excluded from the totals", isOn: $showArchived).font(Theme.footnote).tint(Theme.accent)
            }
            if page.shown.isEmpty { KCard { Text("No policies of this kind.").font(Theme.body).foregroundStyle(Theme.muted) } }
            else {
                KList(items: page.shown) { p in
                    let expired = InsurancePage.isExpired(p, today: today)
                    NavigationLink(value: AccountRoute(id: p.id)) {
                    KRow(title: p.name, subtitle: "\(p.details["category"].text.isEmpty ? "General" : p.details["category"].text.capitalized) · \(p.details["vehicleNo"].truthy ? p.details["vehicleNo"].text : p.details["policyNumber"].text)\(p.expiry.isEmpty ? "" : " · to \(p.expiry)")",
                         value: inr(p.cover), valueTone: .neutral, valueCaption: p.isArchived ? "Archived" : expired ? "Expired" : "Active · premium \(inr(p.premium))",
                         captionTone: p.isArchived ? .neutral : expired ? .negative : .positive)
                    }.buttonStyle(.plain).accountMenu(store, p.id, message: $message)
                }
            }
            Text("Rules of thumb only: life cover of 12× annual income plus liabilities, health cover of ₹10 lakh plus ₹3 lakh a dependent. A shortfall is a prompt to look, not a recommendation.")
                .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
        }
        .navigationDestination(for: AccountRoute.self) { AccountDetailView(store: store, route: $0) }
        .sheet(item: $sheet) { s in
            switch s {
            case .profile: InsuranceProfileSheet(store: store, profile: profile)
            case .policy: PolicySheet(store: store, editing: nil)
            }
        }
        .navigationTitle("Insurance Gaps")
        .navigationBarTitleDisplayMode(.large)
    }

    private func cover(_ title: String, have: Double, need: Double, pct: Double, gap: Double, warn: Color) -> some View {
        KCard(tint: gap > 0 ? warn : Theme.positive) {
            KStat(label: title, value: inr(have), caption: "recommended \(inr(need))")
            HStack { Text("Adequacy").font(Theme.footnote).foregroundStyle(Theme.muted); Spacer(); Text("\(Int(pct))%").font(Theme.figure).foregroundStyle(pct >= 80 ? Theme.positive : warn) }
            ProgressView(value: min(1, pct / 100)).tint(pct >= 80 ? Theme.positive : warn)
            if gap > 0 { Text("Shortfall \(inr(gap))").font(Theme.footnote).foregroundStyle(warn) }
        }
    }
}
