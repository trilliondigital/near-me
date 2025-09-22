import Foundation
import CoreLocation
import Combine
import UIKit

// MARK: - Geofence Models
struct GeofenceInfo {
    let id: String
    let taskId: String
    let center: CLLocationCoordinate2D
    let radius: CLLocationDistance
    let type: GeofenceType
    let priority: Int
    let createdAt: Date
}

enum GeofenceType: String, CaseIterable {
    case approach5mi = "approach_5mi"
    case approach3mi = "approach_3mi"
    case approach1mi = "approach_1mi"
    case arrival = "arrival"
    case postArrival = "post_arrival"
    
    var radiusInMeters: CLLocationDistance {
        switch self {
        case .approach5mi: return 8047 // 5 miles
        case .approach3mi: return 4828 // 3 miles
        case .approach1mi: return 1609 // 1 mile
        case .arrival: return 100 // 100 meters
        case .postArrival: return 50 // 50 meters
        }
    }
    
    var priority: Int {
        switch self {
        case .postArrival: return 5
        case .arrival: return 4
        case .approach1mi: return 3
        case .approach3mi: return 2
        case .approach5mi: return 1
        }
    }
}

enum LocationError: Error, LocalizedError {
    case permissionDenied
    case locationUnavailable
    case geofenceLimitExceeded
    case invalidCoordinate
    case backgroundLocationDisabled
    
    var errorDescription: String? {
        switch self {
        case .permissionDenied:
            return "Location permission is required for location-based reminders"
        case .locationUnavailable:
            return "Unable to determine your location"
        case .geofenceLimitExceeded:
            return "Maximum number of location reminders reached"
        case .invalidCoordinate:
            return "Invalid location coordinates"
        case .backgroundLocationDisabled:
            return "Background location access is required for reliable reminders"
        }
    }
}

// MARK: - Location Manager
class LocationManager: NSObject, ObservableObject {
    private let locationManager = CLLocationManager()
    private var activeGeofences: [String: GeofenceInfo] = [:]
    private var lastLocationUpdate = Date()
    private var visitStartTime: Date?
    private var isInBackground = false
    
    // MARK: - Published Properties
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined
    @Published var currentLocation: CLLocation?
    @Published var isLocationEnabled = false
    @Published var locationError: LocationError?
    @Published var batteryOptimizationEnabled = true
    @Published var significantLocationChangesEnabled = true
    
    // MARK: - Constants
    private let maxActiveGeofences = 20
    private let locationUpdateInterval: TimeInterval = 300 // 5 minutes
    private let batteryOptimizationThreshold: TimeInterval = 1800 // 30 minutes
    private let visitDurationThreshold: TimeInterval = 300 // 5 minutes
    
