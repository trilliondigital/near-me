package com.nearme.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.text.style.FontStyle
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.nearme.app.ui.theme.*

// MARK: - Enhanced Seed Task Examples
@Composable
fun SeedTaskExamples(
    onTasksSelected: (List<SeedTask>) -> Unit,
    onSkip: () -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedExamples by remember { mutableStateOf(setOf<String>()) }
    var selectedCategory by remember { mutableStateOf(TaskCategory.Popular) }
    var showingEducation by remember { mutableStateOf(false) }
    
    Column(
        modifier = modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.lg)
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = DesignSystem.Spacing.md),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
            ) {
                Text(
                    text = "Quick Start Examples",
                    style = MaterialTheme.typography.headlineSmall,
                    color = TextPrimary,
                    fontWeight = FontWeight.SemiBold
                )
                
                Text(
                    text = "Choose tasks to see how Near Me works",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary
                )
            }
            
            IconButton(
                onClick = { showingEducation = true }
            ) {
                Icon(
                    imageVector = Icons.Default.Help,
                    contentDescription = "Learn more",
                    tint = Primary
                )
            }
        }
        
        // Category Selector
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm),
            contentPadding = PaddingValues(horizontal = DesignSystem.Spacing.md)
        ) {
            items(TaskCategory.values()) { category ->
                CategoryChip(
                    title = category.title,
                    icon = category.icon,
                    isSelected = selectedCategory == category,
                    onTap = { selectedCategory = category }
                )
            }
        }
        
        // Task List
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md),
            contentPadding = PaddingValues(horizontal = DesignSystem.Spacing.md)
        ) {
            items(getCategorizedTasks()[selectedCategory] ?: emptyList()) { task ->
                EnhancedSeedTaskCard(
                    task = task,
                    isSelected = selectedExamples.contains(task.id),
                    onToggle = {
                        selectedExamples = if (selectedExamples.contains(task.id)) {
                            selectedExamples - task.id
                        } else {
                            selectedExamples + task.id
                        }
                    }
                )
            }
        }
        
        // Selection Summary
        if (selectedExamples.isNotEmpty()) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = DesignSystem.Spacing.md),
                colors = CardDefaults.cardColors(
                    containerColor = Success.copy(alpha = 0.1f)
                ),
                shape = RoundedCornerShape(DesignSystem.CornerRadius.md),
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    Success.copy(alpha = 0.3f)
                )
            ) {
                Column(
                    modifier = Modifier.padding(DesignSystem.Spacing.md),
                    verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
                        ) {
                            Text(
                                text = "Ready to Add",
                                style = MaterialTheme.typography.bodyLarge,
                                color = TextPrimary,
                                fontWeight = FontWeight.Medium
                            )
                            
                            Text(
                                text = "${selectedExamples.size} example tasks selected",
                                style = MaterialTheme.typography.labelMedium,
                                color = TextSecondary
                            )
                        }
                        
                        TextButton(
                            onClick = { selectedExamples = emptySet() }
                        ) {
                            Text(
                                text = "Clear All",
                                style = MaterialTheme.typography.labelMedium,
                                color = TextSecondary
                            )
                        }
                    }
                    
                    PrimaryButton(
                        text = "Add ${selectedExamples.size} Tasks",
                        onClick = {
                            val selectedTasks = getAllTasks().filter { 
                                selectedExamples.contains(it.id) 
                            }
                            onTasksSelected(selectedTasks)
                        },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
        
        // Skip option
        TextButton(
            onClick = onSkip,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = DesignSystem.Spacing.md)
        ) {
            Text(
                text = "Skip Examples",
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary
            )
        }
    }
    
    // Education Dialog
    if (showingEducation) {
        // Show education flow
        // This would typically be a full-screen dialog or navigation
        showingEducation = false
    }
}

// MARK: - Task Category
enum class TaskCategory(val title: String, val icon: ImageVector) {
    Popular("Popular", Icons.Default.Star),
    Errands("Errands", Icons.Default.ShoppingBag),
    Health("Health", Icons.Default.Favorite),
    Work("Work", Icons.Default.Work),
    Home("Home", Icons.Default.Home)
}

// MARK: - Category Chip
@Composable
fun CategoryChip(
    title: String,
    icon: ImageVector,
    isSelected: Boolean,
    onTap: () -> Unit,
    modifier: Modifier = Modifier
) {
    FilterChip(
        onClick = onTap,
        label = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Medium
                )
            }
        },
        selected = isSelected,
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

// MARK: - Enhanced Seed Task Card
@Composable
fun EnhancedSeedTaskCard(
    task: SeedTask,
    isSelected: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onToggle() },
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) Primary.copy(alpha = 0.05f) else Card
        ),
        shape = RoundedCornerShape(DesignSystem.CornerRadius.md),
        border = androidx.compose.foundation.BorderStroke(
            width = if (isSelected) 2.dp else 1.dp,
            color = if (isSelected) Primary else Border
        )
    ) {
        Row(
            modifier = Modifier.padding(DesignSystem.Spacing.md),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
        ) {
            // Icon
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(if (isSelected) Primary else Surface),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = task.icon,
                    contentDescription = null,
                    tint = if (isSelected) TextInverse else Primary,
                    modifier = Modifier.size(24.dp)
                )
            }
            
            // Content
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = task.title,
                        style = MaterialTheme.typography.bodyLarge,
                        color = TextPrimary,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.weight(1f)
                    )
                    
                    if (isSelected) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = "Selected",
                            tint = Success,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
                
                Text(
                    text = task.description,
                    style = MaterialTheme.typography.labelLarge,
                    color = TextSecondary
                )
                
                Text(
                    text = task.explanation,
                    style = MaterialTheme.typography.labelMedium,
                    color = TextTertiary,
                    fontStyle = FontStyle.Italic
                )
            }
        }
    }
}

