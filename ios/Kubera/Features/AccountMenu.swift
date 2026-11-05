import SwiftUI

/// Long-press an account row for Archive / Restore and Delete, as the Mac's Savings and Investments pages offer. One place, used by both lists.
struct AccountMenu: ViewModifier {
    @ObservedObject var store: FinanceStore
    let accountId: String
    @Binding var message: String?
    @State private var confirming = false

    private var account: JSONValue { store.data.savingsRaw.array.first { $0["id"].text == accountId } ?? .null }

    func body(content: Content) -> some View {
        content
            .contextMenu {
                if !account.isNull {
                    let archived = account["isArchived"].truthy
                    if account["type"].text != "stock_market" {
                        Button { Task { message = await store.setAccountArchived(account, !archived) } } label: { Label(archived ? "Restore" : "Archive", systemImage: archived ? "tray.and.arrow.up" : "archivebox") }
                    }
                    Button(role: .destructive) { confirming = true } label: { Label("Delete", systemImage: "trash") }
                }
            }
            .confirmationDialog("Delete \(account["title"].text)?", isPresented: $confirming, titleVisibility: .visible) {
                Button("Delete", role: .destructive) { Task { message = await store.deleteAccount(account) } }
            } message: { Text("It is removed from your Mac with everything in it. Archive it instead to keep the history.") }
    }
}

extension View {
    func accountMenu(_ store: FinanceStore, _ id: String, message: Binding<String?>) -> some View { modifier(AccountMenu(store: store, accountId: id, message: message)) }
}