    // MARK: - Initialization
    override init() {
        super.init()
        setupLocationManager()
        setupBackgroundObservers()
    }
    
    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        locationManager.distanceFilter = 50 // 50 meters
        authorizationStatus = locationManager.authorizationStatus
    }
    
    private func setupBackgroundObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
    }
    
    @objc private func appDidEnterBackground() {
        isInBackground = true
        optimizeForBackground()
    }
    
    @objc private func appWillEnterForeground() {
        isInBackground = false
        optimizeForForeground()
        reregisterGeofencesIfNeeded()
    }
    
    // MARK: - Permission Management
    func requestLocationPermission() {
        switch authorizationStatus {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            locationError = .permissionDenied
        case .authorizedWhenInUse:
            // Request always authorization for geofencing
            locationManager.requestAlwaysAuthorization()
        case .authorizedAlways:
            startLocationServices()
        @unknown default:
            break
        }
    }
    
    func requestAlwaysAuthorization() {
        guard authorizationStatus == .authorizedWhenInUse else { return }
        locationManager.requestAlwaysAuthorization()
    }
    
    // MARK: - Location Services
    private func startLocationServices() {
        guard authorizationStatus == .authorizedAlways || authorizationStatus == .authorizedWhenInUse else {
            locationError = .permissionDenied
            return
        }
        
        isLocationEnabled = true
        locationError = nil
        
        // Start appropriate location monitoring based on authorization
        if authorizationStatus == .authorizedAlways {
            startSignificantLocationChanges()
            startVisitMonitoring()
        } else {
            // Graceful degradation for when-in-use permission
            locationManager.startUpdatingLocation()
        }
    }
    
    private func startSignificantLocationChanges() {
        guard CLLocationManager.significantLocationChangeMonitoringAvailable() else { return }
        locationManager.startMonitoringSignificantLocationChanges()
        significantLocationChangesEnabled = true
    }
    
    private func startVisitMonitoring() {
        guard CLLocationManager.isMonitoringAvailable(for: CLVisit.self) else { return }
        locationManager.startMonitoringVisits()
    }
    
    private func optimizeForBackground() {
        guard batteryOptimizationEnabled else { return }
        
        // Reduce location accuracy for battery optimization
        locationManager.desiredAccuracy = kCLLocationAccuracyKilometer
        locationManager.distanceFilter = 500 // 500 meters
    }
    
    private func optimizeForForeground() {
        // Restore normal accuracy when in foreground
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        locationManager.distanceFilter = 50 // 50 meters
    }
    
    // MARK: - Geofence Management
    func registerGeofence(
        identifier: String,
        taskId: String,
        center: CLLocationCoordinate2D,
        radius: CLLocationDistance,
        type: GeofenceType
    ) throws {
        guard authorizationStatus == .authorizedAlways else {
            throw LocationError.backgroundLocationDisabled
        }
        
        guard CLLocationCoordinate2DIsValid(center) else {
            throw LocationError.invalidCoordinate
        }
        
        // Check geofence limit
        if activeGeofences.count >= maxActiveGeofences {
            try optimizeActiveGeofences()
        }
        
        let geofenceInfo = GeofenceInfo(
            id: identifier,
            taskId: taskId,
            center: center,
            radius: radius,
            type: type,
            priority: type.priority,
            createdAt: Date()
        )
        
        let region = CLCircularRegion(
            center: center,
            radius: min(radius, locationManager.maximumRegionMonitoringDistance),
            identifier: identifier
        )
        region.notifyOnEntry = true
        region.notifyOnExit = true
        
        locationManager.startMonitoring(for: region)
        activeGeofences[identifier] = geofenceInfo
        
        print("Registered geofence: \(identifier) at \(center) with radius \(radius)m")
    }
    
    func unregisterGeofence(identifier: String) {
        if let region = locationManager.monitoredRegions.first(where: { $0.identifier == identifier }) {
            locationManager.stopMonitoring(for: region)
            activeGeofences.removeValue(forKey: identifier)
            print("Unregistered geofence: \(identifier)")
        }
    }
    
    func unregisterAllGeofencesForTask(taskId: String) {
        let taskGeofences = activeGeofences.filter { $0.value.taskId == taskId }
        for (identifier, _) in taskGeofences {
            unregisterGeofence(identifier: identifier)
        }
    }
    
    private func optimizeActiveGeofences() throws {
        guard activeGeofences.count >= maxActiveGeofences else { return }
        
        // Sort by priority (higher priority = more important)
        let sortedGeofences = activeGeofences.sorted { first, second in
            if first.value.priority != second.value.priority {
                return first.value.priority > second.value.priority
            }
            // If same priority, prefer newer geofences
            return first.value.createdAt > second.value.createdAt
        }
        
        // Remove lowest priority geofences
        let toRemove = sortedGeofences.suffix(sortedGeofences.count - maxActiveGeofences + 1)
        for (identifier, _) in toRemove {
            unregisterGeofence(identifier: identifier)
        }
        
        if activeGeofences.count >= maxActiveGeofences {
            throw LocationError.geofenceLimitExceeded
        }
    }
    
    private func reregisterGeofencesIfNeeded() {
        // iOS may remove geofences when app is terminated
        // Re-register if we have fewer monitored regions than expected
        let monitoredCount = locationManager.monitoredRegions.count
        let expectedCount = activeGeofences.count
        
        if monitoredCount < expectedCount {
            print("Re-registering geofences after app restart")
            for (identifier, geofenceInfo) in activeGeofences {
                let region = CLCircularRegion(
                    center: geofenceInfo.center,
                    radius: geofenceInfo.radius,
                    identifier: identifier
                )
                region.notifyOnEntry = true
                region.notifyOnExit = true
                locationManager.startMonitoring(for: region)
            }
        }
    }
    
    // MARK: - Utility Methods
    func getActiveGeofenceCount() -> Int {
        return activeGeofences.count
    }
    
    func getGeofenceInfo(identifier: String) -> GeofenceInfo? {
        return activeGeofences[identifier]
    }
    
    func getAllActiveGeofences() -> [GeofenceInfo] {
        return Array(activeGeofences.values)
    }
    
    func distanceToLocation(_ coordinate: CLLocationCoordinate2D) -> CLLocationDistance? {
        guard let currentLocation = currentLocation else { return nil }
        let targetLocation = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        return currentLocation.distance(from: targetLocation)
    }
    
    // MARK: - Battery Optimization
    func setBatteryOptimization(enabled: Bool) {
        batteryOptimizationEnabled = enabled
        if isInBackground {
            if enabled {
                optimizeForBackground()
            } else {
                optimizeForForeground()
            }
        }
    }
    
    private func shouldUpdateLocation() -> Bool {
        guard batteryOptimizationEnabled else { return true }
        
        let timeSinceLastUpdate = Date().timeIntervalSince(lastLocationUpdate)
        return timeSinceLastUpdate >= locationUpdateInterval
    }
}

