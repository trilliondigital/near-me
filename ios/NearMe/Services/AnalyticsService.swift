import Foundation
import UIKit

// MARK: - Analytics Models
struct AnalyticsEvent {
    let eventType: String
    let eventData: [String: Any]?
    let timestamp: Date
    
    init(eventType: String, eventData: [String: Any]? = nil, timestamp: Date = Date()) {
        self.eventType = eventType
        self.eventData = eventData
        self.timestamp = timestamp
    }
}

struct AnalyticsSession {
    let sessionId: String
    let deviceId: String
    let platform: String = "ios"
    let appVersion: String
    let sessionStart: Date
    var sessionEnd: Date?
    var previousSessionId: String?
    
    init(sessionId: String, deviceId: String, appVersion: String, previousSessionId: String? = nil) {
        self.sessionId = sessionId
        self.deviceId = deviceId
        self.appVersion = appVersion
        self.sessionStart = Date()
        self.previousSessionId = previousSessionId
    }
}

struct UserAnalyticsProperties {
    var nudgeStyle: String?
    var quietHours: [String: Any]?
    var defaultRadii: [String: Any]?
    var premiumStatus: String?
    var primaryCountry: String?
    var primaryTimezone: String?
    var primaryPlatform: String = "ios"
}

// MARK: - Analytics Configuration
struct AnalyticsConfiguration {
    let batchSize: Int
    let flushInterval: TimeInterval
    let sessionTimeout: TimeInterval
    let privacyModeEnabled: Bool
    let samplingRate: Double
    
    static let `default` = AnalyticsConfiguration(
        batchSize: 50,
        flushInterval: 30.0, // 30 seconds
        sessionTimeout: 1800.0, // 30 minutes
        privacyModeEnabled: true,
        samplingRate: 1.0
    )
}

// MARK: - Analytics Service
@MainActor
class AnalyticsService: ObservableObject {
    static let shared = AnalyticsService()
    
    private let apiClient: APIClient
    private let privacyService: PrivacyService
    private let secureStorage: SecureStorageService
    
    private var configuration: AnalyticsConfiguration
    private var currentSession: AnalyticsSession?
    private var eventBuffer: [AnalyticsEvent] = []
    private var flushTimer: Timer?
    private var sessionTimer: Timer?
    
    // Session management
    private var sessionId: String {
        currentSession?.sessionId ?? UUID().uuidString
    }
    
