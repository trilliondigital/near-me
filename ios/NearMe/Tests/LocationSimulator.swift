import Foundation
import CoreLocation
import Combine

// MARK: - Location Simulator
class LocationSimulator: ObservableObject {
    private var timer: Timer?
    private var currentIndex = 0
    private var route: [CLLocation] = []
    private var isSimulating = false
    
    @Published var currentSimulatedLocation: CLLocation?
    @Published var simulationProgress: Double = 0.0
    
    // MARK: - Simulation Control
    func startSimulation(route: [CLLocation], interval: TimeInterval = 1.0) {
        guard !route.isEmpty else { return }
        
        self.route = route
        self.currentIndex = 0
        self.isSimulating = true
        
        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            self?.updateSimulatedLocation()
        }
    }
    
    func stopSimulation() {
        timer?.invalidate()
        timer = nil
        isSimulating = false
        currentIndex = 0
        simulationProgress = 0.0
    }
    
    func pauseSimulation() {
        timer?.invalidate()
        timer = nil
    }
    
    func resumeSimulation(interval: TimeInterval = 1.0) {
        guard isSimulating && timer == nil else { return }
        
        timer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            self?.updateSimulatedLocation()
        }
    }
    
    private func updateSimulatedLocation() {
        guard currentIndex < route.count else {
            stopSimulation()
            return
        }
        
        let location = route[currentIndex]
        currentSimulatedLocation = location
        simulationProgress = Double(currentIndex) / Double(route.count - 1)
        
        // Post location update notification
        NotificationCenter.default.post(
            name: .simulatedLocationUpdated,
            object: location
        )
        
        currentIndex += 1
    }
    
    // MARK: - Route Generation
    static func generateLinearRoute(
        from start: CLLocationCoordinate2D,
        to end: CLLocationCoordinate2D,
        steps: Int = 10
    ) -> [CLLocation] {
        var route: [CLLocation] = []
        
        let latStep = (end.latitude - start.latitude) / Double(steps - 1)
        let lonStep = (end.longitude - start.longitude) / Double(steps - 1)
        
        for i in 0..<steps {
            let lat = start.latitude + (latStep * Double(i))
            let lon = start.longitude + (lonStep * Double(i))
            let location = CLLocation(latitude: lat, longitude: lon)
            route.append(location)
        }
        
        return route
    }
    
    static func generateCircularRoute(
        center: CLLocationCoordinate2D,
        radius: CLLocationDistance,
        steps: Int = 20
    ) -> [CLLocation] {
        var route: [CLLocation] = []
        let radiusInDegrees = radius / 111000.0 // Approximate conversion to degrees
        
        for i in 0..<steps {
            let angle = (Double(i) / Double(steps)) * 2 * Double.pi
            let lat = center.latitude + (radiusInDegrees * cos(angle))
            let lon = center.longitude + (radiusInDegrees * sin(angle))
            let location = CLLocation(latitude: lat, longitude: lon)
            route.append(location)
        }
        
        return route
    }
    
    static func generateApproachRoute(
        to destination: CLLocationCoordinate2D,
        fromDistance: CLLocationDistance = 10000, // 10km
        steps: Int = 15
    ) -> [CLLocation] {
        // Generate a route approaching the destination from the north
        let startLat = destination.latitude + (fromDistance / 111000.0)
        let start = CLLocationCoordinate2D(latitude: startLat, longitude: destination.longitude)
        
        return generateLinearRoute(from: start, to: destination, steps: steps)
    }
}

// MARK: - Geofence Test Scenarios
class GeofenceTestScenarios {
    
    // MARK: - Approach Scenarios
    static func createApproachScenario(destination: CLLocationCoordinate2D) -> GeofenceTestScenario {
        let route = LocationSimulator.generateApproachRoute(to: destination, fromDistance: 10000, steps: 20)
        
        return GeofenceTestScenario(
            name: "Approach Test",
            description: "Tests 5mi, 3mi, 1mi approach geofences",
            route: route,
            expectedEvents: [
                GeofenceTestEvent(type: .approach5mi, expectedAtStep: 5),
                GeofenceTestEvent(type: .approach3mi, expectedAtStep: 10),
                GeofenceTestEvent(type: .approach1mi, expectedAtStep: 15),
                GeofenceTestEvent(type: .arrival, expectedAtStep: 19)
            ]
        )
    }
    
    static func createArrivalScenario(destination: CLLocationCoordinate2D) -> GeofenceTestScenario {
        let route = LocationSimulator.generateLinearRoute(
            from: CLLocationCoordinate2D(
                latitude: destination.latitude - 0.001,
                longitude: destination.longitude - 0.001
            ),
            to: destination,
            steps: 10
        )
        
        return GeofenceTestScenario(
            name: "Arrival Test",
            description: "Tests arrival and post-arrival geofences",
            route: route,
            expectedEvents: [
                GeofenceTestEvent(type: .arrival, expectedAtStep: 8),
                GeofenceTestEvent(type: .postArrival, expectedAtStep: 9)
            ]
        )
    }
    
