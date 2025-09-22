import SwiftUI

struct TaskDashboardView: View {
    @StateObject private var viewModel = TaskListViewModel()
    @StateObject private var workflowCoordinator = TaskWorkflowCoordinator.shared
    @State private var showingQuickActions = false
    @State private var selectedQuickAction: QuickAction?
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    // Header with Stats
                    TaskStatsHeader(tasks: viewModel.tasks)
                    
                    // Quick Actions
                    QuickActionsSection(
                        onCreateTask: { viewModel.showingCreateTask = true },
                        onShowFilters: { viewModel.showingFilters = true },
                        onRefresh: { viewModel.refreshTasks() }
                    )
                    
                    // Active Filters
                    if viewModel.filters.hasActiveFilters {
                        ActiveFiltersSection(
                            filters: viewModel.filters,
                            onClearFilters: { viewModel.clearFilters() }
                        )
                    }
                    
                    // Task Sections
                    TaskSectionsView(
                        tasks: viewModel.tasks,
                        onTaskSelected: { viewModel.selectTask($0) },
                        onTaskAction: handleTaskAction
                    )
                    
                    // Empty State
                    if viewModel.tasks.isEmpty && !viewModel.isLoading {
                        EmptyTasksView(
                            hasFilters: viewModel.filters.hasActiveFilters,
                            onCreateTask: { viewModel.showingCreateTask = true },
                            onClearFilters: { viewModel.clearFilters() }
                        )
                    }
                }
                .padding(.horizontal, DesignSystem.Spacing.padding)
            }
            .navigationTitle("Tasks")
            .navigationBarTitleDisplayMode(.large)
            .refreshable {
                viewModel.refreshTasks()
            }
        }
        .sheet(isPresented: $viewModel.showingCreateTask) {
            TaskCreationView()
        }
        .sheet(isPresented: $viewModel.showingFilters) {
            TaskFiltersView(filters: $viewModel.filters) {
                viewModel.applyFilters()
            }
        }
        .sheet(isPresented: $viewModel.showingTaskDetail) {
            if let task = viewModel.selectedTask {
                TaskDetailView(task: task)
            }
        }
        .alert("Error", isPresented: $viewModel.showingError) {
            Button("OK") {
                viewModel.clearError()
            }
        } message: {
            Text(viewModel.errorMessage)
        }
        .onAppear {
            viewModel.loadTasks()
        }
    }
    
    private func handleTaskAction(_ action: TaskAction, for task: Task) {
        switch action {
        case .complete:
            viewModel.completeTask(task)
        case .mute:
            viewModel.muteTask(task)
        case .reactivate:
            viewModel.reactivateTask(task)
        case .delete:
            viewModel.deleteTask(task)
        }
    }
}

// MARK: - Task Stats Header
struct TaskStatsHeader: View {
    let tasks: [Task]
    
    private var stats: TaskStats {
        let total = tasks.count
        let active = tasks.filter { $0.status == .active }.count
        let completed = tasks.filter { $0.status == .completed }.count
        let muted = tasks.filter { $0.status == .muted }.count
        let customPlace = tasks.filter { $0.locationType == .customPlace }.count
        let poiCategory = tasks.filter { $0.locationType == .poiCategory }.count
        
        return TaskStats(
            total: total,
            active: active,
            completed: completed,
            muted: muted,
            customPlace: customPlace,
            poiCategory: poiCategory
        )
    }
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.md) {
            HStack {
                Text("Overview")
                    .font(DesignSystem.Typography.title2)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Spacer()
            }
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: DesignSystem.Spacing.md) {
                StatCard(
                    title: "Active Tasks",
                    value: "\(stats.active)",
                    icon: "checkmark.circle.fill",
                    color: DesignSystem.Colors.success
                )
                
                StatCard(
                    title: "Completed",
                    value: "\(stats.completed)",
                    icon: "checkmark.circle.fill",
                    color: DesignSystem.Colors.primary
                )
                
                StatCard(
                    title: "Custom Places",
                    value: "\(stats.customPlace)",
                    icon: "mappin.circle.fill",
                    color: DesignSystem.Colors.secondary
                )
                
                StatCard(
                    title: "POI Categories",
                    value: "\(stats.poiCategory)",
                    icon: "building.2.fill",
                    color: DesignSystem.Colors.accent
                )
            }
        }
    }
}

// MARK: - Stat Card
struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.sm) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                    .font(.title2)
                
                Spacer()
                
                Text(value)
                    .font(DesignSystem.Typography.title1)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                    .fontWeight(.bold)
            }
            
            HStack {
                Text(title)
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                
                Spacer()
            }
        }
        .padding(DesignSystem.Spacing.md)
        .background(DesignSystem.Colors.surface)
        .designSystemCornerRadius()
        .designSystemShadow(DesignSystem.Shadow.small)
    }
}