    private var deviceId: String {
        get async {
            if let stored = await secureStorage.getString(for: "device_id") {
                return stored
            }
            let newId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
            await secureStorage.setString(newId, for: "device_id")
            return newId
        }
    }
    
    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }
    
    @Published var analyticsEnabled: Bool = true
    @Published var isSessionActive: Bool = false
    
    private init() {
        self.apiClient = APIClient.shared
        self.privacyService = PrivacyService.shared
        self.secureStorage = SecureStorageService.shared
        self.configuration = .default
        
        setupNotificationObservers()
        loadConfiguration()
    }
    
    // MARK: - Public Interface
    
    /// Start analytics session
    func startSession() async {
        guard analyticsEnabled else { return }
        
        do {
            let deviceId = await self.deviceId
            let previousSessionId = currentSession?.sessionId
            
            let session = AnalyticsSession(
                sessionId: UUID().uuidString,
                deviceId: deviceId,
                appVersion: appVersion,
                previousSessionId: previousSessionId
            )
            
            currentSession = session
            isSessionActive = true
            
            // Send session start to backend
            try await sendSessionStart(session)
            
            // Start flush timer
            startFlushTimer()
            
            // Start session timeout timer
            startSessionTimer()
            
            print("📊 Analytics session started: \(session.sessionId)")
            
        } catch {
            print("❌ Failed to start analytics session: \(error)")
        }
    }
    
    /// End current analytics session
    func endSession() async {
        guard let session = currentSession else { return }
        
        do {
            // Flush remaining events
            await flushEvents()
            
            // Send session end to backend
            try await sendSessionEnd(session.sessionId)
            
            currentSession = nil
            isSessionActive = false
            
            // Stop timers
            stopFlushTimer()
            stopSessionTimer()
            
            print("📊 Analytics session ended: \(session.sessionId)")
            
        } catch {
            print("❌ Failed to end analytics session: \(error)")
        }
    }
    
    /// Track a custom event
    func trackEvent(_ eventType: String, data: [String: Any]? = nil) async {
        guard analyticsEnabled, let session = currentSession else { return }
        
        // Apply sampling
        guard shouldSampleEvent() else { return }
        
        let event = AnalyticsEvent(eventType: eventType, eventData: data)
        eventBuffer.append(event)
        
        // Flush if buffer is full
        if eventBuffer.count >= configuration.batchSize {
            await flushEvents()
        }
        
        print("📊 Event tracked: \(eventType)")
    }
    
    /// Update user analytics properties
    func updateUserProperties(_ properties: UserAnalyticsProperties) async {
        guard analyticsEnabled else { return }
        
        do {
            let request = UpdateUserPropertiesRequest(
                nudgeStyle: properties.nudgeStyle,
                quietHours: properties.quietHours,
                defaultRadii: properties.defaultRadii,
                premiumStatus: properties.premiumStatus,
                primaryCountry: properties.primaryCountry,
                primaryTimezone: properties.primaryTimezone,
                primaryPlatform: properties.primaryPlatform
            )
            
            try await apiClient.updateUserProperties(request)
            print("📊 User properties updated")
            
        } catch {
            print("❌ Failed to update user properties: \(error)")
        }
    }
    
    // MARK: - Business Event Tracking
    
    func trackTaskCreated(taskId: String, locationType: String, placeId: String? = nil, poiCategory: String? = nil, hasDescription: Bool) async {
        let data: [String: Any] = [
            "task_id": taskId,
            "location_type": locationType,
            "place_id": placeId as Any,
            "poi_category": poiCategory as Any,
            "has_description": hasDescription
        ]
        await trackEvent("task_created", data: data)
    }
    
    func trackPlaceAdded(placeId: String, placeType: String, method: String) async {
        let data: [String: Any] = [
            "place_id": placeId,
            "place_type": placeType,
            "method": method
        ]
        await trackEvent("place_added", data: data)
    }
    
    func trackGeofenceRegistered(taskId: String, geofenceId: String, geofenceType: String, radiusMeters: Double) async {
        let data: [String: Any] = [
            "task_id": taskId,
            "geofence_id": geofenceId,
            "geofence_type": geofenceType,
            "radius_meters": radiusMeters
        ]
        await trackEvent("geofence_registered", data: data)
    }
    
    func trackNudgeShown(taskId: String, nudgeType: String, locationName: String? = nil, distanceMeters: Double? = nil) async {
        let data: [String: Any] = [
            "task_id": taskId,
            "nudge_type": nudgeType,
            "location_name": locationName as Any,
            "distance_meters": distanceMeters as Any
        ]
        await trackEvent("nudge_shown", data: data)
    }
    
    func trackTaskCompleted(taskId: String, completionMethod: String, timeToCompleteHours: Double? = nil, nudgesReceived: Int? = nil) async {
        let data: [String: Any] = [
            "task_id": taskId,
            "completion_method": completionMethod,
            "time_to_complete_hours": timeToCompleteHours as Any,
            "nudges_received": nudgesReceived as Any
        ]
        await trackEvent("task_completed", data: data)
    }
    
    func trackSnoozeSelected(taskId: String, snoozeDuration: String, nudgeType: String? = nil) async {
        let data: [String: Any] = [
            "task_id": taskId,
            "snooze_duration": snoozeDuration,
            "nudge_type": nudgeType as Any
        ]
        await trackEvent("snooze_selected", data: data)
    }
    
    func trackPaywallViewed(trigger: String, currentTaskCount: Int? = nil) async {
        let data: [String: Any] = [
            "trigger": trigger,
            "current_task_count": currentTaskCount as Any
        ]
        await trackEvent("paywall_viewed", data: data)
    }
    
    func trackTrialStarted(trialDurationDays: Int, triggerSource: String? = nil) async {
        let data: [String: Any] = [
            "trial_duration_days": trialDurationDays,
            "trigger_source": triggerSource as Any
        ]
        await trackEvent("trial_started", data: data)
    }
    
    func trackPremiumConverted(subscriptionType: String, price: Double? = nil, currency: String? = nil, trialDurationDays: Int? = nil) async {
        let data: [String: Any] = [
            "subscription_type": subscriptionType,
            "price": price as Any,
            "currency": currency as Any,
            "trial_duration_days": trialDurationDays as Any
        ]
        await trackEvent("premium_converted", data: data)
    }
    
    // MARK: - Screen Tracking
    
    func trackScreenView(_ screenName: String, properties: [String: Any]? = nil) async {
        var data: [String: Any] = ["screen_name": screenName]
        if let properties = properties {
            data.merge(properties) { _, new in new }
        }
        await trackEvent("screen_viewed", data: data)
    }
    
    // MARK: - Configuration
    
    func updateConfiguration(_ newConfig: AnalyticsConfiguration) {
        configuration = newConfig
        
        // Restart timers with new intervals
        if isSessionActive {
            stopFlushTimer()
            startFlushTimer()
        }
    }
    
    func setAnalyticsEnabled(_ enabled: Bool) async {
        analyticsEnabled = enabled
        
        if !enabled {
            await endSession()
        }
        
        // Update privacy settings
        await privacyService.updateAnalyticsConsent(enabled)
    }
    
    // MARK: - Private Methods
    
    private func setupNotificationObservers() {
        NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { _ in
            Task { await self.handleAppBackground() }
        }
        
        NotificationCenter.default.addObserver(
            forName: UIApplication.willEnterForegroundNotification,
            object: nil,
            queue: .main
        ) { _ in
            Task { await self.handleAppForeground() }
        }
        
        NotificationCenter.default.addObserver(
            forName: UIApplication.willTerminateNotification,
            object: nil,
            queue: .main
        ) { _ in
            Task { await self.endSession() }
        }
    }
    
    private func loadConfiguration() {
        // Load configuration from UserDefaults or remote config
        // For now, use default configuration
    }
    
    private func shouldSampleEvent() -> Bool {
        return Double.random(in: 0...1) <= configuration.samplingRate
    }
    
    private func handleAppBackground() async {
        await flushEvents()
        // Don't end session, just pause tracking
    }
    
    private func handleAppForeground() async {
        // Resume session if needed
        if currentSession == nil {
            await startSession()
        }
    }
    
    // MARK: - Timer Management
    
    private func startFlushTimer() {
        stopFlushTimer()
        flushTimer = Timer.scheduledTimer(withTimeInterval: configuration.flushInterval, repeats: true) { _ in
            Task { await self.flushEvents() }
        }
    }
    
    private func stopFlushTimer() {
        flushTimer?.invalidate()
        flushTimer = nil
    }
    
    private func startSessionTimer() {
        stopSessionTimer()
        sessionTimer = Timer.scheduledTimer(withTimeInterval: configuration.sessionTimeout, repeats: false) { _ in
            Task { await self.endSession() }
        }
    }
    
    private func stopSessionTimer() {
        sessionTimer?.invalidate()
        sessionTimer = nil
    }
    
    // MARK: - Network Operations
    
    private func sendSessionStart(_ session: AnalyticsSession) async throws {
        let request = StartSessionRequest(
            sessionId: session.sessionId,
            deviceId: session.deviceId,
            platform: session.platform,
            appVersion: session.appVersion,
            previousSessionId: session.previousSessionId
        )
        
        try await apiClient.startAnalyticsSession(request)
    }
    
    private func sendSessionEnd(_ sessionId: String) async throws {
        try await apiClient.endAnalyticsSession(sessionId)
    }
    
    private func flushEvents() async {
        guard !eventBuffer.isEmpty, let session = currentSession else { return }
        
        let eventsToFlush = eventBuffer
        eventBuffer.removeAll()
        
        do {
            let events = eventsToFlush.map { event in
                TrackEventRequest(
                    eventType: event.eventType,
                    sessionId: session.sessionId,
                    deviceId: session.deviceId,
                    platform: session.platform,
                    appVersion: session.appVersion,
                    eventData: event.eventData,
                    timestamp: event.timestamp,
                    analyticsConsent: analyticsEnabled,
                    timezone: TimeZone.current.identifier
                )
            }
            
            if events.count == 1 {
                try await apiClient.trackEvent(events[0])
            } else {
                try await apiClient.trackEventsBatch(BatchEventsRequest(events: events))
            }
            
            print("📊 Flushed \(events.count) events")
            
        } catch {
            // Re-add events to buffer for retry
            eventBuffer.insert(contentsOf: eventsToFlush, at: 0)
            print("❌ Failed to flush events: \(error)")
        }
    }
}

