import XCTest
import SwiftUI
@testable import NearMe

class TaskCreationUITests: XCTestCase {
    
    var taskCreationView: TaskCreationView!
    var taskService: TaskService!
    
    override func setUpWithError() throws {
        super.setUp()
        taskService = TaskService.shared
        taskCreationView = TaskCreationView()
    }
    
    override func tearDownWithError() throws {
        taskCreationView = nil
        taskService = nil
        super.tearDown()
    }
    
    // MARK: - Task Creation Form Tests
    
    func testTaskCreationFormInitialState() throws {
        // Test that the form starts with default values
        XCTAssertEqual(taskCreationView.title, "")
        XCTAssertEqual(taskCreationView.description, "")
        XCTAssertEqual(taskCreationView.locationType, .customPlace)
        XCTAssertEqual(taskCreationView.selectedPOICategory, .gas)
        XCTAssertEqual(taskCreationView.customRadii.approach, GeofenceRadii.default.approach)
        XCTAssertEqual(taskCreationView.customRadii.arrival, GeofenceRadii.default.arrival)
        XCTAssertEqual(taskCreationView.customRadii.postArrival, GeofenceRadii.default.postArrival)
    }
    
    func testTaskCreationFormValidation() throws {
        // Test empty title validation
        taskCreationView.title = ""
        XCTAssertFalse(taskCreationView.canCreateTask)
        
        // Test whitespace-only title validation
        taskCreationView.title = "   "
        XCTAssertFalse(taskCreationView.canCreateTask)
        
        // Test valid title with custom place but no place selected
        taskCreationView.title = "Test Task"
        taskCreationView.locationType = .customPlace
        taskCreationView.selectedPlace = nil
        XCTAssertFalse(taskCreationView.canCreateTask)
        
        // Test valid title with POI category
        taskCreationView.title = "Test Task"
        taskCreationView.locationType = .poiCategory
        XCTAssertTrue(taskCreationView.canCreateTask)
        
        // Test valid title with custom place selected
        let mockPlace = Place(
            id: "test-place",
            userId: "test-user",
            name: "Test Place",
            latitude: 37.7749,
            longitude: -122.4194,
            address: "Test Address",
            placeType: .custom,
            defaultRadii: GeofenceRadii.default,
            createdAt: Date(),
            updatedAt: Date()
        )
        taskCreationView.title = "Test Task"
        taskCreationView.locationType = .customPlace
        taskCreationView.selectedPlace = mockPlace
        XCTAssertTrue(taskCreationView.canCreateTask)
    }
    
    func testLocationTypeSelection() throws {
        // Test switching between location types
        taskCreationView.locationType = .poiCategory
        XCTAssertEqual(taskCreationView.locationType, .poiCategory)
        
        taskCreationView.locationType = .customPlace
        XCTAssertEqual(taskCreationView.locationType, .customPlace)
    }
    
    func testPOICategorySelection() throws {
        // Test POI category selection
        for category in POICategory.allCases {
            taskCreationView.selectedPOICategory = category
            XCTAssertEqual(taskCreationView.selectedPOICategory, category)
        }
    }
    
    func testCustomRadiiConfiguration() throws {
        // Test custom radii configuration
        let customRadii = GeofenceRadii(
            approach: 5.0,
            arrival: 200.0,
            postArrival: false
        )
        taskCreationView.customRadii = customRadii
        
        XCTAssertEqual(taskCreationView.customRadii.approach, 5.0)
        XCTAssertEqual(taskCreationView.customRadii.arrival, 200.0)
        XCTAssertEqual(taskCreationView.customRadii.postArrival, false)
    }
    
    // MARK: - Task Service Tests
    
    func testTaskServiceInitialization() throws {
        XCTAssertNotNil(taskService)
        XCTAssertEqual(taskService.tasks.count, 0)
        XCTAssertFalse(taskService.isLoading)
        XCTAssertNil(taskService.error)
    }
    
    func testCreateTaskRequestValidation() throws {
        // Test valid create task request
        let validRequest = CreateTaskRequest(
            title: "Test Task",
            description: "Test Description",
            locationType: .poiCategory,
            placeId: nil,
            poiCategory: .gas,
            customRadii: GeofenceRadii.default
        )
        
        XCTAssertEqual(validRequest.title, "Test Task")
        XCTAssertEqual(validRequest.description, "Test Description")
        XCTAssertEqual(validRequest.locationType, .poiCategory)
        XCTAssertEqual(validRequest.poiCategory, .gas)
        XCTAssertNotNil(validRequest.customRadii)
    }
    
