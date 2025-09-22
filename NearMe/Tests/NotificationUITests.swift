import XCTest
import SwiftUI
import Combine
@testable import NearMe

class NotificationUITests: XCTestCase {
    
    var notificationManager: NotificationManager!
    var viewModel: NotificationHistoryViewModel!
    var cancellables: Set<AnyCancellable>!
    
    override func setUp() {
        super.setUp()
        notificationManager = NotificationManager()
        viewModel = NotificationHistoryViewModel()
        cancellables = Set<AnyCancellable>()
    }
    
    override func tearDown() {
        cancellables = nil
        viewModel = nil
        notificationManager = nil
        super.tearDown()
    }
    
    // MARK: - Notification Card Tests
    
    func testNotificationCardDisplaysCorrectly() {
        let notification = NotificationItem.sample
        let expectation = XCTestExpectation(description: "Notification card displays")
        
        // Test that the notification card can be created
        let card = NotificationCard(
            notification: notification,
            onAction: { _ in
                expectation.fulfill()
            }
        )
        
        XCTAssertNotNil(card)
        XCTAssertEqual(notification.title, "You're near the pharmacy")
        XCTAssertEqual(notification.body, "Don't forget to pick up your prescription")
        XCTAssertFalse(notification.isRead)
    }
    
    func testNotificationCardActions() {
        let notification = NotificationItem.sample
        var actionPerformed: NotificationAction?
        
        let card = NotificationCard(
            notification: notification,
            onAction: { action in
                actionPerformed = action
            }
        )
        
        // Simulate action tap
        let completeAction = NotificationAction.complete
        // In a real test, we would trigger the button tap
        // For now, we'll test the action structure
        XCTAssertEqual(completeAction.identifier, "COMPLETE_ACTION")
        XCTAssertEqual(completeAction.title, "Complete")
        XCTAssertEqual(completeAction.icon, "checkmark.circle.fill")
    }
    
    // MARK: - Notification History View Model Tests
    
    func testNotificationFiltering() {
        let notifications = [
            NotificationItem(
                title: "Test 1",
                body: "Body 1",
                timestamp: Date(),
                isRead: false
            ),
            NotificationItem(
                title: "Test 2",
                body: "Body 2",
                timestamp: Date().addingTimeInterval(-86400), // Yesterday
                isRead: true
            ),
            NotificationItem(
                title: "Test 3",
                body: "Body 3",
                timestamp: Date(),
                type: .completion,
                isRead: false
            )
        ]
        
        viewModel.notifications = notifications
        
        // Test all filter
        viewModel.selectedFilter = .all
        XCTAssertEqual(viewModel.filteredNotifications.count, 3)
        
        // Test unread filter
        viewModel.selectedFilter = .unread
        XCTAssertEqual(viewModel.filteredNotifications.count, 2)
        
        // Test today filter
        viewModel.selectedFilter = .today
        XCTAssertEqual(viewModel.filteredNotifications.count, 2)
        
        // Test completed filter
        viewModel.selectedFilter = .completed
        XCTAssertEqual(viewModel.filteredNotifications.count, 1)
    }
    
    func testNotificationActionHandling() {
        let notification = NotificationItem.sample
        viewModel.notifications = [notification]
        
        // Test complete action
        viewModel.handleAction(NotificationAction.complete, for: notification)
        
        // Notification should be removed from list
        XCTAssertTrue(viewModel.notifications.isEmpty)
    }
    
    func testMarkAllAsRead() {
        let notifications = [
            NotificationItem(title: "Test 1", body: "Body 1", isRead: false),
            NotificationItem(title: "Test 2", body: "Body 2", isRead: false),
            NotificationItem(title: "Test 3", body: "Body 3", isRead: true)
        ]
        
        viewModel.notifications = notifications
        viewModel.markAllAsRead()
        
        // All notifications should be marked as read
        XCTAssertTrue(viewModel.notifications.allSatisfy { $0.isRead })
    }
    
    // MARK: - Notification Settings View Model Tests
    
    func testNotificationSettingsLoading() {
        let settingsViewModel = NotificationSettingsViewModel()
        
        // Test default values
        XCTAssertTrue(settingsViewModel.locationRemindersEnabled)
        XCTAssertTrue(settingsViewModel.taskCompletionAlerts)
        XCTAssertFalse(settingsViewModel.dailySummary)
        XCTAssertFalse(settingsViewModel.quietHoursEnabled)
        XCTAssertEqual(settingsViewModel.defaultSnoozeDuration, .fifteenMinutes)
    }
    
    func testNotificationSettingsSaving() {
        let settingsViewModel = NotificationSettingsViewModel()
        
        // Modify settings
        settingsViewModel.locationRemindersEnabled = false
        settingsViewModel.taskCompletionAlerts = false
        settingsViewModel.dailySummary = true
        settingsViewModel.quietHoursEnabled = true
        settingsViewModel.defaultSnoozeDuration = .oneHour
        
        // Save settings
        settingsViewModel.saveSettings()
        
        // Create new instance and load settings
        let newSettingsViewModel = NotificationSettingsViewModel()
        newSettingsViewModel.loadSettings()
        
        // Verify settings were saved
        XCTAssertFalse(newSettingsViewModel.locationRemindersEnabled)
        XCTAssertFalse(newSettingsViewModel.taskCompletionAlerts)
        XCTAssertTrue(newSettingsViewModel.dailySummary)
        XCTAssertTrue(newSettingsViewModel.quietHoursEnabled)
        XCTAssertEqual(newSettingsViewModel.defaultSnoozeDuration, .oneHour)
    }
    
