import SwiftUI

// MARK: - Main Navigation Coordinator
class NavigationCoordinator: ObservableObject {
    @Published var currentTab: MainTab = .tasks
    @Published var navigationPath = NavigationPath()
    
    enum MainTab: String, CaseIterable {
        case tasks = "Tasks"
        case places = "Places"
        case notifications = "Notifications"
        case settings = "Settings"
        
        var icon: String {
            switch self {
            case .tasks: return "list.bullet"
            case .places: return "location"
            case .notifications: return "bell"
            case .settings: return "gear"
            }
        }
        
        var selectedIcon: String {
            switch self {
            case .tasks: return "list.bullet.fill"
            case .places: return "location.fill"
            case .notifications: return "bell.fill"
            case .settings: return "gear.fill"
            }
        }
    }
    
    func navigateToTab(_ tab: MainTab) {
        currentTab = tab
    }
    
    func navigateTo(_ destination: NavigationDestination) {
        navigationPath.append(destination)
    }
    
    func navigateBack() {
        if !navigationPath.isEmpty {
            navigationPath.removeLast()
        }
    }
    
    func navigateToRoot() {
        navigationPath = NavigationPath()
    }
}

// MARK: - Navigation Destinations
enum NavigationDestination: Hashable {
    case createTask
    case editTask(String) // task ID
    case taskDetail(String) // task ID
    case createPlace
    case editPlace(String) // place ID
    case placeDetail(String) // place ID
    case notificationDetail(String) // notification ID
    case settings
    case about
    case privacy
    case terms
}

// MARK: - Main Tab View
struct MainTabView: View {
    @StateObject private var navigationCoordinator = NavigationCoordinator()
    @EnvironmentObject var locationManager: LocationManager
    @EnvironmentObject var notificationManager: NotificationManager
    @StateObject private var taskService = TaskService.shared
    
    var body: some View {
        TabView(selection: $navigationCoordinator.currentTab) {
            NavigationStack(path: $navigationCoordinator.navigationPath) {
                TasksView()
                    .navigationDestination(for: NavigationDestination.self) { destination in
                        destinationView(for: destination)
                    }
            }
            .tabItem {
                ZStack {
                    Image(systemName: navigationCoordinator.currentTab == .tasks ? 
                          NavigationCoordinator.MainTab.tasks.selectedIcon : 
                          NavigationCoordinator.MainTab.tasks.icon)
                    
                    TabBarBadge(count: taskService.activeTasks.count)
                }
                Text(NavigationCoordinator.MainTab.tasks.rawValue)
            }
            .tag(NavigationCoordinator.MainTab.tasks)
            
            NavigationStack(path: $navigationCoordinator.navigationPath) {
                PlacesView()
                    .navigationDestination(for: NavigationDestination.self) { destination in
                        destinationView(for: destination)
                    }
            }
            .tabItem {
                Image(systemName: navigationCoordinator.currentTab == .places ? 
                      NavigationCoordinator.MainTab.places.selectedIcon : 
                      NavigationCoordinator.MainTab.places.icon)
                Text(NavigationCoordinator.MainTab.places.rawValue)
            }
            .tag(NavigationCoordinator.MainTab.places)
            
            NavigationStack(path: $navigationCoordinator.navigationPath) {
                NotificationsView()
                    .navigationDestination(for: NavigationDestination.self) { destination in
                        destinationView(for: destination)
                    }
            }
            .tabItem {
                ZStack {
                    Image(systemName: navigationCoordinator.currentTab == .notifications ? 
                          NavigationCoordinator.MainTab.notifications.selectedIcon : 
                          NavigationCoordinator.MainTab.notifications.icon)
                    
                    TabBarBadge(count: notificationManager.unreadCount)
                }
                Text(NavigationCoordinator.MainTab.notifications.rawValue)
            }
            .tag(NavigationCoordinator.MainTab.notifications)
            
            NavigationStack(path: $navigationCoordinator.navigationPath) {
                SettingsView()
                    .navigationDestination(for: NavigationDestination.self) { destination in
                        destinationView(for: destination)
                    }
            }
            .tabItem {
                Image(systemName: navigationCoordinator.currentTab == .settings ? 
                      NavigationCoordinator.MainTab.settings.selectedIcon : 
                      NavigationCoordinator.MainTab.settings.icon)
                Text(NavigationCoordinator.MainTab.settings.rawValue)
            }
            .tag(NavigationCoordinator.MainTab.settings)
        }
        .accentColor(DesignSystem.Colors.primary)
        .environmentObject(navigationCoordinator)
        .onAppear {
            taskService.fetchTasks()
        }
    }
    
