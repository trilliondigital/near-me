import SwiftUI

// MARK: - Notification Overlay View
struct NotificationOverlayView: View {
    @StateObject private var interactionService = NotificationInteractionService.shared
    @State private var dragOffset: CGSize = .zero
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.sm) {
            ForEach(interactionService.activeInAppNotifications) { notification in
                InAppNotificationBanner(
                    notification: notification,
                    onAction: { action in
                        interactionService.handleNotificationAction(action, for: notification)
                    },
                    onDismiss: {
                        interactionService.dismissInAppNotification(notification.id)
                    }
                )
                .offset(y: dragOffset.height)
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            if value.translation.height < 0 {
                                dragOffset = value.translation
                            }
                        }
                        .onEnded { value in
                            if value.translation.height < -50 {
                                // Swipe up to dismiss
                                withAnimation(.easeOut(duration: 0.3)) {
                                    dragOffset = CGSize(width: 0, height: -200)
                                }
                                
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                    interactionService.dismissInAppNotification(notification.id)
                                    dragOffset = .zero
                                }
                            } else {
                                // Snap back
                                withAnimation(.spring()) {
                                    dragOffset = .zero
                                }
                            }
                        }
                )
                .transition(.asymmetric(
                    insertion: .move(edge: .top).combined(with: .opacity),
                    removal: .move(edge: .top).combined(with: .opacity)
                ))
            }
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: interactionService.activeInAppNotifications.count)
        .sheet(isPresented: $interactionService.showSnoozePicker) {
            SnoozeDurationPicker(
                selectedDuration: $interactionService.selectedSnoozeDuration,
                onSelection: { _ in
                    interactionService.confirmCustomSnooze()
                }
            )
        }
    }
}

// MARK: - Notification Settings Detail View
struct NotificationSettingsDetailView: View {
    @EnvironmentObject var notificationManager: NotificationManager
    @StateObject private var viewModel = NotificationSettingsViewModel()
    @State private var showPermissionAlert = false
    
    var body: some View {
        NavigationWrapper(title: "Notification Settings") {
            ScrollView {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    // Permission Status Card
                    PermissionStatusCard(
                        isEnabled: notificationManager.isNotificationEnabled,
                        status: notificationManager.authorizationStatus,
                        onRequestPermission: {
                            if notificationManager.authorizationStatus == .denied {
                                showPermissionAlert = true
                            } else {
                                notificationManager.requestNotificationPermission()
                            }
                        }
                    )
                    
                    // Notification Types
                    SettingsSection(title: "Notification Types") {
                        VStack(spacing: DesignSystem.Spacing.md) {
                            SettingsToggle(
                                title: "Location Reminders",
                                description: "Get notified when you're near relevant places",
                                isOn: $viewModel.locationRemindersEnabled
                            )
                            
                            SettingsToggle(
                                title: "Task Completion Alerts",
                                description: "Confirmation when tasks are completed",
                                isOn: $viewModel.taskCompletionAlerts
                            )
                            
                            SettingsToggle(
                                title: "Daily Summary",
                                description: "Daily recap of your tasks and progress",
                                isOn: $viewModel.dailySummary
                            )
                        }
                    }
                    
                    // Quiet Hours
                    SettingsSection(title: "Quiet Hours") {
                        VStack(spacing: DesignSystem.Spacing.md) {
                            SettingsToggle(
                                title: "Enable Quiet Hours",
                                description: "Silence notifications during specific times",
                                isOn: $viewModel.quietHoursEnabled
                            )
                            
                            if viewModel.quietHoursEnabled {
                                VStack(spacing: DesignSystem.Spacing.sm) {
                                    TimePickerRow(
                                        title: "Start Time",
                                        time: $viewModel.quietHoursStart
                                    )
                                    
                                    TimePickerRow(
                                        title: "End Time",
                                        time: $viewModel.quietHoursEnd
                                    )
                                }
                                .padding(.top, DesignSystem.Spacing.sm)
                            }
                        }
                    }
                    
                    // Snooze Settings
                    SettingsSection(title: "Snooze Settings") {
                        VStack(spacing: DesignSystem.Spacing.md) {
                            HStack {
                                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                                    Text("Default Snooze Duration")
                                        .font(DesignSystem.Typography.bodyEmphasized)
                                        .foregroundColor(DesignSystem.Colors.textPrimary)
                                    
                                    Text("Default duration when snoozing notifications")
                                        .font(DesignSystem.Typography.callout)
                                        .foregroundColor(DesignSystem.Colors.textSecondary)
                                }
                                
                                Spacer()
                                
                                Picker("Duration", selection: $viewModel.defaultSnoozeDuration) {
                                    ForEach(SnoozeDuration.allCases, id: \.self) { duration in
                                        Text(duration.title).tag(duration)
                                    }
                                }
                                .pickerStyle(MenuPickerStyle())
                            }
                        }
                    }
                    
                    // Notification Style
                    SettingsSection(title: "Notification Style") {
                        VStack(spacing: DesignSystem.Spacing.md) {
                            SettingsToggle(
                                title: "Sound",
                                description: "Play sound with notifications",
                                isOn: $viewModel.soundEnabled
                            )
                            
                            SettingsToggle(
                                title: "Vibration",
                                description: "Vibrate device for notifications",
                                isOn: $viewModel.vibrationEnabled
                            )
                            
                            SettingsToggle(
                                title: "Badge Count",
                                description: "Show unread count on app icon",
                                isOn: $viewModel.badgeEnabled
                            )
                        }
                    }
                    
                    // Reset Button
                    Button("Reset to Defaults") {
                        viewModel.resetToDefaults()
                    }
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.error)
                    .padding(.top, DesignSystem.Spacing.lg)
                }
                .padding(DesignSystem.Spacing.md)
            }
        }
        .onAppear {
            viewModel.loadSettings()
        }
        .onDisappear {
            viewModel.saveSettings()
        }
        .alert("Notifications Disabled", isPresented: $showPermissionAlert) {
            Button("Settings") {
                if let settingsUrl = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(settingsUrl)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Notifications are disabled for Near Me. Please enable them in Settings to receive location reminders.")
        }
    }
}

