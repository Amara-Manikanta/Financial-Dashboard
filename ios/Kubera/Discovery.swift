import Foundation
import Network

/// Finds Macs advertising Kubera on the Wi-Fi (Bonjour `_kubera._tcp`), so
/// nobody has to type an IP address.
@MainActor
final class MacDiscovery: ObservableObject {
    struct Found: Identifiable, Hashable {
        let id: String
        let name: String
        let endpoint: NWEndpoint
    }

    @Published private(set) var found: [Found] = []
    @Published private(set) var searching = false
    private var browser: NWBrowser?

    func start() {
        guard browser == nil else { return }
        let browser = NWBrowser(for: .bonjour(type: "_kubera._tcp", domain: nil), using: .tcp)
        browser.browseResultsChangedHandler = { [weak self] results, _ in
            let items = results.compactMap { result -> Found? in
                guard case let .service(name, _, _, _) = result.endpoint else { return nil }
                return Found(id: name, name: name.replacingOccurrences(of: "Kubera on ", with: ""), endpoint: result.endpoint)
            }
            Task { @MainActor in self?.found = items.sorted { $0.name < $1.name } }
        }
        browser.stateUpdateHandler = { [weak self] state in
            Task { @MainActor in
                switch state {
                case .ready: self?.searching = true
                case .failed, .cancelled: self?.searching = false; self?.browser = nil
                default: break
                }
            }
        }
        browser.start(queue: .main)
        self.browser = browser
    }

    func stop() {
        browser?.cancel()
        browser = nil
        searching = false
    }

    /// Connects once to learn the Mac's IPv4 address and port; a web view needs
    /// a plain host, not a Bonjour service.
    func resolve(_ item: Found) async -> (host: String, port: Int)? {
        await withCheckedContinuation { continuation in
            let parameters = NWParameters.tcp
            (parameters.defaultProtocolStack.internetProtocol as? NWProtocolIP.Options)?.version = .v4
            let connection = NWConnection(to: item.endpoint, using: parameters)
            var finished = false
            let finish: ((host: String, port: Int)?) -> Void = { value in
                guard !finished else { return }
                finished = true
                connection.cancel()
                continuation.resume(returning: value)
            }
            connection.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    if case let .hostPort(host, port)? = connection.currentPath?.remoteEndpoint {
                        let address = "\(host)".split(separator: "%").first.map(String.init) ?? "\(host)"
                        finish((address, Int(port.rawValue)))
                    } else { finish(nil) }
                case .failed, .cancelled: finish(nil)
                default: break
                }
            }
            connection.start(queue: .main)
            DispatchQueue.main.asyncAfter(deadline: .now() + 6) { finish(nil) }
        }
    }
}
