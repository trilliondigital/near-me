import Foundation
import CoreLocation
import UIKit
import Combine

// MARK: - Performance Monitoring Service
class PerformanceMonitoringService: ObservableObject {
    static let shared = PerformanceMonitoringService()
    
    @Published var performanceMetrics = PerformanceMetrics()
    @Published var isMonitoringEnabled = true
    @Published var alertThresholds = AlertThresholds()
    
    private var cancellables = Set<AnyCancellable>()
    private let userDefaults = UserDefaults.standard
    private var monitoringTimer: Timer?
    private var memoryWarningCount = 0
    private var crashCount = 0
    private var startTime = Date()
    
    // MARK: - Performance Metrics
    struct PerformanceMetrics: Codable {
        var memoryUsageMB: Double = 0.0
        var cpuUsagePercentage: Double = 0.0
        var batteryDrainRate: Double = 0.0
        var locationAccuracyMeters: Double = 0.0
        var geofenceResponseTimeMs: Double = 0.0
        var notificationDeliveryTimeMs: Double = 0.0
        var apiResponseTimeMs: Double = 0.0
        var crashFreePercentage: Double = 100.0
        var falsePositiveRate: Double = 0.0
        var backgroundExecutionTimeMs: Double = 0.0
        var networkRequestCount: Int = 0
        var cacheHitRate: Double = 0.0
        var lastUpdated = Date()
        
        var overallHealthScore: Double {
            let scores = [
                crashFreePercentage / 100.0,
                max(0, 1.0 - (batteryDrainRate / 5.0)), // Target ≤5% daily
                max(0, 1.0 - (memoryUsageMB / 200.0)), // Target ≤200MB
                max(0, 1.0 - (cpuUsagePercentage / 20.0)), // Target ≤20%
                max(0, 1.0 - (falsePositiveRate / 10.0)), // Target ≤10%
                cacheHitRate / 100.0
            ]
            return scores.reduce(0, +) / Double(scores.count) * 100.0
        }
    }
    
    struct AlertThresholds: Codable {
        var maxMemoryUsageMB: Double = 200.0
        var maxCpuUsagePercentage: Double = 20.0
        var maxBatteryDrainRate: Double = 5.0
        var minCrashFreePercentage: Double = 99.0
        var maxFalsePositiveRate: Double = 10.0
        var maxGeofenceResponseTimeMs: Double = 5000.0
        var maxNotificationDeliveryTimeMs: Double = 3000.0
        var maxApiResponseTimeMs: Double = 2000.0
    }
    
    // MARK: - Initialization
    private init() {
        setupPerformanceMonitoring()
        loadSavedMetrics()
        observeMemoryWarnings()
        observeAppStateChanges()
    }
    
    private func setupPerformanceMonitoring() {
        monitoringTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { _ in
            self.updatePerformanceMetrics()
        }
    }
    
    private func observeMemoryWarnings() {
        NotificationCenter.default.publisher(for: UIApplication.didReceiveMemoryWarningNotification)
            .sink { _ in
                self.handleMemoryWarning()
            }
            .store(in: &cancellables)
    }
    
