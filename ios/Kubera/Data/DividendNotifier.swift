import Foundation
import UserNotifications

/// Local notifications for `DividendReminders`. Nothing leaves the phone: they are scheduled on the
/// device from the data it already holds, and replaced every time the data refreshes.
@MainActor
final class DividendNotifier: ObservableObject {
    static let shared = DividendNotifier()
    private let key = "kubera.dividendReminders"

    @Published private(set) var enabled: Bool
    @Published private(set) var denied = false

    private init() { enabled = UserDefaults.standard.bool(forKey: key) }

    /// Turning on asks iOS for permission; refused permission leaves it off and says so.
    func setEnabled(_ on: Bool, store: FinanceStore) async {
        if on {
            let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])) ?? false
            denied = !granted
            enabled = granted
        } else {
            enabled = false; denied = false
        }
        UserDefaults.standard.set(enabled, forKey: key)
        await refresh(store: store)
    }

    /// Replaces every scheduled dividend reminder with a plan built from the latest data.
    func refresh(store: FinanceStore) async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests().map(\.identifier)
        center.removePendingNotificationRequests(withIdentifiers: DividendReminders.idsToRemove(pending: pending, enabled: enabled))
        guard enabled else { return }
        let page = store.dividends
        guard !page.stocks.isEmpty else { return }
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Asia/Kolkata") ?? .current
        for r in DividendReminders.plan(stocks: page.stocks, calendar: page.calendar, today: Date()) {
            // 9:00 on the 1st; this month's, if 9:00 has already passed, goes out in a minute so it is not lost.
            var when = DateComponents(); when.year = r.year; when.month = r.month; when.day = 1; when.hour = 9; when.minute = 0
            var trigger = UNCalendarNotificationTrigger(dateMatching: when, repeats: false)
            var id = r.id
            var late: String?
            if let fire = cal.date(from: when), fire <= Date() {
                let now = cal.dateComponents([.year, .month], from: Date())
                guard now.year == r.year && now.month == r.month else { continue }
                // A late one is sent once per month: not again on every refresh, and not if one is already on its way.
                late = "\(key).sent.\(r.id)"
                guard !UserDefaults.standard.bool(forKey: late!), !pending.contains(r.id + DividendReminders.lateSuffix) else { continue }
                id = r.id + DividendReminders.lateSuffix
                trigger = UNCalendarNotificationTrigger(dateMatching: cal.dateComponents([.year, .month, .day, .hour, .minute], from: Date().addingTimeInterval(60)), repeats: false)
            }
            let content = UNMutableNotificationContent()
            content.title = r.title; content.body = r.body; content.sound = .default
            content.userInfo = ["screen": "dividends"]
            // Only a reminder that was really handed to iOS counts as sent.
            do {
                try await center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
                if let late { UserDefaults.standard.set(true, forKey: late) }
            } catch { continue }
        }
    }
}
