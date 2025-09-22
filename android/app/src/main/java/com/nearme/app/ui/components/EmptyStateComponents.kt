package com.nearme.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.nearme.app.ui.theme.*

// MARK: - Enhanced Empty State View
@Composable
fun EnhancedEmptyStateView(
    config: EmptyStateConfig,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(DesignSystem.Spacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Illustration or Icon
        Box(
            modifier = Modifier.size(120.dp),
            contentAlignment = Alignment.Center
        ) {
            if (config.illustration != null) {
                config.illustration.invoke()
            } else {
                Icon(
                    imageVector = config.icon,
                    contentDescription = null,
                    tint = TextTertiary,
                    modifier = Modifier.size(80.dp)
                )
            }
        }
        
        Spacer(modifier = Modifier.height(DesignSystem.Spacing.xl))
        
        // Content
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
        ) {
            Text(
                text = config.title,
                style = MaterialTheme.typography.headlineSmall,
                color = TextPrimary,
                textAlign = TextAlign.Center,
                fontWeight = FontWeight.SemiBold
            )
            
            Text(
                text = config.message,
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary,
                textAlign = TextAlign.Center,
                lineHeight = MaterialTheme.typography.bodyMedium.lineHeight * 1.2
            )
        }
        
        Spacer(modifier = Modifier.height(DesignSystem.Spacing.xl))
        
        // Quick Actions
        if (config.quickActions.isNotEmpty()) {
            Column(
                verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
            ) {
                config.quickActions.forEach { action ->
                    QuickActionButton(
                        title = action.title,
                        icon = action.icon,
                        onClick = action.onClick,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(DesignSystem.Spacing.lg))
        }
        
        // Primary Action
        config.primaryAction?.let { action ->
            PrimaryButton(
                text = action.title,
                onClick = action.onClick,
                modifier = Modifier.fillMaxWidth()
            )
            
            Spacer(modifier = Modifier.height(DesignSystem.Spacing.md))
        }
        
        // Help Link
        config.helpAction?.let { action ->
            TextButton(onClick = action.onClick) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
                ) {
                    Icon(
                        imageVector = Icons.Default.Help,
                        contentDescription = null,
                        tint = TextSecondary,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = action.title,
                        style = MaterialTheme.typography.labelMedium,
                        color = TextSecondary
                    )
                }
            }
        }
    }
}

