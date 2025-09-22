package com.nearme.app.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.Date

// MARK: - User Models
@Serializable
data class User(
    val id: String,
    val email: String? = null,
    val preferences: UserPreferences,
    @SerialName("premium_status")
    val premiumStatus: PremiumStatus,
    @SerialName("created_at")
    val createdAt: String,
    @SerialName("updated_at")
    val updatedAt: String
) {
    val isPremium: Boolean
        get() = premiumStatus == PremiumStatus.PREMIUM || premiumStatus == PremiumStatus.TRIAL
    
    val canCreateUnlimitedTasks: Boolean
        get() = isPremium
    
    val maxActiveTasks: Int
        get() = if (isPremium) Int.MAX_VALUE else 3
}

// MARK: - Premium Status
@Serializable
enum class PremiumStatus(val value: String) {
    @SerialName("free")
    FREE("free"),
    
    @SerialName("trial")
    TRIAL("trial"),
    
    @SerialName("premium")
    PREMIUM("premium");
    
    val displayName: String
        get() = when (this) {
            FREE -> "Free"
            TRIAL -> "Trial"
            PREMIUM -> "Premium"
        }
    
    val badgeColor: String
        get() = when (this) {
            FREE -> "Secondary"
            TRIAL -> "Warning"
            PREMIUM -> "Premium"
        }
}

// MARK: - User Preferences
@Serializable
data class UserPreferences(
    @SerialName("notification_style")
    val notificationStyle: NotificationStyle,
    @SerialName("privacy_mode")
    val privacyMode: PrivacyMode,
    @SerialName("quiet_hours")
    val quietHours: QuietHours? = null,
    @SerialName("default_radii")
    val defaultRadii: GeofenceRadii? = null
) {
    companion object {
        val default = UserPreferences(
            notificationStyle = NotificationStyle.STANDARD,
            privacyMode = PrivacyMode.STANDARD,
            quietHours = null,
            defaultRadii = null
        )
    }
}

// MARK: - Notification Style
@Serializable
enum class NotificationStyle(val value: String) {
    @SerialName("minimal")
    MINIMAL("minimal"),
    
    @SerialName("standard")
    STANDARD("standard"),
    
    @SerialName("detailed")
    DETAILED("detailed");
    
    val displayName: String
        get() = when (this) {
            MINIMAL -> "Minimal"
            STANDARD -> "Standard"
            DETAILED -> "Detailed"
        }
    
    val isPremiumFeature: Boolean
        get() = this == DETAILED
}

// MARK: - Privacy Mode
@Serializable
enum class PrivacyMode(val value: String) {
    @SerialName("standard")
    STANDARD("standard"),
    
    @SerialName("foreground_only")
    FOREGROUND_ONLY("foreground_only");
    
    val displayName: String
        get() = when (this) {
            STANDARD -> "Standard"
            FOREGROUND_ONLY -> "Foreground Only"
        }
    
    val description: String
        get() = when (this) {
            STANDARD -> "Location tracking when app is in background"
            FOREGROUND_ONLY -> "Location tracking only when app is open"
        }
}

// MARK: - Quiet Hours
@Serializable
data class QuietHours(
    @SerialName("start_time")
    val startTime: String, // HH:mm format
    @SerialName("end_time")
    val endTime: String, // HH:mm format
    val enabled: Boolean
) {
    companion object {
        val default = QuietHours(
            startTime = "22:00",
            endTime = "08:00",
            enabled = false
        )
    }
}

// MARK: - Premium Features
enum class PremiumFeature(val value: String) {
    UNLIMITED_TASKS("unlimited_tasks"),
    CUSTOM_NOTIFICATION_SOUNDS("custom_notification_sounds"),
    DETAILED_NOTIFICATIONS("detailed_notifications"),
    ADVANCED_GEOFENCING("advanced_geofencing"),
    PRIORITY_SUPPORT("priority_support"),
    EXPORT_DATA("export_data");
    
    val displayName: String
        get() = when (this) {
            UNLIMITED_TASKS -> "Unlimited Tasks"
            CUSTOM_NOTIFICATION_SOUNDS -> "Custom Notification Sounds"
            DETAILED_NOTIFICATIONS -> "Detailed Notifications"
            ADVANCED_GEOFENCING -> "Advanced Geofencing"
            PRIORITY_SUPPORT -> "Priority Support"
            EXPORT_DATA -> "Export Data"
        }
    
    val description: String
        get() = when (this) {
            UNLIMITED_TASKS -> "Create as many location-based tasks as you need"
            CUSTOM_NOTIFICATION_SOUNDS -> "Choose custom sounds for your notifications"
            DETAILED_NOTIFICATIONS -> "Rich notifications with more context and actions"
            ADVANCED_GEOFENCING -> "Fine-tune geofence radii and timing"
            PRIORITY_SUPPORT -> "Get help faster with priority customer support"
            EXPORT_DATA -> "Export your tasks and data anytime"
        }
    
    val icon: String
        get() = when (this) {
            UNLIMITED_TASKS -> "infinity"
            CUSTOM_NOTIFICATION_SOUNDS -> "volume_up"
            DETAILED_NOTIFICATIONS -> "notifications_active"
            ADVANCED_GEOFENCING -> "location_on"
            PRIORITY_SUPPORT -> "headset_mic"
            EXPORT_DATA -> "file_upload"
        }
}

// MARK: - Task Limit Status
data class TaskLimitStatus(
    val currentCount: Int,
    val maxCount: Int,
    val isPremium: Boolean
) {
    val isAtLimit: Boolean
        get() = !isPremium && currentCount >= maxCount
    
    val remainingTasks: Int
        get() = if (isPremium) Int.MAX_VALUE else maxOf(0, maxCount - currentCount)
    
    val progressPercentage: Float
        get() = if (isPremium || maxCount <= 0) 0f else minOf(1f, currentCount.toFloat() / maxCount.toFloat())
    
    val warningThreshold: Boolean
        get() = !isPremium && currentCount >= maxCount - 1
}

// MARK: - User Update Request
@Serializable
data class UpdateUserRequest(
    val email: String? = null,
    val preferences: UserPreferences? = null,
    @SerialName("premium_status")
    val premiumStatus: PremiumStatus? = null
)