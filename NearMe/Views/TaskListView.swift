import SwiftUI

struct TaskListView: View {
    @StateObject private var taskService = TaskService.shared
    @State private var filters = TaskFilters()
    @State private var showingCreateTask = false
    @State private var showingFilters = false
    @State private var selectedTask: Task?
    @State private var showingTaskDetail = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Header
                HeaderView(
                    taskCount: taskService.tasks.count,
                    showingFilters: $showingFilters,
                    showingCreateTask: $showingCreateTask
                )
                
                // Filter Bar
                if filters.hasActiveFilters {
                    FilterBarView(filters: $filters) {
                        taskService.fetchTasks(filters: filters)
                    }
                }
                
                // Content
                if taskService.isLoading && taskService.tasks.isEmpty {
                    LoadingView()
                } else if taskService.tasks.isEmpty {
                    EmptyStateView(
                        config: emptyStateConfig,
                        onAction: nil
                    )
                } else {
                    TaskListContent(
                        tasks: taskService.tasks,
                        onTaskSelected: { task in
                            selectedTask = task
                            showingTaskDetail = true
                        },
                        onTaskCompleted: { task in
                            taskService.completeTask(id: task.id)
                        },
                        onTaskMuted: { task in
                            taskService.muteTask(id: task.id)
                        },
                        onTaskDeleted: { task in
                            taskService.deleteTask(id: task.id)
                        }
                    )
                }
            }
            .navigationBarHidden(true)
        }
        .sheet(isPresented: $showingCreateTask) {
            TaskCreationView()
        }
        .sheet(isPresented: $showingFilters) {
            TaskFiltersView(filters: $filters) {
                taskService.fetchTasks(filters: filters)
            }
        }
        .sheet(isPresented: $showingTaskDetail) {
            if let task = selectedTask {
                TaskDetailView(task: task)
            }
        }
        .onAppear {
            taskService.fetchTasks(filters: filters)
        }
        .refreshable {
            taskService.fetchTasks(filters: filters)
        }
    }
    
    private func clearFilters() {
        filters.clear()
        taskService.fetchTasks(filters: filters)
    }
    
    private var emptyStateConfig: EmptyStateConfig {
        if !taskService.searchText.isEmpty {
            return .noSearchResults(
                searchTerm: taskService.searchText,
                onClearSearch: {
                    taskService.searchText = ""
                    taskService.fetchTasks(filters: filters)
                },
                onCreateTask: {
                    showingCreateTask = true
                }
            )
        } else if filters.hasActiveFilters {
            return .noFilteredResults(
                filterName: filters.activeFilterName,
                onClearFilters: clearFilters,
                onCreateTask: {
                    showingCreateTask = true
                }
            )
        } else if taskService.isFirstTimeUser {
            return .noTasksFirstTime(
                onCreateTask: {
                    showingCreateTask = true
                },
                onViewExamples: {
                    // Show seed task examples
                },
                onLearnMore: {
                    // Show education flow
                }
            )
        } else {
            return .noTasksReturning(
                onCreateTask: {
                    showingCreateTask = true
                },
                onViewCompleted: {
                    // Show completed tasks
                }
            )
        }
    }
}

// MARK: - Header View
struct HeaderView: View {
    let taskCount: Int
    @Binding var showingFilters: Bool
    @Binding var showingCreateTask: Bool
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.md) {
            HStack {
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    Text("Tasks")
                        .font(DesignSystem.Typography.largeTitle)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    Text("\(taskCount) location-based reminders")
                        .font(DesignSystem.Typography.subheadline)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
                
                Spacer()
                
                HStack(spacing: DesignSystem.Spacing.sm) {
                    // Filter Button
                    Button(action: {
                        showingFilters = true
                    }) {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                            .font(.title2)
                            .foregroundColor(DesignSystem.Colors.primary)
                    }
                    .buttonStyle(PlainButtonStyle())
                    
                    // Create Task Button
                    Button(action: {
                        showingCreateTask = true
                    }) {
                        Image(systemName: "plus.circle.fill")
                            .font(.title2)
                            .foregroundColor(DesignSystem.Colors.primary)
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }
        }
        .padding(.horizontal, DesignSystem.Spacing.padding)
        .padding(.top, DesignSystem.Spacing.sm)
    }
}

