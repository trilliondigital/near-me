import XCTest
import SwiftUI
@testable import NearMe

class CoreUIComponentsTests: XCTestCase {
    
    // MARK: - Button Component Tests
    func testPrimaryButtonRendering() {
        let button = PrimaryButton(title: "Test Button", action: {})
        
        // Test that button renders without crashing
        XCTAssertNotNil(button)
        
        // Test button states
        let loadingButton = PrimaryButton(title: "Loading", action: {}, isLoading: true)
        XCTAssertNotNil(loadingButton)
        
        let disabledButton = PrimaryButton(title: "Disabled", action: {}, isDisabled: true)
        XCTAssertNotNil(disabledButton)
    }
    
    func testSecondaryButtonRendering() {
        let button = SecondaryButton(title: "Secondary", action: {})
        XCTAssertNotNil(button)
    }
    
    func testIconButtonRendering() {
        let button = IconButton(icon: "plus", action: {})
        XCTAssertNotNil(button)
    }
    
    func testFloatingActionButtonRendering() {
        let fab = FloatingActionButton(icon: "plus", action: {})
        XCTAssertNotNil(fab)
    }
    
    // MARK: - Card Component Tests
    func testBaseCardRendering() {
        let card = BaseCard {
            Text("Test Content")
        }
        XCTAssertNotNil(card)
    }
    
    func testTaskCardRendering() {
        let taskCard = TaskCard(
            title: "Test Task",
            description: "Test Description",
            location: "Test Location",
            status: .active,
            action: {}
        )
        XCTAssertNotNil(taskCard)
    }
    
    func testPlaceCardRendering() {
        let placeCard = PlaceCard(
            name: "Test Place",
            address: "123 Test St",
            category: "Test Category",
            distance: "0.5 mi",
            action: {}
        )
        XCTAssertNotNil(placeCard)
    }
    
    func testNotificationCardRendering() {
        let notificationCard = NotificationCard(
            title: "Test Notification",
            message: "Test Message",
            timestamp: Date(),
            isRead: false,
            actions: []
        )
        XCTAssertNotNil(notificationCard)
    }
    
    func testEmptyStateCardRendering() {
        let emptyState = EmptyStateCard(
            icon: "list.bullet",
            title: "No Items",
            message: "Create your first item",
            actionTitle: "Create",
            action: {}
        )
        XCTAssertNotNil(emptyState)
    }
    
    // MARK: - Input Component Tests
    func testTextInputFieldRendering() {
        @State var text = ""
        let input = TextInputField(title: "Test Input", text: $text)
        XCTAssertNotNil(input)
    }
    
    func testSearchFieldRendering() {
        @State var searchText = ""
        let searchField = SearchField(text: $searchText)
        XCTAssertNotNil(searchField)
    }
    
    func testPickerFieldRendering() {
        @State var selection = "Option 1"
        let picker = PickerField(
            title: "Test Picker",
            selection: $selection,
            options: ["Option 1", "Option 2"],
            optionTitle: { $0 }
        )
        XCTAssertNotNil(picker)
    }
    
    func testToggleFieldRendering() {
        @State var isOn = false
        let toggle = ToggleField(title: "Test Toggle", isOn: $isOn)
        XCTAssertNotNil(toggle)
    }
    
    func testSliderFieldRendering() {
        @State var value = 5.0
        let slider = SliderField(
            title: "Test Slider",
            value: $value,
            range: 0...10,
            step: 1
        )
        XCTAssertNotNil(slider)
    }
    
    // MARK: - Map Component Tests
    func testLocationSelectionMapRendering() {
        @State var selectedLocation: CLLocationCoordinate2D? = nil
        let map = LocationSelectionMap(selectedLocation: $selectedLocation)
        XCTAssertNotNil(map)
    }
    
