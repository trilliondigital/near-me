import SwiftUI

// MARK: - Card Components
struct BaseCard<Content: View>: View {
    let content: Content
    var backgroundColor: Color = DesignSystem.Colors.card
    var cornerRadius: CGFloat = DesignSystem.CornerRadius.md
    var shadowStyle: ShadowStyle = DesignSystem.Shadow.small
    var padding: CGFloat = DesignSystem.Spacing.md
    
    init(backgroundColor: Color = DesignSystem.Colors.card,
         cornerRadius: CGFloat = DesignSystem.CornerRadius.md,
         shadowStyle: ShadowStyle = DesignSystem.Shadow.small,
         padding: CGFloat = DesignSystem.Spacing.md,
         @ViewBuilder content: () -> Content) {
        self.backgroundColor = backgroundColor
        self.cornerRadius = cornerRadius
        self.shadowStyle = shadowStyle
        self.padding = padding
        self.content = content()
    }
    
    var body: some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(backgroundColor)
            )
            .designSystemShadow(shadowStyle)
    }
}

struct TaskCard: View {
    let title: String
    let description: String?
    let location: String
    let status: TaskStatus
    let action: () -> Void
    
    enum TaskStatus {
        case active, completed, muted
        
        var color: Color {
            switch self {
            case .active: return DesignSystem.Colors.primary
            case .completed: return DesignSystem.Colors.success
            case .muted: return DesignSystem.Colors.textTertiary
            }
        }
        
        var icon: String {
            switch self {
            case .active: return "circle"
            case .completed: return "checkmark.circle.fill"
            case .muted: return "minus.circle.fill"
            }
        }
    }
    
    var body: some View {
        BaseCard {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                HStack {
                    Image(systemName: status.icon)
                        .foregroundColor(status.color)
                        .font(.title3)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title)
                            .font(DesignSystem.Typography.title3)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                            .lineLimit(2)
                        
                        if let description = description {
                            Text(description)
                                .font(DesignSystem.Typography.body)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                                .lineLimit(3)
                        }
                    }
                    
                    Spacer()
                    
                    IconButton(icon: "chevron.right", action: action, size: 32)
                }
                
                HStack {
                    Image(systemName: "location")
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .font(.caption)
                    
                    Text(location)
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .lineLimit(1)
                    
                    Spacer()
                }
            }
        }
    }
}

struct PlaceCard: View {
    let name: String
    let address: String
    let category: String?
    let distance: String?
    let action: () -> Void
    
    var body: some View {
        BaseCard {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(name)
                            .font(DesignSystem.Typography.title3)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                            .lineLimit(2)
                        
                        Text(address)
                            .font(DesignSystem.Typography.body)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                            .lineLimit(2)
                    }
                    
                    Spacer()
                    
                    IconButton(icon: "chevron.right", action: action, size: 32)
                }
                
                HStack {
                    if let category = category {
                        Text(category.uppercased())
                            .font(DesignSystem.Typography.caption2)
                            .fontWeight(.medium)
                            .foregroundColor(DesignSystem.Colors.primary)
                            .padding(.horizontal, DesignSystem.Spacing.sm)
                            .padding(.vertical, DesignSystem.Spacing.xs)
                            .background(
                                Capsule()
                                    .fill(DesignSystem.Colors.primary.opacity(0.1))
                            )
                    }
                    
                    if let distance = distance {
                        Text(distance)
                            .font(DesignSystem.Typography.caption1)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                    }
                    
                    Spacer()
                }
            }
        }
    }
}

struct NotificationCard: View {
    let title: String
    let message: String
    let timestamp: Date
    let isRead: Bool
    let actions: [NotificationAction]
    
    struct NotificationAction {
        let title: String
        let action: () -> Void
        let style: ActionStyle
        
        enum ActionStyle {
            case primary, secondary, destructive
        }
    }
    