// MARK: - Quick Actions Section
struct QuickActionsSection: View {
    let onCreateTask: () -> Void
    let onShowFilters: () -> Void
    let onRefresh: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
            HStack {
                Text("Quick Actions")
                    .font(DesignSystem.Typography.title3)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Spacer()
            }
            
            HStack(spacing: DesignSystem.Spacing.md) {
                QuickActionButton(
                    title: "New Task",
                    icon: "plus.circle.fill",
                    color: DesignSystem.Colors.primary,
                    action: onCreateTask
                )
                
                QuickActionButton(
                    title: "Filter",
                    icon: "line.3.horizontal.decrease.circle",
                    color: DesignSystem.Colors.secondary,
                    action: onShowFilters
                )
                
                QuickActionButton(
                    title: "Refresh",
                    icon: "arrow.clockwise.circle",
                    color: DesignSystem.Colors.accent,
                    action: onRefresh
                )
                
                Spacer()
            }
        }
    }
}

// MARK: - Active Filters Section
struct ActiveFiltersSection: View {
    let filters: TaskFilters
    let onClearFilters: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
            HStack {
                Text("Active Filters")
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Spacer()
                
                Button("Clear All", action: onClearFilters)
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.primary)
            }
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: DesignSystem.Spacing.sm) {
                    if let status = filters.status {
                        FilterChip(title: status.displayName, onRemove: {})
                    }
                    if let locationType = filters.locationType {
                        FilterChip(title: locationType.displayName, onRemove: {})
                    }
                    if let poiCategory = filters.poiCategory {
                        FilterChip(title: poiCategory.displayName, onRemove: {})
                    }
                }
            }
        }
        .padding(DesignSystem.Spacing.md)
        .background(DesignSystem.Colors.surface)
        .designSystemCornerRadius()
        .designSystemShadow(DesignSystem.Shadow.small)
    }
}

// MARK: - Task Sections View
struct TaskSectionsView: View {
    let tasks: [Task]
    let onTaskSelected: (Task) -> Void
    let onTaskAction: (TaskAction, Task) -> Void
    
    private var activeTasks: [Task] {
        tasks.filter { $0.status == .active }
    }
    
    private var completedTasks: [Task] {
        tasks.filter { $0.status == .completed }
    }
    
    private var mutedTasks: [Task] {
        tasks.filter { $0.status == .muted }
    }
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.lg) {
            if !activeTasks.isEmpty {
                TaskSection(
                    title: "Active Tasks",
                    icon: "checkmark.circle.fill",
                    color: DesignSystem.Colors.success,
                    tasks: activeTasks,
                    onTaskSelected: onTaskSelected,
                    onTaskAction: onTaskAction
                )
            }
            
            if !mutedTasks.isEmpty {
                TaskSection(
                    title: "Muted Tasks",
                    icon: "speaker.slash.fill",
                    color: DesignSystem.Colors.warning,
                    tasks: mutedTasks,
                    onTaskSelected: onTaskSelected,
                    onTaskAction: onTaskAction
                )
            }
            
            if !completedTasks.isEmpty {
                TaskSection(
                    title: "Completed Tasks",
                    icon: "checkmark.circle.fill",
                    color: DesignSystem.Colors.primary,
                    tasks: completedTasks,
                    onTaskSelected: onTaskSelected,
                    onTaskAction: onTaskAction
                )
            }
        }
    }
}

// MARK: - Task Section
struct TaskSection: View {
    let title: String
    let icon: String
    let color: Color
    let tasks: [Task]
    let onTaskSelected: (Task) -> Void
    let onTaskAction: (TaskAction, Task) -> Void
    
    @State private var isExpanded = true
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
            Button(action: {
                withAnimation(.easeInOut(duration: 0.3)) {
                    isExpanded.toggle()
                }
            }) {
                HStack {
                    Image(systemName: icon)
                        .foregroundColor(color)
                        .font(.title3)
                    
                    Text(title)
                        .font(DesignSystem.Typography.title3)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    Text("(\(tasks.count))")
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                    
                    Spacer()
                    
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .font(.caption)
                }
            }
            .buttonStyle(PlainButtonStyle())
            
            if isExpanded {
                LazyVStack(spacing: DesignSystem.Spacing.md) {
                    ForEach(tasks) { task in
                        EnhancedTaskCard(
                            task: task,
                            onTap: { onTaskSelected(task) },
                            onAction: { action in onTaskAction(action, task) }
                        )
                    }
                }
            }
        }
    }
}

// MARK: - Enhanced Task Card
struct EnhancedTaskCard: View {
    let task: Task
    let onTap: () -> Void
    let onAction: (TaskAction) -> Void
    
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
                    
