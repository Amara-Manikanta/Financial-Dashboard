import Foundation

/// Every page the Mac app has. A page is either built natively here (it moves
/// the user to its tab) or opened from the Mac in a web view, so the phone has
/// all the features from day one while the native set grows.
///
/// Keep in step with src/components/navSections.js and the routes in App.jsx.
enum AppTab: Hashable { case home, expenses, invest, more }

struct AppPage: Identifiable {
    let title: String
    let path: String
    let icon: String
    var native: AppTab? = nil
    var id: String { path }
}

struct PageGroup: Identifiable {
    let title: String
    let pages: [AppPage]
    var id: String { title }
}

enum Pages {
    static let groups: [PageGroup] = [
        PageGroup(title: "Overview", pages: [
            AppPage(title: "Dashboard & net worth", path: "/", icon: "house"),
            AppPage(title: "Savings", path: "/savings", icon: "banknote"),
            AppPage(title: "Investments (all accounts)", path: "/investments", icon: "chart.line.uptrend.xyaxis"),
            AppPage(title: "Stocks", path: "/savings/stock-market/3", icon: "chart.bar.xaxis", native: .invest),
            AppPage(title: "Loans & Lents", path: "/lents-loans", icon: "arrow.up.right.circle"),
        ]),
        PageGroup(title: "Investing", pages: [
            AppPage(title: "Stock Analyst", path: "/investments/analyst", icon: "sparkles"),
            AppPage(title: "Watchlist", path: "/investments/watchlist", icon: "eye"),
            AppPage(title: "IPO Applications", path: "/investments/ipos", icon: "ticket"),
            AppPage(title: "Returns (XIRR)", path: "/investments/returns", icon: "gauge.with.dots.needle.67percent"),
            AppPage(title: "Capital Gains", path: "/investments/capital-gains", icon: "scalemass"),
            AppPage(title: "Free Holdings", path: "/investments/free-holdings", icon: "gift"),
            AppPage(title: "Dividend Income", path: "/investments/dividend-income", icon: "indianrupeesign.circle"),
            AppPage(title: "Nifty 50 & fund overlap", path: "/investments/nifty50-exposure", icon: "square.stack.3d.up"),
        ]),
        PageGroup(title: "Income", pages: [
            AppPage(title: "Salary", path: "/salary", icon: "briefcase"),
            AppPage(title: "Taxes", path: "/taxes", icon: "doc.text"),
        ]),
        PageGroup(title: "Planning", pages: [
            AppPage(title: "Financial Goals", path: "/goals", icon: "target"),
            AppPage(title: "Insurance Gap Analysis", path: "/insurance-analysis", icon: "shield.checkered"),
            AppPage(title: "DocuSetu — Documents & Claims", path: "/docusetu", icon: "folder.badge.gearshape"),
            AppPage(title: "Cashflow Forecast", path: "/cashflow", icon: "calendar.badge.clock"),
            AppPage(title: "Net Worth Over Time", path: "/net-worth", icon: "chart.xyaxis.line"),
        ]),
        PageGroup(title: "Spending", pages: [
            AppPage(title: "All Expenses", path: "/expenses", icon: "creditcard", native: .expenses),
            AppPage(title: "All Transactions", path: "/all-transactions", icon: "list.bullet.rectangle"),
            AppPage(title: "Money Flow", path: "/money-flow", icon: "arrow.left.arrow.right"),
            AppPage(title: "Spending Analysis", path: "/analytics", icon: "chart.pie"),
            AppPage(title: "Cards", path: "/credit-cards", icon: "creditcard.fill"),
            AppPage(title: "Card Intelligence", path: "/credit-cards/intelligence", icon: "gauge"),
            AppPage(title: "Budget Limits", path: "/category-budgets", icon: "slider.horizontal.3"),
            AppPage(title: "Recurring & Subscriptions", path: "/recurring", icon: "repeat"),
            AppPage(title: "Fuel Analytics", path: "/fuel", icon: "fuelpump"),
            AppPage(title: "Grocery Analytics", path: "/grocery-analytics", icon: "cart"),
            AppPage(title: "Grocery Builder", path: "/grocery-master-list", icon: "list.clipboard"),
            AppPage(title: "Data Health", path: "/data-health", icon: "stethoscope"),
        ]),
        PageGroup(title: "Gold, silver & assets", pages: [
            AppPage(title: "All Metals", path: "/metals", icon: "circle.hexagongrid"),
            AppPage(title: "Ornament Gallery", path: "/metals/gallery", icon: "photo.on.rectangle"),
            AppPage(title: "All Assets", path: "/assets", icon: "car"),
            AppPage(title: "Warranties & Receipts", path: "/warranties", icon: "checkmark.shield"),
        ]),
        PageGroup(title: "Account", pages: [
            AppPage(title: "Profile & settings", path: "/profile", icon: "person.crop.circle"),
        ]),
    ]
}