// MARK: - Filter Bar View
struct FilterBarView: View {
    @Binding var filters: TaskFilters
    let onApply: () -> Void
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: DesignSystem.Spacing.sm) {
                ForEach(activeFilters, id: \.title) { filter in
                    FilterChip(
                        title: filter.title,
                        onRemove: {
                            removeFilter(filter.type)
                            onApply()
                        }
                    )
                }
            }
            .padding(.horizontal, DesignSystem.Spacing.padding)
        }
        .padding(.vertical, DesignSystem.Spacing.sm)
        .background(DesignSystem.Colors.surface)
    }
    
    private var activeFilters: [FilterItem] {
        var items: [FilterItem] = []
        
        if let status = filters.status {
            items.append(FilterItem(title: status.displayName, type: .status))
        }
        if let locationType = filters.locationType {
            items.append(FilterItem(title: locationType.displayName, type: .locationType))
        }
        if let poiCategory = filters.poiCategory {
            items.append(FilterItem(title: poiCategory.displayName, type: .poiCategory))
        }
        
        return items
    }
    
    private func removeFilter(_ type: FilterType) {
        switch type {
        case .status:
            filters.status = nil
        case .locationType:
            filters.locationType = nil
        case .poiCategory:
            filters.poiCategory = nil
        }
    }
}

// MARK: - Filter Item
struct FilterItem {
    let title: String
    let type: FilterType
}

enum FilterType {
    case status
    case locationType
    case poiCategory
}

// MARK: - Filter Chip
struct FilterChip: View {
    let title: String
    let onRemove: () -> Void
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.xs) {
            Text(title)
                .font(DesignSystem.Typography.caption1)
                .foregroundColor(DesignSystem.Colors.primary)
            
            Button(action: onRemove) {
                Image(systemName: "xmark.circle.fill")
                    .font(.caption)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
            }
        }
        .padding(.horizontal, DesignSystem.Spacing.sm)
        .padding(.vertical, DesignSystem.Spacing.xs)
        .background(DesignSystem.Colors.primary.opacity(0.1))
        .designSystemCornerRadius(DesignSystem.CornerRadius.round)
    }
}

// MARK: - Task List Content
struct TaskListContent: View {
    let tasks: [Task]
    let onTaskSelected: (Task) -> Void
    let onTaskCompleted: (Task) -> Void
    let onTaskMuted: (Task) -> Void
    let onTaskDeleted: (Task) -> Void
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: DesignSystem.Spacing.md) {
                ForEach(tasks) { task in
                    TaskCard(
                        task: task,
                        onTap: { onTaskSelected(task) },
                        onComplete: { onTaskCompleted(task) },
                        onMute: { onTaskMuted(task) },
                        onDelete: { onTaskDeleted(task) }
                    )
                }
            }
            .padding(.horizontal, DesignSystem.Spacing.padding)
            .padding(.top, DesignSystem.Spacing.md)
        }
    }
}

// MARK: - Task Card
struct TaskCard: View {
    let task: Task
    let onTap: () -> Void
    let onComplete: () -> Void
    let onMute: () -> Void
    let onDelete: () -> Void
    
    @State private var showingActions = false
    
    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                        Text(task.title)
                            .font(DesignSystem.Typography.title3)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                            .multilineTextAlignment(.leading)
                        
