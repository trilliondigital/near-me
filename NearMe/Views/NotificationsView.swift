import SwiftUI

// MARK: - Notifications View
struct NotificationsView: View {
    @EnvironmentObject var navigationCoordinator: NavigationCoordinator
    @State private var notifications: [NotificationItem] = []
    @State private var isLoading = false
    @State private var selectedFilter: NotificationFilter = .all
    @State private var showUnreadOnly = false
    
    enum NotificationFilter: String, CaseIterable {
        case all = "All"
        case unread = "Unread"
        case today = "Today"
        case thisWeek = "This Week"
    }
    
    var filteredNotifications: [NotificationItem] {
        var filtered = notifications
        
        // Apply read filter
        if showUnreadOnly {
            filtered = filtered.filter { !$0.isRead }
        }
        
        // Apply time filter
        switch selectedFilter {
        case .all:
            break
        case .unread:
            filtered = filtered.filter { !$0.isRead }
        case .today:
            let today = Calendar.current.startOfDay(for: Date())
            filtered = filtered.filter { Calendar.current.isDate($0.timestamp, inSameDayAs: today) }
        case .thisWeek:
            let weekAgo = Calendar.current.date(byAdding: .weekOfYear, value: -1, to: Date()) ?? Date()
            filtered = filtered.filter { $0.timestamp >= weekAgo }
        }
        
        return filtered.sorted { $0.timestamp > $1.timestamp }
    }
    
    var unreadCount: Int {
        notifications.filter { !$0.isRead }.count
    }
    
    var body: some View {
        NavigationWrapper(
            title: "Notifications",
            trailingButton: {
                AnyView(
                    HStack(spacing: DesignSystem.Spacing.sm) {
                        if unreadCount > 0 {
                            Text("\(unreadCount)")
                                .font(DesignSystem.Typography.caption2)
                                .fontWeight(.bold)
                                .foregroundColor(DesignSystem.Colors.textInverse)
                                .frame(width: 20, height: 20)
                                .background(
                                    Circle()
                                        .fill(DesignSystem.Colors.error)
                                )
                        }
                        
                        IconButton(
                            icon: "line.3.horizontal.decrease",
                            action: {
                                showUnreadOnly.toggle()
                            }
                        )
                    }
                )
            }
        ) {
            VStack(spacing: 0) {
                // Filter Section
                VStack(spacing: DesignSystem.Spacing.md) {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: DesignSystem.Spacing.sm) {
                            ForEach(NotificationFilter.allCases, id: \.self) { filter in
                                FilterChip(
                                    title: filter.rawValue,
                                    isSelected: selectedFilter == filter,
                                    action: {
                                        selectedFilter = filter
                                    }
                                )
                            }
                        }
                        .padding(.horizontal, DesignSystem.Spacing.md)
                    }
                    
                    if showUnreadOnly {
                        HStack {
                            Image(systemName: "eye.slash")
                                .foregroundColor(DesignSystem.Colors.primary)
                                .font(.system(size: 14))
                            
                            Text("Showing unread notifications only")
                                .font(DesignSystem.Typography.caption1)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                            
                            Spacer()
                            
                            Button("Show All") {
                                showUnreadOnly = false
                            }
                            .font(DesignSystem.Typography.caption1)
                            .fontWeight(.medium)
                            .foregroundColor(DesignSystem.Colors.primary)
                        }
                        .padding(.horizontal, DesignSystem.Spacing.md)
                        .padding(.vertical, DesignSystem.Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.sm)
                                .fill(DesignSystem.Colors.primary.opacity(0.1))
                        )
                        .padding(.horizontal, DesignSystem.Spacing.md)
                    }
                }
                .padding(.vertical, DesignSystem.Spacing.md)
                .background(DesignSystem.Colors.surface)
                
                // Notifications List
                if isLoading {
                    VStack {
                        Spacer()
                        ProgressView()
                            .scaleEffect(1.2)
                        Text("Loading notifications...")
                            .font(DesignSystem.Typography.body)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                            .padding(.top, DesignSystem.Spacing.md)
                        Spacer()
                    }
                } else if filteredNotifications.isEmpty {
                    EmptyStateCard(
                        icon: showUnreadOnly ? "bell.slash" : "bell",
                        title: showUnreadOnly ? "No Unread Notifications" : "No Notifications",
                        message: showUnreadOnly ? 
                            "All caught up! No unread notifications." :
                            "You'll see location-based reminders here when you're near your tasks.",
                        actionTitle: nil,
                        action: nil
                    )
                    .padding()
                } else {
                    ScrollView {
                        LazyVStack(spacing: DesignSystem.Spacing.md) {
                            ForEach(filteredNotifications) { notification in
                                NotificationCard(
                                    title: notification.title,
                                    message: notification.message,
                                    timestamp: notification.timestamp,
                                    isRead: notification.isRead,
                                    actions: notification.actions
                                )
                                .onTapGesture {
                                    markAsRead(notification)
                                    navigationCoordinator.navigateTo(.notificationDetail(notification.id))
                                }
                            }
                        }
                        .padding()
                    }
                }
            }
        }
        .onAppear {
            loadNotifications()
        }
    }
    
    private func markAsRead(_ notification: NotificationItem) {
        if let index = notifications.firstIndex(where: { $0.id == notification.id }) {
            notifications[index].isRead = true
        }
    }
    
    private func loadNotifications() {
        isLoading = true
        // TODO: Implement actual notification loading from backend
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            // Mock data for now
            notifications = [
                NotificationItem(
                    id: "1",
                    title: "Task Reminder",
                    message: "You're near Whole Foods Market. Don't forget to buy groceries!",
                    timestamp: Date().addingTimeInterval(-300),
                    isRead: false,
                    actions: [
                        NotificationCard.NotificationAction(title: "Complete", action: {}, style: .primary),
                        NotificationCard.NotificationAction(title: "Snooze", action: {}, style: .secondary)
                    ]
                ),
                NotificationItem(
                    id: "2",
                    title: "Location Update",
                    message: "You've arrived at UPS Store. Ready to drop off your package?",
                    timestamp: Date().addingTimeInterval(-1800),
                    isRead: true,
                    actions: [
                        NotificationCard.NotificationAction(title: "Complete", action: {}, style: .primary)
                    ]
                ),
                NotificationItem(
                    id: "3",
                    title: "Task Completed",
                    message: "Great job! You've completed your grocery shopping task.",
                    timestamp: Date().addingTimeInterval(-3600),
                    isRead: true,
                    actions: []
                )
            ]
            isLoading = false
        }
    }
}

// MARK: - Notification Item Model
struct NotificationItem: Identifiable {
    let id: String
    let title: String
    let message: String
    let timestamp: Date
    var isRead: Bool
    let actions: [NotificationCard.NotificationAction]
}

// MARK: - Notifications View Previews
struct NotificationsView_Previews: PreviewProvider {
    static var previews: some View {
        NotificationsView()
            .environmentObject(NavigationCoordinator())
            .environmentObject(LocationManager())
            .environmentObject(NotificationManager())
    }
}
