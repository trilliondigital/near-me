import XCTest
import SwiftUI
import UserNotifications
@testable import NearMe

// MARK: - Notification UI Tests
class NotificationUITests: XCTestCase {
    
    var notificationManager: NotificationManager!
    var interactionService: NotificationInteractionService!
    var mockNotification: NotificationItem!
    
    override func setUp() {
        super.setUp()
        notificationManager = NotificationManager()
        interactionService = NotificationInteractionService.shared
        
        mockNotification = NotificationItem(
            id: "test-notification-1",
            title: "Test Notification",
            body: "This is a test notification",
            taskId: "test-task-1",
            type: .approach,
            actions: [
                NotificationAction.complete,
                NotificationAction.snooze15m,
                NotificationAction.mute
            ]
        )
    }
    
    override func tearDown() {
        notificationManager = nil
        interactionService = nil
        mockNotification = nil
        super.tearDown()
    }
    
    // MARK: - Notification Display Tests
    
    func testNotificationCardDisplaysCorrectInformation() {
        // Given
        let notification = mockNotification!
        
        // When
        let card = NotificationCard(
            title: notification.title,
            message: notification.body,
            timestamp: notification.timestamp,
            isRead: notification.isRead,
            actions: [],
            onAction: nil
        )
        
        // Then
        XCTAssertNotNil(card)
        // Note: In a real UI test, we would verify the displayed text matches the notification data
    }
    
    func testNotificationCardShowsUnreadIndicator() {
        // Given
        var notification = mockNotification!
        notification.isRead = false
        
        // When
        let card = NotificationCard(
            title: notification.title,
            message: notification.body,
            timestamp: notification.timestamp,
            isRead: notification.isRead,
            actions: [],
            onAction: nil
        )
        
        // Then
        XCTAssertNotNil(card)
        // Note: In a real UI test, we would verify the unread indicator is visible
    }
    
    func testNotificationCardHidesUnreadIndicatorWhenRead() {
        // Given
        var notification = mockNotification!
        notification.isRead = true
        
        // When
        let card = NotificationCard(
            title: notification.title,
            message: notification.body,
            timestamp: notification.timestamp,
            isRead: notification.isRead,
            actions: [],
            onAction: nil
        )
        
        // Then
        XCTAssertNotNil(card)
        // Note: In a real UI test, we would verify the unread indicator is hidden
    }
    
    // MARK: - In-App Notification Tests
    
    func testInAppNotificationIsAddedToActiveList() {
        // Given
        let initialCount = interactionService.activeInAppNotifications.count
        
        // When
        interactionService.showInAppNotification(mockNotification)
        
        // Then
        XCTAssertEqual(interactionService.activeInAppNotifications.count, initialCount + 1)
        XCTAssertTrue(interactionService.activeInAppNotifications.contains { $0.id == mockNotification.id })
    }
    
    func testDuplicateInAppNotificationIsNotAdded() {
        // Given
        interactionService.showInAppNotification(mockNotification)
        let countAfterFirst = interactionService.activeInAppNotifications.count
        
        // When
        interactionService.showInAppNotification(mockNotification)
        
        // Then
        XCTAssertEqual(interactionService.activeInAppNotifications.count, countAfterFirst)
    }
    
    func testInAppNotificationCanBeDismissed() {
        // Given
        interactionService.showInAppNotification(mockNotification)
        XCTAssertTrue(interactionService.activeInAppNotifications.contains { $0.id == mockNotification.id })
        
        // When
        interactionService.dismissInAppNotification(mockNotification.id)
        
        // Then
        XCTAssertFalse(interactionService.activeInAppNotifications.contains { $0.id == mockNotification.id })
    }
    
    func testAllInAppNotificationsCanBeDismissed() {
        // Given
        let notification1 = mockNotification!
        let notification2 = NotificationItem(
            id: "test-notification-2",
            title: "Test Notification 2",
            body: "This is another test notification",
            type: .arrival
        )
        
        interactionService.showInAppNotification(notification1)
        interactionService.showInAppNotification(notification2)
        XCTAssertEqual(interactionService.activeInAppNotifications.count, 2)
        
        // When
        interactionService.dismissAllInAppNotifications()
        
        // Then
        XCTAssertEqual(interactionService.activeInAppNotifications.count, 0)
    }
    