// MARK: - API Request Models
struct StartSessionRequest: Codable {
    let sessionId: String
    let deviceId: String
    let platform: String
    let appVersion: String
    let previousSessionId: String?
}

struct TrackEventRequest: Codable {
    let eventType: String
    let sessionId: String
    let deviceId: String
    let platform: String
    let appVersion: String
    let eventData: [String: Any]?
    let timestamp: Date
    let analyticsConsent: Bool
    let timezone: String
    
    enum CodingKeys: String, CodingKey {
        case eventType, sessionId, deviceId, platform, appVersion, eventData, timestamp, analyticsConsent, timezone
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(eventType, forKey: .eventType)
        try container.encode(sessionId, forKey: .sessionId)
        try container.encode(deviceId, forKey: .deviceId)
        try container.encode(platform, forKey: .platform)
        try container.encode(appVersion, forKey: .appVersion)
        try container.encode(timestamp, forKey: .timestamp)
        try container.encode(analyticsConsent, forKey: .analyticsConsent)
        try container.encode(timezone, forKey: .timezone)
        
        if let eventData = eventData {
            let jsonData = try JSONSerialization.data(withJSONObject: eventData)
            let jsonObject = try JSONSerialization.jsonObject(with: jsonData)
            try container.encode(AnyCodable(jsonObject), forKey: .eventData)
        }
    }
}

