import XCTest
import CoreLocation
import Combine
@testable import NearMe

class GeofenceServiceTests: XCTestCase {
    var geofenceService: GeofenceService!
    var locationManager: LocationManager!
    var cancellables: Set<AnyCancellable>!
    
    override func setUp() {
        super.setUp()
        locationManager = LocationManager()
        geofenceService = GeofenceService(locationManager: locationManager)
        cancellables = Set<AnyCancellable>()
    }
    
    override func tearDown() {
        geofenceService = nil
        locationManager = nil
        cancellables = nil
        super.tearDown()
    }
    
    // MARK: - Task Geofence Registration Tests
    
    func testRegisterCustomPlaceGeofences() throws {
        // Given
        locationManager.authorizationStatus = .authorizedAlways
        let taskId = "test-task"
        let location = TaskLocation(
            type: .customPlace,
            placeId: "test-place",
            category: nil
        )
        
        // When
        try geofenceService.registerTaskGeofences(taskId: taskId, location: location)
        
        // Then
        let activeGeofences = locationManager.getAllActiveGeofences()
        XCTAssertGreaterThan(activeGeofences.count, 0)
        
        // Verify approach geofence was registered
        let approachGeofence = activeGeofences.first { $0.id.contains("approach") }
        XCTAssertNotNil(approachGeofence)
        XCTAssertEqual(approachGeofence?.taskId, taskId)
        
        // Verify arrival geofence was registered
        let arrivalGeofence = activeGeofences.first { $0.id.contains("arrival") }
        XCTAssertNotNil(arrivalGeofence)
        XCTAssertEqual(arrivalGeofence?.taskId, taskId)
    }
    
    func testRegisterPOICategoryGeofences() throws {
        // Given
        locationManager.authorizationStatus = .authorizedAlways
        let taskId = "test-task"
        let location = TaskLocation(
            type: .poiCategory,
            placeId: nil,
            category: .gas
        )
        
        // When
        try geofenceService.registerTaskGeofences(taskId: taskId, location: location)
        
        // Then
        let activeGeofences = locationManager.getAllActiveGeofences()
        XCTAssertGreaterThan(activeGeofences.count, 0)
        
        // Verify tiered geofences were registered
        let gasGeofences = activeGeofences.filter { $0.id.contains("gas") }
        XCTAssertGreaterThan(gasGeofences.count, 0)
        
        // Verify different approach distances
        let approach5miGeofences = gasGeofences.filter { $0.type == .approach5mi }
        let approach3miGeofences = gasGeofences.filter { $0.type == .approach3mi }
        let approach1miGeofences = gasGeofences.filter { $0.type == .approach1mi }
        
        XCTAssertGreaterThan(approach5miGeofences.count, 0)
        XCTAssertGreaterThan(approach3miGeofences.count, 0)
        XCTAssertGreaterThan(approach1miGeofences.count, 0)
    }
    
    func testUnregisterTaskGeofences() throws {
        // Given
        locationManager.authorizationStatus = .authorizedAlways
        let taskId = "test-task"
        let location = TaskLocation(
            type: .customPlace,
            placeId: "test-place",
            category: nil
        )
        
        try geofenceService.registerTaskGeofences(taskId: taskId, location: location)
        XCTAssertGreaterThan(locationManager.getActiveGeofenceCount(), 0)
        
        // When
        geofenceService.unregisterTaskGeofences(taskId: taskId)
        
        // Then
        let remainingGeofences = locationManager.getAllActiveGeofences().filter { $0.taskId == taskId }
        XCTAssertEqual(remainingGeofences.count, 0)
    }
    
    // MARK: - Event Processing Tests
    
