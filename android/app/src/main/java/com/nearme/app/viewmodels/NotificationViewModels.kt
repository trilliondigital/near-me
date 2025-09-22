package com.nearme.app.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.nearme.app.models.*
import com.nearme.app.services.NotificationService
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.*

// MARK: - Notification History View Model
class NotificationHistoryViewModel : ViewModel() {
    private val _notifications = MutableStateFlow<List<NotificationItem>>(emptyList())
    val notifications: StateFlow<List<NotificationItem>> = _notifications.asStateFlow()
    
    private val _selectedFilter = MutableStateFlow(NotificationFilter.ALL)
    val selectedFilter: StateFlow<NotificationFilter> = _selectedFilter.asStateFlow()
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()
    
    val filteredNotifications: StateFlow<List<NotificationItem>> = combine(
        _notifications,
        _selectedFilter
    ) { notifications, filter ->
        notifications.filter { notification ->
            when (filter) {
                NotificationFilter.ALL -> true
                NotificationFilter.UNREAD -> !notification.isRead
                NotificationFilter.TODAY -> isToday(notification.timestamp)
                NotificationFilter.THIS_WEEK -> isThisWeek(notification.timestamp)
                NotificationFilter.COMPLETED -> notification.type == NotificationType.COMPLETION
                NotificationFilter.SNOOZED -> notification.actions.any { it.identifier.contains("SNOOZE") }
            }
        }.sortedByDescending { it.timestamp }
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )
    
    private val notificationService = NotificationService()
    
    init {
        loadNotifications()
    }
    
    fun loadNotifications() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            
            try {
                val notifications = notificationService.getNotificationHistory()
                _notifications.value = notifications
            } catch (e: Exception) {
                _errorMessage.value = e.message
                loadSampleNotifications() // Fallback to sample data
            } finally {
                _isLoading.value = false
            }
        }
    }
    
    fun handleAction(action: NotificationAction, notification: NotificationItem) {
        viewModelScope.launch {
            // Update local state immediately for responsive UI
            val updatedNotifications = _notifications.value.toMutableList()
            val index = updatedNotifications.indexOfFirst { it.id == notification.id }
            if (index != -1) {
                updatedNotifications[index] = updatedNotifications[index].copy(isRead = true)
                _notifications.value = updatedNotifications
            }
            
            // Handle the action
            when (action.identifier) {
                "COMPLETE_ACTION" -> handleCompleteAction(notification)
                "SNOOZE_15M_ACTION" -> handleSnoozeAction(notification, SnoozeDuration.FIFTEEN_MINUTES)
                "SNOOZE_1H_ACTION" -> handleSnoozeAction(notification, SnoozeDuration.ONE_HOUR)
                "SNOOZE_TODAY_ACTION" -> handleSnoozeAction(notification, SnoozeDuration.TODAY)
                "MUTE_ACTION" -> handleMuteAction(notification)
                "OPEN_MAP_ACTION" -> handleOpenMapAction(notification)
            }
            
            // Send action to backend
            try {
                notificationService.performNotificationAction(notification.id, action.identifier)
            } catch (e: Exception) {
                _errorMessage.value = "Failed to perform action: ${e.message}"
            }
        }
    }
    
    fun markAllAsRead() {
        viewModelScope.launch {
            val updatedNotifications = _notifications.value.map { it.copy(isRead = true) }
            _notifications.value = updatedNotifications
            
            try {
                notificationService.markAllNotificationsAsRead()
            } catch (e: Exception) {
                _errorMessage.value = "Failed to mark notifications as read: ${e.message}"
            }
        }
    }
    
    fun deleteNotification(notification: NotificationItem) {
        viewModelScope.launch {
            val updatedNotifications = _notifications.value.toMutableList()
            updatedNotifications.removeAll { it.id == notification.id }
            _notifications.value = updatedNotifications
            
            try {
                notificationService.deleteNotification(notification.id)
            } catch (e: Exception) {
                _errorMessage.value = "Failed to delete notification: ${e.message}"
                // Re-add the notification if deletion failed
                _notifications.value = _notifications.value + notification
            }
        }
    }
    
    // MARK: - Private Methods
    
    private fun handleCompleteAction(notification: NotificationItem) {
        // Remove from list
        val updatedNotifications = _notifications.value.toMutableList()
        updatedNotifications.removeAll { it.id == notification.id }
        _notifications.value = updatedNotifications
    }
    
    private fun handleSnoozeAction(notification: NotificationItem, duration: SnoozeDuration) {
        // Mark as read (already done in handleAction)
        // In a real implementation, we would schedule a snooze notification
    }
    
    private fun handleMuteAction(notification: NotificationItem) {
        // Remove from list
        val updatedNotifications = _notifications.value.toMutableList()
        updatedNotifications.removeAll { it.id == notification.id }
        _notifications.value = updatedNotifications
    }
    
    private fun handleOpenMapAction(notification: NotificationItem) {
        // In a real implementation, we would open the map
    }
    
    private fun loadSampleNotifications() {
        // Load sample notifications for development/demo purposes
        _notifications.value = listOf(
            NotificationItem(
                title = "You're near the pharmacy",
                body = "Don't forget to pick up your prescription",
                taskId = "task-1",
                type = NotificationType.APPROACH,
                actions = listOf(
                    NotificationAction.complete,
                    NotificationAction.snooze15m,
                    NotificationAction.snooze1h,
                    NotificationAction.mute
                )
            ),
            NotificationItem(
                title = "Arrived at grocery store",
                body = "Time to pick up milk and bread",
                taskId = "task-2",
                type = NotificationType.ARRIVAL,
                actions = listOf(
                    NotificationAction.complete,
                    NotificationAction.snooze15m,
                    NotificationAction.openMap
                ),
                isRead = true
            ),
            NotificationItem(
                title = "Task completed!",
                body = "Great job picking up your dry cleaning",
                taskId = "task-3",
                type = NotificationType.COMPLETION,
                isRead = true
            )
        )
    }
    
    private fun isToday(date: Date): Boolean {
        val calendar = Calendar.getInstance()
        val today = calendar.time
        calendar.time = date
        val notificationDate = calendar.time
        
        val todayCalendar = Calendar.getInstance()
        todayCalendar.time = today
        
        val notificationCalendar = Calendar.getInstance()
        notificationCalendar.time = notificationDate
        
        return todayCalendar.get(Calendar.YEAR) == notificationCalendar.get(Calendar.YEAR) &&
                todayCalendar.get(Calendar.DAY_OF_YEAR) == notificationCalendar.get(Calendar.DAY_OF_YEAR)
    }
    
    private fun isThisWeek(date: Date): Boolean {
        val calendar = Calendar.getInstance()
        val now = calendar.time
        calendar.time = date
        val notificationDate = calendar.time
        
        val nowCalendar = Calendar.getInstance()
        nowCalendar.time = now
        
        val notificationCalendar = Calendar.getInstance()
        notificationCalendar.time = notificationDate
        
        return nowCalendar.get(Calendar.YEAR) == notificationCalendar.get(Calendar.YEAR) &&
                nowCalendar.get(Calendar.WEEK_OF_YEAR) == notificationCalendar.get(Calendar.WEEK_OF_YEAR)
    }
}

