import SwiftUI

struct MoreView: View {
    let mac: MacEndpoint
    let token: String
    let select: (AppTab) -> Void
    let disconnect: () -> Void

    @State private var webPage: AppPage?
    @State private var confirmDisconnect = false

    var body: some View {
        NavigationStack {
            KScreen {
                ForEach(Pages.groups) { group in
                    KSectionHeader(title: group.title)
                    KList(items: group.pages) { page in
                        Button { open(page) } label: {
                            KRow(title: page.title, systemImage: page.icon, chevron: true)
                                .overlay(alignment: .trailing) {
                                    if page.native != nil { KBadge(text: "Native", tone: .positive).padding(.trailing, 22) }
                                }
                        }
                        .buttonStyle(.plain)
                    }
                }

                KSectionHeader(title: "This iPhone")
                KCard {
                    KRow(title: "Connected to \(mac.name)", subtitle: "\(mac.host):\(mac.port)", systemImage: "wifi")
                    Divider().overlay(Color.white.opacity(0.06)).padding(.vertical, 8)
                    Button(role: .destructive) { confirmDisconnect = true } label: {
                        Label("Disconnect from this Mac", systemImage: "xmark.circle").font(Theme.body)
                    }
                }
                Text("Pages without the Native badge open the Mac's own screen inside the app. They work the same, and are being rebuilt natively one at a time.")
                    .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            }
            .navigationTitle("More")
            .fullScreenCover(item: $webPage) { page in
                WebPageView(mac: mac, token: token, page: page, onUnauthorized: disconnect)
            }
            .confirmationDialog("Disconnect this iPhone from \(mac.name)?", isPresented: $confirmDisconnect, titleVisibility: .visible) {
                Button("Disconnect", role: .destructive, action: disconnect)
            } message: { Text("You'll need a new pairing code from the Mac to connect again.") }
        }
    }

    private func open(_ page: AppPage) {
        if let tab = page.native { select(tab) } else { webPage = page }
    }
}

/// A Mac page shown in the app, for the screens not yet built natively.
struct WebPageView: View {
    let mac: MacEndpoint
    let token: String
    let page: AppPage
    let onUnauthorized: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var reloadID = UUID()
    @State private var failure: String?

    var body: some View {
        ZStack(alignment: .top) {
            Theme.background.ignoresSafeArea()
            WebScreen(mac: mac, token: token, path: page.path, reloadID: reloadID,
                      onFailure: { failure = $0 }, onUnauthorized: onUnauthorized, onUnpair: onUnauthorized)
                .ignoresSafeArea()
                .opacity(failure == nil ? 1 : 0)
            if let message = failure {
                VStack(spacing: 14) {
                    Image(systemName: "wifi.exclamationmark").font(.system(size: 40)).foregroundStyle(Theme.warning)
                    Text("Can't reach \(mac.name)").font(.title3.weight(.heavy))
                    Text(message).font(Theme.footnote).foregroundStyle(Theme.muted).multilineTextAlignment(.center)
                    Button("Try again") { failure = nil; reloadID = UUID() }.buttonStyle(.borderedProminent).tint(Theme.accent)
                }
                .padding(30).frame(maxHeight: .infinity)
            }
            HStack {
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark").font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
                        .padding(10).background(.ultraThinMaterial, in: Circle())
                }
                .padding(.trailing, 14).padding(.top, 6)
            }
        }
    }
}
