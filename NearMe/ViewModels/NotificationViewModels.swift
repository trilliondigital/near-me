import Foundation
import Combine
import UserNotifications

// MARK: - Notification History View Model
class NotificationHistoryViewModel: ObservableObject {
    @Published var notifications: [NotificationItem] = []
    @Published var selectedFilter: NotificationFilter = .all
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private var cancellables = Set<AnyCancellable>()
    private let notificationService = NotificationService.shared
    
    var filteredNotifications: [NotificationItem] {
        let filtered = notifications.filter { notification in
            switch selectedFilter {
            case .all:
                return true
            case .unread:
                return !notification.isRead
            case .today:
                return Calendar.current.isDateInToday(notification.timestamp)
            case .thisWeek:
                return Calendar.current.isDate(notification.timestamp, equalTo: Date(), toGranularity: .weekOfYear)
            case .completed:
                return notification.type == .completion
            case .snoozed:
                return notification.actions.contains { $0.identifier.contains("SNOOZE") }
            }
        }
        
        return filtered.sorted { $0.timestamp > $1.timestamp }
    }
    
    init() {
        setupNotificationObservers()
    }
    
    private func setupNotificationObservers() {
        // Listen for new notifications
        NotificationCenter.default.publisher(for: .newNotificationReceived)
            .sink { [weak self] notification in
                self?.handleNewNotification(notification)
            }
            .store(in: &cancellables)
        
        // Listen for notification actions
        NotificationCenter.default.publisher(for: .notificationActionPerformed)
            .sink { [weak self] notification in
                self?.handleNotificationAction(notification)
            }
            .store(in: &cancellables)
    }
    
    func loadNotifications() {
        isLoading = true
        errorMessage = nil
        
        notificationService.getNotificationHistory { [weak self] result in
            DispatchQueue.main.async {
                self?.isLoading = false
                
                switch result {
                case .success(let notifications):
                    self?.notifications = notifications
                case .failure(let error):
                    self?.errorMessage = error.localizedDescription
                    self?.loadSampleNotifications() // Fallback to sample data
                }
            }
        }
    }
    
