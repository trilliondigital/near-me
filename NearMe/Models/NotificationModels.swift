import Foundation
import UserNotifications

// MARK: - Notification Item Model
struct NotificationItem: Identifiable, Codable {
    let id: String
    let title: String
    let body: String
    let timestamp: Date
    let taskId: String?
    let type: NotificationType
    let actions: [NotificationAction]
    var isRead: Bool
    let category: NotificationCategory
    
    enum CodingKeys: String, CodingKey {
        case id, title, body, timestamp, taskId, type, actions, isRead, category
    }
    
    init(
        id: String = UUID().uuidString,
        title: String,
        body: String,
        timestamp: Date = Date(),
        taskId: String? = nil,
        type: NotificationType,
        actions: [NotificationAction] = [],
        isRead: Bool = false,
        category: NotificationCategory = .reminder
    ) {
        self.id = id
        self.title = title
        self.body = body
        self.timestamp = timestamp
        self.taskId = taskId
        self.type = type
        self.actions = actions
        self.isRead = isRead
        self.category = category
    }
    
    static let sample = NotificationItem(
        title: "You're near the pharmacy",
        body: "Don't forget to pick up your prescription",
        taskId: "task-123",
        type: .approach,
        actions: [
            NotificationAction.complete,
            NotificationAction.snooze15m,
            NotificationAction.snooze1h,
            NotificationAction.mute
        ]
    )
}

// MARK: - Notification Action Model
struct NotificationAction: Identifiable, Codable {
    let id: String
    let identifier: String
    let title: String
    let icon: String
    let backgroundColor: Color
    let foregroundColor: Color
    
    enum CodingKeys: String, CodingKey {
        case id, identifier, title, icon
    }
    
    init(
        id: String = UUID().uuidString,
        identifier: String,
        title: String,
        icon: String,
        backgroundColor: Color = DesignSystem.Colors.primary,
        foregroundColor: Color = DesignSystem.Colors.textInverse
    ) {
        self.id = id
        self.identifier = identifier
        self.title = title
        self.icon = icon
        self.backgroundColor = backgroundColor
        self.foregroundColor = foregroundColor
    }
    
    // Predefined actions
    static let complete = NotificationAction(
        identifier: "COMPLETE_ACTION",
        title: "Complete",
        icon: "checkmark.circle.fill",
        backgroundColor: DesignSystem.Colors.success
    )
    
    static let snooze15m = NotificationAction(
        identifier: "SNOOZE_15M_ACTION",
        title: "15m",
        icon: "clock",
        backgroundColor: DesignSystem.Colors.warning
    )
    
    static let snooze1h = NotificationAction(
        identifier: "SNOOZE_1H_ACTION",
        title: "1h",
        icon: "clock.fill",
        backgroundColor: DesignSystem.Colors.warning
    )
    
    static let snoozeToday = NotificationAction(
        identifier: "SNOOZE_TODAY_ACTION",
        title: "Today",
        icon: "calendar",
        backgroundColor: DesignSystem.Colors.warning
    )
    
    static let mute = NotificationAction(
        identifier: "MUTE_ACTION",
        title: "Mute",
        icon: "speaker.slash.fill",
        backgroundColor: DesignSystem.Colors.error
    )
    
    static let openMap = NotificationAction(
        identifier: "OPEN_MAP_ACTION",
        title: "Map",
        icon: "map.fill",
        backgroundColor: DesignSystem.Colors.secondary
    )
}

// MARK: - Notification Type
enum NotificationType: String, CaseIterable, Codable {
    case approach = "approach"
    case arrival = "arrival"
    case postArrival = "post_arrival"
    case reminder = "reminder"
    case completion = "completion"
    case system = "system"
    
    var displayName: String {
        switch self {
        case .approach:
            return "Approach"
        case .arrival:
            return "Arrival"
        case .postArrival:
            return "Post-Arrival"
        case .reminder:
            return "Reminder"
        case .completion:
            return "Completion"
        case .system:
            return "System"
        }
    }
    
    var icon: String {
        switch self {
        case .approach:
            return "location.circle"
        case .arrival:
            return "mappin.circle.fill"
        case .postArrival:
            return "clock.circle"
        case .reminder:
            return "bell.circle"
        case .completion:
            return "checkmark.circle.fill"
        case .system:
            return "gear.circle"
        }
    }
}

// MARK: - Notification Category
enum NotificationCategory: String, CaseIterable, Codable {
    case reminder = "reminder"
    case task = "task"
    case system = "system"
    case marketing = "marketing"
    
