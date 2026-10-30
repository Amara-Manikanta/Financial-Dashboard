import SwiftUI

/// First run: find the Mac, type the code it shows, done.
struct PairView: View {
    @ObservedObject var store: ConnectionStore
    @StateObject private var discovery = MacDiscovery()

    @State private var address = ""
    @State private var code = ""
    @State private var busy = false
    @State private var message: String?
    @FocusState private var codeFocused: Bool

    private var canConnect: Bool { code.filter(\.isNumber).count == 6 && !address.trimmingCharacters(in: .whitespaces).isEmpty && !busy }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 6) {
                    Image(systemName: "indianrupeesign.circle.fill")
                        .font(.system(size: 44, weight: .semibold))
                        .foregroundStyle(Theme.accent)
                    Text("Connect to your Mac")
                        .font(.system(size: 30, weight: .black, design: .rounded))
                    Text("Your finances stay on your Mac. This app shows them over your home Wi-Fi.")
                        .font(.subheadline)
                        .foregroundStyle(Theme.muted)
                }
                .padding(.top, 36)

                section("1 · Pick your Mac") {
                    if discovery.found.isEmpty {
                        HStack(spacing: 10) {
                            ProgressView().tint(Theme.muted)
                            Text(discovery.searching ? "Looking on your Wi-Fi…" : "Starting search…")
                                .font(.footnote).foregroundStyle(Theme.muted)
                        }
                    } else {
                        ForEach(discovery.found) { item in
                            Button { Task { await choose(item) } } label: {
                                HStack {
                                    Image(systemName: "desktopcomputer")
                                    Text(item.name).fontWeight(.semibold)
                                    Spacer()
                                    if address == label(for: item) { Image(systemName: "checkmark.circle.fill").foregroundStyle(.green) }
                                }
                                .padding(14)
                                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    TextField("Or type its address, e.g. 192.168.1.20", text: $address)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                        .padding(14)
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                }

                section("2 · Enter the code") {
                    TextField("6-digit code", text: $code)
                        .keyboardType(.numberPad)
                        .focused($codeFocused)
                        .font(.system(size: 28, weight: .bold, design: .monospaced))
                        .multilineTextAlignment(.center)
                        .padding(14)
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                        .onChange(of: code) { _, new in code = String(new.filter(\.isNumber).prefix(6)) }
                    Text("On your Mac: Profile → iPhone connection → Show pairing code.")
                        .font(.footnote).foregroundStyle(Theme.muted)
                }

                if let message {
                    Label(message, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }

                Button { Task { await connect() } } label: {
                    HStack {
                        if busy { ProgressView().tint(.white) }
                        Text(busy ? "Connecting…" : "Connect").fontWeight(.bold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .background(canConnect ? Theme.accent : Theme.card, in: RoundedRectangle(cornerRadius: 14))
                    .foregroundStyle(canConnect ? Color.black : Theme.muted)
                }
                .disabled(!canConnect)
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 40)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.background.ignoresSafeArea())
        .onAppear { discovery.start() }
        .onDisappear { discovery.stop() }
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title.uppercased()).font(.caption.weight(.heavy)).foregroundStyle(Theme.muted).tracking(1)
            content()
        }
    }

    private func label(for item: MacDiscovery.Found) -> String { item.name }

    private func choose(_ item: MacDiscovery.Found) async {
        message = nil
        guard let found = await discovery.resolve(item) else {
            message = "Found \(item.name) but couldn't reach it. Try typing its address."
            return
        }
        address = found.port == ConnectionStore.defaultPort ? found.host : "\(found.host):\(found.port)"
        codeFocused = true
    }

    private func connect() async {
        guard let target = ConnectionStore.parse(address) else { message = PairError.badAddress.errorDescription; return }
        busy = true
        message = nil
        defer { busy = false }
        do {
            try await store.pair(host: target.host, port: target.port, name: discovery.found.first?.name ?? target.host, code: code)
        } catch {
            message = error.localizedDescription
        }
    }
}
