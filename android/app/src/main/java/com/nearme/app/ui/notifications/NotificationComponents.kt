package com.nearme.app.ui.notifications

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nearme.app.models.NotificationItem
import com.nearme.app.models.NotificationAction
import com.nearme.app.models.NotificationFilter
import com.nearme.app.models.SnoozeDuration
import java.text.SimpleDateFormat
import java.util.*

// MARK: - Notification Card Component
@Composable
fun NotificationCard(
    notification: NotificationItem,
    onAction: (NotificationAction) -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Header with title and timestamp
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = notification.title,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    
                    Spacer(modifier = Modifier.height(4.dp))
                    
                    Text(
                        text = notification.body,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                
                Column(
                    horizontalAlignment = Alignment.End
                ) {
                    Text(
                        text = formatTimestamp(notification.timestamp),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    
                    Spacer(modifier = Modifier.height(4.dp))
                    
                    if (notification.isRead) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = "Read",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
            
            // Action buttons
            if (notification.actions.isNotEmpty()) {
                Spacer(modifier = Modifier.height(12.dp))
                
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    notification.actions.forEach { action ->
                        NotificationActionButton(
                            action = action,
                            onTap = { onAction(action) }
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Notification Action Button
@Composable
fun NotificationActionButton(
    action: NotificationAction,
    onTap: () -> Unit,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onTap,
        modifier = modifier,
        colors = ButtonDefaults.buttonColors(
            containerColor = action.backgroundColor,
            contentColor = action.foregroundColor
        ),
        shape = RoundedCornerShape(8.dp),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Icon(
                imageVector = action.icon,
                contentDescription = null,
                modifier = Modifier.size(14.dp)
            )
            
            Text(
                text = action.title,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

// MARK: - Notification History Screen
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationHistoryScreen(
    viewModel: NotificationHistoryViewModel,
    modifier: Modifier = Modifier
) {
    val notifications by viewModel.filteredNotifications.collectAsState()
    val selectedFilter by viewModel.selectedFilter.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    
    Column(modifier = modifier.fillMaxSize()) {
        // Top App Bar
        TopAppBar(
            title = { Text("Notifications") },
            actions = {
                TextButton(
                    onClick = { viewModel.markAllAsRead() }
                ) {
                    Text("Mark All Read")
                }
            }
        )
        
        // Filter tabs
        ScrollableTabRow(
            selectedTabIndex = NotificationFilter.values().indexOf(selectedFilter),
            modifier = Modifier.fillMaxWidth()
        ) {
            NotificationFilter.values().forEachIndexed { index, filter ->
                Tab(
                    selected = selectedFilter == filter,
                    onClick = { viewModel.selectedFilter = filter },
                    text = { Text(filter.title) }
                )
            }
        }
        
        Divider()
        
        // Notification list
        if (isLoading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else if (notifications.isEmpty()) {
            EmptyNotificationState(filter = selectedFilter)
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(vertical = 8.dp)
            ) {
                items(notifications) { notification ->
                    NotificationCard(
                        notification = notification,
                        onAction = { action ->
                            viewModel.handleAction(action, notification)
                        }
                    )
                }
            }
        }
    }
}

// MARK: - Empty Notification State
@Composable
fun EmptyNotificationState(
    filter: NotificationFilter,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = filter.emptyStateIcon,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Text(
            text = filter.emptyStateTitle,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurface
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        Text(
            text = filter.emptyStateMessage,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
    }
}

// MARK: - Notification Settings Screen
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationSettingsScreen(
    viewModel: NotificationSettingsViewModel,
    notificationManager: com.nearme.app.notifications.NotificationManager,
    modifier: Modifier = Modifier
) {
    val settings by viewModel.settings.collectAsState()
    val isNotificationEnabled by notificationManager.isNotificationEnabled.collectAsState()
    
    Column(modifier = modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Notification Settings") }
        )
        
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Permission Status Section
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Notifications",
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.Medium
                            )
                            
                            Text(
                                text = if (isNotificationEnabled) "Enabled" else "Disabled - Enable in Settings",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        
                        if (!isNotificationEnabled) {
                            Button(
                                onClick = { notificationManager.requestNotificationPermission() }
                            ) {
                                Text("Enable")
                            }
                        }
                    }
                }
            }
            
            // Notification Preferences Section
            item {
                Text(
                    text = "Notification Types",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(vertical = 8.dp)
                )
            }
            
            item {
                SettingsSwitchItem(
                    title = "Location Reminders",
                    subtitle = "Get notified when you're near places",
                    checked = settings.locationRemindersEnabled,
                    onCheckedChange = { viewModel.updateLocationRemindersEnabled(it) }
                )
            }
            
            item {
                SettingsSwitchItem(
                    title = "Task Completion Alerts",
                    subtitle = "Get notified when tasks are completed",
                    checked = settings.taskCompletionAlerts,
                    onCheckedChange = { viewModel.updateTaskCompletionAlerts(it) }
                )
            }
            
            item {
                SettingsSwitchItem(
                    title = "Daily Summary",
                    subtitle = "Receive a daily summary of your tasks",
                    checked = settings.dailySummary,
                    onCheckedChange = { viewModel.updateDailySummary(it) }
                )
            }
            
            // Quiet Hours Section
            item {
                Text(
                    text = "Quiet Hours",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(vertical = 8.dp)
                )
            }
            
            item {
                SettingsSwitchItem(
                    title = "Enable Quiet Hours",
                    subtitle = "Notifications will be silenced during these hours",
                    checked = settings.quietHoursEnabled,
                    onCheckedChange = { viewModel.updateQuietHoursEnabled(it) }
                )
            }
            
            if (settings.quietHoursEnabled) {
                item {
                    SettingsTimePickerItem(
                        title = "Start Time",
                        time = settings.quietHoursStart,
                        onTimeChange = { viewModel.updateQuietHoursStart(it) }
                    )
                }
                
                item {
                    SettingsTimePickerItem(
                        title = "End Time",
                        time = settings.quietHoursEnd,
                        onTimeChange = { viewModel.updateQuietHoursEnd(it) }
                    )
                }
            }
            
            // Snooze Defaults Section
            item {
                Text(
                    text = "Snooze Settings",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(vertical = 8.dp)
                )
            }
            
            item {
                SettingsDropdownItem(
                    title = "Default Snooze Duration",
                    subtitle = "Default duration when snoozing notifications",
                    selectedValue = settings.defaultSnoozeDuration.title,
                    onValueChange = { viewModel.updateDefaultSnoozeDuration(it) }
                )
            }
        }
    }
}

// MARK: - Settings Components
@Composable
fun SettingsSwitchItem(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium
                )
                
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            Switch(
                checked = checked,
                onCheckedChange = onCheckedChange
            )
        }
    }
}

@Composable
fun SettingsTimePickerItem(
    title: String,
    time: Date,
    onTimeChange: (Date) -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium
            )
            
            Text(
                text = SimpleDateFormat("HH:mm", Locale.getDefault()).format(time),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
fun SettingsDropdownItem(
    title: String,
    subtitle: String,
    selectedValue: String,
    onValueChange: (SnoozeDuration) -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium
            )
            
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = selectedValue,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

// MARK: - Helper Functions
private fun formatTimestamp(timestamp: Date): String {
    val now = Date()
    val diff = now.time - timestamp.time
    
    return when {
        diff < 60 * 1000 -> "Just now"
        diff < 60 * 60 * 1000 -> "${diff / (60 * 1000)}m ago"
        diff < 24 * 60 * 60 * 1000 -> "${diff / (60 * 60 * 1000)}h ago"
        else -> SimpleDateFormat("MMM d", Locale.getDefault()).format(timestamp)
    }
}
