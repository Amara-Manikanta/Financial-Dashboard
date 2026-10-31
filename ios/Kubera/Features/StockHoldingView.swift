import SwiftUI
import Charts

/// 52-week and day ranges from the holding's last stored quote, drawn as bars. The position is a
/// fact about where the price sits in the range, not a verdict. Draws nothing without a quote.
struct StockRanges: View {
    let raw: JSONValue
    let price: Double

    private func position(_ low: Double, _ high: Double) -> Double? {
        high > low ? max(0, min(100, (price - low) / (high - low) * 100)) : nil
    }

    var body: some View {
        let q = raw["quote"]
        let yearLow = q["fiftyTwoWeekLow"].double, yearHigh = q["fiftyTwoWeekHigh"].double
        let dayLow = q["dayLow"].double, dayHigh = q["dayHigh"].double
        VStack(alignment: .leading, spacing: 12) {
            if let pos = position(yearLow, yearHigh) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("52-WEEK RANGE").font(Theme.caption).tracking(1.0).foregroundStyle(Theme.muted)
                        Spacer()
                        Text("\(Int(pos.rounded()))% of the way up").font(Theme.footnote).foregroundStyle(Theme.muted)
                    }
                    RangeBar(position: pos, low: yearLow, high: yearHigh)
                    if yearHigh > 0 && price > 0 {
                        Text("\(String(format: "%.1f", (yearHigh - price) / yearHigh * 100))% below the high · \(String(format: "%.1f", (price - yearLow) / yearLow * 100))% above the low")
                            .font(Theme.footnote).foregroundStyle(Theme.muted)
                    }
                }
            }
            if let pos = position(dayLow, dayHigh) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("TODAY'S RANGE").font(Theme.caption).tracking(1.0).foregroundStyle(Theme.muted)
                    RangeBar(position: pos, low: dayLow, high: dayHigh)
                }
            }
        }
    }
}

/// One stock holding: its position, dividend record, news and every transaction, which can be
/// added to, changed and removed. Each save replays the holding's shares, average cost and
/// dividends from the whole history (`StockLedger`), as the Mac's stock page does.
struct HoldingView: View {
    @ObservedObject var store: FinanceStore
    let holdingId: String

    @State private var sheet: SheetRoute?
    @State private var deleting: JSONValue?
    @State private var message: String?
    @State private var fundamentals: JSONValue?
    @State private var fundamentalsDone = false

    private struct SheetRoute: Identifiable { let id = UUID(); let tx: JSONValue? }

    private var holding: Stocks.Holding? { store.portfolio.holdings.first { $0.id == holdingId } }

    private struct Row: Identifiable { let id: Int; let tx: JSONValue }

    var body: some View {
        if let holding { content(holding) } else { KScreen { KCard { Text("This holding is no longer active.").font(Theme.footnote).foregroundStyle(Theme.muted) } } }
    }

