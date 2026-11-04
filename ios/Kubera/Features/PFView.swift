import SwiftUI
import Charts

/// A PF account, laid out as the Mac's PF page is: the combined EPF + EPS value, an EPF / EPS switch with each
/// scheme's totals and yearly chart, financial-year tabs that flag a year with a missing month or no interest,
/// the entries for the chosen scheme, and the yearly contribution trend. Entries are added, changed and deleted
/// through the same version-checked, offline-capable ledger writes as every other account.
struct PFView: View {
    @ObservedObject var store: FinanceStore
    let accountId: String

    @State private var scheme: PF.Scheme = .epf
    @State private var year = "All"
    @State private var sheet: SheetRoute?
    @State private var deleting: PF.Entry?
    @State private var message: String?
    @State private var shown = 20

    private struct SheetRoute: Identifiable { let id = UUID(); let entry: PF.Entry? }

    private var account: JSONValue { store.data.savingsRaw.array.first { $0["id"].text == accountId } ?? .null }
    private var spec: AccountLedger.ListSpec { AccountLedger.lists(for: "pf")[0] }

    private let indigo = Color(red: 0.51, green: 0.55, blue: 0.97)
    private let blue = Color(red: 0.38, green: 0.65, blue: 0.98)
    private let pink = Color(red: 0.96, green: 0.45, blue: 0.71)
    private let teal = Color(red: 0.18, green: 0.83, blue: 0.75)
    private let green = Color(red: 0.2, green: 0.83, blue: 0.6)
    private let amber = Color(red: 0.98, green: 0.75, blue: 0.14)
    private let orange = Color(red: 0.98, green: 0.45, blue: 0.09)
    private let violet = Color(red: 0.75, green: 0.52, blue: 0.99)

    var body: some View {
        let raw = account
        let page = PF.page(raw)
        let title = [raw["title"], raw["name"]].first { $0.truthy }?.text ?? "PF"
        let uan = [raw["uan"], raw["uanNumber"], raw["accountNumber"]].first { $0.truthy }?.text ?? ""
        let selected = page.years.contains(year) ? year : "All"
        let entries = PF.entries(raw, scheme: scheme, year: selected)

        KScreen(refresh: { await store.load() }) {
            if let message { KNotice(message: message) { self.message = nil } }
            VStack(alignment: .leading, spacing: 4) {
                Text("Opening balance \(Money.rupees(page.totals.openingBalance))" + (raw["date"].truthy ? "  |  Started \(Fmt.date(raw["date"].text))" : ""))
                    .font(Theme.footnote).foregroundStyle(Theme.muted)
                HStack(spacing: 8) {
                    KBadge(text: "UAN")
                    if uan.isEmpty { Text("Not specified — tap the pencil to add").font(Theme.footnote).italic().foregroundStyle(Theme.muted) }
                    else { Text(uan).font(.system(.callout, design: .monospaced).weight(.bold)).foregroundStyle(.white) }
                }
            }
            .padding(.horizontal, 4)

            KCard(tint: indigo) {
                HStack {
                    Text("Combined PF value (EPF + EPS)").font(Theme.footnote).foregroundStyle(Theme.muted)
                    Spacer()
                    Text(Money.rupees(page.totals.combined)).font(Theme.figure).foregroundStyle(indigo)
                }
            }

            Picker("Scheme", selection: $scheme) {
                Text("EPF").tag(PF.Scheme.epf)
                Text("EPS").tag(PF.Scheme.eps)
            }
            .pickerStyle(.segmented)
            .onChange(of: scheme) { _, _ in shown = 20 }

            stats(page.totals)
            chart(page)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) { ForEach(page.years, id: \.self) { chip($0, on: selected == $0, warns: $0 != "All" && (page.status[$0]?.warns ?? false)) } }
            }
            if selected != "All", let s = page.status[selected], s.warns { statusNote(selected, s) }

