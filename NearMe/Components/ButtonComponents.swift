import SwiftUI

// MARK: - Button Components
struct PrimaryButton: View {
    let title: String
    let action: () -> Void
    var isLoading: Bool = false
    var isDisabled: Bool = false
    var size: ButtonSize = .medium
    
    enum ButtonSize {
        case small, medium, large
        
        var height: CGFloat {
            switch self {
            case .small: return 36
            case .medium: return 44
            case .large: return 52
            }
        }
        
        var font: Font {
            switch self {
            case .small: return DesignSystem.Typography.buttonSmall
            case .medium: return DesignSystem.Typography.buttonMedium
            case .large: return DesignSystem.Typography.buttonLarge
            }
        }
        
        var padding: CGFloat {
            switch self {
            case .small: return DesignSystem.Spacing.sm
            case .medium: return DesignSystem.Spacing.md
            case .large: return DesignSystem.Spacing.lg
            }
        }
    }
    
    var body: some View {
        Button(action: action) {
            HStack {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: DesignSystem.Colors.textInverse))
                        .scaleEffect(0.8)
                } else {
                    Text(title)
                        .font(size.font)
                        .fontWeight(.semibold)
                }
            }
            .frame(height: size.height)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, size.padding)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .fill(isDisabled ? DesignSystem.Colors.textTertiary : DesignSystem.Colors.primary)
            )
            .foregroundColor(DesignSystem.Colors.textInverse)
        }
        .disabled(isDisabled || isLoading)
        .designSystemShadow(DesignSystem.Shadow.small)
    }
}

struct SecondaryButton: View {
    let title: String
    let action: () -> Void
    var isLoading: Bool = false
    var isDisabled: Bool = false
    var size: PrimaryButton.ButtonSize = .medium
    
    var body: some View {
        Button(action: action) {
            HStack {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: DesignSystem.Colors.primary))
                        .scaleEffect(0.8)
                } else {
                    Text(title)
                        .font(size.font)
                        .fontWeight(.semibold)
                }
            }
            .frame(height: size.height)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, size.padding)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .stroke(DesignSystem.Colors.primary, lineWidth: 2)
                    .background(
                        RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                            .fill(DesignSystem.Colors.background)
                    )
            )
            .foregroundColor(isDisabled ? DesignSystem.Colors.textTertiary : DesignSystem.Colors.primary)
        }
        .disabled(isDisabled || isLoading)
        .designSystemShadow(DesignSystem.Shadow.small)
    }
}

struct IconButton: View {
    let icon: String
    let action: () -> Void
    var size: CGFloat = 44
    var backgroundColor: Color = DesignSystem.Colors.surface
    var foregroundColor: Color = DesignSystem.Colors.textPrimary
    
    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 20, weight: .medium))
                .frame(width: size, height: size)
                .background(
                    Circle()
                        .fill(backgroundColor)
                )
                .foregroundColor(foregroundColor)
        }
        .designSystemShadow(DesignSystem.Shadow.small)
    }
}

struct FloatingActionButton: View {
    let icon: String
    let action: () -> Void
    var size: CGFloat = 56
    var backgroundColor: Color = DesignSystem.Colors.primary
    
    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 24, weight: .semibold))
                .frame(width: size, height: size)
                .background(
                    Circle()
                        .fill(backgroundColor)
                )
                .foregroundColor(DesignSystem.Colors.textInverse)
        }
        .designSystemShadow(DesignSystem.Shadow.large)
    }
}

// MARK: - Button Previews
struct ButtonComponents_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: DesignSystem.Spacing.md) {
            PrimaryButton(title: "Primary Button", action: {})
            
            PrimaryButton(title: "Loading Button", action: {}, isLoading: true)
            
            PrimaryButton(title: "Disabled Button", action: {}, isDisabled: true)
            
            SecondaryButton(title: "Secondary Button", action: {})
            
            HStack(spacing: DesignSystem.Spacing.md) {
                IconButton(icon: "plus", action: {})
                IconButton(icon: "heart", action: {}, backgroundColor: DesignSystem.Colors.error)
                IconButton(icon: "star", action: {}, backgroundColor: DesignSystem.Colors.warning)
            }
            
            FloatingActionButton(icon: "plus", action: {})
        }
        .padding()
        .background(DesignSystem.Colors.background)
    }
}
