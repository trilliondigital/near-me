import XCTest
import SwiftUI
@testable import NearMe

class OnboardingTests: XCTestCase {
    
    var onboardingManager: OnboardingManager!
    
    override func setUp() {
        super.setUp()
        onboardingManager = OnboardingManager()
        onboardingManager.resetOnboarding()
    }
    
    override func tearDown() {
        onboardingManager = nil
        super.tearDown()
    }
    
    // MARK: - OnboardingManager Tests
    
    func testInitialState() {
        XCTAssertEqual(onboardingManager.currentStep, .welcome)
        XCTAssertFalse(onboardingManager.isOnboardingComplete)
        XCTAssertTrue(onboardingManager.canProceedToNextStep)
        XCTAssertTrue(onboardingManager.preferences.commonLocations.isEmpty)
    }
    
    func testStepNavigation() {
        // Test forward navigation
        onboardingManager.nextStep()
        XCTAssertEqual(onboardingManager.currentStep, .concept)
        
        onboardingManager.nextStep()
        XCTAssertEqual(onboardingManager.currentStep, .permissions)
        
        // Test backward navigation
        onboardingManager.previousStep()
        XCTAssertEqual(onboardingManager.currentStep, .concept)
        
        onboardingManager.previousStep()
        XCTAssertEqual(onboardingManager.currentStep, .welcome)
        
        // Test can't go before welcome
        onboardingManager.previousStep()
        XCTAssertEqual(onboardingManager.currentStep, .welcome)
    }
    
    func testProgressCalculation() {
        XCTAssertEqual(onboardingManager.progressPercentage, 0.0, accuracy: 0.01)
        
        onboardingManager.nextStep() // concept
        let expectedProgress = 1.0 / Double(OnboardingStep.allCases.count - 1)
        XCTAssertEqual(onboardingManager.progressPercentage, expectedProgress, accuracy: 0.01)
    }
    
    func testCommonLocationManagement() {
        let homeLocation = CommonLocation(
            id: "test-home",
            name: "Home",
            type: .home,
            address: "123 Main St",
            coordinate: nil
        )
        
        // Test adding location
        onboardingManager.addCommonLocation(homeLocation)
        XCTAssertEqual(onboardingManager.preferences.commonLocations.count, 1)
        XCTAssertEqual(onboardingManager.preferences.commonLocations.first?.name, "Home")
        
        // Test removing location
        onboardingManager.removeCommonLocation(at: 0)
        XCTAssertTrue(onboardingManager.preferences.commonLocations.isEmpty)
    }
    
    func testNotificationPreferencesUpdate() {
        var newPreferences = NotificationPreferences()
        newPreferences.quietHoursEnabled = true
        newPreferences.approachNotifications = false
        
        onboardingManager.updateNotificationPreferences(newPreferences)
        
        XCTAssertTrue(onboardingManager.preferences.notificationPreferences.quietHoursEnabled)
        XCTAssertFalse(onboardingManager.preferences.notificationPreferences.approachNotifications)
    }
    
    func testTaskCategoryToggle() {
        let categoryId = "shopping"
        
        // Initially not selected
        let initialCategory = onboardingManager.preferences.taskCategories.first { $0.id == categoryId }
        XCTAssertFalse(initialCategory?.isSelected ?? true)
        
        // Toggle to selected
        onboardingManager.toggleTaskCategory(categoryId)
        let selectedCategory = onboardingManager.preferences.taskCategories.first { $0.id == categoryId }
        XCTAssertTrue(selectedCategory?.isSelected ?? false)
        
        // Toggle back to unselected
        onboardingManager.toggleTaskCategory(categoryId)
        let unselectedCategory = onboardingManager.preferences.taskCategories.first { $0.id == categoryId }
        XCTAssertFalse(unselectedCategory?.isSelected ?? true)
    }
    
    func testOnboardingCompletion() {
        XCTAssertFalse(onboardingManager.isOnboardingComplete)
        
        onboardingManager.completeOnboarding()
        
        XCTAssertTrue(onboardingManager.isOnboardingComplete)
        XCTAssertTrue(onboardingManager.preferences.hasCompletedOnboarding)
    }
    
    func testSkipToStep() {
        onboardingManager.skipToStep(.preview)
        XCTAssertEqual(onboardingManager.currentStep, .preview)
    }
    
    // MARK: - Data Model Tests
    
