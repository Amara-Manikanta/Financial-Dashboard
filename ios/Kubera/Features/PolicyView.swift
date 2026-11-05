import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

/// An insurance policy, laid out as the Mac's `PolicyDetails.jsx`: plan, number and term, the contract and premium
/// figures, payout schedule and benefit points, a pending / overdue premium alert, premium history, benefits and
/// claims with their summaries, and the uploaded documents. Rows are added, changed and deleted through the same
/// version-checked, offline-capable ledger writes as other accounts; uploading a document needs the Mac.
struct PolicyView: View {
    @ObservedObject var store: FinanceStore
    let accountId: String

    @State private var sheet: SheetRoute?
    @State private var deleting: Deletion?
    @State private var viewing: JSONValue?
    @State private var message: String?
    @State private var picking = false
    @State private var importing = false
    @State private var photoItem: PhotosPickerItem?
    @State private var busy = false

    private struct SheetRoute: Identifiable { let id = UUID(); let spec: Int; let index: Int?; let row: JSONValue? }
    private struct Deletion { let spec: Int; let index: Int; let row: JSONValue; let what: String }

    private var account: JSONValue { store.data.savingsRaw.array.first { $0["id"].text == accountId } ?? .null }
    private var specs: [AccountLedger.ListSpec] { AccountLedger.lists(for: "policy") }
    private let amber = Color(red: 0.98, green: 0.75, blue: 0.14)
    private let green = Color(red: 0.2, green: 0.83, blue: 0.6)

    var body: some View {
        let raw = account
        let d = raw["policyDetails"]
        let today = NewTransaction.isoDay(Date())
        let c = PolicyPage.calcs(raw, today: today)
        let title = [raw["title"], raw["name"]].first { $0.truthy }?.text ?? "Policy"
        let premiums = raw["premiums"].array
        let docs = raw["documents"].array

        KScreen(refresh: { await store.load() }) {
            if let message { KNotice(message: message) { self.message = nil } }
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    if d["planName"].truthy { Text(d["planName"].text).font(Theme.footnote).foregroundStyle(Theme.muted) }
                    Spacer()
                    KBadge(text: d["status"].text.isEmpty ? "Status" : d["status"].text, tone: d["status"].text == "Active" ? .positive : .warning)
                }
                if d["insurer"].truthy || d["sumAssured"].truthy {
                    Text([d["insurer"].text, d["sumAssured"].truthy ? "Sum assured \(Money.rupees(d["sumAssured"].double))" : ""].filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(Theme.footnote).foregroundStyle(Theme.muted)
                }
            }.padding(.horizontal, 4)

            KCard {
                VStack(alignment: .leading, spacing: 10) {
                    fact("Policy number", d["policyNumber"].text.isEmpty ? "—" : d["policyNumber"].text, mono: true)
                    fact("Term dates", "Start: \(d["startDate"].truthy ? d["startDate"].text : "not recorded")   End: \([d["maturityDate"], d["expiryDate"]].first { $0.truthy }?.text ?? "not recorded")")
                    if d["policyTerm"].truthy || d["premiumPayingTerm"].truthy {
                        fact("Term", [d["policyTerm"].truthy ? "\(d["policyTerm"].text) year term" : "", d["premiumPayingTerm"].truthy ? "paying \(d["premiumPayingTerm"].text) years" : ""].filter { !$0.isEmpty }.joined(separator: " · "))
                    }
                }
            }

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
                stat("Total amount to be paid", c.totalToBePaid, Theme.muted, "Contract value")
                stat("Remaining amount", c.remainingToBePaid, Theme.muted, "Future premium liability")
                stat("Total premium paid", c.totalPaid, Theme.accent, "Total invested capital")
                stat("Amount received back", c.amountReceivedBack, Theme.positive, "Survival benefits / withdrawals")
            }
            stat("Current value", c.currentValue, green, "Paid net of benefits")

