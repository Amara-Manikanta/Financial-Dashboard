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
    /// The phone's own copy of the Mac's data. Reads fall back to it when the Mac is out of reach.
    var mirror: LocalMirror? = nil

    enum Outcome: Equatable { case ok, refused(String), unreachable, unauthorized }
    enum Ping { case online, offline, unpaired }

    /// A quick, unauthenticated look at whether the Mac's gateway answers — three seconds, so being away from
    /// home costs a moment, not the half-minute a normal request would wait.
    func ping() async -> Ping {
        var request = URLRequest(url: base.appendingPathComponent("ping"))
        request.timeoutInterval = 3
        request.cachePolicy = .reloadIgnoringLocalCacheData
        guard let (data, response) = try? await URLSession.shared.data(for: request), (response as? HTTPURLResponse)?.statusCode == 200,
              let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any], o["app"] as? String == "kubera" else { return .offline }
        return o["paired"] as? Bool == false ? .unpaired : .online
    }

    private static func cacheKey(_ path: String, _ query: [URLQueryItem]) -> String {
        path + (query.isEmpty ? "" : "?" + query.map { "\($0.name)=\($0.value ?? "")" }.joined(separator: "&"))
    }

    func get(_ collection: String) async throws -> JSONValue { try await get(path: collection, query: []) }

    /// One-row writes: `POST api/tx`, `PATCH api/tx/<id>`, `DELETE api/tx/<id>`. Never a whole-collection
    /// write — a phone working from a stale copy must not be able to overwrite what it never loaded.
    /// Returns nil on success, otherwise a sentence saying why nothing was changed.
    func writeTransaction(_ method: String, id: String? = nil, body: [String: Any]? = nil) async -> String? {
        switch await writeTransactionOutcome(method, id: id, body: body) {
        case .ok: return nil
        case .refused(let m): return m
        case .unreachable: return APIError.unreachable.errorDescription
        case .unauthorized: return APIError.unauthorized.errorDescription
        }
    }

    func writeTransactionOutcome(_ method: String, id: String? = nil, body: [String: Any]? = nil) async -> Outcome {
        var parts = ["_api", "api", "tx"]
        if let id { parts.append(id) }
        var request = URLRequest(url: parts.reduce(base) { $0.appendingPathComponent($1) })
        request.httpMethod = method
        if let body {
            guard let json = try? JSONSerialization.data(withJSONObject: body) else { return .refused("That change could not be encoded.") }
            request.httpBody = json
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 20
        let (data, response): (Data, URLResponse)
        do { (data, response) = try await URLSession.shared.data(for: request) } catch { return .unreachable }
        guard let http = response as? HTTPURLResponse else { return .unreachable }
        let info = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        switch http.statusCode {
        case 200...299: return .ok
        case 401: return .unauthorized
        case 503: return .refused("Your Mac has per-row saving switched off, so nothing was changed. Start it with npm run server (not server:json) and try again.")
        case 404 where id == nil: return .refused("Your Mac has per-row saving switched off, so nothing was changed. Start it with npm run server (not server:json) and try again.")
        case 404: return .refused("That transaction is no longer on your Mac — refresh and look again. Nothing was changed.")
        default: return .refused((info?["reason"] as? String) ?? (info?["error"] as? String) ?? "Your Mac refused the change (\(http.statusCode)); nothing was changed.")
        }
    }

    func addTransaction(_ body: [String: Any]) async -> String? { await writeTransaction("POST", body: body) }

    /// One record and its version (`X-DB-Version`), which a later save must send back as `If-Match`.
    func record(_ collection: String, id: String) async throws -> (value: JSONValue, version: String?) {
        // Away from the Mac, the phone's copy stands in — with changes already made on the phone — and carries no version.
        if mirror?.offline == true {
            if let cached = mirror?.record(collection, id: id) { return (cached, nil) }
            throw APIError.unreachable
        }
        var request = URLRequest(url: base.appendingPathComponent("_api").appendingPathComponent(collection).appendingPathComponent(id))
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 20
        let (data, response): (Data, URLResponse)
        do { (data, response) = try await URLSession.shared.data(for: request) } catch {
            mirror?.setOffline(true)
            if let cached = mirror?.record(collection, id: id) { return (cached, nil) }
            throw APIError.unreachable
        }
        guard let http = response as? HTTPURLResponse else { throw APIError.unreachable }
        if http.statusCode == 401 { throw APIError.unauthorized }
        guard http.statusCode == 200 else { throw APIError.server(http.statusCode) }
        return (try JSONValue.parse(data), http.value(forHTTPHeaderField: "X-DB-Version"))
    }

    /// Changes only the given fields of one record. Nil when saved, otherwise why nothing changed.
    func patchRecord(_ collection: String, id: String, fields: [String: Any], version: String?) async -> String? {
        switch await patchRecordOutcome(collection, id: id, fields: fields, version: version) {
        case .ok: return nil
        case .refused(let m): return m
        case .unreachable: return APIError.unreachable.errorDescription
        case .unauthorized: return APIError.unauthorized.errorDescription
        }
    }

    func patchRecordOutcome(_ collection: String, id: String, fields: [String: Any], version: String?) async -> Outcome {
        var request = URLRequest(url: base.appendingPathComponent("_api").appendingPathComponent(collection).appendingPathComponent(id))
        request.httpMethod = "PATCH"
        guard let json = try? JSONSerialization.data(withJSONObject: fields) else { return .refused("That change could not be encoded.") }
        request.httpBody = json
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let version { request.setValue(version, forHTTPHeaderField: "If-Match") }
        request.timeoutInterval = 20
        let (data, response): (Data, URLResponse)
        do { (data, response) = try await URLSession.shared.data(for: request) } catch { return .unreachable }
        guard let http = response as? HTTPURLResponse else { return .unreachable }
        let info = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        switch http.statusCode {
        case 200...299: return .ok
        case 401: return .unauthorized
        case 404: return .refused("That record is no longer on your Mac. Nothing was changed.")
        case 409 where info?["currentVersion"] != nil:
            return .refused("This was changed on your Mac since you opened it, so nothing was saved. It has been reloaded — make your change again.")
        default: return .refused((info?["reason"] as? String) ?? (info?["error"] as? String) ?? "Your Mac refused the change (\(http.statusCode)); nothing was changed.")
        }
    }

    /// Any request to the Mac's API, answered with its status and JSON body whatever the status,
    /// so a caller can show the server's own reason. Throws only when the Mac cannot be reached.
    func send(_ method: String, path: String, query: [URLQueryItem] = [], body: Any? = nil, timeout: TimeInterval = 30) async throws -> (status: Int, body: JSONValue) {
        var url = path.split(separator: "/").reduce(base.appendingPathComponent("_api")) { $0.appendingPathComponent(String($1)) }
        if !query.isEmpty, var parts = URLComponents(url: url, resolvingAgainstBaseURL: false) { parts.queryItems = query; url = parts.url ?? url }
        var request = URLRequest(url: url)
        request.httpMethod = method
        if let body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = timeout
        let key = Self.cacheKey(path, query)
        if method == "GET", mirror?.offline == true {
            guard let cached = mirror?.get(key), let json = try? JSONValue.parse(cached) else { throw APIError.unreachable }
            return (200, json)
        }
        let (data, response): (Data, URLResponse)
        do { (data, response) = try await URLSession.shared.data(for: request) } catch {
            if method == "GET" { mirror?.setOffline(true); if let cached = mirror?.get(key), let json = try? JSONValue.parse(cached) { return (200, json) } }
            throw APIError.unreachable
        }
        guard let http = response as? HTTPURLResponse else { throw APIError.unreachable }
        if http.statusCode == 401 { throw APIError.unauthorized }
        if method == "GET", http.statusCode == 200 { mirror?.put(key, data) }
        let json = (try? await Task.detached(priority: .userInitiated) { try JSONValue.parse(data) }.value) ?? .null
        return (http.statusCode, json)
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
        let key = Self.cacheKey(path, query)
        func cached() async throws -> JSONValue {
            guard let c = mirror?.get(key) else { throw APIError.unreachable }
            return try await Task.detached(priority: .userInitiated) { try JSONValue.parse(c) }.value
        }
        if mirror?.offline == true { return try await cached() }
        let data: Data
        let response: URLResponse
        do { (data, response) = try await URLSession.shared.data(for: request) } catch { mirror?.setOffline(true); return try await cached() }
        guard let http = response as? HTTPURLResponse else { throw APIError.unreachable }
        if http.statusCode == 401 { throw APIError.unauthorized }
        guard http.statusCode == 200 else { throw APIError.server(http.statusCode) }
        mirror?.put(key, data)
        // Parsing a few megabytes belongs off the main thread.
        return try await Task.detached(priority: .userInitiated) { try JSONValue.parse(data) }.value
    }
}
