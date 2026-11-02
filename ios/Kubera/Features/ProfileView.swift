import SwiftUI

/// This iPhone's connection to the Mac. The Mac's own password, backups, Claude key and the
/// switch that lets phones connect at all stay on the Mac on purpose: a paired phone must not be
/// able to change who else can get in.
struct ProfileView: View {
    @ObservedObject var store: FinanceStore
    @Environment(\.connectionInfo) private var connection
    @State private var confirm = false
    @ObservedObject private var reminders = DividendNotifier.shared

    var body: some View {
        KScreen(refresh: { await store.load() }) {
            KCard(tint: Theme.accent) {
                KStat(label: "Connected to", value: connection.mac?.name ?? "—")
                if let mac = connection.mac { Text("\(mac.host):\(mac.port)").font(.system(.footnote, design: .monospaced)).foregroundStyle(Theme.muted) }
                KRow(title: "Data last loaded", subtitle: store.loadedAt.map { $0.formatted(date: .abbreviated, time: .shortened) } ?? "Not yet",
                     systemImage: "arrow.triangle.2.circlepath")
                if let error = store.errorMessage { Text(error).font(Theme.footnote).foregroundStyle(Theme.negative) }
            }
            Button { Task { await store.load() } } label: {
                Label(store.isLoading ? "Refreshing…" : "Refresh from the Mac", systemImage: "arrow.clockwise").font(Theme.body)
            }.disabled(store.isLoading)

            KSectionHeader(title: "Kept on the Mac")
            KCard {
                Text("Password, backups, the Claude news key and the switch that lets phones connect are managed on the Mac, under Profile → iPhone connection. A paired phone cannot change them.")
                    .font(Theme.footnote).foregroundStyle(Theme.muted)
            }

            KSectionHeader(title: "Reminders")
            KCard {
                Toggle(isOn: Binding(get: { reminders.enabled }, set: { on in Task { await reminders.setEnabled(on, store: store) } })) {
                    Text("Dividend months").font(Theme.body)
                }
                Text("On the 1st of each month, a notification listing the stocks that have paid in that month before. It is built on this phone from history; it does not know a payout has been declared or received.")
                    .font(Theme.footnote).foregroundStyle(Theme.muted)
                if reminders.denied { Text("Notifications are switched off for this app in iOS Settings.").font(Theme.footnote).foregroundStyle(Theme.negative) }
            }

            KSectionHeader(title: "This iPhone")
            KCard {
                Button(role: .destructive) { confirm = true } label: { Label("Disconnect from this Mac", systemImage: "xmark.circle").font(Theme.body) }
                Text("You'll need a new pairing code from the Mac to connect again. The Mac still lists this phone until it is removed there.").font(Theme.footnote).foregroundStyle(Theme.muted)
            }
        }
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.large)
        .confirmationDialog("Disconnect this iPhone?", isPresented: $confirm, titleVisibility: .visible) {
            Button("Disconnect", role: .destructive) { connection.disconnect() }
        }
    }
}
