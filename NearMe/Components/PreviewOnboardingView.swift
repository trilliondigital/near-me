import SwiftUI

// MARK: - Preview Onboarding View
struct PreviewOnboardingView: View {
    @ObservedObject var onboardingManager: OnboardingManager
    @EnvironmentObject var notificationManager: NotificationManager
    
    @State private var showingNotificationPreview = false
    @State private var currentPreviewIndex = 0
    
    private let previewNotifications = [
        PreviewNotification(
            title: "Approaching Grocery Store",
            body: "You're 1 mile away from Whole Foods Market. Don't forget to buy groceries!",
            type: .approach,
            icon: "location.circle.fill"
        ),
        PreviewNotification(
            title: "Arrived at Pharmacy",
            body: "You're at CVS Pharmacy. Time to pick up your prescription!",
            type: .arrival,
            icon: "checkmark.circle.fill"
        ),
        PreviewNotification(
            title: "Post-Arrival Reminder",
            body: "You've been at the bank for 5 minutes. Don't forget to deposit your check!",
            type: .postArrival,
            icon: "clock.fill"
        )
    ]
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.xl) {
            // Title
            VStack(spacing: DesignSystem.Spacing.sm) {
                Text("Preview")
                    .font(DesignSystem.Typography.title1)
                    .fontWeight(.bold)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text("See how notifications will appear")
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            
            // Notification Preview
            VStack(spacing: DesignSystem.Spacing.lg) {
                Text("Notification Examples")
                    .font(DesignSystem.Typography.title3)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                // Current notification preview
                NotificationPreviewCard(
                    notification: previewNotifications[currentPreviewIndex],
                    onTap: { showingNotificationPreview = true }
                )
                
                // Navigation dots
                HStack(spacing: DesignSystem.Spacing.sm) {
                    ForEach(previewNotifications.indices, id: \.self) { index in
                        Circle()
                            .fill(index == currentPreviewIndex ? DesignSystem.Colors.primary : DesignSystem.Colors.border)
                            .frame(width: 8, height: 8)
                            .onTapGesture {
                                withAnimation(.easeInOut(duration: 0.3)) {
                                    currentPreviewIndex = index
                                }
                            }
                    }
                }
                
                // Auto-advance button
                Button("Show Next Example") {
                    withAnimation(.easeInOut(duration: 0.3)) {
                        currentPreviewIndex = (currentPreviewIndex + 1) % previewNotifications.count
                    }
                }
                .font(DesignSystem.Typography.caption1)
                .foregroundColor(DesignSystem.Colors.primary)
            }
            
            // Notification Actions Preview
            VStack(spacing: DesignSystem.Spacing.md) {
                Text("Notification Actions")
                    .font(DesignSystem.Typography.title3)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                VStack(spacing: DesignSystem.Spacing.sm) {
                    NotificationActionPreview(
                        icon: "checkmark.circle.fill",
                        title: "Complete",
                        description: "Mark task as done",
                        color: DesignSystem.Colors.success
                    )
                    
                    NotificationActionPreview(
                        icon: "clock.fill",
                        title: "Snooze",
                        description: "Remind me later (15m, 1h, or today)",
                        color: DesignSystem.Colors.warning
                    )
                    
                    NotificationActionPreview(
                        icon: "speaker.slash.fill",
                        title: "Mute",
                        description: "Stop notifications for this task",
                        color: DesignSystem.Colors.error
                    )
                }
            }
            
            // Settings Note
            BaseCard(
                backgroundColor: DesignSystem.Colors.surface,
                padding: DesignSystem.Spacing.md
            ) {
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                    HStack {
                        Image(systemName: "gear")
                            .foregroundColor(DesignSystem.Colors.primary)
                        Text("Customizable")
                            .font(DesignSystem.Typography.bodyEmphasized)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                    }
                    
                    Text("You can customize notification types, quiet hours, and preferences anytime in the app settings.")
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
            }
            
            Spacer()
        }
        .padding(.horizontal, DesignSystem.Spacing.padding)
        .sheet(isPresented: $showingNotificationPreview) {
            NotificationDetailPreview(
                notification: previewNotifications[currentPreviewIndex],
                isPresented: $showingNotificationPreview
            )
        }
    }
}

