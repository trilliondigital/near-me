import SwiftUI

// MARK: - Input Components
struct TextInputField: View {
    let title: String
    @Binding var text: String
    var placeholder: String = ""
    var isSecure: Bool = false
    var keyboardType: UIKeyboardType = .default
    var errorMessage: String?
    var isRequired: Bool = false
    
    @State private var isFocused: Bool = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
            HStack {
                Text(title)
                    .font(DesignSystem.Typography.body)
                    .fontWeight(.medium)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                if isRequired {
                    Text("*")
                        .foregroundColor(DesignSystem.Colors.error)
                }
            }
            
            Group {
                if isSecure {
                    SecureField(placeholder, text: $text)
                } else {
                    TextField(placeholder, text: $text)
                        .keyboardType(keyboardType)
                }
            }
            .font(DesignSystem.Typography.body)
            .padding(DesignSystem.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .fill(DesignSystem.Colors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                            .stroke(
                                isFocused ? DesignSystem.Colors.primary : DesignSystem.Colors.border,
                                lineWidth: isFocused ? 2 : 1
                            )
                    )
            )
            .foregroundColor(DesignSystem.Colors.textPrimary)
            .onTapGesture {
                isFocused = true
            }
            .onChange(of: text) { _ in
                isFocused = false
            }
            
            if let errorMessage = errorMessage {
                Text(errorMessage)
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.error)
            }
        }
    }
}

struct SearchField: View {
    @Binding var text: String
    var placeholder: String = "Search..."
    var onSearchButtonClicked: (() -> Void)?
    
    @State private var isEditing: Bool = false
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.sm) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(DesignSystem.Colors.textSecondary)
                .font(.system(size: 16, weight: .medium))
            
            TextField(placeholder, text: $text)
                .font(DesignSystem.Typography.body)
                .foregroundColor(DesignSystem.Colors.textPrimary)
                .onTapGesture {
                    isEditing = true
                }
                .onChange(of: text) { _ in
                    if text.isEmpty {
                        isEditing = false
                    }
                }
            
            if isEditing && !text.isEmpty {
                Button(action: {
                    text = ""
                    isEditing = false
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .font(.system(size: 16))
                }
            }
        }
        .padding(DesignSystem.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                .fill(DesignSystem.Colors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                        .stroke(DesignSystem.Colors.border, lineWidth: 1)
                )
        )
    }
}

struct PickerField<T: Hashable>: View {
    let title: String
    @Binding var selection: T
    let options: [T]
    let optionTitle: (T) -> String
    var isRequired: Bool = false
    var errorMessage: String?
    
    @State private var isExpanded: Bool = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
            HStack {
                Text(title)
                    .font(DesignSystem.Typography.body)
                    .fontWeight(.medium)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                if isRequired {
                    Text("*")
                        .foregroundColor(DesignSystem.Colors.error)
                }
            }
            
            Button(action: {
                withAnimation(DesignSystem.Animation.fast) {
                    isExpanded.toggle()
                }
            }) {
                HStack {
                    Text(optionTitle(selection))
                        .font(DesignSystem.Typography.body)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    
                    Image(systemName: "chevron.down")
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .font(.system(size: 14, weight: .medium))
                        .rotationEffect(.degrees(isExpanded ? 180 : 0))
                        .animation(DesignSystem.Animation.fast, value: isExpanded)
                }
                .padding(DesignSystem.Spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                        .fill(DesignSystem.Colors.surface)
                        .overlay(
                            RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                                .stroke(DesignSystem.Colors.border, lineWidth: 1)
                        )
                )
            }
            
            if isExpanded {
                VStack(spacing: 0) {
                    ForEach(options, id: \.self) { option in
                        Button(action: {
                            selection = option
                            withAnimation(DesignSystem.Animation.fast) {
                                isExpanded = false
                            }
                        }) {
                            HStack {
                                Text(optionTitle(option))
                                    .font(DesignSystem.Typography.body)
                                    .foregroundColor(DesignSystem.Colors.textPrimary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                
                                if selection == option {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(DesignSystem.Colors.primary)
                                        .font(.system(size: 14, weight: .medium))
                                }
                            }
                            .padding(DesignSystem.Spacing.md)
                            .background(
                                Rectangle()
                                    .fill(selection == option ? DesignSystem.Colors.primary.opacity(0.1) : DesignSystem.Colors.background)
                            )
                        }
                    }
                }
                .background(
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                        .fill(DesignSystem.Colors.background)
                        .overlay(
                            RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                                .stroke(DesignSystem.Colors.border, lineWidth: 1)
                        )
                )
                .designSystemShadow(DesignSystem.Shadow.small)
            }
            
            if let errorMessage = errorMessage {
                Text(errorMessage)
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.error)
            }
        }
    }
}

struct ToggleField: View {
    let title: String
    @Binding var isOn: Bool
    var description: String?
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                Text(title)
                    .font(DesignSystem.Typography.body)
                    .fontWeight(.medium)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                if let description = description {
                    Text(description)
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
            }
            
            Spacer()
            
            Toggle("", isOn: $isOn)
                .toggleStyle(SwitchToggleStyle(tint: DesignSystem.Colors.primary))
        }
        .padding(DesignSystem.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                .fill(DesignSystem.Colors.surface)
        )
    }
}

struct SliderField: View {
    let title: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double
    var unit: String = ""
    var description: String?
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
            HStack {
                Text(title)
                    .font(DesignSystem.Typography.body)
                    .fontWeight(.medium)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Spacer()
                
                Text("\(Int(value))\(unit)")
                    .font(DesignSystem.Typography.body)
                    .fontWeight(.medium)
                    .foregroundColor(DesignSystem.Colors.primary)
            }
            
            if let description = description {
                Text(description)
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
            }
            
            Slider(value: $value, in: range, step: step)
                .accentColor(DesignSystem.Colors.primary)
        }
        .padding(DesignSystem.Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                .fill(DesignSystem.Colors.surface)
        )
    }
}

// MARK: - Input Previews
struct InputComponents_Previews: PreviewProvider {
    @State static var text = ""
    @State static var searchText = ""
    @State static var selectedOption = "Option 1"
    @State static var isToggleOn = false
    @State static var sliderValue = 5.0
    
    static var previews: some View {
        ScrollView {
            VStack(spacing: DesignSystem.Spacing.lg) {
                TextInputField(
                    title: "Task Title",
                    text: $text,
                    placeholder: "Enter task title",
                    isRequired: true
                )
                
                SearchField(text: $searchText, placeholder: "Search places...")
                
                PickerField(
                    title: "Category",
                    selection: $selectedOption,
                    options: ["Option 1", "Option 2", "Option 3"],
                    optionTitle: { $0 }
                )
                
                ToggleField(
                    title: "Enable Notifications",
                    isOn: $isToggleOn,
                    description: "Receive notifications when near your tasks"
                )
                
                SliderField(
                    title: "Radius",
                    value: $sliderValue,
                    range: 0.1...10.0,
                    step: 0.1,
                    unit: " mi",
                    description: "Distance from location to trigger notification"
                )
            }
            .padding()
        }
        .background(DesignSystem.Colors.background)
    }
}