    static func createCircularScenario(center: CLLocationCoordinate2D) -> GeofenceTestScenario {
        let route = LocationSimulator.generateCircularRoute(center: center, radius: 2000, steps: 30)
        
        return GeofenceTestScenario(
            name: "Circular Test",
            description: "Tests geofence entry and exit events",
            route: route,
            expectedEvents: [
                GeofenceTestEvent(type: .approach1mi, expectedAtStep: 5),
                GeofenceTestEvent(type: .arrival, expectedAtStep: 10)
            ]
        )
    }
    
    static func createBatteryOptimizationScenario() -> GeofenceTestScenario {
        let center = CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)
        
        // Create a route that stays in one area for a long time (simulating a visit)
        var route: [CLLocation] = []
        
        // Add stationary points (simulating a long visit)
        for _ in 0..<20 {
            route.append(CLLocation(latitude: center.latitude, longitude: center.longitude))
        }
        
        // Add some movement
        let movementRoute = LocationSimulator.generateLinearRoute(
            from: center,
            to: CLLocationCoordinate2D(latitude: center.latitude + 0.01, longitude: center.longitude + 0.01),
            steps: 10
        )
        route.append(contentsOf: movementRoute)
        
        return GeofenceTestScenario(
            name: "Battery Optimization Test",
            description: "Tests visit detection and battery optimization",
            route: route,
            expectedEvents: []
        )
    }
}

// MARK: - Test Scenario Models
struct GeofenceTestScenario {
    let name: String
    let description: String
    let route: [CLLocation]
    let expectedEvents: [GeofenceTestEvent]
}

struct GeofenceTestEvent {
    let type: GeofenceType
    let expectedAtStep: Int
}

// MARK: - Mock Location Manager for Testing
class MockLocationManagerForTesting: LocationManager {
    private var simulator: LocationSimulator?
    private var cancellables = Set<AnyCancellable>()
    
    override init() {
        super.init()
        setupSimulator()
    }
    
    private func setupSimulator() {
        simulator = LocationSimulator()
        
        simulator?.$currentSimulatedLocation
            .compactMap { $0 }
            .sink { [weak self] location in
                self?.currentLocation = location
                NotificationCenter.default.post(
                    name: .locationUpdated,
                    object: location
                )
            }
            .store(in: &cancellables)
    }
    
    func runTestScenario(_ scenario: GeofenceTestScenario, interval: TimeInterval = 0.5) {
        simulator?.startSimulation(route: scenario.route, interval: interval)
    }
    
    func stopTestScenario() {
        simulator?.stopSimulation()
    }
    
    func simulateGeofenceEntry(identifier: String, taskId: String, type: GeofenceType) {
        let eventData: [String: Any] = [
            "geofenceId": identifier,
            "taskId": taskId,
            "type": type.rawValue,
            "timestamp": Date(),
            "location": currentLocation as Any
        ]
        
        NotificationCenter.default.post(
            name: .geofenceEntered,
            object: identifier,
            userInfo: eventData
        )
    }
    
    func simulateGeofenceExit(identifier: String, taskId: String, type: GeofenceType) {
        let eventData: [String: Any] = [
            "geofenceId": identifier,
            "taskId": taskId,
            "type": type.rawValue,
            "timestamp": Date(),
            "location": currentLocation as Any
        ]
        
        NotificationCenter.default.post(
            name: .geofenceExited,
            object: identifier,
            userInfo: eventData
        )
    }
    
    func simulateVisit(at coordinate: CLLocationCoordinate2D, duration: TimeInterval = 300) {
        let visit = MockCLVisit(
            coordinate: coordinate,
            arrivalDate: Date(),
            departureDate: Date().addingTimeInterval(duration)
        )
        
        NotificationCenter.default.post(
            name: .visitDetected,
            object: visit
        )
    }
}

// MARK: - Test Utilities
extension LocationManagerTests {
    func runGeofenceScenarioTest(
        scenario: GeofenceTestScenario,
        timeout: TimeInterval = 30.0
    ) {
        let expectation = XCTestExpectation(description: "Scenario completed: \(scenario.name)")
        let mockLocationManager = MockLocationManagerForTesting()
        
        // Set up event tracking
        var receivedEvents: [GeofenceTestEvent] = []
        
        NotificationCenter.default.publisher(for: .geofenceEntered)
            .sink { notification in
                // Track received events
                if let userInfo = notification.userInfo,
                   let typeString = userInfo["type"] as? String,
                   let type = GeofenceType(rawValue: typeString) {
                    receivedEvents.append(GeofenceTestEvent(type: type, expectedAtStep: -1))
                }
            }
            .store(in: &cancellables)
        
        // Complete scenario after route finishes
        mockLocationManager.simulator?.$simulationProgress
            .filter { $0 >= 1.0 }
            .sink { _ in
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        // Run the scenario
        mockLocationManager.runTestScenario(scenario)
        
        wait(for: [expectation], timeout: timeout)
        
        // Verify expected events were received
        for expectedEvent in scenario.expectedEvents {
            let matchingEvents = receivedEvents.filter { $0.type == expectedEvent.type }
            XCTAssertGreaterThan(matchingEvents.count, 0, "Expected event \(expectedEvent.type) was not received")
        }
    }
}

// MARK: - Additional Notification Names
extension Notification.Name {
    static let simulatedLocationUpdated = Notification.Name("simulatedLocationUpdated")
}