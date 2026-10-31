import SwiftUI

struct MoreView: View {
    @ObservedObject var store: FinanceStore
    let mac: MacEndpoint
    let select: (AppTab) -> Void
    let disconnect: () -> Void

    @Environment(\.openWebPage) private var openWebPage
    @State private var path = NavigationPath()
    @State private var confirmDisconnect = false
    /// `-screen <name>` on the command line opens that screen straight away, for checking one without tapping to it.
    private static let launchScreen: NativeScreen? = {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-screen"), args.indices.contains(i + 1) else { return nil }
        return NativeScreen.allCases.first { String(describing: $0) == args[i + 1] }
    }()

    var body: some View {
        NavigationStack(path: $path) {
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
            .onAppear { if let s = Self.launchScreen, path.isEmpty { path.append(s) } }
            .navigationDestination(for: NativeScreen.self) { NativeDestination(screen: $0, store: store) }
            .confirmationDialog("Disconnect this iPhone from \(mac.name)?", isPresented: $confirmDisconnect, titleVisibility: .visible) {
                Button("Disconnect", role: .destructive, action: disconnect)
            } message: { Text("You'll need a new pairing code from the Mac to connect again.") }
        }
    }

    private func open(_ page: AppPage) {
        switch page.native {
        case let .tab(tab)?: select(tab)
        case let .screen(screen)?: path.append(screen)
        case nil: openWebPage(page)
        }
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
