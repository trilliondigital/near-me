package com.nearme.app.ui.privacy

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.nearme.app.ui.components.TopAppBar
import com.nearme.app.ui.theme.NearMeTheme
import com.nearme.app.viewmodels.PrivacyViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrivacySettingsScreen(
    onNavigateBack: () -> Unit,
    onNavigateToDataExport: () -> Unit,
    viewModel: PrivacyViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    
    var showDataDeletionDialog by remember { mutableStateOf(false) }
    var confirmationText by remember { mutableStateOf("") }
    
    Column(
        modifier = Modifier.fillMaxSize()
    ) {
        TopAppBar(
            title = "Privacy & Data",
            onNavigateBack = onNavigateBack
        )
        
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Location Privacy Section
            item {
                PrivacySection(
                    title = "Location Services",
                    description = "Control how Near Me uses your location data"
                ) {
                    LocationPrivacyCard(
                        currentMode = uiState.privacySettings.locationPrivacyMode,
                        onModeChanged = viewModel::updateLocationPrivacyMode
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    LocationStatusCard(
                        locationPermissionGranted = uiState.locationPermissionGranted,
                        backgroundLocationEnabled = uiState.backgroundLocationEnabled,
                        foregroundOnlyMode = uiState.privacySettings.locationPrivacyMode == LocationPrivacyMode.FOREGROUND_ONLY
                    )
                }
            }
            
            // Data Processing Section
            item {
                PrivacySection(
                    title = "Data Processing",
                    description = "Control how your data is processed and stored"
                ) {
                    PrivacyToggleItem(
                        title = "On-Device Processing",
                        description = "Process location data locally when possible",
                        checked = uiState.privacySettings.onDeviceProcessing,
                        onCheckedChange = viewModel::updateOnDeviceProcessing,
                        icon = Icons.Default.PhoneAndroid
                    )
                    
                    PrivacyToggleItem(
                        title = "Data Minimization",
                        description = "Collect only essential data",
                        checked = uiState.privacySettings.dataMinimization,
                        onCheckedChange = viewModel::updateDataMinimization,
                        icon = Icons.Default.DataUsage
                    )
                    
                    LocationHistoryRetentionCard(
                        currentRetention = uiState.privacySettings.locationHistoryRetention,
                        onRetentionChanged = viewModel::updateLocationHistoryRetention
                    )
                }
            }
            
            // Data Management Section
            item {
                PrivacySection(
                    title = "Data Management",
                    description = "Export or delete your personal data"
                ) {
                    PrivacyActionItem(
                        title = "Export My Data",
                        description = "Download a copy of your data",
                        icon = Icons.Default.FileDownload,
                        onClick = onNavigateToDataExport
                    )
                    
                    PrivacyActionItem(
                        title = "Delete My Data",
                        description = "Permanently delete all your data",
                        icon = Icons.Default.Delete,
                        onClick = { showDataDeletionDialog = true },
                        isDestructive = true
                    )
                }
            }
            
            // Analytics Section
            item {
                PrivacySection(
                    title = "Analytics & Reporting",
                    description = "Control data collection for app improvement"
                ) {
                    PrivacyToggleItem(
                        title = "Opt Out of Analytics",
                        description = "Disable anonymous usage analytics",
                        checked = uiState.privacySettings.analyticsOptOut,
                        onCheckedChange = viewModel::updateAnalyticsOptOut,
                        icon = Icons.Default.Analytics
                    )
                    
                    PrivacyToggleItem(
                        title = "Opt Out of Crash Reporting",
                        description = "Disable automatic crash reports",
                        checked = uiState.privacySettings.crashReportingOptOut,
                        onCheckedChange = viewModel::updateCrashReportingOptOut,
                        icon = Icons.Default.BugReport
                    )
                }
            }
        }
    }
    
    // Data Deletion Confirmation Dialog
    if (showDataDeletionDialog) {
        AlertDialog(
            onDismissRequest = { 
                showDataDeletionDialog = false
                confirmationText = ""
            },
            title = { Text("Delete All Data") },
            text = {
                Column {
                    Text("This will permanently delete all your data including tasks, places, and location history. This action cannot be undone.")
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    OutlinedTextField(
                        value = confirmationText,
                        onValueChange = { confirmationText = it },
                        label = { Text("Type DELETE to confirm") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteUserData(confirmationText)
                        showDataDeletionDialog = false
                        confirmationText = ""
                    },
                    enabled = confirmationText.uppercase() == "DELETE"
                ) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { 
                        showDataDeletionDialog = false
                        confirmationText = ""
                    }
                ) {
                    Text("Cancel")
                }
            }
        )
    }
    
    // Show loading or error states
    if (uiState.isLoading) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator()
        }
    }
    
    uiState.error?.let { error ->
        LaunchedEffect(error) {
            // Show error snackbar
        }
    }
}

