import SwiftUI
import CoreLocation

// MARK: - Locations View
struct OnboardingLocationsView: View {
    @ObservedObject var onboardingManager: OnboardingManager
    @State private var showingLocationPicker = false
    @State private var selectedLocationType: CommonLocation.LocationType = .home
    
    var body: some View {
        OnboardingPageTemplate(
            title: "Common Locations",
            subtitle: "Tell us about places you visit regularly",
            content: {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    // Quick Add Buttons
                    VStack(spacing: DesignSystem.Spacing.md) {
                        Text("Quick Add")
                            .font(DesignSystem.Typography.bodyEmphasized)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: DesignSystem.Spacing.md) {
                            ForEach([CommonLocation.LocationType.home, .work, .gym, .grocery], id: \.self) { type in
                                QuickAddLocationButton(
                                    type: type,
                                    isAdded: onboardingManager.preferences.commonLocations.contains { $0.type == type }
                                ) {
                                    selectedLocationType = type
                                    showingLocationPicker = true
                                }
                            }
                        }
                    }
                    
                    // Added Locations List
                    if !onboardingManager.preferences.commonLocations.isEmpty {
                        VStack(spacing: DesignSystem.Spacing.md) {
                            Text("Your Locations")
                                .font(DesignSystem.Typography.bodyEmphasized)
                                .foregroundColor(DesignSystem.Colors.textPrimary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            
                            ForEach(Array(onboardingManager.preferences.commonLocations.enumerated()), id: \.offset) { index, location in
                                LocationRow(location: location) {
                                    onboardingManager.removeCommonLocation(at: index)
                                }
                            }
                        }
                    }
                    
                    // Skip Option
                    VStack(spacing: DesignSystem.Spacing.sm) {
                        Text("You can add locations later")
                            .font(DesignSystem.Typography.callout)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                            .multilineTextAlignment(.center)
                        
                        Text("Don't worry, you can always add or edit locations in the app settings.")
                            .font(DesignSystem.Typography.footnote)
                            .foregroundColor(DesignSystem.Colors.textTertiary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, DesignSystem.Spacing.md)
                }
            }
        )
        .sheet(isPresented: $showingLocationPicker) {
            LocationPickerSheet(
                locationType: selectedLocationType,
                onLocationSelected: { location in
                    onboardingManager.addCommonLocation(location)
                    showingLocationPicker = false
                },
                onCancel: {
                    showingLocationPicker = false
                }
            )
        }
    }
}

// MARK: - Categories View
struct OnboardingCategoriesView: View {
    @ObservedObject var onboardingManager: OnboardingManager
    
    var body: some View {
        OnboardingPageTemplate(
            title: "Task Categories",
            subtitle: "What types of tasks do you want reminders for?",
            content: {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: DesignSystem.Spacing.md) {
                        ForEach(TaskCategory.defaultCategories, id: \.id) { category in
                            CategorySelectionCard(
                                category: category,
                                isSelected: onboardingManager.preferences.taskCategories.first { $0.id == category.id }?.isSelected ?? false
                            ) {
                                onboardingManager.toggleTaskCategory(category.id)
                            }
                        }
                    }
                    
                    VStack(spacing: DesignSystem.Spacing.sm) {
                        Text("Select all that apply")
                            .font(DesignSystem.Typography.callout)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                            .multilineTextAlignment(.center)
                        
                        Text("You can change these preferences anytime in settings.")
                            .font(DesignSystem.Typography.footnote)
                            .foregroundColor(DesignSystem.Colors.textTertiary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, DesignSystem.Spacing.md)
                }
            }
        )
    }
}

// MARK: - Preview View
struct OnboardingPreviewView: View {
    @State private var showingNotificationPreview = false
    
