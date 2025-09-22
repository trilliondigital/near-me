package com.nearme.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.nearme.app.ui.components.*
import com.nearme.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen() {
    var settings by remember { mutableStateOf(AppSettings()) }
    
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(DesignSystem.Spacing.lg),
        verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.lg)
    ) {
        // Profile Section
        item {
            ProfileSection()
        }
        
        // Location Settings
        item {
            SettingsSection(title = "Location") {
                Column(
                    verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
                ) {
                    ToggleField(
                        title = "Location Services",
                        checked = true, // TODO: Get from LocationManager
                        onCheckedChange = { /* TODO: Handle location toggle */ },
                        description = "Required for location-based reminders"
                    )
                    
                    ToggleField(
                        title = "Background Location",
                        checked = settings.backgroundLocationEnabled,
                        onCheckedChange = { settings = settings.copy(backgroundLocationEnabled = it) },
                        description = "Allow location tracking when app is closed"
                    )
                    
                    SliderField(
                        title = "Location Accuracy",
                        value = settings.locationAccuracy,
                        onValueChange = { settings = settings.copy(locationAccuracy = it) },
                        valueRange = 0.1f..1.0f,
                        unit = " km",
                        description = "Higher accuracy uses more battery"
                    )
                }
            }
        }
        
        // Notification Settings
        item {
            SettingsSection(title = "Notifications") {
                Column(
                    verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
                ) {
                    ToggleField(
                        title = "Push Notifications",
                        checked = true, // TODO: Get from NotificationManager
                        onCheckedChange = { /* TODO: Handle notification toggle */ },
                        description = "Receive notifications when near tasks"
                    )
                    
                    ToggleField(
                        title = "Sound",
                        checked = settings.notificationSound,
                        onCheckedChange = { settings = settings.copy(notificationSound = it) },
                        description = "Play sound with notifications"
                    )
                    
                    ToggleField(
                        title = "Vibration",
                        checked = settings.notificationVibration,
                        onCheckedChange = { settings = settings.copy(notificationVibration = it) },
                        description = "Vibrate with notifications"
                    )
                    
                    ToggleField(
                        title = "Do Not Disturb",
                        checked = settings.doNotDisturbEnabled,
                        onCheckedChange = { settings = settings.copy(doNotDisturbEnabled = it) },
                        description = "Respect system Do Not Disturb settings"
                    )
                    
                    if (settings.doNotDisturbEnabled) {
                        Column(
                            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
                        ) {
                            ToggleField(
                                title = "Quiet Hours",
                                checked = settings.quietHoursEnabled,
                                onCheckedChange = { settings = settings.copy(quietHoursEnabled = it) },
                                description = "Disable notifications during set hours"
                            )
                            
                            if (settings.quietHoursEnabled) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
                                ) {
                                    Text(
                                        text = "From:",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = TextPrimary
                                    )
                                    
                                    // TODO: Add time picker
                                    Text(
                                        text = "10:00 PM",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = Primary
                                    )
                                    
                                    Text(
                                        text = "To:",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = TextPrimary
                                    )
                                    
                                    Text(
                                        text = "8:00 AM",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = Primary
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Task Settings
        item {
            SettingsSection(title = "Tasks") {
                Column(
                    verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
                ) {
                    SliderField(
                        title = "Default Radius",
                        value = settings.defaultTaskRadius,
                        onValueChange = { settings = settings.copy(defaultTaskRadius = it) },
                        valueRange = 0.1f..5.0f,
                        unit = " mi",
                        description = "Default distance for new tasks"
                    )
                    
                    ToggleField(
                        title = "Auto-complete Tasks",
                        checked = settings.autoCompleteTasks,
                        onCheckedChange = { settings = settings.copy(autoCompleteTasks = it) },
                        description = "Automatically mark tasks as completed when leaving location"
                    )
                    
                    ToggleField(
                        title = "Task Reminders",
                        checked = settings.taskRemindersEnabled,
                        onCheckedChange = { settings = settings.copy(taskRemindersEnabled = it) },
                        description = "Send reminders before arriving at task locations"
                    )
                    
                    if (settings.taskRemindersEnabled) {
                        SliderField(
                            title = "Reminder Time",
                            value = settings.reminderTimeMinutes,
                            onValueChange = { settings = settings.copy(reminderTimeMinutes = it) },
                            valueRange = 5f..60f,
                            unit = " min",
                            description = "How early to send reminders"
                        )
                    }
                }
            }
        }
        
        // Privacy Settings
        item {
            SettingsSection(title = "Privacy") {
                Column(
                    verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
                ) {
                    SettingsRow(
                        title = "Privacy Policy",
                        icon = Icons.Default.Description,
                        onClick = { /* Navigate to privacy policy */ }
                    )
                    
                    SettingsRow(
                        title = "Terms of Service",
                        icon = Icons.Default.Description,
                        onClick = { /* Navigate to terms */ }
                    )
                    
                    SettingsRow(
                        title = "Data Export",
                        icon = Icons.Default.Upload,
                        onClick = { /* Implement data export */ }
                    )
                    
                    SettingsRow(
                        title = "Delete Account",
                        icon = Icons.Default.Delete,
                        onClick = { /* Implement account deletion */ },
                        isDestructive = true
                    )
                }
            }
        }
        
        // App Information
        item {
            SettingsSection(title = "About") {
                Column(
                    verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
                ) {
                    SettingsRow(
                        title = "App Version",
                        icon = Icons.Default.Info,
                        subtitle = "1.0.0",
                        onClick = {}
                    )
                    
                    SettingsRow(
                        title = "About Near Me",
                        icon = Icons.Default.Help,
                        onClick = { /* Navigate to about */ }
                    )
                    
                    SettingsRow(
                        title = "Support",
                        icon = Icons.Default.Support,
                        onClick = { /* Implement support */ }
                    )
                }
            }
        }
    }
}

@Composable
fun ProfileSection() {
    BaseCard {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
        ) {
            Box(
                modifier = Modifier
                    .size(60.dp)
                    .clip(CircleShape)
                    .background(Primary),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Person,
                    contentDescription = null,
                    tint = TextInverse,
                    modifier = Modifier.size(24.dp)
                )
            }
            
            Column(
                verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
            ) {
                Text(
                    text = "Guest User",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = TextPrimary
                )
                
                Text(
                    text = "Free Plan",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary
                )
            }
            
            Spacer(modifier = Modifier.weight(1f))
            
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = TextTertiary,
                modifier = Modifier.size(DesignSystem.IconSize.small)
            )
        }
    }
}

@Composable
fun SettingsSection(
    title: String,
    content: @Composable () -> Unit
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = TextPrimary,
            modifier = Modifier.padding(horizontal = DesignSystem.Spacing.md)
        )
        
        BaseCard {
            content()
        }
    }
}

