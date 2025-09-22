package com.nearme.app.models

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.ui.graphics.vector.ImageVector

data class OnboardingPreferences(
    val commonLocations: List<CommonLocation> = emptyList(),
    val notificationPreferences: NotificationPreferences = NotificationPreferences(),
    val taskCategories: List<TaskCategory> = emptyList(),
    val hasCompletedOnboarding: Boolean = false
)

data class CommonLocation(
    val id: String,
    val name: String,
    val type: LocationType,
    val address: String? = null,
    val coordinate: Coordinate? = null
)

data class Coordinate(
    val latitude: Double,
    val longitude: Double
)

enum class LocationType(
    val displayName: String,
    val icon: ImageVector
) {
    HOME("Home", Icons.Default.Home),
    WORK("Work", Icons.Default.Business),
    GYM("Gym", Icons.Default.FitnessCenter),
    SCHOOL("School", Icons.Default.School),
    GROCERY("Grocery Store", Icons.Default.ShoppingCart),
    PHARMACY("Pharmacy", Icons.Default.LocalPharmacy),
    BANK("Bank", Icons.Default.AccountBalance),
    POST_OFFICE("Post Office", Icons.Default.Mail),
    CUSTOM("Custom Location", Icons.Default.LocationOn)
}

data class NotificationPreferences(
    val quietHoursEnabled: Boolean = false,
    val quietStartTime: String = "22:00",
    val quietEndTime: String = "08:00",
    val weekendQuietHours: Boolean = true,
    val approachNotifications: Boolean = true,
    val arrivalNotifications: Boolean = true,
    val postArrivalNotifications: Boolean = true
)

data class TaskCategory(
    val id: String,
    val name: String,
    val icon: ImageVector,
    val isSelected: Boolean = false
) {
    companion object {
        val defaultCategories = listOf(
            TaskCategory("shopping", "Shopping", Icons.Default.ShoppingCart),
            TaskCategory("health", "Health & Wellness", Icons.Default.Favorite),
            TaskCategory("finance", "Finance", Icons.Default.AccountBalance),
            TaskCategory("work", "Work", Icons.Default.Work),
            TaskCategory("personal", "Personal", Icons.Default.Person),
            TaskCategory("family", "Family", Icons.Default.Home),
            TaskCategory("social", "Social", Icons.Default.People),
            TaskCategory("travel", "Travel", Icons.Default.Flight)
        )
    }
}