    var body: some View {
        OnboardingPageTemplate(
            title: "Preview",
            subtitle: "Here's how notifications will appear",
            content: {
                VStack(spacing: DesignSystem.Spacing.xl) {
                    VStack(spacing: DesignSystem.Spacing.lg) {
                        NotificationPreviewCard(
                            type: .approach,
                            title: "You're 2 miles from Whole Foods",
                            subtitle: "Pick up groceries?"
                        )
                        
                        NotificationPreviewCard(
                            type: .arrival,
                            title: "Arriving at CVS Pharmacy",
                            subtitle: "Pick up prescription now?"
                        )
                        
                        NotificationPreviewCard(
                            type: .postArrival,
                            title: "Still at the bank",
                            subtitle: "Still need to deposit check?"
                        )
                    }
                    
                    VStack(spacing: DesignSystem.Spacing.md) {
                        Button("See Live Preview") {
                            showingNotificationPreview = true
                        }
                        .font(DesignSystem.Typography.buttonMedium)
                        .foregroundColor(DesignSystem.Colors.primary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, DesignSystem.Spacing.md)
                        .background(DesignSystem.Colors.primary.opacity(0.1))
                        .cornerRadius(DesignSystem.CornerRadius.md)
                        
                        VStack(spacing: DesignSystem.Spacing.xs) {
                            Text("Notification Features")
                                .font(DesignSystem.Typography.bodyEmphasized)
                                .foregroundColor(DesignSystem.Colors.textPrimary)
                            
                            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                                FeatureBullet(text: "Complete tasks directly from notifications")
                                FeatureBullet(text: "Snooze for 15 minutes, 1 hour, or until tomorrow")
                                FeatureBullet(text: "Open maps to get directions")
                                FeatureBullet(text: "Mute specific tasks when needed")
                            }
                        }
                    }
                }
            }
        )
        .alert("Test Notification", isPresented: $showingNotificationPreview) {
            Button("Complete") { }
            Button("Snooze 15m") { }
            Button("Open Map") { }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("You're 1 mile from Target — pick up household items?")
        }
    }
}

// MARK: - Complete View
struct OnboardingCompleteView: View {
    @ObservedObject var onboardingManager: OnboardingManager
    @State private var showingSoftPaywall = false
    
    var body: some View {
        OnboardingPageTemplate(
            title: "All Set!",
            subtitle: "You're ready to start using Near Me",
            content: {
                VStack(spacing: DesignSystem.Spacing.xl) {
                    // Success Animation/Icon
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 80))
                        .foregroundColor(DesignSystem.Colors.success)
                        .symbolRenderingMode(.hierarchical)
                    
                    VStack(spacing: DesignSystem.Spacing.lg) {
                        VStack(spacing: DesignSystem.Spacing.md) {
                            Text("Quick Start Ideas")
                                .font(DesignSystem.Typography.title3)
                                .foregroundColor(DesignSystem.Colors.textPrimary)
                            
                            VStack(spacing: DesignSystem.Spacing.sm) {
                                SeedTaskSuggestion(
                                    icon: "cart.fill",
                                    task: "Pick up groceries",
                                    location: "Grocery stores"
                                )
                                
                                SeedTaskSuggestion(
                                    icon: "fuelpump.fill",
                                    task: "Fill up gas tank",
                                    location: "Gas stations"
                                )
                                
                                SeedTaskSuggestion(
                                    icon: "envelope.fill",
                                    task: "Mail package",
                                    location: "Post offices"
                                )
                            }
                        }
                        
                        Button("Try Premium Features") {
                            showingSoftPaywall = true
                        }
                        .font(DesignSystem.Typography.buttonMedium)
                        .foregroundColor(DesignSystem.Colors.primary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, DesignSystem.Spacing.md)
                        .background(DesignSystem.Colors.primary.opacity(0.1))
                        .cornerRadius(DesignSystem.CornerRadius.md)
                    }
                }
            }
        )
        .sheet(isPresented: $showingSoftPaywall) {
            SoftPaywallView(onDismiss: {
                showingSoftPaywall = false
            })
        }
    }
}

// MARK: - Supporting Views
struct QuickAddLocationButton: View {
    let type: CommonLocation.LocationType
    let isAdded: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: DesignSystem.Spacing.sm) {
                ZStack {
                    Circle()
                        .fill(isAdded ? DesignSystem.Colors.success.opacity(0.1) : DesignSystem.Colors.primary.opacity(0.1))
                        .frame(width: 48, height: 48)
                    
                    Image(systemName: isAdded ? "checkmark" : type.icon)
                        .font(.title3)
                        .foregroundColor(isAdded ? DesignSystem.Colors.success : DesignSystem.Colors.primary)
                }
                
                Text(type.displayName)
                    .font(DesignSystem.Typography.callout)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, DesignSystem.Spacing.md)
            .background(DesignSystem.Colors.card)
            .cornerRadius(DesignSystem.CornerRadius.md)
            .designSystemShadow(DesignSystem.Shadow.small)
        }
        .disabled(isAdded)
    }
}

