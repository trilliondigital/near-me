import SwiftUI
import CoreData

struct ItemsSheet: View {
    let items: FetchedResults<Item>
    let addItem: () -> Void
    let deleteItems: (IndexSet) -> Void

    var body: some View {
        NavigationStack {
            List {
                ForEach(items) { item in
                    Text((item.timestamp ?? Date()), format: .dateTime)
                }
                .onDelete(perform: deleteItems)
            }
            .navigationTitle("Items")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    EditButton()
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: addItem) {
                        Image(systemName: "plus")
                    }
                }
            }
        }
    }
}

#Preview {
    NavigationStack { Text("ItemsSheet Preview") }
}