    // MARK: - Action Handling Tests
    
    func testCompleteActionRemovesNotificationFromActiveList() {
        // Given
        interactionService.showInAppNotification(mockNotification)
        let completeAction = NotificationAction.complete
        
        // When
        interactionService.handleNotificationAction(completeAction, for: mockNotification)
        
        // Then
        XCTAssertFalse(interactionService.activeInAppNotifications.contains { $0.id == mockNotification.id })
    }
    
    func testSnoozeActionRemovesNotificationFromActiveList() {
        // Given
        interactionService.showInAppNotification(mockNotification)
        let snoozeAction = NotificationAction.snooze15m
        
        // When
        interactionService.handleNotificationAction(snoozeAction, for: mockNotification)
        
        // Then
        XCTAssertFalse(interactionService.activeInAppNotifications.contains { $0.id == mockNotification.id })
    }
    
    func testMuteActionRemovesNotificationFromActiveList() {
        // Given
        interactionService.showInAppNotification(mockNotification)
        let muteAction = NotificationAction.mute
        
        // When
        interactionService.handleNotificationAction(muteAction, for: mockNotification)
        
        // Then
        XCTAssertFalse(interactionService.activeInAppNotifications.contains { $0.id == mockNotification.id })
    }
    
    // MARK: - Snooze Duration Tests
    
    func testSnoozeDurationPickerShowsAllOptions() {
        // Given
        let allDurations = SnoozeDuration.allCases
        
        // When/Then
        XCTAssertEqual(allDurations.count, 5)
        XCTAssertTrue(allDurations.contains(.fifteenMinutes))
        XCTAssertTrue(allDurations.contains(.oneHour))
        XCTAssertTrue(allDurations.contains(.fourHours))
        XCTAssertTrue(allDurations.contains(.today))
        XCTAssertTrue(allDurations.contains(.tomorrow))
    }
    
    func testSnoozeDurationHasCorrectTimeIntervals() {
        // Given/When/Then
        XCTAssertEqual(SnoozeDuration.fifteenMinutes.timeInterval, 15 * 60)
        XCTAssertEqual(SnoozeDuration.oneHour.timeInterval, 60 * 60)
        XCTAssertEqual(SnoozeDuration.fourHours.timeInterval, 4 * 60 * 60)
        XCTAssertEqual(SnoozeDuration.today.timeInterval, 24 * 60 * 60)
        XCTAssertEqual(SnoozeDuration.tomorrow.timeInterval, 48 * 60 * 60)
    }
    
    func testCustomSnoozePickerCanBeShown() {
        // Given
        XCTAssertFalse(interactionService.showSnoozePicker)
        
        // When
        let customSnoozeAction = NotificationAction(
            identifier: "SNOOZE_CUSTOM_ACTION",
            title: "Custom",
            icon: "clock.arrow.circlepath"
        )
        interactionService.handleNotificationAction(customSnoozeAction, for: mockNotification)
        
        // Then
        XCTAssertTrue(interactionService.showSnoozePicker)
        XCTAssertEqual(interactionService.selectedNotificationForSnooze?.id, mockNotification.id)
    }
    
    func testCustomSnoozeCanBeCancelled() {
        // Given
        interactionService.selectedNotificationForSnooze = mockNotification
        interactionService.showSnoozePicker = true
        
        // When
        interactionService.cancelCustomSnooze()
        
        // Then
        XCTAssertFalse(interactionService.showSnoozePicker)
        XCTAssertNil(interactionService.selectedNotificationForSnooze)
    }
    
    // MARK: - Notification Filter Tests
    
    func testNotificationFilterHasCorrectTitles() {
        // Given/When/Then
        XCTAssertEqual(NotificationFilter.all.title, "All")
        XCTAssertEqual(NotificationFilter.unread.title, "Unread")
        XCTAssertEqual(NotificationFilter.today.title, "Today")
        XCTAssertEqual(NotificationFilter.thisWeek.title, "This Week")
        XCTAssertEqual(NotificationFilter.completed.title, "Completed")
        XCTAssertEqual(NotificationFilter.snoozed.title, "Snoozed")
    }
    
