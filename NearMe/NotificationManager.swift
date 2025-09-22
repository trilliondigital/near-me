import Foundation
import UserNotifications
import Combine

class NotificationManager: NSObject, ObservableObject {
    @Published var authorizationStatus: UNAuthorizationStatus = .notDetermined
    @Published var isNotificationEnabled = false
    
    override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
        checkAuthorizationStatus()
    }
    
    func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            DispatchQueue.main.async {
                self.isNotificationEnabled = granted
                self.checkAuthorizationStatus()
            }
        }
    }
    
    private func checkAuthorizationStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                self.authorizationStatus = settings.authorizationStatus
                self.isNotificationEnabled = settings.authorizationStatus == .authorized
            }
        }
    }
    
    func scheduleLocationNotification(
        identifier: String,
        title: String,
        body: String,
        taskId: String? = nil,
        actions: [UNNotificationAction] = []
    ) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        
        // Add task ID to user info for action handling
        if let taskId = taskId {
            content.userInfo = ["task_id": taskId]
        }
        
        if !actions.isEmpty {
            let category = UNNotificationCategory(
                identifier: "LOCATION_REMINDER",
                actions: actions,
                intentIdentifiers: [],
                options: []
            )
            UNUserNotificationCenter.current().setNotificationCategories([category])
            content.categoryIdentifier = "LOCATION_REMINDER"
        }
        
        let request = UNNotificationRequest(
            identifier: identifier,
            content: content,
            trigger: nil // Immediate delivery
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Error scheduling notification: \(error)")
            } else {
                // Post notification to UI
                self.postNotificationToUI(
                    identifier: identifier,
                    title: title,
                    body: body,
                    taskId: taskId
                )
            }
        }
    }
    
    private func postNotificationToUI(
        identifier: String,
        title: String,
        body: String,
        taskId: String?
    ) {
        let notificationItem = NotificationItem(
            id: identifier,
            title: title,
            body: body,
            taskId: taskId,
            type: .reminder,
            actions: createNotificationActions()
        )
        
        NotificationCenter.default.post(
            name: .newNotificationReceived,
            object: nil,
            userInfo: ["notification": notificationItem]
        )
    }
    
    func cancelNotification(identifier: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [identifier])
    }
    
    func createNotificationActions() -> [UNNotificationAction] {
        return [
            UNNotificationAction(
                identifier: "COMPLETE_ACTION",
                title: "Complete",
                options: []
            ),
            UNNotificationAction(
                identifier: "SNOOZE_15M_ACTION",
                title: "Snooze 15m",
                options: []
            ),
            UNNotificationAction(
                identifier: "SNOOZE_1H_ACTION",
                title: "Snooze 1h",
                options: []
            ),
            UNNotificationAction(
                identifier: "SNOOZE_TODAY_ACTION",
                title: "Snooze Today",
                options: []
            ),
            UNNotificationAction(
                identifier: "MUTE_ACTION",
                title: "Mute",
                options: [.destructive]
            )
        ]
    }
    
    // MARK: - Action Handlers
    
    private func handleCompleteAction(notificationIdentifier: String) {
        // Extract task ID from notification identifier
        let taskId = extractTaskId(from: notificationIdentifier)
        
        // Post notification for completion
        NotificationCenter.default.post(
            name: .taskCompleted,
            object: taskId
        )
        
        // Post action performed notification for UI
        NotificationCenter.default.post(
            name: .notificationActionPerformed,
            object: nil,
            userInfo: [
                "notificationId": notificationIdentifier,
                "action": "complete"
            ]
        )
        
        // Cancel the notification
        cancelNotification(identifier: notificationIdentifier)
        
        // TODO: Send completion to backend API
        sendTaskCompletion(taskId: taskId)
    }
    
    private func handleSnoozeAction(notificationIdentifier: String, duration: String) {
        // Extract task ID from notification identifier
        let taskId = extractTaskId(from: notificationIdentifier)
        
        // Post notification for snooze
        NotificationCenter.default.post(
            name: .taskSnoozed,
            object: ["taskId": taskId, "duration": duration]
        )
        
        // Post action performed notification for UI
        NotificationCenter.default.post(
            name: .notificationActionPerformed,
            object: nil,
            userInfo: [
                "notificationId": notificationIdentifier,
                "action": "snooze"
            ]
        )
        
        // Cancel the current notification
        cancelNotification(identifier: notificationIdentifier)
        
        // Schedule snooze notification
        scheduleSnoozeNotification(
            taskId: taskId,
            duration: duration,
            originalIdentifier: notificationIdentifier
        )
        
        // TODO: Send snooze to backend API
        sendTaskSnooze(taskId: taskId, duration: duration)
    }
    
    private func handleMuteAction(notificationIdentifier: String) {
        // Extract task ID from notification identifier
        let taskId = extractTaskId(from: notificationIdentifier)
        
        // Post notification for mute
        NotificationCenter.default.post(
            name: .taskMuted,
            object: taskId
        )
        
        // Post action performed notification for UI
        NotificationCenter.default.post(
            name: .notificationActionPerformed,
            object: nil,
            userInfo: [
                "notificationId": notificationIdentifier,
                "action": "mute"
            ]
        )
        
        // Cancel the notification
        cancelNotification(identifier: notificationIdentifier)
        
        // TODO: Send mute to backend API
        sendTaskMute(taskId: taskId)
    }
    
    // MARK: - Helper Methods
    
    private func extractTaskId(from notificationIdentifier: String) -> String {
        // Assuming notification identifier format: "notification_{taskId}_{timestamp}"
        let components = notificationIdentifier.components(separatedBy: "_")
        return components.count > 1 ? components[1] : notificationIdentifier
    }
    
    private func scheduleSnoozeNotification(taskId: String, duration: String, originalIdentifier: String) {
        let snoozeIdentifier = "\(originalIdentifier)_snooze_\(Date().timeIntervalSince1970)"
        
        let content = UNMutableNotificationContent()
        content.title = "Task Reminder"
        content.body = "Your snoozed task is ready for attention"
        content.sound = .default
        content.categoryIdentifier = "LOCATION_REMINDER"
        
        // Calculate trigger time based on duration
        let triggerTime = calculateSnoozeTriggerTime(duration: duration)
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: triggerTime, repeats: false)
        
        let request = UNNotificationRequest(
            identifier: snoozeIdentifier,
            content: content,
            trigger: trigger
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Error scheduling snooze notification: \(error)")
            } else {
                print("Snooze notification scheduled for \(duration)")
            }
        }
    }
    
    private func calculateSnoozeTriggerTime(duration: String) -> TimeInterval {
        switch duration {
        case "15m":
            return 15 * 60 // 15 minutes
        case "1h":
            return 60 * 60 // 1 hour
        case "today":
            // Calculate time until 9 AM tomorrow
            let calendar = Calendar.current
            let now = Date()
            let tomorrow = calendar.date(byAdding: .day, value: 1, to: now) ?? now
            let tomorrow9AM = calendar.date(bySettingHour: 9, minute: 0, second: 0, of: tomorrow) ?? tomorrow
            return tomorrow9AM.timeIntervalSince(now)
        default:
            return 15 * 60 // Default to 15 minutes
        }
    }
    
    // MARK: - Backend API Calls (Placeholder)
    
    private func sendTaskCompletion(taskId: String) {
        // TODO: Implement API call to backend
        print("Task completed: \(taskId)")
    }
    
    private func sendTaskSnooze(taskId: String, duration: String) {
        // TODO: Implement API call to backend
        print("Task snoozed: \(taskId) for \(duration)")
    }
    
    private func sendTaskMute(taskId: String) {
        // TODO: Implement API call to backend
        print("Task muted: \(taskId)")
    }
}

