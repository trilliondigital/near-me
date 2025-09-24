import SwiftUI
import Combine

struct BatteryOptimizationView: View {
    @StateObject private var batteryService = BatteryOptimizationService.shared
    @StateObject private var performanceService = PerformanceMonitoringService.shared
    @State private var showingAdvancedSettings = false
    @State private var showingPerformanceReport = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Battery Status Card
                    batteryStatusCard
                    
                    // Optimization Level Selector
                    optimizationLevelCard
                    
                    // Performance Metrics Card
                    performanceMetricsCard
                    
                    // Quick Actions
                    quickActionsCard
                    
                    // Advanced Settings
                    if showingAdvancedSettings {
                        advancedSettingsCard
                    }
                }
                .padding()
            }
            .navigationTitle("Battery & Performance")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Advanced") {
                        withAnimation {
                            showingAdvancedSettings.toggle()
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - Battery Status Card
    private var batteryStatusCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "battery.100")
                    .foregroundColor(batteryColor)
                Text("Battery Status")
                    .font(.headline)
                Spacer()
                Text("\(Int(UIDevice.current.batteryLevel * 100))%")
                    .font(.title2)
                    .fontWeight(.semibold)
            }
            
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Daily Usage:")
                    Spacer()
                    Text("\(batteryService.batteryUsageMetrics.dailyBatteryUsage, specifier: "%.1f")%")
                        .foregroundColor(batteryService.batteryUsageMetrics.isWithinTarget ? .green : .red)
                }
                
                HStack {
                    Text("Target:")
                    Spacer()
                    Text("≤ 3.0%")
                        .foregroundColor(.secondary)
                }
                
                if batteryService.isLowPowerModeEnabled {
                    HStack {
                        Image(systemName: "battery.25")
                            .foregroundColor(.orange)
                        Text("Low Power Mode Active")
                            .foregroundColor(.orange)
                        Spacer()
                    }
                }
            }
            .font(.subheadline)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
    
    // MARK: - Optimization Level Card
    private var optimizationLevelCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Optimization Level")
                .font(.headline)
            
            VStack(spacing: 8) {
                ForEach(BatteryOptimizationService.OptimizationLevel.allCases, id: \.self) { level in
                    OptimizationLevelRow(
                        level: level,
                        isSelected: level == batteryService.currentOptimizationLevel,
                        onSelect: {
                            batteryService.applyOptimizationLevel(level)
                        }
                    )
                }
            }
            
            Toggle("Adaptive Optimization", isOn: $batteryService.adaptiveOptimizationEnabled)
                .padding(.top, 8)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
    
    // MARK: - Performance Metrics Card
    private var performanceMetricsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Performance Metrics")
                    .font(.headline)
                Spacer()
                Button("View Report") {
                    showingPerformanceReport = true
                }
                .font(.caption)
            }
            
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                MetricTile(
                    title: "Memory",
                    value: "\(performanceService.performanceMetrics.memoryUsageMB, specifier: "%.0f") MB",
                    status: performanceService.performanceMetrics.memoryUsageMB < 200 ? .good : .warning
                )
                
                MetricTile(
                    title: "CPU",
                    value: "\(performanceService.performanceMetrics.cpuUsagePercentage, specifier: "%.1f")%",
                    status: performanceService.performanceMetrics.cpuUsagePercentage < 20 ? .good : .warning
                )
                
                MetricTile(
                    title: "Location Updates",
                    value: "\(batteryService.batteryUsageMetrics.locationUpdatesPerHour)/hr",
                    status: batteryService.batteryUsageMetrics.locationUpdatesPerHour < 120 ? .good : .warning
                )
                
                MetricTile(
                    title: "Accuracy",
                    value: "\(batteryService.batteryUsageMetrics.averageAccuracy, specifier: "%.0f")m",
                    status: batteryService.batteryUsageMetrics.averageAccuracy < 100 ? .good : .warning
                )
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .sheet(isPresented: $showingPerformanceReport) {
            PerformanceReportView()
        }
    }
    
    // MARK: - Quick Actions Card
    private var quickActionsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Quick Actions")
                .font(.headline)
            
            VStack(spacing: 8) {
                Button(action: {
                    batteryService.analyzeAndOptimize()
                }) {
                    HStack {
                        Image(systemName: "wand.and.rays")
                        Text("Optimize Now")
                        Spacer()
                        Image(systemName: "chevron.right")
                    }
                    .padding()
                    .background(Color.blue.opacity(0.1))
                    .foregroundColor(.blue)
                    .cornerRadius(8)
                }
                
                Button(action: {
                    batteryService.resetMetrics()
                }) {
                    HStack {
                        Image(systemName: "arrow.clockwise")
                        Text("Reset Metrics")
                        Spacer()
                        Image(systemName: "chevron.right")
                    }
                    .padding()
                    .background(Color.orange.opacity(0.1))
                    .foregroundColor(.orange)
                    .cornerRadius(8)
                }
                
                if !batteryService.batteryUsageMetrics.isWithinTarget {
                    Button(action: {
                        batteryService.applyOptimizationLevel(.powerSave)
                    }) {
                        HStack {
                            Image(systemName: "battery.25")
                            Text("Emergency Power Save")
                            Spacer()
                            Image(systemName: "chevron.right")
                        }
                        .padding()
                        .background(Color.red.opacity(0.1))
                        .foregroundColor(.red)
                        .cornerRadius(8)
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
    
    // MARK: - Advanced Settings Card
    private var advancedSettingsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Advanced Settings")
                .font(.headline)
            
            VStack(alignment: .leading, spacing: 12) {
                Text("Recommendations")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                let report = batteryService.getBatteryUsageReport()
                if report.recommendations.isEmpty {
                    Text("No recommendations at this time")
                        .foregroundColor(.secondary)
                        .font(.caption)
                } else {
                    ForEach(report.recommendations, id: \.self) { recommendation in
                        HStack(alignment: .top) {
                            Image(systemName: "lightbulb")
                                .foregroundColor(.yellow)
                                .font(.caption)
                            Text(recommendation)
                                .font(.caption)
                                .multilineTextAlignment(.leading)
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .transition(.opacity.combined(with: .move(edge: .top)))
    }
    
    // MARK: - Computed Properties
    private var batteryColor: Color {
        let level = UIDevice.current.batteryLevel
        if level > 0.5 { return .green }
        if level > 0.2 { return .orange }
        return .red
    }
}

// MARK: - Supporting Views
struct OptimizationLevelRow: View {
    let level: BatteryOptimizationService.OptimizationLevel
    let isSelected: Bool
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(levelTitle)
                        .font(.subheadline)
                        .fontWeight(.medium)
                    Text(levelDescription)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.blue)
                }
            }
            .padding()
            .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? Color.blue : Color.clear, lineWidth: 2)
            )
            .cornerRadius(8)
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var levelTitle: String {
        switch level {
        case .highAccuracy: return "High Accuracy"
        case .balanced: return "Balanced"
        case .powerSave: return "Power Save"
        case .minimal: return "Minimal"
        }
    }
    
    private var levelDescription: String {
        switch level {
        case .highAccuracy: return "Best location accuracy, higher battery usage"
        case .balanced: return "Good balance of accuracy and battery life"
        case .powerSave: return "Reduced accuracy, better battery life"
        case .minimal: return "Minimal location usage, maximum battery savings"
        }
    }
}

