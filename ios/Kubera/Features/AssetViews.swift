import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct AssetItemRoute: Hashable { let categoryId: String; let itemId: String }

private func inr(_ v: Double) -> String { Money.rupees(v) }

/// A category's name as the Mac shows it: `title`, else `category`, else `name`, else its type.
func assetCategoryTitle(_ c: JSONValue) -> String {
    [c["title"], c["category"], c["name"]].map(\.text).first { !$0.isEmpty }
        ?? (c["type"].text.isEmpty ? "Assets" : c["type"].text.replacingOccurrences(of: "_", with: " ").capitalized)
}
private func assetValue(_ i: JSONValue) -> Double {
    for k in ["currentValue", "purchasePrice", "purchasedValue"] { let v = i[k].double; if v != 0 && !v.isNaN { return v } }
    return 0
}

private func fact(_ label: String, _ value: String) -> some View {
    HStack(alignment: .firstTextBaseline) {
        Text(label).font(Theme.footnote).foregroundStyle(Theme.muted)
        Spacer(minLength: 12)
        Text(value).font(Theme.footnote.weight(.semibold)).foregroundStyle(.white).multilineTextAlignment(.trailing)
    }
    .padding(.vertical, 2)
}

/// One asset category (plots, apartments, other assets): totals, every item, and adding, changing and deleting items.
struct AssetCategoryView: View {
    @ObservedObject var store: FinanceStore
    let route: AssetCategoryRoute

    @State private var sheet: ItemSheet?
    @State private var deleting: JSONValue?
    @State private var message: String?
    private struct ItemSheet: Identifiable { let id = UUID(); let item: JSONValue? }

    private var category: JSONValue { store.data.assetsRaw.array.first { $0["id"].text == route.id } ?? .null }

    var body: some View {
        let cat = category
        let isRE = cat["type"].text == "real_estate"
        let items = cat["items"].array.enumerated().map { IndexedRow(id: $0.offset, value: $0.element) }
        let total = items.reduce(0) { $0 + assetValue($1.value) }
        let cost = items.reduce(0) { $0 + ($1.value["purchasePrice"].double != 0 ? $1.value["purchasePrice"].double : $1.value["purchasedValue"].double) }
        KScreen(refresh: { await store.load() }) {
            if let message { KNotice(message: message) { self.message = nil } }
            KCard(tint: Theme.accent) {
                KStat(label: "Total valuation", value: inr(total), size: .hero)
                HStack(alignment: .top) {
                    KStat(label: "Cost", value: inr(cost))
                    Spacer()
                    KStat(label: "Change", value: Fmt.signed(total - cost), tone: Tone.of(total - cost), caption: cost > 0 ? Fmt.percent((total - cost) / cost * 100) : nil)
                }
                .padding(.top, 10)
            }
            HStack {
                KSectionHeader(title: "Items", detail: "\(items.count)")
                Button { sheet = ItemSheet(item: nil) } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) }
            }
            if items.isEmpty {
                KCard { Text("Nothing here yet. Tap + to add one.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            } else {
                KList(items: items) { r in
                    let it = r.value
                    let st = isRE ? nil : Warranty.status(it)
                    let warranty = st.map { $0.state == .unknown ? "" : " · \($0.state.label.lowercased())" } ?? ""
                    let place = [it["place"].text, it["location"].text].first { !$0.isEmpty }
                    NavigationLink(value: AssetItemRoute(categoryId: route.id, itemId: it["id"].text)) {
                        KRow(title: it["name"].text,
                             subtitle: "\(it["purchaseDate"].truthy ? "bought \(Fmt.date(it["purchaseDate"].text))" : "undated")\(place.map { " · \($0)" } ?? "")\(warranty)",
                             value: inr(assetValue(it)), valueTone: .neutral, chevron: true)
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        Button { sheet = ItemSheet(item: it) } label: { Label("Edit", systemImage: "pencil") }
                        Button(role: .destructive) { deleting = it } label: { Label("Delete", systemImage: "trash") }
                    }
                }
                Text("Open an item for its warranty, receipts, rent and history. Long-press to edit or delete.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            }
        }
        .navigationTitle(assetCategoryTitle(cat))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .primaryAction) { Button { sheet = ItemSheet(item: nil) } label: { Image(systemName: "plus") } }
            ToolbarItem(placement: .secondaryAction) { EditRecordButton(store: store, collection: "assets", id: route.id, title: assetCategoryTitle(cat)) }
        }
        .sheet(item: $sheet) { s in AssetItemSheet(store: store, categoryId: route.id, isRealEstate: isRE, editing: s.item) }
        .navigationDestination(for: AssetItemRoute.self) { AssetItemView(store: store, route: $0) }
        .confirmationDialog("Delete this asset?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let it = deleting { Task { message = await store.saveAsset(category: route.id, .deleteItem(itemId: it["id"].text), label: "Delete asset \(it["name"].text)") } }
            }
        } message: { Text("It is removed with all its history.") }
    }
}

