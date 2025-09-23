import SwiftUI

// MARK: - Contextual Help System
struct ContextualHelpSystem: View {
    @StateObject private var helpManager = ContextualHelpManager()
    let content: AnyView
    
    init<Content: View>(@ViewBuilder content: () -> Content) {
        self.content = AnyView(content())
    }
    
    var body: some View {
        ZStack {
            content
                .environmentObject(helpManager)
            
            // Overlay for help tooltips
            if let activeHelp = helpManager.activeHelp {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()
                    .onTapGesture {
                        helpManager.dismissHelp()
                    }
                
                VStack {
                    Spacer()
                    
                    HelpTooltipView(
                        help: activeHelp,
                        onDismiss: {
                            helpManager.dismissHelp()
                        },
                        onNext: {
                            helpManager.showNextHelp()
                        }
                    )
                    .padding(DesignSystem.Spacing.lg)
                    
                    Spacer()
                }
            }
        }
    }
}

// MARK: - Contextual Help Manager
class ContextualHelpManager: ObservableObject {
    @Published var activeHelp: ContextualHelp?
    @Published var completedHelp: Set<String> = []
    
    private var helpQueue: [ContextualHelp] = []
    private var currentIndex = 0
    
    init() {
        loadCompletedHelp()
    }
    
    func showHelp(_ help: ContextualHelp) {
        guard !completedHelp.contains(help.id) else { return }
        activeHelp = help
    }
    
    func showHelpSequence(_ helps: [ContextualHelp]) {
        let uncompletedHelps = helps.filter { !completedHelp.contains($0.id) }
        guard !uncompletedHelps.isEmpty else { return }
        
        helpQueue = uncompletedHelps
        currentIndex = 0
        activeHelp = helpQueue.first
    }
    
    func dismissHelp() {
        if let help = activeHelp {
            markHelpCompleted(help.id)
        }
        activeHelp = nil
        helpQueue.removeAll()
        currentIndex = 0
    }
    
    func showNextHelp() {
        if let help = activeHelp {
            markHelpCompleted(help.id)
        }
        
        currentIndex += 1
        if currentIndex < helpQueue.count {
            activeHelp = helpQueue[currentIndex]
        } else {
            activeHelp = nil
            helpQueue.removeAll()
            currentIndex = 0
        }
    }
    
    private func markHelpCompleted(_ helpId: String) {
        completedHelp.insert(helpId)
        saveCompletedHelp()
    }
    
    private func loadCompletedHelp() {
        if let data = UserDefaults.standard.data(forKey: "completedHelp"),
           let completed = try? JSONDecoder().decode(Set<String>.self, from: data) {
            completedHelp = completed
        }
    }
    
    private func saveCompletedHelp() {
        if let data = try? JSONEncoder().encode(completedHelp) {
            UserDefaults.standard.set(data, forKey: "completedHelp")
        }
    }
}

// MARK: - Contextual Help Model
struct ContextualHelp {
    let id: String
    let title: String
    let message: String
    let icon: String?
    let actionTitle: String?
    let action: (() -> Void)?
    let position: HelpPosition
    
    enum HelpPosition {
        case top
        case center
        case bottom
    }
    
    init(
        id: String,
        title: String,
        message: String,
        icon: String? = nil,
        actionTitle: String? = nil,
        action: (() -> Void)? = nil,
        position: HelpPosition = .center
    ) {
        self.id = id
        self.title = title
        self.message = message
        self.icon = icon
        self.actionTitle = actionTitle
        self.action = action
        self.position = position
    }
}

// MARK: - Help Tooltip View
struct HelpTooltipView: View {
    let help: ContextualHelp
    let onDismiss: () -> Void
    let onNext: (() -> Void)?
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.lg) {
            // Icon
            if let icon = help.icon {
                Image(systemName: icon)
                    .font(.system(size: 40))
                    .foregroundColor(DesignSystem.Colors.primary)
            }
            
            // Content
            VStack(spacing: DesignSystem.Spacing.md) {
                Text(help.title)
                    .font(DesignSystem.Typography.title3)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                
                Text(help.message)
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(nil)
            }
            
            // Actions
            HStack(spacing: DesignSystem.Spacing.md) {
                if let actionTitle = help.actionTitle, let action = help.action {
                    SecondaryButton(
                        title: actionTitle,
                        action: {
                            action()
                            onDismiss()
                        }
                    )
                }
                
                PrimaryButton(
                    title: onNext != nil ? "Next" : "Got it",
                    action: {
                        if let onNext = onNext {
                            onNext()
                        } else {
                            onDismiss()
                        }
                    }
                )
            }
        }
        .padding(DesignSystem.Spacing.lg)
        .background(DesignSystem.Colors.surface)
        .designSystemCornerRadius()
        .designSystemShadow(DesignSystem.Shadow.large)
    }
}

