import SwiftUI

/// Screens that are pushed rather than switched to with a tab.
enum NativeScreen: Hashable {
    case savings
    case stocks
    case loans
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