    var body: some View {
        BaseCard(
            backgroundColor: isRead ? DesignSystem.Colors.card : DesignSystem.Colors.surface,
            shadowStyle: isRead ? DesignSystem.Shadow.small : DesignSystem.Shadow.medium
        ) {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title)
                            .font(DesignSystem.Typography.title3)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                            .fontWeight(isRead ? .regular : .semibold)
                        
                        Text(message)
                            .font(DesignSystem.Typography.body)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                            .lineLimit(3)
                    }
                    
                    Spacer()
                    
                    if !isRead {
                        Circle()
                            .fill(DesignSystem.Colors.primary)
                            .frame(width: 8, height: 8)
                    }
                }
                
                HStack {
                    Text(timestamp, style: .relative)
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textTertiary)
                    
                    Spacer()
                }
                
                if !actions.isEmpty {
                    HStack(spacing: DesignSystem.Spacing.sm) {
                        ForEach(actions.indices, id: \.self) { index in
                            let action = actions[index]
                            Button(action.title, action: action.action)
                                .font(DesignSystem.Typography.caption1)
                                .fontWeight(.medium)
                                .padding(.horizontal, DesignSystem.Spacing.sm)
                                .padding(.vertical, DesignSystem.Spacing.xs)
                                .background(
                                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.sm)
                                        .fill(actionStyleColor(action.style))
                                )
                                .foregroundColor(actionStyleForegroundColor(action.style))
                        }
                        
                        Spacer()
                    }
                }
            }
        }
    }
    
    private func actionStyleColor(_ style: NotificationCard.NotificationAction.ActionStyle) -> Color {
        switch style {
        case .primary: return DesignSystem.Colors.primary
        case .secondary: return DesignSystem.Colors.surface
        case .destructive: return DesignSystem.Colors.error
        }
    }
    
    private func actionStyleForegroundColor(_ style: NotificationCard.NotificationAction.ActionStyle) -> Color {
        switch style {
        case .primary: return DesignSystem.Colors.textInverse
        case .secondary: return DesignSystem.Colors.textPrimary
        case .destructive: return DesignSystem.Colors.textInverse
        }
    }
}

struct EmptyStateCard: View {
    let icon: String
    let title: String
    let message: String
    let actionTitle: String?
    let action: (() -> Void)?
    
    var body: some View {
        BaseCard {
            VStack(spacing: DesignSystem.Spacing.lg) {
                Image(systemName: icon)
                    .font(.system(size: 48, weight: .light))
                    .foregroundColor(DesignSystem.Colors.textTertiary)
                
                VStack(spacing: DesignSystem.Spacing.sm) {
                    Text(title)
                        .font(DesignSystem.Typography.title2)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                        .multilineTextAlignment(.center)
                    
                    Text(message)
                        .font(DesignSystem.Typography.body)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }
                
                if let actionTitle = actionTitle, let action = action {
                    PrimaryButton(title: actionTitle, action: action)
                }
            }
            .padding(DesignSystem.Spacing.lg)
        }
    }
}

// MARK: - Card Previews
struct CardComponents_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(spacing: DesignSystem.Spacing.md) {
                TaskCard(
                    title: "Buy groceries",
                    description: "Pick up milk, bread, and eggs from the store",
                    location: "Whole Foods Market",
                    status: .active,
                    action: {}
                )
                
                PlaceCard(
                    name: "Central Park",
                    address: "New York, NY 10024",
                    category: "Park",
                    distance: "0.5 mi",
                    action: {}
                )
                
                NotificationCard(
                    title: "Task Reminder",
                    message: "You're near Whole Foods Market. Don't forget to buy groceries!",
                    timestamp: Date().addingTimeInterval(-300),
                    isRead: false,
                    actions: [
                        NotificationCard.NotificationAction(
                            title: "Complete",
                            action: {},
                            style: .primary
                        ),
                        NotificationCard.NotificationAction(
                            title: "Snooze",
                            action: {},
                            style: .secondary
                        )
                    ]
                )
                
                EmptyStateCard(
                    icon: "list.bullet",
                    title: "No Tasks Yet",
                    message: "Create your first task to get started with location-based reminders.",
                    actionTitle: "Create Task",
                    action: {}
                )
            }
            .padding()
        }
        .background(DesignSystem.Colors.background)
    }
}