struct MetricTile: View {
    let title: String
    let value: String
    let status: MetricStatus
    
    enum MetricStatus {
        case good, warning, error
        
        var color: Color {
            switch self {
            case .good: return .green
            case .warning: return .orange
            case .error: return .red
            }
        }
        
        var icon: String {
            switch self {
            case .good: return "checkmark.circle.fill"
            case .warning: return "exclamationmark.triangle.fill"
            case .error: return "xmark.circle.fill"
            }
        }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                Image(systemName: status.icon)
                    .foregroundColor(status.color)
                    .font(.caption)
            }
            
            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)
        }
        .padding(12)
        .background(Color(.systemBackground))
        .cornerRadius(8)
    }
}

struct PerformanceReportView: View {
    @StateObject private var batteryService = BatteryOptimizationService.shared
    @StateObject private var performanceService = PerformanceMonitoringService.shared
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Overall Health Score
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Overall Health Score")
                            .font(.headline)
                        
                        HStack {
                            Text("\(performanceService.performanceMetrics.overallHealthScore, specifier: "%.0f")")
                                .font(.largeTitle)
                                .fontWeight(.bold)
                                .foregroundColor(healthScoreColor)
                            Text("/ 100")
                                .font(.title2)
                                .foregroundColor(.secondary)
                        }
                        
