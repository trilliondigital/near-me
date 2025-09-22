import SwiftUI

struct ContentView: View {
    @EnvironmentObject var locationManager: LocationManager
    @EnvironmentObject var notificationManager: NotificationManager
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("Near Me")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Location-aware reminders")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                // Placeholder for main content
                VStack(spacing: 16) {
                    Text("Welcome to Near Me")
                        .font(.title2)
                    
                    Text("Get reminded when you're near the right places")
                        .multilineTextAlignment(.center)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
            }
            .padding()
            .navigationBarHidden(true)
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environmentObject(LocationManager())
            .environmentObject(NotificationManager())
    }
}