// MARK: - Quick Action Button
@Composable
fun QuickActionButton(
    title: String,
    icon: ImageVector?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(48.dp),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = Surface,
            contentColor = TextPrimary
        ),
        border = ButtonDefaults.outlinedButtonBorder.copy(
            brush = androidx.compose.ui.graphics.SolidColor(Border)
        ),
        shape = RoundedCornerShape(DesignSystem.CornerRadius.md)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
        ) {
            icon?.let {
                Icon(
                    imageVector = it,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
            }
            
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.weight(1f),
                textAlign = TextAlign.Start
            )
            
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = TextTertiary,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

// MARK: - Empty State Configuration
data class EmptyStateConfig(
    val title: String,
    val message: String,
    val icon: ImageVector,
    val illustration: (@Composable () -> Unit)? = null,
    val primaryAction: EmptyStateAction? = null,
    val quickActions: List<EmptyStateAction> = emptyList(),
    val helpAction: EmptyStateAction? = null
)

data class EmptyStateAction(
    val title: String,
    val icon: ImageVector? = null,
    val onClick: () -> Unit
)

// MARK: - Predefined Empty States
object EmptyStates {
    fun noTasksFirstTime(
        onCreateTask: () -> Unit,
        onViewExamples: () -> Unit,
        onLearnMore: () -> Unit
    ) = EmptyStateConfig(
        title = "Welcome to Near Me",
        message = "Create location-based reminders that notify you when you're near the right place to complete your tasks.",
        icon = Icons.Default.LocationOn,
        illustration = {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.LocationOn,
                    contentDescription = null,
                    tint = Primary,
                    modifier = Modifier.size(40.dp)
                )
                Icon(
                    imageVector = Icons.Default.Notifications,
                    contentDescription = null,
                    tint = Warning,
                    modifier = Modifier
                        .size(20.dp)
                        .offset(x = 20.dp, y = (-10).dp)
                )
            }
        },
        primaryAction = EmptyStateAction(
            title = "Create Your First Task",
            icon = Icons.Default.Add,
            onClick = onCreateTask
        ),
        quickActions = listOf(
            EmptyStateAction(
                title = "Browse Example Tasks",
                icon = Icons.Default.Lightbulb,
                onClick = onViewExamples
            )
        ),
        helpAction = EmptyStateAction(
            title = "How does it work?",
            onClick = onLearnMore
        )
    )
    
    fun noTasksReturning(
        onCreateTask: () -> Unit,
        onViewCompleted: () -> Unit
    ) = EmptyStateConfig(
        title = "All caught up!",
        message = "You don't have any active tasks right now. Create a new reminder or check your completed tasks.",
        icon = Icons.Default.CheckCircle,
        primaryAction = EmptyStateAction(
            title = "Create New Task",
            icon = Icons.Default.Add,
            onClick = onCreateTask
        ),
        quickActions = listOf(
            EmptyStateAction(
                title = "View Completed Tasks",
                icon = Icons.Default.CheckCircle,
                onClick = onViewCompleted
            )
        )
    )
    
    fun noSearchResults(
        searchTerm: String,
        onClearSearch: () -> Unit,
        onCreateTask: () -> Unit
    ) = EmptyStateConfig(
        title = "No results for \"$searchTerm\"",
        message = "Try adjusting your search terms or create a new task with this name.",
        icon = Icons.Default.Search,
        quickActions = listOf(
            EmptyStateAction(
                title = "Clear Search",
                icon = Icons.Default.Clear,
                onClick = onClearSearch
            ),
            EmptyStateAction(
                title = "Create \"$searchTerm\" Task",
                icon = Icons.Default.Add,
                onClick = onCreateTask
            )
        )
    )
    
    fun noFilteredResults(
        filterName: String,
        onClearFilters: () -> Unit,
        onCreateTask: () -> Unit
    ) = EmptyStateConfig(
        title = "No ${filterName.lowercase()} tasks",
        message = "You don't have any tasks matching the current filter. Try adjusting your filters or create a new task.",
        icon = Icons.Default.FilterList,
        quickActions = listOf(
            EmptyStateAction(
                title = "Clear Filters",
                icon = Icons.Default.Clear,
                onClick = onClearFilters
            ),
            EmptyStateAction(
                title = "Create Task",
                icon = Icons.Default.Add,
                onClick = onCreateTask
            )
        )
    )
    
    fun noPlaces(
        onAddPlace: () -> Unit,
        onUseCurrentLocation: () -> Unit,
        onLearnAboutPlaces: () -> Unit
    ) = EmptyStateConfig(
        title = "No saved places",
        message = "Add your frequently visited places like home, work, or favorite stores to create location-based reminders.",
        icon = Icons.Default.Place,
        primaryAction = EmptyStateAction(
            title = "Add Your First Place",
            icon = Icons.Default.Add,
            onClick = onAddPlace
        ),
        quickActions = listOf(
            EmptyStateAction(
                title = "Use Current Location",
                icon = Icons.Default.MyLocation,
                onClick = onUseCurrentLocation
            )
        ),
        helpAction = EmptyStateAction(
            title = "Learn about places",
            onClick = onLearnAboutPlaces
        )
    )
    
    fun noNotifications(
        onCreateTask: () -> Unit,
        onCheckSettings: () -> Unit
    ) = EmptyStateConfig(
        title = "No notifications yet",
        message = "You'll see location-based reminders here when you're near places with active tasks.",
        icon = Icons.Default.Notifications,
        quickActions = listOf(
            EmptyStateAction(
                title = "Create Your First Task",
                icon = Icons.Default.Add,
                onClick = onCreateTask
            ),
            EmptyStateAction(
                title = "Check Notification Settings",
                icon = Icons.Default.Settings,
                onClick = onCheckSettings
            )
        )
    )
    
    fun locationPermissionNeeded(
        onRequestPermission: () -> Unit,
        onLearnMore: () -> Unit
    ) = EmptyStateConfig(
        title = "Location access needed",
        message = "Near Me needs location access to send you reminders when you're near the right places.",
        icon = Icons.Default.LocationDisabled,
        primaryAction = EmptyStateAction(
            title = "Enable Location Access",
            icon = Icons.Default.LocationOn,
            onClick = onRequestPermission
        ),
        helpAction = EmptyStateAction(
            title = "Why do we need this?",
            onClick = onLearnMore
        )
    )
    
    fun notificationPermissionNeeded(
        onRequestPermission: () -> Unit,
        onLearnMore: () -> Unit
    ) = EmptyStateConfig(
        title = "Notifications disabled",
        message = "Enable notifications to receive location-based reminders for your tasks.",
        icon = Icons.Default.NotificationsOff,
        primaryAction = EmptyStateAction(
            title = "Enable Notifications",
            icon = Icons.Default.Notifications,
            onClick = onRequestPermission
        ),
        helpAction = EmptyStateAction(
            title = "Learn about notifications",
            onClick = onLearnMore
        )
    )
}

// MARK: - Contextual Help Tooltip
@Composable
fun ContextualHelpTooltip(
    text: String,
    isVisible: Boolean,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    if (isVisible) {
        Card(
            modifier = modifier,
            colors = CardDefaults.cardColors(
                containerColor = Warning.copy(alpha = 0.1f)
            ),
            shape = RoundedCornerShape(DesignSystem.CornerRadius.sm),
            border = androidx.compose.foundation.BorderStroke(
                1.dp,
                Warning.copy(alpha = 0.3f)
            )
        ) {
            Row(
                modifier = Modifier.padding(DesignSystem.Spacing.sm),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
            ) {
                Text(
                    text = text,
                    style = MaterialTheme.typography.labelMedium,
                    color = TextPrimary,
                    modifier = Modifier.weight(1f)
                )
                
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.size(20.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Dismiss",
                        tint = TextSecondary,
                        modifier = Modifier.size(12.dp)
                    )
                }
            }
        }
    }
}

// MARK: - Preview
@Preview(showBackground = true)
@Composable
fun EmptyStateComponentsPreview() {
    NearMeTheme {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            EnhancedEmptyStateView(
                config = EmptyStates.noTasksFirstTime(
                    onCreateTask = {},
                    onViewExamples = {},
                    onLearnMore = {}
                ),
                modifier = Modifier.height(400.dp)
            )
            
            ContextualHelpTooltip(
                text = "This is where you'll see your location-based reminders when you're near relevant places.",
                isVisible = true,
                onDismiss = {}
            )
        }
    }
}