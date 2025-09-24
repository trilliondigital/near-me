import XCTest
import SwiftUI
@testable import NearMe

class TaskListUITests: XCTestCase {
    
    var taskListView: TaskListView!
    var taskService: TaskService!
    
    override func setUpWithError() throws {
        super.setUp()
        taskService = TaskService.shared
        taskListView = TaskListView()
    }
    
    override func tearDownWithError() throws {
        taskListView = nil
        taskService = nil
        super.tearDown()
    }
    
    // MARK: - Task List View Tests
    
    func testTaskListViewInitialization() throws {
        XCTAssertNotNil(taskListView)
        XCTAssertNotNil(taskService)
    }
    
    func testTaskListEmptyState() throws {
        // Test empty state when no tasks exist
        XCTAssertEqual(taskService.tasks.count, 0)
        XCTAssertFalse(taskService.isLoading)
    }
    
    func testTaskListWithTasks() throws {
        // Create mock tasks
        let mockTasks = createMockTasks()
        
        // Simulate adding tasks to the service
        for task in mockTasks {
            taskService.tasks.append(task)
        }
        
        XCTAssertEqual(taskService.tasks.count, mockTasks.count)
    }
    
    // MARK: - Task Card Tests
    
    func testTaskCardProperties() throws {
        let mockTask = createMockTask()
        
        // Test task card properties
        XCTAssertEqual(mockTask.title, "Test Task")
        XCTAssertEqual(mockTask.description, "Test Description")
        XCTAssertEqual(mockTask.status, .active)
        XCTAssertEqual(mockTask.locationType, .poiCategory)
        XCTAssertEqual(mockTask.poiCategory, .gas)
    }
    
    func testTaskCardStatusBadge() throws {
        let activeTask = createMockTask(status: .active)
        let completedTask = createMockTask(status: .completed)
        let mutedTask = createMockTask(status: .muted)
        
        // Test status badge colors
        XCTAssertEqual(activeTask.status.color, "Primary")
        XCTAssertEqual(completedTask.status.color, "Success")
        XCTAssertEqual(mutedTask.status.color, "Warning")
    }
    
    func testTaskCardLocationInfo() throws {
        let customPlaceTask = createMockTask(locationType: .customPlace)
        let poiCategoryTask = createMockTask(locationType: .poiCategory)
        
        // Test location type display
        XCTAssertEqual(customPlaceTask.locationType.displayName, "Custom Place")
        XCTAssertEqual(poiCategoryTask.locationType.displayName, "POI Category")
    }
    
    // MARK: - Task Actions Tests
    
    func testTaskCompletion() throws {
        let mockTask = createMockTask(status: .active)
        
        // Test task completion
        XCTAssertEqual(mockTask.status, .active)
        XCTAssertNil(mockTask.completedAt)
        
        // Simulate completion
        let completedTask = Task(
            id: mockTask.id,
            userId: mockTask.userId,
            title: mockTask.title,
            description: mockTask.description,
            locationType: mockTask.locationType,
            placeId: mockTask.placeId,
            poiCategory: mockTask.poiCategory,
            customRadii: mockTask.customRadii,
            status: .completed,
            createdAt: mockTask.createdAt,
            completedAt: Date(),
            updatedAt: Date()
        )
        
        XCTAssertEqual(completedTask.status, .completed)
        XCTAssertNotNil(completedTask.completedAt)
    }
    
    func testTaskMuting() throws {
        let mockTask = createMockTask(status: .active)
        
        // Test task muting
        XCTAssertEqual(mockTask.status, .active)
        
        // Simulate muting
        let mutedTask = Task(
            id: mockTask.id,
            userId: mockTask.userId,
            title: mockTask.title,
            description: mockTask.description,
            locationType: mockTask.locationType,
            placeId: mockTask.placeId,
            poiCategory: mockTask.poiCategory,
            customRadii: mockTask.customRadii,
            status: .muted,
            createdAt: mockTask.createdAt,
            completedAt: mockTask.completedAt,
            updatedAt: Date()
        )
        
        XCTAssertEqual(mutedTask.status, .muted)
    }
    
    func testTaskReactivation() throws {
        let completedTask = createMockTask(status: .completed)
        
        // Test task reactivation
        XCTAssertEqual(completedTask.status, .completed)
        
        // Simulate reactivation
        let reactivatedTask = Task(
            id: completedTask.id,
            userId: completedTask.userId,
            title: completedTask.title,
            description: completedTask.description,
            locationType: completedTask.locationType,
            placeId: completedTask.placeId,
            poiCategory: completedTask.poiCategory,
            customRadii: completedTask.customRadii,
            status: .active,
            createdAt: completedTask.createdAt,
            completedAt: nil,
            updatedAt: Date()
        )
        
        XCTAssertEqual(reactivatedTask.status, .active)
        XCTAssertNil(reactivatedTask.completedAt)
    }
    
    // MARK: - Task Filtering Tests
    