    private func content(_ holding: Stocks.Holding) -> some View {
        let history = holding.raw["transactions"].array.enumerated()
            .sorted { $0.element["date"].text > $1.element["date"].text }
            .map { Row(id: $0.offset, tx: $0.element) }
        let lock = StockLedger.holdingLock(holding.raw)
        let dividends = dividendYears(holding.raw)
        return KScreen {
            if let message { KNotice(message: message) { self.message = nil } }
            KCard {
                KStat(label: "Value", value: Money.rupees(holding.value), size: .hero)
                HStack(alignment: .top) {
                    KStat(label: "Gain", value: Fmt.signed(holding.gain), tone: Tone.of(holding.gain), caption: Fmt.percent(holding.gainPercent))
                    Spacer()
                    KStat(label: "Invested", value: Money.rupees(holding.invested))
                }
                .padding(.top, 10)
            }
            KCard {
                HStack(alignment: .top) {
                    KStat(label: "Shares", value: Fmt.shares(holding.shares))
                    Spacer()
                    KStat(label: "Avg cost", value: Money.rupees(holding.avgCost))
                    Spacer()
                    KStat(label: "Price", value: Money.rupees(holding.price))
                }
                if !holding.sector.isEmpty { KBadge(text: holding.sector).padding(.top, 10) }
            }
            if holding.raw["quote"]["fiftyTwoWeekHigh"].double > 0 {
                KCard { StockRanges(raw: holding.raw, price: holding.price) }
            }

            fundamentalsCard(holding)

            dividendCard(holding, years: dividends)

            if !holding.ticker.isEmpty {
                NavigationLink {
                    StockNewsView(store: store, symbol: StockNewsView.symbol(for: holding.ticker), name: holding.name)
                } label: {
                    KCard { KRow(title: "News & analysis", subtitle: "Stories, key points and Claude's brief", systemImage: "newspaper", chevron: true) }
                }
                .buttonStyle(.plain)
            }

            KSectionHeader(title: "Transactions", detail: "\(history.count)")
            if let lock { Text(lock).font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4) }
            if history.isEmpty {
                KCard { Text("No transactions recorded.").font(Theme.footnote).foregroundStyle(Theme.muted) }
            } else {
                KList(items: history) { row in
                    let rowLock = lock ?? StockLedger.rowLock(row.tx)
                    Button { if rowLock == nil { sheet = SheetRoute(tx: row.tx) } } label: { transaction(row.tx) }
                        .buttonStyle(.plain)
                        .contextMenu {
                            if rowLock == nil {
                                Button { sheet = SheetRoute(tx: row.tx) } label: { Label("Edit", systemImage: "pencil") }
                                Button(role: .destructive) { deleting = row.tx } label: { Label("Delete", systemImage: "trash") }
                            }
                        }
                }
                Text("Tap a transaction to change it; long-press to delete.").font(Theme.footnote).foregroundStyle(Theme.muted).padding(.horizontal, 4)
            }
        }
        .navigationTitle(holding.name)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: holding.ticker) {
            guard !holding.ticker.isEmpty else { fundamentalsDone = true; return }
            fundamentals = await store.fundamentals(for: StockNewsView.symbol(for: holding.ticker))
            fundamentalsDone = true
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { sheet = SheetRoute(tx: nil) } label: { Image(systemName: "plus") }.disabled(lock != nil)
            }
        }
        .sheet(item: $sheet) { route in
            StockTransactionSheet(store: store, holdingId: holdingId, history: holding.raw["transactions"].array, editing: route.tx)
        }
        .confirmationDialog("Delete this transaction?", isPresented: Binding(get: { deleting != nil }, set: { if !$0 { deleting = nil } }), titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                if let tx = deleting { Task { message = await store.saveStockTransaction(holding: holdingId, change: .delete(id: tx["id"].text)) } }
            }
        } message: {
            if let tx = deleting { Text(summary(tx)) }
        }
    }

    // MARK: Fundamentals — signal and earnings

    private struct Quarter: Identifiable { let id: String; let series: String; let value: Double }

    private func signalTone(_ action: String) -> Tone {
        switch action {
        case "strong_buy", "buy": return .positive
        case "sell": return .negative
        default: return .warning
        }
    }

    /// The Mac's fundamentals read (`/api/stock-financials`): Buy / Hold / Trim / Exit signal, the five
    /// health checks and the last quarters' revenue and earnings. A reading of reported figures, not a forecast.
    @ViewBuilder private func fundamentalsCard(_ holding: Stocks.Holding) -> some View {
        if let f = fundamentals {
            let signal = f["signal"], health = f["healthScore"]
            let quarters = f["quarterly"].array
            KSectionHeader(title: "Buy · Hold · Exit", detail: health["total"].isNull ? nil : "health \(Int(health["total"].double))/\(Int(health["max"].double))")
            KCard {
                HStack(alignment: .firstTextBaseline) {
                    Text(signal["label"].text).font(.system(size: 20, weight: .heavy, design: .rounded)).foregroundStyle(signalTone(signal["action"].text).color)
                    Spacer()
                    if health["label"].truthy { KBadge(text: health["label"].text, tone: signalTone(signal["action"].text)) }
                }
                ForEach(Array(signal["reasons"].array.enumerated()), id: \.offset) { _, reason in
                    HStack(alignment: .firstTextBaseline, spacing: 6) {
                        Text("•").foregroundStyle(Theme.accent)
                        Text(reason.text).font(Theme.footnote).foregroundStyle(.white.opacity(0.85))
                    }
                    .padding(.top, 4)
                }
                ForEach(Array(health["checks"].array.enumerated()), id: \.offset) { _, check in
                    HStack(alignment: .firstTextBaseline) {
                        Image(systemName: check["status"].text == "good" ? "checkmark.circle.fill" : check["status"].text == "bad" ? "xmark.circle.fill" : "minus.circle.fill")
                            .foregroundStyle(check["status"].text == "good" ? Tone.positive.color : check["status"].text == "bad" ? Tone.negative.color : Tone.warning.color)
                        Text(check["name"].text).font(Theme.footnote).foregroundStyle(.white)
                        Spacer()
                        Text(check["detail"].text).font(Theme.footnote).foregroundStyle(Theme.muted).multilineTextAlignment(.trailing)
                    }
                    .padding(.top, 6)
                }
                Text("From the company's reported figures on your Mac. A reading of the business, not a price forecast or advice.")
                    .font(Theme.footnote).foregroundStyle(Theme.muted.opacity(0.8)).padding(.top, 8)
            }

            if !quarters.isEmpty {
                let bars = quarters.flatMap { q in
                    [Quarter(id: q["date"].text + "r", series: "Revenue", value: q["revenue"].double / 1e9),
                     Quarter(id: q["date"].text + "e", series: "Earnings", value: q["earnings"].double / 1e9)]
                }
                KSectionHeader(title: "Quarterly earnings", detail: "₹ billion")
                KCard {
                    Chart(bars) { b in
                        BarMark(x: .value("Quarter", String(b.id.dropLast())), y: .value("₹ bn", b.value))
                            .position(by: .value("Series", b.series))
                            .foregroundStyle(by: .value("Series", b.series))
                    }
                    .chartForegroundStyleScale(["Revenue": Theme.accent.opacity(0.55), "Earnings": Theme.positive])
                    .chartYAxis { AxisMarks(position: .leading) { AxisGridLine().foregroundStyle(Theme.muted.opacity(0.15)); AxisValueLabel().foregroundStyle(Theme.muted) } }
                    .chartXAxis { AxisMarks { AxisValueLabel().foregroundStyle(Theme.muted) } }
                    .chartLegend(position: .bottom)
                    .frame(height: 170)
                    ForEach(Array(quarters.enumerated()), id: \.offset) { _, q in
                        HStack {
                            Text(q["date"].text).font(Theme.footnote).foregroundStyle(Theme.muted)
                            Spacer()
                            Text("Earned \(q["earningsFmt"].text) · \(String(format: "%.1f", q["profitMargin"].double))% margin")
                                .font(Theme.footnote.monospacedDigit()).foregroundStyle(q["earnings"].double < 0 ? Tone.negative.color : .white)
                        }
                        .padding(.top, 4)
                    }
                }
            }
        } else if !fundamentalsDone {
            KCard { HStack { ProgressView(); Text("Reading fundamentals from your Mac…").font(Theme.footnote).foregroundStyle(Theme.muted) } }
        }
    }

    // MARK: Dividends

    private struct YearAmount: Identifiable { let year: String; let amount: Double; var id: String { year } }

    /// The last five calendar years, as the Mac's chart draws them: what the holding has stored,
    /// else what its dividend rows add up to.
    private func dividendYears(_ raw: JSONValue) -> [YearAmount] {
        let stored = raw["dividends"].object.mapValues { $0.double }
        let replayed = Stocks.replay(raw["transactions"].array).dividends
        let current = Calendar.current.component(.year, from: Date())
        return (0..<5).reversed().map { offset in
            let year = String(current - offset)
            return YearAmount(year: year, amount: stored[year] ?? replayed[year] ?? 0)
        }
    }

    @ViewBuilder private func dividendCard(_ holding: Stocks.Holding, years: [YearAmount]) -> some View {
        let rows = holding.raw["transactions"].array.filter { $0["type"].text == "dividend" }
        let all = Stocks.replay(holding.raw["transactions"].array).dividends
        let stored = holding.raw["dividends"].object.mapValues { $0.double }
        let total = Set(all.keys).union(stored.keys).reduce(0.0) { $0 + (stored[$1] ?? all[$1] ?? 0) }
        if !rows.isEmpty || total > 0 {
            KSectionHeader(title: "Dividends", detail: rows.isEmpty ? nil : "\(rows.count) payment\(rows.count == 1 ? "" : "s")")
            KCard {
                HStack(alignment: .top) {
                    KStat(label: "Total received", value: Money.rupees(total), tone: .positive)
                    Spacer()
                    if holding.invested > 0 { KStat(label: "Yield on cost", value: String(format: "%.1f%%", total / holding.invested * 100)) }
                }
                Chart(years) { y in
                    BarMark(x: .value("Year", y.year), y: .value("Dividend", y.amount))
                        .foregroundStyle(y.amount > 0 ? Theme.positive : Theme.muted.opacity(0.3))
                        .annotation(position: .top) {
                            if y.amount > 0 { Text(Money.compact(y.amount)).font(.system(size: 10, weight: .semibold)).foregroundStyle(Theme.muted) }
                        }
                }
                .chartYAxis { AxisMarks(position: .leading) { AxisGridLine().foregroundStyle(Theme.muted.opacity(0.15)); AxisValueLabel().foregroundStyle(Theme.muted) } }
                .chartXAxis { AxisMarks { AxisValueLabel().foregroundStyle(Theme.muted) } }
                .frame(height: 150)
                .padding(.top, 8)
                Text("Last five years, gross of tax withheld.").font(Theme.footnote).foregroundStyle(Theme.muted)
            }
        }
    }

    // MARK: Rows

    private func summary(_ tx: JSONValue) -> String {
        "\(tx["type"].text.capitalized) · \(Fmt.date(tx["date"].text))"
    }

    private func transaction(_ tx: JSONValue) -> some View {
        let type = tx["type"].text
        if type == "dividend" {
            let read = Dividends.read(tx)
            return KRow(title: "Dividend", subtitle: Fmt.date(tx["date"].text),
                        value: Money.rupees(read.gross), valueTone: .positive,
                        valueCaption: read.hasTds ? "TDS \(Money.rupees(read.tds)) · net \(Money.rupees(read.net))" : nil)
        }
        let money = tx["quantity"].double * tx["price"].double
        let caption: String? = {
            switch type {
            case "split": return tx["splitFrom"].truthy && tx["splitTo"].truthy ? "\(RecordEditing.number(tx["splitFrom"].double)):\(RecordEditing.number(tx["splitTo"].double))" : "+\(Fmt.shares(tx["quantity"].double))"
            case "bonus": return "+\(Fmt.shares(tx["quantity"].double)) shares"
            case "demerger": return "adjusted"
            default: return "\(Fmt.shares(tx["quantity"].double)) @ \(Money.rupees(tx["price"].double))"
            }
        }()
        return KRow(title: type.capitalized, subtitle: Fmt.date(tx["date"].text),
                    value: ["bonus", "split", "demerger"].contains(type) ? nil : Money.rupees(money), valueCaption: caption)
    }
}

