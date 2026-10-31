import SwiftUI

/// Screens that are pushed rather than switched to with a tab.
enum NativeScreen: Hashable, CaseIterable {
    case savings
    case stocks
    case loans
    case capitalGains
    case watchlist
    case ipos
    case returns
    case dividends
    case freeHoldings
    case overlap
    case analyst
    case salary
    case taxes
    case goals
    case insurance
    case cashflow
    case netWorthHistory
    case recurring
    case spending
    case moneyFlow
    case cards
    case warranties
    case dataHealth
    case assets
    case metals
    case cardIntelligence
    case profile
    case gallery
    case budgets
    case fuel
    case groceries
    case groceryMaster
    case allTransactions
}

/// Any screen can open a page from the Mac that has not been rebuilt natively
/// yet; the app shell presents it full-screen.
private struct OpenWebPageKey: EnvironmentKey {
    static let defaultValue: (AppPage) -> Void = { _ in }
}

/// Who this phone is connected to, and how to disconnect — for the Profile screen only.
struct ConnectionInfo { var mac: MacEndpoint?; var disconnect: () -> Void = {} }
private struct ConnectionInfoKey: EnvironmentKey { static let defaultValue = ConnectionInfo() }

extension EnvironmentValues {
    var connectionInfo: ConnectionInfo {
        get { self[ConnectionInfoKey.self] }
        set { self[ConnectionInfoKey.self] = newValue }
    }
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
        case .freeHoldings: FreeHoldingsView(store: store)
        case .overlap: OverlapView(store: store)
        case .analyst: AnalystView(store: store)
        case .salary: SalaryView(store: store)
        case .taxes: TaxesView(store: store)
        case .goals: GoalsView(store: store)
        case .insurance: InsuranceView(store: store)
        case .cashflow: CashflowView(store: store)
        case .netWorthHistory: NetWorthHistoryView(store: store)
        case .recurring: RecurringView(store: store)
        case .spending: SpendingView(store: store)
        case .moneyFlow: MoneyFlowView(store: store)
        case .cards: CardsView(store: store)
        case .warranties: WarrantiesView(store: store)
        case .dataHealth: DataHealthView(store: store)
        case .assets: AssetsView(store: store)
        case .metals: MetalsView(store: store)
        case .cardIntelligence: CardIntelligenceView(store: store)
        case .profile: ProfileView(store: store)
        case .gallery: GalleryView(store: store)
        case .budgets: BudgetsView(store: store)
        case .fuel: FuelView(store: store)
        case .groceries: GroceriesView(store: store)
        case .groceryMaster: GroceryMasterView(store: store)
        case .allTransactions: AllTransactionsView(store: store)
        }
    }
}
