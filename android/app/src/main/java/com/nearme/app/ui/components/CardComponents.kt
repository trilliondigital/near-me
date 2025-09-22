package com.nearme.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.nearme.app.ui.theme.*

@Composable
fun BaseCard(
    modifier: Modifier = Modifier,
    backgroundColor: Color = Card,
    cornerRadius: androidx.compose.ui.unit.Dp = DesignSystem.CornerRadius.md,
    elevation: androidx.compose.ui.unit.Dp = DesignSystem.Elevation.small,
    content: @Composable () -> Unit
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = backgroundColor),
        shape = RoundedCornerShape(cornerRadius),
        elevation = CardDefaults.cardElevation(defaultElevation = elevation)
    ) {
        Box(
            modifier = Modifier.padding(DesignSystem.Spacing.md)
        ) {
            content()
        }
    }
}

@Composable
fun TaskCard(
    title: String,
    description: String?,
    location: String,
    status: TaskStatus,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    BaseCard(
        modifier = modifier.clickable { onClick() }
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
            ) {
                Icon(
                    imageVector = androidx.compose.material.icons.Icons.Default.Circle,
                    contentDescription = null,
                    tint = status.color,
                    modifier = Modifier.size(DesignSystem.IconSize.medium)
                )
                
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleMedium,
                        color = TextPrimary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    
                    if (description != null) {
                        Text(
                            text = description,
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondary,
                            maxLines = 3,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
                
                Icon(
                    imageVector = androidx.compose.material.icons.Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = TextTertiary,
                    modifier = Modifier.size(DesignSystem.IconSize.small)
                )
            }
            
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
            ) {
                Icon(
                    imageVector = androidx.compose.material.icons.Icons.Default.LocationOn,
                    contentDescription = null,
                    tint = TextSecondary,
                    modifier = Modifier.size(DesignSystem.IconSize.small)
                )
                
                Text(
                    text = location,
                    style = MaterialTheme.typography.labelMedium,
                    color = TextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
fun PlaceCard(
    name: String,
    address: String,
    category: String?,
    distance: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    BaseCard(
        modifier = modifier.clickable { onClick() }
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    Text(
                        text = name,
                        style = MaterialTheme.typography.titleMedium,
                        color = TextPrimary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    
                    Text(
                        text = address,
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                
                Icon(
                    imageVector = androidx.compose.material.icons.Icons.Default.ChevronRight,
                    contentDescription = null,
                    tint = TextTertiary,
                    modifier = Modifier.size(DesignSystem.IconSize.small)
                )
            }
            
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
            ) {
                if (category != null) {
                    Surface(
                        shape = RoundedCornerShape(DesignSystem.CornerRadius.round),
                        color = Primary.copy(alpha = 0.1f)
                    ) {
                        Text(
                            text = category.uppercase(),
                            style = MaterialTheme.typography.labelSmall,
                            color = Primary,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.padding(
                                horizontal = DesignSystem.Spacing.sm,
                                vertical = DesignSystem.Spacing.xs
                            )
                        )
                    }
                }
                
                if (distance != null) {
                    Text(
                        text = distance,
                        style = MaterialTheme.typography.labelMedium,
                        color = TextSecondary
                    )
                }
            }
        }
    }
}

@Composable
fun NotificationCard(
    title: String,
    message: String,
    timestamp: String,
    isRead: Boolean,
    actions: List<NotificationAction>,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    BaseCard(
        modifier = modifier.clickable { onClick() },
        backgroundColor = if (isRead) Card else Surface,
        elevation = if (isRead) DesignSystem.Elevation.small else DesignSystem.Elevation.medium
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
        ) {
            Row(
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(2.dp)
                ) {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleMedium,
                        color = TextPrimary,
                        fontWeight = if (isRead) FontWeight.Normal else FontWeight.SemiBold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    
                    Text(
                        text = message,
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                
                if (!isRead) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(Primary)
                    )
                }
            }
            
            Text(
                text = timestamp,
                style = MaterialTheme.typography.labelMedium,
                color = TextTertiary
            )
            
            if (actions.isNotEmpty()) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
                ) {
                    actions.forEach { action ->
                        OutlinedButton(
                            onClick = action.onClick,
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = action.color
                            ),
                            border = ButtonDefaults.outlinedButtonBorder.copy(
                                brush = androidx.compose.ui.graphics.SolidColor(action.color)
                            ),
                            shape = RoundedCornerShape(DesignSystem.CornerRadius.sm),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Text(
                                text = action.title,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun EmptyStateCard(
    icon: String,
    title: String,
    message: String,
    actionTitle: String?,
    onActionClick: (() -> Unit)?,
    modifier: Modifier = Modifier
) {
    BaseCard(
        modifier = modifier,
        backgroundColor = Surface
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.lg)
        ) {
            Icon(
                imageVector = androidx.compose.material.icons.Icons.Default.List,
                contentDescription = null,
                tint = TextTertiary,
                modifier = Modifier.size(DesignSystem.IconSize.xxl)
            )
            
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineSmall,
                    color = TextPrimary,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
                
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
            }
            
            if (actionTitle != null && onActionClick != null) {
                PrimaryButton(
                    text = actionTitle,
                    onClick = onActionClick
                )
            }
        }
    }
}

enum class TaskStatus(val color: Color) {
    Active(Primary),
    Completed(Success),
    Muted(TextTertiary)
}

data class NotificationAction(
    val title: String,
    val color: Color,
    val onClick: () -> Unit
)

@Preview(showBackground = true)
@Composable
fun CardComponentsPreview() {
    NearMeTheme {
        Column(
            modifier = Modifier.padding(DesignSystem.Spacing.md),
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
        ) {
            TaskCard(
                title = "Buy groceries",
                description = "Pick up milk, bread, and eggs from the store",
                location = "Whole Foods Market",
                status = TaskStatus.Active,
                onClick = {}
            )
            
            PlaceCard(
                name = "Central Park",
                address = "New York, NY 10024",
                category = "Park",
                distance = "0.5 mi",
                onClick = {}
            )
            
            NotificationCard(
                title = "Task Reminder",
                message = "You're near Whole Foods Market. Don't forget to buy groceries!",
                timestamp = "5 minutes ago",
                isRead = false,
                actions = listOf(
                    NotificationAction("Complete", Success) {},
                    NotificationAction("Snooze", TextSecondary) {}
                ),
                onClick = {}
            )
            
            EmptyStateCard(
                icon = "list",
                title = "No Tasks Yet",
                message = "Create your first task to get started with location-based reminders.",
                actionTitle = "Create Task",
                onActionClick = {}
            )
        }
    }
}
