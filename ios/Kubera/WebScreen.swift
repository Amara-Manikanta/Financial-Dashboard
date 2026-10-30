import SwiftUI
import WebKit

/// The Kubera UI, served by the Mac, shown full-screen.
///
/// The page is the same React app the Mac runs, so every feature is here and a
/// fix on one is a fix on both. The pairing token goes in as a cookie so each
/// request the page makes carries it; nothing else is stored on the phone.
struct WebScreen: UIViewRepresentable {
    let mac: MacEndpoint
    let token: String
    let reloadID: UUID
    let onFailure: (String) -> Void
    let onUnauthorized: () -> Void
    let onUnpair: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true

        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "native")
        // Tells the page it is inside the app, so it can drop browser-only chrome.
        controller.addUserScript(WKUserScript(
            source: "window.__KUBERA_NATIVE__ = true; document.documentElement.classList.add('native-ios');",
            injectionTime: .atDocumentStart, forMainFrameOnly: true))
        configuration.userContentController = controller

        let web = WKWebView(frame: .zero, configuration: configuration)
        web.isOpaque = false
        web.backgroundColor = Theme.uiBackground
        web.scrollView.backgroundColor = Theme.uiBackground
        // The page pads itself with env(safe-area-inset-*), so iOS must not also inset.
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsBackForwardNavigationGestures = true
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        #if DEBUG
        web.isInspectable = true
        #endif

        let refresh = UIRefreshControl()
        refresh.tintColor = .lightGray
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.refresh(_:)), for: .valueChanged)
        web.scrollView.refreshControl = refresh

        context.coordinator.web = web
        context.coordinator.load()
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {
        context.coordinator.parent = self
        if context.coordinator.loadedID != reloadID { context.coordinator.load() }
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, WKDownloadDelegate {
        var parent: WebScreen
        weak var web: WKWebView?
        var loadedID: UUID?
        private var downloadURL: URL?

        init(_ parent: WebScreen) { self.parent = parent }

        func load() {
            guard let web else { return }
            loadedID = parent.reloadID
            let mac = parent.mac
            let properties: [HTTPCookiePropertyKey: Any] = [
                .domain: mac.host, .path: "/", .name: "kubera_token", .value: parent.token,
                .expires: Date(timeIntervalSinceNow: 31_536_000),
            ]
            var request = URLRequest(url: mac.baseURL)
            request.setValue("Bearer \(parent.token)", forHTTPHeaderField: "Authorization")
            guard let cookie = HTTPCookie(properties: properties) else { web.load(request); return }
            web.configuration.websiteDataStore.httpCookieStore.setCookie(cookie) { web.load(request) }
        }

        @objc func refresh(_ sender: UIRefreshControl) {
            web?.reload()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { sender.endRefreshing() }
        }

        // MARK: Navigation

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
            guard let url = action.request.url else { return .cancel }
            if url.host == parent.mac.host || url.scheme == "about" || url.scheme == "blob" || url.scheme == "data" { return .allow }
            // Anything off the Mac (a news link, a broker site) opens in Safari.
            if action.navigationType == .linkActivated || action.targetFrame == nil {
                await UIApplication.shared.open(url)
                return .cancel
            }
            return .allow
        }

        func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse) async -> WKNavigationResponsePolicy {
            if let http = response.response as? HTTPURLResponse {
                if response.isForMainFrame, http.statusCode == 401 {
                    await MainActor.run { parent.onUnauthorized() }
                    return .cancel
                }
                // A CSV export: let the user save or share it.
                if let disposition = http.value(forHTTPHeaderField: "Content-Disposition"), disposition.lowercased().contains("attachment") {
                    return .download
                }
            }
            return .allow
        }

        func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { fail(error) }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { fail(error) }

        private func fail(_ error: Error) {
            let code = (error as NSError).code
            if code == NSURLErrorCancelled || code == 102 { return }   // our own .cancel / .download
            parent.onFailure(error.localizedDescription)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { web?.scrollView.refreshControl?.endRefreshing() }

        // MARK: Page → app

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
            if action == "unpair" { parent.onUnpair() }
        }

        // MARK: Downloads

        func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String) async -> URL? {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(suggestedFilename)
            try? FileManager.default.removeItem(at: url)
            downloadURL = url
            return url
        }

        func downloadDidFinish(_ download: WKDownload) {
            guard let url = downloadURL else { return }
            let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
            scene?.keyWindow?.rootViewController?.present(sheet, animated: true)
        }

        // The page's own alert / confirm dialogs (WKWebView ignores them otherwise,
        // which would silently disable every "are you sure?" on delete).
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            present(alert)
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
            present(alert)
        }

        private func present(_ alert: UIAlertController) {
            let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
            scene?.keyWindow?.rootViewController?.present(alert, animated: true)
        }
    }
}
