import Foundation

enum APIError: LocalizedError {
    case unauthorized
    case unreachable
    case server(Int)

    var errorDescription: String? {
        switch self {
        case .unauthorized: return "This iPhone is no longer paired with your Mac."
        case .unreachable: return "Couldn't reach your Mac. Is it on, awake, and on the same Wi-Fi?"
        case let .server(code): return "Your Mac answered with an error (\(code))."
        }
    }
}

/// Reads the Mac's data through the paired gateway. The gateway puts the whole
/// database behind one token, and forwards to the same server the Mac uses —
/// so the write guard, backups and version checks apply to the phone too.
struct API {
    let base: URL
    let token: String

    func get(_ collection: String) async throws -> JSONValue { try await get(path: collection, query: []) }

    /// One new row: `POST api/tx`. Never a whole-collection write — a phone working from a stale
    /// copy must not be able to overwrite what it never loaded. Returns nil on success, otherwise
    /// a sentence saying why nothing was saved.
    func addTransaction(_ body: [String: Any]) async -> String? {
        guard let json = try? JSONSerialization.data(withJSONObject: body) else { return "That transaction could not be encoded." }
        var request = URLRequest(url: ["_api", "api", "tx"].reduce(base) { $0.appendingPathComponent($1) })
        request.httpMethod = "POST"
        request.httpBody = json
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 20
        let (data, response): (Data, URLResponse)
        do { (data, response) = try await URLSession.shared.data(for: request) } catch { return APIError.unreachable.errorDescription }
        guard let http = response as? HTTPURLResponse else { return APIError.unreachable.errorDescription }
        let info = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        switch http.statusCode {
        case 200...299: return nil
        case 401: return APIError.unauthorized.errorDescription
        case 404, 503: return "Your Mac has per-row saving switched off, so nothing was saved. Start it with npm run server (not server:json) and try again."
        case 409: return (info?["reason"] as? String) ?? (info?["error"] as? String) ?? "Your Mac's safety check refused that change, so nothing was saved."
        default: return (info?["reason"] as? String) ?? (info?["error"] as? String) ?? "Your Mac answered with an error (\(http.statusCode)); nothing was saved."
        }
    }

    /// A file the Mac serves (a photo), fetched with the same token as everything else.
    func data(path: String) async throws -> Data {
        let url = path.split(separator: "/").reduce(base.appendingPathComponent("_api")) { $0.appendingPathComponent(String($1)) }
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 30
        let (data, response): (Data, URLResponse)
        do { (data, response) = try await URLSession.shared.data(for: request) } catch { throw APIError.unreachable }
        guard let http = response as? HTTPURLResponse else { throw APIError.unreachable }
        if http.statusCode == 401 { throw APIError.unauthorized }
        guard http.statusCode == 200 else { throw APIError.server(http.statusCode) }
        return data
    }

    /// Any read the Mac serves — a collection, or `api/...` (quotes, fundamentals, index history).
    func get(path: String, query: [URLQueryItem]) async throws -> JSONValue {
        var url = path.split(separator: "/").reduce(base.appendingPathComponent("_api")) { $0.appendingPathComponent(String($1)) }
        if !query.isEmpty, var parts = URLComponents(url: url, resolvingAgainstBaseURL: false) { parts.queryItems = query; url = parts.url ?? url }
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 30
        let data: Data
        let response: URLResponse
        do { (data, response) = try await URLSession.shared.data(for: request) } catch { throw APIError.unreachable }
        guard let http = response as? HTTPURLResponse else { throw APIError.unreachable }
        if http.statusCode == 401 { throw APIError.unauthorized }
        guard http.statusCode == 200 else { throw APIError.server(http.statusCode) }
        // Parsing a few megabytes belongs off the main thread.
        return try await Task.detached(priority: .userInitiated) { try JSONValue.parse(data) }.value
    }
}
