import SwiftUI
import CoreLocation

struct PrivacySettingsView: View {
    @StateObject private var privacyService = PrivacyService.shared
    @StateObject private var locationManager = LocationManager.shared
    @Environment(\.dismiss) private var dismiss
    
    @State private var showingDataExportSheet = false
    @State private var showingDataDeletionAlert = false
    @State private var showingLocationModeInfo = false
    @State private var confirmationCode = ""
    
    var body: some View {
        NavigationView {
            List {
                locationPrivacySection
                dataProcessingSection
                dataManagementSection
                analyticsSection
                
                if privacyService.isLoading {
                    HStack {
                        Spacer()
                        ProgressView()
                            .scaleEffect(0.8)
                        Spacer()
                    }
                    .listRowBackground(Color.clear)
                }
            }
            .navigationTitle("Privacy & Data")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .alert("Privacy Error", isPresented: .constant(privacyService.error != nil)) {
                Button("OK") {
                    privacyService.clearError()
                }
            } message: {
                Text(privacyService.error?.localizedDescription ?? "")
            }
            .sheet(isPresented: $showingDataExportSheet) {
                DataExportView()
            }
        }
    }
    
    // MARK: - Location Privacy Section
    
    private var locationPrivacySection: some View {
        Section {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Location Privacy Mode")
                        .font(.headline)
                    
                    Spacer()
                    
                    Button(action: { showingLocationModeInfo = true }) {
                        Image(systemName: "info.circle")
                            .foregroundColor(.blue)
                    }
                }
                
                Picker("Location Mode", selection: $privacyService.privacySettings.locationPrivacyMode) {
                    ForEach(LocationPrivacyMode.allCases, id: \.self) { mode in
                        VStack(alignment: .leading) {
                            Text(mode.displayName)
                                .font(.body)
                            Text(mode.description)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .onChange(of: privacyService.privacySettings.locationPrivacyMode) { newMode in
                    var updatedSettings = privacyService.privacySettings
                    updatedSettings.locationPrivacyMode = newMode
                    privacyService.updatePrivacySettings(updatedSettings)
                }
                
                if privacyService.privacySettings.locationPrivacyMode == .foregroundOnly {
                    PrivacyWarningCard(
                        title: "Limited Functionality",
                        message: "Foreground-only mode will disable background location reminders. You'll only receive notifications when the app is open.",
                        icon: "exclamationmark.triangle.fill",
                        color: .orange
                    )
                }
                
                // Current location status
                LocationStatusCard(
                    authorizationStatus: locationManager.authorizationStatus,
                    foregroundOnlyMode: locationManager.foregroundOnlyMode
                )
            }
        } header: {
            Text("Location Services")
        } footer: {
            Text("Control how Near Me uses your location data. Foreground-only mode provides maximum privacy but limits functionality.")
        }
        .alert("Location Privacy Mode", isPresented: $showingLocationModeInfo) {
            Button("OK") { }
        } message: {
            Text("Standard mode allows background location for reliable reminders. Foreground-only mode only tracks location when the app is open, providing maximum privacy but limited functionality.")
        }
    }
    
    // MARK: - Data Processing Section
    
    private var dataProcessingSection: some View {
        Section {
            Toggle("On-Device Processing", isOn: $privacyService.privacySettings.onDeviceProcessing)
                .onChange(of: privacyService.privacySettings.onDeviceProcessing) { newValue in
                    var updatedSettings = privacyService.privacySettings
                    updatedSettings.onDeviceProcessing = newValue
                    privacyService.updatePrivacySettings(updatedSettings)
                }
            
            Toggle("Data Minimization", isOn: $privacyService.privacySettings.dataMinimization)
                .onChange(of: privacyService.privacySettings.dataMinimization) { newValue in
                    var updatedSettings = privacyService.privacySettings
                    updatedSettings.dataMinimization = newValue
                    privacyService.updatePrivacySettings(updatedSettings)
                }
            
            VStack(alignment: .leading, spacing: 8) {
                Text("Location History Retention")
                    .font(.body)
                
                Picker("Retention Period", selection: $privacyService.privacySettings.locationHistoryRetention) {
                    Text("7 days").tag(7)
                    Text("30 days").tag(30)
                    Text("90 days").tag(90)
                    Text("1 year").tag(365)
                }
                .pickerStyle(.segmented)
                .onChange(of: privacyService.privacySettings.locationHistoryRetention) { newValue in
                    var updatedSettings = privacyService.privacySettings
                    updatedSettings.locationHistoryRetention = newValue
                    privacyService.updatePrivacySettings(updatedSettings)
                }
            }
        } header: {
            Text("Data Processing")
        } footer: {
            Text("On-device processing keeps your location data local. Data minimization reduces the amount of data collected and stored.")
        }
    }
    
    // MARK: - Data Management Section
    
    private var dataManagementSection: some View {
        Section {
            Button(action: { showingDataExportSheet = true }) {
                HStack {
                    Image(systemName: "square.and.arrow.up")
                        .foregroundColor(.blue)
                    Text("Export My Data")
                        .foregroundColor(.primary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .foregroundColor(.secondary)
                        .font(.caption)
                }
            }
            
            Button(action: { showingDataDeletionAlert = true }) {
                HStack {
                    Image(systemName: "trash")
                        .foregroundColor(.red)
                    Text("Delete My Data")
                        .foregroundColor(.red)
                    Spacer()
                }
            }
            .alert("Delete Data", isPresented: $showingDataDeletionAlert) {
                TextField("Enter DELETE to confirm", text: $confirmationCode)
                Button("Cancel", role: .cancel) {
                    confirmationCode = ""
                }
                Button("Delete", role: .destructive) {
                    deleteUserData()
                }
                .disabled(confirmationCode.uppercased() != "DELETE")
            } message: {
                Text("This will permanently delete all your data including tasks, places, and location history. This action cannot be undone.")
            }
            
            if !privacyService.exportRequests.isEmpty {
                NavigationLink("Export History") {
                    DataExportHistoryView()
                }
            }
        } header: {
            Text("Data Management")
        } footer: {
            Text("Export your data for backup or transfer. Data deletion is permanent and cannot be undone.")
        }
    }
    
    // MARK: - Analytics Section
    
    private var analyticsSection: some View {
        Section {
            Toggle("Opt Out of Analytics", isOn: $privacyService.privacySettings.analyticsOptOut)
                .onChange(of: privacyService.privacySettings.analyticsOptOut) { newValue in
                    var updatedSettings = privacyService.privacySettings
                    updatedSettings.analyticsOptOut = newValue
                    privacyService.updatePrivacySettings(updatedSettings)
                }
            
            Toggle("Opt Out of Crash Reporting", isOn: $privacyService.privacySettings.crashReportingOptOut)
                .onChange(of: privacyService.privacySettings.crashReportingOptOut) { newValue in
                    var updatedSettings = privacyService.privacySettings
                    updatedSettings.crashReportingOptOut = newValue
                    privacyService.updatePrivacySettings(updatedSettings)
                }
        } header: {
            Text("Analytics & Reporting")
        } footer: {
            Text("Analytics help us improve the app. All data is anonymized and never includes personal information.")
        }
    }
    
    // MARK: - Helper Methods
    
    private func deleteUserData() {
        guard let userId = UserDefaults.standard.string(forKey: "user_id") else { return }
        
        let deletionRequest = DataDeletionRequest(
            userId: userId,
            deleteLocationHistory: true,
            deleteTasks: true,
            deletePlaces: true,
            deleteNotificationHistory: true,
            deleteAccount: true,
            confirmationCode: confirmationCode
        )
        
        privacyService.requestDataDeletion(deletionRequest)
        confirmationCode = ""
    }
}

// MARK: - Supporting Views

struct PrivacyWarningCard: View {
    let title: String
    let message: String
    let icon: String
    let color: Color
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(color)
                .font(.title2)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundColor(color)
                
                Text(message)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            
            Spacer()
        }
        .padding()
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

struct LocationStatusCard: View {
    let authorizationStatus: CLAuthorizationStatus
    let foregroundOnlyMode: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: statusIcon)
                .foregroundColor(statusColor)
                .font(.title2)
            
            VStack(alignment: .leading, spacing: 2) {
                Text("Location Status")
                    .font(.headline)
                
                Text(statusMessage)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
    
    private var statusIcon: String {
        switch authorizationStatus {
        case .authorizedAlways:
            return foregroundOnlyMode ? "location.fill.viewfinder" : "location.fill"
        case .authorizedWhenInUse:
            return "location.viewfinder"
        case .denied, .restricted:
            return "location.slash"
        case .notDetermined:
            return "location.circle"
        @unknown default:
            return "location.circle"
        }
    }
    
    private var statusColor: Color {
        switch authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            return foregroundOnlyMode ? .orange : .green
        case .denied, .restricted:
            return .red
        case .notDetermined:
            return .gray
        @unknown default:
            return .gray
        }
    }
    
    private var statusMessage: String {
        switch authorizationStatus {
        case .authorizedAlways:
            return foregroundOnlyMode ? "Foreground only (privacy mode active)" : "Full location access"
        case .authorizedWhenInUse:
            return "Location access while using app"
        case .denied:
            return "Location access denied"
        case .restricted:
            return "Location access restricted"
        case .notDetermined:
            return "Location permission not requested"
        @unknown default:
            return "Unknown location status"
        }
    }
}

#Preview {
    PrivacySettingsView()
}