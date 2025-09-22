package com.nearme.app.ui.theme

import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object DesignSystem {
    
    // Spacing
    object Spacing {
        val xs = 4.dp
        val sm = 8.dp
        val md = 16.dp
        val lg = 24.dp
        val xl = 32.dp
        val xxl = 48.dp
        val xxxl = 64.dp
        
        // Semantic Spacing
        val padding = 16.dp
        val margin = 16.dp
        val sectionSpacing = 24.dp
        val itemSpacing = 12.dp
    }
    
    // Corner Radius
    object CornerRadius {
        val xs = 4.dp
        val sm = 8.dp
        val md = 12.dp
        val lg = 16.dp
        val xl = 20.dp
        val xxl = 24.dp
        val round = 50.dp
    }
    
    // Elevation
    object Elevation {
        val none = 0.dp
        val small = 2.dp
        val medium = 4.dp
        val large = 8.dp
        val xl = 16.dp
    }
    
    // Animation Durations
    object Animation {
        const val fast = 200L
        const val medium = 300L
        const val slow = 500L
    }
    
    // Button Heights
    object ButtonHeight {
        val small = 36.dp
        val medium = 44.dp
        val large = 52.dp
    }
    
    // Icon Sizes
    object IconSize {
        val small = 16.dp
        val medium = 20.dp
        val large = 24.dp
        val xl = 32.dp
        val xxl = 48.dp
    }
    
    // Text Sizes (additional to Material3 Typography)
    object TextSize {
        val buttonLarge = 18.sp
        val buttonMedium = 16.sp
        val buttonSmall = 14.sp
    }
}