@Composable
private fun PrivacySection(
    title: String,
    description: String,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp, bottom = 16.dp)
            )
            
            content()
        }
    }
}

@Composable
private fun LocationPrivacyCard(
    currentMode: LocationPrivacyMode,
    onModeChanged: (LocationPrivacyMode) -> Unit
) {
    Column {
        Text(
            text = "Location Privacy Mode",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Medium
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        LocationPrivacyMode.values().forEach { mode ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                RadioButton(
                    selected = currentMode == mode,
                    onClick = { onModeChanged(mode) }
                )
                
                Column(
                    modifier = Modifier.padding(start = 8.dp)
                ) {
                    Text(
                        text = mode.displayName,
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Text(
                        text = mode.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
        
        if (currentMode == LocationPrivacyMode.FOREGROUND_ONLY) {
            Spacer(modifier = Modifier.height(8.dp))
            
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                )
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.size(20.dp)
                    )
                    
                    Column(
                        modifier = Modifier.padding(start = 8.dp)
                    ) {
                        Text(
                            text = "Limited Functionality",
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = "Foreground-only mode will disable background location reminders. You'll only receive notifications when the app is open.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun LocationStatusCard(
    locationPermissionGranted: Boolean,
    backgroundLocationEnabled: Boolean,
    foregroundOnlyMode: Boolean
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = when {
                    !locationPermissionGranted -> Icons.Default.LocationOff
                    foregroundOnlyMode -> Icons.Default.LocationSearching
                    backgroundLocationEnabled -> Icons.Default.LocationOn
                    else -> Icons.Default.LocationSearching
                },
                contentDescription = null,
                tint = when {
                    !locationPermissionGranted -> MaterialTheme.colorScheme.error
                    foregroundOnlyMode -> MaterialTheme.colorScheme.primary
                    backgroundLocationEnabled -> MaterialTheme.colorScheme.primary
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                }
            )
            
            Column(
                modifier = Modifier.padding(start = 12.dp)
            ) {
                Text(
                    text = "Location Status",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = when {
                        !locationPermissionGranted -> "Location access denied"
                        foregroundOnlyMode -> "Foreground only (privacy mode active)"
                        backgroundLocationEnabled -> "Full location access"
                        else -> "Limited location access"
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun LocationHistoryRetentionCard(
    currentRetention: Int,
    onRetentionChanged: (Int) -> Unit
) {
    Column {
        Text(
            text = "Location History Retention",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Medium
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        val retentionOptions = listOf(7, 30, 90, 365)
        val retentionLabels = listOf("7 days", "30 days", "90 days", "1 year")
        
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            retentionOptions.forEachIndexed { index, days ->
                FilterChip(
                    onClick = { onRetentionChanged(days) },
                    label = { Text(retentionLabels[index]) },
                    selected = currentRetention == days
                )
            }
        }
    }
}

@Composable
private fun PrivacyToggleItem(
    title: String,
    description: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(24.dp)
        )
        
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 12.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange
        )
    }
}

@Composable
private fun PrivacyActionItem(
    title: String,
    description: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
    isDestructive: Boolean = false
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = if (isDestructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(24.dp)
            )
            
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 12.dp)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    color = if (isDestructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

enum class LocationPrivacyMode(val displayName: String, val description: String) {
    STANDARD("Standard", "Location services work in background for reliable reminders"),
    FOREGROUND_ONLY("Foreground Only", "Location services only work when app is open")
}