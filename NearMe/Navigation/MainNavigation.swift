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
    
    var body: some View {
        TabView(selection: $navigationCoordinator.currentTab) {
            TasksView()
                .tabItem {
                    Image(systemName: navigationCoordinator.currentTab == .tasks ? 
                          NavigationCoordinator.MainTab.tasks.selectedIcon : 
                          NavigationCoordinator.MainTab.tasks.icon)
                    Text(NavigationCoordinator.MainTab.tasks.rawValue)
                }
                .tag(NavigationCoordinator.MainTab.tasks)
            
            PlacesView()
                .tabItem {
                    Image(systemName: navigationCoordinator.currentTab == .places ? 
                          NavigationCoordinator.MainTab.places.selectedIcon : 
                          NavigationCoordinator.MainTab.places.icon)
                    Text(NavigationCoordinator.MainTab.places.rawValue)
                }
                .tag(NavigationCoordinator.MainTab.places)
            
            NotificationsView()
                .tabItem {
                    Image(systemName: navigationCoordinator.currentTab == .notifications ? 
                          NavigationCoordinator.MainTab.notifications.selectedIcon : 
                          NavigationCoordinator.MainTab.notifications.icon)
                    Text(NavigationCoordinator.MainTab.notifications.rawValue)
                }
                .tag(NavigationCoordinator.MainTab.notifications)
            
            SettingsView()
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

// MARK: - Navigation Previews
struct MainNavigation_Previews: PreviewProvider {
    static var previews: some View {
        MainTabView()
            .environmentObject(LocationManager())
            .environmentObject(NotificationManager())
    }
}
