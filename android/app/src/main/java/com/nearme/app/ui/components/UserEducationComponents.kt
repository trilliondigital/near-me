package com.nearme.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.unit.offset
import kotlinx.coroutines.launch
import com.nearme.app.ui.theme.*

// MARK: - User Education View
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UserEducationView(
    config: UserEducationConfig,
    onDismiss: () -> Unit
) {
    val pagerState = rememberPagerState(pageCount = { config.steps.size })
    val coroutineScope = rememberCoroutineScope()
    
    Column(
        modifier = Modifier.fillMaxSize()
    ) {
        // Top App Bar
        TopAppBar(
            title = { },
            actions = {
                TextButton(
                    onClick = {
                        config.onSkip?.invoke()
                        onDismiss()
                    }
                ) {
                    Text(
                        text = "Skip",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        )
        
        // Progress Indicator
        if (config.steps.size > 1) {
            ProgressIndicator(
                currentStep = pagerState.currentPage,
                totalSteps = config.steps.size,
                modifier = Modifier.padding(horizontal = DesignSystem.Spacing.lg)
            )
        }
        
        // Content Pager
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.weight(1f)
        ) { page ->
            EducationStepView(
                step = config.steps[page],
                isLastStep = page == config.steps.size - 1,
                onNext = {
                    if (page < config.steps.size - 1) {
                        coroutineScope.launch {
                            pagerState.animateScrollToPage(page + 1)
                        }
                    } else {
                        config.onComplete()
                        onDismiss()
                    }
                },
                onSkip = {
                    config.onSkip?.invoke()
                    onDismiss()
                }
            )
        }
    }
}

// MARK: - Education Step View
@Composable
fun EducationStepView(
    step: EducationStep,
    isLastStep: Boolean,
    onNext: () -> Unit,
    onSkip: (() -> Unit)?
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = DesignSystem.Spacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(DesignSystem.Spacing.lg))
        
        // Visual
        Box(
            modifier = Modifier.height(200.dp),
            contentAlignment = Alignment.Center
        ) {
            if (step.illustration != null) {
                step.illustration.invoke()
            } else {
                Icon(
                    imageVector = step.icon,
                    contentDescription = null,
                    tint = Primary,
                    modifier = Modifier.size(80.dp)
                )
            }
        }
        
        Spacer(modifier = Modifier.height(DesignSystem.Spacing.xl))
        
        // Content
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.lg)
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
            ) {
                Text(
                    text = step.title,
                    style = MaterialTheme.typography.headlineMedium,
                    color = TextPrimary,
                    textAlign = TextAlign.Center,
                    fontWeight = FontWeight.SemiBold
                )
                
                Text(
                    text = step.description,
                    style = MaterialTheme.typography.bodyLarge,
                    color = TextSecondary,
                    textAlign = TextAlign.Center,
                    lineHeight = MaterialTheme.typography.bodyLarge.lineHeight * 1.2
                )
            }
            
            // Interactive Demo
            step.interactiveDemo?.let { demo ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Surface),
                    shape = RoundedCornerShape(DesignSystem.CornerRadius.md)
                ) {
                    Box(
                        modifier = Modifier.padding(DesignSystem.Spacing.md),
                        contentAlignment = Alignment.Center
                    ) {
                        demo()
                    }
                }
            }
            
            // Key Points
            if (step.keyPoints.isNotEmpty()) {
                Column(
                    verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
                ) {
                    step.keyPoints.forEach { point ->
                        KeyPointRow(text = point)
                    }
                }
            }
        }
        
        Spacer(modifier = Modifier.weight(1f))
        Spacer(modifier = Modifier.height(DesignSystem.Spacing.xl))
        
        // Actions
        Column(
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
        ) {
            PrimaryButton(
                text = if (isLastStep) "Get Started" else "Continue",
                onClick = onNext,
                modifier = Modifier.fillMaxWidth()
            )
            
            if (!isLastStep && onSkip != null) {
                TextButton(
                    onClick = onSkip,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Skip Tutorial",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )
                }
            }
        }
        
        Spacer(modifier = Modifier.height(DesignSystem.Spacing.lg))
    }
}