    func testCommonLocationTypes() {
        XCTAssertEqual(CommonLocation.LocationType.home.displayName, "Home")
        XCTAssertEqual(CommonLocation.LocationType.home.icon, "house.fill")
        
        XCTAssertEqual(CommonLocation.LocationType.work.displayName, "Work")
        XCTAssertEqual(CommonLocation.LocationType.work.icon, "building.2.fill")
    }
    
    func testTaskCategoryDefaults() {
        let defaultCategories = TaskCategory.defaultCategories
        XCTAssertFalse(defaultCategories.isEmpty)
        
        let shoppingCategory = defaultCategories.first { $0.id == "shopping" }
        XCTAssertNotNil(shoppingCategory)
        XCTAssertEqual(shoppingCategory?.name, "Shopping")
        XCTAssertFalse(shoppingCategory?.isSelected ?? true)
    }
    
    func testNotificationPreferencesDefaults() {
        let preferences = NotificationPreferences()
        
        XCTAssertFalse(preferences.quietHoursEnabled)
        XCTAssertTrue(preferences.approachNotifications)
        XCTAssertTrue(preferences.arrivalNotifications)
        XCTAssertTrue(preferences.postArrivalNotifications)
        XCTAssertTrue(preferences.weekendQuietHours)
    }
    
    // MARK: - Persistence Tests
    
    func testOnboardingPersistence() {
        // Add some data
        let homeLocation = CommonLocation(
            id: "test-home",
            name: "Home",
            type: .home,
            address: "123 Main St",
            coordinate: nil
        )
        onboardingManager.addCommonLocation(homeLocation)
        onboardingManager.toggleTaskCategory("shopping")
        
        // Create new manager instance (simulates app restart)
        let newManager = OnboardingManager()
        
        // Verify data persisted
        XCTAssertEqual(newManager.preferences.commonLocations.count, 1)
        XCTAssertEqual(newManager.preferences.commonLocations.first?.name, "Home")
        
        let shoppingCategory = newManager.preferences.taskCategories.first { $0.id == "shopping" }
        XCTAssertTrue(shoppingCategory?.isSelected ?? false)
    }
    
    // MARK: - Edge Cases
    
    func testNavigationBoundaries() {
        // Test navigation at boundaries
        for _ in 0..<20 {
            onboardingManager.previousStep()
        }
        XCTAssertEqual(onboardingManager.currentStep, .welcome)
        
        for _ in 0..<20 {
            onboardingManager.nextStep()
        }
        XCTAssertEqual(onboardingManager.currentStep, .complete)
    }
    
    func testRemoveNonexistentLocation() {
        // Should not crash when removing from empty list
        onboardingManager.removeCommonLocation(at: 0)
        XCTAssertTrue(onboardingManager.preferences.commonLocations.isEmpty)
        
        // Should not crash when removing invalid index
        let homeLocation = CommonLocation(
            id: "test-home",
            name: "Home",
            type: .home,
            address: nil,
            coordinate: nil
        )
        onboardingManager.addCommonLocation(homeLocation)
        onboardingManager.removeCommonLocation(at: 10)
        XCTAssertEqual(onboardingManager.preferences.commonLocations.count, 1)
    }
    
    func testToggleNonexistentCategory() {
        // Should handle gracefully
        onboardingManager.toggleTaskCategory("nonexistent")
        
        // Should not crash and should not add invalid category
        let invalidCategory = onboardingManager.preferences.taskCategories.first { $0.id == "nonexistent" }
        XCTAssertNil(invalidCategory)
    }
}

// MARK: - UI Tests

class OnboardingUITests: XCTestCase {
    
    func testOnboardingFlowIntegration() {
        // This would be an integration test to verify the UI flow
        // In a real implementation, you'd use XCUITest for this
        
        let onboardingManager = OnboardingManager()
        onboardingManager.resetOnboarding()
        
        // Simulate going through the onboarding flow
        XCTAssertEqual(onboardingManager.currentStep, .welcome)
        
        // Progress through each step
        let steps: [OnboardingStep] = [.welcome, .concept, .permissions, .preferences, .locations, .categories, .preview, .complete]
        
        for (index, expectedStep) in steps.enumerated() {
            XCTAssertEqual(onboardingManager.currentStep, expectedStep, "Step \(index) should be \(expectedStep)")
            
            if expectedStep != .complete {
                onboardingManager.nextStep()
            }
        }
        
        // Complete onboarding
        onboardingManager.completeOnboarding()
        XCTAssertTrue(onboardingManager.isOnboardingComplete)
    }
}