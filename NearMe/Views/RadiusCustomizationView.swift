import SwiftUI

struct RadiusCustomizationView: View {
    @Environment(\.presentationMode) var presentationMode
    
    @Binding var customRadii: GeofenceRadii
    let locationType: LocationType
    let selectedPOICategory: POICategory
    
    @State private var approachRadius: Double
    @State private var arrivalRadius: Double
    @State private var postArrivalEnabled: Bool
    
    init(customRadii: Binding<GeofenceRadii>, locationType: LocationType, selectedPOICategory: POICategory) {
        self._customRadii = customRadii
        self.locationType = locationType
        self.selectedPOICategory = selectedPOICategory
        
        // Initialize state with current values
        self._approachRadius = State(initialValue: customRadii.wrappedValue.approach)
        self._arrivalRadius = State(initialValue: customRadii.wrappedValue.arrival)
        self._postArrivalEnabled = State(initialValue: customRadii.wrappedValue.postArrival)
    }
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    // Header
                    VStack(spacing: DesignSystem.Spacing.sm) {
                        Text("Customize Reminder Distance")
                            .font(DesignSystem.Typography.title1)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                        
                        Text("Adjust when and how close you need to be to get reminded")
                            .font(DesignSystem.Typography.subheadline)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, DesignSystem.Spacing.lg)
                    
                    // Current Settings Preview
                    CurrentSettingsPreview(
                        locationType: locationType,
                        selectedPOICategory: selectedPOICategory,
                        approachRadius: approachRadius,
                        arrivalRadius: arrivalRadius,
                        postArrivalEnabled: postArrivalEnabled
                    )
                    
                    // Approach Distance Section
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                        SectionHeader(title: "Approach Distance", icon: "location.circle.fill")
                        
                        VStack(spacing: DesignSystem.Spacing.md) {
                            VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                                HStack {
                                    Text("Remind me when I'm")
                                        .font(DesignSystem.Typography.bodyEmphasized)
                                        .foregroundColor(DesignSystem.Colors.textPrimary)
                                    
                                    Spacer()
                                    
                                    Text("\(Int(approachRadius)) miles away")
                                        .font(DesignSystem.Typography.bodyEmphasized)
                                        .foregroundColor(DesignSystem.Colors.primary)
                                }
                                
                                Slider(value: $approachRadius, in: 0.5...10.0, step: 0.5)
                                    .accentColor(DesignSystem.Colors.primary)
                                
                                HStack {
                                    Text("0.5 mi")
                                        .font(DesignSystem.Typography.caption1)
                                        .foregroundColor(DesignSystem.Colors.textSecondary)
                                    
                                    Spacer()
                                    
                                    Text("10 mi")
                                        .font(DesignSystem.Typography.caption1)
                                        .foregroundColor(DesignSystem.Colors.textSecondary)
                                }
                            }
                            
                            // Approach Distance Info
                            InfoCard(
                                icon: "info.circle.fill",
                                title: "Approach Distance",
                                description: "You'll get a notification when you're within this distance of your destination. This gives you time to prepare or remember your task."
                            )
                        }
                    }
                    .padding(.horizontal, DesignSystem.Spacing.padding)
                    
                    // Arrival Distance Section
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                        SectionHeader(title: "Arrival Distance", icon: "target")
                        
                        VStack(spacing: DesignSystem.Spacing.md) {
                            VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                                HStack {
                                    Text("Consider me arrived when I'm")
                                        .font(DesignSystem.Typography.bodyEmphasized)
                                        .foregroundColor(DesignSystem.Colors.textPrimary)
                                    
                                    Spacer()
                                    
                                    Text("\(Int(arrivalRadius)) meters away")
                                        .font(DesignSystem.Typography.bodyEmphasized)
                                        .foregroundColor(DesignSystem.Colors.primary)
                                }
                                
                                Slider(value: $arrivalRadius, in: 50...500, step: 25)
                                    .accentColor(DesignSystem.Colors.primary)
                                
                                HStack {
                                    Text("50m")
                                        .font(DesignSystem.Typography.caption1)
                                        .foregroundColor(DesignSystem.Colors.textSecondary)
                                    
                                    Spacer()
                                    
                                    Text("500m")
                                        .font(DesignSystem.Typography.caption1)
                                        .foregroundColor(DesignSystem.Colors.textSecondary)
                                }
                            }
                            
                            // Arrival Distance Info
                            InfoCard(
                                icon: "target",
                                title: "Arrival Distance",
                                description: "This is the distance where you're considered to have arrived at your destination. Smaller values are more precise but may miss you if you're not exactly at the location."
                            )
                        }
                    }
                    .padding(.horizontal, DesignSystem.Spacing.padding)
                    
                    // Post-Arrival Section
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                        SectionHeader(title: "Post-Arrival Reminders", icon: "clock.fill")
                        
                        VStack(spacing: DesignSystem.Spacing.md) {
                            Toggle(isOn: $postArrivalEnabled) {
                                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                                    Text("Enable post-arrival reminders")
                                        .font(DesignSystem.Typography.bodyEmphasized)
                                        .foregroundColor(DesignSystem.Colors.textPrimary)
                                    
                                    Text("Get additional reminders after you've arrived")
                                        .font(DesignSystem.Typography.caption1)
                                        .foregroundColor(DesignSystem.Colors.textSecondary)
                                }
                            }
                            .toggleStyle(SwitchToggleStyle(tint: DesignSystem.Colors.primary))
                            
                            if postArrivalEnabled {
                                InfoCard(
                                    icon: "clock.fill",
                                    title: "Post-Arrival Reminders",
                                    description: "You'll get additional reminders after arriving at your destination. This helps ensure you don't forget your task even after you've reached the location."
                                )
                            }
                        }
                    }
                    .padding(.horizontal, DesignSystem.Spacing.padding)
                    
                    // Reset to Defaults
                    VStack(spacing: DesignSystem.Spacing.md) {
                        Button(action: resetToDefaults) {
                            HStack {
                                Image(systemName: "arrow.clockwise")
                                Text("Reset to Defaults")
                            }
                            .font(DesignSystem.Typography.buttonMedium)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                            .background(DesignSystem.Colors.surface)
                            .designSystemCornerRadius()
                            .designSystemShadow(DesignSystem.Shadow.small)
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                    .padding(.horizontal, DesignSystem.Spacing.padding)
                    
                    Spacer(minLength: DesignSystem.Spacing.xxl)
                }
            }
            .navigationTitle("Customize Distance")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        saveSettings()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }
    
    private func resetToDefaults() {
        let defaultRadii = locationType == .poiCategory ? 
            GeofenceRadii.defaultForPOI(selectedPOICategory) : 
            GeofenceRadii.default
        
        approachRadius = defaultRadii.approach
        arrivalRadius = defaultRadii.arrival
        postArrivalEnabled = defaultRadii.postArrival
    }
    
    private func saveSettings() {
        customRadii = GeofenceRadii(
            approach: approachRadius,
            arrival: arrivalRadius,
            postArrival: postArrivalEnabled
        )
        presentationMode.wrappedValue.dismiss()
    }
}