    var displayName: String {
        switch self {
        case .reminder:
            return "Reminders"
        case .task:
            return "Tasks"
        case .system:
            return "System"
        case .marketing:
            return "Updates"
        }
    }
}

// MARK: - Notification Filter
enum NotificationFilter: CaseIterable {
    case all
    case unread
    case today
    case thisWeek
    case completed
    case snoozed
    
    var title: String {
        switch self {
        case .all:
            return "All"
        case .unread:
            return "Unread"
        case .today:
            return "Today"
        case .thisWeek:
            return "This Week"
        case .completed:
            return "Completed"
        case .snoozed:
            return "Snoozed"
        }
    }
    
    var emptyStateIcon: String {
        switch self {
        case .all:
            return "bell.slash"
        case .unread:
            return "bell.badge"
        case .today:
            return "calendar.badge.clock"
        case .thisWeek:
            return "calendar"
        case .completed:
            return "checkmark.circle"
        case .snoozed:
            return "clock.badge"
        }
    }
    
    var emptyStateTitle: String {
        switch self {
        case .all:
            return "No Notifications Yet"
        case .unread:
            return "All Caught Up!"
        case .today:
            return "No Notifications Today"
        case .thisWeek:
            return "No Notifications This Week"
        case .completed:
            return "No Completed Tasks"
        case .snoozed:
            return "No Snoozed Tasks"
        }
    }
    
    var emptyStateMessage: String {
        switch self {
        case .all:
            return "When you create tasks and get location reminders, they'll appear here."
        case .unread:
            return "You've read all your notifications. Great job staying organized!"
        case .today:
            return "No notifications scheduled for today. Check back later or create a new task."
        case .thisWeek:
            return "No notifications this week. Create some tasks to get started."
        case .completed:
            return "No tasks have been completed yet. Complete a task to see it here."
        case .snoozed:
            return "No tasks are currently snoozed. Snooze a task to see it here."
        }
    }
}

// MARK: - Snooze Duration
enum SnoozeDuration: String, CaseIterable, Codable {
    case fifteenMinutes = "15m"
    case oneHour = "1h"
    case fourHours = "4h"
    case today = "today"
    case tomorrow = "tomorrow"
    
    var title: String {
        switch self {
        case .fifteenMinutes:
            return "15 Minutes"
        case .oneHour:
            return "1 Hour"
        case .fourHours:
            return "4 Hours"
        case .today:
            return "Until Tomorrow"
        case .tomorrow:
            return "Until Day After Tomorrow"
        }
    }
    
    var timeInterval: TimeInterval {
        switch self {
        case .fifteenMinutes:
            return 15 * 60
        case .oneHour:
            return 60 * 60
        case .fourHours:
            return 4 * 60 * 60
        case .today:
            return 24 * 60 * 60
        case .tomorrow:
            return 48 * 60 * 60
        }
    }
}

// MARK: - Notification Settings Model
struct NotificationSettings: Codable {
    var locationRemindersEnabled: Bool = true
    var taskCompletionAlerts: Bool = true
    var dailySummary: Bool = false
    var quietHoursEnabled: Bool = false
    var quietHoursStart: Date = Calendar.current.date(bySettingHour: 22, minute: 0, second: 0, of: Date()) ?? Date()
    var quietHoursEnd: Date = Calendar.current.date(bySettingHour: 8, minute: 0, second: 0, of: Date()) ?? Date()
    var defaultSnoozeDuration: SnoozeDuration = .fifteenMinutes
    var soundEnabled: Bool = true
    var vibrationEnabled: Bool = true
    var badgeEnabled: Bool = true
    
    static let `default` = NotificationSettings()
}

// MARK: - Color Codable Extension
extension Color: Codable {
    enum CodingKeys: String, CodingKey {
        case red, green, blue, alpha
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let red = try container.decode(Double.self, forKey: .red)
        let green = try container.decode(Double.self, forKey: .green)
        let blue = try container.decode(Double.self, forKey: .blue)
        let alpha = try container.decode(Double.self, forKey: .alpha)
        
        self.init(.sRGB, red: red, green: green, blue: blue, opacity: alpha)
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        if let components = UIColor(self).cgColor.components {
            try container.encode(components[0], forKey: .red)
            try container.encode(components[1], forKey: .green)
            try container.encode(components[2], forKey: .blue)
            try container.encode(components[3], forKey: .alpha)
        }
    }
}
