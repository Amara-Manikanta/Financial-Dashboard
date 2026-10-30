import SwiftUI

/// Where a price sits between its 52-week low and high. Nothing is implied by the
/// position: the near-low and near-high ends are tinted as a fact about the range,
/// not as a verdict.
struct RangeBar: View {
    let position: Double          // 0 on the low, 100 on the high
    var low: Double? = nil
    var high: Double? = nil

    private var tint: Color {
        position <= PriceRange.nearEdgePct ? Theme.accent : position >= 100 - PriceRange.nearEdgePct ? Theme.warning : Theme.muted
    }

    var body: some View {
        VStack(spacing: 4) {
            GeometryReader { proxy in
                let x = max(0, min(1, position / 100)) * proxy.size.width
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.08)).frame(height: 4)
                    Capsule().fill(tint.opacity(0.55)).frame(width: max(4, x), height: 4)
                    Circle().fill(tint).frame(width: 10, height: 10).offset(x: max(0, min(proxy.size.width - 10, x - 5)))
                }
                .frame(height: 10)
            }
            .frame(height: 10)
            if let low, let high {
                HStack {
                    Text(Money.rupees(low)); Spacer(); Text(Money.rupees(high))
                }
                .font(.system(size: 10, weight: .medium).monospacedDigit()).foregroundStyle(Theme.muted)
            }
        }
    }
}
