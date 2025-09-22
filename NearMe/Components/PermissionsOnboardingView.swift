import SwiftUI
import CoreLocation
import UserNotifications

// MARK: - Permissions Onboarding View
struct PermissionsOnboardingView: View {
    @ObservedObject var onboardingManager: OnboardingManager
    @EnvironmentObject var locationManager: LocationManager
    @EnvironmentObject var notificationManager: NotificationManager
    
    @State private var showingLocationPermissionAlert = false
    @State private var showingNotificationPermissionAlert = false
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.xl) {
            Spacer()
            
            // Title
            VStack(spacing: DesignSystem.Spacing.sm) {
                Text("Permissions")
                    .font(DesignSystem.Typography.title1)
                    .fontWeight(.bold)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text("We need a few permissions to work properly")
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            
            // Permission Cards
            VStack(spacing: DesignSystem.Spacing.md) {
                PermissionCard(
                    icon: "location.fill",
                    title: "Location Access",
                    description: "Required to detect when you're near relevant places",
                    status: locationPermissionStatus,
                    action: requestLocationPermission
                )
                
                PermissionCard(
                    icon: "bell.fill",
                    title: "Notifications",
                    description: "Required to send you timely reminders",
                    status: notificationPermissionStatus,
                    action: requestNotificationPermission
                )
            }
            
            // Benefits Section
            VStack(spacing: DesignSystem.Spacing.md) {
                Text("Why we need these permissions:")
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                VStack(spacing: DesignSystem.Spacing.sm) {
                    PermissionBenefit(
                        icon: "location.circle.fill",
                        text: "Location access lets us create geofences around your important places"
                    )
                    
                    PermissionBenefit(
                        icon: "bell.circle.fill",
                        text: "Notifications ensure you never miss important reminders"
                    )
                    
                    PermissionBenefit(
                        icon: "shield.fill",
                        text: "Your location data stays on your device and is never shared"
                    )
                }
            }
            
            // Privacy Notice
            BaseCard(
                backgroundColor: DesignSystem.Colors.surface,
                padding: DesignSystem.Spacing.md
            ) {
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                    HStack {
                        Image(systemName: "lock.fill")
                            .foregroundColor(DesignSystem.Colors.primary)
                        Text("Privacy Promise")
                            .font(DesignSystem.Typography.bodyEmphasized)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                    }
                    
                    Text("We use your location only to provide location-based reminders. All processing happens on your device, and we never store or share your location data.")
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
            }
            
            Spacer()
        }
        .padding(.horizontal, DesignSystem.Spacing.padding)
        .alert("Location Permission Required", isPresented: $showingLocationPermissionAlert) {
            Button("Open Settings") {
                openAppSettings()
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Please enable location access in Settings to use location-based reminders.")
        }
        .alert("Notification Permission Required", isPresented: $showingNotificationPermissionAlert) {
            Button("Open Settings") {
                openAppSettings()
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Please enable notifications in Settings to receive reminders.")
        }
    }
    
    // MARK: - Permission Status
    private var locationPermissionStatus: PermissionStatus {
        switch locationManager.authorizationStatus {
        case .authorizedAlways:
            return .granted
        case .authorizedWhenInUse:
            return .partial
        case .denied, .restricted:
            return .denied
        case .notDetermined:
            return .notRequested
        @unknown default:
            return .notRequested
        }
    }
    
    private var notificationPermissionStatus: PermissionStatus {
        switch notificationManager.authorizationStatus {
        case .authorized:
            return .granted
        case .denied:
            return .denied
        case .notDetermined:
            return .notRequested
        case .provisional:
            return .partial
        case .ephemeral:
            return .partial
        @unknown default:
            return .notRequested
        }
    }
    
    // MARK: - Actions
    private func requestLocationPermission() {
        switch locationManager.authorizationStatus {
        case .notDetermined:
            locationManager.requestLocationPermission()
        case .denied, .restricted:
            showingLocationPermissionAlert = true
        case .authorizedWhenInUse:
            locationManager.requestAlwaysAuthorization()
        case .authorizedAlways:
            break
        @unknown default:
            break
        }
    }
    
    private func requestNotificationPermission() {
        switch notificationManager.authorizationStatus {
        case .notDetermined:
            notificationManager.requestNotificationPermission()
        case .denied:
            showingNotificationPermissionAlert = true
        case .authorized, .provisional, .ephemeral:
            break
        @unknown default:
            break
        }
    }
    
    private func openAppSettings() {
        if let settingsUrl = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(settingsUrl)
        }
    }
}

// MARK: - Permission Card
struct PermissionCard: View {
    let icon: String
    let title: String
    let description: String
    let status: PermissionStatus
    let action: () -> Void
    
    enum PermissionStatus {
        case notRequested
        case partial
        case granted
        case denied
        
        var color: Color {
            switch self {
            case .notRequested: return DesignSystem.Colors.textSecondary
            case .partial: return DesignSystem.Colors.warning
            case .granted: return DesignSystem.Colors.success
            case .denied: return DesignSystem.Colors.error
            }
        }
        
        var icon: String {
            switch self {
            case .notRequested: return "questionmark.circle"
            case .partial: return "exclamationmark.triangle.fill"
            case .granted: return "checkmark.circle.fill"
            case .denied: return "xmark.circle.fill"
            }
        }
        
        var buttonTitle: String {
            switch self {
            case .notRequested: return "Allow"
            case .partial: return "Enable Full Access"
            case .granted: return "Enabled"
            case .denied: return "Open Settings"
            }
        }
        
        var isButtonEnabled: Bool {
            return self != .granted
        }
    }
    
    var body: some View {
        BaseCard {
            VStack(spacing: DesignSystem.Spacing.md) {
                HStack {
                    Image(systemName: icon)
                        .font(.title2)
                        .foregroundColor(DesignSystem.Colors.primary)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title)
                            .font(DesignSystem.Typography.bodyEmphasized)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                        
                        Text(description)
                            .font(DesignSystem.Typography.caption1)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                    }
                    
                    Spacer()
                    
                    Image(systemName: status.icon)
                        .font(.title3)
                        .foregroundColor(status.color)
                }
                
                if status.isButtonEnabled {
                    Button(action: action) {
                        Text(status.buttonTitle)
                            .font(DesignSystem.Typography.caption1)
                            .fontWeight(.medium)
                            .foregroundColor(DesignSystem.Colors.primary)
                            .padding(.horizontal, DesignSystem.Spacing.md)
                            .padding(.vertical, DesignSystem.Spacing.sm)
                            .background(
                                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.sm)
                                    .stroke(DesignSystem.Colors.primary, lineWidth: 1)
                            )
                    }
                }
            }
        }
    }
}

// MARK: - Permission Benefit
struct PermissionBenefit: View {
    let icon: String
    let text: String
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.sm) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundColor(DesignSystem.Colors.primary)
                .frame(width: 20)
            
            Text(text)
                .font(DesignSystem.Typography.caption1)
                .foregroundColor(DesignSystem.Colors.textSecondary)
            
            Spacer()
        }
    }
}

// MARK: - Previews
struct PermissionsOnboardingView_Previews: PreviewProvider {
    static var previews: some View {
        PermissionsOnboardingView(onboardingManager: OnboardingManager())
            .environmentObject(LocationManager())
            .environmentObject(NotificationManager())
    }
}