    func testTaskFilteringByStatus() throws {
        let activeTask = createMockTask(status: .active)
        let completedTask = createMockTask(status: .completed)
        let mutedTask = createMockTask(status: .muted)
        
        let allTasks = [activeTask, completedTask, mutedTask]
        
        // Test filtering by status
        let activeTasks = allTasks.filter { $0.status == .active }
        let completedTasks = allTasks.filter { $0.status == .completed }
        let mutedTasks = allTasks.filter { $0.status == .muted }
        
        XCTAssertEqual(activeTasks.count, 1)
        XCTAssertEqual(completedTasks.count, 1)
        XCTAssertEqual(mutedTasks.count, 1)
    }
    
    func testTaskFilteringByLocationType() throws {
        let customPlaceTask = createMockTask(locationType: .customPlace)
        let poiCategoryTask = createMockTask(locationType: .poiCategory)
        
        let allTasks = [customPlaceTask, poiCategoryTask]
        
        // Test filtering by location type
        let customPlaceTasks = allTasks.filter { $0.locationType == .customPlace }
        let poiCategoryTasks = allTasks.filter { $0.locationType == .poiCategory }
        
        XCTAssertEqual(customPlaceTasks.count, 1)
        XCTAssertEqual(poiCategoryTasks.count, 1)
    }
    
    func testTaskFilteringByPOICategory() throws {
        let gasTask = createMockTask(poiCategory: .gas)
        let pharmacyTask = createMockTask(poiCategory: .pharmacy)
        let groceryTask = createMockTask(poiCategory: .grocery)
        
        let allTasks = [gasTask, pharmacyTask, groceryTask]
        
        // Test filtering by POI category
        let gasTasks = allTasks.filter { $0.poiCategory == .gas }
        let pharmacyTasks = allTasks.filter { $0.poiCategory == .pharmacy }
        let groceryTasks = allTasks.filter { $0.poiCategory == .grocery }
        
        XCTAssertEqual(gasTasks.count, 1)
        XCTAssertEqual(pharmacyTasks.count, 1)
        XCTAssertEqual(groceryTasks.count, 1)
    }
    
    // MARK: - Task Statistics Tests
    
    func testTaskStatistics() throws {
        let activeTask = createMockTask(status: .active)
        let completedTask = createMockTask(status: .completed)
        let mutedTask = createMockTask(status: .muted)
        let customPlaceTask = createMockTask(locationType: .customPlace)
        let poiCategoryTask = createMockTask(locationType: .poiCategory)
        
        let allTasks = [activeTask, completedTask, mutedTask, customPlaceTask, poiCategoryTask]
        
        // Calculate statistics
        let total = allTasks.count
        let active = allTasks.filter { $0.status == .active }.count
        let completed = allTasks.filter { $0.status == .completed }.count
        let muted = allTasks.filter { $0.status == .muted }.count
        let customPlace = allTasks.filter { $0.locationType == .customPlace }.count
        let poiCategory = allTasks.filter { $0.locationType == .poiCategory }.count
        
        let stats = TaskStats(
            total: total,
            active: active,
            completed: completed,
            muted: muted,
            customPlace: customPlace,
            poiCategory: poiCategory
        )
        
        XCTAssertEqual(stats.total, 5)
        XCTAssertEqual(stats.active, 1)
        XCTAssertEqual(stats.completed, 1)
        XCTAssertEqual(stats.muted, 1)
        XCTAssertEqual(stats.customPlace, 1)
        XCTAssertEqual(stats.poiCategory, 1)
    }
    
    // MARK: - Task Search Tests
    
    func testTaskSearchByTitle() throws {
        let task1 = createMockTask(title: "Buy groceries")
        let task2 = createMockTask(title: "Get gas")
        let task3 = createMockTask(title: "Visit pharmacy")
        
        let allTasks = [task1, task2, task3]
        
        // Test search by title
        let groceryTasks = allTasks.filter { $0.title.lowercased().contains("grocery") }
        let gasTasks = allTasks.filter { $0.title.lowercased().contains("gas") }
        let pharmacyTasks = allTasks.filter { $0.title.lowercased().contains("pharmacy") }
        
        XCTAssertEqual(groceryTasks.count, 1)
        XCTAssertEqual(gasTasks.count, 1)
        XCTAssertEqual(pharmacyTasks.count, 1)
    }
    
    func testTaskSearchByDescription() throws {
        let task1 = createMockTask(description: "Remember to buy milk and bread")
        let task2 = createMockTask(description: "Fill up the car tank")
        let task3 = createMockTask(description: "Pick up prescription")
        
        let allTasks = [task1, task2, task3]
        
        // Test search by description
        let milkTasks = allTasks.filter { $0.description?.lowercased().contains("milk") == true }
        let carTasks = allTasks.filter { $0.description?.lowercased().contains("car") == true }
        let prescriptionTasks = allTasks.filter { $0.description?.lowercased().contains("prescription") == true }
        
        XCTAssertEqual(milkTasks.count, 1)
        XCTAssertEqual(carTasks.count, 1)
        XCTAssertEqual(prescriptionTasks.count, 1)
    }
    
    // MARK: - Task Sorting Tests
    
