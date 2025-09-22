import Foundation
import UserNotifications
import Combine

// MARK: - Notification Interaction Service
class NotificationInteractionService: ObservableObject {
    static let shared = NotificationInteractionService()
    
    @Published var activeInAppNotifications: [NotificationItem] = []
    @Published var showSnoozePicker = false
    @Published var selectedNotificationForSnooze: NotificationItem?
    @Published var selectedSnoozeDuration: SnoozeDuration = .fifteenMinutes
    
    private var cancellables = Set<AnyCancellable>()
    private let notificationManager = NotificationManager()
    private let apiService = APIService.shared
    
    private init() {
        setupNotificationObservers()
    }
    
    // MARK: - Setup
    
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
    
    // MARK: - In-App Notification Management
    
    func showInAppNotification(_ notification: NotificationItem) {
        // Prevent duplicate notifications
        guard !activeInAppNotifications.contains(where: { $0.id == notification.id }) else {
            return
        }
        
        activeInAppNotifications.append(notification)
        
        // Auto-dismiss after 10 seconds if no interaction
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) {
            self.dismissInAppNotification(notification.id)
        }
    }
    
    func dismissInAppNotification(_ notificationId: String) {
        activeInAppNotifications.removeAll { $0.id == notificationId }
    }
    
    func dismissAllInAppNotifications() {
        activeInAppNotifications.removeAll()
    }
    
    // MARK: - Action Handling
    
    func handleNotificationAction(_ action: NotificationAction, for notification: NotificationItem) {
        switch action.identifier {
        case "COMPLETE_ACTION":
            handleCompleteAction(notification)
        case "SNOOZE_15M_ACTION":
            handleSnoozeAction(notification, duration: .fifteenMinutes)
        case "SNOOZE_1H_ACTION":
            handleSnoozeAction(notification, duration: .oneHour)
        case "SNOOZE_TODAY_ACTION":
            handleSnoozeAction(notification, duration: .today)
        case "SNOOZE_CUSTOM_ACTION":
            showCustomSnoozePicker(for: notification)
        case "MUTE_ACTION":
            handleMuteAction(notification)
        case "OPEN_MAP_ACTION":
            handleOpenMapAction(notification)
        default:
            break
        }
        
        // Remove from in-app notifications
        dismissInAppNotification(notification.id)
        
        // Mark as read
        markNotificationAsRead(notification)
    }
    
    private func handleCompleteAction(_ notification: NotificationItem) {
        guard let taskId = notification.taskId else { return }
        
        // Complete the task
        apiService.completeTask(taskId) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    // Post completion notification
                    NotificationCenter.default.post(
                        name: .taskCompleted,
                        object: taskId
                    )
                    
                    // Show success feedback
                    self?.showCompletionFeedback(for: notification)
                    
                case .failure(let error):
                    print("Failed to complete task: \(error)")
                    // Show error feedback
                    self?.showErrorFeedback("Failed to complete task")
                }
            }
        }
    }
    
    private func handleSnoozeAction(_ notification: NotificationItem, duration: SnoozeDuration) {
        guard let taskId = notification.taskId else { return }
        
        // Snooze the task
        apiService.snoozeTask(taskId, duration: duration) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    // Post snooze notification
                    NotificationCenter.default.post(
                        name: .taskSnoozed,
                        object: [
                            "taskId": taskId,
                            "duration": duration.rawValue
                        ]
                    )
                    
                    // Show snooze feedback
                    self?.showSnoozeFeedback(for: notification, duration: duration)
                    
                case .failure(let error):
                    print("Failed to snooze task: \(error)")
                    // Show error feedback
                    self?.showErrorFeedback("Failed to snooze task")
                }
            }
        }
    }
    
    private func handleMuteAction(_ notification: NotificationItem) {
        guard let taskId = notification.taskId else { return }
        
        // Mute the task
        apiService.muteTask(taskId) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    // Post mute notification
                    NotificationCenter.default.post(
                        name: .taskMuted,
                        object: taskId
                    )
                    
                    // Show mute feedback
                    self?.showMuteFeedback(for: notification)
                    
                case .failure(let error):
                    print("Failed to mute task: \(error)")
                    // Show error feedback
                    self?.showErrorFeedback("Failed to mute task")
                }
            }
        }
    }
    
    private func handleOpenMapAction(_ notification: NotificationItem) {
        guard let taskId = notification.taskId else { return }
        
        // Post map open notification
        NotificationCenter.default.post(
            name: .openMapForTask,
            object: taskId
        )
    }
    
    // MARK: - Custom Snooze Picker
    
    private func showCustomSnoozePicker(for notification: NotificationItem) {
        selectedNotificationForSnooze = notification
        showSnoozePicker = true
    }
    
    func confirmCustomSnooze() {
        guard let notification = selectedNotificationForSnooze else { return }
        
        handleSnoozeAction(notification, duration: selectedSnoozeDuration)
        
        // Reset picker state
        selectedNotificationForSnooze = nil
        showSnoozePicker = false
    }
    
    func cancelCustomSnooze() {
        selectedNotificationForSnooze = nil
        showSnoozePicker = false
    }
    
    // MARK: - Feedback Methods
    
    private func showCompletionFeedback(for notification: NotificationItem) {
        let feedbackNotification = NotificationItem(
            title: "Task Completed! ✅",
            body: "Great job completing your task",
            type: .completion,
            category: .system
        )
        
        showInAppNotification(feedbackNotification)
        
        // Haptic feedback
        let impactFeedback = UIImpactFeedbackGenerator(style: .medium)
        impactFeedback.impactOccurred()
    }
    
    private func showSnoozeFeedback(for notification: NotificationItem, duration: SnoozeDuration) {
        let feedbackNotification = NotificationItem(
            title: "Task Snoozed 😴",
            body: "We'll remind you again \(duration.description.lowercased())",
            type: .system,
            category: .system
        )
        
        showInAppNotification(feedbackNotification)
        
        // Haptic feedback
        let impactFeedback = UIImpactFeedbackGenerator(style: .light)
        impactFeedback.impactOccurred()
    }
    
    private func showMuteFeedback(for notification: NotificationItem) {
        let feedbackNotification = NotificationItem(
            title: "Task Muted 🔇",
            body: "You won't receive more reminders for this task",
            type: .system,
            category: .system
        )
        
        showInAppNotification(feedbackNotification)
        
        // Haptic feedback
        let impactFeedback = UIImpactFeedbackGenerator(style: .light)
        impactFeedback.impactOccurred()
    }
    
    private func showErrorFeedback(_ message: String) {
        let feedbackNotification = NotificationItem(
            title: "Error ⚠️",
            body: message,
            type: .system,
            category: .system
        )
        
        showInAppNotification(feedbackNotification)
        
        // Haptic feedback
        let notificationFeedback = UINotificationFeedbackGenerator()
        notificationFeedback.notificationOccurred(.error)
    }
    
    // MARK: - Helper Methods
    
    private func handleNewNotification(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let notificationData = userInfo["notification"] as? NotificationItem else {
            return
        }
        
        showInAppNotification(notificationData)
    }
    
    private func handleNotificationAction(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let notificationId = userInfo["notificationId"] as? String,
              let actionIdentifier = userInfo["action"] as? String else {
            return
        }
        
        // Find the notification and create action
        if let notificationItem = activeInAppNotifications.first(where: { $0.id == notificationId }),
           let action = notificationItem.actions.first(where: { $0.identifier == actionIdentifier }) {
            handleNotificationAction(action, for: notificationItem)
        }
    }
    
    private func markNotificationAsRead(_ notification: NotificationItem) {
        apiService.markNotificationAsRead(notification.id) { result in
            switch result {
            case .success:
                print("Notification marked as read")
            case .failure(let error):
                print("Failed to mark notification as read: \(error)")
            }
        }
    }
}

// MARK: - API Service Extension
extension APIService {
    func completeTask(_ taskId: String, completion: @escaping (Result<Void, Error>) -> Void) {
        // TODO: Implement actual API call
        DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) {
            completion(.success(()))
        }
    }
    
    func snoozeTask(_ taskId: String, duration: SnoozeDuration, completion: @escaping (Result<Void, Error>) -> Void) {
        // TODO: Implement actual API call
        DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) {
            completion(.success(()))
        }
    }
    
    func muteTask(_ taskId: String, completion: @escaping (Result<Void, Error>) -> Void) {
        // TODO: Implement actual API call
        DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) {
            completion(.success(()))
        }
    }
    
    func markNotificationAsRead(_ notificationId: String, completion: @escaping (Result<Void, Error>) -> Void) {
        // TODO: Implement actual API call
        DispatchQueue.global().asyncAfter(deadline: .now() + 0.5) {
            completion(.success(()))
        }
    }
}

// MARK: - Placeholder API Service
class APIService {
    static let shared = APIService()
    private init() {}
}