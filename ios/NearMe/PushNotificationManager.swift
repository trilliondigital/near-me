import Foundation
import UserNotifications
import Combine

class PushNotificationManager: ObservableObject {
    static let shared = PushNotificationManager()
    
    @Published var deviceToken: String?
    @Published var isTokenRegistered = false
    
    private let apiBaseURL = "http://localhost:3000/api" // TODO: Move to configuration
    private var cancellables = Set<AnyCancellable>()
    
    private init() {
        // Check if we have a stored token
        if let storedToken = UserDefaults.standard.string(forKey: "device_token") {
            self.deviceToken = storedToken
            self.isTokenRegistered = true
        }
    }
    
    // MARK: - Device Token Registration
    
    func registerDeviceToken(_ token: String) {
        self.deviceToken = token
        
        // Store token locally
        UserDefaults.standard.set(token, forKey: "device_token")
        
        // Send token to backend
        sendTokenToBackend(token)
    }
    
    private func sendTokenToBackend(_ token: String) {
        guard let url = URL(string: "\(apiBaseURL)/auth/device-token") else {
            print("Invalid API URL")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Get auth token from storage
        if let authToken = UserDefaults.standard.string(forKey: "auth_token") {
            request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        }
        
        let body = [
            "device_token": token,
            "platform": "ios"
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            print("Error encoding token registration request: \(error)")
            return
        }
        
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("Error registering device token: \(error)")
                    return
                }
                
                if let httpResponse = response as? HTTPURLResponse {
                    if httpResponse.statusCode == 200 {
                        self?.isTokenRegistered = true
                        print("Device token registered successfully")
                    } else {
                        print("Failed to register device token. Status: \(httpResponse.statusCode)")
                    }
                }
            }
        }.resume()
    }
    
    // MARK: - Remote Notification Handling
    
    func handleRemoteNotification(_ userInfo: [AnyHashable: Any]) {
        print("Handling remote notification: \(userInfo)")
        
        // Extract notification data
        if let aps = userInfo["aps"] as? [String: Any] {
            if let alert = aps["alert"] as? [String: String] {
                let title = alert["title"] ?? "Near Me"
                let body = alert["body"] ?? ""
                
                // Handle custom data
                if let taskId = userInfo["task_id"] as? String {
                    handleTaskNotification(taskId: taskId, title: title, body: body)
                }
            }
        }
    }
    
    func handleNotificationResponse(_ response: UNNotificationResponse) {
        let actionIdentifier = response.actionIdentifier
        let userInfo = response.notification.request.content.userInfo
        
        print("Handling notification response: \(actionIdentifier)")
        
        // Extract task ID from notification
        if let taskId = userInfo["task_id"] as? String {
            switch actionIdentifier {
            case "COMPLETE_ACTION":
                handleTaskAction(taskId: taskId, action: "complete")
            case "SNOOZE_ACTION":
                handleTaskAction(taskId: taskId, action: "snooze")
            case "MUTE_ACTION":
                handleTaskAction(taskId: taskId, action: "mute")
            default:
                break
            }
        }
    }
    
    // MARK: - Task Notification Handling
    
    private func handleTaskNotification(taskId: String, title: String, body: String) {
        // Post notification to be handled by the app
        NotificationCenter.default.post(
            name: .taskNotificationReceived,
            object: nil,
            userInfo: [
                "task_id": taskId,
                "title": title,
                "body": body
            ]
        )
    }
    
    private func handleTaskAction(taskId: String, action: String) {
        // Send action to backend
        sendTaskActionToBackend(taskId: taskId, action: action)
        
        // Post local notification
        NotificationCenter.default.post(
            name: .taskActionPerformed,
            object: nil,
            userInfo: [
                "task_id": taskId,
                "action": action
            ]
        )
    }
    
    private func sendTaskActionToBackend(taskId: String, action: String) {
        guard let url = URL(string: "\(apiBaseURL)/notifications/\(taskId)/action") else {
            print("Invalid API URL for task action")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Get auth token from storage
        if let authToken = UserDefaults.standard.string(forKey: "auth_token") {
            request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        }
        
        let body = ["action": action]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            print("Error encoding task action request: \(error)")
            return
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("Error sending task action: \(error)")
                return
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode == 200 {
                    print("Task action sent successfully")
                } else {
                    print("Failed to send task action. Status: \(httpResponse.statusCode)")
                }
            }
        }.resume()
    }
    
    // MARK: - Token Management
    
    func refreshToken() {
        // Request new token from APNs
        UIApplication.shared.registerForRemoteNotifications()
    }
    
    func clearToken() {
        deviceToken = nil
        isTokenRegistered = false
        UserDefaults.standard.removeObject(forKey: "device_token")
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let taskNotificationReceived = Notification.Name("taskNotificationReceived")
    static let taskActionPerformed = Notification.Name("taskActionPerformed")
}
