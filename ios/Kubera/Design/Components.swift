import SwiftUI

/// The one place cards, figures and rows are styled. Every screen is built from
/// these, so a card looks the same wherever it appears — the web app styles each
/// card inline on each page, which is where its inconsistencies come from.
enum Tone {
    case neutral, positive, negative, warning, accent

    var color: Color {
        switch self {
        case .neutral: return .white
        case .positive: return Theme.positive
        case .negative: return Theme.negative
        case .warning: return Theme.warning
        case .accent: return Theme.accent
        }
    }

    /// Money tone: green above zero, red below.
    static func of(_ amount: Double) -> Tone { amount > 0 ? .positive : amount < 0 ? .negative : .neutral }
}

struct KCard<Content: View>: View {
    var padding: CGFloat = Theme.cardPadding
    var tint: Color? = nil
    @ViewBuilder var content: Content

    var body: some View {
        // One container, so several children share a single card instead of
        // each being given its own background.
        VStack(alignment: .leading, spacing: 6) { content }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padding)
            .background {
                RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
                    .fill((tint ?? Theme.card).opacity(tint == nil ? 1 : 0.08))
                    .overlay(RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
                        .strokeBorder((tint ?? .white).opacity(tint == nil ? 0.06 : 0.22), lineWidth: 1))
            }
    }
}

struct KSectionHeader: View {
    let title: String
    var detail: String? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title.uppercased()).font(Theme.caption).tracking(1.1).foregroundStyle(Theme.muted)
            Spacer()
            if let detail { Text(detail).font(Theme.footnote).foregroundStyle(Theme.muted) }
        }
        .padding(.horizontal, 4)
    }
}

/// A labelled figure. `size` picks between the hero and the small stat.
struct KStat: View {
    enum Size { case hero, large, regular }
    let label: String
    let value: String
    var tone: Tone = .neutral
    var caption: String? = nil
    var size: Size = .regular

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased()).font(Theme.caption).tracking(1.0).foregroundStyle(Theme.muted)
            Text(value)
                .font(font)
                .foregroundStyle(tone.color)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            if let caption { Text(caption).font(Theme.footnote).foregroundStyle(Theme.muted) }
        }
    }

    private var font: Font {
        switch size {
        case .hero: return .system(size: 34, weight: .heavy, design: .rounded).monospacedDigit()
        case .large: return .system(size: 24, weight: .bold, design: .rounded).monospacedDigit()
        case .regular: return .system(size: 17, weight: .semibold, design: .rounded).monospacedDigit()
        }
    }
}

/// One line in a list: title and subtitle on the left, a figure on the right.
struct KRow: View {
    let title: String
    var subtitle: String? = nil
    var value: String? = nil
    var valueTone: Tone = .neutral
    var valueCaption: String? = nil
    var captionTone: Tone? = nil
    var systemImage: String? = nil
    var chevron = false

    var body: some View {
        HStack(spacing: 12) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.accent)
                    .frame(width: 32, height: 32)
                    .background(Theme.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Theme.body).foregroundStyle(.white).lineLimit(2)
                if let subtitle { Text(subtitle).font(Theme.footnote).foregroundStyle(Theme.muted).lineLimit(1) }
            }
            Spacer(minLength: 8)
            if value != nil || valueCaption != nil {
                VStack(alignment: .trailing, spacing: 2) {
                    if let value { Text(value).font(Theme.figure).foregroundStyle(valueTone.color).lineLimit(1).minimumScaleFactor(0.7) }
                    if let valueCaption { Text(valueCaption).font(Theme.footnote).foregroundStyle(captionTone?.color ?? Theme.muted).lineLimit(1) }
                }
            }
            if chevron { Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.muted.opacity(0.6)) }
        }
        .contentShape(Rectangle())
    }
}

/// Rows in one card with hairline dividers between them.
struct KList<Data: RandomAccessCollection, Row: View>: View where Data.Element: Identifiable {
    let items: Data
    @ViewBuilder var row: (Data.Element) -> Row

    var body: some View {
        KCard(padding: 0) {
            LazyVStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { offset, item in
                    row(item).padding(.horizontal, Theme.cardPadding).padding(.vertical, 12)
                    if offset < items.count - 1 { Divider().overlay(Color.white.opacity(0.06)).padding(.leading, Theme.cardPadding) }
                }
            }
        }
    }
}

struct KBadge: View {
    let text: String
    var tone: Tone = .accent

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 9.5, weight: .heavy)).tracking(0.8)
            .foregroundStyle(tone.color)
            .padding(.horizontal, 7).padding(.vertical, 3)
            .background(tone.color.opacity(0.14), in: Capsule())
    }
}

struct KNotice: View {
    let message: String
    var retry: (() -> Void)? = nil

    var body: some View {
        KCard(tint: Theme.warning) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Theme.warning)
                VStack(alignment: .leading, spacing: 8) {
                    Text(message).font(Theme.footnote).foregroundStyle(.white)
                    if let retry { Button("Try again", action: retry).font(Theme.footnote.weight(.bold)) }
                }
            }
        }
    }
}

/// The standard screen: dark background, scrolling column of cards, pull to refresh.
struct KScreen<Content: View>: View {
    var refresh: (() async -> Void)? = nil
    @ViewBuilder var content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.sectionSpacing) { content }
                .padding(.horizontal, Theme.screenPadding)
                .padding(.vertical, 12)
        }
        .scrollIndicators(.hidden)
        .background(Theme.background.ignoresSafeArea())
        .refreshable { await refresh?() }
    }
}
