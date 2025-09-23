import SwiftUI

// MARK: - Enhanced Empty State Components
struct EmptyStateView: View {
    let config: EmptyStateConfig
    let onAction: (() -> Void)?
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.xl) {
            // Illustration or Icon
            VStack(spacing: DesignSystem.Spacing.md) {
                if let illustration = config.illustration {
                    illustration
                        .frame(width: 120, height: 120)
                } else {
                    Image(systemName: config.icon)
                        .font(.system(size: 60))
                        .foregroundColor(DesignSystem.Colors.textTertiary)
                }
            }
            
            // Content
            VStack(spacing: DesignSystem.Spacing.md) {
                Text(config.title)
                    .font(DesignSystem.Typography.title2)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                
                Text(config.message)
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(nil)
            }
            
            // Quick Actions
            if !config.quickActions.isEmpty {
                VStack(spacing: DesignSystem.Spacing.sm) {
                    ForEach(config.quickActions, id: \.title) { action in
                        QuickActionButton(
                            title: action.title,
                            icon: action.icon,
                            style: action.style,
                            action: action.action
                        )
                    }
                }
            }
            
            // Primary Action
            if let primaryAction = config.primaryAction {
                PrimaryButton(
                    title: primaryAction.title,
                    action: primaryAction.action
                )
            }
            
            // Help Link
            if let helpAction = config.helpAction {
                Button(action: helpAction.action) {
                    HStack(spacing: DesignSystem.Spacing.xs) {
                        Image(systemName: "questionmark.circle")
                            .font(.caption)
                        Text(helpAction.title)
                            .font(DesignSystem.Typography.caption1)
                    }
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                }
            }
        }
        .padding(DesignSystem.Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Empty State Configuration
struct EmptyStateConfig {
    let title: String
    let message: String
    let icon: String
    let illustration: AnyView?
    let primaryAction: EmptyStateAction?
    let quickActions: [EmptyStateAction]
    let helpAction: EmptyStateAction?
    
    init(
        title: String,
        message: String,
        icon: String,
        illustration: AnyView? = nil,
        primaryAction: EmptyStateAction? = nil,
        quickActions: [EmptyStateAction] = [],
        helpAction: EmptyStateAction? = nil
    ) {
        self.title = title
        self.message = message
        self.icon = icon
        self.illustration = illustration
        self.primaryAction = primaryAction
        self.quickActions = quickActions
        self.helpAction = helpAction
    }
}

struct EmptyStateAction {
    let title: String
    let icon: String?
    let style: ActionStyle
    let action: () -> Void
    
    enum ActionStyle {
        case primary
        case secondary
        case tertiary
        case quick
    }
    
    init(title: String, icon: String? = nil, style: ActionStyle = .primary, action: @escaping () -> Void) {
        self.title = title
        self.icon = icon
        self.style = style
        self.action = action
    }
}

// MARK: - Quick Action Button
struct QuickActionButton: View {
    let title: String
    let icon: String?
    let style: EmptyStateAction.ActionStyle
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignSystem.Spacing.sm) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.title3)
                }
                
                Text(title)
                    .font(DesignSystem.Typography.bodyEmphasized)
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(DesignSystem.Colors.textTertiary)
            }
            .padding(.horizontal, DesignSystem.Spacing.lg)
            .padding(.vertical, DesignSystem.Spacing.md)
            .background(DesignSystem.Colors.surface)
            .foregroundColor(DesignSystem.Colors.textPrimary)
            .designSystemCornerRadius()
            .overlay(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .stroke(DesignSystem.Colors.border, lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Predefined Empty States
extension EmptyStateConfig {
    // No Tasks - First Time User
    static func noTasksFirstTime(
        onCreateTask: @escaping () -> Void,
        onViewExamples: @escaping () -> Void,
        onLearnMore: @escaping () -> Void
    ) -> EmptyStateConfig {
        EmptyStateConfig(
            title: "Welcome to Near Me",
            message: "Create location-based reminders that notify you when you're near the right place to complete your tasks.",
            icon: "location.circle",
            illustration: AnyView(
                VStack(spacing: DesignSystem.Spacing.sm) {
                    Image(systemName: "location.circle.fill")
                        .font(.system(size: 40))
                        .foregroundColor(DesignSystem.Colors.primary)
                    Image(systemName: "bell.fill")
                        .font(.system(size: 20))
                        .foregroundColor(DesignSystem.Colors.warning)
                        .offset(x: 20, y: -10)
                }
            ),
            primaryAction: EmptyStateAction(
                title: "Create Your First Task",
                icon: "plus.circle.fill",
                action: onCreateTask
            ),
            quickActions: [
                EmptyStateAction(
                    title: "Browse Example Tasks",
                    icon: "lightbulb",
                    style: .quick,
                    action: onViewExamples
                )
            ],
            helpAction: EmptyStateAction(
                title: "How does it work?",
                action: onLearnMore
            )
        )
    }
    
    // No Tasks - Returning User
    static func noTasksReturning(
        onCreateTask: @escaping () -> Void,
        onViewCompleted: @escaping () -> Void
    ) -> EmptyStateConfig {
        EmptyStateConfig(
            title: "All caught up!",
            message: "You don't have any active tasks right now. Create a new reminder or check your completed tasks.",
            icon: "checkmark.circle",
            primaryAction: EmptyStateAction(
                title: "Create New Task",
                icon: "plus.circle.fill",
                action: onCreateTask
            ),
            quickActions: [
                EmptyStateAction(
                    title: "View Completed Tasks",
                    icon: "checkmark.circle",
                    style: .quick,
                    action: onViewCompleted
                )
            ]
        )
    }
    
    // No Search Results
    static func noSearchResults(
        searchTerm: String,
        onClearSearch: @escaping () -> Void,
        onCreateTask: @escaping () -> Void
    ) -> EmptyStateConfig {
        EmptyStateConfig(
            title: "No results for \"\(searchTerm)\"",
            message: "Try adjusting your search terms or create a new task with this name.",
            icon: "magnifyingglass",
            quickActions: [
                EmptyStateAction(
                    title: "Clear Search",
                    icon: "xmark.circle",
                    style: .quick,
                    action: onClearSearch
                ),
                EmptyStateAction(
                    title: "Create \"\(searchTerm)\" Task",
                    icon: "plus.circle",
                    style: .quick,
                    action: onCreateTask
                )
            ]
        )
    }
    
    // No Filtered Results
    static func noFilteredResults(
        filterName: String,
        onClearFilters: @escaping () -> Void,
        onCreateTask: @escaping () -> Void
    ) -> EmptyStateConfig {
        EmptyStateConfig(
            title: "No \(filterName.lowercased()) tasks",
            message: "You don't have any tasks matching the current filter. Try adjusting your filters or create a new task.",
            icon: "line.3.horizontal.decrease.circle",
            quickActions: [
                EmptyStateAction(
                    title: "Clear Filters",
                    icon: "xmark.circle",
                    style: .quick,
                    action: onClearFilters
                ),
                EmptyStateAction(
                    title: "Create Task",
                    icon: "plus.circle",
                    style: .quick,
                    action: onCreateTask
                )
            ]
        )
    }
    
    // No Places
    static func noPlaces(
        onAddPlace: @escaping () -> Void,
        onUseCurrentLocation: @escaping () -> Void,
        onLearnAboutPlaces: @escaping () -> Void
    ) -> EmptyStateConfig {
        EmptyStateConfig(
            title: "No saved places",
            message: "Add your frequently visited places like home, work, or favorite stores to create location-based reminders.",
            icon: "mappin.circle",
            primaryAction: EmptyStateAction(
                title: "Add Your First Place",
                icon: "plus.circle.fill",
                action: onAddPlace
            ),
            quickActions: [
                EmptyStateAction(
                    title: "Use Current Location",
                    icon: "location.fill",
                    style: .quick,
                    action: onUseCurrentLocation
                )
            ],
            helpAction: EmptyStateAction(
                title: "Learn about places",
                action: onLearnAboutPlaces
            )
        )
    }
    
    // No Notifications
    static func noNotifications(
        onCreateTask: @escaping () -> Void,
        onCheckSettings: @escaping () -> Void
    ) -> EmptyStateConfig {
        EmptyStateConfig(
            title: "No notifications yet",
            message: "You'll see location-based reminders here when you're near places with active tasks.",
            icon: "bell",
            quickActions: [
                EmptyStateAction(
                    title: "Create Your First Task",
                    icon: "plus.circle",
                    style: .quick,
                    action: onCreateTask
                ),
                EmptyStateAction(
                    title: "Check Notification Settings",
                    icon: "gear",
                    style: .quick,
                    action: onCheckSettings
                )
            ]
        )
    }
    
    // Location Permission Needed
    static func locationPermissionNeeded(
        onRequestPermission: @escaping () -> Void,
        onLearnMore: @escaping () -> Void
    ) -> EmptyStateConfig {
        EmptyStateConfig(
            title: "Location access needed",
            message: "Near Me needs location access to send you reminders when you're near the right places.",
            icon: "location.slash",
            primaryAction: EmptyStateAction(
                title: "Enable Location Access",
                icon: "location.fill",
                action: onRequestPermission
            ),
            helpAction: EmptyStateAction(
                title: "Why do we need this?",
                action: onLearnMore
            )
        )
    }
    
    // Notification Permission Needed
    static func notificationPermissionNeeded(
        onRequestPermission: @escaping () -> Void,
        onLearnMore: @escaping () -> Void
    ) -> EmptyStateConfig {
        EmptyStateConfig(
            title: "Notifications disabled",
            message: "Enable notifications to receive location-based reminders for your tasks.",
            icon: "bell.slash",
            primaryAction: EmptyStateAction(
                title: "Enable Notifications",
                icon: "bell.fill",
                action: onRequestPermission
            ),
            helpAction: EmptyStateAction(
                title: "Learn about notifications",
                action: onLearnMore
            )
        )
    }
}

// MARK: - Preview
struct EmptyStateComponents_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            EmptyStateView(
                config: .noTasksFirstTime(
                    onCreateTask: {},
                    onViewExamples: {},
                    onLearnMore: {}
                ),
                onAction: nil
            )
            .previewDisplayName("No Tasks - First Time")
            
            EmptyStateView(
                config: .noSearchResults(
                    searchTerm: "groceries",
                    onClearSearch: {},
                    onCreateTask: {}
                ),
                onAction: nil
            )
            .previewDisplayName("No Search Results")
            
            EmptyStateView(
                config: .locationPermissionNeeded(
                    onRequestPermission: {},
                    onLearnMore: {}
                ),
                onAction: nil
            )
            .previewDisplayName("Location Permission")
        }
    }
}