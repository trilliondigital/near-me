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
        actions: [UNNotificationAction] = []
    ) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        
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
            }
        }
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
                identifier: "SNOOZE_ACTION",
                title: "Snooze 15m",
                options: []
            ),
            UNNotificationAction(
                identifier: "MUTE_ACTION",
                title: "Mute",
                options: []
            )
        ]
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
            NotificationCenter.default.post(
                name: .taskCompleted,
                object: notificationIdentifier
            )
        case "SNOOZE_ACTION":
            NotificationCenter.default.post(
                name: .taskSnoozed,
                object: notificationIdentifier
            )
        case "MUTE_ACTION":
            NotificationCenter.default.post(
                name: .taskMuted,
                object: notificationIdentifier
            )
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
}