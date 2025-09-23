import SwiftUI

// MARK: - Design System
struct DesignSystem {
    
    // MARK: - Colors
    struct Colors {
        // Primary Colors
        static let primary = Color("Primary")
        static let primaryLight = Color("PrimaryLight")
        static let primaryDark = Color("PrimaryDark")
        
        // Secondary Colors
        static let secondary = Color("Secondary")
        static let accent = Color("Accent")
        
        // Semantic Colors
        static let success = Color("Success")
        static let warning = Color("Warning")
        static let error = Color("Error")
        
        // Neutral Colors
        static let background = Color("Background")
        static let surface = Color("Surface")
        static let card = Color("Card")
        
        // Text Colors
        static let textPrimary = Color("TextPrimary")
        static let textSecondary = Color("TextSecondary")
        static let textTertiary = Color.gray.opacity(0.6)
        static let textInverse = Color.white
        
        // Border Colors
        static let border = Color.gray.opacity(0.2)
        static let borderLight = Color.gray.opacity(0.1)
        static let borderDark = Color.gray.opacity(0.3)
        
        // Overlay Colors
        static let overlay = Color.black.opacity(0.5)
        static let overlayLight = Color.black.opacity(0.1)
        static let overlayDark = Color.black.opacity(0.8)
        
        // Map Colors
        static let mapPin = Color("Primary")
        static let mapPinSelected = Color("Accent")
        static let geofenceStroke = Color("Primary").opacity(0.3)
        static let geofenceFill = Color("Primary").opacity(0.1)
    }
    
    // MARK: - Typography
    struct Typography {
        // Display Styles
        static let largeTitle = Font.largeTitle.weight(.bold)
        static let title1 = Font.title.weight(.bold)
        static let title2 = Font.title2.weight(.semibold)
        static let title3 = Font.title3.weight(.medium)
        
        // Body Styles
        static let body = Font.body
        static let bodyEmphasized = Font.body.weight(.medium)
        static let callout = Font.callout
        static let subheadline = Font.subheadline
        static let footnote = Font.footnote
        static let caption1 = Font.caption
        static let caption2 = Font.caption2
        
        // Button Styles
        static let buttonLarge = Font.title3.weight(.semibold)
        static let buttonMedium = Font.body.weight(.medium)
        static let buttonSmall = Font.callout.weight(.medium)
    }
    
    // MARK: - Spacing
    struct Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
        static let xxl: CGFloat = 48
        static let xxxl: CGFloat = 64
        
        // Semantic Spacing
        static let padding: CGFloat = 16
        static let margin: CGFloat = 16
        static let sectionSpacing: CGFloat = 24
        static let itemSpacing: CGFloat = 12
    }
    
    // MARK: - Corner Radius
    struct CornerRadius {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 20
        static let xxl: CGFloat = 24
        static let round: CGFloat = 50
    }
    
    // MARK: - Shadows
    struct Shadow {
        static let small = ShadowStyle(
            color: Color.black.opacity(0.1),
            radius: 2,
            x: 0,
            y: 1
        )
        
        static let medium = ShadowStyle(
            color: Color.black.opacity(0.15),
            radius: 4,
            x: 0,
            y: 2
        )
        
        static let large = ShadowStyle(
            color: Color.black.opacity(0.2),
            radius: 8,
            x: 0,
            y: 4
        )
    }
    
    // MARK: - Animation
    struct Animation {
        static let fast = SwiftUI.Animation.easeInOut(duration: 0.2)
        static let medium = SwiftUI.Animation.easeInOut(duration: 0.3)
        static let slow = SwiftUI.Animation.easeInOut(duration: 0.5)
        
        static let spring = SwiftUI.Animation.spring(response: 0.5, dampingFraction: 0.8)
        static let bouncy = SwiftUI.Animation.spring(response: 0.4, dampingFraction: 0.6)
    }
}

// MARK: - Shadow Style
struct ShadowStyle {
    let color: Color
    let radius: CGFloat
    let x: CGFloat
    let y: CGFloat
}

// MARK: - Design System Extensions
extension View {
    func designSystemShadow(_ style: ShadowStyle) -> some View {
        self.shadow(color: style.color, radius: style.radius, x: style.x, y: style.y)
    }
    
    func designSystemPadding(_ spacing: CGFloat = DesignSystem.Spacing.padding) -> some View {
        self.padding(spacing)
    }
    
    func designSystemCornerRadius(_ radius: CGFloat = DesignSystem.CornerRadius.md) -> some View {
        self.cornerRadius(radius)
    }
}

// MARK: - Color Extensions
extension Color {
    init(_ name: String) {
        self.init(name, bundle: .main)
    }
}