struct LocationRow: View {
    let location: CommonLocation
    let onDelete: () -> Void
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            Image(systemName: location.type.icon)
                .font(.title3)
                .foregroundColor(DesignSystem.Colors.primary)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(location.name)
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                if let address = location.address {
                    Text(address)
                        .font(DesignSystem.Typography.callout)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .lineLimit(1)
                }
            }
            
            Spacer()
            
            Button(action: onDelete) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title3)
                    .foregroundColor(DesignSystem.Colors.textTertiary)
            }
        }
        .padding(DesignSystem.Spacing.md)
        .background(DesignSystem.Colors.card)
        .cornerRadius(DesignSystem.CornerRadius.md)
        .designSystemShadow(DesignSystem.Shadow.small)
    }
}

struct CategorySelectionCard: View {
    let category: TaskCategory
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: DesignSystem.Spacing.sm) {
                ZStack {
                    Circle()
                        .fill(isSelected ? DesignSystem.Colors.primary.opacity(0.1) : DesignSystem.Colors.surface)
                        .frame(width: 48, height: 48)
                    
                    Image(systemName: category.icon)
                        .font(.title3)
                        .foregroundColor(isSelected ? DesignSystem.Colors.primary : DesignSystem.Colors.textSecondary)
                }
                
                Text(category.name)
                    .font(DesignSystem.Typography.callout)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, DesignSystem.Spacing.md)
            .background(isSelected ? DesignSystem.Colors.primary.opacity(0.05) : DesignSystem.Colors.card)
            .cornerRadius(DesignSystem.CornerRadius.md)
            .overlay(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .stroke(isSelected ? DesignSystem.Colors.primary : Color.clear, lineWidth: 2)
            )
            .designSystemShadow(DesignSystem.Shadow.small)
        }
    }
}

struct NotificationPreviewCard: View {
    enum NotificationType {
        case approach, arrival, postArrival
        
        var icon: String {
            switch self {
            case .approach: return "location.circle"
            case .arrival: return "location.fill"
            case .postArrival: return "clock.fill"
            }
        }
        
        var color: Color {
            switch self {
            case .approach: return DesignSystem.Colors.primary
            case .arrival: return DesignSystem.Colors.success
            case .postArrival: return DesignSystem.Colors.warning
            }
        }
    }
    
    let type: NotificationType
    let title: String
    let subtitle: String
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            Image(systemName: type.icon)
                .font(.title3)
                .foregroundColor(type.color)
            
            VStack(alignment: .leading, spacing: 2) {
                Text("Near Me")
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text(title)
                    .font(DesignSystem.Typography.callout)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                
                Text(subtitle)
                    .font(DesignSystem.Typography.callout)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
            }
            
            Spacer()
            
            Text("now")
                .font(DesignSystem.Typography.caption1)
                .foregroundColor(DesignSystem.Colors.textTertiary)
        }
        .padding(DesignSystem.Spacing.md)
        .background(DesignSystem.Colors.card)
        .cornerRadius(DesignSystem.CornerRadius.md)
        .designSystemShadow(DesignSystem.Shadow.small)
    }
}

struct FeatureBullet: View {
    let text: String
    
    var body: some View {
        HStack(alignment: .top, spacing: DesignSystem.Spacing.xs) {
            Text("•")
                .font(DesignSystem.Typography.callout)
                .foregroundColor(DesignSystem.Colors.primary)
            
            Text(text)
                .font(DesignSystem.Typography.callout)
                .foregroundColor(DesignSystem.Colors.textSecondary)
                .lineLimit(nil)
            
            Spacer()
        }
    }
}

struct SeedTaskSuggestion: View {
    let icon: String
    let task: String
    let location: String
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(DesignSystem.Colors.primary)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(task)
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text("at \(location)")
                    .font(DesignSystem.Typography.callout)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
            }
            
            Spacer()
            
            Button("Add") {
                // TODO: Add seed task
            }
            .font(DesignSystem.Typography.buttonSmall)
            .foregroundColor(DesignSystem.Colors.primary)
            .padding(.horizontal, DesignSystem.Spacing.md)
            .padding(.vertical, DesignSystem.Spacing.xs)
            .background(DesignSystem.Colors.primary.opacity(0.1))
            .cornerRadius(DesignSystem.CornerRadius.sm)
        }
        .padding(DesignSystem.Spacing.md)
        .background(DesignSystem.Colors.card)
        .cornerRadius(DesignSystem.CornerRadius.md)
        .designSystemShadow(DesignSystem.Shadow.small)
    }
}