    func testUpdateTaskRequestValidation() throws {
        // Test valid update task request
        let validRequest = UpdateTaskRequest(
            title: "Updated Task",
            description: "Updated Description",
            locationType: .customPlace,
            placeId: "test-place-id",
            poiCategory: nil,
            customRadii: GeofenceRadii.default,
            status: .active
        )
        
        XCTAssertEqual(validRequest.title, "Updated Task")
        XCTAssertEqual(validRequest.description, "Updated Description")
        XCTAssertEqual(validRequest.locationType, .customPlace)
        XCTAssertEqual(validRequest.placeId, "test-place-id")
        XCTAssertNil(validRequest.poiCategory)
        XCTAssertEqual(validRequest.status, .active)
    }
    
    // MARK: - Task Model Tests
    
    func testTaskModelProperties() throws {
        let task = Task(
            id: "test-task",
            userId: "test-user",
            title: "Test Task",
            description: "Test Description",
            locationType: .poiCategory,
            placeId: nil,
            poiCategory: .gas,
            customRadii: GeofenceRadii.default,
            status: .active,
            createdAt: Date(),
            completedAt: nil,
            updatedAt: Date()
        )
        
        XCTAssertEqual(task.id, "test-task")
        XCTAssertEqual(task.userId, "test-user")
        XCTAssertEqual(task.title, "Test Task")
        XCTAssertEqual(task.description, "Test Description")
        XCTAssertEqual(task.locationType, .poiCategory)
        XCTAssertEqual(task.poiCategory, .gas)
        XCTAssertEqual(task.status, .active)
        XCTAssertNil(task.completedAt)
    }
    
    func testTaskStatusDisplayNames() throws {
        XCTAssertEqual(TaskStatus.active.displayName, "Active")
        XCTAssertEqual(TaskStatus.completed.displayName, "Completed")
        XCTAssertEqual(TaskStatus.muted.displayName, "Muted")
    }
    
    func testLocationTypeDisplayNames() throws {
        XCTAssertEqual(LocationType.customPlace.displayName, "Custom Place")
        XCTAssertEqual(LocationType.poiCategory.displayName, "POI Category")
    }
    
    func testPOICategoryProperties() throws {
        XCTAssertEqual(POICategory.gas.displayName, "Gas Station")
        XCTAssertEqual(POICategory.pharmacy.displayName, "Pharmacy")
        XCTAssertEqual(POICategory.grocery.displayName, "Grocery Store")
        XCTAssertEqual(POICategory.bank.displayName, "Bank")
        XCTAssertEqual(POICategory.postOffice.displayName, "Post Office")
        
        XCTAssertEqual(POICategory.gas.icon, "fuelpump.fill")
        XCTAssertEqual(POICategory.pharmacy.icon, "cross.fill")
        XCTAssertEqual(POICategory.grocery.icon, "cart.fill")
        XCTAssertEqual(POICategory.bank.icon, "building.columns.fill")
        XCTAssertEqual(POICategory.postOffice.icon, "envelope.fill")
        
        XCTAssertEqual(POICategory.gas.defaultApproachRadius, 3.0)
        XCTAssertEqual(POICategory.pharmacy.defaultApproachRadius, 1.0)
        XCTAssertEqual(POICategory.grocery.defaultApproachRadius, 1.0)
        XCTAssertEqual(POICategory.bank.defaultApproachRadius, 1.0)
        XCTAssertEqual(POICategory.postOffice.defaultApproachRadius, 1.0)
    }
    
    func testGeofenceRadiiDefaults() throws {
        let defaultRadii = GeofenceRadii.default
        XCTAssertEqual(defaultRadii.approach, 2.0)
        XCTAssertEqual(defaultRadii.arrival, 100.0)
        XCTAssertTrue(defaultRadii.postArrival)
        
        let gasRadii = GeofenceRadii.defaultForPOI(.gas)
        XCTAssertEqual(gasRadii.approach, 3.0)
        XCTAssertEqual(gasRadii.arrival, 100.0)
        XCTAssertTrue(gasRadii.postArrival)
    }
    
    // MARK: - Task Filters Tests
    
    func testTaskFiltersInitialization() throws {
        let filters = TaskFilters()
        XCTAssertNil(filters.status)
        XCTAssertNil(filters.locationType)
        XCTAssertNil(filters.poiCategory)
        XCTAssertEqual(filters.page, 1)
        XCTAssertEqual(filters.limit, 20)
        XCTAssertFalse(filters.hasActiveFilters)
    }
    
    func testTaskFiltersActiveState() throws {
        var filters = TaskFilters()
        XCTAssertFalse(filters.hasActiveFilters)
        
        filters.status = .active
        XCTAssertTrue(filters.hasActiveFilters)
        
        filters.status = nil
        filters.locationType = .customPlace
        XCTAssertTrue(filters.hasActiveFilters)
        
        filters.locationType = nil
        filters.poiCategory = .gas
        XCTAssertTrue(filters.hasActiveFilters)
    }
    
