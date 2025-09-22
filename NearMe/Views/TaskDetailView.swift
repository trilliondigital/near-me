import SwiftUI
import CoreLocation

struct TaskDetailView: View {
    @Environment(\.presentationMode) var presentationMode
    @StateObject private var taskService = TaskService.shared
    
    let task: Task
    
    @State private var showingEditTask = false
    @State private var showingDeleteConfirmation = false
    @State private var showingError = false
    @State private var errorMessage = ""
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    // Header
                    VStack(spacing: DesignSystem.Spacing.md) {
                        // Status Badge
                        HStack {
                            StatusBadge(status: task.status)
                            Spacer()
                        }
                        
                        // Title and Description
                        VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                            Text(task.title)
                                .font(DesignSystem.Typography.title1)
                                .foregroundColor(DesignSystem.Colors.textPrimary)
                                .multilineTextAlignment(.leading)
                            
                            if let description = task.description {
                                Text(description)
                                    .font(DesignSystem.Typography.body)
                                    .foregroundColor(DesignSystem.Colors.textSecondary)
                                    .multilineTextAlignment(.leading)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.horizontal, DesignSystem.Spacing.padding)
                    .padding(.top, DesignSystem.Spacing.lg)
                    
                    // Location Information
                    LocationInfoSection(task: task)
                    
                    // Geofence Settings
                    GeofenceSettingsSection(customRadii: task.customRadii)
                    
                    // Task Metadata
                    TaskMetadataSection(task: task)
                    
                    // Actions
                    ActionsSection(
                        task: task,
                        onEdit: { showingEditTask = true },
                        onComplete: completeTask,
                        onMute: muteTask,
                        onDelete: { showingDeleteConfirmation = true }
                    )
                    
                    Spacer(minLength: DesignSystem.Spacing.xxl)
                }
            }
            .navigationTitle("Task Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Edit") {
                        showingEditTask = true
                    }
                }
            }
        }
        .sheet(isPresented: $showingEditTask) {
            TaskEditView(task: task)
        }
        .alert("Delete Task", isPresented: $showingDeleteConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                deleteTask()
            }
        } message: {
            Text("Are you sure you want to delete this task? This action cannot be undone.")
        }
        .alert("Error", isPresented: $showingError) {
            Button("OK") { }
        } message: {
            Text(errorMessage)
        }
    }
    
    private func completeTask() {
        taskService.completeTask(id: task.id)
        presentationMode.wrappedValue.dismiss()
    }
    
    private func muteTask() {
        taskService.muteTask(id: task.id)
        presentationMode.wrappedValue.dismiss()
    }
    
    private func deleteTask() {
        taskService.deleteTask(id: task.id)
        presentationMode.wrappedValue.dismiss()
    }
}

// MARK: - Location Info Section
struct LocationInfoSection: View {
    let task: Task
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
            SectionHeader(title: "Location", icon: "location.fill")
            
