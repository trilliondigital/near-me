import SwiftUI
import CoreLocation
import UserNotifications

@main
struct NearMeApp: App {
    @StateObject private var locationManager = LocationManager()
    @StateObject private var notificationManager = NotificationManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(locationManager)
                .environmentObject(notificationManager)
                .onAppear {
                    setupApp()
                }
        }
    }
    
    private func setupApp() {
        // Request location permissions
        locationManager.requestLocationPermission()
        
        // Request notification permissions
        notificationManager.requestNotificationPermission()
    }
}