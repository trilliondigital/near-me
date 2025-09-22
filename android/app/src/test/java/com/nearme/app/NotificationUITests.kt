package com.nearme.app

import com.nearme.app.models.*
import com.nearme.app.viewmodels.NotificationHistoryViewModel
import com.nearme.app.viewmodels.NotificationSettingsViewModel
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mock
import org.mockito.junit.MockitoJUnitRunner
import java.util.*
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@RunWith(MockitoJUnitRunner::class)
class NotificationUITests {
    
    private lateinit var notificationHistoryViewModel: NotificationHistoryViewModel
    private lateinit var notificationSettingsViewModel: NotificationSettingsViewModel
    
    @Mock
    private lateinit var mockNotificationService: com.nearme.app.viewmodels.NotificationService
    
    @Before
    fun setUp() {
        notificationHistoryViewModel = NotificationHistoryViewModel()
        notificationSettingsViewModel = NotificationSettingsViewModel()
    }
    
    // MARK: - Notification Item Tests
    
    @Test
    fun testNotificationItemCreation() {
        val notification = NotificationItem.sample
        
        assertEquals("You're near the pharmacy", notification.title)
        assertEquals("Don't forget to pick up your prescription", notification.body)
        assertEquals("task-123", notification.taskId)
        assertEquals(NotificationType.APPROACH, notification.type)
        assertFalse(notification.isRead)
        assertEquals(4, notification.actions.size)
    }
    
    @Test
    fun testNotificationActionCreation() {
        val completeAction = NotificationAction.complete
        
        assertEquals("COMPLETE_ACTION", completeAction.identifier)
        assertEquals("Complete", completeAction.title)
    }
    
    // MARK: - Notification History View Model Tests
    
    @Test
    fun testNotificationFiltering() = runTest {
        val notifications = listOf(
            NotificationItem(
                title = "Test 1",
                body = "Body 1",
                timestamp = Date(),
                isRead = false
            ),
            NotificationItem(
                title = "Test 2",
                body = "Body 2",
                timestamp = Date(Date().time - 86400000), // Yesterday
                isRead = true
            ),
            NotificationItem(
                title = "Test 3",
                body = "Body 3",
                timestamp = Date(),
                type = NotificationType.COMPLETION,
                isRead = false
            )
        )
        
        // Set notifications
        notificationHistoryViewModel.notifications.value = notifications
        
        // Test all filter
        notificationHistoryViewModel.selectedFilter.value = NotificationFilter.ALL
        assertEquals(3, notificationHistoryViewModel.filteredNotifications.value.size)
        
        // Test unread filter
        notificationHistoryViewModel.selectedFilter.value = NotificationFilter.UNREAD
        assertEquals(2, notificationHistoryViewModel.filteredNotifications.value.size)
        
        // Test completed filter
        notificationHistoryViewModel.selectedFilter.value = NotificationFilter.COMPLETED
        assertEquals(1, notificationHistoryViewModel.filteredNotifications.value.size)
    }
    
    @Test
    fun testNotificationActionHandling() = runTest {
        val notification = NotificationItem.sample
        notificationHistoryViewModel.notifications.value = listOf(notification)
        
        // Test complete action
        notificationHistoryViewModel.handleAction(NotificationAction.complete, notification)
        
        // Notification should be removed from list
        assertTrue(notificationHistoryViewModel.notifications.value.isEmpty())
    }
    
    @Test
    fun testMarkAllAsRead() = runTest {
        val notifications = listOf(
            NotificationItem(title = "Test 1", body = "Body 1", isRead = false),
            NotificationItem(title = "Test 2", body = "Body 2", isRead = false),
            NotificationItem(title = "Test 3", body = "Body 3", isRead = true)
        )
        
        notificationHistoryViewModel.notifications.value = notifications
        notificationHistoryViewModel.markAllAsRead()
        
        // All notifications should be marked as read
        assertTrue(notificationHistoryViewModel.notifications.value.all { it.isRead })
    }
    
