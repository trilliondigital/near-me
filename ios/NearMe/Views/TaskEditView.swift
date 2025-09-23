import SwiftUI

struct TaskEditView: View {
    @Environment(\.presentationMode) var presentationMode
    @StateObject private var taskService = TaskService.shared
    
    let task: Task
    
    // Form state
    @State private var title: String
    @State private var description: String
    @State private var locationType: LocationType
    @State private var selectedPlace: Place?
    @State private var selectedPOICategory: POICategory
    @State private var customRadii: GeofenceRadii
    @State private var showingLocationSelection = false
    @State private var showingPOISelection = false
    @State private var showingRadiusCustomization = false
    
    // UI state
    @State private var isUpdating = false
    @State private var showingError = false
    
    init(task: Task) {
        self.task = task
        
        // Initialize state with task values
        self._title = State(initialValue: task.title)
        self._description = State(initialValue: task.description ?? "")
        self._locationType = State(initialValue: task.locationType)
        self._selectedPlace = State(initialValue: nil) // Would need to fetch place details
        self._selectedPOICategory = State(initialValue: task.poiCategory ?? .gas)
        self._customRadii = State(initialValue: task.customRadii ?? GeofenceRadii.default)
    }
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    // Header
                    VStack(spacing: DesignSystem.Spacing.sm) {
                        Text("Edit Task")
                            .font(DesignSystem.Typography.title1)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                        
                        Text("Modify your location-based reminder")
                            .font(DesignSystem.Typography.subheadline)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                    }
                    .padding(.top, DesignSystem.Spacing.lg)
                    
                    // Task Details Section
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                        SectionHeader(title: "Task Details", icon: "checkmark.circle.fill")
                        
                        VStack(spacing: DesignSystem.Spacing.md) {
                            // Title Field
                            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                                Text("Title")
                                    .font(DesignSystem.Typography.bodyEmphasized)
                                    .foregroundColor(DesignSystem.Colors.textPrimary)
                                
                                TextField("Enter task title", text: $title)
                                    .textFieldStyle(CustomTextFieldStyle())
                            }
                            
                            // Description Field
                            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                                Text("Description (Optional)")
                                    .font(DesignSystem.Typography.bodyEmphasized)
                                    .foregroundColor(DesignSystem.Colors.textPrimary)
                                
                                TextField("Enter task description", text: $description, axis: .vertical)
                                    .textFieldStyle(CustomTextFieldStyle())
                                    .lineLimit(3...6)
                            }
                        }
                    }
                    .padding(.horizontal, DesignSystem.Spacing.padding)
                    
                    // Location Selection Section
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                        SectionHeader(title: "Location", icon: "location.fill")
                        
                        VStack(spacing: DesignSystem.Spacing.md) {
                            // Location Type Selection
                            VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                                Text("Location Type")
                                    .font(DesignSystem.Typography.bodyEmphasized)
                                    .foregroundColor(DesignSystem.Colors.textPrimary)
                                
                                Picker("Location Type", selection: $locationType) {
                                    ForEach(LocationType.allCases, id: \.self) { type in
                                        Text(type.displayName)
                                            .tag(type)
                                    }
                                }
                                .pickerStyle(SegmentedPickerStyle())
                            }
                            
                            // Location Selection based on type
                            if locationType == .customPlace {
                                CustomPlaceSelectionView(
                                    selectedPlace: $selectedPlace,
                                    showingLocationSelection: $showingLocationSelection
                                )
                            } else {
                                POICategorySelectionView(
                                    selectedCategory: $selectedPOICategory,
                                    showingPOISelection: $showingPOISelection
                                )
                            }
                        }
                    }
                    .padding(.horizontal, DesignSystem.Spacing.padding)
                    
                    // Geofence Settings Section
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                        SectionHeader(title: "Reminder Settings", icon: "bell.fill")
                        
                        VStack(spacing: DesignSystem.Spacing.md) {
                            // Current Settings Display
                            GeofenceSettingsDisplayView(
                                locationType: locationType,
                                selectedPlace: selectedPlace,
                                selectedPOICategory: selectedPOICategory,
                                customRadii: customRadii
                            )
                            
                            // Customize Button
                            Button(action: {
                                showingRadiusCustomization = true
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
        }
        .sheet(isPresented: $showingLocationSelection) {
            LocationSelectionView(selectedPlace: $selectedPlace)
        }
        .sheet(isPresented: $showingPOISelection) {
            POISelectionView(selectedCategory: $selectedPOICategory)
        }
        .sheet(isPresented: $showingRadiusCustomization) {
            RadiusCustomizationView(
                customRadii: $customRadii,
                locationType: locationType,
                selectedPOICategory: selectedPOICategory
            )
        }
        .alert("Error", isPresented: $showingError) {
            Button("OK") {
                taskService.clearError()
            }
        } message: {
            Text(taskService.error?.localizedDescription ?? "Unknown error occurred")
        }
        .onChange(of: taskService.error) { error in
            showingError = error != nil
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
                
                // Save Button
                Button(action: updateTask) {
                    HStack {
                        if isUpdating {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(0.8)
                        } else {
                            Image(systemName: "checkmark.circle.fill")
                        }
                        Text(isUpdating ? "Saving..." : "Save Changes")
                    }
                    .font(DesignSystem.Typography.buttonMedium)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(canUpdateTask ? DesignSystem.Colors.primary : DesignSystem.Colors.textTertiary)
                    .designSystemCornerRadius()
                    .designSystemShadow(DesignSystem.Shadow.small)
                }
                .buttonStyle(PlainButtonStyle())
                .disabled(!canUpdateTask || isUpdating)
            }
            .padding(.horizontal, DesignSystem.Spacing.padding)
            .padding(.vertical, DesignSystem.Spacing.md)
            .background(DesignSystem.Colors.background)
        }
    }
    
    // MARK: - Validation
    private var canUpdateTask: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        ((locationType == .customPlace && selectedPlace != nil) ||
         (locationType == .poiCategory))
    }
    
    // MARK: - Actions
    private func updateTask() {
        guard canUpdateTask else { return }
        
        isUpdating = true
        
        let request = UpdateTaskRequest(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : description.trimmingCharacters(in: .whitespacesAndNewlines),
            locationType: locationType,
            placeId: selectedPlace?.id,
            poiCategory: locationType == .poiCategory ? selectedPOICategory : nil,
            customRadii: customRadii,
            status: nil // Don't change status when editing
        )
        
        taskService.updateTask(id: task.id, request: request)
        
        // Handle completion
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            isUpdating = false
            if taskService.error == nil {
                presentationMode.wrappedValue.dismiss()
            }
        }
    }
}

// MARK: - Supporting Views (reused from TaskCreationView)

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
struct TaskEditView_Previews: PreviewProvider {
    static var previews: some View {
        let sampleTask = Task(
            id: "1",
            userId: "user1",
            title: "Buy groceries",
            description: "Remember to get milk, bread, and eggs",
            locationType: .poiCategory,
            placeId: nil,
            poiCategory: .grocery,
            customRadii: GeofenceRadii.default,
            status: .active,
            createdAt: Date(),
            completedAt: nil,
            updatedAt: Date()
        )
        
        TaskEditView(task: sampleTask)
    }
}
