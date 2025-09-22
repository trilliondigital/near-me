import Foundation
import CoreLocation
import Combine

// MARK: - Geofence Service
class GeofenceService: ObservableObject {
    private let locationManager: LocationManager
    private var cancellables = Set<AnyCancellable>()
    
    @Published var isProcessingGeofenceEvent = false
    @Published var lastGeofenceEvent: GeofenceEvent?
    
    // MARK: - Initialization
    init(locationManager: LocationManager) {
        self.locationManager = locationManager
        setupNotificationObservers()
    }
    
    private func setupNotificationObservers() {
        // Listen for geofence events
        NotificationCenter.default.publisher(for: .geofenceEntered)
            .sink { [weak self] notification in
                self?.handleGeofenceEntered(notification)
            }
            .store(in: &cancellables)
        
        NotificationCenter.default.publisher(for: .geofenceExited)
            .sink { [weak self] notification in
                self?.handleGeofenceExited(notification)
            }
            .store(in: &cancellables)
        
        NotificationCenter.default.publisher(for: .visitDetected)
            .sink { [weak self] notification in
                self?.handleVisitDetected(notification)
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Task-Based Geofence Management
    func registerTaskGeofences(
        taskId: String,
        location: TaskLocation,
        customRadii: GeofenceRadii? = nil
    ) throws {
        switch location.type {
        case .customPlace:
            guard let placeId = location.placeId else {
                throw LocationError.invalidCoordinate
            }
            try registerCustomPlaceGeofences(taskId: taskId, placeId: placeId, customRadii: customRadii)
            
        case .poiCategory:
            guard let category = location.category else {
                throw LocationError.invalidCoordinate
            }
            try registerPOICategoryGeofences(taskId: taskId, category: category)
        }
    }
    
    private func registerCustomPlaceGeofences(
        taskId: String,
        placeId: String,
        customRadii: GeofenceRadii?
    ) throws {
        // In a real implementation, this would fetch place details from a service
        // For now, using mock coordinates
        let coordinate = CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)
        
        let radii = customRadii ?? getDefaultRadiiForCustomPlace()
        
        // Register approach geofence (5 miles or custom)
        try locationManager.registerGeofence(
            identifier: "\(taskId)_approach",
            taskId: taskId,
            center: coordinate,
            radius: radii.approach * 1609.34, // Convert miles to meters
            type: .approach5mi
        )
        
        // Register arrival geofence
        try locationManager.registerGeofence(
            identifier: "\(taskId)_arrival",
            taskId: taskId,
            center: coordinate,
            radius: radii.arrival,
            type: .arrival
        )
        
        // Register post-arrival geofence if enabled
        if radii.postArrival {
            try locationManager.registerGeofence(
                identifier: "\(taskId)_post_arrival",
                taskId: taskId,
                center: coordinate,
                radius: 50, // 50 meters for post-arrival
                type: .postArrival
            )
        }
    }
    
    private func registerPOICategoryGeofences(
        taskId: String,
        category: POICategory
    ) throws {
        // In a real implementation, this would find nearby POIs of the specified category
        // For now, using mock coordinates for demonstration
        let nearbyPOIs = getMockPOIsForCategory(category)
        
        for (index, poi) in nearbyPOIs.enumerated() {
            // Register tiered geofences for each POI
            let geofenceTypes: [GeofenceType] = [.approach5mi, .approach3mi, .approach1mi]
            
            for type in geofenceTypes {
                try locationManager.registerGeofence(
                    identifier: "\(taskId)_\(category.rawValue)_\(index)_\(type.rawValue)",
                    taskId: taskId,
                    center: poi.coordinate,
                    radius: type.radiusInMeters,
                    type: type
                )
            }
        }
    }
    
    func unregisterTaskGeofences(taskId: String) {
        locationManager.unregisterAllGeofencesForTask(taskId: taskId)
    }
    
    // MARK: - Event Handling
    private func handleGeofenceEntered(_ notification: Notification) {
        guard let identifier = notification.object as? String,
              let userInfo = notification.userInfo,
              let geofenceId = userInfo["geofenceId"] as? String,
              let taskId = userInfo["taskId"] as? String,
              let typeString = userInfo["type"] as? String,
              let type = GeofenceType(rawValue: typeString),
              let timestamp = userInfo["timestamp"] as? Date else {
            return
        }
        
        isProcessingGeofenceEvent = true
        
        let event = GeofenceEvent(
            geofenceId: geofenceId,
            taskId: taskId,
            type: type,
            eventType: .entered,
            timestamp: timestamp,
            location: userInfo["location"] as? CLLocation
        )
        
        processGeofenceEvent(event)
        lastGeofenceEvent = event
        
        isProcessingGeofenceEvent = false
    }
    
    private func handleGeofenceExited(_ notification: Notification) {
        guard let identifier = notification.object as? String,
              let userInfo = notification.userInfo,
              let geofenceId = userInfo["geofenceId"] as? String,
              let taskId = userInfo["taskId"] as? String,
              let typeString = userInfo["type"] as? String,
              let type = GeofenceType(rawValue: typeString),
              let timestamp = userInfo["timestamp"] as? Date else {
            return
        }
        
        let event = GeofenceEvent(
            geofenceId: geofenceId,
            taskId: taskId,
            type: type,
            eventType: .exited,
            timestamp: timestamp,
            location: userInfo["location"] as? CLLocation
        )
        
        processGeofenceEvent(event)
        lastGeofenceEvent = event
    }
    
    private func handleVisitDetected(_ notification: Notification) {
        guard let visit = notification.object as? CLVisit else { return }
        
        // Use visit detection for battery optimization
        // If user has been at a location for a while, we can reduce location monitoring frequency
        print("Visit detected at \(visit.coordinate) from \(visit.arrivalDate) to \(visit.departureDate)")
        
        // Post visit event for potential post-arrival notifications
        NotificationCenter.default.post(
            name: .visitProcessed,
            object: visit
        )
    }
    
    private func processGeofenceEvent(_ event: GeofenceEvent) {
        // This would integrate with the notification system
        // For now, just log the event
        print("Processing geofence event: \(event)")
        
        switch event.type {
        case .approach5mi, .approach3mi, .approach1mi:
            scheduleApproachNotification(for: event)
        case .arrival:
            scheduleArrivalNotification(for: event)
        case .postArrival:
            schedulePostArrivalNotification(for: event)
        }
    }
    
    // MARK: - Notification Scheduling
    private func scheduleApproachNotification(for event: GeofenceEvent) {
        let distance = getDistanceString(for: event.type)
        let title = "Approaching Location"
        let body = "You're \(distance) from your destination"
        
        NotificationCenter.default.post(
            name: .scheduleLocationNotification,
            object: nil,
            userInfo: [
                "taskId": event.taskId,
                "type": "approach",
                "title": title,
                "body": body,
                "geofenceEvent": event
            ]
        )
    }
    
    private func scheduleArrivalNotification(for event: GeofenceEvent) {
        let title = "Arrived at Location"
        let body = "You've arrived at your destination"
        
        NotificationCenter.default.post(
            name: .scheduleLocationNotification,
            object: nil,
            userInfo: [
                "taskId": event.taskId,
                "type": "arrival",
                "title": title,
                "body": body,
                "geofenceEvent": event
            ]
        )
    }
    
    private func schedulePostArrivalNotification(for event: GeofenceEvent) {
        let title = "Still Here?"
        let body = "Don't forget to complete your task"
        
        // Schedule with a delay for post-arrival
        DispatchQueue.main.asyncAfter(deadline: .now() + 300) { // 5 minutes
            NotificationCenter.default.post(
                name: .scheduleLocationNotification,
                object: nil,
                userInfo: [
                    "taskId": event.taskId,
                    "type": "post_arrival",
                    "title": title,
                    "body": body,
                    "geofenceEvent": event
                ]
            )
        }
    }
    
    // MARK: - Utility Methods
    private func getDefaultRadiiForCustomPlace() -> GeofenceRadii {
        return GeofenceRadii(
            approach: 5.0, // 5 miles
            arrival: 100.0, // 100 meters
            postArrival: true
        )
    }
    
    private func getDistanceString(for type: GeofenceType) -> String {
        switch type {
        case .approach5mi: return "5 miles"
        case .approach3mi: return "3 miles"
        case .approach1mi: return "1 mile"
        case .arrival: return "very close to"
        case .postArrival: return "at"
        }
    }
    
    private func getMockPOIsForCategory(_ category: POICategory) -> [MockPOI] {
        // Mock POI data - in real implementation, this would come from a POI service
        switch category {
        case .gas:
            return [
                MockPOI(coordinate: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)),
                MockPOI(coordinate: CLLocationCoordinate2D(latitude: 37.7849, longitude: -122.4094))
            ]
        case .pharmacy:
            return [
                MockPOI(coordinate: CLLocationCoordinate2D(latitude: 37.7649, longitude: -122.4294))
            ]
        case .grocery:
            return [
                MockPOI(coordinate: CLLocationCoordinate2D(latitude: 37.7549, longitude: -122.4394))
            ]
        case .bank:
            return [
                MockPOI(coordinate: CLLocationCoordinate2D(latitude: 37.7449, longitude: -122.4494))
            ]
        case .postOffice:
            return [
                MockPOI(coordinate: CLLocationCoordinate2D(latitude: 37.7349, longitude: -122.4594))
            ]
        }
    }
}

// MARK: - Supporting Types
struct GeofenceEvent {
    let geofenceId: String
    let taskId: String
    let type: GeofenceType
    let eventType: GeofenceEventType
    let timestamp: Date
    let location: CLLocation?
}

enum GeofenceEventType {
    case entered
    case exited
}

struct TaskLocation {
    let type: TaskLocationType
    let placeId: String?
    let category: POICategory?
}

enum TaskLocationType {
    case customPlace
    case poiCategory
}

enum POICategory: String, CaseIterable {
    case gas = "gas"
    case pharmacy = "pharmacy"
    case grocery = "grocery"
    case bank = "bank"
    case postOffice = "post_office"
}

struct GeofenceRadii {
    let approach: Double // miles
    let arrival: Double // meters
    let postArrival: Bool
}

struct MockPOI {
    let coordinate: CLLocationCoordinate2D
}

// MARK: - Additional Notification Names
extension Notification.Name {
    static let scheduleLocationNotification = Notification.Name("scheduleLocationNotification")
    static let visitProcessed = Notification.Name("visitProcessed")
}