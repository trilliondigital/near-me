import XCTest
import SwiftUI
@testable import NearMe

// MARK: - Onboarding Manager Tests
class OnboardingManagerTests: XCTestCase {
    var onboardingManager: OnboardingManager!
    
    override func setUp() {
        super.setUp()
        onboardingManager = OnboardingManager()
        // Reset onboarding state for each test
        onboardingManager.resetOnboarding()
    }
    
    override func tearDown() {
        onboardingManager = nil
        super.tearDown()
    }
    
    // MARK: - Initialization Tests
    func testInitialState() {
        XCTAssertEqual(onboardingManager.currentStep, .welcome)
        XCTAssertFalse(onboardingManager.isOnboardingComplete)
        XCTAssertTrue(onboardingManager.canProceedToNextStep)
        XCTAssertEqual(onboardingManager.progressPercentage, 0.0)
    }
    
    func testDefaultPreferences() {
        XCTAssertFalse(onboardingManager.preferences.hasCompletedOnboarding)
        XCTAssertTrue(onboardingManager.preferences.commonLocations.isEmpty)
        XCTAssertFalse(onboardingManager.preferences.notificationPreferences.quietHoursEnabled)
        XCTAssertTrue(onboardingManager.preferences.notificationPreferences.approachNotifications)
        XCTAssertTrue(onboardingManager.preferences.notificationPreferences.arrivalNotifications)
        XCTAssertTrue(onboardingManager.preferences.notificationPreferences.postArrivalNotifications)
    }
    
    // MARK: - Navigation Tests
    func testNextStep() {
        onboardingManager.nextStep()
        XCTAssertEqual(onboardingManager.currentStep, .concept)
        
        onboardingManager.nextStep()
        XCTAssertEqual(onboardingManager.currentStep, .permissions)
    }
    
    func testPreviousStep() {
        onboardingManager.nextStep()
        onboardingManager.nextStep()
        XCTAssertEqual(onboardingManager.currentStep, .permissions)
        
        onboardingManager.previousStep()
        XCTAssertEqual(onboardingManager.currentStep, .concept)
    }
    
    func testSkipToStep() {
        onboardingManager.skipToStep(.preferences)
        XCTAssertEqual(onboardingManager.currentStep, .preferences)
    }
    
    func testCannotGoBeforeWelcome() {
        onboardingManager.previousStep()
        XCTAssertEqual(onboardingManager.currentStep, .welcome)
    }
    
    func testCannotGoAfterComplete() {
        onboardingManager.skipToStep(.complete)
        onboardingManager.nextStep()
        XCTAssertEqual(onboardingManager.currentStep, .complete)
    }
    
    // MARK: - Progress Tests
    func testProgressCalculation() {
        XCTAssertEqual(onboardingManager.progressPercentage, 0.0)
        
        onboardingManager.nextStep()
        XCTAssertGreaterThan(onboardingManager.progressPercentage, 0.0)
        
        onboardingManager.skipToStep(.complete)
        XCTAssertEqual(onboardingManager.progressPercentage, 1.0)
    }
    
    // MARK: - Completion Tests
    func testCompleteOnboarding() {
        XCTAssertFalse(onboardingManager.isOnboardingComplete)
        
        onboardingManager.completeOnboarding()
        
        XCTAssertTrue(onboardingManager.isOnboardingComplete)
        XCTAssertTrue(onboardingManager.preferences.hasCompletedOnboarding)
    }
    
    func testResetOnboarding() {
        onboardingManager.skipToStep(.preferences)
        onboardingManager.completeOnboarding()
        
        XCTAssertTrue(onboardingManager.isOnboardingComplete)
        XCTAssertEqual(onboardingManager.currentStep, .preferences)
        
        onboardingManager.resetOnboarding()
        
        XCTAssertFalse(onboardingManager.isOnboardingComplete)
        XCTAssertEqual(onboardingManager.currentStep, .welcome)
        XCTAssertFalse(onboardingManager.preferences.hasCompletedOnboarding)
    }
    
