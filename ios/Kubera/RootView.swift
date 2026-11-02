import SwiftUI

struct RootView: View {
    @StateObject private var connection = ConnectionStore()

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            if let mac = connection.mac, let token = connection.token {
                PairedRoot(mac: mac, token: token, forget: { connection.forget() })
                    .id(token)
            } else {
                PairView(store: connection)
            }
        }
    }
}

/// The app once paired: native tabs over data read from the Mac.
private struct PairedRoot: View {
    let mac: MacEndpoint
    let token: String
    let forget: () -> Void
    private let mirror: LocalMirror
    @Environment(\.scenePhase) private var scenePhase
    @State private var showingSync = false

    @StateObject private var store: FinanceStore
    @State private var tab: AppTab = ProcessInfo.processInfo.arguments.contains("-screen") ? .more : ProcessInfo.processInfo.arguments.contains("-addTransaction") ? .expenses : .home
    @State private var webPage: AppPage?

    init(mac: MacEndpoint, token: String, forget: @escaping () -> Void) {
        self.mac = mac
        self.token = token
        let mirror = LocalMirror(token: token)
        self.mirror = mirror
        let leave = { mirror.wipe(); forget() }
        self.forget = leave
        _store = StateObject(wrappedValue: FinanceStore(api: API(base: mac.baseURL, token: token, mirror: mirror), onUnauthorized: leave))
    }

    var body: some View {
        VStack(spacing: 0) {
            // Above the tabs, not over them, so it never covers a screen's own buttons.
            if store.offline || !store.pending.isEmpty { SyncBanner(store: store) { showingSync = true } }
            tabs
        }
        .background(Theme.background.ignoresSafeArea())
    }

    private var tabs: some View {
        TabView(selection: $tab) {
            HomeView(store: store, select: { tab = $0 })
                .tabItem { Label("Home", systemImage: "house.fill") }.tag(AppTab.home)
            ExpensesView(store: store)
                .tabItem { Label("Expenses", systemImage: "creditcard.fill") }.tag(AppTab.expenses)
            NavigationStack { SavingsView(store: store) }
                .tabItem { Label("Savings", systemImage: "banknote.fill") }.tag(AppTab.savings)
            InvestView(store: store)
                .tabItem { Label("Invest", systemImage: "chart.line.uptrend.xyaxis") }.tag(AppTab.invest)
            MoreView(store: store, mac: mac, select: { tab = $0 }, disconnect: forget)
                .tabItem { Label("More", systemImage: "ellipsis") }.tag(AppTab.more)
        }
        .tint(Theme.accent)
        .sheet(isPresented: $showingSync) { SyncSheet(store: store) }
        // Coming back to the app is the moment to try the Mac: it sends what was changed away and downloads what changed there.
        .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await store.load() } } }
        .environment(\.openWebPage, { webPage = $0 })
        .environment(\.connectionInfo, ConnectionInfo(mac: mac, disconnect: forget))
        .fullScreenCover(item: $webPage) { page in
            WebPageView(mac: mac, token: token, page: page, onUnauthorized: forget)
        }
        .task { await store.load() }
        .onChange(of: store.loadedAt) { _, _ in Task { await DividendNotifier.shared.refresh(store: store) } }
    }
}