/// Add or change one transaction. Nothing is sent until Save, and a refusal says why and changes nothing.
private struct StockTransactionSheet: View {
    @ObservedObject var store: FinanceStore
    let holdingId: String
    let history: [JSONValue]
    let editing: JSONValue?

    @Environment(\.dismiss) private var dismiss
    @State private var draft = StockLedger.Draft()
    @State private var saving = false
    @State private var message: String?

    private var editingId: String? { editing.map { $0["id"].text } }
    private var problems: [String] { StockLedger.problems(draft, history: history, editing: editingId) }

    var body: some View {
        NavigationStack {
            Form {
                if let message { Section { Text(message).foregroundStyle(Tone.negative.color) } }
                Section {
                    Picker("Type", selection: $draft.kind) { ForEach(StockLedger.Kind.allCases) { Text($0.label).tag($0) } }
                    DatePicker("Date", selection: Binding(get: { Self.day.date(from: draft.date) ?? Date() }, set: { draft.date = Self.day.string(from: $0) }), displayedComponents: .date)
                    if draft.kind == .split {
                        field("Ratio from", $draft.splitFrom)
                        field("Ratio to", $draft.splitTo)
                    } else if draft.kind.needsQuantity {
                        field(draft.kind == .bonus ? "Bonus shares" : "Quantity", $draft.quantity)
                    }
                    if draft.kind.needsPrice { field(draft.kind == .dividend ? "Total dividend amount" : "Price per share", $draft.price) }
                }
                if draft.kind == .dividend {
                    Section {
                        field("Tax deducted (TDS)", $draft.tds)
                        Toggle("The amount above was credited, after tax", isOn: $draft.amountIsNet)
                        if let tds = Double(draft.tds), tds > 0, let amount = Double(draft.price) {
                            let gross = draft.amountIsNet ? amount + tds : amount
                            Text("Gross \(Money.rupees(gross)) · TDS \(Money.rupees(tds)) · Net \(Money.rupees(gross - tds))").font(.footnote).foregroundStyle(.secondary)
                        }
                    } footer: {
                        Text("REITs and InvITs withhold 10% from the first rupee; ordinary companies only above ₹10,000 a year from one company (₹5,000 before FY 2025-26).")
                    }
                }
                if !problems.isEmpty && (editing != nil || draft != StockLedger.Draft()) {
                    Section { ForEach(problems, id: \.self) { Text($0).font(.footnote).foregroundStyle(Tone.negative.color) } }
                }
            }
            .navigationTitle(editing == nil ? "Add transaction" : "Edit transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else { Button("Save") { Task { await save() } }.disabled(!problems.isEmpty) }
                }
            }
            .onAppear { if let editing { draft = StockLedger.draft(from: editing) } }
        }
    }

    private func field(_ label: String, _ text: Binding<String>) -> some View {
        LabeledContent(label) { TextField(label, text: text).keyboardType(.decimalPad).multilineTextAlignment(.trailing) }
    }

    private static let day: DateFormatter = {
        let f = DateFormatter(); f.calendar = Calendar(identifier: .gregorian); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyy-MM-dd"; return f
    }()

    private func save() async {
        saving = true; message = nil
        let change: StockLedger.Change
        if let editing { change = .replace(id: editing["id"].text, StockLedger.row(draft, id: editing["id"].text, base: editing)) }
        else { change = .add(StockLedger.row(draft, id: StockLedger.newId())) }
        let failure = await store.saveStockTransaction(holding: holdingId, change: change)
        saving = false
        if let failure { message = failure } else { dismiss() }
    }
}
