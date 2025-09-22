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

enum class PlaceCategory(val title: String, val icon: String) {
    All("All", "list"),
    Gas("Gas Station", "local_gas_station"),
    Pharmacy("Pharmacy", "local_pharmacy"),
    Grocery("Grocery Store", "shopping_cart"),
    Bank("Bank", "account_balance"),
    PostOffice("Post Office", "mail"),
    Custom("Custom Places", "star")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlacesScreen() {
    var places by remember { mutableStateOf(emptyList<Place>()) }
    var isLoading by remember { mutableStateOf(false) }
    var searchText by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf(PlaceCategory.All) }
    var showMapView by remember { mutableStateOf(false) }
    
    val filteredPlaces = remember(places, searchText, selectedCategory) {
        places.filter { place ->
            val matchesSearch = searchText.isEmpty() || 
                place.name.contains(searchText, ignoreCase = true) ||
                place.address.contains(searchText, ignoreCase = true)
            
            val matchesCategory = selectedCategory == PlaceCategory.All || 
                place.category == selectedCategory.title
            
            matchesSearch && matchesCategory
        }.sortedBy { it.name }
    }
    
    LaunchedEffect(Unit) {
        isLoading = true
        // TODO: Load places from backend
        places = listOf(
            Place(
                id = "1",
                name = "Whole Foods Market",
                address = "123 Main St, San Francisco, CA",
                category = "Grocery Store",
                latitude = 37.7749,
                longitude = -122.4194,
                distance = "0.5 mi"
            ),
            Place(
                id = "2",
                name = "Shell Gas Station",
                address = "456 Oak Ave, San Francisco, CA",
                category = "Gas Station",
                latitude = 37.7849,
                longitude = -122.4094,
                distance = "1.2 mi"
            ),
            Place(
                id = "3",
                name = "CVS Pharmacy",
                address = "789 Pine St, San Francisco, CA",
                category = "Pharmacy",
                latitude = 37.7649,
                longitude = -122.4294,
                distance = "0.8 mi"
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
                    text = "Places",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold
                )
            },
            actions = {
                IconButton(onClick = { showMapView = !showMapView }) {
                    Icon(
                        imageVector = if (showMapView) Icons.Default.List else Icons.Default.Map,
                        contentDescription = if (showMapView) "List View" else "Map View"
                    )
                }
                
                IconButton(onClick = { /* Create place */ }) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Add Place"
                    )
                }
            }
        )
        
        if (showMapView) {
            // Map View Placeholder
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
                ) {
                    Icon(
                        imageVector = Icons.Default.Map,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = TextTertiary
                    )
                    Text(
                        text = "Map View",
                        style = MaterialTheme.typography.titleMedium,
                        color = TextSecondary
                    )
                    Text(
                        text = "Map integration will be implemented here",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextTertiary
                    )
                }
            }
        } else {
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
                    placeholder = "Search places..."
                )
                
                // Category Chips
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.sm)
                ) {
                    items(PlaceCategory.values()) { category ->
                        CategoryChip(
                            title = category.title,
                            icon = category.icon,
                            isSelected = selectedCategory == category,
                            onClick = { selectedCategory = category }
                        )
                    }
                }
            }
            
            // Places List
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
                            text = "Loading places...",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondary
                        )
                    }
                }
            } else if (filteredPlaces.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    EmptyStateCard(
                        icon = if (searchText.isEmpty()) "location" else "search",
                        title = if (searchText.isEmpty()) "No Places Yet" else "No Results",
                        message = if (searchText.isEmpty()) 
                            "Add places to create location-based tasks and reminders." 
                        else "No places match your search criteria.",
                        actionTitle = if (searchText.isEmpty()) "Add Place" else null,
                        onActionClick = if (searchText.isEmpty()) { /* Add place */ } else null
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(DesignSystem.Spacing.md),
                    verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
                ) {
                    items(filteredPlaces) { place ->
                        PlaceCard(
                            name = place.name,
                            address = place.address,
                            category = place.category,
                            distance = place.distance,
                            onClick = { /* Navigate to place detail */ }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun CategoryChip(
    title: String,
    icon: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    FilterChip(
        onClick = onClick,
        label = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
            ) {
                Icon(
                    imageVector = Icons.Default.Star, // Placeholder icon
                    contentDescription = null,
                    modifier = Modifier.size(12.dp)
                )
                Text(title)
            }
        },
        selected = isSelected,
        modifier = modifier.height(32.dp),
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = Primary,
            selectedLabelColor = TextInverse,
            containerColor = Surface,
            labelColor = TextPrimary
        ),
        shape = RoundedCornerShape(DesignSystem.CornerRadius.round)
    )
}

data class Place(
    val id: String,
    val name: String,
    val address: String,
    val category: String,
    val latitude: Double,
    val longitude: Double,
    val distance: String?
)

@Preview(showBackground = true)
@Composable
fun PlacesScreenPreview() {
    NearMeTheme {
        PlacesScreen()
    }
}
