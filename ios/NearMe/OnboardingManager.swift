import Foundation
import Combine
import UserDefaults

// MARK: - Onboarding Models
struct OnboardingPreferences {
    var commonLocations: [CommonLocation] = []
    var notificationPreferences: NotificationPreferences = NotificationPreferences()
    var taskCategories: [TaskCategory] = []
    var hasCompletedOnboarding: Bool = false
}

struct CommonLocation {
    let id: String
    let name: String
    let type: LocationType
    let address: String?
    let coordinate: CLLocationCoordinate2D?
    
    enum LocationType: String, CaseIterable {
        case home = "home"
        case work = "work"
        case gym = "gym"
        case school = "school"
        case grocery = "grocery"
        case pharmacy = "pharmacy"
        case bank = "bank"
        case postOffice = "post_office"
        case custom = "custom"
        
        var displayName: String {
            switch self {
            case .home: return "Home"
            case .work: return "Work"
            case .gym: return "Gym"
            case .school: return "School"
            case .grocery: return "Grocery Store"
            case .pharmacy: return "Pharmacy"
            case .bank: return "Bank"
            case .postOffice: return "Post Office"
            case .custom: return "Custom Location"
            }
        }
        
        var icon: String {
            switch self {
            case .home: return "house.fill"
            case .work: return "building.2.fill"
            case .gym: return "figure.strengthtraining.traditional"
            case .school: return "graduationcap.fill"
            case .grocery: return "cart.fill"
            case .pharmacy: return "cross.fill"
            case .bank: return "banknote.fill"
            case .postOffice: return "envelope.fill"
            case .custom: return "location.fill"
            }
        }
    }
}

struct NotificationPreferences {
    var quietHoursEnabled: Bool = false
    var quietStartTime: Date = Calendar.current.date(bySettingHour: 22, minute: 0, second: 0, of: Date()) ?? Date()
    var quietEndTime: Date = Calendar.current.date(bySettingHour: 8, minute: 0, second: 0, of: Date()) ?? Date()
    var weekendQuietHours: Bool = true
    var approachNotifications: Bool = true
    var arrivalNotifications: Bool = true
    var postArrivalNotifications: Bool = true
}

struct TaskCategory {
    let id: String
    let name: String
    let icon: String
    let isSelected: Bool
    
    static let defaultCategories: [TaskCategory] = [
        TaskCategory(id: "shopping", name: "Shopping", icon: "cart.fill", isSelected: false),
        TaskCategory(id: "health", name: "Health & Wellness", icon: "heart.fill", isSelected: false),
        TaskCategory(id: "finance", name: "Finance", icon: "banknote.fill", isSelected: false),
        TaskCategory(id: "work", name: "Work", icon: "briefcase.fill", isSelected: false),
        TaskCategory(id: "personal", name: "Personal", icon: "person.fill", isSelected: false),
        TaskCategory(id: "family", name: "Family", icon: "house.fill", isSelected: false),
        TaskCategory(id: "social", name: "Social", icon: "person.2.fill", isSelected: false),
        TaskCategory(id: "travel", name: "Travel", icon: "airplane", isSelected: false)
    ]
}

// MARK: - Onboarding Steps
enum OnboardingStep: Int, CaseIterable {
    case welcome = 0
    case concept = 1
    case permissions = 2
    case preferences = 3
    case locations = 4
    case categories = 5
    case preview = 6
    case complete = 7
    
    var title: String {
        switch self {
        case .welcome: return "Welcome to Near Me"
        case .concept: return "How It Works"
        case .permissions: return "Permissions"
        case .preferences: return "Notification Preferences"
        case .locations: return "Common Locations"
        case .categories: return "Task Categories"
        case .preview: return "Preview"
        case .complete: return "All Set!"
        }
    }
    
    var subtitle: String {
        switch self {
        case .welcome: return "Get location-based reminders when you're near the right places"
        case .concept: return "We'll remind you about tasks when you're approaching or arriving at relevant locations"
        case .permissions: return "We need location and notification permissions to work properly"
        case .preferences: return "Customize when and how you receive notifications"
        case .locations: return "Tell us about places you visit regularly"
        case .categories: return "Select the types of tasks you'd like reminders for"
        case .preview: return "See how notifications will appear"
        case .complete: return "You're ready to start using Near Me!"
        }
    }
}

// MARK: - Onboarding Manager
class OnboardingManager: ObservableObject {
    @Published var currentStep: OnboardingStep = .welcome
    @Published var preferences: OnboardingPreferences = OnboardingPreferences()
    @Published var isOnboardingComplete: Bool = false
    @Published var canProceedToNextStep: Bool = true
    
    private let userDefaults = UserDefaults.standard
    private let onboardingCompleteKey = "onboarding_complete"
    private let preferencesKey = "onboarding_preferences"
    
    init() {
        loadOnboardingState()
    }
    
