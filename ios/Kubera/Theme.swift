import SwiftUI

/// The same near-black the web UI uses, so there is no flash between the two.
enum Theme {
    static let background = Color(red: 9 / 255, green: 9 / 255, blue: 11 / 255)
    static let card = Color(red: 24 / 255, green: 24 / 255, blue: 27 / 255)
    static let accent = Color(red: 129 / 255, green: 140 / 255, blue: 248 / 255)
    static let muted = Color(white: 0.63)
    static let uiBackground = UIColor(red: 9 / 255, green: 9 / 255, blue: 11 / 255, alpha: 1)
}