    @ViewBuilder
    private func destinationView(for destination: NavigationDestination) -> some View {
        switch destination {
        case .createTask:
            TaskCreationView()
        case .editTask(let taskId):
            TaskEditView(taskId: taskId)
        case .taskDetail(let taskId):
            TaskDetailView(taskId: taskId)
        case .createPlace:
            PlaceCreationView()
        case .editPlace(let placeId):
            PlaceEditView(placeId: placeId)
        case .placeDetail(let placeId):
            PlaceDetailView(placeId: placeId)
        case .notificationDetail(let notificationId):
            NotificationDetailView(notificationId: notificationId)
        case .settings:
            SettingsView()
        case .about:
            AboutView()
        case .privacy:
            PrivacyView()
        case .terms:
            TermsView()
        }
    }
}

// MARK: - Navigation Bar Customization
struct CustomNavigationBar: View {
    let title: String
    let showBackButton: Bool
    let backAction: (() -> Void)?
    let trailingButton: (() -> AnyView)?
    
    init(title: String, 
         showBackButton: Bool = false, 
         backAction: (() -> Void)? = nil,
         @ViewBuilder trailingButton: (() -> AnyView)? = nil) {
        self.title = title
        self.showBackButton = showBackButton
        self.backAction = backAction
        self.trailingButton = trailingButton
    }
    
    var body: some View {
        HStack {
            if showBackButton {
                Button(action: backAction ?? {}) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(DesignSystem.Colors.primary)
                }
            }
            
            Spacer()
            
            Text(title)
                .font(DesignSystem.Typography.title2)
                .fontWeight(.semibold)
                .foregroundColor(DesignSystem.Colors.textPrimary)
            
            Spacer()
            
            if let trailingButton = trailingButton {
                trailingButton()
            } else if showBackButton {
                // Invisible spacer to center title when back button is present
                Color.clear
                    .frame(width: 18, height: 18)
            }
        }
        .padding(.horizontal, DesignSystem.Spacing.md)
        .padding(.vertical, DesignSystem.Spacing.sm)
        .background(DesignSystem.Colors.background)
    }
}

// MARK: - Navigation Wrapper
struct NavigationWrapper<Content: View>: View {
    let title: String
    let showBackButton: Bool
    let backAction: (() -> Void)?
    let trailingButton: (() -> AnyView)?
    let content: Content
    
    init(title: String,
         showBackButton: Bool = false,
         backAction: (() -> Void)? = nil,
         @ViewBuilder trailingButton: (() -> AnyView)? = nil,
         @ViewBuilder content: () -> Content) {
        self.title = title
        self.showBackButton = showBackButton
        self.backAction = backAction
        self.trailingButton = trailingButton
        self.content = content()
    }
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                CustomNavigationBar(
                    title: title,
                    showBackButton: showBackButton,
                    backAction: backAction,
                    trailingButton: trailingButton
                )
                
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .navigationBarHidden(true)
        }
    }
}

// MARK: - Enhanced Navigation Components
struct ModalNavigationBar: View {
    let title: String
    let onDismiss: () -> Void
    var trailingButton: (() -> AnyView)?
    
    var body: some View {
        HStack {
            Button("Cancel") {
                onDismiss()
            }
            .font(DesignSystem.Typography.body)
            .foregroundColor(DesignSystem.Colors.primary)
            
            Spacer()
            
            Text(title)
                .font(DesignSystem.Typography.title3)
                .fontWeight(.semibold)
                .foregroundColor(DesignSystem.Colors.textPrimary)
            
            Spacer()
            
            if let trailingButton = trailingButton {
                trailingButton()
            } else {
                Color.clear
                    .frame(width: 60, height: 20)
            }
        }
        .padding(.horizontal, DesignSystem.Spacing.md)
        .padding(.vertical, DesignSystem.Spacing.sm)
        .background(DesignSystem.Colors.surface)
    }
}

struct TabBarBadge: View {
    let count: Int
    
    var body: some View {
        if count > 0 {
            Text("\(min(count, 99))")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.white)
                .frame(minWidth: 16, minHeight: 16)
                .background(
                    Circle()
                        .fill(DesignSystem.Colors.error)
                )
                .offset(x: 8, y: -8)
        }
    }
}

struct NavigationProgressBar: View {
    let currentStep: Int
    let totalSteps: Int
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.sm) {
            HStack {
                ForEach(0..<totalSteps, id: \.self) { step in
                    Circle()
                        .fill(step < currentStep ? DesignSystem.Colors.primary : DesignSystem.Colors.border)
                        .frame(width: 8, height: 8)
                    
                    if step < totalSteps - 1 {
                        Rectangle()
                            .fill(step < currentStep - 1 ? DesignSystem.Colors.primary : DesignSystem.Colors.border)
                            .frame(height: 2)
                    }
                }
            }
            
            Text("Step \(currentStep) of \(totalSteps)")
                .font(DesignSystem.Typography.caption1)
                .foregroundColor(DesignSystem.Colors.textSecondary)
        }
        .padding(.horizontal, DesignSystem.Spacing.padding)
        .padding(.vertical, DesignSystem.Spacing.sm)
    }
}

// MARK: - Navigation Previews
struct MainNavigation_Previews: PreviewProvider {
    static var previews: some View {
        MainTabView()
            .environmentObject(LocationManager())
            .environmentObject(NotificationManager())
    }
}
