import SwiftUI
import CoreLocation

struct TaskCreationView: View {
    @Environment(\.presentationMode) var presentationMode
    @StateObject private var viewModel = TaskCreationViewModel()
    @StateObject private var workflowCoordinator = TaskWorkflowCoordinator.shared
    @StateObject private var locationManager = LocationManager()
    
    @State private var showingSuccessToast = false
    @State private var showingWorkflowProgress = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    // Header
                    VStack(spacing: DesignSystem.Spacing.sm) {
                        Text("Create New Task")
                            .font(DesignSystem.Typography.title1)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                        
                        Text("Set up a location-based reminder")
                            .font(DesignSystem.Typography.subheadline)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                    }
                    .padding(.top, DesignSystem.Spacing.lg)
                    
                    // Task Details Section
                    FormSection(title: "Task Details", icon: "checkmark.circle.fill") {
                        VStack(spacing: DesignSystem.Spacing.md) {
                            ValidatedTextField(
                                title: "Title",
                                placeholder: "Enter task title",
                                text: $viewModel.title,
                                isRequired: true,
                                validation: TaskFormValidation.validateTitle
                            )
                            
                            ValidatedTextField(
                                title: "Description (Optional)",
                                placeholder: "Enter task description",
                                text: $viewModel.description,
                                validation: TaskFormValidation.validateDescription
                            )
                        }
                    }
                    .padding(.horizontal, DesignSystem.Spacing.padding)
                    
                    // Location Selection Section
                    FormSection(title: "Location", icon: "location.fill") {
                        VStack(spacing: DesignSystem.Spacing.md) {
                            LocationTypePicker(selectedType: $viewModel.locationType)
                            
                            // Location Selection based on type
                            if viewModel.locationType == .customPlace {
                                CustomPlaceSelectionView(
                                    selectedPlace: $viewModel.selectedPlace,
                                    showingLocationSelection: $viewModel.showingLocationSelection
                                )
                            } else {
                                POICategorySelectionView(
                                    selectedCategory: $viewModel.selectedPOICategory,
                                    showingPOISelection: $viewModel.showingPOISelection
                                )
                            }
                        }
                    }
                    .padding(.horizontal, DesignSystem.Spacing.padding)
                    