// MARK: - Location Picker Sheet
struct LocationPickerSheet: View {
    let locationType: CommonLocation.LocationType
    let onLocationSelected: (CommonLocation) -> Void
    let onCancel: () -> Void
    
    @State private var locationName: String = ""
    @State private var address: String = ""
    @State private var isSearching = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: DesignSystem.Spacing.lg) {
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                    Text("Add \(locationType.displayName)")
                        .font(DesignSystem.Typography.title2)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    VStack(spacing: DesignSystem.Spacing.md) {
                        VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                            Text("Name")
                                .font(DesignSystem.Typography.callout)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                            
                            TextField("e.g., Home, Work, Gym", text: $locationName)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                        }
                        
                        VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                            Text("Address")
                                .font(DesignSystem.Typography.callout)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                            
                            TextField("Enter address or search", text: $address)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                        }
                    }
                }
                
                Spacer()
                
                Button("Add Location") {
                    let location = CommonLocation(
                        id: UUID().uuidString,
                        name: locationName.isEmpty ? locationType.displayName : locationName,
                        type: locationType,
                        address: address.isEmpty ? nil : address,
                        coordinate: nil // TODO: Geocode address
                    )
                    onLocationSelected(location)
                }
                .font(DesignSystem.Typography.buttonMedium)
                .foregroundColor(DesignSystem.Colors.textInverse)
                .frame(maxWidth: .infinity)
                .padding(.vertical, DesignSystem.Spacing.md)
                .background(canAddLocation ? DesignSystem.Colors.primary : DesignSystem.Colors.border)
                .cornerRadius(DesignSystem.CornerRadius.md)
                .disabled(!canAddLocation)
            }
            .padding(DesignSystem.Spacing.lg)
            .navigationTitle("Add Location")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                leading: Button("Cancel", action: onCancel)
            )
        }
        .onAppear {
            locationName = locationType.displayName
        }
    }
    
    private var canAddLocation: Bool {
        !locationName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

// MARK: - Soft Paywall View
struct SoftPaywallView: View {
    let onDismiss: () -> Void
    
    var body: some View {
        NavigationView {
            VStack(spacing: DesignSystem.Spacing.xl) {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    Text("Unlock Premium Features")
                        .font(DesignSystem.Typography.largeTitle)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                        .multilineTextAlignment(.center)
                    
                    VStack(spacing: DesignSystem.Spacing.md) {
                        PremiumFeature(
                            icon: "infinity",
                            title: "Unlimited Tasks",
                            description: "Create as many location-based reminders as you need"
                        )
                        
                        PremiumFeature(
                            icon: "speaker.wave.3.fill",
                            title: "Custom Notification Sounds",
                            description: "Choose unique sounds for different types of reminders"
                        )
                        
                        PremiumFeature(
                            icon: "slider.horizontal.3",
                            title: "Advanced Settings",
                            description: "Fine-tune geofence radii and notification timing"
                        )
                        
                        PremiumFeature(
                            icon: "chart.line.uptrend.xyaxis",
                            title: "Analytics & Insights",
                            description: "Track your productivity and completion patterns"
                        )
                    }
                }
                
                Spacer()
                
                VStack(spacing: DesignSystem.Spacing.md) {
                    Button("Start 7-Day Free Trial") {
                        // TODO: Start trial
                        onDismiss()
                    }
                    .font(DesignSystem.Typography.buttonLarge)
                    .foregroundColor(DesignSystem.Colors.textInverse)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, DesignSystem.Spacing.md)
                    .background(DesignSystem.Colors.primary)
                    .cornerRadius(DesignSystem.CornerRadius.md)
                    
                    Button("Continue with Free Version") {
                        onDismiss()
                    }
                    .font(DesignSystem.Typography.buttonMedium)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    
                    Text("$4.99/month after trial • Cancel anytime")
                        .font(DesignSystem.Typography.footnote)
                        .foregroundColor(DesignSystem.Colors.textTertiary)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(DesignSystem.Spacing.lg)
            .navigationTitle("Premium")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                trailing: Button("Skip", action: onDismiss)
            )
        }
    }
}

struct PremiumFeature: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(alignment: .top, spacing: DesignSystem.Spacing.md) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(DesignSystem.Colors.primary)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                Text(title)
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text(description)
                    .font(DesignSystem.Typography.callout)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .lineLimit(nil)
            }
            
            Spacer()
        }
    }
}