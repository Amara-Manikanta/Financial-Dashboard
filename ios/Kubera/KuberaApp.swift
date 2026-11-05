import SwiftUI

@main
struct KuberaApp: App {
    init() {
        NotificationRouter.shared.install()
        // `-openLink dividends` behaves as if the dividend notification had been tapped, for checking that route without waiting for one.
        let args = ProcessInfo.processInfo.arguments
        if let i = args.firstIndex(of: "-openLink"), args.indices.contains(i + 1), args[i + 1] == "dividends" {
            Task { @MainActor in DeepLink.shared.screen = .dividends }
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.dark)
        }
    }
}
