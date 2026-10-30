import Foundation
import UIKit

struct MacEndpoint: Codable, Equatable {
    var host: String
    var port: Int
    var name: String

    var baseURL: URL { URL(string: "http://\(host.contains(":") ? "[\(host)]" : host):\(port)")! }
}

enum PairError: LocalizedError {
    case badAddress
    case unreachable
    case refused(String)

    var errorDescription: String? {
        switch self {
        case .badAddress: return "Enter your Mac's address, like 192.168.1.20 or Your-Mac.local."
        case .unreachable: return "Couldn't reach your Mac. Check that it is on, awake, on the same Wi-Fi, and that iPhone connection is switched on in Profile."
        case .refused(let message): return message
        }
    }
}

/// Who this phone is paired with. The Mac's address is not secret and sits in
/// UserDefaults; the token that proves the pairing is in the Keychain.
@MainActor
final class ConnectionStore: ObservableObject {
    static let defaultPort = 5181

    @Published private(set) var mac: MacEndpoint?
    @Published private(set) var token: String?

    var isPaired: Bool { mac != nil && token != nil }

    init() {
        if let data = UserDefaults.standard.data(forKey: "mac"),
           let saved = try? JSONDecoder().decode(MacEndpoint.self, from: data) {
            mac = saved
        }
        token = Keychain.read("token")
    }

    /// "192.168.1.20", "Your-Mac.local" or either with ":port".
    static func parse(_ typed: String) -> (host: String, port: Int)? {
        let text = typed.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "http://", with: "")
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !text.isEmpty else { return nil }
        let parts = text.split(separator: ":", omittingEmptySubsequences: true)
        if parts.count == 2, let port = Int(parts[1]), (1...65535).contains(port) { return (String(parts[0]), port) }
        if parts.count == 1 { return (String(parts[0]), defaultPort) }
        return nil
    }

    func pair(host: String, port: Int, name: String, code: String) async throws {
        var request = URLRequest(url: MacEndpoint(host: host, port: port, name: name).baseURL.appendingPathComponent("pair"))
        request.httpMethod = "POST"
        request.timeoutInterval = 8
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "code": code.filter(\.isNumber),
            "name": UIDevice.current.name,
        ])

        let data: Data
        let response: URLResponse
        do { (data, response) = try await URLSession.shared.data(for: request) } catch { throw PairError.unreachable }

        let body = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        guard let http = response as? HTTPURLResponse else { throw PairError.unreachable }
        guard http.statusCode == 200, let token = body?["token"] as? String else {
            throw PairError.refused((body?["error"] as? String) ?? "The Mac didn't accept that code.")
        }

        guard Keychain.write(token, for: "token") else {
            throw PairError.refused("The Mac accepted the code, but this iPhone couldn't store the pairing securely. Try again.")
        }
        let endpoint = MacEndpoint(host: host, port: port, name: name)
        UserDefaults.standard.set(try? JSONEncoder().encode(endpoint), forKey: "mac")
        self.token = token
        self.mac = endpoint
    }

    /// Forget this Mac. The Mac still lists the phone until it is removed there.
    func forget() {
        Keychain.delete("token")
        UserDefaults.standard.removeObject(forKey: "mac")
        token = nil
        mac = nil
    }
}