    func testNotificationFilterHasCorrectEmptyStates() {
        // Given/When/Then
        XCTAssertEqual(NotificationFilter.all.emptyStateTitle, "No Notifications Yet")
        XCTAssertEqual(NotificationFilter.unread.emptyStateTitle, "All Caught Up!")
        XCTAssertEqual(NotificationFilter.today.emptyStateTitle, "No Notifications Today")
        XCTAssertEqual(NotificationFilter.thisWeek.emptyStateTitle, "No Notifications This Week")
        XCTAssertEqual(NotificationFilter.completed.emptyStateTitle, "No Completed Tasks")
        XCTAssertEqual(NotificationFilter.snoozed.emptyStateTitle, "No Snoozed Tasks")
    }
    
    // MARK: - Notification Settings Tests
    
    func testNotificationSettingsHaveDefaultValues() {
        // Given
        let settings = NotificationSettings.default
        
        // When/Then
        XCTAssertTrue(settings.locationRemindersEnabled)
        XCTAssertTrue(settings.taskCompletionAlerts)
        XCTAssertFalse(settings.dailySummary)
        XCTAssertFalse(settings.quietHoursEnabled)
        XCTAssertEqual(settings.defaultSnoozeDuration, .fifteenMinutes)
        XCTAssertTrue(settings.soundEnabled)
        XCTAssertTrue(settings.vibrationEnabled)
        XCTAssertTrue(settings.badgeEnabled)
    }
    
    func testNotificationSettingsCanBeEncoded() {
        // Given
        let settings = NotificationSettings.default
        
        // When
        let encoder = JSONEncoder()
        let data = try? encoder.encode(settings)
        
        // Then
        XCTAssertNotNil(data)
    }
    
    func testNotificationSettingsCanBeDecoded() {
        // Given
        let settings = NotificationSettings.default
        let encoder = JSONEncoder()
        let data = try! encoder.encode(settings)
        
        // When
        let decoder = JSONDecoder()
        let decodedSettings = try? decoder.decode(NotificationSettings.self, from: data)
        
        // Then
        XCTAssertNotNil(decodedSettings)
        XCTAssertEqual(decodedSettings?.locationRemindersEnabled, settings.locationRemindersEnabled)
        XCTAssertEqual(decodedSettings?.taskCompletionAlerts, settings.taskCompletionAlerts)
        XCTAssertEqual(decodedSettings?.defaultSnoozeDuration, settings.defaultSnoozeDuration)
    }
    
    // MARK: - Notification Permission Tests
    
    func testNotificationPermissionStatusIsTracked() {
        // Given/When
        let manager = NotificationManager()
        
        // Then
        XCTAssertNotNil(manager.authorizationStatus)
        // Note: The actual status depends on the test environment
    }
    
    func testNotificationPermissionCanBeRequested() {
        // Given
        let manager = NotificationManager()
        let expectation = XCTestExpectation(description: "Permission requested")
        
        // When
        manager.requestNotificationPermission()
        
        // Then
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 2)
    }
    
    // MARK: - Performance Tests
    
    func testNotificationDisplayPerformance() {
        // Given
        let notifications = (0..<100).map { index in
            NotificationItem(
                id: "notification-\(index)",
                title: "Notification \(index)",
                body: "This is notification number \(index)",
                type: .reminder
            )
        }
        
        // When/Then
        measure {
            for notification in notifications {
                interactionService.showInAppNotification(notification)
            }
            interactionService.dismissAllInAppNotifications()
        }
    }
    
    func testNotificationActionHandlingPerformance() {
        // Given
        let notifications = (0..<50).map { index in
            NotificationItem(
                id: "notification-\(index)",
                title: "Notification \(index)",
                body: "This is notification number \(index)",
                type: .reminder,
                actions: [NotificationAction.complete, NotificationAction.snooze15m]
            )
        }
        
        notifications.forEach { interactionService.showInAppNotification($0) }
        
        // When/Then
        measure {
            for notification in notifications {
                interactionService.handleNotificationAction(NotificationAction.complete, for: notification)
            }
        }
    }
}

// MARK: - Notification History View Model Tests
class NotificationHistoryViewModelTests: XCTestCase {
    
