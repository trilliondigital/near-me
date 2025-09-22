package com.nearme.app.navigation

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.nearme.app.ui.screens.*

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    object Tasks : Screen("tasks", "Tasks", Icons.Default.List)
    object Places : Screen("places", "Places", Icons.Default.LocationOn)
    object Notifications : Screen("notifications", "Notifications", Icons.Default.Notifications)
    object Settings : Screen("settings", "Settings", Icons.Default.Settings)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainNavigation() {
    val navController = rememberNavController()
    
    Scaffold(
        bottomBar = {
            NavigationBar {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination
                
                listOf(
                    Screen.Tasks,
                    Screen.Places,
                    Screen.Notifications,
                    Screen.Settings
                ).forEach { screen ->
                    NavigationBarItem(
                        icon = { 
                            Box {
                                Icon(screen.icon, contentDescription = screen.title)
                                
                                // Add badges for tasks and notifications
                                when (screen) {
                                    Screen.Tasks -> {
                                        // Badge for active tasks count
                                        TabBarBadge(count = 3) // This would come from ViewModel
                                    }
                                    Screen.Notifications -> {
                                        // Badge for unread notifications
                                        TabBarBadge(count = 2) // This would come from ViewModel
                                    }
                                    else -> {}
                                }
                            }
                        },
                        label = { Text(screen.title) },
                        selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Tasks.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Tasks.route) {
                TasksScreen()
            }
            composable(Screen.Places.route) {
                PlacesScreen()
            }
            composable(Screen.Notifications.route) {
                NotificationsScreen()
            }
            composable(Screen.Settings.route) {
                SettingsScreen()
            }
        }
    }
}

// Tab Bar Badge Component
@Composable
fun TabBarBadge(
    count: Int,
    modifier: Modifier = Modifier
) {
    if (count > 0) {
        Surface(
            modifier = modifier
                .size(16.dp)
                .offset(x = 8.dp, y = (-8).dp),
            shape = CircleShape,
            color = MaterialTheme.colorScheme.error
        ) {
            Box(
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = if (count > 99) "99+" else count.toString(),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onError,
                    fontSize = 10.sp
                )
            }
        }
    }
}

// Modal Navigation Bar Component
@Composable
fun ModalNavigationBar(
    title: String,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    trailingContent: (@Composable () -> Unit)? = null
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = DesignSystem.Elevation.small
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(
                    horizontal = DesignSystem.Spacing.md,
                    vertical = DesignSystem.Spacing.sm
                ),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = onDismiss) {
                Text(
                    text = "Cancel",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            
            Spacer(modifier = Modifier.weight(1f))
            
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            
            Spacer(modifier = Modifier.weight(1f))
            
            if (trailingContent != null) {
                trailingContent()
            } else {
                // Invisible spacer to center title
                Spacer(modifier = Modifier.width(60.dp))
            }
        }
    }
}

// Navigation Progress Bar Component
@Composable
fun NavigationProgressBar(
    currentStep: Int,
    totalSteps: Int,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(
                horizontal = DesignSystem.Spacing.padding,
                vertical = DesignSystem.Spacing.sm
            ),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs),
            verticalAlignment = Alignment.CenterVertically
        ) {
            repeat(totalSteps) { step ->
                Surface(
                    shape = CircleShape,
                    color = if (step < currentStep) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.outline
                    },
                    modifier = Modifier.size(8.dp)
                ) {}
                
                if (step < totalSteps - 1) {
                    Box(
                        modifier = Modifier
                            .width(16.dp)
                            .height(2.dp)
                            .background(
                                color = if (step < currentStep - 1) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    MaterialTheme.colorScheme.outline
                                },
                                shape = RoundedCornerShape(1.dp)
                            )
                    )
                }
            }
        }
        
        Text(
            text = "Step $currentStep of $totalSteps",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
