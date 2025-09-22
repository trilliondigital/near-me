import Foundation

// MARK: - User Models
struct User: Identifiable, Codable {
    let id: String
    let email: String?
    let preferences: UserPreferences
    let premiumStatus: PremiumStatus
    let createdAt: Date
    let updatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case email
        case preferences
        case premiumStatus = "premium_status"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
    
    var isPremium: Bool {
        return premiumStatus == .premium || premiumStatus == .trial
    }
    
    var canCreateUnlimitedTasks: Bool {
        return isPremium
    }
    
    var maxActiveTasks: Int {
        return isPremium ? Int.max : 3
    }
}

// MARK: - Premium Status
enum PremiumStatus: String, CaseIterable, Codable {
    case free = "free"
    case trial = "trial"
    case premium = "premium"
    
    var displayName: String {
        switch self {
        case .free: return "Free"
        case .trial: return "Trial"
        case .premium: return "Premium"
        }
    }
    
    var badgeColor: String {
        switch self {
        case .free: return "Secondary"
        case .trial: return "Warning"
        case .premium: return "Premium"
        }
    }
}

// MARK: - User Preferences
struct UserPreferences: Codable {
    let notificationStyle: NotificationStyle
    let privacyMode: PrivacyMode
    let quietHours: QuietHours?
    let defaultRadii: GeofenceRadii?
    
    enum CodingKeys: String, CodingKey {
        case notificationStyle = "notification_style"
        case privacyMode = "privacy_mode"
        case quietHours = "quiet_hours"
        case defaultRadii = "default_radii"
    }
    
    static let `default` = UserPreferences(
        notificationStyle: .standard,
        privacyMode: .standard,
        quietHours: nil,
        defaultRadii: nil
    )
}

// MARK: - Notification Style
enum NotificationStyle: String, CaseIterable, Codable {
    case minimal = "minimal"
    case standard = "standard"
    case detailed = "detailed"
    
    var displayName: String {
        switch self {
        case .minimal: return "Minimal"
        case .standard: return "Standard"
        case .detailed: return "Detailed"
        }
    }
    
    var isPremiumFeature: Bool {
        return self == .detailed
    }
}

// MARK: - Privacy Mode
enum PrivacyMode: String, CaseIterable, Codable {
    case standard = "standard"
    case foregroundOnly = "foreground_only"
    
    var displayName: String {
        switch self {
        case .standard: return "Standard"
        case .foregroundOnly: return "Foreground Only"
        }
    }
    
    var description: String {
        switch self {
        case .standard: return "Location tracking when app is in background"
        case .foregroundOnly: return "Location tracking only when app is open"
        }
    }
}

// MARK: - Quiet Hours
struct QuietHours: Codable {
    let startTime: String // HH:mm format
    let endTime: String // HH:mm format
    let enabled: Bool
    
    static let `default` = QuietHours(
        startTime: "22:00",
        endTime: "08:00",
        enabled: false
    )
}

// MARK: - Premium Features
enum PremiumFeature: String, CaseIterable {
    case unlimitedTasks = "unlimited_tasks"
    case customNotificationSounds = "custom_notification_sounds"
    case detailedNotifications = "detailed_notifications"
    case advancedGeofencing = "advanced_geofencing"
    case prioritySupport = "priority_support"
    case exportData = "export_data"
    
    var displayName: String {
        switch self {
        case .unlimitedTasks: return "Unlimited Tasks"
        case .customNotificationSounds: return "Custom Notification Sounds"
        case .detailedNotifications: return "Detailed Notifications"
        case .advancedGeofencing: return "Advanced Geofencing"
        case .prioritySupport: return "Priority Support"
        case .exportData: return "Export Data"
        }
    }
    
    var description: String {
        switch self {
        case .unlimitedTasks: return "Create as many location-based tasks as you need"
        case .customNotificationSounds: return "Choose custom sounds for your notifications"
        case .detailedNotifications: return "Rich notifications with more context and actions"
        case .advancedGeofencing: return "Fine-tune geofence radii and timing"
        case .prioritySupport: return "Get help faster with priority customer support"
        case .exportData: return "Export your tasks and data anytime"
        }
    }
    
    var icon: String {
        switch self {
        case .unlimitedTasks: return "infinity"
        case .customNotificationSounds: return "speaker.wave.3.fill"
        case .detailedNotifications: return "bell.badge.fill"
        case .advancedGeofencing: return "location.circle.fill"
        case .prioritySupport: return "headphones"
        case .exportData: return "square.and.arrow.up.fill"
        }
    }
}

// MARK: - Task Limit Status
struct TaskLimitStatus {
    let currentCount: Int
    let maxCount: Int
    let isPremium: Bool
    
    var isAtLimit: Bool {
        return !isPremium && currentCount >= maxCount
    }
    
    var remainingTasks: Int {
        return isPremium ? Int.max : max(0, maxCount - currentCount)
    }
    
    var progressPercentage: Double {
        guard !isPremium && maxCount > 0 else { return 0.0 }
        return min(1.0, Double(currentCount) / Double(maxCount))
    }
    
    var warningThreshold: Bool {
        return !isPremium && currentCount >= maxCount - 1
    }
}

// MARK: - User Update Request
struct UpdateUserRequest: Codable {
    let email: String?
    let preferences: UserPreferences?
    let premiumStatus: PremiumStatus?
    
    enum CodingKeys: String, CodingKey {
        case email
        case preferences
        case premiumStatus = "premium_status"
    }
}