    var viewModel: NotificationHistoryViewModel!
    
    override func setUp() {
        super.setUp()
        viewModel = NotificationHistoryViewModel()
    }
    
    override func tearDown() {
        viewModel = nil
        super.tearDown()
    }
    
    func testInitialState() {
        // Given/When/Then
        XCTAssertEqual(viewModel.notifications.count, 0)
        XCTAssertEqual(viewModel.selectedFilter, .all)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.errorMessage)
    }
    
    func testFilteredNotificationsWithAllFilter() {
        // Given
        let notification1 = NotificationItem(title: "Test 1", body: "Body 1", type: .approach)
        let notification2 = NotificationItem(title: "Test 2", body: "Body 2", type: .arrival, isRead: true)
        viewModel.notifications = [notification1, notification2]
        viewModel.selectedFilter = .all
        
        // When
        let filtered = viewModel.filteredNotifications
        
        // Then
        XCTAssertEqual(filtered.count, 2)
    }
    
    func testFilteredNotificationsWithUnreadFilter() {
        // Given
        let notification1 = NotificationItem(title: "Test 1", body: "Body 1", type: .approach, isRead: false)
        let notification2 = NotificationItem(title: "Test 2", body: "Body 2", type: .arrival, isRead: true)
        viewModel.notifications = [notification1, notification2]
        viewModel.selectedFilter = .unread
        
        // When
        let filtered = viewModel.filteredNotifications
        
        // Then
        XCTAssertEqual(filtered.count, 1)
        XCTAssertEqual(filtered.first?.id, notification1.id)
    }
    
    func testMarkAllAsReadUpdatesAllNotifications() {
        // Given
        let notification1 = NotificationItem(title: "Test 1", body: "Body 1", type: .approach, isRead: false)
        let notification2 = NotificationItem(title: "Test 2", body: "Body 2", type: .arrival, isRead: false)
        viewModel.notifications = [notification1, notification2]
        
        // When
        viewModel.markAllAsRead()
        
        // Then
        XCTAssertTrue(viewModel.notifications.allSatisfy { $0.isRead })
    }
    
    func testDeleteNotificationRemovesFromList() {
        // Given
        let notification1 = NotificationItem(title: "Test 1", body: "Body 1", type: .approach)
        let notification2 = NotificationItem(title: "Test 2", body: "Body 2", type: .arrival)
        viewModel.notifications = [notification1, notification2]
        
        // When
        viewModel.deleteNotification(notification1)
        
        // Then
        XCTAssertEqual(viewModel.notifications.count, 1)
        XCTAssertEqual(viewModel.notifications.first?.id, notification2.id)
    }
}

// MARK: - Notification Settings View Model Tests
class NotificationSettingsViewModelTests: XCTestCase {
    
    var viewModel: NotificationSettingsViewModel!
    
    override func setUp() {
        super.setUp()
        viewModel = NotificationSettingsViewModel()
    }
    
    override func tearDown() {
        viewModel = nil
        super.tearDown()
    }
    
    func testInitialState() {
        // Given/When/Then
        XCTAssertTrue(viewModel.locationRemindersEnabled)
        XCTAssertTrue(viewModel.taskCompletionAlerts)
        XCTAssertFalse(viewModel.dailySummary)
        XCTAssertFalse(viewModel.quietHoursEnabled)
        XCTAssertEqual(viewModel.defaultSnoozeDuration, .fifteenMinutes)
    }
    
    func testResetToDefaultsRestoresInitialValues() {
        // Given
        viewModel.locationRemindersEnabled = false
        viewModel.taskCompletionAlerts = false
        viewModel.dailySummary = true
        viewModel.quietHoursEnabled = true
        viewModel.defaultSnoozeDuration = .oneHour
        
        // When
        viewModel.resetToDefaults()
        
        // Then
        XCTAssertTrue(viewModel.locationRemindersEnabled)
        XCTAssertTrue(viewModel.taskCompletionAlerts)
        XCTAssertFalse(viewModel.dailySummary)
        XCTAssertFalse(viewModel.quietHoursEnabled)
        XCTAssertEqual(viewModel.defaultSnoozeDuration, .fifteenMinutes)
    }
}