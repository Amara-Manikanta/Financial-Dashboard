import Foundation

/// A reminder that dividends usually arrive this month. It is built from history, so it says what
/// has happened in past years, never that a payout is coming: a board declares each one.
enum DividendReminders {
    struct Reminder: Equatable, Identifiable {
        let year: Int
        let month: Int          // 1...12
        let title: String
        let body: String
        var id: String { String(format: "kubera.dividends.%04d-%02d", year, month) }
    }

    static let idPrefix = "kubera.dividends."
    static let lateSuffix = ".late"

    /// Which scheduled dividend reminders a re-plan should delete. A "late" reminder (this month's, sent a minute after the app
    /// noticed 9:00 had passed) is kept while reminders are on: deleting it on the next refresh would cancel it before it fires.
    static func idsToRemove(pending: [String], enabled: Bool) -> [String] {
        pending.filter { $0.hasPrefix(idPrefix) && !(enabled && $0.hasSuffix(lateSuffix)) }
    }

    /// Whether a notification is a dividend reminder, and so should open the Dividend Income page when tapped. Matched on the id
    /// as well as the payload, so a reminder scheduled by an earlier version of the app (which carried no payload) still does.
    static func opensDividends(identifier: String, userInfo: [AnyHashable: Any]) -> Bool {
        (userInfo["screen"] as? String) == "dividends" || identifier.hasPrefix(idPrefix)
    }

    /// One reminder for each of the next `months` months (this one included), for months where
    /// held stocks have historically paid. In the current month, stocks that already have a
    /// dividend recorded this month are left out, and a month with none left gets no reminder.
    static func plan(stocks: [JSONValue], calendar months: [Dividends.CalendarMonth], today: Date, count: Int = 12) -> [Reminder] {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Asia/Kolkata") ?? .current
        let parts = cal.dateComponents([.year, .month], from: today)
        guard let year0 = parts.year, let month0 = parts.month else { return [] }

        let receivedThisMonth: Set<String> = Set(stocks.compactMap { s -> String? in
            let got = s["transactions"].array.contains { t in
                guard t["type"].text == "dividend", let d = JSDate.parse(t["date"]) else { return false }
                let c = cal.dateComponents([.year, .month], from: d)
                return c.year == year0 && c.month == month0
            }
            return got ? s["id"].text : nil
        })

        var out: [Reminder] = []
        for step in 0..<count {
            let index = month0 - 1 + step
            let year = year0 + index / 12, month = index % 12 + 1
            guard let entry = months.first(where: { $0.month == month - 1 }) else { continue }
            var payers = entry.payers.filter { $0.held }
            if step == 0 { payers = payers.filter { !receivedThisMonth.contains($0.id) } }
            guard !payers.isEmpty else { continue }
            let names = payers.map(\.name)
            let list = names.prefix(8).joined(separator: ", ") + (names.count > 8 ? " and \(names.count - 8) more" : "")
            let name = Dividends.monthNames[month - 1]
            out.append(Reminder(year: year, month: month,
                                title: "Dividends usually arrive in \(name)",
                                body: "\(payers.count) of your stocks have paid in \(name) before: \(list). A history, not a promise — check what each board has declared."))
        }
        return out
    }
}
