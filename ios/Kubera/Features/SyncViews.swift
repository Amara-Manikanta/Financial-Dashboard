import SwiftUI

private func ago(_ date: Date?) -> String {
    guard let date else { return "never" }
    let f = RelativeDateTimeFormatter(); f.unitsStyle = .full
    return f.localizedString(for: date, relativeTo: Date())
}

/// A thin strip at the top of every screen while the Mac is out of reach or changes are waiting to be sent.
struct SyncBanner: View {
    @ObservedObject var store: FinanceStore
    let open: () -> Void

    var body: some View {
        let waiting = store.pending.filter { $0.state == .pending }.count
        let held = store.pending.filter { $0.state == .conflict }.count
        Button(action: open) {
            HStack(spacing: 8) {
                Image(systemName: held > 0 ? "exclamationmark.triangle.fill" : store.offline ? "icloud.slash" : "arrow.triangle.2.circlepath")
                Text(text(waiting: waiting, held: held)).lineLimit(1)
                Spacer(minLength: 4)
                if store.isSyncing || store.isLoading { ProgressView().controlSize(.mini) } else { Image(systemName: "chevron.right").font(.system(size: 10, weight: .bold)) }
            }
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(held > 0 ? Tone.warning.color : .white.opacity(0.9))
            .padding(.horizontal, 14).padding(.vertical, 7)
            .frame(maxWidth: .infinity)
            .background(Color.white.opacity(0.08))
        }
        .buttonStyle(.plain)
    }

    private func text(waiting: Int, held: Int) -> String {
        var parts: [String] = []
        if store.offline { parts.append("Offline · data from \(ago(store.syncedAt))") }
        if waiting > 0 { parts.append("\(waiting) change\(waiting == 1 ? "" : "s") waiting to sync") }
        if held > 0 { parts.append("\(held) need\(held == 1 ? "s" : "") a look") }
        return parts.joined(separator: " · ")
    }
}

/// What is waiting to be sent, what could not be, and a way to try the Mac now.
struct SyncSheet: View {
    @ObservedObject var store: FinanceStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack { Image(systemName: store.offline ? "icloud.slash" : "checkmark.icloud"); Text(store.offline ? "Your Mac is out of reach" : "Connected to your Mac") }
                    LabeledContent("Data on this phone from", value: ago(store.syncedAt))
                    Button { Task { await store.load() } } label: {
                        HStack { Text("Sync now"); Spacer(); if store.isLoading { ProgressView() } }
                    }
                    .disabled(store.isLoading)
                } footer: {
                    Text("Everything works without your Mac. Changes are kept on this phone and sent when you are on your home Wi-Fi with the Mac awake and running the server.")
                }
                let waiting = store.pending.filter { $0.state == .pending }
                if !waiting.isEmpty {
                    Section("Waiting to be sent") {
                        ForEach(waiting) { op in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(op.label)
                                Text(op.created.formatted(date: .abbreviated, time: .shortened)).font(.footnote).foregroundStyle(.secondary)
                            }
                            .swipeActions { Button("Discard", role: .destructive) { Task { await store.discard(op.id) } } }
                        }
                    }
                }
                let held = store.pending.filter { $0.state == .conflict }
                if !held.isEmpty {
                    Section {
                        ForEach(held) { op in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(op.label).font(.headline)
                                Text(op.message ?? "This change could not be made.").font(.footnote).foregroundStyle(Tone.warning.color)
                                HStack {
                                    Button("Try again") { Task { await store.retry(op.id) } }
                                    Spacer()
                                    Button("Discard", role: .destructive) { Task { await store.discard(op.id) } }
                                }
                                .buttonStyle(.bordered).font(.footnote)
                            }
                            .padding(.vertical, 2)
                        }
                    } header: { Text("Needs a look") } footer: {
                        Text("These were not applied, so your Mac's records were left as they are. Discarding one shows the Mac's own version again.")
                    }
                }
            }
            .navigationTitle("Sync")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