                    // Geofence Settings Section
                    FormSection(title: "Reminder Settings", icon: "bell.fill") {
                        VStack(spacing: DesignSystem.Spacing.md) {
                            // Current Settings Display
                            GeofenceSettingsDisplayView(
                                locationType: viewModel.locationType,
                                selectedPlace: viewModel.selectedPlace,
                                selectedPOICategory: viewModel.selectedPOICategory,
                                customRadii: viewModel.customRadii
                            )
                            
                            // Customize Button
                            Button(action: {
                                viewModel.showingRadiusCustomization = true
                            }) {
                                HStack {
                                    Image(systemName: "slider.horizontal.3")
                                    Text("Customize Reminder Distance")
                                }
                                .font(DesignSystem.Typography.buttonMedium)
                                .foregroundColor(DesignSystem.Colors.primary)
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    }
                    .padding(.horizontal, DesignSystem.Spacing.padding)
                    
                    Spacer(minLength: DesignSystem.Spacing.xxl)
                }
            }
            .navigationBarHidden(true)
            .overlay(
                // Bottom Action Bar
                VStack {
                    Spacer()
                    BottomActionBar()
                }
            )
            .overlay(
                // Loading Overlay
                LoadingOverlay(
                    isLoading: workflowCoordinator.workflowState.isProcessing,
                    message: workflowCoordinator.workflowMessage
                )
            )
            .overlay(
                // Success Toast
                VStack {
                    ToastMessage(
                        message: "Task created successfully!",
                        type: .success,
                        isShowing: showingSuccessToast
                    )
                    .padding(.top, 50)
                    
                    Spacer()
                }
            )
        }
        .sheet(isPresented: $viewModel.showingLocationSelection) {
            LocationSelectionView(selectedPlace: $viewModel.selectedPlace)
        }
        .sheet(isPresented: $viewModel.showingPOISelection) {
            POISelectionView(selectedCategory: $viewModel.selectedPOICategory)
        }
        .sheet(isPresented: $viewModel.showingRadiusCustomization) {
            RadiusCustomizationView(
                customRadii: $viewModel.customRadii,
                locationType: viewModel.locationType,
                selectedPOICategory: viewModel.selectedPOICategory
            )
        }
        .alert("Error", isPresented: $viewModel.showingError) {
            Button("OK") {
                viewModel.showingError = false
            }
        } message: {
            Text(viewModel.errorMessage)
        }
        .onChange(of: workflowCoordinator.workflowState) { state in
            if state.isCompleted {
                showingSuccessToast = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                    showingSuccessToast = false
                    presentationMode.wrappedValue.dismiss()
                }
            }
        }
    }
    
    // MARK: - Bottom Action Bar
    @ViewBuilder
    private func BottomActionBar() -> some View {
        VStack(spacing: 0) {
            Divider()
                .background(DesignSystem.Colors.border)
            
            HStack(spacing: DesignSystem.Spacing.md) {
                // Cancel Button
                Button(action: {
                    presentationMode.wrappedValue.dismiss()
                }) {
                    Text("Cancel")
                        .font(DesignSystem.Typography.buttonMedium)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(DesignSystem.Colors.surface)
                        .designSystemCornerRadius()
                        .designSystemShadow(DesignSystem.Shadow.small)
                }
                .buttonStyle(PlainButtonStyle())
                
                // Create Button
                Button(action: createTask) {
                    HStack {
                        if viewModel.isCreating || workflowCoordinator.workflowState.isProcessing {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(0.8)
                        } else {
                            Image(systemName: "plus.circle.fill")
                        }
                        Text(buttonTitle)
                    }
                    .font(DesignSystem.Typography.buttonMedium)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(viewModel.canCreateTask ? DesignSystem.Colors.primary : DesignSystem.Colors.textTertiary)
                    .designSystemCornerRadius()
                    .designSystemShadow(DesignSystem.Shadow.small)
                }
                .buttonStyle(PlainButtonStyle())
                .disabled(!viewModel.canCreateTask || viewModel.isCreating || workflowCoordinator.workflowState.isProcessing)
            }
            .padding(.horizontal, DesignSystem.Spacing.padding)
            .padding(.vertical, DesignSystem.Spacing.md)
            .background(DesignSystem.Colors.background)
        }
    }
    
    // MARK: - Computed Properties
    private var buttonTitle: String {
        if workflowCoordinator.workflowState.isProcessing {
            return workflowCoordinator.workflowMessage
        } else if viewModel.isCreating {
            return "Creating..."
        } else {
            return "Create Task"
        }
    }
    
    // MARK: - Actions
    private func createTask() {
        guard viewModel.canCreateTask else { return }
        
        let request = CreateTaskRequest(
            title: viewModel.title.trimmingCharacters(in: .whitespacesAndNewlines),
            description: viewModel.description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : viewModel.description.trimmingCharacters(in: .whitespacesAndNewlines),
            locationType: viewModel.locationType,
            placeId: viewModel.selectedPlace?.id,
            poiCategory: viewModel.locationType == .poiCategory ? viewModel.selectedPOICategory : nil,
            customRadii: viewModel.customRadii
        )
        
        workflowCoordinator.startTaskCreationWorkflow(request: request)
    }
}

// MARK: - Supporting Views

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

struct CustomTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(DesignSystem.Spacing.md)
            .background(DesignSystem.Colors.surface)
            .designSystemCornerRadius()
            .designSystemShadow(DesignSystem.Shadow.small)
            .overlay(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .stroke(DesignSystem.Colors.border, lineWidth: 1)
            )
    }
}

