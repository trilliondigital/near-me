import SwiftUI
import UserNotifications

// MARK: - Notification Card Component
struct NotificationCard: View {
    let title: String
    let message: String
    let timestamp: Date
    let isRead: Bool
    let actions: [NotificationAction]
    let onAction: ((NotificationAction) -> Void)?
    
    struct NotificationAction: Identifiable {
        let id = UUID()
        let title: String
        let action: () -> Void
        let style: ActionStyle
        
        enum ActionStyle {
            case primary
            case secondary
            case destructive
        }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
            // Header with title and timestamp
            HStack {
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    HStack {
                        Text(title)
                            .font(DesignSystem.Typography.bodyEmphasized)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                        
                        if !isRead {
                            Circle()
                                .fill(DesignSystem.Colors.primary)
                                .frame(width: 8, height: 8)
                        }
                        
                        Spacer()
                    }
                    
                    Text(message)
                        .font(DesignSystem.Typography.callout)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .lineLimit(3)
                        .fixedSize(horizontal: false, vertical: true)
                }
                
                VStack(alignment: .trailing, spacing: DesignSystem.Spacing.xs) {
                    Text(timestamp.formatted(date: .omitted, time: .shortened))
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textTertiary)
                    
                    Text(timestamp.formatted(date: .abbreviated, time: .omitted))
                        .font(DesignSystem.Typography.caption2)
                        .foregroundColor(DesignSystem.Colors.textTertiary)
                }
            }
            
            // Action buttons
            if !actions.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: DesignSystem.Spacing.sm) {
                        ForEach(actions) { action in
                            Button(action: action.action) {
                                Text(action.title)
                                    .font(DesignSystem.Typography.caption1)
                                    .fontWeight(.medium)
                                    .padding(.horizontal, DesignSystem.Spacing.md)
                                    .padding(.vertical, DesignSystem.Spacing.sm)
                                    .background(
                                        RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.sm)
                                            .fill(backgroundColorFor(style: action.style))
                                    )
                                    .foregroundColor(foregroundColorFor(style: action.style))
                            }
                        }
                    }
                    .padding(.horizontal, 1) // Prevent clipping
                }
            }
        }
        .padding(DesignSystem.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                .fill(isRead ? DesignSystem.Colors.card : DesignSystem.Colors.card.opacity(0.95))
                .overlay(
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                        .stroke(isRead ? Color.clear : DesignSystem.Colors.primary.opacity(0.2), lineWidth: 1)
                )
        )
        .designSystemShadow(isRead ? DesignSystem.Shadow.small : DesignSystem.Shadow.medium)
    }
    
    private func backgroundColorFor(style: NotificationAction.ActionStyle) -> Color {
        switch style {
        case .primary:
            return DesignSystem.Colors.primary
        case .secondary:
            return DesignSystem.Colors.surface
        case .destructive:
            return DesignSystem.Colors.error.opacity(0.1)
        }
    }
    
    private func foregroundColorFor(style: NotificationAction.ActionStyle) -> Color {
        switch style {
        case .primary:
            return DesignSystem.Colors.textInverse
        case .secondary:
            return DesignSystem.Colors.textSecondary
        case .destructive:
            return DesignSystem.Colors.error
        }
    }
}

// MARK: - Notification Action Button
struct NotificationActionButton: View {
    let action: NotificationAction
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: DesignSystem.Spacing.xs) {
                Image(systemName: action.icon)
                    .font(.system(size: 14, weight: .medium))
                
                Text(action.title)
                    .font(DesignSystem.Typography.caption1)
                    .fontWeight(.medium)
            }
            .padding(.horizontal, DesignSystem.Spacing.sm)
            .padding(.vertical, DesignSystem.Spacing.xs)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.sm)
                    .fill(action.backgroundColor)
            )
            .foregroundColor(action.foregroundColor)
        }
    }
}

