import XCTest
import SwiftUI
import UserNotifications
import Combine
@testable import NearMe

// MARK: - Notification Integration Tests
class NotificationIntegrationTests: XCTestCase {
    
    var notificationManager: NotificationManager!
    var interactionService: NotificationInteractionService!
    var historyViewModel: NotificationHistoryViewModel!
    var settingsViewModel: NotificationSettingsViewModel!
    var cancellables: Set<AnyCancellable>!
    
    override func setUp() {
        super.setUp()
        notificationManager = NotificationManager()
        interactionService = NotificationInteractionService.shared
        historyViewModel = NotificationHistoryViewModel()
        settingsViewModel = NotificationSettingsViewModel()
        cancellables = Set<AnyCancellable>()
        
        // Clear any existing state
        interactionService.dismissAllInAppNotifications()
    }
    
    override func tearDown() {
        notificationManager = nil
        interactionService = nil
        historyViewModel = nil
        settingsViewModel = nil
        cancellables = nil
        super.tearDown()
    }
    
    // MARK: - End-to-End Notification Flow Tests
    
    func testCompleteNotificationFlow() {
        // Given
        let expectation = XCTestExpectation(description: "Complete notification flow")
        let mockNotification = NotificationItem(
            id: "integration-test-1",
            title: "Test Task Reminder",
            body: "You're near the grocery store",
            taskId: "test-task-1",
            type: .approach,
            actions: [NotificationAction.complete, NotificationAction.snooze15m]
        )
        
        var taskCompletedReceived = false
        
        // Listen for task completion
        NotificationCenter.default.publisher(for: .taskCompleted)
            .sink { notification in
                if let taskId = notification.object as? String, taskId == "test-task-1" {
                    taskCompletedReceived = true
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        // When
        // 1. Show in-app notification
        interactionService.showInAppNotification(mockNotification)
        XCTAssertTrue(interactionService.activeInAppNotifications.contains { $0.id == mockNotification.id })
        
        // 2. Handle complete action
        interactionService.handleNotificationAction(NotificationAction.complete, for: mockNotification)
        
        // Then
        wait(for: [expectation], timeout: 2.0)
        XCTAssertTrue(taskCompletedReceived)
        XCTAssertFalse(interactionService.activeInAppNotifications.contains { $0.id == mockNotification.id })
    }
    
    func testSnoozeNotificationFlow() {
        // Given
        let expectation = XCTestExpectation(description: "Snooze notification flow")
        let mockNotification = NotificationItem(
            id: "integration-test-2",
            title: "Test Task Reminder",
            body: "You're near the pharmacy",
            taskId: "test-task-2",
            type: .approach,
            actions: [NotificationAction.complete, NotificationAction.snooze15m]
        )
        
        var taskSnoozedReceived = false
        
        // Listen for task snooze
        NotificationCenter.default.publisher(for: .taskSnoozed)
            .sink { notification in
                if let userInfo = notification.object as? [String: String],
                   userInfo["taskId"] == "test-task-2" {
                    taskSnoozedReceived = true
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        // When
        // 1. Show in-app notification
        interactionService.showInAppNotification(mockNotification)
        
        // 2. Handle snooze action
        interactionService.handleNotificationAction(NotificationAction.snooze15m, for: mockNotification)
        
        // Then
        wait(for: [expectation], timeout: 2.0)
        XCTAssertTrue(taskSnoozedReceived)
        XCTAssertFalse(interactionService.activeInAppNotifications.contains { $0.id == mockNotification.id })
    }
    
    func testMuteNotificationFlow() {
        // Given
        let expectation = XCTestExpectation(description: "Mute notification flow")
        let mockNotification = NotificationItem(
            id: "integration-test-3",
            title: "Test Task Reminder",
            body: "You're near the bank",
            taskId: "test-task-3",
            type: .approach,
            actions: [NotificationAction.complete, NotificationAction.mute]
        )
        
        var taskMutedReceived = false
        
        // Listen for task mute
        NotificationCenter.default.publisher(for: .taskMuted)
            .sink { notification in
                if let taskId = notification.object as? String, taskId == "test-task-3" {
                    taskMutedReceived = true
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        // When
        // 1. Show in-app notification
        interactionService.showInAppNotification(mockNotification)
        
        // 2. Handle mute action
        interactionService.handleNotificationAction(NotificationAction.mute, for: mockNotification)
        
        // Then
        wait(for: [expectation], timeout: 2.0)
        XCTAssertTrue(taskMutedReceived)
        XCTAssertFalse(interactionService.activeInAppNotifications.contains { $0.id == mockNotification.id })
    }
    
    // MARK: - Custom Snooze Flow Tests
    
    func testCustomSnoozeFlow() {
        // Given
        let mockNotification = NotificationItem(
            id: "integration-test-4",
            title: "Test Task Reminder",
            body: "You're near the post office",
            taskId: "test-task-4",
            type: .approach
        )
        
        let customSnoozeAction = NotificationAction(
            identifier: "SNOOZE_CUSTOM_ACTION",
            title: "Custom",
            icon: "clock.arrow.circlepath"
        )
        
        // When
        // 1. Show custom snooze picker
        interactionService.handleNotificationAction(customSnoozeAction, for: mockNotification)
        
        // Then
        XCTAssertTrue(interactionService.showSnoozePicker)
        XCTAssertEqual(interactionService.selectedNotificationForSnooze?.id, mockNotification.id)
        
        // When
        // 2. Select custom duration and confirm
        interactionService.selectedSnoozeDuration = .fourHours
        interactionService.confirmCustomSnooze()
        
        // Then
        XCTAssertFalse(interactionService.showSnoozePicker)
        XCTAssertNil(interactionService.selectedNotificationForSnooze)
    }
    
    // MARK: - Notification History Integration Tests
    
    func testNotificationHistoryIntegration() {
        // Given
        let expectation = XCTestExpectation(description: "Notification history integration")
        
        // When
        historyViewModel.loadNotifications()
        
        // Then
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            XCTAssertFalse(self.historyViewModel.isLoading)
            XCTAssertGreaterThan(self.historyViewModel.notifications.count, 0)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 3.0)
    }
    
    func testNotificationHistoryFiltering() {
        // Given
        let readNotification = NotificationItem(
            title: "Read Notification",
            body: "This has been read",
            type: .completion,
            isRead: true
        )
        
        let unreadNotification = NotificationItem(
            title: "Unread Notification",
            body: "This has not been read",
            type: .approach,
            isRead: false
        )
        
        historyViewModel.notifications = [readNotification, unreadNotification]
        
        // When/Then - Test all filter
        historyViewModel.selectedFilter = .all
        XCTAssertEqual(historyViewModel.filteredNotifications.count, 2)
        
        // When/Then - Test unread filter
        historyViewModel.selectedFilter = .unread
        XCTAssertEqual(historyViewModel.filteredNotifications.count, 1)
        XCTAssertEqual(historyViewModel.filteredNotifications.first?.id, unreadNotification.id)
        
        // When/Then - Test completed filter
        historyViewModel.selectedFilter = .completed
        XCTAssertEqual(historyViewModel.filteredNotifications.count, 1)
        XCTAssertEqual(historyViewModel.filteredNotifications.first?.id, readNotification.id)
    }
    
    // MARK: - Settings Integration Tests
    
    func testNotificationSettingsIntegration() {
        // Given
        let originalSettings = NotificationSettings.default
        
        // When
        settingsViewModel.loadSettings()
        
        // Then
        XCTAssertEqual(settingsViewModel.locationRemindersEnabled, originalSettings.locationRemindersEnabled)
        XCTAssertEqual(settingsViewModel.taskCompletionAlerts, originalSettings.taskCompletionAlerts)
        XCTAssertEqual(settingsViewModel.defaultSnoozeDuration, originalSettings.defaultSnoozeDuration)
        
        // When - Modify settings
        settingsViewModel.locationRemindersEnabled = false
        settingsViewModel.defaultSnoozeDuration = .oneHour
        settingsViewModel.saveSettings()
        
        // Create new view model to test persistence
        let newViewModel = NotificationSettingsViewModel()
        newViewModel.loadSettings()
        
        // Then
        XCTAssertFalse(newViewModel.locationRemindersEnabled)
        XCTAssertEqual(newViewModel.defaultSnoozeDuration, .oneHour)
    }
    
    // MARK: - Permission Integration Tests
    
    func testNotificationPermissionIntegration() {
        // Given
        let expectation = XCTestExpectation(description: "Permission integration")
        
        // When
        notificationManager.requestNotificationPermission()
        
        // Then
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            // Note: In a real test environment, we would mock the permission response
            XCTAssertNotNil(self.notificationManager.authorizationStatus)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 2.0)
    }
    
    // MARK: - Multiple Notifications Tests
    
    func testMultipleNotificationsHandling() {
        // Given
        let notifications = (1...5).map { index in
            NotificationItem(
                id: "multi-test-\(index)",
                title: "Notification \(index)",
                body: "This is notification number \(index)",
                taskId: "task-\(index)",
                type: .approach,
                actions: [NotificationAction.complete]
            )
        }
        
        // When
        notifications.forEach { interactionService.showInAppNotification($0) }
        
        // Then
        XCTAssertEqual(interactionService.activeInAppNotifications.count, 5)
        
        // When - Handle actions for all notifications
        for notification in notifications {
            interactionService.handleNotificationAction(NotificationAction.complete, for: notification)
        }
        
        // Then
        XCTAssertEqual(interactionService.activeInAppNotifications.count, 0)
    }
    
    // MARK: - Error Handling Tests
    
    func testNotificationErrorHandling() {
        // Given
        let invalidNotification = NotificationItem(
            id: "invalid-test",
            title: "Invalid Notification",
            body: "This notification has no task ID",
            taskId: nil, // Invalid - no task ID
            type: .approach,
            actions: [NotificationAction.complete]
        )
        
        // When
        interactionService.showInAppNotification(invalidNotification)
        interactionService.handleNotificationAction(NotificationAction.complete, for: invalidNotification)
        
        // Then - Should handle gracefully without crashing
        XCTAssertFalse(interactionService.activeInAppNotifications.contains { $0.id == invalidNotification.id })
    }
    
    // MARK: - Performance Integration Tests
    
    func testNotificationSystemPerformance() {
        // Given
        let notifications = (1...100).map { index in
            NotificationItem(
                id: "perf-test-\(index)",
                title: "Performance Test \(index)",
                body: "Testing notification system performance",
                taskId: "task-\(index)",
                type: .approach,
                actions: [NotificationAction.complete, NotificationAction.snooze15m]
            )
        }
        
        // When/Then
        measure {
            // Add all notifications
            notifications.forEach { interactionService.showInAppNotification($0) }
            
            // Handle actions for all notifications
            for notification in notifications {
                interactionService.handleNotificationAction(NotificationAction.complete, for: notification)
            }
        }
    }
    
    // MARK: - State Consistency Tests
    
    func testNotificationStateConsistency() {
        // Given
        let notification = NotificationItem(
            id: "consistency-test",
            title: "Consistency Test",
            body: "Testing state consistency",
            taskId: "consistency-task",
            type: .approach,
            actions: [NotificationAction.complete]
        )
        
        // When
        interactionService.showInAppNotification(notification)
        XCTAssertTrue(interactionService.activeInAppNotifications.contains { $0.id == notification.id })
        
        // Simulate app backgrounding and foregrounding
        NotificationCenter.default.post(name: UIApplication.didEnterBackgroundNotification, object: nil)
        NotificationCenter.default.post(name: UIApplication.willEnterForegroundNotification, object: nil)
        
        // Then - State should remain consistent
        XCTAssertTrue(interactionService.activeInAppNotifications.contains { $0.id == notification.id })
        
        // When - Handle action
        interactionService.handleNotificationAction(NotificationAction.complete, for: notification)
        
        // Then - Should be removed
        XCTAssertFalse(interactionService.activeInAppNotifications.contains { $0.id == notification.id })
    }
}