extension NotificationManager: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let actionIdentifier = response.actionIdentifier
        let notificationIdentifier = response.notification.request.identifier
        
        switch actionIdentifier {
        case "COMPLETE_ACTION":
            handleCompleteAction(notificationIdentifier: notificationIdentifier)
        case "SNOOZE_15M_ACTION":
            handleSnoozeAction(notificationIdentifier: notificationIdentifier, duration: "15m")
        case "SNOOZE_1H_ACTION":
            handleSnoozeAction(notificationIdentifier: notificationIdentifier, duration: "1h")
        case "SNOOZE_TODAY_ACTION":
            handleSnoozeAction(notificationIdentifier: notificationIdentifier, duration: "today")
        case "MUTE_ACTION":
            handleMuteAction(notificationIdentifier: notificationIdentifier)
        default:
            break
        }
        
        completionHandler()
    }
    
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show notification even when app is in foreground
        completionHandler([.alert, .sound, .badge])
    }
}

extension Notification.Name {
    static let taskCompleted = Notification.Name("taskCompleted")
    static let taskSnoozed = Notification.Name("taskSnoozed")
    static let taskMuted = Notification.Name("taskMuted")
    static let newNotificationReceived = Notification.Name("newNotificationReceived")
    static let notificationActionPerformed = Notification.Name("notificationActionPerformed")
}