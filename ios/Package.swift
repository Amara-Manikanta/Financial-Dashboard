// swift-tools-version: 5.9
import PackageDescription

// Lets the pure logic in Kubera/Core be tested from the command line
// (`swift test`) without a simulator. The app itself builds the same files
// directly through Xcode; nothing here is a second copy.
let package = Package(
    name: "KuberaCore",
    platforms: [.macOS(.v13), .iOS(.v17)],
    targets: [
        .target(name: "KuberaCore", path: "Kubera/Core"),
        .testTarget(name: "KuberaCoreTests", dependencies: ["KuberaCore"], path: "Tests/KuberaCoreTests"),
    ]
)
