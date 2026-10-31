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
