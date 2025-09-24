#if STUB_SERVICES
import Foundation
import UserNotifications

// Minimal async analytics stub to satisfy SceneDelegate/AppDelegate.
actor AnalyticsService {
    static let shared = AnalyticsService()
    var isSessionActive: Bool { get async { false } }
    func startSession() async {}
}

// Minimal push manager stub used by AppDelegate.
final class PushNotificationManager {
    static let shared = PushNotificationManager()
    func registerDeviceToken(_ token: Data) {}
    func handleRemoteNotification(_ userInfo: [AnyHashable: Any]) {}
    func handleNotificationResponse(_ response: UNNotificationResponse) {}
}
#endif