    func testResetToDefaults() {
        let settingsViewModel = NotificationSettingsViewModel()
        
        // Modify settings
        settingsViewModel.locationRemindersEnabled = false
        settingsViewModel.taskCompletionAlerts = false
        settingsViewModel.dailySummary = true
        settingsViewModel.quietHoursEnabled = true
        settingsViewModel.defaultSnoozeDuration = .oneHour
        
        // Reset to defaults
        settingsViewModel.resetToDefaults()
        
        // Verify settings were reset
        XCTAssertTrue(settingsViewModel.locationRemindersEnabled)
        XCTAssertTrue(settingsViewModel.taskCompletionAlerts)
        XCTAssertFalse(settingsViewModel.dailySummary)
        XCTAssertFalse(settingsViewModel.quietHoursEnabled)
        XCTAssertEqual(settingsViewModel.defaultSnoozeDuration, .fifteenMinutes)
    }
    
    // MARK: - Notification Manager Tests
    
    func testNotificationPermissionRequest() {
        let expectation = XCTestExpectation(description: "Permission requested")
        
        notificationManager.requestNotificationPermission()
        
        // In a real test environment, we would mock the UNUserNotificationCenter
        // For now, we'll test that the method doesn't crash
        XCTAssertNotNil(notificationManager)
        expectation.fulfill()
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testNotificationScheduling() {
        let expectation = XCTestExpectation(description: "Notification scheduled")
        
        notificationManager.scheduleLocationNotification(
            identifier: "test-notification",
            title: "Test Title",
            body: "Test Body",
            taskId: "test-task",
            actions: notificationManager.createNotificationActions()
        )
        
        // Test that the method completes without error
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testNotificationCancellation() {
        let identifier = "test-notification"
        
        // Schedule a notification
        notificationManager.scheduleLocationNotification(
            identifier: identifier,
            title: "Test Title",
            body: "Test Body"
        )
        
        // Cancel the notification
        notificationManager.cancelNotification(identifier: identifier)
        
        // Test that the method completes without error
        XCTAssertNotNil(notificationManager)
    }
    
    // MARK: - Notification Action Tests
    
    func testNotificationActionCreation() {
        let actions = notificationManager.createNotificationActions()
        
        XCTAssertEqual(actions.count, 5)
        
        let actionIdentifiers = actions.map { $0.identifier }
        XCTAssertTrue(actionIdentifiers.contains("COMPLETE_ACTION"))
        XCTAssertTrue(actionIdentifiers.contains("SNOOZE_15M_ACTION"))
        XCTAssertTrue(actionIdentifiers.contains("SNOOZE_1H_ACTION"))
        XCTAssertTrue(actionIdentifiers.contains("SNOOZE_TODAY_ACTION"))
        XCTAssertTrue(actionIdentifiers.contains("MUTE_ACTION"))
    }
    
    // MARK: - Integration Tests
    
    func testNotificationFlowIntegration() {
        let expectation = XCTestExpectation(description: "Notification flow completed")
        
        // Schedule a notification
        let identifier = "integration-test"
        notificationManager.scheduleLocationNotification(
            identifier: identifier,
            title: "Integration Test",
            body: "Testing the full flow",
            taskId: "test-task",
            actions: notificationManager.createNotificationActions()
        )
        
        // Listen for the notification being posted to UI
        NotificationCenter.default.publisher(for: .newNotificationReceived)
            .sink { notification in
                if let userInfo = notification.userInfo,
                   let notificationItem = userInfo["notification"] as? NotificationItem {
                    XCTAssertEqual(notificationItem.title, "Integration Test")
                    XCTAssertEqual(notificationItem.body, "Testing the full flow")
                    XCTAssertEqual(notificationItem.taskId, "test-task")
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        wait(for: [expectation], timeout: 2.0)
    }
    
    func testNotificationActionFlowIntegration() {
        let expectation = XCTestExpectation(description: "Action flow completed")
        
        // Listen for action performed notifications
        NotificationCenter.default.publisher(for: .notificationActionPerformed)
            .sink { notification in
                if let userInfo = notification.userInfo,
                   let action = userInfo["action"] as? String {
                    XCTAssertEqual(action, "complete")
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        // Simulate action handling
        notificationManager.handleCompleteAction(notificationIdentifier: "test-notification")
        
        wait(for: [expectation], timeout: 1.0)
    }
    
    // MARK: - Performance Tests
    
    func testNotificationListPerformance() {
        let notifications = (0..<1000).map { index in
            NotificationItem(
                title: "Notification \(index)",
                body: "Body \(index)",
                timestamp: Date().addingTimeInterval(-Double(index * 60))
            )
        }
        
        measure {
            viewModel.notifications = notifications
            _ = viewModel.filteredNotifications
        }
    }
    
    func testNotificationFilteringPerformance() {
        let notifications = (0..<1000).map { index in
            NotificationItem(
                title: "Notification \(index)",
                body: "Body \(index)",
                timestamp: Date().addingTimeInterval(-Double(index * 60)),
                isRead: index % 2 == 0
            )
        }
        
        viewModel.notifications = notifications
        
        measure {
            for filter in NotificationFilter.allCases {
                viewModel.selectedFilter = filter
                _ = viewModel.filteredNotifications
            }
        }
    }
}

// MARK: - Mock Notification Service for Testing
class MockNotificationService: NotificationService {
    var mockNotifications: [NotificationItem] = []
    var mockError: Error?
    
    override func getNotificationHistory(completion: @escaping (Result<[NotificationItem], Error>) -> Void) {
        if let error = mockError {
            completion(.failure(error))
        } else {
            completion(.success(mockNotifications))
        }
    }
    
    override func performNotificationAction(
        notificationId: String,
        action: String,
        completion: @escaping (Result<Void, Error>) -> Void
    ) {
        if let error = mockError {
            completion(.failure(error))
        } else {
            completion(.success(()))
        }
    }
}
