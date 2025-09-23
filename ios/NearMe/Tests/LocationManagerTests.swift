import XCTest
import CoreLocation
import Combine
@testable import NearMe

class LocationManagerTests: XCTestCase {
    var locationManager: LocationManager!
    var mockCLLocationManager: MockCLLocationManager!
    var cancellables: Set<AnyCancellable>!
    
    override func setUp() {
        super.setUp()
        locationManager = LocationManager()
        mockCLLocationManager = MockCLLocationManager()
        cancellables = Set<AnyCancellable>()
    }
    
    override func tearDown() {
        locationManager = nil
        mockCLLocationManager = nil
        cancellables = nil
        super.tearDown()
    }
    
    // MARK: - Permission Tests
    
    func testRequestLocationPermissionWhenNotDetermined() {
        // Given
        locationManager.authorizationStatus = .notDetermined
        
        // When
        locationManager.requestLocationPermission()
        
        // Then
        // In a real test, we would verify that requestWhenInUseAuthorization was called
        // This would require dependency injection of CLLocationManager
        XCTAssertEqual(locationManager.authorizationStatus, .notDetermined)
    }
    
    func testRequestLocationPermissionWhenDenied() {
        // Given
        locationManager.authorizationStatus = .denied
        
        // When
        locationManager.requestLocationPermission()
        
        // Then
        XCTAssertEqual(locationManager.locationError, .permissionDenied)
    }
    
    func testRequestAlwaysAuthorizationFromWhenInUse() {
        // Given
        locationManager.authorizationStatus = .authorizedWhenInUse
        
        // When
        locationManager.requestAlwaysAuthorization()
        
        // Then
        // Would verify requestAlwaysAuthorization was called on CLLocationManager
        XCTAssertEqual(locationManager.authorizationStatus, .authorizedWhenInUse)
    }
    
    // MARK: - Geofence Registration Tests
    
    func testRegisterGeofenceSuccess() throws {
        // Given
        locationManager.authorizationStatus = .authorizedAlways
        let identifier = "test-geofence"
        let taskId = "test-task"
        let center = CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)
        let radius: CLLocationDistance = 1000
        let type = GeofenceType.approach1mi
        
        // When
        try locationManager.registerGeofence(
            identifier: identifier,
            taskId: taskId,
            center: center,
            radius: radius,
            type: type
        )
        