    func handleAction(_ action: NotificationAction, for notification: NotificationItem) {
        // Update local state immediately for responsive UI
        if let index = notifications.firstIndex(where: { $0.id == notification.id }) {
            notifications[index].isRead = true
        }
        
        // Handle the action
        switch action.identifier {
        case "COMPLETE_ACTION":
            handleCompleteAction(notification)
        case "SNOOZE_15M_ACTION":
            handleSnoozeAction(notification, duration: .fifteenMinutes)
        case "SNOOZE_1H_ACTION":
            handleSnoozeAction(notification, duration: .oneHour)
        case "SNOOZE_TODAY_ACTION":
            handleSnoozeAction(notification, duration: .today)
        case "MUTE_ACTION":
            handleMuteAction(notification)
        case "OPEN_MAP_ACTION":
            handleOpenMapAction(notification)
        default:
            break
        }
        
        // Send action to backend
        notificationService.performNotificationAction(
            notificationId: notification.id,
            action: action.identifier
        ) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    print("Action performed successfully")
                case .failure(let error):
                    self?.errorMessage = "Failed to perform action: \(error.localizedDescription)"
                }
            }
        }
    }
    
    func markAllAsRead() {
        notifications = notifications.map { notification in
            var updatedNotification = notification
            updatedNotification.isRead = true
            return updatedNotification
        }
        
        notificationService.markAllNotificationsAsRead { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    print("All notifications marked as read")
                case .failure(let error):
                    self?.errorMessage = "Failed to mark notifications as read: \(error.localizedDescription)"
                }
            }
        }
    }
    
    func deleteNotification(_ notification: NotificationItem) {
        notifications.removeAll { $0.id == notification.id }
        
        notificationService.deleteNotification(notification.id) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    print("Notification deleted successfully")
                case .failure(let error):
                    self?.errorMessage = "Failed to delete notification: \(error.localizedDescription)"
                    // Re-add the notification if deletion failed
                    self?.notifications.append(notification)
                }
            }
        }
    }
    
    // MARK: - Private Methods
    
    private func handleNewNotification(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let notificationData = userInfo["notification"] as? NotificationItem else {
            return
        }
        
        notifications.insert(notificationData, at: 0)
    }
    
    private func handleNotificationAction(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let notificationId = userInfo["notificationId"] as? String,
              let action = userInfo["action"] as? String else {
            return
        }
        
        // Update notification based on action
        if let index = notifications.firstIndex(where: { $0.id == notificationId }) {
            switch action {
            case "complete":
                notifications.remove(at: index)
            case "snooze":
                notifications[index].isRead = true
            case "mute":
                notifications.remove(at: index)
            default:
                break
            }
        }
    }
    
    private func handleCompleteAction(_ notification: NotificationItem) {
        // Post completion notification
        NotificationCenter.default.post(
            name: .taskCompleted,
            object: notification.taskId
        )
        
        // Remove from list
        notifications.removeAll { $0.id == notification.id }
    }
    
    private func handleSnoozeAction(_ notification: NotificationItem, duration: SnoozeDuration) {
        // Post snooze notification
        NotificationCenter.default.post(
            name: .taskSnoozed,
            object: [
                "taskId": notification.taskId ?? "",
                "duration": duration.rawValue
            ]
        )
        
        // Mark as read
        if let index = notifications.firstIndex(where: { $0.id == notification.id }) {
            notifications[index].isRead = true
        }
    }
    
    private func handleMuteAction(_ notification: NotificationItem) {
        // Post mute notification
        NotificationCenter.default.post(
            name: .taskMuted,
            object: notification.taskId
        )
        
        // Remove from list
        notifications.removeAll { $0.id == notification.id }
    }
    
    private func handleOpenMapAction(_ notification: NotificationItem) {
        // Post map open notification
        NotificationCenter.default.post(
            name: .openMapForTask,
            object: notification.taskId
        )
    }
    
    private func loadSampleNotifications() {
        // Load sample notifications for development/demo purposes
        notifications = [
            NotificationItem(
                title: "You're near the pharmacy",
                body: "Don't forget to pick up your prescription",
                taskId: "task-1",
                type: .approach,
                actions: [.complete, .snooze15m, .snooze1h, .mute]
            ),
            NotificationItem(
                title: "Arrived at grocery store",
                body: "Time to pick up milk and bread",
                taskId: "task-2",
                type: .arrival,
                actions: [.complete, .snooze15m, .openMap],
                isRead: true
            ),
            NotificationItem(
                title: "Task completed!",
                body: "Great job picking up your dry cleaning",
                taskId: "task-3",
                type: .completion,
                isRead: true
            )
        ]
    }
}

// MARK: - Notification Settings View Model
class NotificationSettingsViewModel: ObservableObject {
    @Published var locationRemindersEnabled: Bool = true
    @Published var taskCompletionAlerts: Bool = true
    @Published var dailySummary: Bool = false
    @Published var quietHoursEnabled: Bool = false
    @Published var quietHoursStart: Date = Calendar.current.date(bySettingHour: 22, minute: 0, second: 0, of: Date()) ?? Date()
    @Published var quietHoursEnd: Date = Calendar.current.date(bySettingHour: 8, minute: 0, second: 0, of: Date()) ?? Date()
    @Published var defaultSnoozeDuration: SnoozeDuration = .fifteenMinutes
    @Published var soundEnabled: Bool = true
    @Published var vibrationEnabled: Bool = true
    @Published var badgeEnabled: Bool = true
    
    private let settingsKey = "notification_settings"
    private let notificationService = NotificationService.shared
    