            if d["payoutSchedule"].truthy || !d["benefitPoints"].array.isEmpty {
                KCard {
                    VStack(alignment: .leading, spacing: 8) {
                        if d["payoutSchedule"].truthy { Text(d["payoutSchedule"].text).font(Theme.footnote).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true) }
                        ForEach(Array(d["benefitPoints"].array.enumerated()), id: \.offset) { _, p in
                            HStack(alignment: .top, spacing: 8) { Text("•").foregroundStyle(amber); Text(p.text).font(Theme.footnote).foregroundStyle(Theme.muted).fixedSize(horizontal: false, vertical: true) }
                        }
                    }
                }
            }

            if c.overdue > 0 || c.upcoming > 0 {
                let tint = c.overdue > 0 ? Theme.negative : amber
                KCard(tint: tint) {
                    HStack(alignment: .center) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(c.overdue > 0 ? "\(c.overdue) premium\(c.overdue > 1 ? "s" : "") overdue" : "\(c.upcoming) premium\(c.upcoming > 1 ? "s" : "") pending").font(Theme.body.weight(.heavy)).foregroundStyle(tint)
                            if let n = c.nextDue { Text("\(c.overdue > 0 ? "Was due" : "Next due") \(n)").font(Theme.footnote).foregroundStyle(Theme.muted) }
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("AMOUNT PENDING").font(Theme.caption).tracking(0.6).foregroundStyle(Theme.muted)
                            Text(Money.rupees(c.pendingAmount)).font(Theme.figure).foregroundStyle(tint)
                        }
                    }
                }
            }

            header("Premium history", count: premiums.count) { sheet = SheetRoute(spec: 0, index: nil, row: nil) }
            if premiums.isEmpty { KCard { Text("No premiums recorded yet.").font(Theme.footnote).foregroundStyle(Theme.muted) } }
            else {
                KList(items: premiums.enumerated().map { Row(index: $0.offset, raw: $0.element) }) { r in
                    let p = r.raw, pending = p["status"].text == "To Pay", late = pending && p["dueDate"].truthy && p["dueDate"].text < today
                    Button { sheet = SheetRoute(spec: 0, index: r.index, row: p) } label: {
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(p["paidDate"].truthy ? Fmt.date(p["paidDate"].text) : p["dueDate"].truthy ? "Due \(Fmt.date(p["dueDate"].text))" : "—").font(Theme.body).foregroundStyle(.white)
                                if p["status"].text == "Paid", p["receiptNo"].truthy { Text("Receipt: \(p["receiptNo"].text)").font(Theme.footnote).foregroundStyle(Theme.muted) }
                                KBadge(text: late ? "OVERDUE" : p["status"].text, tone: late ? .negative : pending ? .warning : p["status"].text == "Paid" ? .positive : .accent)
                            }
                            Spacer()
                            Text(Money.rupees(p["amount"].double)).font(Theme.figure).foregroundStyle(.white)
                        }
                    }.buttonStyle(.plain)
                    .contextMenu { Button(role: .destructive) { deleting = Deletion(spec: 0, index: r.index, row: p, what: "premium entry") } label: { Label("Delete", systemImage: "trash") } }
                }
                Text("Tap to change; long-press to delete. The policy's paid total is recalculated from the premiums marked Paid.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            }

            records("Benefits", spec: 2, rows: raw["benefits"].array, done: "Received", empty: "No benefits recorded. Add survival, maturity or bonus payouts.",
                    summary: [("Received", c.benefitsReceived, green), ("Expected", c.benefitsExpected, amber)])
            records("Claims", spec: 1, rows: raw["claims"].array, done: "Settled", empty: "No claims recorded.",
                    summary: [("Settled", c.claimsSettled, green), ("Open (\(c.claimsOpenCount))", c.claimsOpenAmount, amber)])

            HStack {
                KSectionHeader(title: "Documents & receipts", detail: docs.isEmpty ? nil : "\(docs.count)")
                if busy { ProgressView() } else {
                    Menu {
                        Button { picking = true } label: { Label("Photo", systemImage: "photo") }
                        Button { importing = true } label: { Label("PDF or file", systemImage: "doc") }
                    } label: { Image(systemName: "plus.circle.fill").font(.system(size: 20)) }
                }
            }
            if docs.isEmpty { KCard { Text("No documents uploaded. Files are stored on your Mac, so adding one needs it nearby.").font(Theme.footnote).foregroundStyle(Theme.muted) } }
            else {
                KList(items: docs.enumerated().map { Row(index: $0.offset, raw: $0.element) }) { r in
                    let url = r.raw["url"].text.lowercased(), pdf = url.hasSuffix(".pdf")
                    Button { viewing = r.raw } label: {
                        KRow(title: r.raw["name"].text.isEmpty ? "Document \(r.index + 1)" : r.raw["name"].text,
                             subtitle: [pdf ? "PDF" : "Image", r.raw["uploadedAt"].truthy ? String(r.raw["uploadedAt"].text.prefix(10)) : ""].filter { !$0.isEmpty }.joined(separator: " · "),
                             systemImage: pdf ? "doc.fill" : "photo", chevron: true)
                    }.buttonStyle(.plain)
                    .contextMenu { Button(role: .destructive) { deleting = Deletion(spec: 3, index: r.index, row: r.raw, what: "document") } label: { Label("Remove", systemImage: "trash") } }
                }
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
        .toolbar { EditRecordButton(store: store, collection: "savings", id: accountId, title: title) }
        .sheet(item: $sheet) { r in LedgerRowSheet(store: store, accountId: accountId, type: "policy", spec: specs[r.spec], parentIndex: nil, index: r.index, editing: r.row) }
        .sheet(item: Binding(get: { viewing.map { ViewerRoute(doc: $0) } }, set: { if $0 == nil { viewing = nil } })) { DocumentViewer(store: store, receipt: $0.doc) }
        .photosPicker(isPresented: $picking, selection: $photoItem, matching: .images)
        .fileImporter(isPresented: $importing, allowedContentTypes: [.pdf, .image]) { result in
            if case .success(let url) = result { Task { await upload(url: url) } }
        }
        .onChange(of: photoItem) { _, item in if let item { Task { await uploadPhoto(item) } } }
        .confirmationDialog(deleting.map { "Delete this \($0.what)?" } ?? "", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let x = deleting { Task { message = await store.saveAccount(accountId, .ledger(specId: specs[x.spec].id, parentIndex: nil, .delete(index: x.index, expected: x.row)), label: "Delete policy \(x.what)") } }
            }
        }
    }

    private struct Row: Identifiable { let index: Int; let raw: JSONValue; var id: Int { index } }
    private struct ViewerRoute: Identifiable { let doc: JSONValue; var id: String { doc["url"].text } }

    private func header(_ title: String, count: Int, add: @escaping () -> Void) -> some View {
        HStack { KSectionHeader(title: title, detail: "\(count)"); Button(action: add) { Image(systemName: "plus.circle.fill").font(.system(size: 20)) } }
    }

    @ViewBuilder private func records(_ title: String, spec: Int, rows: [JSONValue], done: String, empty: String, summary: [(String, Double, Color)]) -> some View {
        header(title, count: rows.count) { sheet = SheetRoute(spec: spec, index: nil, row: nil) }
        if rows.isEmpty { KCard { Text(empty).font(Theme.footnote).foregroundStyle(Theme.muted) } }
        else {
            HStack(spacing: 12) { ForEach(Array(summary.enumerated()), id: \.offset) { _, s in
                KCard(tint: s.2) { VStack(alignment: .leading, spacing: 3) {
                    Text(s.0.uppercased()).font(Theme.caption).tracking(0.6).foregroundStyle(Theme.muted)
                    Text(Money.rupees(s.1)).font(Theme.figure).foregroundStyle(s.2)
                }.frame(maxWidth: .infinity, alignment: .leading) } } }
            KList(items: rows.enumerated().map { Row(index: $0.offset, raw: $0.element) }) { r in
                let x = r.raw, finished = x["status"].text == done, rejected = x["status"].text == "Rejected"
                Button { sheet = SheetRoute(spec: spec, index: r.index, row: x) } label: {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(x["title"].text).font(Theme.body).foregroundStyle(.white)
                            if x["category"].truthy { Text(x["category"].text).font(Theme.footnote).foregroundStyle(Theme.muted) }
                            if x["reference"].truthy { Text(x["reference"].text).font(Theme.footnote).foregroundStyle(Theme.muted) }
                            HStack(spacing: 6) { KBadge(text: x["status"].text.isEmpty ? "—" : x["status"].text, tone: finished ? .positive : rejected ? .negative : .warning)
                                if x["date"].truthy { Text(x["date"].text).font(Theme.footnote).foregroundStyle(Theme.muted) } }
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 3) {
                            Text(Money.rupees(x["amount"].double)).font(Theme.figure).foregroundStyle(.white)
                            if finished { Text(Money.rupees(x["settledAmount"].double != 0 ? x["settledAmount"].double : x["amount"].double)).font(Theme.footnote.weight(.semibold)).foregroundStyle(green)
                                if x["settledDate"].truthy { Text(x["settledDate"].text).font(Theme.caption).foregroundStyle(Theme.muted) } }
                        }
                    }
                }.buttonStyle(.plain)
                .contextMenu { Button(role: .destructive) { deleting = Deletion(spec: spec, index: r.index, row: x, what: title == "Claims" ? "claim" : "benefit") } label: { Label("Delete", systemImage: "trash") } }
            }
        }
    }

    private func fact(_ label: String, _ value: String, mono: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased()).font(Theme.caption).tracking(0.8).foregroundStyle(Theme.muted)
            Text(value).font(mono ? .system(.callout, design: .monospaced).weight(.bold) : Theme.footnote.weight(.semibold)).foregroundStyle(.white)
        }
    }

    private func stat(_ label: String, _ value: Double, _ tint: Color, _ caption: String) -> some View {
        KCard(tint: tint) {
            VStack(alignment: .leading, spacing: 4) {
                Text(label.uppercased()).font(Theme.caption).tracking(0.8).foregroundStyle(tint).lineLimit(2)
                Text(Money.rupees(value)).font(.system(size: 20, weight: .heavy, design: .rounded).monospacedDigit()).foregroundStyle(.white).minimumScaleFactor(0.7).lineLimit(1)
                Text(caption).font(Theme.caption).foregroundStyle(Theme.muted).lineLimit(2)
            }.frame(maxWidth: .infinity, minHeight: 78, alignment: .topLeading)
        }
    }

    // MARK: Documents

    private func attach(data: Data, mime: String, fileName: String) async {
        busy = true; defer { busy = false }
        let name = [account["policyDetails"]["planName"], account["title"]].first { $0.truthy }?.text ?? "policy"
        switch await store.uploadDocument(data, mimeType: mime, fileName: fileName, label: name) {
        case .failure(let f): message = f.message
        case .success(let url):
            let iso = ISO8601DateFormatter(); iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let row: JSONValue = .object(["url": .string(url), "name": .string(fileName), "mimeType": .string(mime), "uploadedAt": .string(iso.string(from: Date()))])
            message = await store.saveAccount(accountId, .ledger(specId: specs[3].id, parentIndex: nil, .add(row)), label: "Add policy document")
        }
    }

    private func uploadPhoto(_ p: PhotosPickerItem) async {
        defer { photoItem = nil }
        guard let data = try? await p.loadTransferable(type: Data.self) else { message = "That photo could not be read."; return }
        // Policy paperwork keeps its resolution (small print must stay readable); only the file size is capped by the Mac.
        let jpeg = UIImage(data: data)?.jpegData(compressionQuality: 0.9) ?? data
        await attach(data: jpeg, mime: "image/jpeg", fileName: "Photo \(Fmt.date(NewTransaction.isoDay(Date()))).jpg")
    }

    private func upload(url: URL) async {
        guard url.startAccessingSecurityScopedResource() else { message = "That file could not be opened."; return }
        defer { url.stopAccessingSecurityScopedResource() }
        guard let data = try? Data(contentsOf: url) else { message = "That file could not be read."; return }
        let isPDF = url.pathExtension.lowercased() == "pdf"
        await attach(data: data, mime: isPDF ? "application/pdf" : (UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "image/jpeg"), fileName: url.lastPathComponent)
    }
}
