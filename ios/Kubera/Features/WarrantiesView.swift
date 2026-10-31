import SwiftUI

/// Every owned item ranked by how soon its cover runs out. Receipts and service history are
/// attached on the Mac; items with no warranty recorded are listed last, as a worklist.
struct WarrantiesView: View {
    @ObservedObject var store: FinanceStore
    @State private var filter: Warranty.State?
    @State private var query = ""

    private func inr(_ v: Double) -> String { Money.rupees(v) }
    private func tone(_ s: Warranty.State) -> Tone { switch s { case .active: .positive; case .expiring: .warning; case .expired: .negative; case .unknown: .neutral } }

    var body: some View {
        let s = Warranty.summary(assets: store.data.assetsRaw)
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        let rows = s.rows.filter { r in
            if let filter, r.status.state != filter { return false }
            if q.isEmpty { return true }
            return "\(r.name) \(r.item["seller"].text) \(r.item["serialNumber"].text) \(r.categoryName)".lowercased().contains(q)
        }
        KScreen(refresh: { await store.load() }) {
            Text("\(s.total) items that can carry cover, soonest to lapse first.\(s.missingReceipt > 0 ? " \(s.missingReceipt) have no receipt attached — without the bill a claim is usually refused." : "")")
                .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            HStack(spacing: 8) {
                ForEach([Warranty.State.expiring, .active, .expired, .unknown], id: \.rawValue) { st in
                    let n = [Warranty.State.active: s.active, .expiring: s.expiring, .expired: s.expired, .unknown: s.unknown][st] ?? 0
                    Button { filter = filter == st ? nil : st } label: {
                        VStack(spacing: 2) {
                            Text("\(n)").font(Theme.figure).foregroundStyle(tone(st).color)
                            Text(st.label).font(.system(size: 9, weight: .bold)).foregroundStyle(Theme.muted).multilineTextAlignment(.center)
                        }.frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(filter == st ? Color.white.opacity(0.12) : Color.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }.buttonStyle(.plain)
                }
            }
            TextField("Search item, seller or serial number", text: $query).textInputAutocapitalization(.never).autocorrectionDisabled()
                .padding(10).background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 10, style: .continuous)).foregroundStyle(.white)
            KList(items: rows) { r in
                let rc = Warranty.receipts(r.item).count
                KRow(title: r.name, subtitle: "\(r.categoryName)\(r.item["purchaseDate"].truthy ? " · bought \(r.item["purchaseDate"].text)" : "")\(r.item["seller"].truthy ? " · \(r.item["seller"].text)" : "")\(rc > 0 ? " · \(rc) receipt\(rc == 1 ? "" : "s")" : " · no receipt")\(r.services.count > 0 ? " · \(r.services.count) repair\(r.services.count == 1 ? "" : "s"), \(inr(r.services.paid)) paid" : "")",
                     value: r.status.daysLeft.map { $0 < 0 ? "\(-$0)d ago" : "\($0)d left" } ?? "—", valueTone: tone(r.status.state),
                     valueCaption: r.status.expiryIso ?? r.status.state.label, captionTone: .neutral)
            }
        }
        .navigationTitle("Warranties")
        .navigationBarTitleDisplayMode(.large)
    }
}