@Composable
fun SettingsRow(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    subtitle: String? = null,
    onClick: () -> Unit,
    isDestructive: Boolean = false
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(vertical = DesignSystem.Spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = if (isDestructive) Error else TextSecondary,
            modifier = Modifier.size(18.dp)
        )
        
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                color = if (isDestructive) Error else TextPrimary
            )
            
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.labelMedium,
                    color = TextSecondary
                )
            }
        }
        
        Icon(
            imageVector = Icons.Default.ChevronRight,
            contentDescription = null,
            tint = TextTertiary,
            modifier = Modifier.size(14.dp)
        )
    }
}

data class AppSettings(
    val backgroundLocationEnabled: Boolean = true,
    val locationAccuracy: Float = 0.5f,
    val notificationSound: Boolean = true,
    val notificationVibration: Boolean = true,
    val doNotDisturbEnabled: Boolean = true,
    val quietHoursEnabled: Boolean = false,
    val defaultTaskRadius: Float = 1.0f,
    val autoCompleteTasks: Boolean = false,
    val taskRemindersEnabled: Boolean = true,
    val reminderTimeMinutes: Float = 15f
)

@Preview(showBackground = true)
@Composable
fun SettingsScreenPreview() {
    NearMeTheme {
        SettingsScreen()
    }
}
