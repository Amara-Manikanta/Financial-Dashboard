import SwiftUI
import Charts

struct AllocationSlice: Identifiable, Equatable {
    let name: String
    let value: Double
    var id: String { name }
}

/// A donut with a legend. Shared by every screen that shows how a total splits,
/// so the colours and proportions read the same everywhere.
struct AllocationCard: View {
    let slices: [AllocationSlice]
    var title = "Allocation"

    static let palette: [Color] = [
        Color(red: 0.55, green: 0.36, blue: 0.96), Color(red: 0.93, green: 0.28, blue: 0.60), Color(red: 0.23, green: 0.51, blue: 0.96),
        Color(red: 0.06, green: 0.73, blue: 0.51), Color(red: 0.96, green: 0.62, blue: 0.04), Color(red: 0.94, green: 0.27, blue: 0.27),
        Color(red: 0.03, green: 0.71, blue: 0.83), Color(red: 0.52, green: 0.80, blue: 0.09),
    ]

    /// The biggest holdings by name, the rest gathered, so the donut stays readable.
    static func condensed(_ items: [AllocationSlice], keep: Int = 7) -> [AllocationSlice] {
        let sorted = items.filter { $0.value > 0 }.sorted { $0.value > $1.value }
        let top = Array(sorted.prefix(keep))
        let rest = sorted.dropFirst(keep).reduce(0) { $0 + $1.value }
        return rest > 0 ? top + [AllocationSlice(name: "Other", value: rest)] : top
    }

    private var total: Double { slices.reduce(0) { $0 + $1.value } }

    var body: some View {
        if !slices.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                KSectionHeader(title: title)
                KCard {
                    Chart(slices) { slice in
                        SectorMark(angle: .value("Value", slice.value), innerRadius: .ratio(0.62), angularInset: 1.5)
                            .cornerRadius(4)
                            .foregroundStyle(by: .value("Name", slice.name))
                    }
                    .chartForegroundStyleScale(domain: slices.map(\.name), range: Array(Self.palette.prefix(slices.count)))
                    .chartLegend(.hidden)
                    .frame(height: 190)
                    .padding(.vertical, 4)

                    VStack(spacing: 8) {
                        ForEach(Array(slices.enumerated()), id: \.element.id) { index, slice in
                            HStack(spacing: 10) {
                                Circle().fill(Self.palette[index % Self.palette.count]).frame(width: 9, height: 9)
                                Text(slice.name).font(Theme.footnote).foregroundStyle(.white).lineLimit(1)
                                Spacer()
                                Text(String(format: "%.1f%%", total > 0 ? slice.value / total * 100 : 0))
                                    .font(Theme.footnote.monospacedDigit()).foregroundStyle(Theme.muted)
                            }
                        }
                    }
                    .padding(.top, 6)
                }
            }
        }
    }
}