// MARK: - CLLocationManagerDelegate
extension LocationManager: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        
        // Battery optimization: throttle location updates
        guard shouldUpdateLocation() else { return }
        
        currentLocation = location
        lastLocationUpdate = Date()
        locationError = nil
        
        // Post location update notification
        NotificationCenter.default.post(
            name: .locationUpdated,
            object: location
        )
    }
    
    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        DispatchQueue.main.async {
            self.authorizationStatus = status
            
            switch status {
            case .authorizedAlways:
                self.startLocationServices()
                self.locationError = nil
            case .authorizedWhenInUse:
                self.startLocationServices()
                // Note: Limited functionality without always authorization
            case .denied, .restricted:
                self.isLocationEnabled = false
                self.locationError = .permissionDenied
            case .notDetermined:
                break
            @unknown default:
                break
            }
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        print("Entered geofence: \(region.identifier)")
        
        guard let geofenceInfo = activeGeofences[region.identifier] else {
            print("Warning: Entered unknown geofence \(region.identifier)")
            return
        }
        
        let eventData: [String: Any] = [
            "geofenceId": region.identifier,
            "taskId": geofenceInfo.taskId,
            "type": geofenceInfo.type.rawValue,
            "timestamp": Date(),
            "location": currentLocation as Any
        ]
        
        NotificationCenter.default.post(
            name: .geofenceEntered,
            object: region.identifier,
            userInfo: eventData
        )
    }
    
    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        print("Exited geofence: \(region.identifier)")
        
        guard let geofenceInfo = activeGeofences[region.identifier] else {
            print("Warning: Exited unknown geofence \(region.identifier)")
            return
        }
        
        let eventData: [String: Any] = [
            "geofenceId": region.identifier,
            "taskId": geofenceInfo.taskId,
            "type": geofenceInfo.type.rawValue,
            "timestamp": Date(),
            "location": currentLocation as Any
        ]
        
        NotificationCenter.default.post(
            name: .geofenceExited,
            object: region.identifier,
            userInfo: eventData
        )
    }
    
    func locationManager(_ manager: CLLocationManager, didVisit visit: CLVisit) {
        print("Visit detected: \(visit)")
        
        // Track visit start time for battery optimization
        if visit.departureDate == Date.distantFuture {
            visitStartTime = visit.arrivalDate
        } else {
            visitStartTime = nil
        }
        
        let eventData: [String: Any] = [
            "coordinate": visit.coordinate,
            "arrivalDate": visit.arrivalDate,
            "departureDate": visit.departureDate,
            "horizontalAccuracy": visit.horizontalAccuracy
        ]
        
        NotificationCenter.default.post(
            name: .visitDetected,
            object: visit,
            userInfo: eventData
        )
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location manager failed with error: \(error)")
        
        if let clError = error as? CLError {
            switch clError.code {
            case .denied:
                locationError = .permissionDenied
            case .locationUnknown:
                locationError = .locationUnavailable
            case .network:
                // Temporary network error, don't update UI
                break
            default:
                locationError = .locationUnavailable
            }
        }
    }
    
    func locationManager(_ manager: CLLocationManager, monitoringDidFailFor region: CLRegion?, withError error: Error) {
        guard let region = region else { return }
        
        print("Monitoring failed for region \(region.identifier): \(error)")
        
        // Remove failed geofence from active list
        activeGeofences.removeValue(forKey: region.identifier)
        
        // Post error notification
        NotificationCenter.default.post(
            name: .geofenceMonitoringFailed,
            object: region.identifier,
            userInfo: ["error": error]
        )
    }
    
    func locationManager(_ manager: CLLocationManager, didStartMonitoringFor region: CLRegion) {
        print("Started monitoring region: \(region.identifier)")
        
        // Request state for immediate feedback if user is already in region
        manager.requestState(for: region)
    }
    
    func locationManager(_ manager: CLLocationManager, didDetermineState state: CLRegionState, for region: CLRegion) {
        print("Region \(region.identifier) state: \(state.rawValue)")
        
        // Handle case where user is already inside geofence when it's registered
        if state == .inside {
            didEnterRegion(region)
        }
    }
}

// MARK: - Notification Names
extension Notification.Name {
    static let geofenceEntered = Notification.Name("geofenceEntered")
    static let geofenceExited = Notification.Name("geofenceExited")
    static let visitDetected = Notification.Name("visitDetected")
    static let locationUpdated = Notification.Name("locationUpdated")
    static let geofenceMonitoringFailed = Notification.Name("geofenceMonitoringFailed")
}