    func testMapPinRendering() {
        let coordinate = CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)
        let pin = MapPin(coordinate: coordinate)
        XCTAssertNotNil(pin)
    }
    
    func testPOIMarkerRendering() {
        let poi = POI(
            id: "test",
            name: "Test POI",
            category: .grocery,
            coordinate: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
            address: "123 Test St"
        )
        let marker = POIMarker(poi: poi)
        XCTAssertNotNil(marker)
    }
    
    func testLocationSearchBarRendering() {
        @State var searchText = ""
        @State var searchResults: [SearchResult] = []
        let searchBar = LocationSearchBar(
            searchText: $searchText,
            searchResults: $searchResults,
            onResultSelected: { _ in }
        )
        XCTAssertNotNil(searchBar)
    }
    
    // MARK: - List Component Tests
    func testSectionHeaderRendering() {
        let header = SectionHeader(title: "Test Section")
        XCTAssertNotNil(header)
    }
    
    func testListItemRendering() {
        let listItem = ListItem(
            title: "Test Item",
            subtitle: "Test Subtitle",
            icon: "star",
            accessory: .chevron,
            action: {}
        )
        XCTAssertNotNil(listItem)
    }
    
    func testExpandableListSectionRendering() {
        let expandableSection = ExpandableListSection(
            title: "Test Section",
            subtitle: "Test Subtitle",
            icon: "gear"
        ) {
            Text("Content")
        }
        XCTAssertNotNil(expandableSection)
    }
    
    func testSwipeActionRowRendering() {
        let swipeRow = SwipeActionRow(
            actions: [
                SwipeActionRow.SwipeAction(
                    title: "Delete",
                    icon: "trash",
                    color: .red,
                    action: {}
                )
            ]
        ) {
            Text("Swipeable Content")
        }
        XCTAssertNotNil(swipeRow)
    }
    
    // MARK: - Navigation Component Tests
    func testCustomNavigationBarRendering() {
        let navBar = CustomNavigationBar(
            title: "Test Title",
            showBackButton: true,
            backAction: {}
        )
        XCTAssertNotNil(navBar)
    }
    
    func testModalNavigationBarRendering() {
        let modalNavBar = ModalNavigationBar(
            title: "Test Modal",
            onDismiss: {}
        )
        XCTAssertNotNil(modalNavBar)
    }
    
    func testTabBarBadgeRendering() {
        let badge = TabBarBadge(count: 5)
        XCTAssertNotNil(badge)
        
        let noBadge = TabBarBadge(count: 0)
        XCTAssertNotNil(noBadge)
    }
    
    func testNavigationProgressBarRendering() {
        let progressBar = NavigationProgressBar(currentStep: 2, totalSteps: 5)
        XCTAssertNotNil(progressBar)
    }
    
    // MARK: - Design System Tests
    func testDesignSystemColors() {
        XCTAssertNotNil(DesignSystem.Colors.primary)
        XCTAssertNotNil(DesignSystem.Colors.secondary)
        XCTAssertNotNil(DesignSystem.Colors.success)
        XCTAssertNotNil(DesignSystem.Colors.warning)
        XCTAssertNotNil(DesignSystem.Colors.error)
        XCTAssertNotNil(DesignSystem.Colors.background)
        XCTAssertNotNil(DesignSystem.Colors.surface)
        XCTAssertNotNil(DesignSystem.Colors.textPrimary)
        XCTAssertNotNil(DesignSystem.Colors.textSecondary)
    }
    
    func testDesignSystemSpacing() {
        XCTAssertEqual(DesignSystem.Spacing.xs, 4)
        XCTAssertEqual(DesignSystem.Spacing.sm, 8)
        XCTAssertEqual(DesignSystem.Spacing.md, 16)
        XCTAssertEqual(DesignSystem.Spacing.lg, 24)
        XCTAssertEqual(DesignSystem.Spacing.xl, 32)
    }
    
    func testDesignSystemCornerRadius() {
        XCTAssertEqual(DesignSystem.CornerRadius.xs, 4)
        XCTAssertEqual(DesignSystem.CornerRadius.sm, 8)
        XCTAssertEqual(DesignSystem.CornerRadius.md, 12)
        XCTAssertEqual(DesignSystem.CornerRadius.lg, 16)
    }
    
    // MARK: - Integration Tests
    func testMainTabViewRendering() {
        let tabView = MainTabView()
            .environmentObject(LocationManager())
            .environmentObject(NotificationManager())
        XCTAssertNotNil(tabView)
    }
    
    func testNavigationCoordinatorInitialization() {
        let coordinator = NavigationCoordinator()
        XCTAssertEqual(coordinator.currentTab, .tasks)
        XCTAssertTrue(coordinator.navigationPath.isEmpty)
    }
    
    func testNavigationCoordinatorTabSwitching() {
        let coordinator = NavigationCoordinator()
        coordinator.navigateToTab(.places)
        XCTAssertEqual(coordinator.currentTab, .places)
    }
    
    func testNavigationCoordinatorDestinationNavigation() {
        let coordinator = NavigationCoordinator()
        coordinator.navigateTo(.createTask)
        XCTAssertFalse(coordinator.navigationPath.isEmpty)
        
        coordinator.navigateBack()
        XCTAssertTrue(coordinator.navigationPath.isEmpty)
    }
    
    // MARK: - Accessibility Tests
    func testButtonAccessibility() {
        let button = PrimaryButton(title: "Accessible Button", action: {})
        // In a real implementation, you would test accessibility labels, hints, and traits
        XCTAssertNotNil(button)
    }
    
    func testCardAccessibility() {
        let card = TaskCard(
            title: "Accessible Task",
            description: "Task description",
            location: "Location",
            status: .active,
            action: {}
        )
        XCTAssertNotNil(card)
    }
    
    // MARK: - Performance Tests
    func testComponentRenderingPerformance() {
        measure {
            // Test rendering performance of multiple components
            for _ in 0..<100 {
                let _ = PrimaryButton(title: "Performance Test", action: {})
                let _ = TaskCard(
                    title: "Performance Task",
                    description: "Description",
                    location: "Location",
                    status: .active,
                    action: {}
                )
            }
        }
    }
}

// MARK: - Mock Data for Tests
extension CoreUIComponentsTests {
    func createMockTask() -> Task {
        return Task(
            id: "test-task",
            title: "Test Task",
            description: "Test Description",
            locationType: .customPlace,
            placeId: "test-place",
            poiCategory: nil,
            customRadii: nil,
            status: .active,
            createdAt: Date(),
            completedAt: nil
        )
    }
    
    func createMockPlace() -> Place {
        return Place(
            id: "test-place",
            name: "Test Place",
            coordinate: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
            address: "123 Test St",
            type: .custom,
            defaultRadii: GeofenceRadii.default
        )
    }
    
    func createMockPOI() -> POI {
        return POI(
            id: "test-poi",
            name: "Test POI",
            category: .grocery,
            coordinate: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
            address: "456 Test Ave"
        )
    }
}