    func testTaskSortingByCreatedDate() throws {
        let now = Date()
        let yesterday = now.addingTimeInterval(-86400) // 1 day ago
        let twoDaysAgo = now.addingTimeInterval(-172800) // 2 days ago
        
        let task1 = createMockTask(createdAt: now)
        let task2 = createMockTask(createdAt: yesterday)
        let task3 = createMockTask(createdAt: twoDaysAgo)
        
        let allTasks = [task2, task3, task1] // Unsorted
        
        // Test sorting by created date (newest first)
        let sortedTasks = allTasks.sorted { $0.createdAt > $1.createdAt }
        
        XCTAssertEqual(sortedTasks[0].createdAt, now)
        XCTAssertEqual(sortedTasks[1].createdAt, yesterday)
        XCTAssertEqual(sortedTasks[2].createdAt, twoDaysAgo)
    }
    
    func testTaskSortingByUpdatedDate() throws {
        let now = Date()
        let yesterday = now.addingTimeInterval(-86400)
        let twoDaysAgo = now.addingTimeInterval(-172800)
        
        let task1 = createMockTask(updatedAt: now)
        let task2 = createMockTask(updatedAt: yesterday)
        let task3 = createMockTask(updatedAt: twoDaysAgo)
        
        let allTasks = [task2, task3, task1] // Unsorted
        
        // Test sorting by updated date (newest first)
        let sortedTasks = allTasks.sorted { $0.updatedAt > $1.updatedAt }
        
        XCTAssertEqual(sortedTasks[0].updatedAt, now)
        XCTAssertEqual(sortedTasks[1].updatedAt, yesterday)
        XCTAssertEqual(sortedTasks[2].updatedAt, twoDaysAgo)
    }
    
    func testTaskSortingByTitle() throws {
        let task1 = createMockTask(title: "Buy groceries")
        let task2 = createMockTask(title: "Get gas")
        let task3 = createMockTask(title: "Visit pharmacy")
        
        let allTasks = [task2, task3, task1] // Unsorted
        
        // Test sorting by title (alphabetical)
        let sortedTasks = allTasks.sorted { $0.title < $1.title }
        
        XCTAssertEqual(sortedTasks[0].title, "Buy groceries")
        XCTAssertEqual(sortedTasks[1].title, "Get gas")
        XCTAssertEqual(sortedTasks[2].title, "Visit pharmacy")
    }
    
    // MARK: - Task Pagination Tests
    
    func testTaskPagination() throws {
        let allTasks = createMockTasks(count: 25)
        
        // Test pagination with page size of 10
        let pageSize = 10
        let page1 = Array(allTasks.prefix(pageSize))
        let page2 = Array(allTasks.dropFirst(pageSize).prefix(pageSize))
        let page3 = Array(allTasks.dropFirst(pageSize * 2).prefix(pageSize))
        
        XCTAssertEqual(page1.count, 10)
        XCTAssertEqual(page2.count, 10)
        XCTAssertEqual(page3.count, 5) // Remaining tasks
    }
    
    // MARK: - Task Validation Tests
    
    func testTaskValidation() throws {
        // Test valid task
        let validTask = createMockTask()
        XCTAssertTrue(validTask.id.count > 0)
        XCTAssertTrue(validTask.userId.count > 0)
        XCTAssertTrue(validTask.title.count > 0)
        
        // Test task with empty title
        let invalidTask = createMockTask(title: "")
        XCTAssertEqual(invalidTask.title, "")
        
        // Test task with very long title
        let longTitle = String(repeating: "A", count: 1000)
        let longTitleTask = createMockTask(title: longTitle)
        XCTAssertEqual(longTitleTask.title.count, 1000)
    }
}

// MARK: - Mock Data Extensions

extension TaskListUITests {
    
    func createMockTask(
        id: String = UUID().uuidString,
        userId: String = "test-user",
        title: String = "Test Task",
        description: String = "Test Description",
        locationType: LocationType = .poiCategory,
        placeId: String? = nil,
        poiCategory: POICategory = .gas,
        customRadii: GeofenceRadii = GeofenceRadii.default,
        status: TaskStatus = .active,
        createdAt: Date = Date(),
        completedAt: Date? = nil,
        updatedAt: Date = Date()
    ) -> Task {
        return Task(
            id: id,
            userId: userId,
            title: title,
            description: description,
            locationType: locationType,
            placeId: placeId,
            poiCategory: poiCategory,
            customRadii: customRadii,
            status: status,
            createdAt: createdAt,
            completedAt: completedAt,
            updatedAt: updatedAt
        )
    }
    
    func createMockTasks(count: Int) -> [Task] {
        var tasks: [Task] = []
        
        for i in 0..<count {
            let task = createMockTask(
                title: "Task \(i + 1)",
                description: "Description for task \(i + 1)",
                status: TaskStatus.allCases[i % TaskStatus.allCases.count]
            )
            tasks.append(task)
        }
        
        return tasks
    }
    
    func createMockTasks() -> [Task] {
        return [
            createMockTask(title: "Buy groceries", status: .active),
            createMockTask(title: "Get gas", status: .completed),
            createMockTask(title: "Visit pharmacy", status: .muted),
            createMockTask(title: "Go to bank", status: .active),
            createMockTask(title: "Mail package", status: .completed)
        ]
    }
}