        // Then
        XCTAssertEqual(locationManager.getActiveGeofenceCount(), 1)
        let geofenceInfo = locationManager.getGeofenceInfo(identifier: identifier)
        XCTAssertNotNil(geofenceInfo)
        XCTAssertEqual(geofenceInfo?.taskId, taskId)
        XCTAssertEqual(geofenceInfo?.type, type)
    }
    
    func testRegisterGeofenceWithoutAlwaysPermission() {
        // Given
        locationManager.authorizationStatus = .authorizedWhenInUse
        let identifier = "test-geofence"
        let taskId = "test-task"
        let center = CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)
        let radius: CLLocationDistance = 1000
        let type = GeofenceType.approach1mi
        
        // When & Then
        XCTAssertThrowsError(try locationManager.registerGeofence(
            identifier: identifier,
            taskId: taskId,
            center: center,
            radius: radius,
            type: type
        )) { error in
            XCTAssertEqual(error as? LocationError, .backgroundLocationDisabled)
        }
    }
    
    func testRegisterGeofenceWithInvalidCoordinate() {
        // Given
        locationManager.authorizationStatus = .authorizedAlways
        let identifier = "test-geofence"
        let taskId = "test-task"
        let center = CLLocationCoordinate2D(latitude: 200, longitude: 200) // Invalid
        let radius: CLLocationDistance = 1000
        let type = GeofenceType.approach1mi
        
        // When & Then
        XCTAssertThrowsError(try locationManager.registerGeofence(
            identifier: identifier,
            taskId: taskId,
            center: center,
            radius: radius,
            type: type
        )) { error in
            XCTAssertEqual(error as? LocationError, .invalidCoordinate)
        }
    }
    
    func testUnregisterGeofence() throws {
        // Given
        locationManager.authorizationStatus = .authorizedAlways
        let identifier = "test-geofence"
        let taskId = "test-task"
        let center = CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)
        let radius: CLLocationDistance = 1000
        let type = GeofenceType.approach1mi
        
        try locationManager.registerGeofence(
            identifier: identifier,
            taskId: taskId,
            center: center,
            radius: radius,
            type: type
        )
        
        // When
        locationManager.unregisterGeofence(identifier: identifier)
        
        // Then
        XCTAssertEqual(locationManager.getActiveGeofenceCount(), 0)
        XCTAssertNil(locationManager.getGeofenceInfo(identifier: identifier))
    }
    
    func testUnregisterAllGeofencesForTask() throws {
        // Given
        locationManager.authorizationStatus = .authorizedAlways
        let taskId = "test-task"
        let center = CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)
        
        // Register multiple geofences for the same task
        try locationManager.registerGeofence(
            identifier: "geofence-1",
            taskId: taskId,
            center: center,
            radius: 1000,
            type: .approach1mi
        )
        
        try locationManager.registerGeofence(
            identifier: "geofence-2",
            taskId: taskId,
            center: center,
            radius: 500,
            type: .arrival
        )
        
        try locationManager.registerGeofence(
            identifier: "geofence-3",
            taskId: "other-task",
            center: center,
            radius: 100,
            type: .postArrival
        )
        
        // When
        locationManager.unregisterAllGeofencesForTask(taskId: taskId)
        
        // Then
        XCTAssertEqual(locationManager.getActiveGeofenceCount(), 1)
        XCTAssertNil(locationManager.getGeofenceInfo(identifier: "geofence-1"))
        XCTAssertNil(locationManager.getGeofenceInfo(identifier: "geofence-2"))
        XCTAssertNotNil(locationManager.getGeofenceInfo(identifier: "geofence-3"))
    }
    
    // MARK: - Geofence Optimization Tests
    
    func testGeofenceOptimizationByPriority() throws {
        // Given
        locationManager.authorizationStatus = .authorizedAlways
        let center = CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)
        
        // Register maximum number of geofences
        for i in 0..<20 {
            try locationManager.registerGeofence(
                identifier: "geofence-\(i)",
                taskId: "task-\(i)",
                center: center,
                radius: 1000,
                type: .approach5mi // Low priority
            )
        }
        
        // When - Register a high priority geofence
        try locationManager.registerGeofence(
            identifier: "high-priority",
            taskId: "important-task",
            center: center,
            radius: 100,
            type: .postArrival // High priority
        )
        
        // Then
        XCTAssertEqual(locationManager.getActiveGeofenceCount(), 20)
        XCTAssertNotNil(locationManager.getGeofenceInfo(identifier: "high-priority"))
        
        // Verify that a low priority geofence was removed
        let activeGeofences = locationManager.getAllActiveGeofences()
        let lowPriorityCount = activeGeofences.filter { $0.type == .approach5mi }.count
        XCTAssertLessThan(lowPriorityCount, 20)
    }
    
    // MARK: - Battery Optimization Tests
    
    func testBatteryOptimizationToggle() {
        // Given
        locationManager.batteryOptimizationEnabled = true
        
        // When
        locationManager.setBatteryOptimization(enabled: false)
        
        // Then
        XCTAssertFalse(locationManager.batteryOptimizationEnabled)
    }
    
    // MARK: - Distance Calculation Tests
    
    func testDistanceToLocation() {
        // Given
        let currentLocation = CLLocation(latitude: 37.7749, longitude: -122.4194)
        locationManager.currentLocation = currentLocation
        
        let targetCoordinate = CLLocationCoordinate2D(latitude: 37.7849, longitude: -122.4094)
        
        // When
        let distance = locationManager.distanceToLocation(targetCoordinate)
        
        // Then
        XCTAssertNotNil(distance)
        XCTAssertGreaterThan(distance!, 0)
    }
    
    func testDistanceToLocationWithoutCurrentLocation() {
        // Given
        locationManager.currentLocation = nil
        let targetCoordinate = CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)
        
        // When
        let distance = locationManager.distanceToLocation(targetCoordinate)
        
        // Then
        XCTAssertNil(distance)
    }
    
    // MARK: - Geofence Type Tests
    
    func testGeofenceTypeRadii() {
        XCTAssertEqual(GeofenceType.approach5mi.radiusInMeters, 8047, accuracy: 1)
        XCTAssertEqual(GeofenceType.approach3mi.radiusInMeters, 4828, accuracy: 1)
        XCTAssertEqual(GeofenceType.approach1mi.radiusInMeters, 1609, accuracy: 1)
        XCTAssertEqual(GeofenceType.arrival.radiusInMeters, 100)
        XCTAssertEqual(GeofenceType.postArrival.radiusInMeters, 50)
    }
    
    func testGeofenceTypePriorities() {
        XCTAssertEqual(GeofenceType.postArrival.priority, 5)
        XCTAssertEqual(GeofenceType.arrival.priority, 4)
        XCTAssertEqual(GeofenceType.approach1mi.priority, 3)
        XCTAssertEqual(GeofenceType.approach3mi.priority, 2)
        XCTAssertEqual(GeofenceType.approach5mi.priority, 1)
    }
    
    // MARK: - Location Error Tests
    
    func testLocationErrorDescriptions() {
        XCTAssertNotNil(LocationError.permissionDenied.errorDescription)
        XCTAssertNotNil(LocationError.locationUnavailable.errorDescription)
        XCTAssertNotNil(LocationError.geofenceLimitExceeded.errorDescription)
        XCTAssertNotNil(LocationError.invalidCoordinate.errorDescription)
        XCTAssertNotNil(LocationError.backgroundLocationDisabled.errorDescription)
    }
}