// MARK: - Seed Task Model
data class SeedTask(
    val id: String,
    val title: String,
    val description: String,
    val locationType: String, // This would map to your location type enum
    val icon: ImageVector,
    val explanation: String
)

// MARK: - Task Data
fun getCategorizedTasks(): Map<TaskCategory, List<SeedTask>> {
    return mapOf(
        TaskCategory.Popular to listOf(
            SeedTask(
                id = "grocery-popular",
                title = "Buy groceries",
                description = "Pick up milk, bread, and eggs",
                locationType = "grocery",
                icon = Icons.Default.ShoppingCart,
                explanation = "Get reminded at any grocery store when you need to shop"
            ),
            SeedTask(
                id = "gas-popular",
                title = "Get gas ⛽️",
                description = "Fill up the tank",
                locationType = "gas",
                icon = Icons.Default.LocalGasStation,
                explanation = "Never drive past a gas station when you need fuel"
            ),
            SeedTask(
                id = "pharmacy-popular",
                title = "Pick up prescription",
                description = "Get medication from pharmacy",
                locationType = "pharmacy",
                icon = Icons.Default.LocalPharmacy,
                explanation = "Remember to get your prescription at any pharmacy"
            )
        ),
        TaskCategory.Errands to listOf(
            SeedTask(
                id = "bank-errands",
                title = "Deposit check",
                description = "Visit bank to make deposit",
                locationType = "bank",
                icon = Icons.Default.AccountBalance,
                explanation = "Get reminded when you're near any bank branch"
            ),
            SeedTask(
                id = "post-errands",
                title = "Mail package",
                description = "Send package at post office",
                locationType = "post_office",
                icon = Icons.Default.Mail,
                explanation = "Don't forget to mail items when you're near a post office"
            ),
            SeedTask(
                id = "dry-cleaning-errands",
                title = "Pick up dry cleaning",
                description = "Collect cleaned clothes",
                locationType = "custom",
                icon = Icons.Default.LocalLaundryService,
                explanation = "Set up at your specific dry cleaner location"
            )
        ),
        TaskCategory.Health to listOf(
            SeedTask(
                id = "doctor-health",
                title = "Schedule checkup",
                description = "Call to book annual physical",
                locationType = "custom",
                icon = Icons.Default.LocalHospital,
                explanation = "Remember when you're near your doctor's office"
            ),
            SeedTask(
                id = "gym-health",
                title = "Work out",
                description = "Hit the gym for exercise",
                locationType = "custom",
                icon = Icons.Default.FitnessCenter,
                explanation = "Stay motivated when you're near your gym"
            ),
            SeedTask(
                id = "vitamins-health",
                title = "Buy vitamins",
                description = "Restock supplements",
                locationType = "pharmacy",
                icon = Icons.Default.Medication,
                explanation = "Remember at any pharmacy or health store"
            )
        ),
        TaskCategory.Work to listOf(
            SeedTask(
                id = "coffee-work",
                title = "Grab coffee",
                description = "Get morning coffee",
                locationType = "custom",
                icon = Icons.Default.LocalCafe,
                explanation = "Perfect for your daily coffee shop routine"
            ),
            SeedTask(
                id = "lunch-work",
                title = "Pick up lunch",
                description = "Get food for the team",
                locationType = "custom",
                icon = Icons.Default.Restaurant,
                explanation = "Remember when you're near your favorite lunch spot"
            ),
            SeedTask(
                id = "supplies-work",
                title = "Buy office supplies",
                description = "Get pens, paper, etc.",
                locationType = "custom",
                icon = Icons.Default.Store,
                explanation = "Remember when you're near an office supply store"
            )
        ),
        TaskCategory.Home to listOf(
            SeedTask(
                id = "defrost-home",
                title = "Defrost chicken",
                description = "Take out meat for dinner",
                locationType = "home",
                icon = Icons.Default.Home,
                explanation = "Get reminded when you arrive home"
            ),
            SeedTask(
                id = "trash-home",
                title = "Take out trash",
                description = "Put bins out for pickup",
                locationType = "home",
                icon = Icons.Default.Delete,
                explanation = "Remember before you leave home"
            ),
            SeedTask(
                id = "plants-home",
                title = "Water plants",
                description = "Give plants their weekly water",
                locationType = "home",
                icon = Icons.Default.Eco,
                explanation = "Perfect for weekend home reminders"
            )
        )
    )
}

fun getAllTasks(): List<SeedTask> {
    return getCategorizedTasks().values.flatten()
}

// MARK: - Preview
@Preview(showBackground = true)
@Composable
fun SeedTaskExamplesPreview() {
    NearMeTheme {
        SeedTaskExamples(
            onTasksSelected = {},
            onSkip = {}
        )
    }
}