import SwiftUI

// MARK: - Tasks View
struct TasksView: View {
    @EnvironmentObject var navigationCoordinator: NavigationCoordinator
    @State private var tasks: [Task] = []
    @State private var isLoading = false
    @State private var searchText = ""
    @State private var selectedFilter: TaskFilter = .all
    @State private var sortOption: TaskSortOption = .createdDate
    
    enum TaskFilter: String, CaseIterable {
        case all = "All"
        case active = "Active"
        case completed = "Completed"
        case muted = "Muted"
    }
    
    enum TaskSortOption: String, CaseIterable {
        case createdDate = "Created Date"
        case dueDate = "Due Date"
        case title = "Title"
        case location = "Location"
    }
    
    var filteredTasks: [Task] {
        var filtered = tasks
        
        // Apply search filter
        if !searchText.isEmpty {
            filtered = filtered.filter { task in
                task.title.localizedCaseInsensitiveContains(searchText) ||
                task.description.localizedCaseInsensitiveContains(searchText) ||
                task.locationName.localizedCaseInsensitiveContains(searchText)
            }
        }
        
        // Apply status filter
        switch selectedFilter {
        case .all:
            break
        case .active:
            filtered = filtered.filter { $0.status == .active }
        case .completed:
            filtered = filtered.filter { $0.status == .completed }
        case .muted:
            filtered = filtered.filter { $0.status == .muted }
        }
        
        // Apply sorting
        switch sortOption {
        case .createdDate:
            filtered = filtered.sorted { $0.createdAt > $1.createdAt }
        case .dueDate:
            filtered = filtered.sorted { $0.dueDate ?? Date.distantFuture < $1.dueDate ?? Date.distantFuture }
        case .title:
            filtered = filtered.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        case .location:
            filtered = filtered.sorted { $0.locationName.localizedCaseInsensitiveCompare($1.locationName) == .orderedAscending }
        }
        
        return filtered
    }
    
    var body: some View {
        NavigationWrapper(
            title: "Tasks",
            trailingButton: {
                AnyView(
                    IconButton(
                        icon: "plus",
                        action: {
                            navigationCoordinator.navigateTo(.createTask)
                        }
                    )
                )
            }
        ) {
            VStack(spacing: 0) {
                // Search and Filter Section
                VStack(spacing: DesignSystem.Spacing.md) {
                    SearchField(text: $searchText, placeholder: "Search tasks...")
                    
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: DesignSystem.Spacing.sm) {
                            ForEach(TaskFilter.allCases, id: \.self) { filter in
                                FilterChip(
                                    title: filter.rawValue,
                                    isSelected: selectedFilter == filter,
                                    action: {
                                        selectedFilter = filter
                                    }
                                )
                            }
                        }
                        .padding(.horizontal, DesignSystem.Spacing.md)
                    }
                    
                    HStack {
                        Text("Sort by:")
                            .font(DesignSystem.Typography.caption1)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                        
                        PickerField(
                            title: "",
                            selection: $sortOption,
                            options: TaskSortOption.allCases,
                            optionTitle: { $0.rawValue }
                        )
                        .frame(maxWidth: 150)
                    }
                    .padding(.horizontal, DesignSystem.Spacing.md)
                }
                .padding(.vertical, DesignSystem.Spacing.md)
                .background(DesignSystem.Colors.surface)
                
                // Tasks List
                if isLoading {
                    VStack {
                        Spacer()
                        ProgressView()
                            .scaleEffect(1.2)
                        Text("Loading tasks...")
                            .font(DesignSystem.Typography.body)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                            .padding(.top, DesignSystem.Spacing.md)
                        Spacer()
                    }
                } else if filteredTasks.isEmpty {
                    EmptyStateCard(
                        icon: searchText.isEmpty ? "list.bullet" : "magnifyingglass",
                        title: searchText.isEmpty ? "No Tasks Yet" : "No Results",
                        message: searchText.isEmpty ? 
                            "Create your first task to get started with location-based reminders." :
                            "No tasks match your search criteria.",
                        actionTitle: searchText.isEmpty ? "Create Task" : nil,
                        action: searchText.isEmpty ? {
                            navigationCoordinator.navigateTo(.createTask)
                        } : nil
                    )
                    .padding()
                } else {
                    ScrollView {
                        LazyVStack(spacing: DesignSystem.Spacing.md) {
                            ForEach(filteredTasks) { task in
                                TaskCard(
                                    title: task.title,
                                    description: task.description,
                                    location: task.locationName,
                                    status: taskStatus(task.status),
                                    action: {
                                        navigationCoordinator.navigateTo(.taskDetail(task.id))
                                    }
                                )
                                .onTapGesture {
                                    navigationCoordinator.navigateTo(.taskDetail(task.id))
                                }
                            }
                        }
                        .padding()
                    }
                }
            }
        }
        .onAppear {
            loadTasks()
        }
    }
    
    private func taskStatus(_ status: Task.Status) -> TaskCard.TaskStatus {
        switch status {
        case .active: return .active
        case .completed: return .completed
        case .muted: return .muted
        }
    }
    
    private func loadTasks() {
        isLoading = true
        // TODO: Implement actual task loading from backend
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            // Mock data for now
            tasks = [
                Task(
                    id: "1",
                    title: "Buy groceries",
                    description: "Pick up milk, bread, and eggs",
                    locationId: "loc1",
                    locationName: "Whole Foods Market",
                    status: .active,
                    createdAt: Date(),
                    dueDate: nil
                ),
                Task(
                    id: "2",
                    title: "Drop off package",
                    description: "Return Amazon package at UPS store",
                    locationId: "loc2",
                    locationName: "UPS Store",
                    status: .completed,
                    createdAt: Date().addingTimeInterval(-86400),
                    dueDate: nil
                )
            ]
            isLoading = false
        }
    }
}

// MARK: - Filter Chip Component
struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(DesignSystem.Typography.caption1)
                .fontWeight(.medium)
                .padding(.horizontal, DesignSystem.Spacing.md)
                .padding(.vertical, DesignSystem.Spacing.sm)
                .background(
                    Capsule()
                        .fill(isSelected ? DesignSystem.Colors.primary : DesignSystem.Colors.surface)
                )
                .foregroundColor(isSelected ? DesignSystem.Colors.textInverse : DesignSystem.Colors.textPrimary)
                .overlay(
                    Capsule()
                        .stroke(DesignSystem.Colors.border, lineWidth: 1)
                )
        }
    }
}

// MARK: - Task Model (Temporary)
struct Task: Identifiable {
    let id: String
    let title: String
    let description: String
    let locationId: String
    let locationName: String
    let status: Status
    let createdAt: Date
    let dueDate: Date?
    
    enum Status {
        case active, completed, muted
    }
}

// MARK: - Tasks View Previews
struct TasksView_Previews: PreviewProvider {
    static var previews: some View {
        TasksView()
            .environmentObject(NavigationCoordinator())
            .environmentObject(LocationManager())
            .environmentObject(NotificationManager())
    }
}