// MARK: - Permission Status Card
struct PermissionStatusCard: View {
    let isEnabled: Bool
    let status: UNAuthorizationStatus
    let onRequestPermission: () -> Void
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.md) {
            HStack {
                Image(systemName: isEnabled ? "bell.fill" : "bell.slash")
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(isEnabled ? DesignSystem.Colors.success : DesignSystem.Colors.error)
                
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    Text("Notification Permission")
                        .font(DesignSystem.Typography.bodyEmphasized)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    Text(statusText)
                        .font(DesignSystem.Typography.callout)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
                
                Spacer()
                
                if !isEnabled {
                    Button("Enable") {
                        onRequestPermission()
                    }
                    .font(DesignSystem.Typography.callout)
                    .fontWeight(.medium)
                    .foregroundColor(DesignSystem.Colors.primary)
                }
            }
            
            if !isEnabled {
                Text("Location reminders require notification permission to work properly. Enable notifications to get timely reminders when you're near your tasks.")
                    .font(DesignSystem.Typography.callout)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .multilineTextAlignment(.leading)
            }
        }
        .padding(DesignSystem.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                .fill(isEnabled ? DesignSystem.Colors.success.opacity(0.1) : DesignSystem.Colors.error.opacity(0.1))
                .overlay(
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                        .stroke(isEnabled ? DesignSystem.Colors.success : DesignSystem.Colors.error, lineWidth: 1)
                )
        )
    }
    
    private var statusText: String {
        switch status {
        case .authorized:
            return "Enabled"
        case .denied:
            return "Disabled - Enable in Settings"
        case .notDetermined:
            return "Not Set"
        case .provisional:
            return "Provisional"
        case .ephemeral:
            return "Ephemeral"
        @unknown default:
            return "Unknown"
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
            
            VStack(spacing: DesignSystem.Spacing.sm) {
                content
            }
            .padding(DesignSystem.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .fill(DesignSystem.Colors.card)
            )
        }
    }
}

// MARK: - Settings Toggle
struct SettingsToggle: View {
    let title: String
    let description: String
    @Binding var isOn: Bool
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                Text(title)
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text(description)
                    .font(DesignSystem.Typography.callout)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
            }
            
            Spacer()
            
            Toggle("", isOn: $isOn)
                .labelsHidden()
        }
    }
}

// MARK: - Time Picker Row
struct TimePickerRow: View {
    let title: String
    @Binding var time: Date
    
    var body: some View {
        HStack {
            Text(title)
                .font(DesignSystem.Typography.bodyEmphasized)
                .foregroundColor(DesignSystem.Colors.textPrimary)
            
            Spacer()
            
            DatePicker("", selection: $time, displayedComponents: .hourAndMinute)
                .labelsHidden()
        }
    }
}

// MARK: - Previews
struct NotificationOverlayView_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            NotificationOverlayView()
                .background(DesignSystem.Colors.background)
            
            NotificationSettingsDetailView()
                .environmentObject(NotificationManager())
        }
    }
}