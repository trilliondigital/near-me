import SwiftUI

// MARK: - Preferences Onboarding View
struct PreferencesOnboardingView: View {
    @ObservedObject var onboardingManager: OnboardingManager
    @State private var preferences: NotificationPreferences
    
    init(onboardingManager: OnboardingManager) {
        self.onboardingManager = onboardingManager
        self._preferences = State(initialValue: onboardingManager.preferences.notificationPreferences)
    }
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.xl) {
            Spacer()
            
            // Title
            VStack(spacing: DesignSystem.Spacing.sm) {
                Text("Notification Preferences")
                    .font(DesignSystem.Typography.title1)
                    .fontWeight(.bold)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text("Customize when and how you receive notifications")
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            
            ScrollView {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    // Notification Types
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                        Text("Notification Types")
                            .font(DesignSystem.Typography.title3)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                        
                        VStack(spacing: DesignSystem.Spacing.sm) {
                            PreferenceToggle(
                                icon: "location.circle.fill",
                                title: "Approach Notifications",
                                description: "Get notified when you're approaching a location (5, 3, or 1 mile away)",
                                isOn: $preferences.approachNotifications
                            )
                            
                            PreferenceToggle(
                                icon: "checkmark.circle.fill",
                                title: "Arrival Notifications",
                                description: "Get notified when you arrive at a location",
                                isOn: $preferences.arrivalNotifications
                            )
                            
                            PreferenceToggle(
                                icon: "clock.fill",
                                title: "Post-Arrival Notifications",
                                description: "Get reminded after you've been at a location for a while",
                                isOn: $preferences.postArrivalNotifications
                            )
                        }
                    }
                    
                    // Quiet Hours
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                        Text("Quiet Hours")
                            .font(DesignSystem.Typography.title3)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                        
                        VStack(spacing: DesignSystem.Spacing.sm) {
                            PreferenceToggle(
                                icon: "moon.fill",
                                title: "Enable Quiet Hours",
                                description: "Don't send notifications during specified hours",
                                isOn: $preferences.quietHoursEnabled
                            )
                            
                            if preferences.quietHoursEnabled {
                                VStack(spacing: DesignSystem.Spacing.sm) {
                                    TimePickerRow(
                                        icon: "sunset.fill",
                                        title: "Quiet Hours Start",
                                        time: $preferences.quietStartTime
                                    )
                                    
                                    TimePickerRow(
                                        icon: "sunrise.fill",
                                        title: "Quiet Hours End",
                                        time: $preferences.quietEndTime
                                    )
                                    
                                    PreferenceToggle(
                                        icon: "calendar",
                                        title: "Weekend Quiet Hours",
                                        description: "Apply quiet hours on weekends too",
                                        isOn: $preferences.weekendQuietHours
                                    )
                                }
                                .padding(.leading, DesignSystem.Spacing.lg)
                            }
                        }
                    }
                }
            }
            
            Spacer()
        }
        .padding(.horizontal, DesignSystem.Spacing.padding)
        .onChange(of: preferences) { newValue in
            onboardingManager.updateNotificationPreferences(newValue)
        }
    }
}

// MARK: - Preference Toggle
struct PreferenceToggle: View {
    let icon: String
    let title: String
    let description: String
    @Binding var isOn: Bool
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(DesignSystem.Colors.primary)
                .frame(width: 30)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text(description)
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
            }
            
            Spacer()
            
            Toggle("", isOn: $isOn)
                .toggleStyle(SwitchToggleStyle(tint: DesignSystem.Colors.primary))
        }
        .padding(.vertical, DesignSystem.Spacing.sm)
    }
}

// MARK: - Time Picker Row
struct TimePickerRow: View {
    let icon: String
    let title: String
    @Binding var time: Date
    
    private var timeFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter
    }
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(DesignSystem.Colors.primary)
                .frame(width: 30)
            
            Text(title)
                .font(DesignSystem.Typography.bodyEmphasized)
                .foregroundColor(DesignSystem.Colors.textPrimary)
            
            Spacer()
            
            DatePicker("", selection: $time, displayedComponents: .hourAndMinute)
                .datePickerStyle(CompactDatePickerStyle())
                .labelsHidden()
        }
        .padding(.vertical, DesignSystem.Spacing.sm)
    }
}

// MARK: - Previews
struct PreferencesOnboardingView_Previews: PreviewProvider {
    static var previews: some View {
        PreferencesOnboardingView(onboardingManager: OnboardingManager())
    }
}