struct BatchEventsRequest: Codable {
    let events: [TrackEventRequest]
}

struct UpdateUserPropertiesRequest: Codable {
    let nudgeStyle: String?
    let quietHours: [String: Any]?
    let defaultRadii: [String: Any]?
    let premiumStatus: String?
    let primaryCountry: String?
    let primaryTimezone: String?
    let primaryPlatform: String?
    
    enum CodingKeys: String, CodingKey {
        case nudgeStyle, quietHours, defaultRadii, premiumStatus, primaryCountry, primaryTimezone, primaryPlatform
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(nudgeStyle, forKey: .nudgeStyle)
        try container.encodeIfPresent(premiumStatus, forKey: .premiumStatus)
        try container.encodeIfPresent(primaryCountry, forKey: .primaryCountry)
        try container.encodeIfPresent(primaryTimezone, forKey: .primaryTimezone)
        try container.encodeIfPresent(primaryPlatform, forKey: .primaryPlatform)
        
        if let quietHours = quietHours {
            let jsonData = try JSONSerialization.data(withJSONObject: quietHours)
            let jsonObject = try JSONSerialization.jsonObject(with: jsonData)
            try container.encode(AnyCodable(jsonObject), forKey: .quietHours)
        }
        
        if let defaultRadii = defaultRadii {
            let jsonData = try JSONSerialization.data(withJSONObject: defaultRadii)
            let jsonObject = try JSONSerialization.jsonObject(with: jsonData)
            try container.encode(AnyCodable(jsonObject), forKey: .defaultRadii)
        }
    }
}

// Helper for encoding Any values
struct AnyCodable: Codable {
    let value: Any
    
    init(_ value: Any) {
        self.value = value
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        
        if let intValue = value as? Int {
            try container.encode(intValue)
        } else if let doubleValue = value as? Double {
            try container.encode(doubleValue)
        } else if let stringValue = value as? String {
            try container.encode(stringValue)
        } else if let boolValue = value as? Bool {
            try container.encode(boolValue)
        } else if let arrayValue = value as? [Any] {
            try container.encode(arrayValue.map(AnyCodable.init))
        } else if let dictValue = value as? [String: Any] {
            try container.encode(dictValue.mapValues(AnyCodable.init))
        } else {
            try container.encodeNil()
        }
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        
        if let intValue = try? container.decode(Int.self) {
            value = intValue
        } else if let doubleValue = try? container.decode(Double.self) {
            value = doubleValue
        } else if let stringValue = try? container.decode(String.self) {
            value = stringValue
        } else if let boolValue = try? container.decode(Bool.self) {
            value = boolValue
        } else if let arrayValue = try? container.decode([AnyCodable].self) {
            value = arrayValue.map { $0.value }
        } else if let dictValue = try? container.decode([String: AnyCodable].self) {
            value = dictValue.mapValues { $0.value }
        } else {
            value = NSNull()
        }
    }
}

// MARK: - APIClient Extension
extension APIClient {
    func startAnalyticsSession(_ request: StartSessionRequest) async throws {
        try await post("/analytics/sessions/start", body: request)
    }
    
    func endAnalyticsSession(_ sessionId: String) async throws {
        try await post("/analytics/sessions/\(sessionId)/end", body: EmptyRequest())
    }
    
    func trackEvent(_ request: TrackEventRequest) async throws {
        try await post("/analytics/events", body: request)
    }
    
    func trackEventsBatch(_ request: BatchEventsRequest) async throws {
        try await post("/analytics/events/batch", body: request)
    }
    
    func updateUserProperties(_ request: UpdateUserPropertiesRequest) async throws {
        try await put("/analytics/user-properties", body: request)
    }
}

struct EmptyRequest: Codable {}