    private func observeAppStateChanges() {
        NotificationCenter.default.publisher(for: UIApplication.didEnterBackgroundNotification)
            .sink { _ in
                self.recordBackgroundEntry()
            }
            .store(in: &cancellables)
        
        NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)
            .sink { _ in
                self.recordForegroundEntry()
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Metrics Collection
    private func updatePerformanceMetrics() {
        guard isMonitoringEnabled else { return }
        
        performanceMetrics.memoryUsageMB = getCurrentMemoryUsage()
        performanceMetrics.cpuUsagePercentage = getCurrentCPUUsage()
        performanceMetrics.batteryDrainRate = getBatteryDrainRate()
        performanceMetrics.lastUpdated = Date()
        
        checkThresholds()
        saveMetrics()
    }
    
    private func getCurrentMemoryUsage() -> Double {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
        
        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_,
                         task_flavor_t(MACH_TASK_BASIC_INFO),
                         $0,
                         &count)
            }
        }
        
        if kerr == KERN_SUCCESS {
            return Double(info.resident_size) / 1024.0 / 1024.0 // Convert to MB
        }
        return 0.0
    }
    
    private func getCurrentCPUUsage() -> Double {
        var info = processor_info_array_t.allocate(capacity: 1)
        var numCpuInfo: mach_msg_type_number_t = 0
        var numCpus: natural_t = 0
        
        let result = host_processor_info(mach_host_self(),
                                       PROCESSOR_CPU_LOAD_INFO,
                                       &numCpus,
                                       &info,
                                       &numCpuInfo)
        
        if result == KERN_SUCCESS {
            // Simplified CPU usage calculation
            return Double.random(in: 0...15) // Placeholder - real implementation would calculate actual CPU usage
        }
        return 0.0
    }
    
    private func getBatteryDrainRate() -> Double {
        // This would integrate with BatteryOptimizationService
        return BatteryOptimizationService.shared.batteryUsageMetrics.dailyBatteryUsage
    }
    
    // MARK: - Event Recording
    func recordLocationUpdate(accuracy: CLLocationAccuracy, responseTime: TimeInterval) {
        performanceMetrics.locationAccuracyMeters = accuracy
        
        // Update average response time
        let currentAvg = performanceMetrics.geofenceResponseTimeMs
        performanceMetrics.geofenceResponseTimeMs = (currentAvg + responseTime * 1000) / 2
        
        BatteryOptimizationService.shared.recordLocationUpdate(accuracy: accuracy)
    }
    
    func recordGeofenceEvent(responseTime: TimeInterval, isAccurate: Bool) {
        performanceMetrics.geofenceResponseTimeMs = responseTime * 1000
        
        // Track false positives
        if !isAccurate {
            let currentRate = performanceMetrics.falsePositiveRate
            performanceMetrics.falsePositiveRate = min(100, currentRate + 0.1)
        }
        
        BatteryOptimizationService.shared.recordGeofenceEvent()
        
        if responseTime > alertThresholds.maxGeofenceResponseTimeMs / 1000 {
            reportPerformanceIssue(.slowGeofenceResponse(responseTime))
        }
    }
    
    func recordNotificationDelivery(deliveryTime: TimeInterval) {
        performanceMetrics.notificationDeliveryTimeMs = deliveryTime * 1000
        
        if deliveryTime > alertThresholds.maxNotificationDeliveryTimeMs / 1000 {
            reportPerformanceIssue(.slowNotificationDelivery(deliveryTime))
        }
    }
    
    func recordAPICall(responseTime: TimeInterval, success: Bool) {
        performanceMetrics.networkRequestCount += 1
        
        let currentAvg = performanceMetrics.apiResponseTimeMs
        performanceMetrics.apiResponseTimeMs = (currentAvg + responseTime * 1000) / 2
        
        if responseTime > alertThresholds.maxApiResponseTimeMs / 1000 {
            reportPerformanceIssue(.slowAPIResponse(responseTime))
        }
    }
    
    func recordCacheHit(isHit: Bool) {
        let totalRequests = Double(performanceMetrics.networkRequestCount)
        let currentHitRate = performanceMetrics.cacheHitRate
        let currentHits = (currentHitRate / 100.0) * totalRequests
        
        let newHits = isHit ? currentHits + 1 : currentHits
        performanceMetrics.cacheHitRate = (newHits / totalRequests) * 100.0
    }
    
    func recordCrash() {
        crashCount += 1
        let totalSessions = max(1, crashCount + 100) // Assume 100 successful sessions for calculation
        performanceMetrics.crashFreePercentage = Double(totalSessions - crashCount) / Double(totalSessions) * 100.0
        
        reportPerformanceIssue(.crashDetected)
    }
    
    private func handleMemoryWarning() {
        memoryWarningCount += 1
        reportPerformanceIssue(.memoryWarning)
        
        // Trigger memory cleanup
        NotificationCenter.default.post(
            name: .memoryCleanupRequested,
            object: nil
        )
    }
    
    private func recordBackgroundEntry() {
        // Start tracking background execution time
        UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "background_entry_time")
    }
    
    private func recordForegroundEntry() {
        // Calculate background execution time
        let entryTime = UserDefaults.standard.double(forKey: "background_entry_time")
        if entryTime > 0 {
            let backgroundTime = Date().timeIntervalSince1970 - entryTime
            performanceMetrics.backgroundExecutionTimeMs = backgroundTime * 1000
        }
    }
    
    // MARK: - Threshold Monitoring
    private func checkThresholds() {
        if performanceMetrics.memoryUsageMB > alertThresholds.maxMemoryUsageMB {
            reportPerformanceIssue(.highMemoryUsage(performanceMetrics.memoryUsageMB))
        }
        
        if performanceMetrics.cpuUsagePercentage > alertThresholds.maxCpuUsagePercentage {
            reportPerformanceIssue(.highCPUUsage(performanceMetrics.cpuUsagePercentage))
        }
        
        if performanceMetrics.batteryDrainRate > alertThresholds.maxBatteryDrainRate {
            reportPerformanceIssue(.highBatteryDrain(performanceMetrics.batteryDrainRate))
        }
        
        if performanceMetrics.crashFreePercentage < alertThresholds.minCrashFreePercentage {
            reportPerformanceIssue(.lowCrashFreeRate(performanceMetrics.crashFreePercentage))
        }
        
        if performanceMetrics.falsePositiveRate > alertThresholds.maxFalsePositiveRate {
            reportPerformanceIssue(.highFalsePositiveRate(performanceMetrics.falsePositiveRate))
        }
    }
    
    // MARK: - Issue Reporting
    enum PerformanceIssue {
        case highMemoryUsage(Double)
        case highCPUUsage(Double)
        case highBatteryDrain(Double)
        case lowCrashFreeRate(Double)
        case highFalsePositiveRate(Double)
        case slowGeofenceResponse(TimeInterval)
        case slowNotificationDelivery(TimeInterval)
        case slowAPIResponse(TimeInterval)
        case memoryWarning
        case crashDetected
        
        var description: String {
            switch self {
            case .highMemoryUsage(let usage):
                return "High memory usage: \(String(format: "%.1f", usage))MB"
            case .highCPUUsage(let usage):
                return "High CPU usage: \(String(format: "%.1f", usage))%"
            case .highBatteryDrain(let drain):
                return "High battery drain: \(String(format: "%.1f", drain))%"
            case .lowCrashFreeRate(let rate):
                return "Low crash-free rate: \(String(format: "%.1f", rate))%"
            case .highFalsePositiveRate(let rate):
                return "High false positive rate: \(String(format: "%.1f", rate))%"
            case .slowGeofenceResponse(let time):
                return "Slow geofence response: \(String(format: "%.1f", time * 1000))ms"
            case .slowNotificationDelivery(let time):
                return "Slow notification delivery: \(String(format: "%.1f", time * 1000))ms"
            case .slowAPIResponse(let time):
                return "Slow API response: \(String(format: "%.1f", time * 1000))ms"
            case .memoryWarning:
                return "Memory warning received"
            case .crashDetected:
                return "Application crash detected"
            }
        }
        
        var severity: IssueSeverity {
            switch self {
            case .crashDetected, .highBatteryDrain, .lowCrashFreeRate:
                return .critical
            case .highMemoryUsage, .highCPUUsage, .memoryWarning:
                return .high
            case .slowGeofenceResponse, .slowNotificationDelivery, .highFalsePositiveRate:
                return .medium
            case .slowAPIResponse:
                return .low
            }
        }
    }
    
    enum IssueSeverity {
        case critical, high, medium, low
    }
    
    private func reportPerformanceIssue(_ issue: PerformanceIssue) {
        print("Performance Issue [\(issue.severity)]: \(issue.description)")
        
        // Post notification for UI updates
        NotificationCenter.default.post(
            name: .performanceIssueDetected,
            object: issue
        )
        
        // Trigger automatic optimizations for critical issues
        if issue.severity == .critical {
            triggerEmergencyOptimizations(for: issue)
        }
        
        // Log to analytics (would be implemented in analytics service)
        logPerformanceIssue(issue)
    }
    
    private func triggerEmergencyOptimizations(for issue: PerformanceIssue) {
        switch issue {
        case .highBatteryDrain, .crashDetected:
            BatteryOptimizationService.shared.applyOptimizationLevel(.minimal)
        case .highMemoryUsage, .memoryWarning:
            NotificationCenter.default.post(name: .memoryCleanupRequested, object: nil)
        case .lowCrashFreeRate:
            // Disable non-essential features
            NotificationCenter.default.post(name: .emergencyModeActivated, object: nil)
        default:
            break
        }
    }
    
    private func logPerformanceIssue(_ issue: PerformanceIssue) {
        // This would integrate with the analytics service
        // For now, just log locally
        let logEntry = [
            "timestamp": Date().timeIntervalSince1970,
            "issue": issue.description,
            "severity": "\(issue.severity)",
            "metrics": performanceMetrics
        ] as [String : Any]
        
        // Store in UserDefaults for now (would use proper analytics in production)
        var logs = userDefaults.array(forKey: "performance_logs") as? [[String: Any]] ?? []
        logs.append(logEntry)
        
        // Keep only last 100 entries
        if logs.count > 100 {
            logs = Array(logs.suffix(100))
        }
        
        userDefaults.set(logs, forKey: "performance_logs")
    }
    
    // MARK: - Public Interface
    func getPerformanceReport() -> PerformanceReport {
        return PerformanceReport(
            metrics: performanceMetrics,
            healthScore: performanceMetrics.overallHealthScore,
            recommendations: generateRecommendations(),
            recentIssues: getRecentIssues()
        )
    }
    
    private func generateRecommendations() -> [String] {
        var recommendations: [String] = []
        
        if performanceMetrics.memoryUsageMB > alertThresholds.maxMemoryUsageMB {
            recommendations.append("Reduce memory usage by clearing caches and optimizing data structures")
        }
        
        if performanceMetrics.batteryDrainRate > alertThresholds.maxBatteryDrainRate {
            recommendations.append("Enable battery optimization to reduce power consumption")
        }
        
        if performanceMetrics.falsePositiveRate > alertThresholds.maxFalsePositiveRate {
            recommendations.append("Adjust geofence radii to reduce false positive notifications")
        }
        
        if performanceMetrics.cacheHitRate < 80 {
            recommendations.append("Improve caching strategy to reduce network requests")
        }
        
        if performanceMetrics.geofenceResponseTimeMs > alertThresholds.maxGeofenceResponseTimeMs {
            recommendations.append("Optimize geofence processing for faster response times")
        }
        
        return recommendations
    }
    
    private func getRecentIssues() -> [PerformanceIssue] {
        // This would return recent issues from logs
        // Simplified implementation for now
        return []
    }
    
    func resetMetrics() {
        performanceMetrics = PerformanceMetrics()
        memoryWarningCount = 0
        crashCount = 0
        startTime = Date()
        saveMetrics()
    }
    
    // MARK: - Persistence
    private func saveMetrics() {
        let encoder = JSONEncoder()
        if let data = try? encoder.encode(performanceMetrics) {
            userDefaults.set(data, forKey: "performance_metrics")
        }
        if let thresholdData = try? encoder.encode(alertThresholds) {
            userDefaults.set(thresholdData, forKey: "alert_thresholds")
        }
    }
    
    private func loadSavedMetrics() {
        if let data = userDefaults.data(forKey: "performance_metrics"),
           let metrics = try? JSONDecoder().decode(PerformanceMetrics.self, from: data) {
            performanceMetrics = metrics
        }
        
        if let data = userDefaults.data(forKey: "alert_thresholds"),
           let thresholds = try? JSONDecoder().decode(AlertThresholds.self, from: data) {
            alertThresholds = thresholds
        }
    }
    
    deinit {
        monitoringTimer?.invalidate()
    }
}

// MARK: - Supporting Types
struct PerformanceReport {
    let metrics: PerformanceMonitoringService.PerformanceMetrics
    let healthScore: Double
    let recommendations: [String]
    let recentIssues: [PerformanceMonitoringService.PerformanceIssue]
}

// MARK: - Notification Extensions
extension Notification.Name {
    static let performanceIssueDetected = Notification.Name("performanceIssueDetected")
    static let memoryCleanupRequested = Notification.Name("memoryCleanupRequested")
    static let emergencyModeActivated = Notification.Name("emergencyModeActivated")
}