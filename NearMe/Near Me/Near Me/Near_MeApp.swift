//
//  Near_MeApp.swift
//  Near Me
//
//  Created by Kaegan Braud on 9/22/25.
//

import SwiftUI
import CoreData

@main
struct Near_MeApp: App {
    let persistenceController = PersistenceController.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.managedObjectContext, persistenceController.container.viewContext)
        }
    }
}