    func loadSettings() {
        if let data = UserDefaults.standard.data(forKey: settingsKey),
           let settings = try? JSONDecoder().decode(NotificationSettings.self, from: data) {
            locationRemindersEnabled = settings.locationRemindersEnabled
            taskCompletionAlerts = settings.taskCompletionAlerts
            dailySummary = settings.dailySummary
            quietHoursEnabled = settings.quietHoursEnabled
            quietHoursStart = settings.quietHoursStart
            quietHoursEnd = settings.quietHoursEnd
            defaultSnoozeDuration = settings.defaultSnoozeDuration
            soundEnabled = settings.soundEnabled
            vibrationEnabled = settings.vibrationEnabled
            badgeEnabled = settings.badgeEnabled
        }
    }
    
    func saveSettings() {
        let settings = NotificationSettings(
            locationRemindersEnabled: locationRemindersEnabled,
            taskCompletionAlerts: taskCompletionAlerts,
            dailySummary: dailySummary,
            quietHoursEnabled: quietHoursEnabled,
            quietHoursStart: quietHoursStart,
            quietHoursEnd: quietHoursEnd,
            defaultSnoozeDuration: defaultSnoozeDuration,
            soundEnabled: soundEnabled,
            vibrationEnabled: vibrationEnabled,
            badgeEnabled: badgeEnabled
        )
        
        if let data = try? JSONEncoder().encode(settings) {
            UserDefaults.standard.set(data, forKey: settingsKey)
        }
        
        // Send settings to backend
        notificationService.updateNotificationSettings(settings) { result in
            switch result {
            case .success:
                print("Notification settings updated successfully")
            case .failure(let error):
                print("Failed to update notification settings: \(error)")
            }
        }
    }
    
    func resetToDefaults() {
        locationRemindersEnabled = true
        taskCompletionAlerts = true
        dailySummary = false
        quietHoursEnabled = false
        quietHoursStart = Calendar.current.date(bySettingHour: 22, minute: 0, second: 0, of: Date()) ?? Date()
        quietHoursEnd = Calendar.current.date(bySettingHour: 8, minute: 0, second: 0, of: Date()) ?? Date()
        defaultSnoozeDuration = .fifteenMinutes
        soundEnabled = true
        vibrationEnabled = true
        badgeEnabled = true
        
        saveSettings()
    }
}

// MARK: - Notification Service
class NotificationService {
    static let shared = NotificationService()
    
    private let apiBaseURL = "http://localhost:3000/api" // TODO: Move to configuration
    private let session = URLSession.shared
    
    private init() {}
    
    func getNotificationHistory(completion: @escaping (Result<[NotificationItem], Error>) -> Void) {
        // TODO: Implement actual API call
        // For now, return sample data
        DispatchQueue.global().asyncAfter(deadline: .now() + 1) {
            completion(.success([]))
        }
    }
    
    func performNotificationAction(
        notificationId: String,
        action: String,
        completion: @escaping (Result<Void, Error>) -> Void
    ) {
        // TODO: Implement actual API call
        DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) {
            completion(.success(()))
        }
    }
    
    func markAllNotificationsAsRead(completion: @escaping (Result<Void, Error>) -> Void) {
        // TODO: Implement actual API call
        DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) {
            completion(.success(()))
        }
    }
    
    func deleteNotification(_ notificationId: String, completion: @escaping (Result<Void, Error>) -> Void) {
        // TODO: Implement actual API call
        DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) {
            completion(.success(()))
        }
    }
    
    func updateNotificationSettings(_ settings: NotificationSettings, completion: @escaping (Result<Void, Error>) -> Void) {
        // TODO: Implement actual API call
        DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) {
            completion(.success(()))
        }
    }
}

// MARK: - Notification Names
extension Notification.Name {
    static let newNotificationReceived = Notification.Name("newNotificationReceived")
    static let notificationActionPerformed = Notification.Name("notificationActionPerformed")
    static let openMapForTask = Notification.Name("openMapForTask")
}