struct CustomPlaceSelectionView: View {
    @Binding var selectedPlace: Place?
    @Binding var showingLocationSelection: Bool
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
            Text("Custom Place")
                .font(DesignSystem.Typography.bodyEmphasized)
                .foregroundColor(DesignSystem.Colors.textPrimary)
            
            Button(action: {
                showingLocationSelection = true
            }) {
                HStack {
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                        Text(selectedPlace?.name ?? "Select a place")
                            .font(DesignSystem.Typography.body)
                            .foregroundColor(selectedPlace != nil ? DesignSystem.Colors.textPrimary : DesignSystem.Colors.textSecondary)
                        
                        if let place = selectedPlace {
                            Text(place.address ?? "Custom location")
                                .font(DesignSystem.Typography.caption1)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                        }
                    }
                    
                    Spacer()
                    
                    Image(systemName: "chevron.right")
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .font(.caption)
                }
                .padding(DesignSystem.Spacing.md)
                .background(DesignSystem.Colors.surface)
                .designSystemCornerRadius()
                .designSystemShadow(DesignSystem.Shadow.small)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                        .stroke(DesignSystem.Colors.border, lineWidth: 1)
                )
            }
            .buttonStyle(PlainButtonStyle())
        }
    }
}

struct POICategorySelectionView: View {
    @Binding var selectedCategory: POICategory
    @Binding var showingPOISelection: Bool
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
            Text("POI Category")
                .font(DesignSystem.Typography.bodyEmphasized)
                .foregroundColor(DesignSystem.Colors.textPrimary)
            
            Button(action: {
                showingPOISelection = true
            }) {
                HStack {
                    Image(systemName: selectedCategory.icon)
                        .foregroundColor(DesignSystem.Colors.primary)
                        .font(.title3)
                    
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                        Text(selectedCategory.displayName)
                            .font(DesignSystem.Typography.body)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                        
                        Text("Remind me when I'm near any \(selectedCategory.displayName.lowercased())")
                            .font(DesignSystem.Typography.caption1)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                    }
                    
                    Spacer()
                    
                    Image(systemName: "chevron.right")
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .font(.caption)
                }
                .padding(DesignSystem.Spacing.md)
                .background(DesignSystem.Colors.surface)
                .designSystemCornerRadius()
                .designSystemShadow(DesignSystem.Shadow.small)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                        .stroke(DesignSystem.Colors.border, lineWidth: 1)
                )
            }
            .buttonStyle(PlainButtonStyle())
        }
    }
}

struct GeofenceSettingsDisplayView: View {
    let locationType: LocationType
    let selectedPlace: Place?
    let selectedPOICategory: POICategory
    let customRadii: GeofenceRadii
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
            Text("Current Settings")
                .font(DesignSystem.Typography.bodyEmphasized)
                .foregroundColor(DesignSystem.Colors.textPrimary)
            
            VStack(spacing: DesignSystem.Spacing.sm) {
                SettingRow(
                    icon: "location.circle.fill",
                    title: "Approach Distance",
                    value: "\(Int(customRadii.approach)) miles"
                )
                
                SettingRow(
                    icon: "target",
                    title: "Arrival Distance",
                    value: "\(Int(customRadii.arrival)) meters"
                )
                
                if customRadii.postArrival {
                    SettingRow(
                        icon: "clock.fill",
                        title: "Post-Arrival",
                        value: "Enabled"
                    )
                }
            }
            .padding(DesignSystem.Spacing.md)
            .background(DesignSystem.Colors.surface)
            .designSystemCornerRadius()
            .designSystemShadow(DesignSystem.Shadow.small)
        }
    }
}

struct SettingRow: View {
    let icon: String
    let title: String
    let value: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(DesignSystem.Colors.primary)
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

// MARK: - Preview
struct TaskCreationView_Previews: PreviewProvider {
    static var previews: some View {
        TaskCreationView()
    }
}