                        Text(healthScoreDescription)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                    
                    // Detailed Metrics
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Detailed Metrics")
                            .font(.headline)
                        
                        MetricDetailRow(
                            title: "Battery Usage",
                            value: "\(batteryService.batteryUsageMetrics.dailyBatteryUsage, specifier: "%.1f")%",
                            target: "≤ 3.0%",
                            isGood: batteryService.batteryUsageMetrics.isWithinTarget
                        )
                        
                        MetricDetailRow(
                            title: "Memory Usage",
                            value: "\(performanceService.performanceMetrics.memoryUsageMB, specifier: "%.0f") MB",
                            target: "≤ 200 MB",
                            isGood: performanceService.performanceMetrics.memoryUsageMB < 200
                        )
                        
                        MetricDetailRow(
                            title: "Location Updates",
                            value: "\(batteryService.batteryUsageMetrics.locationUpdatesPerHour)/hr",
                            target: "≤ 120/hr",
                            isGood: batteryService.batteryUsageMetrics.locationUpdatesPerHour < 120
                        )
                        
                        MetricDetailRow(
                            title: "Average Accuracy",
                            value: "\(batteryService.batteryUsageMetrics.averageAccuracy, specifier: "%.0f")m",
                            target: "≤ 100m",
                            isGood: batteryService.batteryUsageMetrics.averageAccuracy < 100
                        )
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                    
                    // Recommendations
                    let report = batteryService.getBatteryUsageReport()
                    if !report.recommendations.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Recommendations")
                                .font(.headline)
                            
                            ForEach(report.recommendations, id: \.self) { recommendation in
                                HStack(alignment: .top, spacing: 12) {
                                    Image(systemName: "lightbulb.fill")
                                        .foregroundColor(.yellow)
                                    Text(recommendation)
                                        .font(.subheadline)
                                }
                            }
                        }
                        .padding()
                        .background(Color(.systemGray6))
                        .cornerRadius(12)
                    }
                }
                .padding()
            }
            .navigationTitle("Performance Report")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            }
        }
    }
    
    private var healthScoreColor: Color {
        let score = performanceService.performanceMetrics.overallHealthScore
        if score >= 80 { return .green }
        if score >= 60 { return .orange }
        return .red
    }
    
    private var healthScoreDescription: String {
        let score = performanceService.performanceMetrics.overallHealthScore
        if score >= 80 { return "Excellent performance" }
        if score >= 60 { return "Good performance with room for improvement" }
        return "Performance needs attention"
    }
}

struct MetricDetailRow: View {
    let title: String
    let value: String
    let target: String
    let isGood: Bool
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline)
                Text("Target: \(target)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 4) {
                Text(value)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(isGood ? .green : .red)
                
                Image(systemName: isGood ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .foregroundColor(isGood ? .green : .red)
                    .font(.caption)
            }
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    BatteryOptimizationView()
}