import Foundation
import UserNotifications

/// A screen the app has been asked to open from outside it — today, a tapped notification. Whoever shows
/// screens takes it with `consume()`; if the app was not running, the request waits here until they do.
@MainActor
final class DeepLink: ObservableObject {
    static let shared = DeepLink()
    @Published private(set) var screen: NativeScreen?
    private var requestedAt = Date.distantPast
    /// A request that nobody opened this long ago is dropped: a tap made while the phone was not paired must not open a page days later.
    private static let lifetime: TimeInterval = 120

    func request(_ screen: NativeScreen) { requestedAt = Date(); self.screen = screen }

    /// Whether there is a request still worth honouring.
    var isFresh: Bool { screen != nil && Date().timeIntervalSince(requestedAt) <= Self.lifetime }

    func consume() -> NativeScreen? {
        defer { screen = nil }
        return isFresh ? screen : nil
    }
}

/// Turns a tapped notification into a `DeepLink`, and lets notifications show while the app is open.
final class NotificationRouter: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationRouter()

    /// Set before the app finishes launching, so a tap that starts the app is not lost.
    func install() { UNUserNotificationCenter.current().delegate = self }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let n = response.notification.request
        guard DividendReminders.opensDividends(identifier: n.identifier, userInfo: n.content.userInfo) else { return }
        await MainActor.run { DeepLink.shared.request(.dividends) }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}