/// One asset: its value and details, warranty and service history for goods, tenancy, rent and bills for property.
struct AssetItemView: View {
    @ObservedObject var store: FinanceStore
    let route: AssetItemRoute
    @Environment(\.dismiss) private var dismiss

    private enum Sheet: Identifiable {
        case editItem, entry(JSONValue?), service(JSONValue?), unit(JSONValue?), viewer(JSONValue)
        var id: String {
            switch self {
            case .editItem: "edit"; case .entry(let e): "e" + (e?["id"].text ?? "new"); case .service(let s): "s" + (s?["id"].text ?? "new")
            case .unit(let u): "u" + (u?["id"].text ?? "new"); case .viewer(let r): "v" + r["url"].text
            }
        }
    }
    @State private var sheet: Sheet?
    @State private var selectedUnit: String?
    @State private var year = "All"
    @State private var message: String?
    @State private var confirmDeleteItem = false
    @State private var deleting: Delete?
    @State private var picking = false
    @State private var photoItem: PhotosPickerItem?
    @State private var importing = false
    @State private var busy = false

    private enum Delete { case entry(JSONValue), service(JSONValue), receipt(JSONValue), unit(JSONValue) }

    private var category: JSONValue { store.data.assetsRaw.array.first { $0["id"].text == route.categoryId } ?? .null }
    private var item: JSONValue { category["items"].array.first { $0["id"].text == route.itemId } ?? .null }

