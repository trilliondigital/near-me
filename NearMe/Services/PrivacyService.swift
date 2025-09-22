import Foundation
import CoreLocation
import Combine

// MARK: - Privacy Models
enum LocationPrivacyMode: String, CaseIterable {
    case standard = "standard"
    case foregroundOnly = "foreground_only"
    
    var displayName: String {
        switch self {
        case .standard:
            return "Standard"
        case .foregroundOnly:
            return "Foreground Only"
        }
    }
    
    var description: String {
        switch self {
        case .standard:
            return "Location services work in background for reliable reminders"
        case .foregroundOnly:
            return "Location services only work when app is open"
        }
    }
}

struct PrivacySettings: Codable {
    var locationPrivacyMode: LocationPrivacyMode
    var onDeviceProcessing: Bool
    var dataMinimization: Bool
    var analyticsOptOut: Bool
    var crashReportingOptOut: Bool
    var locationHistoryRetention: Int // days
    
    static let `default` = PrivacySettings(
        locationPrivacyMode: .standard,
        onDeviceProcessing: true,
        dataMinimization: true,
        analyticsOptOut: false,
        crashReportingOptOut: false,
        locationHistoryRetention: 30
    )
}

struct DataExportRequest: Codable {
    let userId: String
    let includeLocationHistory: Bool
    let includeTasks: Bool
    let includePlaces: Bool
    let includeNotificationHistory: Bool
    let format: ExportFormat
    
    enum ExportFormat: String, CaseIterable, Codable {
        case json = "json"
        case csv = "csv"
        
        var displayName: String {
            switch self {
            case .json: return "JSON"
            case .csv: return "CSV"
            }
        }
    }
}

struct DataExportResponse: Codable {
    let exportId: String
    let downloadUrl: String?
    let status: ExportStatus
    let createdAt: Date
    let expiresAt: Date
    let fileSizeBytes: Int?
    
    enum ExportStatus: String, Codable {
        case pending = "pending"
        case processing = "processing"
        case completed = "completed"
        case failed = "failed"
        case expired = "expired"
    }
}

struct DataDeletionRequest: Codable {
    let userId: String
    let deleteLocationHistory: Bool
    let deleteTasks: Bool
    let deletePlaces: Bool
    let deleteNotificationHistory: Bool
    let deleteAccount: Bool
    let confirmationCode: String
}

// MARK: - Privacy Service
class PrivacyService: ObservableObject {
    static let shared = PrivacyService()
    
    private let baseURL = "http://localhost:3000/api"
    private var cancellables = Set<AnyCancellable>()
    
    @Published var privacySettings: PrivacySettings
    @Published var isLoading = false
    @Published var error: PrivacyError?
    @Published var exportRequests: [DataExportResponse] = []
    
    private init() {
        self.privacySettings = Self.loadPrivacySettings()
        setupLocationModeObserver()
    }
    
    // MARK: - Error Handling
    enum PrivacyError: LocalizedError {
        case networkError(String)
        case serverError(String)
        case validationError(String)
        case exportFailed(String)
        case deletionFailed(String)
        case unauthorized
        
        var errorDescription: String? {
            switch self {
            case .networkError(let message):
                return "Network error: \(message)"
            case .serverError(let message):
                return "Server error: \(message)"
            case .validationError(let message):
                return "Validation error: \(message)"
            case .exportFailed(let message):
                return "Data export failed: \(message)"
            case .deletionFailed(let message):
                return "Data deletion failed: \(message)"
            case .unauthorized:
                return "You are not authorized to perform this action"
            }
        }
    }
    
    // MARK: - Privacy Settings Management
    
    /// Update privacy settings
    func updatePrivacySettings(_ newSettings: PrivacySettings) {
        let oldMode = privacySettings.locationPrivacyMode
        privacySettings = newSettings
        savePrivacySettings()
        
        // Apply location mode changes
        if oldMode != newSettings.locationPrivacyMode {
            applyLocationPrivacyMode(newSettings.locationPrivacyMode)
        }
        
        // Sync with server
        syncPrivacySettingsToServer()
    }
    
    /// Apply location privacy mode
    private func applyLocationPrivacyMode(_ mode: LocationPrivacyMode) {
        switch mode {
        case .standard:
            // Allow background location if user has granted always permission
            NotificationCenter.default.post(
                name: .privacyModeChanged,
                object: mode,
                userInfo: ["allowBackground": true]
            )
            
        case .foregroundOnly:
            // Restrict to foreground only
            NotificationCenter.default.post(
                name: .privacyModeChanged,
                object: mode,
                userInfo: ["allowBackground": false]
            )
        }
    }
    
