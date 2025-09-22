package com.nearme.app.models

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import java.util.*

// MARK: - Notification Item Model
data class NotificationItem(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val body: String,
    val timestamp: Date = Date(),
    val taskId: String? = null,
    val type: NotificationType = NotificationType.REMINDER,
    val actions: List<NotificationAction> = emptyList(),
    val isRead: Boolean = false,
    val category: NotificationCategory = NotificationCategory.REMINDER
) {
    companion object {
        val sample = NotificationItem(
            title = "You're near the pharmacy",
            body = "Don't forget to pick up your prescription",
            taskId = "task-123",
            type = NotificationType.APPROACH,
            actions = listOf(
                NotificationAction.complete,
                NotificationAction.snooze15m,
                NotificationAction.snooze1h,
                NotificationAction.mute
            )
        )
    }
}

// MARK: - Notification Action Model
data class NotificationAction(
    val id: String = UUID.randomUUID().toString(),
    val identifier: String,
    val title: String,
    val icon: ImageVector,
    val backgroundColor: Color,
    val foregroundColor: Color
) {
    companion object {
        val complete = NotificationAction(
            identifier = "COMPLETE_ACTION",
            title = "Complete",
            icon = Icons.Default.CheckCircle,
            backgroundColor = Color(0xFF4CAF50),
            foregroundColor = Color.White
        )
        
        val snooze15m = NotificationAction(
            identifier = "SNOOZE_15M_ACTION",
            title = "15m",
            icon = Icons.Default.Schedule,
            backgroundColor = Color(0xFFFF9800),
            foregroundColor = Color.White
        )
        
        val snooze1h = NotificationAction(
            identifier = "SNOOZE_1H_ACTION",
            title = "1h",
            icon = Icons.Default.Schedule,
            backgroundColor = Color(0xFFFF9800),
            foregroundColor = Color.White
        )
        
        val snoozeToday = NotificationAction(
            identifier = "SNOOZE_TODAY_ACTION",
            title = "Today",
            icon = Icons.Default.Today,
            backgroundColor = Color(0xFFFF9800),
            foregroundColor = Color.White
        )
        
        val mute = NotificationAction(
            identifier = "MUTE_ACTION",
            title = "Mute",
            icon = Icons.Default.VolumeOff,
            backgroundColor = Color(0xFFF44336),
            foregroundColor = Color.White
        )
        
        val openMap = NotificationAction(
            identifier = "OPEN_MAP_ACTION",
            title = "Map",
            icon = Icons.Default.Map,
            backgroundColor = Color(0xFF2196F3),
            foregroundColor = Color.White
        )
    }
}

// MARK: - Notification Type
enum class NotificationType(val displayName: String, val icon: ImageVector) {
    APPROACH("Approach", Icons.Default.LocationOn),
    ARRIVAL("Arrival", Icons.Default.Place),
    POST_ARRIVAL("Post-Arrival", Icons.Default.Schedule),
    REMINDER("Reminder", Icons.Default.Notifications),
    COMPLETION("Completion", Icons.Default.CheckCircle),
    SYSTEM("System", Icons.Default.Settings)
}

// MARK: - Notification Category
enum class NotificationCategory(val displayName: String) {
    REMINDER("Reminders"),
    TASK("Tasks"),
    SYSTEM("System"),
    MARKETING("Updates")
}

// MARK: - Notification Filter
enum class NotificationFilter(val title: String, val emptyStateIcon: ImageVector, val emptyStateTitle: String, val emptyStateMessage: String) {
    ALL("All", Icons.Default.NotificationsOff, "No Notifications Yet", "When you create tasks and get location reminders, they'll appear here."),
    UNREAD("Unread", Icons.Default.NotificationsActive, "All Caught Up!", "You've read all your notifications. Great job staying organized!"),
    TODAY("Today", Icons.Default.Today, "No Notifications Today", "No notifications scheduled for today. Check back later or create a new task."),
    THIS_WEEK("This Week", Icons.Default.DateRange, "No Notifications This Week", "No notifications this week. Create some tasks to get started."),
    COMPLETED("Completed", Icons.Default.CheckCircle, "No Completed Tasks", "No tasks have been completed yet. Complete a task to see it here."),
    SNOOZED("Snoozed", Icons.Default.Schedule, "No Snoozed Tasks", "No tasks are currently snoozed. Snooze a task to see it here.")
}

// MARK: - Snooze Duration
enum class SnoozeDuration(val title: String, val timeIntervalMs: Long) {
    FIFTEEN_MINUTES("15 Minutes", 15 * 60 * 1000),
    ONE_HOUR("1 Hour", 60 * 60 * 1000),
    FOUR_HOURS("4 Hours", 4 * 60 * 60 * 1000),
    TODAY("Until Tomorrow", 24 * 60 * 60 * 1000),
    TOMORROW("Until Day After Tomorrow", 48 * 60 * 60 * 1000)
}

// MARK: - Notification Settings Model
data class NotificationSettings(
    val locationRemindersEnabled: Boolean = true,
    val taskCompletionAlerts: Boolean = true,
    val dailySummary: Boolean = false,
    val quietHoursEnabled: Boolean = false,
    val quietHoursStart: Date = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 22)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
    }.time,
    val quietHoursEnd: Date = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 8)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
    }.time,
    val defaultSnoozeDuration: SnoozeDuration = SnoozeDuration.FIFTEEN_MINUTES,
    val soundEnabled: Boolean = true,
    val vibrationEnabled: Boolean = true,
    val badgeEnabled: Boolean = true
) {
    companion object {
        val default = NotificationSettings()
    }
}
