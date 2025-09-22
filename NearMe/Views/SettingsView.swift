import SwiftUI

// MARK: - Settings View
struct SettingsView: View {
    @EnvironmentObject var navigationCoordinator: NavigationCoordinator
    @EnvironmentObject var locationManager: LocationManager
    @EnvironmentObject var notificationManager: NotificationManager
    @State private var settings: AppSettings = AppSettings()
    @State private var showingLocationPermissionAlert = false
    @State private var showingNotificationPermissionAlert = false
    
    var body: some View {
        NavigationWrapper(title: "Settings") {
            ScrollView {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    // Profile Section
                    ProfileSection()
                    
                    // Subscription Section
                    SubscriptionSection()
                    
                    // Location Settings
                    SettingsSection(title: "Location") {
                        VStack(spacing: DesignSystem.Spacing.md) {
                            ToggleField(
                                title: "Location Services",
                                isOn: Binding(
                                    get: { locationManager.isLocationEnabled },
                                    set: { _ in }
                                ),
                                description: "Required for location-based reminders"
                            )
                            
                            if !locationManager.isLocationEnabled {
                                PrimaryButton(
                                    title: "Enable Location Services",
                                    action: {
                                        showingLocationPermissionAlert = true
                                    }
                                )
                            }
                            
                            ToggleField(
                                title: "Background Location",
                                isOn: $settings.backgroundLocationEnabled,
                                description: "Allow location tracking when app is closed"
                            )
                            
                            SliderField(
                                title: "Location Accuracy",
                                value: $settings.locationAccuracy,
                                range: 0.1...1.0,
                                step: 0.1,
                                unit: " km",
                                description: "Higher accuracy uses more battery"
                            )
                        }
                    }
                    
                    // Notification Settings
                    SettingsSection(title: "Notifications") {
                        VStack(spacing: DesignSystem.Spacing.md) {
                            ToggleField(
                                title: "Push Notifications",
                                isOn: Binding(
                                    get: { notificationManager.isNotificationEnabled },
                                    set: { _ in }
                                ),
                                description: "Receive notifications when near tasks"
                            )
                            
                            if !notificationManager.isNotificationEnabled {
                                PrimaryButton(
                                    title: "Enable Notifications",
                                    action: {
                                        showingNotificationPermissionAlert = true
                                    }
                                )
                            }
                            
                            ToggleField(
                                title: "Sound",
                                isOn: $settings.notificationSound,
                                description: "Play sound with notifications"
                            )
                            
                            ToggleField(
                                title: "Vibration",
                                isOn: $settings.notificationVibration,
                                description: "Vibrate with notifications"
                            )
                            
                            ToggleField(
                                title: "Do Not Disturb",
                                isOn: $settings.doNotDisturbEnabled,
                                description: "Respect system Do Not Disturb settings"
                            )
                            
                            if settings.doNotDisturbEnabled {
                                VStack(spacing: DesignSystem.Spacing.sm) {
                                    ToggleField(
                                        title: "Quiet Hours",
                                        isOn: $settings.quietHoursEnabled,
                                        description: "Disable notifications during set hours"
                                    )
                                    
                                    if settings.quietHoursEnabled {
                                        HStack {
                                            Text("From:")
                                                .font(DesignSystem.Typography.body)
                                                .foregroundColor(DesignSystem.Colors.textPrimary)
                                            
                                            DatePicker(
                                                "",
                                                selection: $settings.quietHoursStart,
                                                displayedComponents: .hourAndMinute
                                            )
                                            .labelsHidden()
                                            
                                            Text("To:")
                                                .font(DesignSystem.Typography.body)
                                                .foregroundColor(DesignSystem.Colors.textPrimary)
                                            
                                            DatePicker(
                                                "",
                                                selection: $settings.quietHoursEnd,
                                                displayedComponents: .hourAndMinute
                                            )
                                            .labelsHidden()
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    // Task Settings
                    SettingsSection(title: "Tasks") {
                        VStack(spacing: DesignSystem.Spacing.md) {
                            SliderField(
                                title: "Default Radius",
                                value: $settings.defaultTaskRadius,
                                range: 0.1...5.0,
                                step: 0.1,
                                unit: " mi",
                                description: "Default distance for new tasks"
                            )
                            
                            ToggleField(
                                title: "Auto-complete Tasks",
                                isOn: $settings.autoCompleteTasks,
                                description: "Automatically mark tasks as completed when leaving location"
                            )
                            
                            ToggleField(
                                title: "Task Reminders",
                                isOn: $settings.taskRemindersEnabled,
                                description: "Send reminders before arriving at task locations"
                            )
                            
                            if settings.taskRemindersEnabled {
                                SliderField(
                                    title: "Reminder Time",
                                    value: $settings.reminderTimeMinutes,
                                    range: 5...60,
                                    step: 5,
                                    unit: " min",
                                    description: "How early to send reminders"
                                )
                            }
                        }
                    }
                    
                    // Privacy Settings
                    SettingsSection(title: "Privacy & Data") {
                        VStack(spacing: DesignSystem.Spacing.md) {
                            SettingsRow(
                                title: "Privacy Settings",
                                icon: "hand.raised.fill",
                                subtitle: "Location mode, data controls",
                                action: {
                                    navigationCoordinator.navigateTo(.privacySettings)
                                }
                            )
                            
                            SettingsRow(
                                title: "Privacy Policy",
                                icon: "doc.text",
                                action: {
                                    navigationCoordinator.navigateTo(.privacy)
                                }
                            )
                            
                            SettingsRow(
                                title: "Terms of Service",
                                icon: "doc.plaintext",
                                action: {
                                    navigationCoordinator.navigateTo(.terms)
                                }
                            )
                        }
                    }
                    
                    // App Information
                    SettingsSection(title: "About") {
                        VStack(spacing: DesignSystem.Spacing.md) {
                            SettingsRow(
                                title: "App Version",
                                icon: "info.circle",
                                subtitle: "1.0.0",
                                action: {}
                            )
                            
                            SettingsRow(
                                title: "About Near Me",
                                icon: "questionmark.circle",
                                action: {
                                    navigationCoordinator.navigateTo(.about)
                                }
                            )
                            
                            SettingsRow(
                                title: "Support",
                                icon: "questionmark.bubble",
                                action: {
                                    // TODO: Implement support
                                }
                            )
                        }
                    }
                }
                .padding()
            }
        }
        .alert("Location Permission Required", isPresented: $showingLocationPermissionAlert) {
            Button("Settings") {
                if let settingsUrl = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(settingsUrl)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Please enable location services in Settings to use location-based reminders.")
        }
        .alert("Notification Permission Required", isPresented: $showingNotificationPermissionAlert) {
            Button("Settings") {
                if let settingsUrl = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(settingsUrl)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Please enable notifications in Settings to receive location-based reminders.")
        }
    }
}

// MARK: - Subscription Section
struct SubscriptionSection: View {
    @StateObject private var userService = UserService.shared
    @State private var showingPremiumView = false
    @State private var showingSubscriptionManagement = false
    
    var body: some View {
        SettingsSection(title: "Subscription") {
            VStack(spacing: DesignSystem.Spacing.md) {
                if let user = userService.currentUser {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Current Plan")
                                .font(DesignSystem.Typography.body)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                            
                            HStack {
                                PremiumBadge(status: user.premiumStatus, size: .small)
                                
                                if user.isPremium {
                                    Text("Premium")
                                        .font(DesignSystem.Typography.body)
                                        .fontWeight(.medium)
                                        .foregroundColor(DesignSystem.Colors.textPrimary)
                                }
                            }
                        }
                        
                        Spacer()
                        
                        if user.isPremium {
                            Button("Manage") {
                                showingSubscriptionManagement = true
                            }
                            .font(DesignSystem.Typography.body)
                            .foregroundColor(DesignSystem.Colors.primary)
                        } else {
                            Button("Upgrade") {
                                showingPremiumView = true
                            }
                            .font(DesignSystem.Typography.body)
                            .foregroundColor(DesignSystem.Colors.primary)
                        }
                    }
                    
                    if !user.isPremium {
                        if let taskLimit = userService.taskLimitStatus {
                            TaskLimitProgress(status: taskLimit)
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showingPremiumView) {
            PremiumView()
        }
        .sheet(isPresented: $showingSubscriptionManagement) {
            SubscriptionManagementView()
        }
        .onAppear {
            userService.fetchCurrentUser()
        }
    }
}

// MARK: - Profile Section
struct ProfileSection: View {
    var body: some View {
        BaseCard {
            HStack(spacing: DesignSystem.Spacing.md) {
                Circle()
                    .fill(DesignSystem.Colors.primary)
                    .frame(width: 60, height: 60)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.system(size: 24))
                            .foregroundColor(DesignSystem.Colors.textInverse)
                    )
                
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    Text("Guest User")
                        .font(DesignSystem.Typography.title3)
                        .fontWeight(.semibold)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    Text("Free Plan")
                        .font(DesignSystem.Typography.body)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
                
                Spacer()
                
                IconButton(
                    icon: "chevron.right",
                    action: {
                        // TODO: Navigate to profile
                    }
                )
            }
        }
    }
}

// MARK: - Settings Section
struct SettingsSection<Content: View>: View {
    let title: String
    let content: Content
    
    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
            Text(title)
                .font(DesignSystem.Typography.title3)
                .fontWeight(.semibold)
                .foregroundColor(DesignSystem.Colors.textPrimary)
                .padding(.horizontal, DesignSystem.Spacing.md)
            
            BaseCard {
                content
            }
        }
    }
}

// MARK: - Settings Row
struct SettingsRow: View {
    let title: String
    let icon: String
    var subtitle: String? = nil
    let action: () -> Void
    var isDestructive: Bool = false
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignSystem.Spacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(isDestructive ? DesignSystem.Colors.error : DesignSystem.Colors.textSecondary)
                    .frame(width: 24)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(DesignSystem.Typography.body)
                        .fontWeight(.medium)
                        .foregroundColor(isDestructive ? DesignSystem.Colors.error : DesignSystem.Colors.textPrimary)
                    
                    if let subtitle = subtitle {
                        Text(subtitle)
                            .font(DesignSystem.Typography.caption1)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                    }
                }
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(DesignSystem.Colors.textTertiary)
            }
            .padding(.vertical, DesignSystem.Spacing.sm)
        }
    }
}

// MARK: - App Settings Model
struct AppSettings {
    var backgroundLocationEnabled: Bool = true
    var locationAccuracy: Double = 0.5
    var notificationSound: Bool = true
    var notificationVibration: Bool = true
    var doNotDisturbEnabled: Bool = true
    var quietHoursEnabled: Bool = false
    var quietHoursStart: Date = Calendar.current.date(from: DateComponents(hour: 22, minute: 0)) ?? Date()
    var quietHoursEnd: Date = Calendar.current.date(from: DateComponents(hour: 8, minute: 0)) ?? Date()
    var defaultTaskRadius: Double = 1.0
    var autoCompleteTasks: Bool = false
    var taskRemindersEnabled: Bool = true
    var reminderTimeMinutes: Double = 15
}

// MARK: - Settings View Previews
struct SettingsView_Previews: PreviewProvider {
    static var previews: some View {
        SettingsView()
            .environmentObject(NavigationCoordinator())
            .environmentObject(LocationManager())
            .environmentObject(NotificationManager())
    }
}
