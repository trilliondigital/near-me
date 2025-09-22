import SwiftUI

// MARK: - Task Form Validation
struct TaskFormValidation {
    static func validateTitle(_ title: String) -> ValidationResult {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        
        if trimmed.isEmpty {
            return .invalid("Task title is required")
        }
        
        if trimmed.count < 3 {
            return .invalid("Task title must be at least 3 characters")
        }
        
        if trimmed.count > 100 {
            return .invalid("Task title must be less than 100 characters")
        }
        
        return .valid
    }
    
    static func validateDescription(_ description: String) -> ValidationResult {
        let trimmed = description.trimmingCharacters(in: .whitespacesAndNewlines)
        
        if trimmed.count > 500 {
            return .invalid("Description must be less than 500 characters")
        }
        
        return .valid
    }
    
    static func validateLocation(type: LocationType, place: Place?, category: POICategory?) -> ValidationResult {
        switch type {
        case .customPlace:
            if place == nil {
                return .invalid("Please select a custom place")
            }
        case .poiCategory:
            if category == nil {
                return .invalid("Please select a POI category")
            }
        }
        
        return .valid
    }
    
    static func validateGeofenceRadii(_ radii: GeofenceRadii) -> ValidationResult {
        if radii.approach < 0.1 || radii.approach > 50 {
            return .invalid("Approach distance must be between 0.1 and 50 miles")
        }
        
        if radii.arrival < 10 || radii.arrival > 1000 {
            return .invalid("Arrival distance must be between 10 and 1000 meters")
        }
        
        return .valid
    }
}

enum ValidationResult {
    case valid
    case invalid(String)
    
    var isValid: Bool {
        switch self {
        case .valid: return true
        case .invalid: return false
        }
    }
    
    var errorMessage: String? {
        switch self {
        case .valid: return nil
        case .invalid(let message): return message
        }
    }
}

// MARK: - Enhanced Text Field with Validation
struct ValidatedTextField: View {
    let title: String
    let placeholder: String
    @Binding var text: String
    let validation: (String) -> ValidationResult
    let isRequired: Bool
    
    @State private var validationResult: ValidationResult = .valid
    @State private var hasBeenEdited = false
    
    init(
        title: String,
        placeholder: String,
        text: Binding<String>,
        isRequired: Bool = false,
        validation: @escaping (String) -> ValidationResult = { _ in .valid }
    ) {
        self.title = title
        self.placeholder = placeholder
        self._text = text
        self.isRequired = isRequired
        self.validation = validation
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
            HStack {
                Text(title)
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                if isRequired {
                    Text("*")
                        .foregroundColor(DesignSystem.Colors.error)
                }
                
                Spacer()
                
                if hasBeenEdited {
                    Image(systemName: validationResult.isValid ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                        .foregroundColor(validationResult.isValid ? DesignSystem.Colors.success : DesignSystem.Colors.error)
                        .font(.caption)
                }
            }
            
            TextField(placeholder, text: $text, axis: .vertical)
                .textFieldStyle(ValidatedTextFieldStyle(isValid: validationResult.isValid, hasBeenEdited: hasBeenEdited))
                .onChange(of: text) { newValue in
                    hasBeenEdited = true
                    validationResult = validation(newValue)
                }
            
            if hasBeenEdited, let errorMessage = validationResult.errorMessage {
                Text(errorMessage)
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.error)
            }
        }
    }
}

struct ValidatedTextFieldStyle: TextFieldStyle {
    let isValid: Bool
    let hasBeenEdited: Bool
    
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(DesignSystem.Spacing.md)
            .background(DesignSystem.Colors.surface)
            .designSystemCornerRadius()
            .designSystemShadow(DesignSystem.Shadow.small)
            .overlay(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .stroke(borderColor, lineWidth: 1)
            )
    }
    
    private var borderColor: Color {
        if !hasBeenEdited {
            return DesignSystem.Colors.border
        }
        return isValid ? DesignSystem.Colors.success : DesignSystem.Colors.error
    }
}

// MARK: - Location Type Picker
struct LocationTypePicker: View {
    @Binding var selectedType: LocationType
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
            Text("Location Type")
                .font(DesignSystem.Typography.bodyEmphasized)
                .foregroundColor(DesignSystem.Colors.textPrimary)
            