// MARK: - Notification History View
struct NotificationHistoryView: View {
    @StateObject private var viewModel = NotificationHistoryViewModel()
    @EnvironmentObject var notificationManager: NotificationManager
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Filter tabs
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: DesignSystem.Spacing.sm) {
                        ForEach(NotificationFilter.allCases, id: \.self) { filter in
                            FilterTab(
                                filter: filter,
                                isSelected: viewModel.selectedFilter == filter,
                                onTap: { viewModel.selectedFilter = filter }
                            )
                        }
                    }
                    .padding(.horizontal, DesignSystem.Spacing.md)
                }
                .padding(.vertical, DesignSystem.Spacing.sm)
                
                Divider()
                
                // Notification list
                if viewModel.filteredNotifications.isEmpty {
                    EmptyNotificationState(filter: viewModel.selectedFilter)
                } else {
                    ScrollView {
                        LazyVStack(spacing: DesignSystem.Spacing.sm) {
                            ForEach(viewModel.filteredNotifications) { notification in
                                NotificationCard(
                                    notification: notification,
                                    onAction: { action in
                                        viewModel.handleAction(action, for: notification)
                                    }
                                )
                            }
                        }
                        .padding(DesignSystem.Spacing.md)
                    }
                }
            }
            .navigationTitle("Notifications")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Mark All Read") {
                        viewModel.markAllAsRead()
                    }
                    .font(DesignSystem.Typography.callout)
                    .foregroundColor(DesignSystem.Colors.primary)
                }
            }
            .onAppear {
                viewModel.loadNotifications()
            }
        }
    }
}

// MARK: - Filter Tab
struct FilterTab: View {
    let filter: NotificationFilter
    let isSelected: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            Text(filter.title)
                .font(DesignSystem.Typography.callout)
                .fontWeight(isSelected ? .semibold : .medium)
                .foregroundColor(isSelected ? DesignSystem.Colors.textInverse : DesignSystem.Colors.textSecondary)
                .padding(.horizontal, DesignSystem.Spacing.md)
                .padding(.vertical, DesignSystem.Spacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.lg)
                        .fill(isSelected ? DesignSystem.Colors.primary : DesignSystem.Colors.surface)
                )
        }
    }
}

// MARK: - Empty Notification State
struct EmptyNotificationState: View {
    let filter: NotificationFilter
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.lg) {
            Image(systemName: filter.emptyStateIcon)
                .font(.system(size: 48, weight: .light))
                .foregroundColor(DesignSystem.Colors.textTertiary)
            
            VStack(spacing: DesignSystem.Spacing.sm) {
                Text(filter.emptyStateTitle)
                    .font(DesignSystem.Typography.title3)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text(filter.emptyStateMessage)
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(DesignSystem.Spacing.xl)
    }
}

// MARK: - Notification Settings View
struct NotificationSettingsView: View {
    @EnvironmentObject var notificationManager: NotificationManager
    @StateObject private var viewModel = NotificationSettingsViewModel()
    