    @Test
    fun testDeleteNotification() = runTest {
        val notification = NotificationItem.sample
        notificationHistoryViewModel.notifications.value = listOf(notification)
        
        notificationHistoryViewModel.deleteNotification(notification)
        
        // Notification should be removed from list
        assertTrue(notificationHistoryViewModel.notifications.value.isEmpty())
    }
    
    // MARK: - Notification Settings View Model Tests
    
    @Test
    fun testNotificationSettingsLoading() {
        val settings = notificationSettingsViewModel.settings.value
        
        // Test default values
        assertTrue(settings.locationRemindersEnabled)
        assertTrue(settings.taskCompletionAlerts)
        assertFalse(settings.dailySummary)
        assertFalse(settings.quietHoursEnabled)
        assertEquals(SnoozeDuration.FIFTEEN_MINUTES, settings.defaultSnoozeDuration)
    }
    
    @Test
    fun testNotificationSettingsUpdates() = runTest {
        // Test location reminders update
        notificationSettingsViewModel.updateLocationRemindersEnabled(false)
        assertFalse(notificationSettingsViewModel.settings.value.locationRemindersEnabled)
        
        // Test task completion alerts update
        notificationSettingsViewModel.updateTaskCompletionAlerts(false)
        assertFalse(notificationSettingsViewModel.settings.value.taskCompletionAlerts)
        
        // Test daily summary update
        notificationSettingsViewModel.updateDailySummary(true)
        assertTrue(notificationSettingsViewModel.settings.value.dailySummary)
        
        // Test quiet hours update
        notificationSettingsViewModel.updateQuietHoursEnabled(true)
        assertTrue(notificationSettingsViewModel.settings.value.quietHoursEnabled)
        
        // Test snooze duration update
        notificationSettingsViewModel.updateDefaultSnoozeDuration(SnoozeDuration.ONE_HOUR)
        assertEquals(SnoozeDuration.ONE_HOUR, notificationSettingsViewModel.settings.value.defaultSnoozeDuration)
    }
    
    @Test
    fun testResetToDefaults() = runTest {
        // Modify settings
        notificationSettingsViewModel.updateLocationRemindersEnabled(false)
        notificationSettingsViewModel.updateTaskCompletionAlerts(false)
        notificationSettingsViewModel.updateDailySummary(true)
        notificationSettingsViewModel.updateQuietHoursEnabled(true)
        notificationSettingsViewModel.updateDefaultSnoozeDuration(SnoozeDuration.ONE_HOUR)
        
        // Reset to defaults
        notificationSettingsViewModel.resetToDefaults()
        
        // Verify settings were reset
        val settings = notificationSettingsViewModel.settings.value
        assertTrue(settings.locationRemindersEnabled)
        assertTrue(settings.taskCompletionAlerts)
        assertFalse(settings.dailySummary)
        assertFalse(settings.quietHoursEnabled)
        assertEquals(SnoozeDuration.FIFTEEN_MINUTES, settings.defaultSnoozeDuration)
    }
    
    // MARK: - Notification Filter Tests
    
    @Test
    fun testNotificationFilterProperties() {
        assertEquals("All", NotificationFilter.ALL.title)
        assertEquals("Unread", NotificationFilter.UNREAD.title)
        assertEquals("Today", NotificationFilter.TODAY.title)
        assertEquals("This Week", NotificationFilter.THIS_WEEK.title)
        assertEquals("Completed", NotificationFilter.COMPLETED.title)
        assertEquals("Snoozed", NotificationFilter.SNOOZED.title)
    }
    
    @Test
    fun testNotificationFilterEmptyStates() {
        assertEquals("No Notifications Yet", NotificationFilter.ALL.emptyStateTitle)
        assertEquals("All Caught Up!", NotificationFilter.UNREAD.emptyStateTitle)
        assertEquals("No Notifications Today", NotificationFilter.TODAY.emptyStateTitle)
        assertEquals("No Notifications This Week", NotificationFilter.THIS_WEEK.emptyStateTitle)
        assertEquals("No Completed Tasks", NotificationFilter.COMPLETED.emptyStateTitle)
        assertEquals("No Snoozed Tasks", NotificationFilter.SNOOZED.emptyStateTitle)
    }
    
