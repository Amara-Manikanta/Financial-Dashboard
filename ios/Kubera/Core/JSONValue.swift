import Foundation

/// The database holds mixed shapes — amounts stored as numbers in one record and
/// as strings in the next, fields present on some rows and absent on others — so
/// the core reads it as loosely as the web app does rather than through rigid
/// Codable structs that would fail on the first odd record.
///
/// The accessors deliberately copy JavaScript's rules (`Number("12")` is 12,
/// `Number("")` is 0, `Number(null)` is 0, `Number("abc")` is NaN) because the
/// formulas being ported were written against them.
enum JSONValue: Decodable, Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode(Double.self) { self = .number(value) }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode([JSONValue].self) { self = .array(value) }
        else if let value = try? container.decode([String: JSONValue].self) { self = .object(value) }
        else { throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value") }
    }

    static func parse(_ data: Data) throws -> JSONValue {
        try JSONDecoder().decode(JSONValue.self, from: data)
    }

    subscript(key: String) -> JSONValue {
        if case let .object(fields) = self { return fields[key] ?? .null }
        return .null
    }

    subscript(index: Int) -> JSONValue {
        if case let .array(items) = self, items.indices.contains(index) { return items[index] }
        return .null
    }

    var array: [JSONValue] { if case let .array(items) = self { return items }; return [] }
    var object: [String: JSONValue] { if case let .object(fields) = self { return fields }; return [:] }
    var isNull: Bool { if case .null = self { return true }; return false }

    /// `String(value ?? '')` — text for display and comparison.
    var text: String {
        switch self {
        case .null: return ""
        case let .string(value): return value
        case let .bool(value): return value ? "true" : "false"
        case let .number(value): return value == value.rounded() && abs(value) < 1e15 ? String(Int64(value)) : String(value)
        case .array, .object: return ""
        }
    }

    /// JavaScript `Number(value)`; nil where JavaScript would give NaN.
    var jsNumber: Double? {
        switch self {
        case .null: return 0
        case let .bool(value): return value ? 1 : 0
        case let .number(value): return value
        case let .string(value):
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { return 0 }
            return Double(trimmed)
        case let .array(items):
            if items.isEmpty { return 0 }
            return items.count == 1 ? items[0].jsNumber : nil
        case .object: return nil
        }
    }

    /// `Number(value) || 0` — the idiom the app uses nearly everywhere a
    /// stored amount is read: NaN and zero both become 0.
    var double: Double { jsNumber ?? 0 }

    /// JavaScript truthiness, for `a || b || c` chains.
    var truthy: Bool {
        switch self {
        case .null: return false
        case let .bool(value): return value
        case let .number(value): return value != 0 && !value.isNaN
        case let .string(value): return !value.isEmpty
        case .array, .object: return true
        }
    }

    /// Strictly `=== true` / `=== false`, which is how the original code tests flags.
    var isTrue: Bool { if case .bool(true) = self { return true }; return false }
    var isFalse: Bool { if case .bool(false) = self { return true }; return false }
}