// MARK: - Preview Notification Model
struct PreviewNotification {
    let title: String
    let body: String
    let type: NotificationType
    let icon: String
    
    enum NotificationType {
        case approach, arrival, postArrival
        
        var color: Color {
            switch self {
            case .approach: return DesignSystem.Colors.primary
            case .arrival: return DesignSystem.Colors.success
            case .postArrival: return DesignSystem.Colors.warning
            }
        }
        
        var description: String {
            switch self {
            case .approach: return "Approach Notification"
            case .arrival: return "Arrival Notification"
            case .postArrival: return "Post-Arrival Notification"
            }
        }
    }
}

// MARK: - Notification Preview Card
struct NotificationPreviewCard: View {
    let notification: PreviewNotification
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            BaseCard(
                backgroundColor: DesignSystem.Colors.card,
                shadowStyle: DesignSystem.Shadow.medium
            ) {
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                    HStack {
                        Image(systemName: notification.icon)
                            .font(.title2)
                            .foregroundColor(notification.type.color)
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text(notification.title)
                                .font(DesignSystem.Typography.bodyEmphasized)
                                .foregroundColor(DesignSystem.Colors.textPrimary)
                            
                            Text(notification.type.description)
                                .font(DesignSystem.Typography.caption1)
                                .foregroundColor(notification.type.color)
                        }
                        
                        Spacer()
                        
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                    }
                    
                    Text(notification.body)
                        .font(DesignSystem.Typography.body)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .multilineTextAlignment(.leading)
                }
            }
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Notification Action Preview
struct NotificationActionPreview: View {
    let icon: String
    let title: String
    let description: String
    let color: Color
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(color)
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
        }
        .padding(.vertical, DesignSystem.Spacing.sm)
    }
}

// MARK: - Notification Detail Preview
struct NotificationDetailPreview: View {
    let notification: PreviewNotification
    @Binding var isPresented: Bool
    
    var body: some View {
        NavigationView {
            VStack(spacing: DesignSystem.Spacing.lg) {
                // Notification Header
                VStack(spacing: DesignSystem.Spacing.md) {
                    Image(systemName: notification.icon)
                        .font(.system(size: 60, weight: .light))
                        .foregroundColor(notification.type.color)
                    
                    Text(notification.title)
                        .font(DesignSystem.Typography.title2)
                        .fontWeight(.bold)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                        .multilineTextAlignment(.center)
                    
                    Text(notification.type.description)
                        .font(DesignSystem.Typography.body)
                        .foregroundColor(notification.type.color)
                        .padding(.horizontal, DesignSystem.Spacing.md)
                        .padding(.vertical, DesignSystem.Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.sm)
                                .fill(notification.type.color.opacity(0.1))
                        )
                }
                
                // Notification Body
                Text(notification.body)
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, DesignSystem.Spacing.lg)
                
                Spacer()
                
                // Action Buttons
                VStack(spacing: DesignSystem.Spacing.md) {
                    PrimaryButton(
                        title: "Complete Task",
                        action: { isPresented = false }
                    )
                    
                    HStack(spacing: DesignSystem.Spacing.md) {
                        SecondaryButton(
                            title: "Snooze 15m",
                            action: { isPresented = false }
                        )
                        
                        SecondaryButton(
                            title: "Mute",
                            action: { isPresented = false }
                        )
                    }
                }
            }
            .padding(.horizontal, DesignSystem.Spacing.padding)
            .navigationTitle("Notification Preview")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                trailing: Button("Done") { isPresented = false }
            )
        }
    }
}

// MARK: - Previews
struct PreviewOnboardingView_Previews: PreviewProvider {
    static var previews: some View {
        PreviewOnboardingView(onboardingManager: OnboardingManager())
            .environmentObject(NotificationManager())
    }
}