    // MARK: - Snooze Duration Tests
    
    @Test
    fun testSnoozeDurationProperties() {
        assertEquals("15 Minutes", SnoozeDuration.FIFTEEN_MINUTES.title)
        assertEquals("1 Hour", SnoozeDuration.ONE_HOUR.title)
        assertEquals("4 Hours", SnoozeDuration.FOUR_HOURS.title)
        assertEquals("Until Tomorrow", SnoozeDuration.TODAY.title)
        assertEquals("Until Day After Tomorrow", SnoozeDuration.TOMORROW.title)
    }
    
    @Test
    fun testSnoozeDurationTimeIntervals() {
        assertEquals(15 * 60 * 1000L, SnoozeDuration.FIFTEEN_MINUTES.timeIntervalMs)
        assertEquals(60 * 60 * 1000L, SnoozeDuration.ONE_HOUR.timeIntervalMs)
        assertEquals(4 * 60 * 60 * 1000L, SnoozeDuration.FOUR_HOURS.timeIntervalMs)
        assertEquals(24 * 60 * 60 * 1000L, SnoozeDuration.TODAY.timeIntervalMs)
        assertEquals(48 * 60 * 60 * 1000L, SnoozeDuration.TOMORROW.timeIntervalMs)
    }
    
    // MARK: - Notification Type Tests
    
    @Test
    fun testNotificationTypeProperties() {
        assertEquals("Approach", NotificationType.APPROACH.displayName)
        assertEquals("Arrival", NotificationType.ARRIVAL.displayName)
        assertEquals("Post-Arrival", NotificationType.POST_ARRIVAL.displayName)
        assertEquals("Reminder", NotificationType.REMINDER.displayName)
        assertEquals("Completion", NotificationType.COMPLETION.displayName)
        assertEquals("System", NotificationType.SYSTEM.displayName)
    }
    
    // MARK: - Notification Category Tests
    
    @Test
    fun testNotificationCategoryProperties() {
        assertEquals("Reminders", NotificationCategory.REMINDER.displayName)
        assertEquals("Tasks", NotificationCategory.TASK.displayName)
        assertEquals("System", NotificationCategory.SYSTEM.displayName)
        assertEquals("Updates", NotificationCategory.MARKETING.displayName)
    }
    
    // MARK: - Integration Tests
    
    @Test
    fun testNotificationFlowIntegration() = runTest {
        // Test the complete flow from notification creation to action handling
        val notification = NotificationItem.sample
        notificationHistoryViewModel.notifications.value = listOf(notification)
        
        // Verify notification is in the list
        assertEquals(1, notificationHistoryViewModel.notifications.value.size)
        
        // Handle complete action
        notificationHistoryViewModel.handleAction(NotificationAction.complete, notification)
        
        // Verify notification is removed
        assertTrue(notificationHistoryViewModel.notifications.value.isEmpty())
    }
    
    @Test
    fun testSettingsFlowIntegration() = runTest {
        // Test the complete settings flow
        val initialSettings = notificationSettingsViewModel.settings.value
        
        // Modify multiple settings
        notificationSettingsViewModel.updateLocationRemindersEnabled(false)
        notificationSettingsViewModel.updateDailySummary(true)
        notificationSettingsViewModel.updateDefaultSnoozeDuration(SnoozeDuration.ONE_HOUR)
        
        val updatedSettings = notificationSettingsViewModel.settings.value
        
        // Verify changes
        assertFalse(updatedSettings.locationRemindersEnabled)
        assertTrue(updatedSettings.dailySummary)
        assertEquals(SnoozeDuration.ONE_HOUR, updatedSettings.defaultSnoozeDuration)
        
        // Reset to defaults
        notificationSettingsViewModel.resetToDefaults()
        
        val resetSettings = notificationSettingsViewModel.settings.value
        
        // Verify reset
        assertTrue(resetSettings.locationRemindersEnabled)
        assertFalse(resetSettings.dailySummary)
        assertEquals(SnoozeDuration.FIFTEEN_MINUTES, resetSettings.defaultSnoozeDuration)
    }
}