    /// Setup observer for location mode changes
    private func setupLocationModeObserver() {
        NotificationCenter.default.addObserver(
            forName: .privacyModeChanged,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let mode = notification.object as? LocationPrivacyMode else { return }
            self?.handleLocationModeChange(mode)
        }
    }
    
    private func handleLocationModeChange(_ mode: LocationPrivacyMode) {
        // Update location manager settings based on privacy mode
        if mode == .foregroundOnly {
            // Stop background location services
            LocationManager.shared.stopBackgroundLocationServices()
        } else {
            // Resume background location services if permission allows
            LocationManager.shared.resumeBackgroundLocationServices()
        }
    }
    
    // MARK: - Data Export
    
    /// Request data export
    func requestDataExport(_ request: DataExportRequest) {
        isLoading = true
        error = nil
        
        guard let url = URL(string: "\(baseURL)/privacy/export") else {
            error = .networkError("Invalid URL")
            isLoading = false
            return
        }
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.allHTTPHeaderFields = getAuthHeaders()
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            urlRequest.httpBody = try JSONEncoder().encode(request)
        } catch {
            error = .validationError("Failed to encode export request")
            isLoading = false
            return
        }
        
        URLSession.shared.dataTaskPublisher(for: urlRequest)
            .map(\.data)
            .decode(type: APIResponse<DataExportResponse>.self, decoder: JSONDecoder())
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion {
                        self?.error = .exportFailed(error.localizedDescription)
                    }
                },
                receiveValue: { [weak self] response in
                    if response.success {
                        self?.exportRequests.append(response.data)
                    } else {
                        self?.error = .exportFailed(response.message ?? "Export request failed")
                    }
                }
            )
            .store(in: &cancellables)
    }
    
    /// Get export status
    func getExportStatus(exportId: String) {
        guard let url = URL(string: "\(baseURL)/privacy/export/\(exportId)") else {
            error = .networkError("Invalid URL")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.allHTTPHeaderFields = getAuthHeaders()
        
        URLSession.shared.dataTaskPublisher(for: request)
            .map(\.data)
            .decode(type: APIResponse<DataExportResponse>.self, decoder: JSONDecoder())
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    if case .failure(let error) = completion {
                        self?.error = .exportFailed(error.localizedDescription)
                    }
                },
                receiveValue: { [weak self] response in
                    if response.success {
                        // Update existing export request
                        if let index = self?.exportRequests.firstIndex(where: { $0.exportId == exportId }) {
                            self?.exportRequests[index] = response.data
                        }
                    }
                }
            )
            .store(in: &cancellables)
    }
    
    /// Download export file
    func downloadExport(exportResponse: DataExportResponse) {
        guard let downloadUrl = exportResponse.downloadUrl,
              let url = URL(string: downloadUrl) else {
            error = .exportFailed("Download URL not available")
            return
        }
        
        // Open in Safari or system file handler
        if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
        } else {
            error = .exportFailed("Cannot open download URL")
        }
    }
    
    // MARK: - Data Deletion
    
    /// Request data deletion
    func requestDataDeletion(_ request: DataDeletionRequest) {
        isLoading = true
        error = nil
        
        guard let url = URL(string: "\(baseURL)/privacy/delete") else {
            error = .networkError("Invalid URL")
            isLoading = false
            return
        }
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.allHTTPHeaderFields = getAuthHeaders()
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            urlRequest.httpBody = try JSONEncoder().encode(request)
        } catch {
            error = .validationError("Failed to encode deletion request")
            isLoading = false
            return
        }
        
        URLSession.shared.dataTaskPublisher(for: urlRequest)
            .map(\.data)
            .decode(type: APIResponse<String>.self, decoder: JSONDecoder())
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion {
                        self?.error = .deletionFailed(error.localizedDescription)
                    }
                },
                receiveValue: { [weak self] response in
                    if response.success {
                        // Clear local data if account was deleted
                        if request.deleteAccount {
                            self?.clearAllLocalData()
                        }
                    } else {
                        self?.error = .deletionFailed(response.message ?? "Deletion request failed")
                    }
                }
            )
            .store(in: &cancellables)
    }
    
    /// Clear all local data
    private func clearAllLocalData() {
        // Clear UserDefaults
        let domain = Bundle.main.bundleIdentifier!
        UserDefaults.standard.removePersistentDomain(forName: domain)
        
        // Clear Keychain
        KeychainHelper.clearAll()
        
        // Clear Core Data if used
        // CoreDataManager.shared.clearAllData()
        
        // Clear file system cache
        clearFileSystemCache()
        
        // Reset privacy settings to default
        privacySettings = PrivacySettings.default
        savePrivacySettings()
        
        // Post notification for app-wide cleanup
        NotificationCenter.default.post(name: .dataCleared, object: nil)
    }
    
    private func clearFileSystemCache() {
        let fileManager = FileManager.default
        
        // Clear caches directory
        if let cachesURL = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first {
            try? fileManager.removeItem(at: cachesURL)
        }
        
        // Clear documents directory (be careful with this)
        if let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first {
            let contents = try? fileManager.contentsOfDirectory(at: documentsURL, includingPropertiesForKeys: nil)
            contents?.forEach { url in
                try? fileManager.removeItem(at: url)
            }
        }
    }
    
    // MARK: - On-Device Processing
    
    /// Evaluate geofence on device
    func evaluateGeofenceOnDevice(
        userLocation: CLLocation,
        geofences: [GeofenceInfo]
    ) -> [GeofenceEvent] {
        guard privacySettings.onDeviceProcessing else {
            return [] // Fallback to server processing
        }
        
        var events: [GeofenceEvent] = []
        
        for geofence in geofences {
            let geofenceLocation = CLLocation(
                latitude: geofence.center.latitude,
                longitude: geofence.center.longitude
            )
            
            let distance = userLocation.distance(from: geofenceLocation)
            let isInside = distance <= geofence.radius
            
            // Create event based on geofence state
            if isInside {
                let event = GeofenceEvent(
                    geofenceId: geofence.id,
                    taskId: geofence.taskId,
                    eventType: .enter,
                    timestamp: Date(),
                    location: userLocation.coordinate,
                    confidence: calculateConfidence(distance: distance, radius: geofence.radius)
                )
                events.append(event)
            }
        }
        
        return events
    }
    
    private func calculateConfidence(distance: CLLocationDistance, radius: CLLocationDistance) -> Double {
        if distance <= radius * 0.5 {
            return 1.0 // High confidence
        } else if distance <= radius * 0.8 {
            return 0.8 // Medium confidence
        } else {
            return 0.6 // Lower confidence near edge
        }
    }
    
    // MARK: - Utility Methods
    
    private func getAuthHeaders() -> [String: String] {
        guard let token = UserDefaults.standard.string(forKey: "auth_token") else {
            return [:]
        }
        return ["Authorization": "Bearer \(token)"]
    }
    
    private func syncPrivacySettingsToServer() {
        guard let url = URL(string: "\(baseURL)/privacy/settings") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.allHTTPHeaderFields = getAuthHeaders()
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            request.httpBody = try JSONEncoder().encode(privacySettings)
        } catch {
            print("Failed to encode privacy settings: \(error)")
            return
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                print("Failed to sync privacy settings: \(error)")
            }
        }.resume()
    }
    
    // MARK: - Persistence
    
    private static func loadPrivacySettings() -> PrivacySettings {
        guard let data = UserDefaults.standard.data(forKey: "privacy_settings"),
              let settings = try? JSONDecoder().decode(PrivacySettings.self, from: data) else {
            return PrivacySettings.default
        }
        return settings
    }
    
    private func savePrivacySettings() {
        if let encoded = try? JSONEncoder().encode(privacySettings) {
            UserDefaults.standard.set(encoded, forKey: "privacy_settings")
        }
    }
    
    /// Clear error state
    func clearError() {
        error = nil
    }
}

// MARK: - Supporting Models
struct GeofenceEvent {
    let geofenceId: String
    let taskId: String
    let eventType: EventType
    let timestamp: Date
    let location: CLLocationCoordinate2D
    let confidence: Double
    
    enum EventType {
        case enter
        case exit
    }
}

// MARK: - API Response Model
private struct APIResponse<T: Codable>: Codable {
    let success: Bool
    let data: T
    let message: String?
    let timestamp: String
}

// MARK: - Keychain Helper
class KeychainHelper {
    static func clearAll() {
        let secItemClasses = [
            kSecClassGenericPassword,
            kSecClassInternetPassword,
            kSecClassCertificate,
            kSecClassKey,
            kSecClassIdentity
        ]
        
        for itemClass in secItemClasses {
            let spec: [String: Any] = [kSecClass as String: itemClass]
            SecItemDelete(spec as CFDictionary)
        }
    }
}

// MARK: - Notification Names
extension Notification.Name {
    static let privacyModeChanged = Notification.Name("privacyModeChanged")
    static let dataCleared = Notification.Name("dataCleared")
}