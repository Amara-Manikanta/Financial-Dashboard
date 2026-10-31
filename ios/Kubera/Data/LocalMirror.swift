import Foundation
import CryptoKit

/// The phone's own copy of what the Mac last served, plus the changes made since — what lets the app open and
/// be used with the Mac out of reach. It is the user's finances, so:
///   - it lives in a folder named after this pairing's token and is deleted when the pairing is forgotten or replaced,
///   - the files use complete file protection (unreadable while the phone is locked),
///   - it is excluded from iCloud and device backups,
///   - the Mac's `users` collection (which holds passwords) is never requested, so is never stored.
final class LocalMirror: @unchecked Sendable {
    private let dir: URL
    private let lock = NSLock()
    private var _offline = false
    private var _ops: [OfflineOp] = []

    /// Whether the Mac was unreachable the last time it was tried.
    var offline: Bool { lock.lock(); defer { lock.unlock() }; return _offline }
    func setOffline(_ v: Bool) { lock.lock(); _offline = v; lock.unlock() }

    var ops: [OfflineOp] { lock.lock(); defer { lock.unlock() }; return _ops }
    var syncedAt: Date? {
        lock.lock(); defer { lock.unlock() }
        guard let d = try? Data(contentsOf: dir.appendingPathComponent("meta.json")),
              let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any], let t = o["syncedAt"] as? Double else { return nil }
        return Date(timeIntervalSince1970: t)
    }

    /// Opens (creating if needed) the mirror for one pairing and deletes every other pairing's copy.
    init(token: String, root: URL? = nil) {
        let base = root ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("KuberaMirror", isDirectory: true)
        let name = SHA256.hash(data: Data(token.utf8)).prefix(8).map { String(format: "%02x", $0) }.joined()
        dir = base.appendingPathComponent(name, isDirectory: true)
        let fm = FileManager.default
        if let others = try? fm.contentsOfDirectory(at: base, includingPropertiesForKeys: nil) {
            for o in others where o.lastPathComponent != name { try? fm.removeItem(at: o) }
        }
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.complete])
        var res = URLResourceValues(); res.isExcludedFromBackup = true
        var b = base; try? b.setResourceValues(res)
        loadOps()
    }

    /// Removes everything this pairing stored. Called when the phone is disconnected.
    func wipe() {
        lock.lock(); defer { lock.unlock() }
        try? FileManager.default.removeItem(at: dir)
        _ops = []
    }

    // MARK: Responses

    private func file(_ key: String) -> URL {
        let safe = key.map { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" ? String($0) : "_" }.joined()
        let tag = SHA256.hash(data: Data(key.utf8)).prefix(3).map { String(format: "%02x", $0) }.joined()
        return dir.appendingPathComponent(String(safe.prefix(60)) + "-" + tag + ".json")
    }

    func put(_ key: String, _ data: Data) {
        lock.lock(); defer { lock.unlock() }
        try? data.write(to: file(key), options: [.atomic, .completeFileProtection])
    }

    func get(_ key: String) -> Data? {
        lock.lock(); defer { lock.unlock() }
        return try? Data(contentsOf: file(key))
    }

    func markSynced(_ date: Date = Date()) {
        lock.lock(); defer { lock.unlock() }
        if let d = try? JSONSerialization.data(withJSONObject: ["syncedAt": date.timeIntervalSince1970]) { try? d.write(to: dir.appendingPathComponent("meta.json"), options: [.atomic, .completeFileProtection]) }
    }

    /// Reads a stored collection, lets `change` edit it, and stores it back. False when there is nothing stored to edit.
    @discardableResult
    func modify(_ key: String, _ change: (inout Any) -> Void) -> Bool {
        lock.lock(); defer { lock.unlock() }
        guard let d = try? Data(contentsOf: file(key)), var any = try? JSONSerialization.jsonObject(with: d, options: [.fragmentsAllowed]) else { return false }
        change(&any)
        guard let out = try? JSONSerialization.data(withJSONObject: any, options: [.fragmentsAllowed]) else { return false }
        try? out.write(to: file(key), options: [.atomic, .completeFileProtection])
        return true
    }

    /// One record of a stored collection (cached copy, with any changes already made on this phone).
    func record(_ collection: String, id: String) -> JSONValue? {
        guard let d = get(collection), let v = try? JSONValue.parse(d) else { return nil }
        return v.array.first { $0["id"].text == id }
    }

    // MARK: Pending changes

    private var opsFile: URL { dir.appendingPathComponent("pending.json") }

    private func loadOps() {
        guard let d = try? Data(contentsOf: opsFile), let a = try? JSONSerialization.jsonObject(with: d) as? [[String: Any]] else { return }
        _ops = a.compactMap(OfflineCoding.decode)
    }

    private func saveOps() {
        let a = _ops.map(OfflineCoding.encode)
        if let d = try? JSONSerialization.data(withJSONObject: a) { try? d.write(to: opsFile, options: [.atomic, .completeFileProtection]) }
    }

    func enqueue(_ op: OfflineOp) { lock.lock(); _ops.append(op); saveOps(); lock.unlock() }
    func remove(_ id: String) { lock.lock(); _ops.removeAll { $0.id == id }; saveOps(); lock.unlock() }
    func update(_ id: String, _ change: (inout OfflineOp) -> Void) {
        lock.lock(); if let i = _ops.firstIndex(where: { $0.id == id }) { change(&_ops[i]); saveOps() }; lock.unlock()
    }
}