    func testTaskFiltersClear() throws {
        var filters = TaskFilters()
        filters.status = .active
        filters.locationType = .customPlace
        filters.poiCategory = .gas
        filters.page = 5
        
        filters.clear()
        
        XCTAssertNil(filters.status)
        XCTAssertNil(filters.locationType)
        XCTAssertNil(filters.poiCategory)
        XCTAssertEqual(filters.page, 1)
        XCTAssertEqual(filters.limit, 20)
        XCTAssertFalse(filters.hasActiveFilters)
    }
    
    // MARK: - Place Model Tests
    
    func testPlaceModelProperties() throws {
        let place = Place(
            id: "test-place",
            userId: "test-user",
            name: "Test Place",
            latitude: 37.7749,
            longitude: -122.4194,
            address: "Test Address",
            placeType: .custom,
            defaultRadii: GeofenceRadii.default,
            createdAt: Date(),
            updatedAt: Date()
        )
        
        XCTAssertEqual(place.id, "test-place")
        XCTAssertEqual(place.userId, "test-user")
        XCTAssertEqual(place.name, "Test Place")
        XCTAssertEqual(place.latitude, 37.7749)
        XCTAssertEqual(place.longitude, -122.4194)
        XCTAssertEqual(place.address, "Test Address")
        XCTAssertEqual(place.placeType, .custom)
        
        let coordinate = place.coordinate
        XCTAssertEqual(coordinate.latitude, 37.7749)
        XCTAssertEqual(coordinate.longitude, -122.4194)
    }
    
    func testPlaceTypeProperties() throws {
        XCTAssertEqual(PlaceType.home.displayName, "Home")
        XCTAssertEqual(PlaceType.work.displayName, "Work")
        XCTAssertEqual(PlaceType.custom.displayName, "Custom")
        
        XCTAssertEqual(PlaceType.home.icon, "house.fill")
        XCTAssertEqual(PlaceType.work.icon, "building.2.fill")
        XCTAssertEqual(PlaceType.custom.icon, "mappin.circle.fill")
    }
    
    // MARK: - Error Handling Tests
    
    func testTaskServiceErrorTypes() throws {
        let networkError = TaskService.TaskServiceError.networkError("Test error")
        XCTAssertEqual(networkError.localizedDescription, "Network error: Test error")
        
        let serverError = TaskService.TaskServiceError.serverError("Test error")
        XCTAssertEqual(serverError.localizedDescription, "Server error: Test error")
        
        let validationError = TaskService.TaskServiceError.validationError("Test error")
        XCTAssertEqual(validationError.localizedDescription, "Validation error: Test error")
        
        let taskLimitError = TaskService.TaskServiceError.taskLimitExceeded
        XCTAssertEqual(taskLimitError.localizedDescription, "Free users are limited to 3 active tasks. Upgrade to premium for unlimited tasks.")
        
        let unauthorizedError = TaskService.TaskServiceError.unauthorized
        XCTAssertEqual(unauthorizedError.localizedDescription, "You are not authorized to perform this action")
        
        let notFoundError = TaskService.TaskServiceError.notFound
        XCTAssertEqual(notFoundError.localizedDescription, "Task not found")
    }
}

// MARK: - Mock Data for Testing

extension TaskCreationUITests {
    
    func createMockTask() -> Task {
        return Task(
            id: UUID().uuidString,
            userId: "test-user",
            title: "Mock Task",
            description: "Mock Description",
            locationType: .poiCategory,
            placeId: nil,
            poiCategory: .gas,
            customRadii: GeofenceRadii.default,
            status: .active,
            createdAt: Date(),
            completedAt: nil,
            updatedAt: Date()
        )
    }
    
    func createMockPlace() -> Place {
        return Place(
            id: UUID().uuidString,
            userId: "test-user",
            name: "Mock Place",
            latitude: 37.7749,
            longitude: -122.4194,
            address: "Mock Address",
            placeType: .custom,
            defaultRadii: GeofenceRadii.default,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
    
    func createMockCreateTaskRequest() -> CreateTaskRequest {
        return CreateTaskRequest(
            title: "Mock Task",
            description: "Mock Description",
            locationType: .poiCategory,
            placeId: nil,
            poiCategory: .gas,
            customRadii: GeofenceRadii.default
        )
    }
    
    func createMockUpdateTaskRequest() -> UpdateTaskRequest {
        return UpdateTaskRequest(
            title: "Updated Mock Task",
            description: "Updated Mock Description",
            locationType: .customPlace,
            placeId: "mock-place-id",
            poiCategory: nil,
            customRadii: GeofenceRadii.default,
            status: .active
        )
    }
}
