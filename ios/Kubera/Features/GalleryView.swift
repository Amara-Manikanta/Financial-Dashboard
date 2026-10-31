import SwiftUI

/// The ornaments, as pictures. Photos are fetched from the Mac with the pairing token; a picture
/// whose file is no longer on the Mac is left out (and counted), not shown as a grey box.
struct GalleryView: View {
    @ObservedObject var store: FinanceStore
    @State private var category = "All"
    @State private var broken: Set<String> = []
    @State private var open: Gallery.Shot?

    var body: some View {
        let g = Gallery.items(store.data.metalsRaw)
        let live = g.shots.filter { !broken.contains($0.url) }
        let cats = Dictionary(grouping: live, by: \.category).map { ($0.key, $0.value.count) }.sorted { $0.1 > $1.1 }
        let shown = live.filter { category == "All" || $0.category == category }
        KScreen(refresh: { await store.load() }) {
            KCard {
                KStat(label: "Photographed", value: "\(live.count) pictures", caption: "\(g.withoutPhotos.count) pieces have no photo yet\(broken.isEmpty ? "" : ", \(broken.count) point at files missing from the Mac")")
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack {
                    chip("All \(live.count)", selected: category == "All") { category = "All" }
                    ForEach(cats, id: \.0) { c in chip("\(Gallery.labels[c.0] ?? c.0) \(c.1)", selected: category == c.0) { category = c.0 } }
                }
            }
            LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                ForEach(shown) { s in
                    Button { open = s } label: {
                        ZStack(alignment: .bottomLeading) {
                            Photo(store: store, path: s.url) { broken.insert(s.url) }.frame(height: 170).clipped()
                            LinearGradient(colors: [.clear, .black.opacity(0.7)], startPoint: .center, endPoint: .bottom)
                            VStack(alignment: .leading, spacing: 0) {
                                Text(s.name).font(Theme.footnote.weight(.bold)).foregroundStyle(.white).lineLimit(1)
                                Text(Gallery.labels[s.category] ?? s.category).font(.system(size: 10)).foregroundStyle(.white.opacity(0.7))
                            }.padding(8)
                        }.clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }.buttonStyle(.plain)
                }
            }
            if !g.withoutPhotos.isEmpty {
                KSectionHeader(title: "Still to photograph", detail: "\(g.withoutPhotos.count)")
                KList(items: g.withoutPhotos.enumerated().map { Missing(id: $0.offset, name: $0.element.name, category: $0.element.category) }) { m in
                    KRow(title: m.name, subtitle: Gallery.labels[m.category] ?? m.category)
                }
            }
        }
        .navigationTitle("Ornament Gallery")
        .navigationBarTitleDisplayMode(.large)
        .fullScreenCover(item: $open) { s in
            ZStack(alignment: .topTrailing) {
                Color.black.ignoresSafeArea()
                Photo(store: store, path: s.url, fit: true) {}.ignoresSafeArea()
                Button { open = nil } label: { Image(systemName: "xmark.circle.fill").font(.system(size: 30)).foregroundStyle(.white.opacity(0.85)).padding() }
            }
        }
    }

    private struct Missing: Identifiable { let id: Int; let name: String; let category: String }

    private func chip(_ text: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(text).font(Theme.footnote.weight(.semibold)).foregroundStyle(selected ? .black : .white).padding(.horizontal, 12).padding(.vertical, 6)
                .background(selected ? Theme.accent : Color.white.opacity(0.08), in: Capsule())
        }.buttonStyle(.plain)
    }
}

/// A picture from the Mac. Calls `failed` when the file is not there.
private struct Photo: View {
    @ObservedObject var store: FinanceStore
    let path: String
    var fit = false
    let failed: () -> Void
    @State private var image: UIImage?

    var body: some View {
        ZStack {
            Color.white.opacity(0.05)
            if let image { Image(uiImage: image).resizable().aspectRatio(contentMode: fit ? .fit : .fill) } else { ProgressView() }
        }
        .task(id: path) {
            if let img = await store.photo(path) { image = img } else { failed() }
        }
    }
}
