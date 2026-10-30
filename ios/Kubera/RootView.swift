import SwiftUI

struct RootView: View {
    @StateObject private var store = ConnectionStore()
    @State private var reloadID = UUID()
    @State private var failure: String?

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            if let mac = store.mac, let token = store.token {
                WebScreen(
                    mac: mac, token: token, reloadID: reloadID,
                    onFailure: { failure = $0 },
                    onUnauthorized: { store.forget() },
                    onUnpair: { store.forget() }
                )
                .ignoresSafeArea()
                .opacity(failure == nil ? 1 : 0)

                if let failure {
                    Unreachable(mac: mac, detail: failure,
                                retry: { self.failure = nil; reloadID = UUID() },
                                change: { self.failure = nil; store.forget() })
                }
            } else {
                PairView(store: store)
            }
        }
    }
}

/// The Mac is asleep, off, or on another network.
private struct Unreachable: View {
    let mac: MacEndpoint
    let detail: String
    let retry: () -> Void
    let change: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "wifi.exclamationmark").font(.system(size: 46)).foregroundStyle(.orange)
            Text("Can't reach \(mac.name)").font(.title2.weight(.heavy))
            Text("Make sure your Mac is on and awake, and that this phone is on the same Wi-Fi.")
                .font(.subheadline).foregroundStyle(Theme.muted).multilineTextAlignment(.center)
            Text(detail).font(.caption).foregroundStyle(Theme.muted.opacity(0.7)).multilineTextAlignment(.center)
            Button(action: retry) {
                Text("Try again").fontWeight(.bold).frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(Theme.accent, in: RoundedRectangle(cornerRadius: 14)).foregroundStyle(.black)
            }
            Button("Connect to a different Mac", action: change).font(.footnote).foregroundStyle(Theme.muted)
        }
        .padding(30)
    }
}
