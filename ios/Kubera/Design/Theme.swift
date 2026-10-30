import SwiftUI

/// Colours, type and spacing for the whole app. Matches the web UI's near-black
/// so a page opened in the web view does not flash against a native screen.
enum Theme {
    static let background = Color(red: 9 / 255, green: 9 / 255, blue: 11 / 255)
    static let card = Color(red: 24 / 255, green: 24 / 255, blue: 27 / 255)
    static let accent = Color(red: 129 / 255, green: 140 / 255, blue: 248 / 255)
    static let positive = Color(red: 52 / 255, green: 211 / 255, blue: 153 / 255)
    static let negative = Color(red: 248 / 255, green: 113 / 255, blue: 113 / 255)
    static let warning = Color(red: 251 / 255, green: 191 / 255, blue: 36 / 255)
    static let muted = Color(white: 0.63)
    static let uiBackground = UIColor(red: 9 / 255, green: 9 / 255, blue: 11 / 255, alpha: 1)

    static let cardRadius: CGFloat = 22
    static let cardPadding: CGFloat = 16
    static let screenPadding: CGFloat = 16
    static let sectionSpacing: CGFloat = 14

    static let caption = Font.system(size: 11, weight: .heavy)
    static let footnote = Font.system(size: 12.5, weight: .medium)
    static let body = Font.system(size: 15.5, weight: .semibold)
    static let figure = Font.system(size: 15.5, weight: .bold, design: .rounded).monospacedDigit()
}
