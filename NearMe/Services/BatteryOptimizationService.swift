import Foundation
import CoreLocation
import UIKit
import Combine

// MARK: - Battery Optimization Service
class BatteryOptimizationService: ObservableObject {
    static let shared = BatteryOptimizationService()
    
    @Published var currentOptimizationLevel: OptimizationLevel = .balanced
    @Published var batteryUsageMetrics = BatteryUsageMetrics()
    @Published var isLowPowerModeEnabled = false
    @Published var adaptiveOptimizationEnabled = true
    
    private var cancellables = Set<AnyCancellable>()
    private let userDefaults = UserDefaults.standard
    private var batteryMonitoringTimer: Timer?
    private var lastBatteryLevel: Float = 1.0
    private var locationUpdateCount = 0
    private var geofenceEventCount = 0
    private var startTime = Date()
    
    // MARK: - Optimization Levels
    enum OptimizationLevel: String, CaseIterable {
        case highAccuracy = "high_accuracy"
        case balanced = "balanced"
        case powerSave = "power_save"
        case minimal = "minimal"
        
        var locationAccuracy: CLLocationAccuracy {
            switch self {
            case .highAccuracy: return kCLLocationAccuracyBest
            case .balanced: return kCLLocationAccuracyHundredMeters
            case .powerSave: return kCLLocationAccuracyKilometer
            case .minimal: return kCLLocationAccuracyThreeKilometers
            }
        }
        
        var updateInterval: TimeInterval {
            switch self {
            case .highAccuracy: return 15 // 15 seconds
            case .balanced: return 60 // 1 minute
            case .powerSave: return 300 // 5 minutes
            case .minimal: return 900 // 15 minutes
            }
        }
        
        var maxActiveGeofences: Int {
            switch self {
            case .highAccuracy: return 20
            case .balanced: return 15
            case .powerSave: return 10
            case .minimal: return 5
            }
        }
        
        var backgroundProcessingEnabled: Bool {
            switch self {
            case .highAccuracy, .balanced: return true
            case .powerSave, .minimal: return false
            }
        }
    }
    
    // MARK: - Battery Usage Metrics
    struct BatteryUsageMetrics {
        var dailyBatteryUsage: Double = 0.0
        var locationUpdatesPerHour: Int = 0
        var geofenceEventsPerHour: Int = 0
        var averageAccuracy: Double = 0.0
        var backgroundTimePercentage: Double = 0.0
        var lastOptimizationDate = Date()
        
        var isWithinTarget: Bool {
            return dailyBatteryUsage <= 3.0 // Target: ≤3% daily battery usage
        }
    }
    
    private init() {
        setupBatteryMonitoring()
        loadSavedMetrics()
        observeAppStateChanges()
        observeLowPowerMode()
    }
    
    // MARK: - Setup and Monitoring
    private func setupBatteryMonitoring() {
        UIDevice.current.isBatteryMonitoringEnabled = true
        lastBatteryLevel = UIDevice.current.batteryLevel
        
        batteryMonitoringTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { _ in
            self.updateBatteryMetrics()
        }
    }
    