            HStack {
                KSectionHeader(title: scheme == .epf ? "EPF transactions" : "EPS contributions", detail: "\(entries.count)")
                Button { sheet = SheetRoute(entry: nil) } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) }
            }
            if entries.isEmpty {
                KCard { Text("No transactions identified for the selected interval.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            } else {
                KList(items: Array(entries.prefix(shown))) { e in
                    let lock = AccountLedger.rowLock(e.raw, type: "pf")
                    Button { if lock == nil { sheet = SheetRoute(entry: e) } } label: { row(e, lock: lock) }
                        .buttonStyle(.plain)
                        .contextMenu { if lock == nil { Button(role: .destructive) { deleting = e } label: { Label("Delete", systemImage: "trash") } } }
                }
                if entries.count > shown { Button("Show 20 more") { shown += 20 }.font(Theme.footnote.weight(.bold)) }
                Text("Tap an entry to change it; long-press to delete. The running EPF and EPS balances are recalculated from every entry in date order.")
                    .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            }

            trend(page)
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
        .toolbar { EditRecordButton(store: store, collection: "savings", id: accountId, title: title) }
        .sheet(item: $sheet) { r in
            LedgerRowSheet(store: store, accountId: accountId, type: "pf", spec: spec, parentIndex: nil, index: r.entry?.index, editing: r.entry?.raw)
        }
        .confirmationDialog("Delete this transaction?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let d = deleting {
                    Task { message = await store.saveAccount(accountId, .ledger(specId: spec.id, parentIndex: nil, .delete(index: d.index, expected: d.raw)), label: "Delete PF entry") }
                }
            }
        }
    }

    // MARK: Totals

    @ViewBuilder private func stats(_ t: PF.Totals) -> some View {
        let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
        LazyVGrid(columns: columns, spacing: 12) {
            if scheme == .epf {
                stat("Total EPF balance", t.epfBalance, indigo, white: true)
                stat("Employee contribution", t.employee, blue)
                stat("Voluntary PF (VPF)", t.vpf, pink)
                stat("Employer EPF contribution", t.employer, teal)
                stat("Total EPF interest", t.epfInterest, green)
            } else {
                stat("Total EPS balance", t.epsBalance, amber, white: true)
                stat("Total EPS contributions", t.eps, orange)
            }
        }
    }

    private func stat(_ label: String, _ value: Double, _ tint: Color, white: Bool = false) -> some View {
        KCard(tint: tint) {
            VStack(alignment: .leading, spacing: 4) {
                Text(label.uppercased()).font(Theme.caption).tracking(0.8).foregroundStyle(tint).lineLimit(2).fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                Text(Money.rupees(value)).font(.system(size: 20, weight: .heavy, design: .rounded).monospacedDigit()).foregroundStyle(white ? Color.white : tint).minimumScaleFactor(0.7).lineLimit(1)
            }
            .frame(maxWidth: .infinity, minHeight: 78, alignment: .topLeading)
        }
    }

    // MARK: Charts

    @ViewBuilder private func chart(_ page: PF.Page) -> some View {
        KSectionHeader(title: scheme == .epf ? "EPF interest earned by year" : "EPS contributions by year", detail: scheme == .epf ? "employee vs employer" : nil)
        KCard {
            if scheme == .epf {
                if page.epfChart.isEmpty { empty("No EPF interest recorded yet") } else {
                    Chart {
                        ForEach(page.epfChart) { y in
                            BarMark(x: .value("Year", y.year), y: .value("Interest", y.employee)).foregroundStyle(by: .value("Who", "Employee")).position(by: .value("Who", "Employee"))
                            BarMark(x: .value("Year", y.year), y: .value("Interest", y.employer)).foregroundStyle(by: .value("Who", "Employer")).position(by: .value("Who", "Employer"))
                        }
                    }
                    .chartForegroundStyleScale(["Employee": green, "Employer": blue])
                    .chartYAxis { AxisMarks(position: .leading) { AxisGridLine().foregroundStyle(Theme.muted.opacity(0.15)); AxisValueLabel().foregroundStyle(Theme.muted) } }
                    .chartXAxis { AxisMarks { AxisValueLabel(orientation: .vertical).foregroundStyle(Theme.muted) } }
                    .chartLegend(position: .bottom)
                    .frame(height: 220)
                }
            } else if page.epsChart.isEmpty { empty("No EPS contribution recorded yet") } else {
                Chart(page.epsChart) { y in
                    BarMark(x: .value("Year", y.year), y: .value("EPS", y.amount)).foregroundStyle(amber)
                        .annotation(position: .top) { Text(Money.compact(y.amount)).font(.system(size: 9, weight: .semibold)).foregroundStyle(Theme.muted) }
                }
                .chartYAxis { AxisMarks(position: .leading) { AxisGridLine().foregroundStyle(Theme.muted.opacity(0.15)); AxisValueLabel().foregroundStyle(Theme.muted) } }
                .chartXAxis { AxisMarks { AxisValueLabel(orientation: .vertical).foregroundStyle(Theme.muted) } }
                .frame(height: 220)
            }
        }
    }

    @ViewBuilder private func trend(_ page: PF.Page) -> some View {
        KSectionHeader(title: "Yearly contribution trend", detail: "employee vs employer")
        KCard {
            if page.trend.isEmpty { empty("No contribution records yet") } else {
                Chart {
                    ForEach(page.trend) { y in
                        series("Employee (me)", y.year, y.employee)
                        series("Employer EPF", y.year, y.employer)
                        if page.totals.vpf > 0 { series("Employee VPF", y.year, y.vpf) }
                        series("Employer EPS", y.year, y.eps)
                        series("Total for the year", y.year, y.total)
                    }
                }
                .chartForegroundStyleScale(["Employee (me)": blue, "Employer EPF": teal, "Employee VPF": pink, "Employer EPS": amber, "Total for the year": violet])
                .chartYAxis { AxisMarks(position: .leading) { AxisGridLine().foregroundStyle(Theme.muted.opacity(0.15)); AxisValueLabel().foregroundStyle(Theme.muted) } }
                .chartXAxis { AxisMarks { AxisValueLabel(orientation: .vertical).foregroundStyle(Theme.muted) } }
                .chartLegend(position: .bottom, alignment: .leading)
                .frame(height: 260)
            }
        }
    }

    @ChartContentBuilder private func series(_ name: String, _ year: String, _ value: Double) -> some ChartContent {
        LineMark(x: .value("Year", year), y: .value("Amount", value), series: .value("Series", name)).foregroundStyle(by: .value("Series", name)).interpolationMethod(.monotone)
        PointMark(x: .value("Year", year), y: .value("Amount", value)).foregroundStyle(by: .value("Series", name)).symbolSize(20)
    }

    private func empty(_ text: String) -> some View {
        Text(text.uppercased()).font(Theme.caption).tracking(0.8).foregroundStyle(Theme.muted).frame(maxWidth: .infinity, minHeight: 90)
    }

    // MARK: Years and rows

    private func chip(_ title: String, on: Bool, warns: Bool) -> some View {
        Button { year = title; shown = 20 } label: {
            HStack(spacing: 5) {
                Text(title == "All" ? "All" : "FY \(title)").font(Theme.footnote.weight(.semibold))
                if warns { Circle().fill(Theme.negative).frame(width: 6, height: 6) }
            }
            .padding(.horizontal, 12).padding(.vertical, 6)
            .background((on ? Theme.accent : Color.white).opacity(on ? 0.25 : 0.07), in: Capsule())
            .foregroundStyle(on ? Theme.accent : Theme.muted)
        }
        .buttonStyle(.plain)
    }

    private func statusNote(_ fy: String, _ s: PF.YearStatus) -> some View {
        var parts: [String] = []
        if s.missingCount > 0 { parts.append("No contribution recorded for \(s.missingMonths.joined(separator: ", ")).") }
        if !s.hasInterest { parts.append("No interest recorded yet\(s.ongoing ? " (the year is still running)" : "").") }
        return KNotice(message: "FY \(fy): " + parts.joined(separator: " ")) { }
    }

    private func row(_ e: PF.Entry, lock: String?) -> some View {
        let r = e.raw
        func n(_ k: String) -> Double { r[k].double }
        let sub: String? = {
            guard scheme == .epf else { return nil }
            if !e.isInterest, n("employeeContribution") > 0 || n("employerContribution") > 0 {
                return "Emp EPF \(Money.rupees(n("employeeContribution"))) · Employer EPF \(Money.rupees(n("employerContribution")))"
            }
            if e.isInterest, n("employeeInterestEarned") > 0 || n("employerInterestEarned") > 0 {
                return "Emp int \(Money.rupees(n("employeeInterestEarned"))) · Employer int \(Money.rupees(n("employerInterestEarned")))"
            }
            if e.isInterest { return "Interest \(Money.rupees(n("interestEarned")))" }
            return nil
        }()
        return HStack(alignment: .firstTextBaseline, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(Fmt.date(e.date)).font(Theme.body).foregroundStyle(.white)
                KBadge(text: scheme == .eps ? "EPS contribution" : e.isInterest ? "Interest" : "Contribution", tone: scheme == .eps ? .warning : e.isInterest ? .positive : .accent)
                if let sub { Text(sub).font(Theme.footnote).foregroundStyle(Theme.muted) }
                if scheme == .epf, !e.isInterest, n("vpfContribution") > 0 { Text("VPF \(Money.rupees(n("vpfContribution")))").font(Theme.footnote).foregroundStyle(pink) }
                if let lock { Text(lock).font(Theme.footnote).foregroundStyle(Theme.muted).lineLimit(2) }
            }
            Spacer()
            Text(e.isInterest ? "+\(Money.rupees(e.amount))" : Money.rupees(e.amount)).font(Theme.figure).foregroundStyle(e.isInterest ? green : scheme == .eps ? amber : .white)
        }
    }
}