    // MARK: - Preferences Tests
    func testAddCommonLocation() {
        let location = CommonLocation(
            id: "test-id",
            name: "Test Location",
            type: .home,
            address: "123 Test St",
            coordinate: nil
        )
        
        XCTAssertTrue(onboardingManager.preferences.commonLocations.isEmpty)
        
        onboardingManager.addCommonLocation(location)
        
        XCTAssertEqual(onboardingManager.preferences.commonLocations.count, 1)
        XCTAssertEqual(onboardingManager.preferences.commonLocations.first?.name, "Test Location")
    }
    
    func testRemoveCommonLocation() {
        let location = CommonLocation(
            id: "test-id",
            name: "Test Location",
            type: .home,
            address: "123 Test St",
            coordinate: nil
        )
        
        onboardingManager.addCommonLocation(location)
        XCTAssertEqual(onboardingManager.preferences.commonLocations.count, 1)
        
        onboardingManager.removeCommonLocation(at: 0)
        XCTAssertTrue(onboardingManager.preferences.commonLocations.isEmpty)
    }
    
    func testToggleTaskCategory() {
        let initialCount = onboardingManager.preferences.taskCategories.filter { $0.isSelected }.count
        XCTAssertEqual(initialCount, 0)
        
        onboardingManager.toggleTaskCategory("shopping")
        
        let shoppingCategory = onboardingManager.preferences.taskCategories.first { $0.id == "shopping" }
        XCTAssertNotNil(shoppingCategory)
        XCTAssertTrue(shoppingCategory?.isSelected ?? false)
        
        // Toggle again to deselect
        onboardingManager.toggleTaskCategory("shopping")
        let shoppingCategoryAfter = onboardingManager.preferences.taskCategories.first { $0.id == "shopping" }
        XCTAssertFalse(shoppingCategoryAfter?.isSelected ?? true)
    }
    
    func testUpdateNotificationPreferences() {
        let newPreferences = NotificationPreferences(
            quietHoursEnabled: true,
            quietStartTime: Date(),
            quietEndTime: Date(),
            weekendQuietHours: true,
            approachNotifications: false,
            arrivalNotifications: true,
            postArrivalNotifications: false
        )
        
        onboardingManager.updateNotificationPreferences(newPreferences)
        
        XCTAssertTrue(onboardingManager.preferences.notificationPreferences.quietHoursEnabled)
        XCTAssertFalse(onboardingManager.preferences.notificationPreferences.approachNotifications)
        XCTAssertTrue(onboardingManager.preferences.notificationPreferences.arrivalNotifications)
        XCTAssertFalse(onboardingManager.preferences.notificationPreferences.postArrivalNotifications)
    }
}

// MARK: - Onboarding Step Tests
class OnboardingStepTests: XCTestCase {
    func testStepOrder() {
        let steps = OnboardingStep.allCases
        XCTAssertEqual(steps.count, 8)
        XCTAssertEqual(steps.first, .welcome)
        XCTAssertEqual(steps.last, .complete)
    }
    
    func testStepTitles() {
        XCTAssertEqual(OnboardingStep.welcome.title, "Welcome to Near Me")
        XCTAssertEqual(OnboardingStep.concept.title, "How It Works")
        XCTAssertEqual(OnboardingStep.permissions.title, "Permissions")
        XCTAssertEqual(OnboardingStep.preferences.title, "Notification Preferences")
        XCTAssertEqual(OnboardingStep.locations.title, "Common Locations")
        XCTAssertEqual(OnboardingStep.categories.title, "Task Categories")
        XCTAssertEqual(OnboardingStep.preview.title, "Preview")
        XCTAssertEqual(OnboardingStep.complete.title, "All Set!")
    }
    
    func testStepSubtitles() {
        XCTAssertFalse(OnboardingStep.welcome.subtitle.isEmpty)
        XCTAssertFalse(OnboardingStep.concept.subtitle.isEmpty)
        XCTAssertFalse(OnboardingStep.permissions.subtitle.isEmpty)
        XCTAssertFalse(OnboardingStep.preferences.subtitle.isEmpty)
        XCTAssertFalse(OnboardingStep.locations.subtitle.isEmpty)
        XCTAssertFalse(OnboardingStep.categories.subtitle.isEmpty)
        XCTAssertFalse(OnboardingStep.preview.subtitle.isEmpty)
        XCTAssertFalse(OnboardingStep.complete.subtitle.isEmpty)
    }
}