    var body: some View {
        let it = item
        let isRE = category["type"].text == "real_estate"
        return KScreen(refresh: { await store.load() }) {
            if let message { KNotice(message: message) { self.message = nil } }
            if it.isNull {
                KCard { Text("This asset is no longer on your Mac.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            } else {
                header(it, isRE: isRE)
                if isRE { property(it) } else { warranty(it) }
                entries(it, isRE: isRE)
            }
        }
        .navigationTitle(it["name"].text.isEmpty ? "Asset" : it["name"].text)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if !it.isNull {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button { sheet = .editItem } label: { Label("Edit", systemImage: "pencil") }
                        if isRE { Button { sheet = .unit(nil) } label: { Label(PropertyUnits.hasUnits(it) ? "Add unit" : "Split into units", systemImage: "square.split.2x2") } }
                        Button(role: .destructive) { confirmDeleteItem = true } label: { Label("Delete", systemImage: "trash") }
                    } label: { Image(systemName: "ellipsis.circle") }
                }
            }
        }
        .sheet(item: $sheet) { s in
            switch s {
            case .editItem: AssetItemSheet(store: store, categoryId: route.categoryId, isRealEstate: isRE, editing: item)
            case .entry(let e): AssetEntrySheet(store: store, categoryId: route.categoryId, item: item, isRealEstate: isRE, editing: e, unit: selectedUnit)
            case .service(let sv): ServiceSheet(store: store, categoryId: route.categoryId, itemId: route.itemId, itemName: item["name"].text, editing: sv)
            case .unit(let u): UnitSheet(store: store, categoryId: route.categoryId, itemId: route.itemId, editing: u)
            case .viewer(let r): DocumentViewer(store: store, receipt: r)
            }
        }
        .confirmationDialog("Delete this asset?", isPresented: $confirmDeleteItem, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task {
                    let failure = await store.saveAsset(category: route.categoryId, .deleteItem(itemId: route.itemId), label: "Delete asset \(item["name"].text)")
                    if let failure { message = failure } else { dismiss() }
                }
            }
        } message: { Text("It is removed with all its transaction history.") }
        .confirmationDialog("Delete this?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) { if let d = deleting { Task { await performDelete(d) } } }
        }
        .photosPicker(isPresented: $picking, selection: $photoItem, matching: .images)
        .fileImporter(isPresented: $importing, allowedContentTypes: [.pdf, .image]) { result in
            if case .success(let url) = result { Task { await upload(url: url) } }
        }
        .onChange(of: photoItem) { _, new in if let new { Task { await uploadPhoto(new) } } }
    }

    // MARK: Header

    @ViewBuilder private func header(_ it: JSONValue, isRE: Bool) -> some View {
        let cost = it["purchasePrice"].double != 0 ? it["purchasePrice"].double : it["purchasedValue"].double
        let value = it["currentValue"].double
        KCard(tint: Theme.accent) {
            KStat(label: "Current value", value: inr(value != 0 ? value : cost), size: .hero)
            if cost > 0 {
                HStack(alignment: .top) {
                    KStat(label: "Bought for", value: inr(cost))
                    Spacer()
                    if value != 0 { KStat(label: "Change", value: Fmt.signed(value - cost), tone: Tone.of(value - cost), caption: Fmt.percent((value - cost) / cost * 100)) }
                }
                .padding(.top, 10)
            }
        }
        KCard {
            if it["purchaseDate"].truthy { fact("Purchased", Fmt.date(it["purchaseDate"].text)) }
            if it["place"].truthy { fact("Place", it["place"].text) }
            if it["location"].truthy { fact("Location", it["location"].text) }
            if it["dimensions"].truthy { fact("Dimensions", it["dimensions"].text) }
            if it["remarks"].truthy { fact("Remarks", it["remarks"].text) }
        }
    }

    // MARK: Goods: warranty, services, receipts

    @ViewBuilder private func warranty(_ it: JSONValue) -> some View {
        let st = Warranty.status(it)
        let totals = Warranty.serviceTotals(it)
        let services = it["services"].array.enumerated().sorted { $0.element["date"].text > $1.element["date"].text }.map { IndexedRow(id: $0.offset, value: $0.element) }
        let receipts = Warranty.receipts(it).enumerated().map { IndexedRow(id: $0.offset, value: $0.element) }
        KSectionHeader(title: "Warranty")
        KCard(tint: st.state == .active ? Theme.positive : st.state == .expiring ? Theme.warning : nil) {
            HStack(alignment: .firstTextBaseline) {
                Text(st.state.label).font(.system(size: 20, weight: .heavy, design: .rounded)).foregroundStyle(st.state == .active ? Tone.positive.color : st.state == .expiring ? Tone.warning.color : .white)
                Spacer()
                if st.extended && st.state != .unknown { KBadge(text: "Extended") }
            }
            Text(st.state == .unknown ? "No warranty period recorded for this item."
                 : st.state == .expired ? "Cover ended \(Fmt.date(st.expiryIso ?? "")) — \(abs(st.daysLeft ?? 0)) days ago."
                 : "Covered until \(Fmt.date(st.expiryIso ?? "")) — \(st.daysLeft ?? 0) days left.").font(Theme.footnote).foregroundStyle(Theme.muted)
            if it["serialNumber"].truthy { fact("Serial number", it["serialNumber"].text).padding(.top, 6) }
            if it["seller"].truthy { fact("Bought from", it["seller"].text) }
            if let d = Warranty.manufacturerExpiry(it) { fact("Manufacturer cover ends", Fmt.date(Recurring.isoDay(d))) }
            if let d = Warranty.extendedExpiry(it) { fact("Extended cover ends", Fmt.date(Recurring.isoDay(d))) }
            if it["extendedCost"].double > 0 {
                let net = totals.covered - it["extendedCost"].double
                Text("Extended cover cost \(inr(it["extendedCost"].double)) and has covered \(inr(totals.covered)) of repairs — "
                     + (net >= 0 ? "ahead by \(inr(net))." : "\(inr(abs(net))) still to earn back.")).font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 6)
            }
        }

        HStack {
            KSectionHeader(title: "Service history", detail: services.isEmpty ? nil : "\(totals.count) · spent \(inr(totals.paid)) · covered \(inr(totals.covered))")
            Button { sheet = .service(nil) } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) }
        }
        if services.isEmpty {
            KCard { Text("No services logged yet.").font(Theme.footnote).foregroundStyle(Theme.muted) }
        } else {
            KList(items: services) { r in
                let s = r.value
                Button { sheet = .service(s) } label: {
                    KRow(title: s["description"].text, subtitle: [Fmt.date(s["date"].text), s["provider"].text].filter { !$0.isEmpty }.joined(separator: " · "),
                         value: inr(s["cost"].double), valueTone: .neutral, valueCaption: s["underWarranty"].truthy ? "under warranty" : nil, captionTone: .positive)
                }
                .buttonStyle(.plain)
                .contextMenu { Button(role: .destructive) { deleting = .service(s) } label: { Label("Delete", systemImage: "trash") } }
            }
        }

        HStack {
            KSectionHeader(title: "Receipts & proof of purchase", detail: receipts.isEmpty ? nil : "\(receipts.count)")
            if busy { ProgressView() } else {
                Menu {
                    Button { picking = true } label: { Label("Photo", systemImage: "photo") }
                    Button { importing = true } label: { Label("PDF or file", systemImage: "doc") }
                } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) }
            }
        }
        if receipts.isEmpty {
            KCard { Text("No receipt attached. Files are stored on your Mac, so adding one needs it nearby.").font(Theme.footnote).foregroundStyle(Theme.muted) }
        } else {
            KList(items: receipts) { r in
                Button { sheet = .viewer(r.value) } label: {
                    KRow(title: r.value["name"].text.isEmpty ? "Receipt" : r.value["name"].text, subtitle: r.value["url"].text.lowercased().hasSuffix(".pdf") ? "PDF" : "Image",
                         systemImage: r.value["url"].text.lowercased().hasSuffix(".pdf") ? "doc.fill" : "photo", chevron: true)
                }
                .buttonStyle(.plain)
                .contextMenu { Button(role: .destructive) { deleting = .receipt(r.value) } label: { Label("Remove", systemImage: "trash") } }
            }
        }
    }

    // MARK: Property: units, tenancy, rent and bills

    @ViewBuilder private func property(_ it: JSONValue) -> some View {
        let usesUnits = PropertyUnits.hasUnits(it)
        let units = PropertyUnits.allUnits(it)
        let active = usesUnits ? units.first { $0["id"].text == selectedUnit } : nil
        let rental = active.map { $0["rental"] } ?? it["rental"]
        let entries = (active ?? it)["transactions"].array
        let summary = Rental.summarise(entries)
        let whole = usesUnits && active == nil
        let prop = usesUnits ? PropertyUnits.summariseProperty(it) : nil

        if usesUnits, let prop {
            HStack {
                KSectionHeader(title: "Units", detail: "\(prop.total)")
                Button { sheet = .unit(nil) } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) }
            }
            KCard(tint: Theme.accent) {
                HStack(alignment: .top) {
                    KStat(label: "Rent roll", value: inr(prop.monthlyRentRoll), caption: "per month now")
                    Spacer()
                    KStat(label: "Occupancy", value: prop.occupancyPct.map { String(format: "%.0f%%", $0) } ?? "—", caption: "\(prop.letCount) let · \(prop.vacant) vacant")
                }
                HStack(alignment: .top) {
                    KStat(label: "Net return", value: Fmt.signed(prop.net), tone: Tone.of(prop.net), caption: prop.yieldOnValue.map { String(format: "%.1f%% of value", $0) })
                    Spacer()
                    KStat(label: "Arrears", value: inr(prop.arrears), tone: prop.arrears > 0 ? .negative : .neutral, caption: "deposits held \(inr(prop.depositHeld))")
                }
                .padding(.top, 8)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    unitChip("Whole property", on: selectedUnit == nil) { selectedUnit = nil }
                    ForEach(Array(prop.units.enumerated()), id: \.offset) { _, u in
                        unitChip("\(PropertyUnits.typeMeta(u.unit["unitType"].text).icon) \(u.unit["name"].text)", on: selectedUnit == u.unit["id"].text) { selectedUnit = u.unit["id"].text }
                    }
                }
            }
            ForEach(Array(prop.units.enumerated()), id: \.offset) { _, u in
                let isMain = u.unit["id"].text == PropertyUnits.mainId
                Button { selectedUnit = u.unit["id"].text } label: {
                    KCard(tint: selectedUnit == u.unit["id"].text ? Theme.accent : nil) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(u.unit["name"].text).font(Theme.body.weight(.bold)).foregroundStyle(.white)
                            Spacer()
                            KBadge(text: u.status.label, tone: u.status == .let ? .positive : u.status == .vacant ? .warning : .neutral)
                        }
                        if u.status == .let {
                            Text("\(u.unit["rental"]["tenantName"].text.isEmpty ? "No tenant recorded" : u.unit["rental"]["tenantName"].text) · \(inr(u.currentRent))/mo")
                                .font(Theme.footnote).foregroundStyle(Theme.muted)
                            if u.arrears > 0 { Text("Arrears \(inr(u.arrears))").font(Theme.footnote.weight(.semibold)).foregroundStyle(Tone.negative.color) }
                        }
                    }
                }
                .buttonStyle(.plain)
                .contextMenu {
                    Button { sheet = .unit(u.unit) } label: { Label("Edit", systemImage: "pencil") }
                    if !isMain { Button(role: .destructive) { deleting = .unit(u.unit) } label: { Label("Delete", systemImage: "trash") } }
                }
            }
        } else if rental.truthy == false {
            KCard {
                Text("Not let out. Edit the property to add a tenancy, or split it into shops, floors or flats that are let separately.").font(Theme.footnote).foregroundStyle(Theme.muted)
                Button { sheet = .unit(nil) } label: { Label("Split into units", systemImage: "square.split.2x2").font(Theme.footnote.weight(.semibold)) }.padding(.top, 6)
            }
        }

        if rental.truthy && (!usesUnits || active != nil) { tenancy(rental, entries: entries, summary: summary) }
        figures(summary: whole ? nil : summary, prop: whole ? prop : nil)
        if !whole || !usesUnits { ledgers(rental: rental, entries: entries) }
    }

    private func unitChip(_ title: String, on: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(Theme.footnote.weight(.semibold)).padding(.horizontal, 12).padding(.vertical, 7)
                .background(on ? Theme.accent : Color.white.opacity(0.08), in: Capsule()).foregroundStyle(on ? Color.black : .white)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder private func tenancy(_ rental: JSONValue, entries: [JSONValue], summary: Rental.Summary) -> some View {
        KSectionHeader(title: "Tenancy")
        KCard {
            HStack(alignment: .firstTextBaseline) {
                Text(rental["tenantName"].text.isEmpty ? "No tenant recorded" : rental["tenantName"].text).font(Theme.body.weight(.bold)).foregroundStyle(.white)
                Spacer()
                if rental["rentDueDay"].truthy { Text("due on the \(rental["rentDueDay"].text)").font(Theme.footnote).foregroundStyle(Theme.muted) }
            }
            let now = Rental.expectedRent(rental, on: Rental.utcDay(Date()))
            fact("Rent now", inr(now))
            if now > rental["monthlyRent"].double { fact("Started at", inr(rental["monthlyRent"].double)) }
            if rental["tenantContact"].truthy { fact("Contact", rental["tenantContact"].text) }
            if rental["advanceAmount"].double > 0 { fact("Advance", inr(rental["advanceAmount"].double)) }
            if rental["escalationValue"].double > 0 {
                fact("Rent rises", "\(rental["escalationType"].text == "fixed" ? inr(rental["escalationValue"].double) : "\(RecordEditing.number(rental["escalationValue"].double))%") every \(RecordEditing.number(rental["escalationEveryMonths"].double == 0 ? 12 : rental["escalationEveryMonths"].double)) months")
            }
            if rental["leaseStart"].truthy { fact("Lease", "\(Fmt.date(rental["leaseStart"].text))\(rental["leaseEnd"].truthy ? " → \(Fmt.date(rental["leaseEnd"].text))" : "")") }
            if rental["rules"].truthy { Text(rental["rules"].text).font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 4) }
            ForEach(Array(rental["terms"].array.enumerated()), id: \.offset) { _, t in
                HStack(alignment: .firstTextBaseline, spacing: 6) { Text("•").foregroundStyle(Theme.accent); Text(t.text).font(Theme.footnote).foregroundStyle(.white.opacity(0.85)) }.padding(.top, 2)
            }
        }
    }

    @ViewBuilder private func figures(summary: Rental.Summary?, prop: PropertyUnits.PropertySummary?) -> some View {
        let income = prop?.income ?? summary?.income ?? 0, expense = prop?.expense ?? summary?.expense ?? 0
        let net = income - expense, deposit = prop?.depositHeld ?? summary?.depositHeld ?? 0
        let tenant = summary?.coveredByTenant ?? 0
        if income != 0 || expense != 0 || deposit != 0 {
            KCard {
                HStack(alignment: .top) {
                    KStat(label: "Income", value: inr(income), tone: .positive)
                    Spacer()
                    KStat(label: "Costs", value: inr(expense), tone: .negative)
                    Spacer()
                    KStat(label: "Net", value: Fmt.signed(net), tone: Tone.of(net))
                }
                if deposit != 0 { fact("Deposit held for tenants", inr(deposit)).padding(.top, 6) }
                if tenant > 0 { fact("Covered by tenants", inr(tenant)) }
                Text("Advances are money held on the tenant's behalf, so they are not counted as return.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.top, 4)
            }
        }
    }

    @ViewBuilder private func ledgers(rental: JSONValue, entries: [JSONValue]) -> some View {
        if rental.truthy {
            let ledger = Rental.rentLedger(rental, entries: entries)
            if !ledger.rows.isEmpty {
                KSectionHeader(title: "Rent due vs received", detail: ledger.arrears > 0 ? "arrears \(inr(ledger.arrears))" : "all paid")
                KList(items: ledger.rows.enumerated().map { IndexedRow(id: $0.offset, value: .object(["month": .string($0.element.month), "due": .number($0.element.due), "received": .number($0.element.received)])) }.prefix(24).map { $0 }) { r in
                    let short = max(0, r.value["due"].double - r.value["received"].double)
                    KRow(title: Rental.formatPeriod(r.value["month"].text), subtitle: "due \(inr(r.value["due"].double))",
                         value: inr(r.value["received"].double), valueTone: short > 0 ? .negative : .positive, valueCaption: short > 0 ? "short \(inr(short))" : "paid", captionTone: short > 0 ? .negative : .positive)
                }
                if !ledger.unplaced.isEmpty {
                    Text("\(ledger.unplaced.count) rent payment\(ledger.unplaced.count == 1 ? "" : "s") not counted above — \(ledger.unplaced.contains { $0.outsideLease } ? "dated outside the lease" : "no month could be read from them").")
                        .font(Theme.footnote).foregroundStyle(Tone.warning.color).padding(.horizontal, 4)
                }
            }
        }
        let bills = Rental.billLedger(entries)
        if !bills.rows.isEmpty {
            KSectionHeader(title: "Bills by month")
            KList(items: bills.rows.enumerated().map { IndexedRow(id: $0.offset, value: .object(["m": .string($0.element.month), "billed": .number($0.element.billed), "rec": .number($0.element.recovered), "tp": .number($0.element.tenantPaid)])) }.prefix(24).map { $0 }) { r in
                let billed = r.value["billed"].double, rec = r.value["rec"].double, tp = r.value["tp"].double
                KRow(title: Rental.formatPeriod(r.value["m"].text), subtitle: "recovered \(inr(rec))" + (tp > 0 ? " · tenant paid \(inr(tp)) directly" : ""),
                     value: inr(billed - rec), valueTone: billed - rec > 0 ? .negative : .positive, valueCaption: "you bear")
            }
        }
    }

    // MARK: Entries

    @ViewBuilder private func entries(_ it: JSONValue, isRE: Bool) -> some View {
        let usesUnits = isRE && PropertyUnits.hasUnits(it)
        let active = usesUnits ? PropertyUnits.allUnits(it).first { $0["id"].text == selectedUnit } : nil
        let all = (active ?? it)["transactions"].array
        let years = ["All"] + Array(Set(all.compactMap { JSDate.parse($0["date"]).map { String(Calendar.current.component(.year, from: $0)) } })).sorted(by: >)
        let shown = all.enumerated().filter { year == "All" || (JSDate.parse($0.element["date"]).map { String(Calendar.current.component(.year, from: $0)) } == year) }
            .sorted { a, b in a.element["date"].text != b.element["date"].text ? a.element["date"].text > b.element["date"].text : a.offset > b.offset }
            .map { IndexedRow(id: $0.offset, value: $0.element) }
        HStack {
            KSectionHeader(title: isRE ? "Rent, bills & tax entries" : "Costs & history", detail: all.isEmpty ? nil : "\(shown.count)")
            Button { sheet = .entry(nil) } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) }
        }
        if usesUnits {
            Text(active.map { "Entries of \($0["name"].text). Choose Whole property above for the building's own." } ?? "The building's own entries — tax on the structure, a shared repair. Pick a unit above for its rent.")
                .font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
        }
        if years.count > 2 {
            Picker("Year", selection: $year) { ForEach(years, id: \.self) { Text($0).tag($0) } }.pickerStyle(.menu)
        }
        if shown.isEmpty {
            KCard { Text(all.isEmpty ? "Nothing recorded yet. Tap + to add \(isRE ? "rent, a bill or a cost" : "a repair or a cost")." : "No entries in \(year).").font(Theme.footnote).foregroundStyle(Theme.muted) }
        } else {
            KList(items: shown) { r in
                let e = r.value, kind = Rental.kind(Rental.kindOf(e))!, out = !kind.income
                let who = out && Rental.asksWhoPays(kind: kind.key, isRealEstate: isRE) ? Rental.borneBy(e) : nil
                Button { sheet = .entry(e) } label: {
                    KRow(title: kind.label,
                         subtitle: [Fmt.date(e["date"].text), e["period"].truthy ? "for \(Rental.formatPeriod(e["period"].text))" : "", e["description"].text, who.map { $0 == .owner ? "" : $0.short } ?? ""]
                            .filter { !$0.isEmpty }.joined(separator: " · "),
                         value: "\(out ? "−" : "+")\(inr(abs(e["amount"].double)))", valueTone: out ? .negative : .positive)
                }
                .buttonStyle(.plain)
                .contextMenu { Button(role: .destructive) { deleting = .entry(e) } label: { Label("Delete", systemImage: "trash") } }
            }
            Text("Tap to change; long-press to delete. These stay on the asset — they do not count in your monthly income or spending.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
        }
    }

    // MARK: Actions

    private func performDelete(_ d: Delete) async {
        switch d {
        case .entry(let e): message = await store.saveAsset(category: route.categoryId, .entry(itemId: route.itemId, unit: selectedUnit, .delete(id: e["id"].text)), label: "Delete entry · \(item["name"].text)")
        case .service(let s): message = await store.saveAsset(category: route.categoryId, .sublist(itemId: route.itemId, key: "services", .delete(id: s["id"].text)), label: "Delete service · \(item["name"].text)")
        case .receipt(let r): message = await store.saveAsset(category: route.categoryId, .sublist(itemId: route.itemId, key: "receipts", .delete(id: r["url"].text)), label: "Remove receipt · \(item["name"].text)")
        case .unit(let u):
            message = await store.saveAsset(category: route.categoryId, .unit(itemId: route.itemId, .delete(id: u["id"].text)), label: "Delete unit \(u["name"].text)")
            if selectedUnit == u["id"].text { selectedUnit = nil }
        }
    }

    private func attach(data: Data, mime: String, fileName: String) async {
        busy = true; defer { busy = false }
        switch await store.uploadDocument(data, mimeType: mime, fileName: fileName, label: "\(item["name"].text)-receipt") {
        case .failure(let f): message = f.message
        case .success(let url):
            let row: JSONValue = .object(["id": .string(AssetEditing.newId()), "url": .string(url), "name": .string(fileName), "mimeType": .string(mime), "kind": .string("receipt")])
            message = await store.saveAsset(category: route.categoryId, .sublist(itemId: route.itemId, key: "receipts", .add(row)), label: "Add receipt · \(item["name"].text)")
        }
    }

    private func uploadPhoto(_ p: PhotosPickerItem) async {
        defer { photoItem = nil }
        guard let data = try? await p.loadTransferable(type: Data.self) else { message = "That photo could not be read."; return }
        // A phone photo is a dozen megapixels; the Mac keeps it as sent, so shrink it first like the Mac's own upload does for images.
        let jpeg = UIImage(data: data).flatMap { Self.shrink($0, to: 2000).jpegData(compressionQuality: 0.8) } ?? data
        await attach(data: jpeg, mime: "image/jpeg", fileName: "Photo \(Fmt.date(NewTransaction.isoDay(Date()))).jpg")
    }

    private func upload(url: URL) async {
        guard url.startAccessingSecurityScopedResource() else { message = "That file could not be opened."; return }
        defer { url.stopAccessingSecurityScopedResource() }
        guard let data = try? Data(contentsOf: url) else { message = "That file could not be read."; return }
        let isPDF = url.pathExtension.lowercased() == "pdf"
        await attach(data: data, mime: isPDF ? "application/pdf" : (UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "image/jpeg"), fileName: url.lastPathComponent)
    }

    private static func shrink(_ image: UIImage, to maxSide: CGFloat) -> UIImage {
        let longest = max(image.size.width, image.size.height)
        guard longest > maxSide else { return image }
        let scale = maxSide / longest, size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        return UIGraphicsImageRenderer(size: size).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
    }
}
