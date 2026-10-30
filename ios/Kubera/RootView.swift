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

    @StateObject private var store: FinanceStore
    @State private var tab: AppTab = .home

    init(mac: MacEndpoint, token: String, forget: @escaping () -> Void) {
        self.mac = mac
        self.token = token
        self.forget = forget
        _store = StateObject(wrappedValue: FinanceStore(api: API(base: mac.baseURL, token: token), onUnauthorized: forget))
    }

    var body: some View {
        TabView(selection: $tab) {
            HomeView(store: store, select: { tab = $0 })
                .tabItem { Label("Home", systemImage: "house.fill") }.tag(AppTab.home)
            ExpensesView(store: store)
                .tabItem { Label("Expenses", systemImage: "creditcard.fill") }.tag(AppTab.expenses)
            InvestView(store: store)
                .tabItem { Label("Invest", systemImage: "chart.line.uptrend.xyaxis") }.tag(AppTab.invest)
            MoreView(mac: mac, token: token, select: { tab = $0 }, disconnect: forget)
                .tabItem { Label("More", systemImage: "ellipsis") }.tag(AppTab.more)
        }
        .tint(Theme.accent)
        .task { await store.load() }
    }
}