// MARK: - Common Location Tests
class CommonLocationTests: XCTestCase {
    func testLocationTypeDisplayNames() {
        XCTAssertEqual(CommonLocation.LocationType.home.displayName, "Home")
        XCTAssertEqual(CommonLocation.LocationType.work.displayName, "Work")
        XCTAssertEqual(CommonLocation.LocationType.gym.displayName, "Gym")
        XCTAssertEqual(CommonLocation.LocationType.school.displayName, "School")
        XCTAssertEqual(CommonLocation.LocationType.grocery.displayName, "Grocery Store")
        XCTAssertEqual(CommonLocation.LocationType.pharmacy.displayName, "Pharmacy")
        XCTAssertEqual(CommonLocation.LocationType.bank.displayName, "Bank")
        XCTAssertEqual(CommonLocation.LocationType.postOffice.displayName, "Post Office")
        XCTAssertEqual(CommonLocation.LocationType.custom.displayName, "Custom Location")
    }
    
    func testLocationTypeIcons() {
        XCTAssertEqual(CommonLocation.LocationType.home.icon, "house.fill")
        XCTAssertEqual(CommonLocation.LocationType.work.icon, "building.2.fill")
        XCTAssertEqual(CommonLocation.LocationType.gym.icon, "figure.strengthtraining.traditional")
        XCTAssertEqual(CommonLocation.LocationType.school.icon, "graduationcap.fill")
        XCTAssertEqual(CommonLocation.LocationType.grocery.icon, "cart.fill")
        XCTAssertEqual(CommonLocation.LocationType.pharmacy.icon, "cross.fill")
        XCTAssertEqual(CommonLocation.LocationType.bank.icon, "banknote.fill")
        XCTAssertEqual(CommonLocation.LocationType.postOffice.icon, "envelope.fill")
        XCTAssertEqual(CommonLocation.LocationType.custom.icon, "location.fill")
    }
    
    func testAllLocationTypes() {
        let allTypes = CommonLocation.LocationType.allCases
        XCTAssertEqual(allTypes.count, 9)
        XCTAssertTrue(allTypes.contains(.home))
        XCTAssertTrue(allTypes.contains(.work))
        XCTAssertTrue(allTypes.contains(.gym))
        XCTAssertTrue(allTypes.contains(.school))
        XCTAssertTrue(allTypes.contains(.grocery))
        XCTAssertTrue(allTypes.contains(.pharmacy))
        XCTAssertTrue(allTypes.contains(.bank))
        XCTAssertTrue(allTypes.contains(.postOffice))
        XCTAssertTrue(allTypes.contains(.custom))
    }
}

// MARK: - Task Category Tests
class TaskCategoryTests: XCTestCase {
    func testDefaultCategories() {
        let categories = TaskCategory.defaultCategories
        XCTAssertEqual(categories.count, 8)
        
        let categoryIds = categories.map { $0.id }
        XCTAssertTrue(categoryIds.contains("shopping"))
        XCTAssertTrue(categoryIds.contains("health"))
        XCTAssertTrue(categoryIds.contains("finance"))
        XCTAssertTrue(categoryIds.contains("work"))
        XCTAssertTrue(categoryIds.contains("personal"))
        XCTAssertTrue(categoryIds.contains("family"))
        XCTAssertTrue(categoryIds.contains("social"))
        XCTAssertTrue(categoryIds.contains("travel"))
    }
    
    func testDefaultCategoriesNotSelected() {
        let categories = TaskCategory.defaultCategories
        for category in categories {
            XCTAssertFalse(category.isSelected, "Category \(category.name) should not be selected by default")
        }
    }
    
    func testCategoryNames() {
        let categories = TaskCategory.defaultCategories
        let categoryNames = categories.map { $0.name }
        
        XCTAssertTrue(categoryNames.contains("Shopping"))
        XCTAssertTrue(categoryNames.contains("Health & Wellness"))
        XCTAssertTrue(categoryNames.contains("Finance"))
        XCTAssertTrue(categoryNames.contains("Work"))
        XCTAssertTrue(categoryNames.contains("Personal"))
        XCTAssertTrue(categoryNames.contains("Family"))
        XCTAssertTrue(categoryNames.contains("Social"))
        XCTAssertTrue(categoryNames.contains("Travel"))
    }
}

