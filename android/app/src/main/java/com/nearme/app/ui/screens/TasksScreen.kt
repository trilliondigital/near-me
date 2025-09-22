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

enum class TaskFilter(val title: String) {
    All("All"),
    Active("Active"),
    Completed("Completed"),
    Muted("Muted")
}

enum class TaskSortOption(val title: String) {
    CreatedDate("Created Date"),
    DueDate("Due Date"),
    Title("Title"),
    Location("Location")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TasksScreen() {
    var tasks by remember { mutableStateOf(emptyList<Task>()) }
    var isLoading by remember { mutableStateOf(false) }
    var searchText by remember { mutableStateOf("") }
    var selectedFilter by remember { mutableStateOf(TaskFilter.All) }
    var sortOption by remember { mutableStateOf(TaskSortOption.CreatedDate) }
    
    val filteredTasks = remember(tasks, searchText, selectedFilter, sortOption) {
        tasks.filter { task ->
            val matchesSearch = searchText.isEmpty() || 
                task.title.contains(searchText, ignoreCase = true) ||
                task.description.contains(searchText, ignoreCase = true) ||
                task.locationName.contains(searchText, ignoreCase = true)
            
            val matchesFilter = when (selectedFilter) {
                TaskFilter.All -> true
                TaskFilter.Active -> task.status == TaskStatus.Active
                TaskFilter.Completed -> task.status == TaskStatus.Completed
                TaskFilter.Muted -> task.status == TaskStatus.Muted
            }
            
            matchesSearch && matchesFilter
        }.sortedWith { a, b ->
            when (sortOption) {
                TaskSortOption.CreatedDate -> b.createdAt.compareTo(a.createdAt)
                TaskSortOption.DueDate -> {
                    val aDue = a.dueDate ?: Long.MAX_VALUE
                    val bDue = b.dueDate ?: Long.MAX_VALUE
                    aDue.compareTo(bDue)
                }
                TaskSortOption.Title -> a.title.compareTo(b.title, ignoreCase = true)
                TaskSortOption.Location -> a.locationName.compareTo(b.locationName, ignoreCase = true)
            }
        }
    }
    
    LaunchedEffect(Unit) {
        isLoading = true
        // TODO: Load tasks from backend
        tasks = listOf(
            Task(
                id = "1",
                title = "Buy groceries",
                description = "Pick up milk, bread, and eggs",
                locationId = "loc1",
                locationName = "Whole Foods Market",
                status = TaskStatus.Active,
                createdAt = System.currentTimeMillis(),
                dueDate = null
            ),
            Task(
                id = "2",
                title = "Drop off package",
                description = "Return Amazon package at UPS store",
                locationId = "loc2",
                locationName = "UPS Store",
                status = TaskStatus.Completed,
                createdAt = System.currentTimeMillis() - 86400000,
                dueDate = null
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
                    text = "Tasks",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold
                )
            },
            actions = {
                IconButton(onClick = { /* Create task */ }) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Create Task"
                    )
                }
            }
        )
        
        // Search and Filter Section
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Surface)
                .padding(DesignSystem.Spacing.md),
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
        ) {
            SearchField(
                value = searchText,
                onValueChange = { searchText = it },
                placeholder = "Search tasks..."
            )
            
            // Filter Chips
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
            ) {
                TaskFilter.values().forEach { filter ->
                    FilterChip(
                        onClick = { selectedFilter = filter },
                        label = { Text(filter.title) },
                        selected = selectedFilter == filter,
                        modifier = Modifier.height(32.dp)
                    )
                }
            }
            
            // Sort Option
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
            ) {
                Text(
                    text = "Sort by:",
                    style = MaterialTheme.typography.labelMedium,
                    color = TextSecondary
                )
                
                PickerField(
                    label = "",
                    selectedValue = sortOption,
                    onValueChange = { sortOption = it },
                    options = TaskSortOption.values().toList(),
                    optionLabel = { it.title },
                    modifier = Modifier.weight(1f)
                )
            }
        }
        
        // Tasks List
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
                        text = "Loading tasks...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )
                }
            }
        } else if (filteredTasks.isEmpty()) {
            EnhancedEmptyStateView(
                config = getEmptyStateConfig(
                    searchText = searchText,
                    selectedFilter = selectedFilter,
                    isFirstTimeUser = tasks.isEmpty() && searchText.isEmpty() && selectedFilter == TaskFilter.All
                )
            )
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(DesignSystem.Spacing.md),
                verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
            ) {
                items(filteredTasks) { task ->
                    TaskCard(
                        title = task.title,
                        description = task.description,
                        location = task.locationName,
                        status = when (task.status) {
                            TaskStatus.Active -> TaskStatus.Active
                            TaskStatus.Completed -> TaskStatus.Completed
                            TaskStatus.Muted -> TaskStatus.Muted
                        },
                        onClick = { /* Navigate to task detail */ }
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

data class Task(
    val id: String,
    val title: String,
    val description: String,
    val locationId: String,
    val locationName: String,
    val status: TaskStatus,
    val createdAt: Long,
    val dueDate: Long?
)

enum class TaskStatus {
    Active, Completed, Muted
}

fun getEmptyStateConfig(
    searchText: String,
    selectedFilter: TaskFilter,
    isFirstTimeUser: Boolean
): EmptyStateConfig {
    return when {
        searchText.isNotEmpty() -> EmptyStates.noSearchResults(
            searchTerm = searchText,
            onClearSearch = { /* Clear search */ },
            onCreateTask = { /* Create task */ }
        )
        selectedFilter != TaskFilter.All -> EmptyStates.noFilteredResults(
            filterName = selectedFilter.title,
            onClearFilters = { /* Clear filters */ },
            onCreateTask = { /* Create task */ }
        )
        isFirstTimeUser -> EmptyStates.noTasksFirstTime(
            onCreateTask = { /* Create task */ },
            onViewExamples = { /* Show examples */ },
            onLearnMore = { /* Show education */ }
        )
        else -> EmptyStates.noTasksReturning(
            onCreateTask = { /* Create task */ },
            onViewCompleted = { /* Show completed */ }
        )
    }
}

@Preview(showBackground = true)
@Composable
fun TasksScreenPreview() {
    NearMeTheme {
        TasksScreen()
    }
}