                        if let description = task.description {
                            Text(description)
                                .font(DesignSystem.Typography.body)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                                .multilineTextAlignment(.leading)
                                .lineLimit(2)
                        }
                    }
                    
                    Spacer()
                    
                    // Status Badge
                    StatusBadge(status: task.status)
                }
                
                // Location Info
                HStack(spacing: DesignSystem.Spacing.sm) {
                    Image(systemName: locationIcon)
                        .foregroundColor(DesignSystem.Colors.primary)
                        .font(.title3)
                    
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                        Text(locationTitle)
                            .font(DesignSystem.Typography.bodyEmphasized)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                        
                        Text(locationSubtitle)
                            .font(DesignSystem.Typography.caption1)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                    }
                    
                    Spacer()
                }
                
                // Geofence Settings
                GeofenceSettingsRow(customRadii: task.customRadii)
                
                // Actions
                HStack(spacing: DesignSystem.Spacing.sm) {
                    if task.status == .active {
                        ActionButton(
                            title: "Complete",
                            icon: "checkmark.circle.fill",
                            color: DesignSystem.Colors.success,
                            action: onComplete
                        )
                        
                        ActionButton(
                            title: "Mute",
                            icon: "speaker.slash.fill",
                            color: DesignSystem.Colors.warning,
                            action: onMute
                        )
                    } else if task.status == .completed {
                        ActionButton(
                            title: "Reactivate",
                            icon: "arrow.clockwise.circle.fill",
                            color: DesignSystem.Colors.primary,
                            action: onComplete
                        )
                    } else if task.status == .muted {
                        ActionButton(
                            title: "Unmute",
                            icon: "speaker.fill",
                            color: DesignSystem.Colors.primary,
                            action: onComplete
                        )
                    }
                    
                    Spacer()
                    
                    ActionButton(
                        title: "Delete",
                        icon: "trash.fill",
                        color: DesignSystem.Colors.error,
                        action: onDelete
                    )
                }
            }
            .padding(DesignSystem.Spacing.md)
            .background(DesignSystem.Colors.surface)
            .designSystemCornerRadius()
            .designSystemShadow(DesignSystem.Shadow.small)
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var locationIcon: String {
        switch task.locationType {
        case .customPlace:
            return "mappin.circle.fill"
        case .poiCategory:
            return task.poiCategory?.icon ?? "location.circle.fill"
        }
    }
    
    private var locationTitle: String {
        switch task.locationType {
        case .customPlace:
            return "Custom Place"
        case .poiCategory:
            return task.poiCategory?.displayName ?? "POI Category"
        }
    }
    
    private var locationSubtitle: String {
        switch task.locationType {
        case .customPlace:
            return "Selected location"
        case .poiCategory:
            return "Any \(task.poiCategory?.displayName.lowercased() ?? "location")"
        }
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

// MARK: - Geofence Settings Row
struct GeofenceSettingsRow: View {
    let customRadii: GeofenceRadii?
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            SettingIcon(
                icon: "location.circle.fill",
                value: "\(Int(customRadii?.approach ?? GeofenceRadii.default.approach)) mi"
            )
            
            SettingIcon(
                icon: "target",
                value: "\(Int(customRadii?.arrival ?? GeofenceRadii.default.arrival)) m"
            )
            
            if customRadii?.postArrival == true {
                SettingIcon(
                    icon: "clock.fill",
                    value: "Post-arrival"
                )
            }
            
            Spacer()
        }
    }
}

// MARK: - Setting Icon
struct SettingIcon: View {
    let icon: String
    let value: String
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.xs) {
            Image(systemName: icon)
                .foregroundColor(DesignSystem.Colors.textSecondary)
                .font(.caption)
            
            Text(value)
                .font(DesignSystem.Typography.caption1)
                .foregroundColor(DesignSystem.Colors.textSecondary)
        }
    }
}

// MARK: - Action Button
struct ActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignSystem.Spacing.xs) {
                Image(systemName: icon)
                    .font(.caption)
                Text(title)
                    .font(DesignSystem.Typography.caption1)
            }
            .foregroundColor(color)
            .padding(.horizontal, DesignSystem.Spacing.sm)
            .padding(.vertical, DesignSystem.Spacing.xs)
            .background(color.opacity(0.1))
            .designSystemCornerRadius(DesignSystem.CornerRadius.xs)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Loading View
struct LoadingView: View {
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.lg) {
            ProgressView()
                .scaleEffect(1.2)
            
            Text("Loading tasks...")
                .font(DesignSystem.Typography.body)
                .foregroundColor(DesignSystem.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Empty State View
struct EmptyStateView: View {
    let title: String
    let subtitle: String
    let icon: String
    let actionTitle: String
    let action: () -> Void
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 60))
                .foregroundColor(DesignSystem.Colors.textTertiary)
            
            VStack(spacing: DesignSystem.Spacing.sm) {
                Text(title)
                    .font(DesignSystem.Typography.title2)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text(subtitle)
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            
            Button(action: action) {
                Text(actionTitle)
                    .font(DesignSystem.Typography.buttonMedium)
                    .foregroundColor(.white)
                    .padding(.horizontal, DesignSystem.Spacing.lg)
                    .padding(.vertical, DesignSystem.Spacing.md)
                    .background(DesignSystem.Colors.primary)
                    .designSystemCornerRadius()
                    .designSystemShadow(DesignSystem.Shadow.small)
            }
            .buttonStyle(PlainButtonStyle())
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(DesignSystem.Spacing.padding)
    }
}

// MARK: - Preview
struct TaskListView_Previews: PreviewProvider {
    static var previews: some View {
        TaskListView()
    }
}