    private func observeAppStateChanges() {
        NotificationCenter.default.publisher(for: UIApplication.didEnterBackgroundNotification)
            .sink { _ in
                self.handleAppBackgrounded()
            }
            .store(in: &cancellables)
        
        NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)
            .sink { _ in
                self.handleAppForegrounded()
            }
            .store(in: &cancellables)
    }
    
    private func observeLowPowerMode() {
        NotificationCenter.default.publisher(for: .NSProcessInfoPowerStateDidChange)
            .sink { _ in
                DispatchQueue.main.async {
                    self.isLowPowerModeEnabled = ProcessInfo.processInfo.isLowPowerModeEnabled
                    if self.isLowPowerModeEnabled {
                        self.activateEmergencyPowerSave()
                    }
                }
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Adaptive Optimization
    func analyzeAndOptimize() {
        guard adaptiveOptimizationEnabled else { return }
        
        let batteryLevel = UIDevice.current.batteryLevel
        let isCharging = UIDevice.current.batteryState == .charging || UIDevice.current.batteryState == .full
        let isLowPowerMode = ProcessInfo.processInfo.isLowPowerModeEnabled
        
        let recommendedLevel = determineOptimalLevel(
            batteryLevel: batteryLevel,
            isCharging: isCharging,
            isLowPowerMode: isLowPowerMode,
            currentMetrics: batteryUsageMetrics
        )
        
        if recommendedLevel != currentOptimizationLevel {
            applyOptimizationLevel(recommendedLevel)
        }
    }
    
    private func determineOptimalLevel(
        batteryLevel: Float,
        isCharging: Bool,
        isLowPowerMode: Bool,
        currentMetrics: BatteryUsageMetrics
    ) -> OptimizationLevel {
        
        // Emergency conditions
        if isLowPowerMode || batteryLevel < 0.1 {
            return .minimal
        }
        
        // Charging - can use higher accuracy
        if isCharging && batteryLevel > 0.8 {
            return .highAccuracy
        }
        
        // Low battery conditions
        if batteryLevel < 0.2 {
            return .powerSave
        }
        
        // Battery usage exceeds target
        if currentMetrics.dailyBatteryUsage > 3.0 {
            return currentOptimizationLevel == .balanced ? .powerSave : .minimal
        }
        
        // High activity periods - optimize based on usage patterns
        if currentMetrics.locationUpdatesPerHour > 120 { // More than 2 per minute
            return .powerSave
        }
        
        // Default to balanced for normal conditions
        return .balanced
    }
    
    func applyOptimizationLevel(_ level: OptimizationLevel) {
        currentOptimizationLevel = level
        
        // Notify location manager of changes
        NotificationCenter.default.post(
            name: .batteryOptimizationChanged,
            object: level
        )
        
        // Apply geofence optimizations
        optimizeGeofences(for: level)
        
        // Apply background processing optimizations
        optimizeBackgroundProcessing(for: level)
        
        // Save preference
        userDefaults.set(level.rawValue, forKey: "battery_optimization_level")
        
        print("Applied battery optimization level: \(level)")
    }
    
    // MARK: - Specific Optimizations
    private func optimizeGeofences(for level: OptimizationLevel) {
        let maxGeofences = level.maxActiveGeofences
        
        NotificationCenter.default.post(
            name: .geofenceOptimizationRequested,
            object: nil,
            userInfo: [
                "maxGeofences": maxGeofences,
                "prioritizeNearby": level == .powerSave || level == .minimal
            ]
        )
    }
    
    private func optimizeBackgroundProcessing(for level: OptimizationLevel) {
        let backgroundEnabled = level.backgroundProcessingEnabled
        
        NotificationCenter.default.post(
            name: .backgroundProcessingOptimizationChanged,
            object: backgroundEnabled
        )
    }
    
    private func activateEmergencyPowerSave() {
        applyOptimizationLevel(.minimal)
        
        // Additional emergency measures
        NotificationCenter.default.post(
            name: .emergencyPowerSaveActivated,
            object: nil
        )
    }
    
    // MARK: - Metrics Tracking
    func recordLocationUpdate(accuracy: CLLocationAccuracy) {
        locationUpdateCount += 1
        
        // Update average accuracy
        let currentAverage = batteryUsageMetrics.averageAccuracy
        let newCount = Double(locationUpdateCount)
        batteryUsageMetrics.averageAccuracy = (currentAverage * (newCount - 1) + accuracy) / newCount
        
        // Calculate updates per hour
        let hoursElapsed = Date().timeIntervalSince(startTime) / 3600
        batteryUsageMetrics.locationUpdatesPerHour = Int(Double(locationUpdateCount) / max(hoursElapsed, 1))
        
        saveMetrics()
    }
    
    func recordGeofenceEvent() {
        geofenceEventCount += 1
        
        let hoursElapsed = Date().timeIntervalSince(startTime) / 3600
        batteryUsageMetrics.geofenceEventsPerHour = Int(Double(geofenceEventCount) / max(hoursElapsed, 1))
        
        saveMetrics()
    }
    
    private func updateBatteryMetrics() {
        let currentBatteryLevel = UIDevice.current.batteryLevel
        let batteryDelta = lastBatteryLevel - currentBatteryLevel
        
        if batteryDelta > 0 && !UIDevice.current.batteryState.isCharging {
            // Estimate daily usage based on current drain rate
            let hoursElapsed = Date().timeIntervalSince(startTime) / 3600
            let hourlyDrain = Double(batteryDelta) / max(hoursElapsed, 1)
            batteryUsageMetrics.dailyBatteryUsage = hourlyDrain * 24 * 100 // Convert to percentage
        }
        
        lastBatteryLevel = currentBatteryLevel
        saveMetrics()
        
        // Trigger optimization if needed
        if !batteryUsageMetrics.isWithinTarget {
            analyzeAndOptimize()
        }
    }
    
    // MARK: - App State Handling
    private func handleAppBackgrounded() {
        // Reduce location accuracy when backgrounded
        if currentOptimizationLevel != .minimal {
            NotificationCenter.default.post(
                name: .backgroundModeOptimizationRequested,
                object: true
            )
        }
    }
    
    private func handleAppForegrounded() {
        // Restore normal accuracy when foregrounded
        NotificationCenter.default.post(
            name: .backgroundModeOptimizationRequested,
            object: false
        )
        
        // Update metrics and potentially re-optimize
        analyzeAndOptimize()
    }
    
    // MARK: - Persistence
    private func saveMetrics() {
        let encoder = JSONEncoder()
        if let data = try? encoder.encode(batteryUsageMetrics) {
            userDefaults.set(data, forKey: "battery_usage_metrics")
        }
    }
    
    private func loadSavedMetrics() {
        if let data = userDefaults.data(forKey: "battery_usage_metrics"),
           let metrics = try? JSONDecoder().decode(BatteryUsageMetrics.self, from: data) {
            batteryUsageMetrics = metrics
        }
        
        if let levelString = userDefaults.string(forKey: "battery_optimization_level"),
           let level = OptimizationLevel(rawValue: levelString) {
            currentOptimizationLevel = level
        }
    }
    
    // MARK: - Public Interface
    func getBatteryUsageReport() -> BatteryUsageReport {
        return BatteryUsageReport(
            dailyUsagePercentage: batteryUsageMetrics.dailyBatteryUsage,
            isWithinTarget: batteryUsageMetrics.isWithinTarget,
            currentOptimizationLevel: currentOptimizationLevel,
            locationUpdatesPerHour: batteryUsageMetrics.locationUpdatesPerHour,
            geofenceEventsPerHour: batteryUsageMetrics.geofenceEventsPerHour,
            averageAccuracy: batteryUsageMetrics.averageAccuracy,
            recommendations: generateRecommendations()
        )
    }
    
    private func generateRecommendations() -> [String] {
        var recommendations: [String] = []
        
        if batteryUsageMetrics.dailyBatteryUsage > 3.0 {
            recommendations.append("Consider reducing location accuracy to improve battery life")
        }
        
        if batteryUsageMetrics.locationUpdatesPerHour > 120 {
            recommendations.append("High location update frequency detected - enable power save mode")
        }
        
        if batteryUsageMetrics.averageAccuracy > 100 {
            recommendations.append("Poor location accuracy - consider moving to areas with better GPS signal")
        }
        
        if !adaptiveOptimizationEnabled {
            recommendations.append("Enable adaptive optimization for automatic battery management")
        }
        
        return recommendations
    }
    
    func resetMetrics() {
        batteryUsageMetrics = BatteryUsageMetrics()
        locationUpdateCount = 0
        geofenceEventCount = 0
        startTime = Date()
        saveMetrics()
    }
    
    deinit {
        batteryMonitoringTimer?.invalidate()
        UIDevice.current.isBatteryMonitoringEnabled = false
    }
}

// MARK: - Supporting Types
struct BatteryUsageReport {
    let dailyUsagePercentage: Double
    let isWithinTarget: Bool
    let currentOptimizationLevel: BatteryOptimizationService.OptimizationLevel
    let locationUpdatesPerHour: Int
    let geofenceEventsPerHour: Int
    let averageAccuracy: Double
    let recommendations: [String]
}

extension UIDevice.BatteryState {
    var isCharging: Bool {
        return self == .charging || self == .full
    }
}

// MARK: - Notification Extensions
extension Notification.Name {
    static let batteryOptimizationChanged = Notification.Name("batteryOptimizationChanged")
    static let geofenceOptimizationRequested = Notification.Name("geofenceOptimizationRequested")
    static let backgroundProcessingOptimizationChanged = Notification.Name("backgroundProcessingOptimizationChanged")
    static let backgroundModeOptimizationRequested = Notification.Name("backgroundModeOptimizationRequested")
    static let emergencyPowerSaveActivated = Notification.Name("emergencyPowerSaveActivated")
    static let privacyModeChanged = Notification.Name("privacyModeChanged")
}

// MARK: - Codable Conformance
extension BatteryOptimizationService.BatteryUsageMetrics: Codable {}