// MARK: - Key Point Row
@Composable
fun KeyPointRow(
    text: String,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
    ) {
        Icon(
            imageVector = Icons.Default.CheckCircle,
            contentDescription = null,
            tint = Success,
            modifier = Modifier.size(20.dp)
        )
        
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium,
            color = TextPrimary,
            modifier = Modifier.weight(1f)
        )
    }
}

// MARK: - Progress Indicator
@Composable
fun ProgressIndicator(
    currentStep: Int,
    totalSteps: Int,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.padding(vertical = DesignSystem.Spacing.md),
        horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
    ) {
        repeat(totalSteps) { index ->
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(
                        if (index <= currentStep) Primary else Border
                    )
            )
        }
    }
}

// MARK: - Education Configuration
data class UserEducationConfig(
    val steps: List<EducationStep>,
    val onComplete: () -> Unit,
    val onSkip: (() -> Unit)? = null
)

data class EducationStep(
    val title: String,
    val description: String,
    val icon: ImageVector,
    val illustration: (@Composable () -> Unit)? = null,
    val keyPoints: List<String> = emptyList(),
    val interactiveDemo: (@Composable () -> Unit)? = null
)

// MARK: - Predefined Education Flows
object EducationFlows {
    fun howItWorks(onComplete: () -> Unit) = UserEducationConfig(
        steps = listOf(
            EducationStep(
                title = "Location-Based Reminders",
                description = "Near Me sends you reminders when you're near the right place to complete your tasks.",
                icon = Icons.Default.LocationOn,
                illustration = {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.lg),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.Place,
                                contentDescription = null,
                                tint = Primary,
                                modifier = Modifier.size(40.dp)
                            )
                            Text(
                                text = "Store",
                                style = MaterialTheme.typography.labelMedium,
                                color = TextSecondary
                            )
                        }
                        
                        Icon(
                            imageVector = Icons.Default.ArrowForward,
                            contentDescription = null,
                            tint = TextTertiary,
                            modifier = Modifier.size(24.dp)
                        )
                        
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.Notifications,
                                contentDescription = null,
                                tint = Warning,
                                modifier = Modifier.size(40.dp)
                            )
                            Text(
                                text = "Reminder",
                                style = MaterialTheme.typography.labelMedium,
                                color = TextSecondary
                            )
                        }
                    }
                },
                keyPoints = listOf(
                    "Get notified when approaching relevant locations",
                    "Never forget tasks when you're in the right place",
                    "Works automatically in the background"
                )
            ),
            
            EducationStep(
                title = "Smart Geofencing",
                description = "We use intelligent distance-based alerts that adapt to different types of locations.",
                icon = Icons.Default.MyLocation,
                keyPoints = listOf(
                    "5-mile alerts for category-based tasks (gas stations, pharmacies)",
                    "2-mile alerts for specific places (home, work)",
                    "Arrival and post-arrival reminders for persistence"
                )
            ),
            
            EducationStep(
                title = "Two Types of Tasks",
                description = "Create reminders for specific places you know, or for any location in a category.",
                icon = Icons.Default.List,
                keyPoints = listOf(
                    "Specific places: \"Pick up dry cleaning at Main Street Cleaners\"",
                    "Category-based: \"Get gas at any gas station\"",
                    "Perfect for both planned and opportunistic tasks"
                )
            ),
            
            EducationStep(
                title = "Privacy First",
                description = "Your location data stays on your device. We only process what's needed for reminders.",
                icon = Icons.Default.Security,
                keyPoints = listOf(
                    "No continuous GPS tracking",
                    "Location processing happens on your device",
                    "Minimal data collection with strong encryption"
                )
            )
        ),
        onComplete = onComplete
    )
    
    fun geofencingExplained(onComplete: () -> Unit) = UserEducationConfig(
        steps = listOf(
            EducationStep(
                title = "What are Geofences?",
                description = "Geofences are virtual boundaries around locations that trigger notifications when you enter or exit them.",
                icon = Icons.Default.RadioButtonUnchecked,
                keyPoints = listOf(
                    "Invisible circles around places",
                    "Trigger when you cross the boundary",
                    "Work even when the app is closed"
                )
            ),
            
            EducationStep(
                title = "Multiple Alert Zones",
                description = "Each task creates multiple geofences at different distances to give you several chances to remember.",
                icon = Icons.Default.MyLocation,
                interactiveDemo = {
                    Box(
                        modifier = Modifier.size(120.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        // Outer circle (5 miles)
                        Box(
                            modifier = Modifier
                                .size(120.dp)
                                .background(
                                    Primary.copy(alpha = 0.1f),
                                    CircleShape
                                )
                        )
                        
                        // Middle circle (3 miles)
                        Box(
                            modifier = Modifier
                                .size(80.dp)
                                .background(
                                    Primary.copy(alpha = 0.2f),
                                    CircleShape
                                )
                        )
                        
                        // Inner circle (1 mile)
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .background(
                                    Primary.copy(alpha = 0.3f),
                                    CircleShape
                                )
                        )
                        
                        // Center point
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(Primary, CircleShape)
                        )
                    }
                },
                keyPoints = listOf(
                    "Approach alerts: 5, 3, and 1 mile out",
                    "Arrival alert: When you reach the location",
                    "Post-arrival: 5 minutes after arriving"
                )
            ),
            
            EducationStep(
                title = "Battery Optimized",
                description = "Our geofencing is designed to be battery-efficient while remaining reliable.",
                icon = Icons.Default.BatteryFull,
                keyPoints = listOf(
                    "Uses system-level location services",
                    "No continuous GPS tracking",
                    "Intelligent power management"
                )
            )
        ),
        onComplete = onComplete
    )
    
    fun troubleshooting(onComplete: () -> Unit) = UserEducationConfig(
        steps = listOf(
            EducationStep(
                title = "Not Getting Notifications?",
                description = "Here are the most common issues and how to fix them.",
                icon = Icons.Default.Warning,
                keyPoints = listOf(
                    "Check that location services are enabled",
                    "Ensure notifications are allowed",
                    "Verify background app refresh is on"
                )
            ),
            
            EducationStep(
                title = "Location Settings",
                description = "Near Me needs location access to work properly in the background.",
                icon = Icons.Default.LocationOn,
                keyPoints = listOf(
                    "Go to Settings > Apps > Near Me > Permissions",
                    "Enable \"Location\" permission",
                    "Choose \"Allow all the time\" for best results"
                )
            ),
            
            EducationStep(
                title = "Notification Settings",
                description = "Make sure notifications are enabled and configured correctly.",
                icon = Icons.Default.Notifications,
                keyPoints = listOf(
                    "Go to Settings > Apps > Near Me > Notifications",
                    "Enable \"Show notifications\"",
                    "Choose your preferred notification style"
                )
            ),
            
            EducationStep(
                title = "Battery Optimization",
                description = "Disable battery optimization to ensure Near Me works reliably in the background.",
                icon = Icons.Default.BatteryAlert,
                keyPoints = listOf(
                    "Go to Settings > Battery > Battery optimization",
                    "Find Near Me and select \"Don't optimize\"",
                    "This helps maintain accurate geofences"
                )
            )
        ),
        onComplete = onComplete
    )
}

// MARK: - Preview
@Preview(showBackground = true)
@Composable
fun UserEducationComponentsPreview() {
    NearMeTheme {
        EducationStepView(
            step = EducationStep(
                title = "Location-Based Reminders",
                description = "Near Me sends you reminders when you're near the right place to complete your tasks.",
                icon = Icons.Default.LocationOn,
                keyPoints = listOf(
                    "Get notified when approaching relevant locations",
                    "Never forget tasks when you're in the right place",
                    "Works automatically in the background"
                )
            ),
            isLastStep = false,
            onNext = {},
            onSkip = {}
        )
    }
}