// MARK: - Notification Settings View Model
class NotificationSettingsViewModel : ViewModel() {
    private val _settings = MutableStateFlow(NotificationSettings.default)
    val settings: StateFlow<NotificationSettings> = _settings.asStateFlow()
    
    private val notificationService = NotificationService()
    
    init {
        loadSettings()
    }
    
    fun loadSettings() {
        // In a real implementation, we would load from SharedPreferences or a database
        _settings.value = NotificationSettings.default
    }
    
    fun saveSettings() {
        viewModelScope.launch {
            try {
                notificationService.updateNotificationSettings(_settings.value)
            } catch (e: Exception) {
                // Handle error
            }
        }
    }
    
    fun updateLocationRemindersEnabled(enabled: Boolean) {
        _settings.value = _settings.value.copy(locationRemindersEnabled = enabled)
        saveSettings()
    }
    
    fun updateTaskCompletionAlerts(enabled: Boolean) {
        _settings.value = _settings.value.copy(taskCompletionAlerts = enabled)
        saveSettings()
    }
    
    fun updateDailySummary(enabled: Boolean) {
        _settings.value = _settings.value.copy(dailySummary = enabled)
        saveSettings()
    }
    
    fun updateQuietHoursEnabled(enabled: Boolean) {
        _settings.value = _settings.value.copy(quietHoursEnabled = enabled)
        saveSettings()
    }
    
    fun updateQuietHoursStart(time: Date) {
        _settings.value = _settings.value.copy(quietHoursStart = time)
        saveSettings()
    }
    
    fun updateQuietHoursEnd(time: Date) {
        _settings.value = _settings.value.copy(quietHoursEnd = time)
        saveSettings()
    }
    
    fun updateDefaultSnoozeDuration(duration: SnoozeDuration) {
        _settings.value = _settings.value.copy(defaultSnoozeDuration = duration)
        saveSettings()
    }
    
    fun resetToDefaults() {
        _settings.value = NotificationSettings.default
        saveSettings()
    }
}

// MARK: - Notification Service
class NotificationService {
    suspend fun getNotificationHistory(): List<NotificationItem> {
        // TODO: Implement actual API call
        // For now, return empty list
        return emptyList()
    }
    
    suspend fun performNotificationAction(notificationId: String, action: String) {
        // TODO: Implement actual API call
    }
    
    suspend fun markAllNotificationsAsRead() {
        // TODO: Implement actual API call
    }
    
    suspend fun deleteNotification(notificationId: String) {
        // TODO: Implement actual API call
    }
    
    suspend fun updateNotificationSettings(settings: NotificationSettings) {
        // TODO: Implement actual API call
    }
}