// MARK: - Current Settings Preview
struct CurrentSettingsPreview: View {
    let locationType: LocationType
    let selectedPOICategory: POICategory
    let approachRadius: Double
    let arrivalRadius: Double
    let postArrivalEnabled: Bool
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
            Text("Current Settings")
                .font(DesignSystem.Typography.title3)
                .foregroundColor(DesignSystem.Colors.textPrimary)
            
            VStack(spacing: DesignSystem.Spacing.sm) {
                SettingPreviewRow(
                    icon: "location.circle.fill",
                    title: "Approach Distance",
                    value: "\(Int(approachRadius)) miles",
                    color: DesignSystem.Colors.primary
                )
                
                SettingPreviewRow(
                    icon: "target",
                    title: "Arrival Distance",
                    value: "\(Int(arrivalRadius)) meters",
                    color: DesignSystem.Colors.secondary
                )
                
                if postArrivalEnabled {
                    SettingPreviewRow(
                        icon: "clock.fill",
                        title: "Post-Arrival",
                        value: "Enabled",
                        color: DesignSystem.Colors.success
                    )
                }
            }
            .padding(DesignSystem.Spacing.md)
            .background(DesignSystem.Colors.surface)
            .designSystemCornerRadius()
            .designSystemShadow(DesignSystem.Shadow.small)
        }
        .padding(.horizontal, DesignSystem.Spacing.padding)
    }
}

// MARK: - Setting Preview Row
struct SettingPreviewRow: View {
    let icon: String
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(color)
                .frame(width: 20)
            
            Text(title)
                .font(DesignSystem.Typography.body)
                .foregroundColor(DesignSystem.Colors.textPrimary)
            
            Spacer()
            
            Text(value)
                .font(DesignSystem.Typography.bodyEmphasized)
                .foregroundColor(DesignSystem.Colors.textSecondary)
        }
    }
}

// MARK: - Section Header
struct SectionHeader: View {
    let title: String
    let icon: String
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.sm) {
            Image(systemName: icon)
                .foregroundColor(DesignSystem.Colors.primary)
                .font(.title3)
            
            Text(title)
                .font(DesignSystem.Typography.title3)
                .foregroundColor(DesignSystem.Colors.textPrimary)
            
            Spacer()
        }
    }
}

// MARK: - Info Card
struct InfoCard: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(alignment: .top, spacing: DesignSystem.Spacing.md) {
            Image(systemName: icon)
                .foregroundColor(DesignSystem.Colors.primary)
                .font(.title3)
                .frame(width: 20)
            
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                Text(title)
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text(description)
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            
            Spacer()
        }
        .padding(DesignSystem.Spacing.md)
        .background(DesignSystem.Colors.primary.opacity(0.05))
        .designSystemCornerRadius()
        .overlay(
            RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                .stroke(DesignSystem.Colors.primary.opacity(0.2), lineWidth: 1)
        )
    }
}

// MARK: - Preview
struct RadiusCustomizationView_Previews: PreviewProvider {
    static var previews: some View {
        RadiusCustomizationView(
            customRadii: .constant(GeofenceRadii.default),
            locationType: .customPlace,
            selectedPOICategory: .gas
        )
    }
}
