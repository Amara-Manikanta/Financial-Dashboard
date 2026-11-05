import SwiftUI

/// Financial goals, with progress read live from the accounts each one is linked to.
/// Goals are created and linked on the Mac.
struct GoalsView: View {
    @ObservedObject var store: FinanceStore
    @State private var priority = "all"

    private func inr(_ v: Double) -> String { Money.rupees(v) }

    var body: some View {
        let d = store.data
        let page = GoalsPage.page(goals: d.goalsRaw, savings: d.savingsRaw, lents: d.lentsRaw)
        let shown = page.goals.filter { priority == "all" || $0.priority == priority }
        KScreen(refresh: { await store.load() }) {
            KCard(tint: Theme.accent) {
                KStat(label: "Achieved so far", value: inr(page.totalAchieved), size: .hero)
                Text("of \(inr(page.totalTarget)) across \(page.goals.count) \(page.goals.count == 1 ? "goal" : "goals") · \(Int(page.overallProgress))% overall")
                    .font(Theme.footnote).foregroundStyle(Theme.muted)
                ProgressView(value: min(1, page.overallProgress / 100)).tint(Theme.accent).padding(.top, 6)
            }
            Picker("Priority", selection: $priority) {
                Text("All").tag("all"); Text("High").tag("high"); Text("Medium").tag("medium"); Text("Low").tag("low")
            }.pickerStyle(.segmented)

            if shown.isEmpty { KCard { Text("No goals here.").font(Theme.body).foregroundStyle(Theme.muted) } }
            ForEach(shown) { g in
                KCard(tint: g.status == "overdue" ? Theme.negative : g.status == "completed" ? Theme.positive : nil) {
                    HStack {
                        Text(g.name).font(Theme.body.weight(.bold)).foregroundStyle(.white).lineLimit(2)
                        Spacer()
                        KBadge(text: label(g.status), tone: tone(g.status))
                    }
                    HStack(alignment: .firstTextBaseline) {
                        Text(inr(g.saved)).font(Theme.figure).foregroundStyle(.white)
                        Text("of \(inr(g.target))").font(Theme.footnote).foregroundStyle(Theme.muted)
                        Spacer()
                        Text("\(Int(g.progressPct))%").font(Theme.figure).foregroundStyle(tone(g.status).color)
                    }
                    ProgressView(value: min(1, g.progressPct / 100)).tint(tone(g.status).color)
                    Text(timing(g)).font(Theme.footnote).foregroundStyle(Theme.muted)
                    if g.raw["notes"].truthy { Text(g.raw["notes"].text).font(Theme.footnote).foregroundStyle(Theme.muted) }
                }
                .editable(store, "goals", id: g.id, title: g.name)
            }
        }
        .navigationTitle("Financial Goals")
        .toolbar {
            ToolbarItem(placement: .primaryAction) { NewRecordButton(store: store, collection: "goals", records: store.data.goalsRaw.array) }
        }
        .navigationBarTitleDisplayMode(.large)
    }

    private func label(_ s: String) -> String { ["completed": "Completed", "overdue": "Overdue", "behind": "Behind", "on_track": "On track"][s] ?? s }
    private func tone(_ s: String) -> Tone { ["completed": Tone.positive, "overdue": .negative, "behind": .warning][s] ?? .accent }

    private func timing(_ g: GoalsPage.Goal) -> String {
        guard let days = g.daysLeft else { return "No deadline set" }
        let date = g.raw["deadline"].text
        if days < 0 { return "Deadline \(date) passed \(Int(-days)) days ago" }
        return "Deadline \(date) · \(Int(days)) days left · \(inr(max(0, g.target - g.saved))) to go"
    }
}
