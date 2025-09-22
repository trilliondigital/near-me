package com.nearme.app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.nearme.app.ui.theme.*

// Section Header Component
@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    actionText: String? = null,
    onActionClick: (() -> Unit)? = null
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(
                horizontal = DesignSystem.Spacing.padding,
                vertical = DesignSystem.Spacing.sm
            ),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        
        if (actionText != null && onActionClick != null) {
            TextButton(onClick = onActionClick) {
                Text(
                    text = actionText,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

// List Item Component
@Composable
fun ListItem(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    icon: ImageVector? = null,
    iconColor: Color = MaterialTheme.colorScheme.primary,
    accessory: ListAccessory = ListAccessory.None,
    onClick: (() -> Unit)? = null
) {
    val clickableModifier = if (onClick != null) {
        modifier.clickable { onClick() }
    } else {
        modifier
    }
    
    Row(
        modifier = clickableModifier
            .fillMaxWidth()
            .padding(
                horizontal = DesignSystem.Spacing.padding,
                vertical = DesignSystem.Spacing.md
            ),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
    ) {
        // Icon
        if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconColor,
                modifier = Modifier.size(DesignSystem.IconSize.large)
            )
        }
        
        // Content
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurface
            )
            
            if (subtitle != null) {
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        
        // Accessory
        when (accessory) {
            is ListAccessory.None -> {}
            is ListAccessory.Chevron -> {
                Icon(
                    imageVector = Icons.Default.ChevronRight,
                    contentDescription = "Navigate",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(DesignSystem.IconSize.medium)
                )
            }
            is ListAccessory.Toggle -> {
                Switch(
                    checked = accessory.isChecked,
                    onCheckedChange = accessory.onCheckedChange,
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = MaterialTheme.colorScheme.primary
                    )
                )
            }
            is ListAccessory.Button -> {
                OutlinedButton(
                    onClick = accessory.onClick,
                    modifier = Modifier.height(32.dp),
                    contentPadding = PaddingValues(
                        horizontal = DesignSystem.Spacing.sm,
                        vertical = DesignSystem.Spacing.xs
                    )
                ) {
                    Text(
                        text = accessory.text,
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }
            is ListAccessory.Badge -> {
                Surface(
                    shape = CircleShape,
                    color = accessory.color
                ) {
                    Text(
                        text = accessory.text,
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White,
                        modifier = Modifier.padding(
                            horizontal = DesignSystem.Spacing.sm,
                            vertical = DesignSystem.Spacing.xs
                        )
                    )
                }
            }
        }
    }
}

// Expandable List Section
@Composable
fun ExpandableListSection(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    icon: ImageVector? = null,
    initiallyExpanded: Boolean = false,
    content: @Composable () -> Unit
) {
    var isExpanded by remember { mutableStateOf(initiallyExpanded) }
    val rotationAngle by animateFloatAsState(
        targetValue = if (isExpanded) 180f else 0f,
        label = "chevron_rotation"
    )
    
    Column(modifier = modifier) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { isExpanded = !isExpanded }
                .padding(
                    horizontal = DesignSystem.Spacing.padding,
                    vertical = DesignSystem.Spacing.md
                ),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
        ) {
            if (icon != null) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(DesignSystem.IconSize.large)
                )
            }
            
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface
                )
                
                if (subtitle != null) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            
            Icon(
                imageVector = Icons.Default.ExpandMore,
                contentDescription = if (isExpanded) "Collapse" else "Expand",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .size(DesignSystem.IconSize.medium)
                    .rotate(rotationAngle)
            )
        }
        
        // Content
        AnimatedVisibility(
            visible = isExpanded,
            enter = expandVertically(),
            exit = shrinkVertically()
        ) {
            content()
        }
    }
}

// Filter Chip Component
@Composable
fun FilterChip(
    text: String,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(DesignSystem.CornerRadius.round),
        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)
    ) {
        Row(
            modifier = Modifier.padding(
                horizontal = DesignSystem.Spacing.sm,
                vertical = DesignSystem.Spacing.xs
            ),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
        ) {
            Text(
                text = text,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary
            )
            
            IconButton(
                onClick = onRemove,
                modifier = Modifier.size(16.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Remove filter",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(12.dp)
                )
            }
        }
    }
}

// Empty State Component
@Composable
fun EmptyState(
    title: String,
    message: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    actionText: String? = null,
    onActionClick: (() -> Unit)? = null
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(DesignSystem.Spacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.lg)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(DesignSystem.IconSize.xxl)
        )
        
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
            
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        
        if (actionText != null && onActionClick != null) {
            PrimaryButton(
                text = actionText,
                onClick = onActionClick
            )
        }
    }
}

// List Accessory Types
sealed class ListAccessory {
    object None : ListAccessory()
    object Chevron : ListAccessory()
    data class Toggle(
        val isChecked: Boolean,
        val onCheckedChange: (Boolean) -> Unit
    ) : ListAccessory()
    data class Button(
        val text: String,
        val onClick: () -> Unit
    ) : ListAccessory()
    data class Badge(
        val text: String,
        val color: Color
    ) : ListAccessory()
}

@Preview(showBackground = true)
@Composable
fun ListComponentsPreview() {
    NearMeTheme {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
        ) {
            item {
                SectionHeader(
                    title = "Recent Tasks",
                    subtitle = "3 active reminders",
                    actionText = "See All",
                    onActionClick = {}
                )
            }
            
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = DesignSystem.Spacing.padding)
                ) {
                    Column {
                        ListItem(
                            title = "Buy groceries",
                            subtitle = "Whole Foods Market",
                            icon = Icons.Default.ShoppingCart,
                            accessory = ListAccessory.Chevron,
                            onClick = {}
                        )
                        
                        HorizontalDivider()
                        
                        ListItem(
                            title = "Enable notifications",
                            subtitle = "Get reminders when near your tasks",
                            icon = Icons.Default.Notifications,
                            accessory = ListAccessory.Toggle(
                                isChecked = false,
                                onCheckedChange = {}
                            )
                        )
                        
                        HorizontalDivider()
                        
                        ListItem(
                            title = "Premium features",
                            subtitle = "Unlock unlimited tasks",
                            icon = Icons.Default.Star,
                            iconColor = MaterialTheme.colorScheme.secondary,
                            accessory = ListAccessory.Badge(
                                text = "Pro",
                                color = MaterialTheme.colorScheme.secondary
                            ),
                            onClick = {}
                        )
                    }
                }
            }
            
            item {
                ExpandableListSection(
                    title = "Advanced Settings",
                    subtitle = "Customize your experience",
                    icon = Icons.Default.Settings
                ) {
                    Column {
                        ListItem(
                            title = "Battery optimization",
                            subtitle = "Manage location accuracy",
                            accessory = ListAccessory.Chevron
                        )
                        
                        HorizontalDivider()
                        
                        ListItem(
                            title = "Privacy settings",
                            subtitle = "Control data sharing",
                            accessory = ListAccessory.Chevron
                        )
                    }
                }
            }
            
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = DesignSystem.Spacing.padding),
                    horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
                ) {
                    FilterChip(
                        text = "Active Tasks",
                        onRemove = {}
                    )
                    FilterChip(
                        text = "Grocery Stores",
                        onRemove = {}
                    )
                }
            }
            
            item {
                EmptyState(
                    title = "No Tasks Yet",
                    message = "Create your first task to get started with location-based reminders.",
                    icon = Icons.Default.CheckCircle,
                    actionText = "Create Task",
                    onActionClick = {}
                )
            }
        }
    }
}