            Picker("Location Type", selection: $selectedType) {
                ForEach(LocationType.allCases, id: \.self) { type in
                    HStack {
                        Image(systemName: type == .customPlace ? "mappin.circle.fill" : "building.2.fill")
                        Text(type.displayName)
                    }
                    .tag(type)
                }
            }
            .pickerStyle(SegmentedPickerStyle())
        }
    }
}

// MARK: - Task Status Indicator
struct TaskStatusIndicator: View {
    let status: TaskStatus
    let showLabel: Bool
    
    init(status: TaskStatus, showLabel: Bool = true) {
        self.status = status
        self.showLabel = showLabel
    }
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.xs) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
            
            if showLabel {
                Text(status.displayName)
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
            }
        }
    }
    
    private var statusColor: Color {
        switch status {
        case .active:
            return DesignSystem.Colors.success
        case .completed:
            return DesignSystem.Colors.primary
        case .muted:
            return DesignSystem.Colors.warning
        }
    }
}

// MARK: - Quick Action Buttons
struct QuickActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let isLoading: Bool
    let action: () -> Void
    
    init(
        title: String,
        icon: String,
        color: Color = DesignSystem.Colors.primary,
        isLoading: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.color = color
        self.isLoading = isLoading
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignSystem.Spacing.xs) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.8)
                } else {
                    Image(systemName: icon)
                        .font(.caption)
                }
                
                Text(title)
                    .font(DesignSystem.Typography.caption1)
            }
            .foregroundColor(.white)
            .padding(.horizontal, DesignSystem.Spacing.sm)
            .padding(.vertical, DesignSystem.Spacing.xs)
            .background(color)
            .designSystemCornerRadius(DesignSystem.CornerRadius.xs)
        }
        .buttonStyle(PlainButtonStyle())
        .disabled(isLoading)
    }
}

// MARK: - Form Section Container
struct FormSection<Content: View>: View {
    let title: String
    let icon: String
    let content: Content
    
    init(title: String, icon: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.icon = icon
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
            HStack(spacing: DesignSystem.Spacing.sm) {
                Image(systemName: icon)
                    .foregroundColor(DesignSystem.Colors.primary)
                    .font(.title3)
                
                Text(title)
                    .font(DesignSystem.Typography.title3)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Spacer()
            }
            
            content
        }
        .padding(DesignSystem.Spacing.md)
        .background(DesignSystem.Colors.surface)
        .designSystemCornerRadius()
        .designSystemShadow(DesignSystem.Shadow.small)
    }
}

// MARK: - Loading Overlay
struct LoadingOverlay: View {
    let isLoading: Bool
    let message: String
    
    init(isLoading: Bool, message: String = "Loading...") {
        self.isLoading = isLoading
        self.message = message
    }
    
    var body: some View {
        if isLoading {
            ZStack {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                
                VStack(spacing: DesignSystem.Spacing.md) {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: DesignSystem.Colors.primary))
                        .scaleEffect(1.2)
                    
                    Text(message)
                        .font(DesignSystem.Typography.body)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                }
                .padding(DesignSystem.Spacing.lg)
                .background(DesignSystem.Colors.surface)
                .designSystemCornerRadius()
                .designSystemShadow(DesignSystem.Shadow.medium)
            }
        }
    }
}

// MARK: - Success/Error Toast
struct ToastMessage: View {
    let message: String
    let type: ToastType
    let isShowing: Bool
    
    enum ToastType {
        case success
        case error
        case info
        
        var color: Color {
            switch self {
            case .success: return DesignSystem.Colors.success
            case .error: return DesignSystem.Colors.error
            case .info: return DesignSystem.Colors.primary
            }
        }
        
        var icon: String {
            switch self {
            case .success: return "checkmark.circle.fill"
            case .error: return "exclamationmark.circle.fill"
            case .info: return "info.circle.fill"
            }
        }
    }
    
    var body: some View {
        if isShowing {
            HStack(spacing: DesignSystem.Spacing.sm) {
                Image(systemName: type.icon)
                    .foregroundColor(type.color)
                
                Text(message)
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Spacer()
            }
            .padding(DesignSystem.Spacing.md)
            .background(DesignSystem.Colors.surface)
            .designSystemCornerRadius()
            .designSystemShadow(DesignSystem.Shadow.medium)
            .overlay(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .stroke(type.color, lineWidth: 1)
            )
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }
}