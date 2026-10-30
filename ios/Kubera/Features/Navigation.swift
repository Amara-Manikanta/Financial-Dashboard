import SwiftUI

/// Screens that are pushed rather than switched to with a tab.
enum NativeScreen: Hashable {
    case savings
    case stocks
    case loans
    case capitalGains
    case watchlist
    case ipos
    case returns
    case dividends
}

/// Any screen can open a page from the Mac that has not been rebuilt natively
/// yet; the app shell presents it full-screen.
private struct OpenWebPageKey: EnvironmentKey {
    static let defaultValue: (AppPage) -> Void = { _ in }
}

extension EnvironmentValues {
    var openWebPage: (AppPage) -> Void {
        get { self[OpenWebPageKey.self] }
        set { self[OpenWebPageKey.self] = newValue }
    }
}

/// The one place that knows which view each pushed screen is, so a new screen is
/// added here and in `Pages.swift` and nowhere else.
struct NativeDestination: View {
    let screen: NativeScreen
    @ObservedObject var store: FinanceStore

    var body: some View {
        switch screen {
        case .savings: SavingsView(store: store)
        case .stocks: StocksView(store: store)
        case .loans: LoansView(store: store)
        case .capitalGains: CapitalGainsView(store: store)
        case .watchlist: WatchlistView(store: store)
        case .ipos: IpoView(store: store)
        case .returns: ReturnsView(store: store)
        case .dividends: DividendsView(store: store)
        }
    }
}