// MARK: - Help Trigger View Modifier
struct HelpTrigger: ViewModifier {
    let help: ContextualHelp
    let trigger: HelpTriggerType
    @EnvironmentObject private var helpManager: ContextualHelpManager
    @State private var hasTriggered = false
    
    enum HelpTriggerType {
        case onAppear
        case onTap
        case onLongPress
    }
    
    func body(content: Content) -> some View {
        Group {
            switch trigger {
            case .onAppear:
                content
                    .onAppear {
                        if !hasTriggered {
                            helpManager.showHelp(help)
                            hasTriggered = true
                        }
                    }
            case .onTap:
                content
                    .onTapGesture {
                        helpManager.showHelp(help)
                    }
            case .onLongPress:
                content
                    .onLongPressGesture {
                        helpManager.showHelp(help)
                    }
            }
        }
    }
}

extension View {
    func contextualHelp(
        _ help: ContextualHelp,
        trigger: HelpTrigger.HelpTriggerType = .onAppear
    ) -> some View {
        modifier(HelpTrigger(help: help, trigger: trigger))
    }
}

// MARK: - Predefined Help Content
extension ContextualHelp {
    // First time user help
    static let firstTaskCreation = ContextualHelp(
        id: "first_task_creation",
        title: "Create Your First Task",
        message: "Tap the + button to create a location-based reminder. You can choose a specific place or a category like 'any gas station'.",
        icon: "plus.circle.fill",
        actionTitle: "Create Task"
    )
    
    static let geofenceExplanation = ContextualHelp(
        id: "geofence_explanation",
        title: "How Geofences Work",
        message: "Each task creates invisible boundaries around locations. You'll get notified when you enter these zones - at 5 miles, 3 miles, 1 mile, and when you arrive.",
        icon: "location.circle"
    )
    
    static let notificationActions = ContextualHelp(
        id: "notification_actions",
        title = "Notification Actions",
        message: "When you get a reminder, you can complete the task, snooze it for later, or open the map to see your location.",
        icon: "bell.fill"
    )
    
    static let taskFiltering = ContextualHelp(
        id: "task_filtering",
        title: "Filter Your Tasks",
        message: "Use the filter button to view only active, completed, or muted tasks. You can also search by task name or location.",
        icon: "line.3.horizontal.decrease.circle"
    )
    
    static let placeManagement = ContextualHelp(
        id: "place_management",
        title: "Manage Your Places",
        message: "Add frequently visited places like home, work, or your favorite coffee shop to create more personalized reminders.",
        icon: "mappin.circle.fill"
    )
    
    // Onboarding sequence
    static func onboardingSequence(
        onCreateTask: @escaping () -> Void
    ) -> [ContextualHelp] {
        [
            ContextualHelp(
                id: "welcome_to_nearme",
                title: "Welcome to Near Me!",
                message: "Let's take a quick tour to show you how location-based reminders work.",
                icon: "hand.wave.fill"
            ),
            ContextualHelp(
                id: "task_creation_intro",
                title: "Create Tasks",
                message: "Tasks are reminders tied to locations. Create one for a specific place or any location in a category.",
                icon: "plus.circle.fill",
                actionTitle: "Create First Task",
                action: onCreateTask
            ),
            geofenceExplanation,
            notificationActions
        ]
    }
    
    // Feature discovery
    static func featureDiscovery() -> [ContextualHelp] {
        [
            taskFiltering,
            placeManagement,
            ContextualHelp(
                id: "settings_customization",
                title: "Customize Settings",
                message: "Adjust notification preferences, quiet hours, and geofence radii in Settings to personalize your experience.",
                icon: "gear"
            )
        ]
    }
}

// MARK: - Preview
struct ContextualHelpSystem_Previews: PreviewProvider {
    static var previews: some View {
        ContextualHelpSystem {
            VStack {
                Text("Sample Content")
                    .contextualHelp(.firstTaskCreation)
            }
        }
    }
}