package com.nearme.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.nearme.app.ui.theme.*

// Map Control Components
@Composable
fun MapControlsOverlay(
    onLocationClick: () -> Unit,
    onZoomIn: () -> Unit,
    onZoomOut: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(DesignSystem.Spacing.md),
        verticalArrangement = Arrangement.Top,
        horizontalAlignment = Alignment.End
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
        ) {
            MapControlButton(
                icon = Icons.Default.MyLocation,
                onClick = onLocationClick
            )
            MapControlButton(
                icon = Icons.Default.Add,
                onClick = onZoomIn
            )
            MapControlButton(
                icon = Icons.Default.Remove,
                onClick = onZoomOut
            )
        }
    }
}

@Composable
fun MapControlButton(
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    FilledIconButton(
        onClick = onClick,
        modifier = modifier
            .size(DesignSystem.Map.controlButtonSize)
            .shadow(
                elevation = DesignSystem.Elevation.medium,
                shape = CircleShape
            ),
        colors = IconButtonDefaults.filledIconButtonColors(
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.onSurface
        )
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(DesignSystem.IconSize.medium)
        )
    }
}

// Location Search Components
@Composable
fun LocationSearchBar(
    searchText: String,
    onSearchTextChange: (String) -> Unit,
    searchResults: List<SearchResult>,
    onResultSelected: (SearchResult) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Search for a location"
) {
    var isSearching by remember { mutableStateOf(false) }
    
    Column(modifier = modifier) {
        OutlinedTextField(
            value = searchText,
            onValueChange = { 
                onSearchTextChange(it)
                isSearching = it.isNotEmpty()
            },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text(placeholder) },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = "Search"
                )
            },
            trailingIcon = {
                if (isSearching && searchText.isNotEmpty()) {
                    IconButton(
                        onClick = {
                            onSearchTextChange("")
                            isSearching = false
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Default.Clear,
                            contentDescription = "Clear"
                        )
                    }
                }
            },
            shape = RoundedCornerShape(DesignSystem.CornerRadius.md),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline
            )
        )
        
        if (isSearching && searchResults.isNotEmpty()) {
            SearchResultsList(
                results = searchResults,
                onResultSelected = { result ->
                    onResultSelected(result)
                    isSearching = false
                },
                modifier = Modifier.padding(top = DesignSystem.Spacing.xs)
            )
        }
    }
}

@Composable
fun SearchResultsList(
    results: List<SearchResult>,
    onResultSelected: (SearchResult) -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = DesignSystem.Elevation.medium),
        shape = RoundedCornerShape(DesignSystem.CornerRadius.md)
    ) {
        Column {
            results.forEachIndexed { index, result ->
                SearchResultItem(
                    result = result,
                    onClick = { onResultSelected(result) }
                )
                
                if (index < results.size - 1) {
                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                    )
                }
            }
        }
    }
}

@Composable
fun SearchResultItem(
    result: SearchResult,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    TextButton(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = RectangleShape,
        colors = ButtonDefaults.textButtonColors(
            contentColor = MaterialTheme.colorScheme.onSurface
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(DesignSystem.Spacing.sm),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
            ) {
                Text(
                    text = result.title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = result.subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            Icon(
                imageVector = Icons.Default.NorthWest,
                contentDescription = "Select location",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(DesignSystem.IconSize.small)
            )
        }
    }
}

// POI Marker Components
@Composable
fun POIMarker(
    poi: POI,
    isSelected: Boolean = false,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.xs)
    ) {
        Box(
            modifier = Modifier
                .size(DesignSystem.Map.markerSize)
                .shadow(
                    elevation = DesignSystem.Elevation.small,
                    shape = CircleShape
                )
                .background(
                    color = if (isSelected) MaterialTheme.colorScheme.secondary else poi.category.color,
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = poi.category.icon,
                contentDescription = poi.category.displayName,
                tint = Color.White,
                modifier = Modifier.size(DesignSystem.IconSize.medium)
            )
        }
        
        if (isSelected) {
            Card(
                elevation = CardDefaults.cardElevation(defaultElevation = DesignSystem.Elevation.small),
                shape = RoundedCornerShape(DesignSystem.CornerRadius.sm)
            ) {
                Text(
                    text = poi.name,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(
                        horizontal = DesignSystem.Spacing.sm,
                        vertical = DesignSystem.Spacing.xs
                    )
                )
            }
        }
    }
}

// Geofence Overlay Component
@Composable
fun GeofenceOverlay(
    center: Pair<Double, Double>, // lat, lng
    radiusMeters: Double,
    modifier: Modifier = Modifier,
    strokeColor: Color = MaterialTheme.colorScheme.primary.copy(alpha = 0.3f),
    fillColor: Color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)
) {
    // This would typically be implemented with actual map SDK
    // For now, showing a conceptual representation
    Box(
        modifier = modifier
            .size((radiusMeters / 10).dp) // Simplified conversion
            .background(
                color = fillColor,
                shape = CircleShape
            )
            .clip(CircleShape)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    color = Color.Transparent,
                    shape = CircleShape
                )
        )
    }
}

// Data Classes
data class SearchResult(
    val title: String,
    val subtitle: String,
    val latitude: Double,
    val longitude: Double
)

data class POI(
    val id: String,
    val name: String,
    val category: POICategory,
    val latitude: Double,
    val longitude: Double,
    val address: String
)

enum class POICategory(
    val displayName: String,
    val icon: ImageVector,
    val color: Color
) {
    GAS("Gas Station", Icons.Default.LocalGasStation, Color(0xFF2196F3)),
    PHARMACY("Pharmacy", Icons.Default.LocalPharmacy, Color(0xFFF44336)),
    GROCERY("Grocery Store", Icons.Default.ShoppingCart, Color(0xFF4CAF50)),
    BANK("Bank", Icons.Default.AccountBalance, Color(0xFFFF9800)),
    POST_OFFICE("Post Office", Icons.Default.Mail, Color(0xFF9C27B0))
}

@Preview(showBackground = true)
@Composable
fun MapComponentsPreview() {
    NearMeTheme {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(DesignSystem.Spacing.md),
            verticalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.lg)
        ) {
            LocationSearchBar(
                searchText = "",
                onSearchTextChange = {},
                searchResults = listOf(
                    SearchResult("Starbucks", "Coffee Shop • 0.2 mi", 37.7749, -122.4194),
                    SearchResult("Whole Foods", "Grocery Store • 0.5 mi", 37.7849, -122.4094)
                ),
                onResultSelected = {}
            )
            
            Row(
                horizontalArrangement = Arrangement.spacedBy(DesignSystem.Spacing.md)
            ) {
                POIMarker(
                    poi = POI(
                        id = "1",
                        name = "Starbucks",
                        category = POICategory.GROCERY,
                        latitude = 37.7749,
                        longitude = -122.4194,
                        address = "123 Main St"
                    ),
                    isSelected = false
                )
                
                POIMarker(
                    poi = POI(
                        id = "2",
                        name = "Selected Store",
                        category = POICategory.PHARMACY,
                        latitude = 37.7749,
                        longitude = -122.4194,
                        address = "456 Oak Ave"
                    ),
                    isSelected = true
                )
            }
            
            MapControlsOverlay(
                onLocationClick = {},
                onZoomIn = {},
                onZoomOut = {},
                modifier = Modifier.height(200.dp)
            )
        }
    }
}