                    VStack(alignment: .trailing, spacing: DesignSystem.Spacing.xs) {
                        TaskStatusIndicator(status: task.status)
                        
                        Button(action: {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                showingActions.toggle()
                            }
                        }) {
                            Image(systemName: "ellipsis.circle")
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                                .font(.title3)
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }
                
                // Location Info
                LocationInfoRow(task: task)
                
                // Geofence Settings
                GeofenceInfoRow(customRadii: task.customRadii)
                
                // Quick Actions
                if showingActions {
                    TaskQuickActions(
                        task: task,
                        onAction: { action in
                            onAction(action)
                            showingActions = false
                        }
                    )
                    .transition(.opacity.combined(with: .scale))
                }
            }
            .padding(DesignSystem.Spacing.md)
            .background(DesignSystem.Colors.surface)
            .designSystemCornerRadius()
            .designSystemShadow(DesignSystem.Shadow.small)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Location Info Row
struct LocationInfoRow: View {
    let task: Task
    
    var body: some View {
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

// MARK: - Geofence Info Row
struct GeofenceInfoRow: View {
    let customRadii: GeofenceRadii?
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            GeofenceInfoItem(
                icon: "location.circle.fill",
                value: "\(Int(customRadii?.approach ?? GeofenceRadii.default.approach)) mi"
            )
            
            GeofenceInfoItem(
                icon: "target",
                value: "\(Int(customRadii?.arrival ?? GeofenceRadii.default.arrival)) m"
            )
            
            if customRadii?.postArrival == true {
                GeofenceInfoItem(
                    icon: "clock.fill",
                    value: "Post-arrival"
                )
            }
            
            Spacer()
        }
    }
}

// MARK: - Geofence Info Item
struct GeofenceInfoItem: View {
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

// MARK: - Task Quick Actions
struct TaskQuickActions: View {
    let task: Task
    let onAction: (TaskAction) -> Void
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.sm) {
            if task.status == .active {
                QuickActionButton(
                    title: "Complete",
                    icon: "checkmark.circle.fill",
                    color: DesignSystem.Colors.success
                ) {
                    onAction(.complete)
                }
                
                QuickActionButton(
                    title: "Mute",
                    icon: "speaker.slash.fill",
                    color: DesignSystem.Colors.warning
                ) {
                    onAction(.mute)
                }
            } else if task.status == .completed || task.status == .muted {
                QuickActionButton(
                    title: "Reactivate",
                    icon: "arrow.clockwise.circle.fill",
                    color: DesignSystem.Colors.primary
                ) {
                    onAction(.reactivate)
                }
            }
            
            Spacer()
            
            QuickActionButton(
                title: "Delete",
                icon: "trash.fill",
                color: DesignSystem.Colors.error
            ) {
                onAction(.delete)
            }
        }
    }
}

// MARK: - Empty Tasks View
struct EmptyTasksView: View {
    let hasFilters: Bool
    let onCreateTask: () -> Void
    let onClearFilters: () -> Void
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.lg) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 60))
                .foregroundColor(DesignSystem.Colors.textTertiary)
            
            VStack(spacing: DesignSystem.Spacing.sm) {
                Text(hasFilters ? "No tasks match your filters" : "No tasks yet")
                    .font(DesignSystem.Typography.title2)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text(hasFilters ? "Try adjusting your filters or create a new task" : "Create your first location-based reminder")
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            
            HStack(spacing: DesignSystem.Spacing.md) {
                if hasFilters {
                    Button("Clear Filters", action: onClearFilters)
                        .font(DesignSystem.Typography.buttonMedium)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .padding(.horizontal, DesignSystem.Spacing.lg)
                        .padding(.vertical, DesignSystem.Spacing.md)
                        .background(DesignSystem.Colors.surface)
                        .designSystemCornerRadius()
                        .designSystemShadow(DesignSystem.Shadow.small)
                }
                
                Button("Create Task", action: onCreateTask)
                    .font(DesignSystem.Typography.buttonMedium)
                    .foregroundColor(.white)
                    .padding(.horizontal, DesignSystem.Spacing.lg)
                    .padding(.vertical, DesignSystem.Spacing.md)
                    .background(DesignSystem.Colors.primary)
                    .designSystemCornerRadius()
                    .designSystemShadow(DesignSystem.Shadow.small)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(DesignSystem.Spacing.padding)
    }
}

// MARK: - Supporting Types
enum TaskAction {
    case complete
    case mute
    case reactivate
    case delete
}

enum QuickAction {
    case createTask
    case showFilters
    case refresh
}

// MARK: - Preview
struct TaskDashboardView_Previews: PreviewProvider {
    static var previews: some View {
        TaskDashboardView()
    }
}