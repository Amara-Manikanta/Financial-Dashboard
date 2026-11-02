import Foundation

/// The latest outside-research call per holding, read from the Mac's saved research days
/// (`GET /api/analyst/strategy`). A port of `latestCalls` / `callHistory` in `researchImport.js`.
/// It is a second opinion to read — never an instruction, and nothing here writes.
struct ResearchCall: Equatable {
    let call: String
    let confidence: String
    let date: String
    let reason: String
    let news: String
    let trigger: String
    /// Days between the call's date and `today`.
    let ageDays: Int
    /// Days on which the call changed, newest first, e.g. ("2026-11-05", "BUY").
    let changes: [(date: String, call: String)]

    static func == (a: ResearchCall, b: ResearchCall) -> Bool {
        a.call == b.call && a.date == b.date && a.confidence == b.confidence && a.reason == b.reason
    }

    static func parse(_ body: JSONValue, today: String) -> [String: ResearchCall] {
        let days = body["snapshots"].array.sorted { $0["date"].text < $1["date"].text }
        var latest: [String: (row: JSONValue, date: String)] = [:]
        var history: [String: [(date: String, call: String)]] = [:]
        for day in days {
            let date = day["date"].text
            for row in day["rows"].array {
                let id = row["holdingId"].text
                guard !id.isEmpty else { continue }
                latest[id] = (row, date)
                var h = history[id] ?? []
                if h.last?.call != row["call"].text { h.append((date, row["call"].text)) }
                history[id] = h
            }
        }
        return latest.mapValues { entry in
            ResearchCall(call: entry.row["call"].text, confidence: entry.row["confidence"].text, date: entry.date,
                         reason: entry.row["reason"].text, news: entry.row["news"].text, trigger: entry.row["trigger"].text,
                         ageDays: daysBetween(entry.date, today), changes: [])
        }.reduce(into: [:]) { out, pair in
            let h = history[pair.key] ?? []
            out[pair.key] = ResearchCall(call: pair.value.call, confidence: pair.value.confidence, date: pair.value.date,
                                         reason: pair.value.reason, news: pair.value.news, trigger: pair.value.trigger,
                                         ageDays: pair.value.ageDays, changes: Array(h.reversed().prefix(6)))
        }
    }

    static func daysBetween(_ from: String, _ to: String) -> Int {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        guard let a = f.date(from: String(from.prefix(10))), let b = f.date(from: String(to.prefix(10))) else { return 0 }
        return Int((b.timeIntervalSince(a) / 86400).rounded())
    }
}
