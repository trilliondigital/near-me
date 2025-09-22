import Foundation
import CoreLocation
import Combine

class LocationManager: NSObject, ObservableObject {
    private let locationManager = CLLocationManager()
    
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined
    @Published var currentLocation: CLLocation?
    @Published var isLocationEnabled = false
    
    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        authorizationStatus = locationManager.authorizationStatus
    }
    
    func requestLocationPermission() {
        switch authorizationStatus {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .denied, .restricted:
            // Handle denied permissions
            break
        case .authorizedWhenInUse:
            // Request always authorization for geofencing
            locationManager.requestAlwaysAuthorization()
        case .authorizedAlways:
            startLocationServices()
        @unknown default:
            break
        }
    }
    
    private func startLocationServices() {
        guard authorizationStatus == .authorizedAlways else { return }
        
        isLocationEnabled = true
        locationManager.startUpdatingLocation()
        locationManager.startMonitoringSignificantLocationChanges()
        locationManager.startMonitoringVisits()
    }
    
    func registerGeofence(identifier: String, center: CLLocationCoordinate2D, radius: CLLocationDistance) {
        guard authorizationStatus == .authorizedAlways else { return }
        
        let geofence = CLCircularRegion(
            center: center,
            radius: radius,
            identifier: identifier
        )
        geofence.notifyOnEntry = true
        geofence.notifyOnExit = true
        
        locationManager.startMonitoring(for: geofence)
    }
    
    func unregisterGeofence(identifier: String) {
        let region = locationManager.monitoredRegions.first { $0.identifier == identifier }
        if let region = region {
            locationManager.stopMonitoring(for: region)
        }
    }
}

extension LocationManager: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        currentLocation = location
    }
    
    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        authorizationStatus = status
        
        switch status {
        case .authorizedAlways:
            startLocationServices()
        case .denied, .restricted:
            isLocationEnabled = false
        default:
            break
        }
    }
    
    func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
        // Handle geofence entry
        NotificationCenter.default.post(
            name: .geofenceEntered,
            object: region.identifier
        )
    }
    
    func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
        // Handle geofence exit
        NotificationCenter.default.post(
            name: .geofenceExited,
            object: region.identifier
        )
    }
    
    func locationManager(_ manager: CLLocationManager, didVisit visit: CLVisit) {
        // Handle visit detection for battery optimization
        NotificationCenter.default.post(
            name: .visitDetected,
            object: visit
        )
    }
}

extension Notification.Name {
    static let geofenceEntered = Notification.Name("geofenceEntered")
    static let geofenceExited = Notification.Name("geofenceExited")
    static let visitDetected = Notification.Name("visitDetected")
}