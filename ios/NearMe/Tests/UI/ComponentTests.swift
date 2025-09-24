import XCTest
import SwiftUI
@testable import NearMe

class ComponentTests: XCTestCase {
    
    func testPrimaryButtonCreation() {
        let button = PrimaryButton(title: "Test Button", action: {})
        
        // Test that button is created successfully
        XCTAssertNotNil(button)
    }
    
    func testPrimaryButtonWithLoadingState() {
        let button = PrimaryButton(title: "Loading Button", action: {}, isLoading: true)
        
        // Test that button is created successfully with loading state
        XCTAssertNotNil(button)
    }
    
    func testSecondaryButtonCreation() {
        let button = SecondaryButton(title: "Test Button", action: {})
        
        // Test that button is created successfully
        XCTAssertNotNil(button)
    }
    
    func testIconButtonCreation() {
        let button = IconButton(icon: "plus", action: {})
        
        // Test that button is created successfully
        XCTAssertNotNil(button)
    }
    
    func testFloatingActionButtonCreation() {
        let button = FloatingActionButton(icon: "plus", action: {})
        
        // Test that button is created successfully
        XCTAssertNotNil(button)
    }
    
    func testTaskCardCreation() {
        let card = TaskCard(
            title: "Test Task",
            description: "Test Description",
            location: "Test Location",
            status: .active,
            action: {}
        )
        
        // Test that card is created successfully
        XCTAssertNotNil(card)
    }
    
    func testPlaceCardCreation() {
        let card = PlaceCard(
            name: "Test Place",
            address: "Test Address",
            category: "Test Category",
            distance: "1.0 mi",
            action: {}
        )
        
        // Test that card is created successfully
        XCTAssertNotNil(card)
    }
    
    func testNotificationCardCreation() {
        let card = NotificationCard(
            title: "Test Notification",
            message: "Test Message",
            timestamp: Date(),
            isRead: false,
            actions: []
        )
        
        // Test that card is created successfully
        XCTAssertNotNil(card)
    }
    
    func testEmptyStateCardCreation() {
        let card = EmptyStateCard(
            icon: "list",
            title: "No Items",
            message: "No items to display",
            actionTitle: "Add Item",
            action: {}
        )
        
        // Test that card is created successfully
        XCTAssertNotNil(card)
    }
    
    func testTextInputFieldCreation() {
        let field = TextInputField(
            title: "Test Field",
            text: .constant(""),
            placeholder: "Enter text"
        )
        
        // Test that field is created successfully
        XCTAssertNotNil(field)
    }
    
    func testSearchFieldCreation() {
        let field = SearchField(text: .constant(""), placeholder: "Search...")
        
        // Test that field is created successfully
        XCTAssertNotNil(field)
    }
    
    func testPickerFieldCreation() {
        let field = PickerField(
            title: "Test Picker",
            selection: .constant("Option 1"),
            options: ["Option 1", "Option 2", "Option 3"],
            optionTitle: { $0 }
        )
        
        // Test that field is created successfully
        XCTAssertNotNil(field)
    }
    
    func testToggleFieldCreation() {
        let field = ToggleField(
            title: "Test Toggle",
            isOn: .constant(false),
            description: "Test description"
        )
        
        // Test that field is created successfully
        XCTAssertNotNil(field)
    }
    
    func testSliderFieldCreation() {
        let field = SliderField(
            title: "Test Slider",
            value: .constant(5.0),
            range: 0...10,
            step: 1,
            unit: " units"
        )
        
        // Test that field is created successfully
        XCTAssertNotNil(field)
    }
}

// MARK: - Design System Tests
class DesignSystemTests: XCTestCase {
    
