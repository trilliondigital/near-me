package com.nearme.app.ui.screens

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.nearme.app.ui.components.*
import com.nearme.app.ui.theme.*

enum class NotificationFilter(val title: String) {
    All("All"),
    Unread("Unread"),
    Today("Today"),
    ThisWeek("This Week")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen() {
    var notifications by remember { mutableStateOf(emptyList<NotificationItem>()) }
    var isLoading by remember { mutableStateOf(false) }
    var selectedFilter by remember { mutableStateOf(NotificationFilter.All) }
    var showUnreadOnly by remember { mutableStateOf(false) }
    
    val unreadCount = remember(notifications) {
        notifications.count { !it.isRead }
    }
    
    val filteredNotifications = remember(notifications, selectedFilter, showUnreadOnly) {
        var filtered = notifications
        
        if (showUnreadOnly) {
            filtered = filtered.filter { !it.isRead }
        }
        
        when (selectedFilter) {
            NotificationFilter.All -> filtered
            NotificationFilter.Unread -> filtered.filter { !it.isRead }
            NotificationFilter.Today -> {
                val today = System.currentTimeMillis() - (24 * 60 * 60 * 1000)
                filtered.filter { it.timestamp >= today }
            }
            NotificationFilter.ThisWeek -> {
                val weekAgo = System.currentTimeMillis() - (7 * 24 * 60 * 60 * 1000)
                filtered.filter { it.timestamp >= weekAgo }
            }
        }.sortedByDescending { it.timestamp }
    }
    
    LaunchedEffect(Unit) {
        isLoading = true
        // TODO: Load notifications from backend
        notifications = listOf(
            NotificationItem(
                id = "1",
                title = "Task Reminder",
                message = "You're near Whole Foods Market. Don't forget to buy groceries!",
                timestamp = System.currentTimeMillis() - 300000, // 5 minutes ago
                isRead = false,
                actions = listOf(
                    NotificationAction("Complete", Success) {},
                    NotificationAction("Snooze", TextSecondary) {}
                )
            ),
            NotificationItem(
                id = "2",
                title = "Location Update",
                message = "You've arrived at UPS Store. Ready to drop off your package?",
                timestamp = System.currentTimeMillis() - 1800000, // 30 minutes ago
                isRead = true,
                actions = listOf(
                    NotificationAction("Complete", Success) {}
                )
            ),
            NotificationItem(
                id = "3",
                title = "Task Completed",
                message = "Great job! You've completed your grocery shopping task.",
                timestamp = System.currentTimeMillis() - 3600000, // 1 hour ago
                isRead = true,
                actions = emptyList()
            )
        )
        isLoading = false
    }
    
    Column(
        modifier = Modifier.fillMaxSize()
    ) {
        // Top App Bar
        TopAppBar(
            title = {
                Text(
                    text = "Notifications",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold
                )
            },
            actions = {
                if (unreadCount > 0) {
                    Badge(
                        modifier = Modifier.padding(end = DesignSystem.Spacing.sm)
                    ) {
                        Text(
                            text = unreadCount.toString(),
                            style = MaterialTheme.typography.labelSmall,
                            color = TextInverse
                        )
                    }
                }
                
                IconButton(onClick = { showUnreadOnly = !showUnreadOnly }) {
                    Icon(
                        imageVector = Icons.Default.FilterList,
                        contentDescription = "Filter"
                    )
                }
            }
        )
        
        // Filter Section
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Surface)
                .padding(DesignSystem.Spacing.md),
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
        ) {
            // Filter Chips
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
            ) {
                NotificationFilter.values().forEach { filter ->
                    FilterChip(
                        onClick = { selectedFilter = filter },
                        label = { Text(filter.title) },
                        selected = selectedFilter == filter,
                        modifier = Modifier.height(32.dp)
                    )
                }
            }
            
            // Unread Only Toggle
            if (showUnreadOnly) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Primary.copy(alpha = 0.1f)),
                    shape = RoundedCornerShape(DesignSystem.CornerRadius.sm)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(DesignSystem.Spacing.sm),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
                        ) {
                            Icon(
                                imageVector = Icons.Default.VisibilityOff,
                                contentDescription = null,
                                tint = Primary,
                                modifier = Modifier.size(16.dp)
                            )
                            
                            Text(
                                text = "Showing unread notifications only",
                                style = MaterialTheme.typography.labelMedium,
                                color = TextSecondary
                            )
                        }
                        
                        TextButton(onClick = { showUnreadOnly = false }) {
                            Text(
                                text = "Show All",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Medium,
                                color = Primary
                            )
                        }
                    }
                }
            }
        }
        
        // Notifications List
        if (isLoading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
                ) {
                    CircularProgressIndicator()
                    Text(
                        text = "Loading notifications...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )
                }
            }
        } else if (filteredNotifications.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                EmptyStateCard(
                    icon = if (showUnreadOnly) "bell_off" else "bell",
                    title = if (showUnreadOnly) "No Unread Notifications" else "No Notifications",
                    message = if (showUnreadOnly) 
                        "All caught up! No unread notifications." 
                    else "You'll see location-based reminders here when you're near your tasks.",
                    actionTitle = null,
                    onActionClick = null
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(DesignSystem.Spacing.md),
                verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
            ) {
                items(filteredNotifications) { notification ->
                    NotificationCard(
                        title = notification.title,
                        message = notification.message,
                        timestamp = formatTimestamp(notification.timestamp),
                        isRead = notification.isRead,
                        actions = notification.actions,
                        onClick = { /* Navigate to notification detail */ }
                    )
                }
            }
        }
    }
}

@Composable
fun FilterChip(
    onClick: () -> Unit,
    label: @Composable () -> Unit,
    selected: Boolean,
    modifier: Modifier = Modifier
) {
    FilterChip(
        onClick = onClick,
        label = label,
        selected = selected,
        modifier = modifier,
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = Primary,
            selectedLabelColor = TextInverse,
            containerColor = Surface,
            labelColor = TextPrimary
        ),
        shape = RoundedCornerShape(DesignSystem.CornerRadius.round)
    )
}

private fun formatTimestamp(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp
    
    return when {
        diff < 60000 -> "Just now"
        diff < 3600000 -> "${diff / 60000} minutes ago"
        diff < 86400000 -> "${diff / 3600000} hours ago"
        diff < 604800000 -> "${diff / 86400000} days ago"
        else -> "Over a week ago"
    }
}

data class NotificationItem(
    val id: String,
    val title: String,
    val message: String,
    val timestamp: Long,
    val isRead: Boolean,
    val actions: List<NotificationAction>
)

@Preview(showBackground = true)
@Composable
fun NotificationsScreenPreview() {
    NearMeTheme {
        NotificationsScreen()
    }
}