// MARK: - Notification Preferences Tests
class NotificationPreferencesTests: XCTestCase {
    func testDefaultPreferences() {
        let preferences = NotificationPreferences()
        
        XCTAssertFalse(preferences.quietHoursEnabled)
        XCTAssertTrue(preferences.approachNotifications)
        XCTAssertTrue(preferences.arrivalNotifications)
        XCTAssertTrue(preferences.postArrivalNotifications)
        XCTAssertTrue(preferences.weekendQuietHours)
    }
    
    func testQuietHoursTimes() {
        let preferences = NotificationPreferences()
        
        // Check that quiet hours are set to reasonable defaults
        let calendar = Calendar.current
        let startHour = calendar.component(.hour, from: preferences.quietStartTime)
        let endHour = calendar.component(.hour, from: preferences.quietEndTime)
        
        XCTAssertEqual(startHour, 22) // 10 PM
        XCTAssertEqual(endHour, 8)    // 8 AM
    }
}

// MARK: - Codable Tests
class OnboardingCodableTests: XCTestCase {
    func testOnboardingPreferencesCodable() {
        let preferences = OnboardingPreferences()
        preferences.hasCompletedOnboarding = true
        
        let location = CommonLocation(
            id: "test-id",
            name: "Test Location",
            type: .home,
            address: "123 Test St",
            coordinate: nil
        )
        preferences.commonLocations.append(location)
        
        // Test encoding
        let encoder = JSONEncoder()
        let data = try? encoder.encode(preferences)
        XCTAssertNotNil(data)
        
        // Test decoding
        let decoder = JSONDecoder()
        let decodedPreferences = try? decoder.decode(OnboardingPreferences.self, from: data!)
        XCTAssertNotNil(decodedPreferences)
        XCTAssertEqual(decodedPreferences?.hasCompletedOnboarding, true)
        XCTAssertEqual(decodedPreferences?.commonLocations.count, 1)
        XCTAssertEqual(decodedPreferences?.commonLocations.first?.name, "Test Location")
    }
    
    func testCommonLocationCodable() {
        let location = CommonLocation(
            id: "test-id",
            name: "Test Location",
            type: .home,
            address: "123 Test St",
            coordinate: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)
        )
        
        // Test encoding
        let encoder = JSONEncoder()
        let data = try? encoder.encode(location)
        XCTAssertNotNil(data)
        
        // Test decoding
        let decoder = JSONDecoder()
        let decodedLocation = try? decoder.decode(CommonLocation.self, from: data!)
        XCTAssertNotNil(decodedLocation)
        XCTAssertEqual(decodedLocation?.id, "test-id")
        XCTAssertEqual(decodedLocation?.name, "Test Location")
        XCTAssertEqual(decodedLocation?.type, .home)
        XCTAssertEqual(decodedLocation?.address, "123 Test St")
    }
    
    func testNotificationPreferencesCodable() {
        let preferences = NotificationPreferences(
            quietHoursEnabled: true,
            quietStartTime: Date(),
            quietEndTime: Date(),
            weekendQuietHours: false,
            approachNotifications: false,
            arrivalNotifications: true,
            postArrivalNotifications: false
        )
        
        // Test encoding
        let encoder = JSONEncoder()
        let data = try? encoder.encode(preferences)
        XCTAssertNotNil(data)
        
        // Test decoding
        let decoder = JSONDecoder()
        let decodedPreferences = try? decoder.decode(NotificationPreferences.self, from: data!)
        XCTAssertNotNil(decodedPreferences)
        XCTAssertEqual(decodedPreferences?.quietHoursEnabled, true)
        XCTAssertEqual(decodedPreferences?.weekendQuietHours, false)
        XCTAssertEqual(decodedPreferences?.approachNotifications, false)
        XCTAssertEqual(decodedPreferences?.arrivalNotifications, true)
        XCTAssertEqual(decodedPreferences?.postArrivalNotifications, false)
    }
}
