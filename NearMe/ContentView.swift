import SwiftUI

struct ContentView: View {
    @EnvironmentObject var locationManager: LocationManager
    @EnvironmentObject var notificationManager: NotificationManager
    @StateObject private var onboardingManager = OnboardingManager()
    
    var body: some View {
        Group {
            if onboardingManager.isOnboardingComplete {
                MainAppView()
            } else {
                OnboardingContainer(onboardingManager: onboardingManager)
            }
        }
        .environmentObject(onboardingManager)
    }
}

// MARK: - Main App View
struct MainAppView: View {
    @EnvironmentObject var locationManager: LocationManager
    @EnvironmentObject var notificationManager: NotificationManager
    @EnvironmentObject var onboardingManager: OnboardingManager
    
    var body: some View {
        TaskDashboardView()
            .environmentObject(locationManager)
            .environmentObject(notificationManager)
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environmentObject(LocationManager())
            .environmentObject(NotificationManager())
    }
}