    var body: some View {
        NavigationView {
            Form {
                // Permission Status Section
                Section {
                    HStack {
                        VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                            Text("Notifications")
                                .font(DesignSystem.Typography.bodyEmphasized)
                            
                            Text(permissionStatusText)
                                .font(DesignSystem.Typography.callout)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                        }
                        
                        Spacer()
                        
                        if !notificationManager.isNotificationEnabled {
                            Button("Enable") {
                                notificationManager.requestNotificationPermission()
                            }
                            .font(DesignSystem.Typography.callout)
                            .foregroundColor(DesignSystem.Colors.primary)
                        }
                    }
                    .padding(.vertical, DesignSystem.Spacing.xs)
                } header: {
                    Text("Permission Status")
                }
                
                // Notification Preferences Section
                Section {
                    Toggle("Location Reminders", isOn: $viewModel.locationRemindersEnabled)
                    Toggle("Task Completion Alerts", isOn: $viewModel.taskCompletionAlerts)
                    Toggle("Daily Summary", isOn: $viewModel.dailySummary)
                } header: {
                    Text("Notification Types")
                } footer: {
                    Text("Choose which types of notifications you'd like to receive")
                }
                
                // Quiet Hours Section
                Section {
                    Toggle("Enable Quiet Hours", isOn: $viewModel.quietHoursEnabled)
                    
                    if viewModel.quietHoursEnabled {
                        DatePicker("Start Time", selection: $viewModel.quietHoursStart, displayedComponents: .hourAndMinute)
                        DatePicker("End Time", selection: $viewModel.quietHoursEnd, displayedComponents: .hourAndMinute)
                    }
                } header: {
                    Text("Quiet Hours")
                } footer: {
                    Text("Notifications will be silenced during these hours")
                }
                
                // Snooze Defaults Section
                Section {
                    Picker("Default Snooze Duration", selection: $viewModel.defaultSnoozeDuration) {
                        ForEach(SnoozeDuration.allCases, id: \.self) { duration in
                            Text(duration.title).tag(duration)
                        }
                    }
                } header: {
                    Text("Snooze Settings")
                } footer: {
                    Text("Default duration when snoozing notifications")
                }
            }
            .navigationTitle("Notification Settings")
            .navigationBarTitleDisplayMode(.large)
            .onAppear {
                viewModel.loadSettings()
            }
            .onDisappear {
                viewModel.saveSettings()
            }
        }
    }
    
    private var permissionStatusText: String {
        switch notificationManager.authorizationStatus {
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

// MARK: - Notification Permission Education View
struct NotificationPermissionEducationView: View {
    let onRequestPermission: () -> Void
    let onSkip: () -> Void
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.xl) {
            Spacer()
            
            // Icon
            Image(systemName: "bell.badge")
                .font(.system(size: 64, weight: .light))
                .foregroundColor(DesignSystem.Colors.primary)
            
            // Content
            VStack(spacing: DesignSystem.Spacing.md) {
                Text("Stay on Track")
                    .font(DesignSystem.Typography.largeTitle)
                    .fontWeight(.bold)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text("Get reminded when you're near the right places. We'll send you helpful notifications to keep you organized.")
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(nil)
            }
            
            // Benefits
            VStack(spacing: DesignSystem.Spacing.md) {
                BenefitRow(
                    icon: "location.circle",
                    title: "Location-Based Reminders",
                    description: "Get notified when you arrive at specific places"
                )
                
                BenefitRow(
                    icon: "clock",
                    title: "Smart Timing",
                    description: "Notifications appear at the right moment"
                )
                
                BenefitRow(
                    icon: "checkmark.circle",
                    title: "Quick Actions",
                    description: "Complete, snooze, or mute tasks directly from notifications"
                )
            }
            
            Spacer()
            
            // Action buttons
            VStack(spacing: DesignSystem.Spacing.md) {
                PrimaryButton(
                    title: "Enable Notifications",
                    action: onRequestPermission
                )
                
                SecondaryButton(
                    title: "Skip for Now",
                    action: onSkip
                )
            }
        }
        .padding(DesignSystem.Spacing.xl)
        .background(DesignSystem.Colors.background)
    }
}

// MARK: - Snooze Duration Picker
struct SnoozeDurationPicker: View {
    @Binding var selectedDuration: SnoozeDuration
    let onSelection: (SnoozeDuration) -> Void
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Header
                VStack(spacing: DesignSystem.Spacing.md) {
                    Image(systemName: "clock.badge")
                        .font(.system(size: 48, weight: .light))
                        .foregroundColor(DesignSystem.Colors.primary)
                    
                    VStack(spacing: DesignSystem.Spacing.sm) {
                        Text("Snooze Duration")
                            .font(DesignSystem.Typography.title2)
                            .fontWeight(.bold)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                        
                        Text("Choose how long to snooze this reminder")
                            .font(DesignSystem.Typography.body)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(DesignSystem.Spacing.xl)
                
                // Duration options
                ScrollView {
                    LazyVStack(spacing: DesignSystem.Spacing.sm) {
                        ForEach(SnoozeDuration.allCases, id: \.self) { duration in
                            SnoozeDurationOption(
                                duration: duration,
                                isSelected: selectedDuration == duration,
                                onTap: {
                                    selectedDuration = duration
                                    onSelection(duration)
                                    dismiss()
                                }
                            )
                        }
                    }
                    .padding(DesignSystem.Spacing.md)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                }
            }
        }
    }
}