    func testDesignSystemColors() {
        // Test that all colors are defined
        XCTAssertNotNil(DesignSystem.Colors.primary)
        XCTAssertNotNil(DesignSystem.Colors.secondary)
        XCTAssertNotNil(DesignSystem.Colors.accent)
        XCTAssertNotNil(DesignSystem.Colors.success)
        XCTAssertNotNil(DesignSystem.Colors.warning)
        XCTAssertNotNil(DesignSystem.Colors.error)
        XCTAssertNotNil(DesignSystem.Colors.background)
        XCTAssertNotNil(DesignSystem.Colors.surface)
        XCTAssertNotNil(DesignSystem.Colors.card)
        XCTAssertNotNil(DesignSystem.Colors.textPrimary)
        XCTAssertNotNil(DesignSystem.Colors.textSecondary)
        XCTAssertNotNil(DesignSystem.Colors.textTertiary)
        XCTAssertNotNil(DesignSystem.Colors.textInverse)
    }
    
    func testDesignSystemTypography() {
        // Test that all typography styles are defined
        XCTAssertNotNil(DesignSystem.Typography.largeTitle)
        XCTAssertNotNil(DesignSystem.Typography.title1)
        XCTAssertNotNil(DesignSystem.Typography.title2)
        XCTAssertNotNil(DesignSystem.Typography.title3)
        XCTAssertNotNil(DesignSystem.Typography.body)
        XCTAssertNotNil(DesignSystem.Typography.bodyEmphasized)
        XCTAssertNotNil(DesignSystem.Typography.callout)
        XCTAssertNotNil(DesignSystem.Typography.subheadline)
        XCTAssertNotNil(DesignSystem.Typography.footnote)
        XCTAssertNotNil(DesignSystem.Typography.caption1)
        XCTAssertNotNil(DesignSystem.Typography.caption2)
    }
    
    func testDesignSystemSpacing() {
        // Test that all spacing values are defined
        XCTAssertEqual(DesignSystem.Spacing.xs, 4)
        XCTAssertEqual(DesignSystem.Spacing.sm, 8)
        XCTAssertEqual(DesignSystem.Spacing.md, 16)
        XCTAssertEqual(DesignSystem.Spacing.lg, 24)
        XCTAssertEqual(DesignSystem.Spacing.xl, 32)
        XCTAssertEqual(DesignSystem.Spacing.xxl, 48)
        XCTAssertEqual(DesignSystem.Spacing.xxxl, 64)
    }
    
    func testDesignSystemCornerRadius() {
        // Test that all corner radius values are defined
        XCTAssertEqual(DesignSystem.CornerRadius.xs, 4)
        XCTAssertEqual(DesignSystem.CornerRadius.sm, 8)
        XCTAssertEqual(DesignSystem.CornerRadius.md, 12)
        XCTAssertEqual(DesignSystem.CornerRadius.lg, 16)
        XCTAssertEqual(DesignSystem.CornerRadius.xl, 20)
        XCTAssertEqual(DesignSystem.CornerRadius.xxl, 24)
        XCTAssertEqual(DesignSystem.CornerRadius.round, 50)
    }
}

// MARK: - Navigation Tests
class NavigationTests: XCTestCase {
    
    func testNavigationCoordinatorCreation() {
        let coordinator = NavigationCoordinator()
        
        // Test that coordinator is created successfully
        XCTAssertNotNil(coordinator)
        XCTAssertEqual(coordinator.currentTab, .tasks)
    }
    
    func testNavigationDestinationCreation() {
        let destination = NavigationDestination.createTask
        
        // Test that destination is created successfully
        XCTAssertNotNil(destination)
    }
    
    func testMainTabViewCreation() {
        let tabView = MainTabView()
        
        // Test that tab view is created successfully
        XCTAssertNotNil(tabView)
    }
    
    func testCustomNavigationBarCreation() {
        let navBar = CustomNavigationBar(title: "Test Title")
        
        // Test that navigation bar is created successfully
        XCTAssertNotNil(navBar)
    }
    
    func testNavigationWrapperCreation() {
        let wrapper = NavigationWrapper(title: "Test Title") {
            Text("Test Content")
        }
        
        // Test that wrapper is created successfully
        XCTAssertNotNil(wrapper)
    }
}
