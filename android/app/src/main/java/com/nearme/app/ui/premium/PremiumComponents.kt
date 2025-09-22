package com.nearme.app.ui.premium

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.nearme.app.models.*

// MARK: - Premium Badge
@Composable
fun PremiumBadge(
    status: PremiumStatus,
    size: BadgeSize = BadgeSize.MEDIUM,
    modifier: Modifier = Modifier
) {
    val backgroundColor = when (status) {
        PremiumStatus.FREE -> MaterialTheme.colorScheme.secondary
        PremiumStatus.TRIAL -> MaterialTheme.colorScheme.tertiary
        PremiumStatus.PREMIUM -> Color(0xFF6366F1) // Premium purple
    }
    
    Text(
        text = status.displayName.uppercase(),
        style = when (size) {
            BadgeSize.SMALL -> MaterialTheme.typography.labelSmall
            BadgeSize.MEDIUM -> MaterialTheme.typography.labelMedium
            BadgeSize.LARGE -> MaterialTheme.typography.labelLarge
        },
        fontWeight = FontWeight.Bold,
        color = Color.White,
        modifier = modifier
            .background(
                color = backgroundColor,
                shape = RoundedCornerShape(size.cornerRadius)
            )
            .padding(size.padding)
    )
}

enum class BadgeSize(
    val cornerRadius: Int,
    val padding: PaddingValues
) {
    SMALL(4, PaddingValues(horizontal = 6.dp, vertical = 2.dp)),
    MEDIUM(6, PaddingValues(horizontal = 8.dp, vertical = 4.dp)),
    LARGE(8, PaddingValues(horizontal = 12.dp, vertical = 6.dp))
}

// MARK: - Task Limit Progress
@Composable
fun TaskLimitProgress(
    status: TaskLimitStatus,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Active Tasks",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                
                if (status.isPremium) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.AllInclusive,
                            contentDescription = "Unlimited",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = "Unlimited",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                } else {
                    Text(
                        text = "${status.currentCount}/${status.maxCount}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (status.warningThreshold) {
                            MaterialTheme.colorScheme.error
                        } else {
                            MaterialTheme.colorScheme.onSurface
                        }
                    )
                }
            }
            
            if (!status.isPremium) {
                LinearProgressIndicator(
                    progress = status.progressPercentage,
                    modifier = Modifier.fillMaxWidth(),
                    color = if (status.warningThreshold) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.primary
                    }
                )
                
                when {
                    status.isAtLimit -> {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Warning,
                                contentDescription = "Warning",
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = "Task limit reached",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                    status.warningThreshold -> {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.Info,
                                contentDescription = "Info",
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = "${status.remainingTasks} task remaining",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Premium Feature Row
@Composable
fun PremiumFeatureRow(
    feature: PremiumFeature,
    isAvailable: Boolean,
    modifier: Modifier = Modifier
) {
    val icon = when (feature) {
        PremiumFeature.UNLIMITED_TASKS -> Icons.Default.AllInclusive
        PremiumFeature.CUSTOM_NOTIFICATION_SOUNDS -> Icons.Default.VolumeUp
        PremiumFeature.DETAILED_NOTIFICATIONS -> Icons.Default.NotificationsActive
        PremiumFeature.ADVANCED_GEOFENCING -> Icons.Default.LocationOn
        PremiumFeature.PRIORITY_SUPPORT -> Icons.Default.HeadsetMic
        PremiumFeature.EXPORT_DATA -> Icons.Default.FileUpload
    }
    
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = feature.displayName,
            tint = if (isAvailable) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant
            },
            modifier = Modifier.size(24.dp)
        )
        
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = feature.displayName,
                style = MaterialTheme.typography.titleMedium,
                color = if (isAvailable) {
                    MaterialTheme.colorScheme.onSurface
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )
            
            Text(
                text = feature.description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        
        Icon(
            imageVector = if (isAvailable) {
                Icons.Default.CheckCircle
            } else {
                Icons.Default.Lock
            },
            contentDescription = if (isAvailable) "Available" else "Locked",
            tint = if (isAvailable) {
                Color(0xFF10B981) // Green
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant
            },
            modifier = Modifier.size(20.dp)
        )
    }
}

// MARK: - Upgrade Prompt Card
@Composable
fun UpgradePromptCard(
    onUpgrade: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        ),
        border = BorderStroke(
            width = 1.dp,
            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = "Upgrade to Premium",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    
                    Text(
                        text = "Unlock unlimited tasks and premium features",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.size(24.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Dismiss",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = onUpgrade,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Learn More")
                }
                
                Button(
                    onClick = onUpgrade,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Upgrade Now")
                }
            }
        }
    }
}

// MARK: - Task Limit Alert Dialog
@Composable
fun TaskLimitAlertDialog(
    onUpgrade: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        icon = {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = "Warning",
                tint = MaterialTheme.colorScheme.error
            )
        },
        title = {
            Text(
                text = "Task Limit Reached",
                textAlign = TextAlign.Center
            )
        },
        text = {
            Text(
                text = "Free users are limited to 3 active tasks. Upgrade to Premium for unlimited tasks and more features.",
                textAlign = TextAlign.Center
            )
        },
        confirmButton = {
            Button(onClick = onUpgrade) {
                Text("Upgrade to Premium")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Maybe Later")
            }
        }
    )
}

// MARK: - Feature Lock Overlay
@Composable
fun FeatureLockOverlay(
    feature: PremiumFeature,
    onUpgrade: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Column(
            modifier = Modifier.padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Lock,
                contentDescription = "Locked",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(48.dp)
            )
            
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Premium Feature",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                
                Text(
                    text = feature.displayName,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                
                Text(
                    text = feature.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
            }
            
            Button(
                onClick = onUpgrade,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Upgrade to Premium")
            }
        }
    }
}

// MARK: - Previews
@Preview(showBackground = true)
@Composable
fun PremiumComponentsPreview() {
    MaterialTheme {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            PremiumBadge(status = PremiumStatus.PREMIUM)
            
            TaskLimitProgress(
                status = TaskLimitStatus(
                    currentCount = 2,
                    maxCount = 3,
                    isPremium = false
                )
            )
            
            PremiumFeatureRow(
                feature = PremiumFeature.UNLIMITED_TASKS,
                isAvailable = false
            )
            
            UpgradePromptCard(
                onUpgrade = {},
                onDismiss = {}
            )
        }
    }
}