import XCTest
import Combine
@testable import NearMe

class TaskWorkflowTests: XCTestCase {
    var taskService: TaskService!
    var workflowCoordinator: TaskWorkflowCoordinator!
    var cancellables: Set<AnyCancellable>!
    
    override func setUpWithError() throws {
        taskService = TaskService.shared
        workflowCoordinator = TaskWorkflowCoordinator.shared
        cancellables = Set<AnyCancellable>()
    }
    
    override func tearDownWithError() throws {
        cancellables = nil
        taskService = nil
        workflowCoordinator = nil
    }
    
    // MARK: - Task Creation Tests
    
    func testTaskCreationWorkflow() throws {
        let expectation = XCTestExpectation(description: "Task creation workflow completes")
        
        let request = CreateTaskRequest(
            title: "Test Task",
            description: "Test Description",
            locationType: .customPlace,
            placeId: "test-place-id",
            poiCategory: nil,
            customRadii: GeofenceRadii.default
        )
        
        workflowCoordinator.$workflowState
            .sink { state in
                if state.isCompleted {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        workflowCoordinator.startTaskCreationWorkflow(request: request)
        
        wait(for: [expectation], timeout: 10.0)
        XCTAssertTrue(workflowCoordinator.workflowState.isCompleted)
    }
    
    func testTaskCreationValidation() throws {
        // Test empty title validation
        let invalidRequest = CreateTaskRequest(
            title: "",
            description: nil,
            locationType: .customPlace,
            placeId: nil,
            poiCategory: nil,
            customRadii: nil
        )
        
        let titleValidation = TaskFormValidation.validateTitle(invalidRequest.title)
        XCTAssertFalse(titleValidation.isValid)
        XCTAssertEqual(titleValidation.errorMessage, "Task title is required")
        
        // Test valid title
        let validTitleValidation = TaskFormValidation.validateTitle("Valid Task Title")
        XCTAssertTrue(validTitleValidation.isValid)
        XCTAssertNil(validTitleValidation.errorMessage)
    }
    
    func testTaskCreationWithPOICategory() throws {
        let expectation = XCTestExpectation(description: "POI task creation completes")
        
        let request = CreateTaskRequest(
            title: "Buy Gas",
            description: nil,
            locationType: .poiCategory,
            placeId: nil,
            poiCategory: .gas,
            customRadii: GeofenceRadii.defaultForPOI(.gas)
        )
        
        workflowCoordinator.$workflowState
            .sink { state in
                if state.isCompleted {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        workflowCoordinator.startTaskCreationWorkflow(request: request)
        
        wait(for: [expectation], timeout: 10.0)
        XCTAssertTrue(workflowCoordinator.workflowState.isCompleted)
    }
    
    // MARK: - Task Update Tests
    
    func testTaskUpdateWorkflow() throws {
        let expectation = XCTestExpectation(description: "Task update workflow completes")
        
        let updateRequest = UpdateTaskRequest(
            title: "Updated Task Title",
            description: "Updated Description",
            locationType: .customPlace,
            placeId: "updated-place-id",
            poiCategory: nil,
            customRadii: GeofenceRadii.default,
            status: nil
        )
        
        workflowCoordinator.$workflowState
            .sink { state in
                if state.isCompleted {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        workflowCoordinator.startTaskUpdateWorkflow(taskId: "test-task-id", request: updateRequest)
        
        wait(for: [expectation], timeout: 10.0)
        XCTAssertTrue(workflowCoordinator.workflowState.isCompleted)
    }
    
    // MARK: - Task Deletion Tests
    
    func testTaskDeletionWorkflow() throws {
        let expectation = XCTestExpectation(description: "Task deletion workflow completes")
        
        workflowCoordinator.$workflowState
            .sink { state in
                if state.isCompleted {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        workflowCoordinator.startTaskDeletionWorkflow(taskId: "test-task-id")
        
        wait(for: [expectation], timeout: 10.0)
        XCTAssertTrue(workflowCoordinator.workflowState.isCompleted)
    }
    
    // MARK: - Validation Tests
    
    func testTitleValidation() throws {
        // Test empty title
        var result = TaskFormValidation.validateTitle("")
        XCTAssertFalse(result.isValid)
        
        // Test short title
        result = TaskFormValidation.validateTitle("Hi")
        XCTAssertFalse(result.isValid)
        
        // Test long title
        let longTitle = String(repeating: "a", count: 101)
        result = TaskFormValidation.validateTitle(longTitle)
        XCTAssertFalse(result.isValid)
        
        // Test valid title
        result = TaskFormValidation.validateTitle("Valid Task Title")
        XCTAssertTrue(result.isValid)
    }
    
    func testDescriptionValidation() throws {
        // Test empty description (should be valid)
        var result = TaskFormValidation.validateDescription("")
        XCTAssertTrue(result.isValid)
        
        // Test long description
        let longDescription = String(repeating: "a", count: 501)
        result = TaskFormValidation.validateDescription(longDescription)
        XCTAssertFalse(result.isValid)
        
        // Test valid description
        result = TaskFormValidation.validateDescription("Valid description")
        XCTAssertTrue(result.isValid)
    }
    
    func testLocationValidation() throws {
        // Test custom place without place selected
        var result = TaskFormValidation.validateLocation(type: .customPlace, place: nil, category: nil)
        XCTAssertFalse(result.isValid)
        
        // Test custom place with place selected
        let place = Place(
            id: "test-id",
            userId: "user-id",
            name: "Test Place",
            latitude: 37.7749,
            longitude: -122.4194,
            address: "Test Address",
            placeType: .custom,
            defaultRadii: GeofenceRadii.default,
            createdAt: Date(),
            updatedAt: Date()
        )
        result = TaskFormValidation.validateLocation(type: .customPlace, place: place, category: nil)
        XCTAssertTrue(result.isValid)
        
        // Test POI category
        result = TaskFormValidation.validateLocation(type: .poiCategory, place: nil, category: .gas)
        XCTAssertTrue(result.isValid)
    }
    
    func testGeofenceRadiiValidation() throws {
        // Test invalid approach distance
        var radii = GeofenceRadii(approach: 0.05, arrival: 100, postArrival: true)
        var result = TaskFormValidation.validateGeofenceRadii(radii)
        XCTAssertFalse(result.isValid)
        
        // Test invalid arrival distance
        radii = GeofenceRadii(approach: 2.0, arrival: 5, postArrival: true)
        result = TaskFormValidation.validateGeofenceRadii(radii)
        XCTAssertFalse(result.isValid)
        
        // Test valid radii
        radii = GeofenceRadii(approach: 2.0, arrival: 100, postArrival: true)
        result = TaskFormValidation.validateGeofenceRadii(radii)
        XCTAssertTrue(result.isValid)
    }
    
    // MARK: - ViewModel Tests
    
    func testTaskCreationViewModel() throws {
        let viewModel = TaskCreationViewModel()
        
        // Test initial state
        XCTAssertFalse(viewModel.canCreateTask)
        XCTAssertEqual(viewModel.title, "")
        XCTAssertEqual(viewModel.locationType, .customPlace)
        
        // Test with valid title but no place
        viewModel.title = "Test Task"
        XCTAssertFalse(viewModel.canCreateTask)
        
        // Test with valid title and place
        let place = Place(
            id: "test-id",
            userId: "user-id",
            name: "Test Place",
            latitude: 37.7749,
            longitude: -122.4194,
            address: "Test Address",
            placeType: .custom,
            defaultRadii: GeofenceRadii.default,
            createdAt: Date(),
            updatedAt: Date()
        )
        viewModel.selectedPlace = place
        XCTAssertTrue(viewModel.canCreateTask)
        
        // Test with POI category
        viewModel.locationType = .poiCategory
        viewModel.selectedPOICategory = .gas
        XCTAssertTrue(viewModel.canCreateTask)
    }
    
    func testTaskEditViewModel() throws {
        let task = Task(
            id: "test-id",
            userId: "user-id",
            title: "Original Title",
            description: "Original Description",
            locationType: .customPlace,
            placeId: "place-id",
            poiCategory: nil,
            customRadii: GeofenceRadii.default,
            status: .active,
            createdAt: Date(),
            completedAt: nil,
            updatedAt: Date()
        )
        
        let viewModel = TaskEditViewModel(task: task)
        
        // Test initial state
        XCTAssertEqual(viewModel.title, "Original Title")
        XCTAssertEqual(viewModel.description, "Original Description")
        XCTAssertFalse(viewModel.hasChanges)
        
        // Test with changes
        viewModel.title = "Updated Title"
        XCTAssertTrue(viewModel.hasChanges)
    }
    
    // MARK: - Performance Tests
    
    func testTaskCreationPerformance() throws {
        measure {
            let request = CreateTaskRequest(
                title: "Performance Test Task",
                description: nil,
                locationType: .poiCategory,
                placeId: nil,
                poiCategory: .gas,
                customRadii: GeofenceRadii.defaultForPOI(.gas)
            )
            
            // Simulate task creation validation
            let titleValidation = TaskFormValidation.validateTitle(request.title)
            let locationValidation = TaskFormValidation.validateLocation(
                type: request.locationType,
                place: nil,
                category: request.poiCategory
            )
            
            XCTAssertTrue(titleValidation.isValid)
            XCTAssertTrue(locationValidation.isValid)
        }
    }
    
    func testTaskListFilteringPerformance() throws {
        // Create a large number of mock tasks
        let tasks = (0..<1000).map { index in
            Task(
                id: "task-\(index)",
                userId: "user-id",
                title: "Task \(index)",
                description: "Description \(index)",
                locationType: index % 2 == 0 ? .customPlace : .poiCategory,
                placeId: index % 2 == 0 ? "place-\(index)" : nil,
                poiCategory: index % 2 == 1 ? POICategory.allCases[index % POICategory.allCases.count] : nil,
                customRadii: GeofenceRadii.default,
                status: TaskStatus.allCases[index % TaskStatus.allCases.count],
                createdAt: Date(),
                completedAt: nil,
                updatedAt: Date()
            )
        }
        
        measure {
            // Test filtering performance
            let activeTasks = tasks.filter { $0.status == .active }
            let customPlaceTasks = tasks.filter { $0.locationType == .customPlace }
            let gasTasks = tasks.filter { $0.poiCategory == .gas }
            
            XCTAssertGreaterThan(activeTasks.count, 0)
            XCTAssertGreaterThan(customPlaceTasks.count, 0)
            XCTAssertGreaterThan(gasTasks.count, 0)
        }
    }
}