    // MARK: - Navigation
    func nextStep() {
        guard currentStep != .complete else { return }
        
        let nextStepIndex = currentStep.rawValue + 1
        if let nextStep = OnboardingStep(rawValue: nextStepIndex) {
            currentStep = nextStep
            updateCanProceedState()
        }
    }
    
    func previousStep() {
        guard currentStep != .welcome else { return }
        
        let previousStepIndex = currentStep.rawValue - 1
        if let previousStep = OnboardingStep(rawValue: previousStepIndex) {
            currentStep = previousStep
            updateCanProceedState()
        }
    }
    
    func skipToStep(_ step: OnboardingStep) {
        currentStep = step
        updateCanProceedState()
    }
    
    func completeOnboarding() {
        preferences.hasCompletedOnboarding = true
        isOnboardingComplete = true
        saveOnboardingState()
    }
    
    func resetOnboarding() {
        currentStep = .welcome
        preferences = OnboardingPreferences()
        isOnboardingComplete = false
        canProceedToNextStep = true
        userDefaults.removeObject(forKey: onboardingCompleteKey)
        userDefaults.removeObject(forKey: preferencesKey)
    }
    
    // MARK: - Preferences Management
    func addCommonLocation(_ location: CommonLocation) {
        preferences.commonLocations.append(location)
        saveOnboardingState()
    }
    
    func removeCommonLocation(at index: Int) {
        guard index < preferences.commonLocations.count else { return }
        preferences.commonLocations.remove(at: index)
        saveOnboardingState()
    }
    
    func updateNotificationPreferences(_ newPreferences: NotificationPreferences) {
        preferences.notificationPreferences = newPreferences
        saveOnboardingState()
    }
    
    func updateTaskCategories(_ categories: [TaskCategory]) {
        preferences.taskCategories = categories
        saveOnboardingState()
    }
    
    func toggleTaskCategory(_ categoryId: String) {
        if let index = preferences.taskCategories.firstIndex(where: { $0.id == categoryId }) {
            let category = preferences.taskCategories[index]
            preferences.taskCategories[index] = TaskCategory(
                id: category.id,
                name: category.name,
                icon: category.icon,
                isSelected: !category.isSelected
            )
        } else {
            // Add new category if not found
            if let defaultCategory = TaskCategory.defaultCategories.first(where: { $0.id == categoryId }) {
                preferences.taskCategories.append(TaskCategory(
                    id: defaultCategory.id,
                    name: defaultCategory.name,
                    icon: defaultCategory.icon,
                    isSelected: true
                ))
            }
        }
        saveOnboardingState()
    }
    
    // MARK: - Validation
    private func updateCanProceedState() {
        switch currentStep {
        case .welcome, .concept:
            canProceedToNextStep = true
        case .permissions:
            // Can proceed if permissions are granted or user chooses to skip
            canProceedToNextStep = true
        case .preferences:
            canProceedToNextStep = true
        case .locations:
            // Can proceed even with no locations
            canProceedToNextStep = true
        case .categories:
            // Can proceed even with no categories selected
            canProceedToNextStep = true
        case .preview:
            canProceedToNextStep = true
        case .complete:
            canProceedToNextStep = true
        }
    }
    
    // MARK: - Persistence
    private func saveOnboardingState() {
        userDefaults.set(isOnboardingComplete, forKey: onboardingCompleteKey)
        
        if let preferencesData = try? JSONEncoder().encode(preferences) {
            userDefaults.set(preferencesData, forKey: preferencesKey)
        }
    }
    
    private func loadOnboardingState() {
        isOnboardingComplete = userDefaults.bool(forKey: onboardingCompleteKey)
        
        if let preferencesData = userDefaults.data(forKey: preferencesKey),
           let loadedPreferences = try? JSONDecoder().decode(OnboardingPreferences.self, from: preferencesData) {
            preferences = loadedPreferences
        } else {
            // Initialize with default task categories
            preferences.taskCategories = TaskCategory.defaultCategories
        }
        
        updateCanProceedState()
    }
    
    // MARK: - Progress Calculation
    var progressPercentage: Double {
        return Double(currentStep.rawValue) / Double(OnboardingStep.allCases.count - 1)
    }
    
    var currentStepIndex: Int {
        return currentStep.rawValue
    }
    
    var totalSteps: Int {
        return OnboardingStep.allCases.count
    }
}

// MARK: - Codable Conformance
extension OnboardingPreferences: Codable {}
extension CommonLocation: Codable {}
extension NotificationPreferences: Codable {}
extension TaskCategory: Codable {}

// MARK: - UserDefaults Extension
extension UserDefaults {
    func set<T: Codable>(_ object: T, forKey key: String) {
        if let data = try? JSONEncoder().encode(object) {
            set(data, forKey: key)
        }
    }
    
    func get<T: Codable>(_ type: T.Type, forKey key: String) -> T? {
        guard let data = data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
}