// MARK: - Snooze Duration Option
struct SnoozeDurationOption: View {
    let duration: SnoozeDuration
    let isSelected: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: DesignSystem.Spacing.md) {
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    Text(duration.title)
                        .font(DesignSystem.Typography.bodyEmphasized)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    Text(duration.description)
                        .font(DesignSystem.Typography.callout)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
                
                Spacer()
                
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundColor(DesignSystem.Colors.primary)
                } else {
                    Circle()
                        .stroke(DesignSystem.Colors.border, lineWidth: 1)
                        .frame(width: 20, height: 20)
                }
            }
            .padding(DesignSystem.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .fill(isSelected ? DesignSystem.Colors.primary.opacity(0.1) : DesignSystem.Colors.card)
                    .overlay(
                        RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                            .stroke(isSelected ? DesignSystem.Colors.primary : DesignSystem.Colors.border, lineWidth: 1)
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - In-App Notification Banner
struct InAppNotificationBanner: View {
    let notification: NotificationItem
    let onAction: (NotificationAction) -> Void
    let onDismiss: () -> Void
    @State private var isVisible = false
    
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: DesignSystem.Spacing.sm) {
                // Notification icon
                Image(systemName: notification.type.icon)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(DesignSystem.Colors.primary)
                    .frame(width: 24, height: 24)
                
                // Content
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    Text(notification.title)
                        .font(DesignSystem.Typography.bodyEmphasized)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                        .lineLimit(1)
                    
                    Text(notification.body)
                        .font(DesignSystem.Typography.callout)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .lineLimit(2)
                }
                
                Spacer()
                
                // Dismiss button
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(DesignSystem.Colors.textTertiary)
                }
            }
            .padding(DesignSystem.Spacing.md)
            
            // Quick actions
            if !notification.actions.isEmpty {
                HStack(spacing: DesignSystem.Spacing.sm) {
                    ForEach(notification.actions.prefix(3), id: \.identifier) { action in
                        Button(action: { onAction(action) }) {
                            Text(action.title)
                                .font(DesignSystem.Typography.caption1)
                                .fontWeight(.medium)
                                .padding(.horizontal, DesignSystem.Spacing.md)
                                .padding(.vertical, DesignSystem.Spacing.sm)
                                .background(
                                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.sm)
                                        .fill(action.backgroundColor.opacity(0.1))
                                )
                                .foregroundColor(action.backgroundColor)
                        }
                    }
                    
                    Spacer()
                }
                .padding(.horizontal, DesignSystem.Spacing.md)
                .padding(.bottom, DesignSystem.Spacing.md)
            }
        }
        .background(
            RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.lg)
                .fill(DesignSystem.Colors.card)
                .designSystemShadow(DesignSystem.Shadow.large)
        )
        .padding(.horizontal, DesignSystem.Spacing.md)
        .scaleEffect(isVisible ? 1 : 0.95)
        .opacity(isVisible ? 1 : 0)
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: isVisible)
        .onAppear {
            withAnimation {
                isVisible = true
            }
        }
    }
}

// MARK: - Benefit Row
struct BenefitRow: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 24, weight: .medium))
                .foregroundColor(DesignSystem.Colors.primary)
                .frame(width: 32, height: 32)
            
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                Text(title)
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text(description)
                    .font(DesignSystem.Typography.callout)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
            }
            
            Spacer()
        }
    }
}

// MARK: - Previews
struct NotificationComponents_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            // Notification Card Preview
            NotificationCard(
                notification: NotificationItem.sample,
                onAction: { _ in }
            )
            .padding()
            .background(DesignSystem.Colors.background)
            
            // Notification History Preview
            NotificationHistoryView()
                .environmentObject(NotificationManager())
            
            // Notification Settings Preview
            NotificationSettingsView()
                .environmentObject(NotificationManager())
            
            // Permission Education Preview
            NotificationPermissionEducationView(
                onRequestPermission: {},
                onSkip: {}
            )
        }
    }
}