    func testGeofenceEnteredEventProcessing() {
        // Given
        let expectation = XCTestExpectation(description: "Geofence event processed")
        let taskId = "test-task"
        let geofenceId = "test-geofence"
        
        geofenceService.$lastGeofenceEvent
            .dropFirst()
            .sink { event in
                XCTAssertNotNil(event)
                XCTAssertEqual(event?.taskId, taskId)
                XCTAssertEqual(event?.geofenceId, geofenceId)
                XCTAssertEqual(event?.eventType, .entered)
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        // When
        let eventData: [String: Any] = [
            "geofenceId": geofenceId,
            "taskId": taskId,
            "type": GeofenceType.approach1mi.rawValue,
            "timestamp": Date()
        ]
        
        NotificationCenter.default.post(
            name: .geofenceEntered,
            object: geofenceId,
            userInfo: eventData
        )
        
        // Then
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testGeofenceExitedEventProcessing() {
        // Given
        let expectation = XCTestExpectation(description: "Geofence exit event processed")
        let taskId = "test-task"
        let geofenceId = "test-geofence"
        
        geofenceService.$lastGeofenceEvent
            .dropFirst()
            .sink { event in
                XCTAssertNotNil(event)
                XCTAssertEqual(event?.taskId, taskId)
                XCTAssertEqual(event?.geofenceId, geofenceId)
                XCTAssertEqual(event?.eventType, .exited)
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        // When
        let eventData: [String: Any] = [
            "geofenceId": geofenceId,
            "taskId": taskId,
            "type": GeofenceType.arrival.rawValue,
            "timestamp": Date()
        ]
        
        NotificationCenter.default.post(
            name: .geofenceExited,
            object: geofenceId,
            userInfo: eventData
        )
        
        // Then
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testVisitDetectedEventProcessing() {
        // Given
        let expectation = XCTestExpectation(description: "Visit processed")
        let coordinate = CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)
        let visit = MockCLVisit(coordinate: coordinate)
        
        NotificationCenter.default.publisher(for: .visitProcessed)
            .sink { notification in
                XCTAssertNotNil(notification.object as? MockCLVisit)
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        // When
        NotificationCenter.default.post(
            name: .visitDetected,
            object: visit
        )
        
        // Then
        wait(for: [expectation], timeout: 1.0)
    }
    
    // MARK: - Notification Scheduling Tests
    
    func testApproachNotificationScheduling() {
        // Given
        let expectation = XCTestExpectation(description: "Approach notification scheduled")
        let taskId = "test-task"
        
        NotificationCenter.default.publisher(for: .scheduleLocationNotification)
            .sink { notification in
                guard let userInfo = notification.userInfo,
                      let notificationTaskId = userInfo["taskId"] as? String,
                      let type = userInfo["type"] as? String else {
                    XCTFail("Missing notification data")
                    return
                }
                
                XCTAssertEqual(notificationTaskId, taskId)
                XCTAssertEqual(type, "approach")
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        // When
        let eventData: [String: Any] = [
            "geofenceId": "test-geofence",
            "taskId": taskId,
            "type": GeofenceType.approach1mi.rawValue,
            "timestamp": Date()
        ]
        
        NotificationCenter.default.post(
            name: .geofenceEntered,
            object: "test-geofence",
            userInfo: eventData
        )
        
        // Then
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testArrivalNotificationScheduling() {
        // Given
        let expectation = XCTestExpectation(description: "Arrival notification scheduled")
        let taskId = "test-task"
        
        NotificationCenter.default.publisher(for: .scheduleLocationNotification)
            .sink { notification in
                guard let userInfo = notification.userInfo,
                      let notificationTaskId = userInfo["taskId"] as? String,
                      let type = userInfo["type"] as? String else {
                    XCTFail("Missing notification data")
                    return
                }
                
                XCTAssertEqual(notificationTaskId, taskId)
                XCTAssertEqual(type, "arrival")
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        // When
        let eventData: [String: Any] = [
            "geofenceId": "test-geofence",
            "taskId": taskId,
            "type": GeofenceType.arrival.rawValue,
            "timestamp": Date()
        ]
        
        NotificationCenter.default.post(
            name: .geofenceEntered,
            object: "test-geofence",
            userInfo: eventData
        )
        
        // Then
        wait(for: [expectation], timeout: 1.0)
    }
    
    // MARK: - POI Category Tests
    
    func testAllPOICategoriesSupported() {
        let allCategories: [POICategory] = [.gas, .pharmacy, .grocery, .bank, .postOffice]
        
        for category in allCategories {
            // Given
            locationManager.authorizationStatus = .authorizedAlways
            let taskId = "test-task-\(category.rawValue)"
            let location = TaskLocation(
                type: .poiCategory,
                placeId: nil,
                category: category
            )
            
            // When & Then
            XCTAssertNoThrow(try geofenceService.registerTaskGeofences(taskId: taskId, location: location))
            
            let activeGeofences = locationManager.getAllActiveGeofences()
            let categoryGeofences = activeGeofences.filter { $0.id.contains(category.rawValue) }
            XCTAssertGreaterThan(categoryGeofences.count, 0, "No geofences registered for category \(category.rawValue)")
        }
    }
    
    // MARK: - Error Handling Tests
    
    func testRegisterGeofenceWithoutPermission() {
        // Given
        locationManager.authorizationStatus = .denied
        let taskId = "test-task"
        let location = TaskLocation(
            type: .customPlace,
            placeId: "test-place",
            category: nil
        )
        
        // When & Then
        XCTAssertThrowsError(try geofenceService.registerTaskGeofences(taskId: taskId, location: location))
    }
    
    func testRegisterGeofenceWithInvalidLocation() {
        // Given
        locationManager.authorizationStatus = .authorizedAlways
        let taskId = "test-task"
        let location = TaskLocation(
            type: .customPlace,
            placeId: nil, // Invalid - missing place ID
            category: nil
        )
        
        // When & Then
        XCTAssertThrowsError(try geofenceService.registerTaskGeofences(taskId: taskId, location: location))
    }
    
    func testRegisterGeofenceWithInvalidPOICategory() {
        // Given
        locationManager.authorizationStatus = .authorizedAlways
        let taskId = "test-task"
        let location = TaskLocation(
            type: .poiCategory,
            placeId: nil,
            category: nil // Invalid - missing category
        )
        
        // When & Then
        XCTAssertThrowsError(try geofenceService.registerTaskGeofences(taskId: taskId, location: location))
    }
}

// MARK: - Mock Classes

class MockCLVisit: CLVisit {
    private let _coordinate: CLLocationCoordinate2D
    private let _arrivalDate: Date
    private let _departureDate: Date
    
    init(coordinate: CLLocationCoordinate2D, arrivalDate: Date = Date(), departureDate: Date = Date.distantFuture) {
        self._coordinate = coordinate
        self._arrivalDate = arrivalDate
        self._departureDate = departureDate
        super.init()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override var coordinate: CLLocationCoordinate2D {
        return _coordinate
    }
    
    override var arrivalDate: Date {
        return _arrivalDate
    }
    
    override var departureDate: Date {
        return _departureDate
    }
    
    override var horizontalAccuracy: CLLocationAccuracy {
        return 10.0
    }
}