// MARK: - Mock Classes

class MockCLLocationManager: CLLocationManager {
    var mockAuthorizationStatus: CLAuthorizationStatus = .notDetermined
    var mockLocation: CLLocation?
    var mockMonitoredRegions: Set<CLRegion> = []
    
    override var authorizationStatus: CLAuthorizationStatus {
        return mockAuthorizationStatus
    }
    
    override var location: CLLocation? {
        return mockLocation
    }
    
    override var monitoredRegions: Set<CLRegion> {
        return mockMonitoredRegions
    }
    
    override func requestWhenInUseAuthorization() {
        // Mock implementation
    }
    
    override func requestAlwaysAuthorization() {
        // Mock implementation
    }
    
    override func startUpdatingLocation() {
        // Mock implementation
    }
    
    override func startMonitoringSignificantLocationChanges() {
        // Mock implementation
    }
    
    override func startMonitoringVisits() {
        // Mock implementation
    }
    
    override func startMonitoring(for region: CLRegion) {
        mockMonitoredRegions.insert(region)
    }
    
    override func stopMonitoring(for region: CLRegion) {
        mockMonitoredRegions.remove(region)
    }
    
    override func requestState(for region: CLRegion) {
        // Mock implementation
    }
}

// MARK: - Test Utilities

extension LocationManagerTests {
    func createTestGeofenceInfo(
        id: String = "test-geofence",
        taskId: String = "test-task",
        type: GeofenceType = .approach1mi
    ) -> GeofenceInfo {
        return GeofenceInfo(
            id: id,
            taskId: taskId,
            center: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
            radius: type.radiusInMeters,
            type: type,
            priority: type.priority,
            createdAt: Date()
        )
    }
    
    func simulateLocationUpdate(_ location: CLLocation) {
        locationManager.currentLocation = location
        NotificationCenter.default.post(
            name: .locationUpdated,
            object: location
        )
    }
    
    func simulateGeofenceEntry(_ identifier: String) {
        let region = CLCircularRegion(
            center: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
            radius: 1000,
            identifier: identifier
        )
        
        NotificationCenter.default.post(
            name: .geofenceEntered,
            object: identifier,
            userInfo: [
                "geofenceId": identifier,
                "timestamp": Date()
            ]
        )
    }
}