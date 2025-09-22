import SwiftUI
import CoreLocation

// MARK: - Locations Onboarding View
struct LocationsOnboardingView: View {
    @ObservedObject var onboardingManager: OnboardingManager
    @State private var showingAddLocation = false
    @State private var selectedLocationType: CommonLocation.LocationType = .home
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.xl) {
            // Title
            VStack(spacing: DesignSystem.Spacing.sm) {
                Text("Common Locations")
                    .font(DesignSystem.Typography.title1)
                    .fontWeight(.bold)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text("Tell us about places you visit regularly")
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            
            // Quick Add Buttons
            VStack(spacing: DesignSystem.Spacing.md) {
                Text("Quick Add")
                    .font(DesignSystem.Typography.title3)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: DesignSystem.Spacing.md) {
                    ForEach(CommonLocation.LocationType.allCases.filter { $0 != .custom }, id: \.self) { locationType in
                        QuickAddLocationButton(
                            locationType: locationType,
                            isAdded: isLocationTypeAdded(locationType),
                            action: { addQuickLocation(locationType) }
                        )
                    }
                }
            }
            
            // Added Locations List
            if !onboardingManager.preferences.commonLocations.isEmpty {
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                    Text("Your Locations")
                        .font(DesignSystem.Typography.title3)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    ForEach(onboardingManager.preferences.commonLocations.indices, id: \.self) { index in
                        let location = onboardingManager.preferences.commonLocations[index]
                        LocationRow(
                            location: location,
                            onRemove: { onboardingManager.removeCommonLocation(at: index) }
                        )
                    }
                }
            }
            
            // Add Custom Location Button
            SecondaryButton(
                title: "Add Custom Location",
                action: { showingAddLocation = true }
            )
            
            Spacer()
        }
        .padding(.horizontal, DesignSystem.Spacing.padding)
        .sheet(isPresented: $showingAddLocation) {
            AddCustomLocationView(
                onboardingManager: onboardingManager,
                isPresented: $showingAddLocation
            )
        }
    }
    
    // MARK: - Helper Methods
    private func isLocationTypeAdded(_ type: CommonLocation.LocationType) -> Bool {
        return onboardingManager.preferences.commonLocations.contains { $0.type == type }
    }
    
    private func addQuickLocation(_ type: CommonLocation.LocationType) {
        if isLocationTypeAdded(type) {
            // Remove if already added
            if let index = onboardingManager.preferences.commonLocations.firstIndex(where: { $0.type == type }) {
                onboardingManager.removeCommonLocation(at: index)
            }
        } else {
            // Add new location
            let location = CommonLocation(
                id: UUID().uuidString,
                name: type.displayName,
                type: type,
                address: nil,
                coordinate: nil
            )
            onboardingManager.addCommonLocation(location)
        }
    }
}

// MARK: - Quick Add Location Button
struct QuickAddLocationButton: View {
    let locationType: CommonLocation.LocationType
    let isAdded: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: DesignSystem.Spacing.sm) {
                ZStack {
                    Circle()
                        .fill(isAdded ? DesignSystem.Colors.primary : DesignSystem.Colors.surface)
                        .frame(width: 50, height: 50)
                    
                    Image(systemName: locationType.icon)
                        .font(.title2)
                        .foregroundColor(isAdded ? DesignSystem.Colors.textInverse : DesignSystem.Colors.primary)
                }
                
                Text(locationType.displayName)
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                
                if isAdded {
                    Text("Added")
                        .font(DesignSystem.Typography.caption2)
                        .foregroundColor(DesignSystem.Colors.success)
                }
            }
            .padding(.vertical, DesignSystem.Spacing.md)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .fill(isAdded ? DesignSystem.Colors.primary.opacity(0.1) : DesignSystem.Colors.card)
                    .overlay(
                        RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                            .stroke(isAdded ? DesignSystem.Colors.primary : DesignSystem.Colors.border, lineWidth: 1)
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Location Row
struct LocationRow: View {
    let location: CommonLocation
    let onRemove: () -> Void
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            Image(systemName: location.type.icon)
                .font(.title3)
                .foregroundColor(DesignSystem.Colors.primary)
                .frame(width: 30)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(location.name)
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                if let address = location.address {
                    Text(address)
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                } else {
                    Text("Tap to set location")
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textTertiary)
                }
            }
            
            Spacer()
            
            Button(action: onRemove) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title3)
                    .foregroundColor(DesignSystem.Colors.error)
            }
        }
        .padding(.vertical, DesignSystem.Spacing.sm)
    }
}

// MARK: - Add Custom Location View
struct AddCustomLocationView: View {
    @ObservedObject var onboardingManager: OnboardingManager
    @Binding var isPresented: Bool
    
    @State private var locationName = ""
    @State private var locationAddress = ""
    @State private var selectedLocationType: CommonLocation.LocationType = .custom
    
    var body: some View {
        NavigationView {
            VStack(spacing: DesignSystem.Spacing.lg) {
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                    Text("Location Name")
                        .font(DesignSystem.Typography.bodyEmphasized)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    TextField("Enter location name", text: $locationName)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                }
                
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                    Text("Address (Optional)")
                        .font(DesignSystem.Typography.bodyEmphasized)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    TextField("Enter address", text: $locationAddress)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                }
                
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                    Text("Location Type")
                        .font(DesignSystem.Typography.bodyEmphasized)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    Picker("Location Type", selection: $selectedLocationType) {
                        ForEach(CommonLocation.LocationType.allCases, id: \.self) { type in
                            Text(type.displayName).tag(type)
                        }
                    }
                    .pickerStyle(MenuPickerStyle())
                }
                
                Spacer()
                
                PrimaryButton(
                    title: "Add Location",
                    action: addLocation,
                    isDisabled: locationName.isEmpty
                )
            }
            .padding(.horizontal, DesignSystem.Spacing.padding)
            .navigationTitle("Add Custom Location")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                leading: Button("Cancel") { isPresented = false }
            )
        }
    }
    
    private func addLocation() {
        let location = CommonLocation(
            id: UUID().uuidString,
            name: locationName,
            type: selectedLocationType,
            address: locationAddress.isEmpty ? nil : locationAddress,
            coordinate: nil
        )
        onboardingManager.addCommonLocation(location)
        isPresented = false
    }
}

// MARK: - Previews
struct LocationsOnboardingView_Previews: PreviewProvider {
    static var previews: some View {
        LocationsOnboardingView(onboardingManager: OnboardingManager())
    }
}