            VStack(spacing: DesignSystem.Spacing.md) {
                // Location Type
                InfoRow(
                    icon: "location.circle.fill",
                    title: "Location Type",
                    value: task.locationType.displayName,
                    color: DesignSystem.Colors.primary
                )
                
                // Specific Location Info
                if task.locationType == .customPlace {
                    InfoRow(
                        icon: "mappin.circle.fill",
                        title: "Custom Place",
                        value: "Selected location",
                        color: DesignSystem.Colors.secondary
                    )
                } else if let poiCategory = task.poiCategory {
                    InfoRow(
                        icon: poiCategory.icon,
                        title: "POI Category",
                        value: poiCategory.displayName,
                        color: DesignSystem.Colors.secondary
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

// MARK: - Geofence Settings Section
struct GeofenceSettingsSection: View {
    let customRadii: GeofenceRadii?
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
            SectionHeader(title: "Reminder Settings", icon: "bell.fill")
            
            VStack(spacing: DesignSystem.Spacing.md) {
                let radii = customRadii ?? GeofenceRadii.default
                
                InfoRow(
                    icon: "location.circle.fill",
                    title: "Approach Distance",
                    value: "\(Int(radii.approach)) miles",
                    color: DesignSystem.Colors.primary
                )
                
                InfoRow(
                    icon: "target",
                    title: "Arrival Distance",
                    value: "\(Int(radii.arrival)) meters",
                    color: DesignSystem.Colors.secondary
                )
                
                if radii.postArrival {
                    InfoRow(
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

// MARK: - Task Metadata Section
struct TaskMetadataSection: View {
    let task: Task
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
            SectionHeader(title: "Task Information", icon: "info.circle.fill")
            
            VStack(spacing: DesignSystem.Spacing.md) {
                InfoRow(
                    icon: "calendar",
                    title: "Created",
                    value: DateFormatter.taskDateFormatter.string(from: task.createdAt),
                    color: DesignSystem.Colors.textSecondary
                )
                
                if let completedAt = task.completedAt {
                    InfoRow(
                        icon: "checkmark.circle.fill",
                        title: "Completed",
                        value: DateFormatter.taskDateFormatter.string(from: completedAt),
                        color: DesignSystem.Colors.success
                    )
                }
                
                InfoRow(
                    icon: "arrow.clockwise",
                    title: "Last Updated",
                    value: DateFormatter.taskDateFormatter.string(from: task.updatedAt),
                    color: DesignSystem.Colors.textSecondary
                )
            }
            .padding(DesignSystem.Spacing.md)
            .background(DesignSystem.Colors.surface)
            .designSystemCornerRadius()
            .designSystemShadow(DesignSystem.Shadow.small)
        }
        .padding(.horizontal, DesignSystem.Spacing.padding)
    }
}

// MARK: - Actions Section
struct ActionsSection: View {
    let task: Task
    let onEdit: () -> Void
    let onComplete: () -> Void
    let onMute: () -> Void
    let onDelete: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
            SectionHeader(title: "Actions", icon: "gearshape.fill")
            
            VStack(spacing: DesignSystem.Spacing.md) {
                // Primary Actions
                if task.status == .active {
                    ActionRow(
                        icon: "checkmark.circle.fill",
                        title: "Mark as Complete",
                        subtitle: "Mark this task as completed",
                        color: DesignSystem.Colors.success,
                        action: onComplete
                    )
                    
                    ActionRow(
                        icon: "speaker.slash.fill",
                        title: "Mute Task",
                        subtitle: "Stop receiving notifications for this task",
                        color: DesignSystem.Colors.warning,
                        action: onMute
                    )
                } else if task.status == .completed {
                    ActionRow(
                        icon: "arrow.clockwise.circle.fill",
                        title: "Reactivate Task",
                        subtitle: "Mark this task as active again",
                        color: DesignSystem.Colors.primary,
                        action: onComplete
                    )
                } else if task.status == .muted {
                    ActionRow(
                        icon: "speaker.fill",
                        title: "Unmute Task",
                        subtitle: "Start receiving notifications again",
                        color: DesignSystem.Colors.primary,
                        action: onComplete
                    )
                }
                
                Divider()
                    .background(DesignSystem.Colors.border)
                
                // Secondary Actions
                ActionRow(
                    icon: "pencil.circle.fill",
                    title: "Edit Task",
                    subtitle: "Modify task details and settings",
                    color: DesignSystem.Colors.secondary,
                    action: onEdit
                )
                
                ActionRow(
                    icon: "trash.circle.fill",
                    title: "Delete Task",
                    subtitle: "Permanently remove this task",
                    color: DesignSystem.Colors.error,
                    action: onDelete
                )
            }
            .padding(DesignSystem.Spacing.md)
            .background(DesignSystem.Colors.surface)
            .designSystemCornerRadius()
            .designSystemShadow(DesignSystem.Shadow.small)
        }
        .padding(.horizontal, DesignSystem.Spacing.padding)
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

// MARK: - Info Row
struct InfoRow: View {
    let icon: String
    let title: String
    let value: String
    let color: Color
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            Image(systemName: icon)
                .foregroundColor(color)
                .font(.title3)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                Text(title)
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text(value)
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
            }
            
            Spacer()
        }
    }
}

// MARK: - Action Row
struct ActionRow: View {
    let icon: String
    let title: String
    let subtitle: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignSystem.Spacing.md) {
                Image(systemName: icon)
                    .foregroundColor(color)
                    .font(.title3)
                    .frame(width: 24)
                
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    Text(title)
                        .font(DesignSystem.Typography.bodyEmphasized)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    Text(subtitle)
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .font(.caption)
            }
            .padding(.vertical, DesignSystem.Spacing.sm)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Status Badge
struct StatusBadge: View {
    let status: TaskStatus
    
    var body: some View {
        Text(status.displayName)
            .font(DesignSystem.Typography.caption1)
            .foregroundColor(.white)
            .padding(.horizontal, DesignSystem.Spacing.sm)
            .padding(.vertical, DesignSystem.Spacing.xs)
            .background(Color(status.color))
            .designSystemCornerRadius(DesignSystem.CornerRadius.xs)
    }
}

// MARK: - Date Formatter Extension
extension DateFormatter {
    static let taskDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
}

// MARK: - Preview
struct TaskDetailView_Previews: PreviewProvider {
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
        
        TaskDetailView(task: sampleTask)
    }
}
