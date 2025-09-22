package com.nearme.app.ui.onboarding

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.nearme.app.models.*

@Composable
fun WelcomeScreen() {
    OnboardingPageTemplate(
        title = "Welcome to Near Me",
        subtitle = "The reminder that meets you where you are"
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(32.dp)
        ) {
            // Hero Icon
            Icon(
                imageVector = Icons.Default.LocationOn,
                contentDescription = null,
                modifier = Modifier.size(120.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "Never forget another errand",
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center
                )
                
                Text(
                    text = "Get gentle reminders for your tasks when you're near the right places to complete them.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

@Composable
fun ConceptScreen() {
    OnboardingPageTemplate(
        title = "How It Works",
        subtitle = "Smart reminders based on your location"
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(32.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
                ConceptStep(
                    icon = Icons.Default.Add,
                    title = "Create Tasks",
                    description = "Add reminders for things you need to do at specific places or categories of places."
                )
                
                ConceptStep(
                    icon = Icons.Default.LocationOn,
                    title = "We Watch Your Location",
                    description = "When you're approaching or arriving at relevant places, we'll gently remind you."
                )
                
                ConceptStep(
                    icon = Icons.Default.Check,
                    title = "Complete & Forget",
                    description = "Mark tasks as done or snooze them. We'll keep reminding until you're ready."
                )
            }
            
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Example:",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
                
                ExampleNotificationCard()
            }
        }
    }
}

@Composable
fun PermissionsScreen(
    locationPermissionGranted: Boolean,
    notificationPermissionGranted: Boolean,
    onLocationPermissionRequest: () -> Unit,
    onNotificationPermissionRequest: () -> Unit
) {
    OnboardingPageTemplate(
        title = "Permissions",
        subtitle = "We need a couple of permissions to work properly"
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
            PermissionCard(
                icon = Icons.Default.LocationOn,
                title = "Location Access",
                description = "We use your location to know when you're near places where you have tasks to complete.",
                isGranted = locationPermissionGranted,
                onRequest = onLocationPermissionRequest
            )
            
            PermissionCard(
                icon = Icons.Default.Notifications,
                title = "Notifications",
                description = "We'll send you gentle reminders when you're near relevant places.",
                isGranted = notificationPermissionGranted,
                onRequest = onNotificationPermissionRequest
            )
            
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Privacy First",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    
                    Text(
                        text = "Your location data stays on your device. We only use it to determine when to send reminders.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

@Composable
fun PreferencesScreen(
    preferences: NotificationPreferences,
    onPreferencesUpdate: (NotificationPreferences) -> Unit
) {
    OnboardingPageTemplate(
        title = "Notification Preferences",
        subtitle = "Customize when and how you receive reminders"
    ) {
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                PreferenceToggle(
                    title = "Approach Notifications",
                    description = "Get notified when you're getting close (1-5 miles away)",
                    checked = preferences.approachNotifications,
                    onCheckedChange = { 
                        onPreferencesUpdate(preferences.copy(approachNotifications = it))
                    }
                )
            }
            
            item {
                PreferenceToggle(
                    title = "Arrival Notifications",
                    description = "Get notified when you arrive at a location",
                    checked = preferences.arrivalNotifications,
                    onCheckedChange = { 
                        onPreferencesUpdate(preferences.copy(arrivalNotifications = it))
                    }
                )
            }
            
            item {
                PreferenceToggle(
                    title = "Post-Arrival Reminders",
                    description = "Get reminded if you haven't completed a task after 5 minutes",
                    checked = preferences.postArrivalNotifications,
                    onCheckedChange = { 
                        onPreferencesUpdate(preferences.copy(postArrivalNotifications = it))
                    }
                )
            }
            
            item {
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            }
            
            item {
                PreferenceToggle(
                    title = "Quiet Hours",
                    description = "Pause notifications during specific hours",
                    checked = preferences.quietHoursEnabled,
                    onCheckedChange = { 
                        onPreferencesUpdate(preferences.copy(quietHoursEnabled = it))
                    }
                )
            }
            
            if (preferences.quietHoursEnabled) {
                item {
                    QuietHoursSelector(
                        startTime = preferences.quietStartTime,
                        endTime = preferences.quietEndTime,
                        weekendQuietHours = preferences.weekendQuietHours,
                        onStartTimeChange = { 
                            onPreferencesUpdate(preferences.copy(quietStartTime = it))
                        },
                        onEndTimeChange = { 
                            onPreferencesUpdate(preferences.copy(quietEndTime = it))
                        },
                        onWeekendQuietHoursChange = { 
                            onPreferencesUpdate(preferences.copy(weekendQuietHours = it))
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun LocationsScreen(
    locations: List<CommonLocation>,
    onLocationAdd: (CommonLocation) -> Unit,
    onLocationRemove: (CommonLocation) -> Unit
) {
    var showLocationPicker by remember { mutableStateOf(false) }
    var selectedLocationType by remember { mutableStateOf(LocationType.HOME) }
    
    OnboardingPageTemplate(
        title = "Common Locations",
        subtitle = "Tell us about places you visit regularly"
    ) {
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(
                        text = "Quick Add",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.height(200.dp)
                    ) {
                        items(listOf(LocationType.HOME, LocationType.WORK, LocationType.GYM, LocationType.GROCERY)) { type ->
                            QuickAddLocationButton(
                                type = type,
                                isAdded = locations.any { it.type == type },
                                onClick = {
                                    selectedLocationType = type
                                    showLocationPicker = true
                                }
                            )
                        }
                    }
                }
            }
            
            if (locations.isNotEmpty()) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(
                            text = "Your Locations",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
                
                items(locations) { location ->
                    LocationRow(
                        location = location,
                        onDelete = { onLocationRemove(location) }
                    )
                }
            }
            
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "You can add locations later",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center
                        )
                        
                        Text(
                            text = "Don't worry, you can always add or edit locations in the app settings.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }
    }
    
    if (showLocationPicker) {
        LocationPickerDialog(
            locationType = selectedLocationType,
            onLocationSelected = { location ->
                onLocationAdd(location)
                showLocationPicker = false
            },
            onDismiss = { showLocationPicker = false }
        )
    }
}

@Composable
fun CategoriesScreen(
    categories: List<TaskCategory>,
    onCategoryToggle: (String) -> Unit
) {
    OnboardingPageTemplate(
        title = "Task Categories",
        subtitle = "What types of tasks do you want reminders for?"
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.height(400.dp)
            ) {
                items(TaskCategory.defaultCategories) { category ->
                    val isSelected = categories.find { it.id == category.id }?.isSelected ?: false
                    CategorySelectionCard(
                        category = category,
                        isSelected = isSelected,
                        onClick = { onCategoryToggle(category.id) }
                    )
                }
            }
            
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Select all that apply",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                    
                    Text(
                        text = "You can change these preferences anytime in settings.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

@Composable
fun PreviewScreen() {
    OnboardingPageTemplate(
        title = "Preview",
        subtitle = "Here's how notifications will appear"
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(32.dp)) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                NotificationPreviewCard(
                    type = NotificationType.APPROACH,
                    title = "You're 2 miles from Whole Foods",
                    subtitle = "Pick up groceries?"
                )
                
                NotificationPreviewCard(
                    type = NotificationType.ARRIVAL,
                    title = "Arriving at CVS Pharmacy",
                    subtitle = "Pick up prescription now?"
                )
                
                NotificationPreviewCard(
                    type = NotificationType.POST_ARRIVAL,
                    title = "Still at the bank",
                    subtitle = "Still need to deposit check?"
                )
            }
            
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedButton(
                    onClick = { /* TODO: Show test notification */ },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("See Live Preview")
                }
                
                Card(
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = "Notification Features",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            FeatureBullet("Complete tasks directly from notifications")
                            FeatureBullet("Snooze for 15 minutes, 1 hour, or until tomorrow")
                            FeatureBullet("Open maps to get directions")
                            FeatureBullet("Mute specific tasks when needed")
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CompleteScreen(
    onComplete: () -> Unit
) {
    var showSoftPaywall by remember { mutableStateOf(false) }
    
    OnboardingPageTemplate(
        title = "All Set!",
        subtitle = "You're ready to start using Near Me"
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(32.dp)
        ) {
            // Success Icon
            Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = null,
                modifier = Modifier.size(80.dp),
                tint = MaterialTheme.colorScheme.primary
            )
            
            Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Quick Start Ideas",
                        style = MaterialTheme.typography.headlineSmall,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        SeedTaskSuggestion(
                            icon = Icons.Default.ShoppingCart,
                            task = "Pick up groceries",
                            location = "Grocery stores"
                        )
                        
                        SeedTaskSuggestion(
                            icon = Icons.Default.LocalGasStation,
                            task = "Fill up gas tank",
                            location = "Gas stations"
                        )
                        
                        SeedTaskSuggestion(
                            icon = Icons.Default.Mail,
                            task = "Mail package",
                            location = "Post offices"
                        )
                    }
                }
                
                OutlinedButton(
                    onClick = { showSoftPaywall = true },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Try Premium Features")
                }
            }
        }
    }
    
    if (showSoftPaywall) {
        SoftPaywallDialog(
            onDismiss = { showSoftPaywall = false },
            onStartTrial = { 
                showSoftPaywall = false
                // TODO: Start trial
            }
        )
    }
}

// Supporting Composables
@Composable
fun OnboardingPageTemplate(
    title: String,
    subtitle: String,
    content: @Composable () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.spacedBy(32.dp)
    ) {
        item {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    textAlign = TextAlign.Center
                )
                
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
            }
        }
        
        item {
            content()
        }
        
        item {
            Spacer(modifier = Modifier.height(64.dp))
        }
    }
}

@Composable
fun ConceptStep(
    icon: ImageVector,
    title: String,
    description: String
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalAlignment = Alignment.Top
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(24.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
            
            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}