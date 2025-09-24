import SwiftUI

struct DataExportView: View {
    @StateObject private var privacyService = PrivacyService.shared
    @Environment(\.dismiss) private var dismiss
    
    @State private var includeLocationHistory = true
    @State private var includeTasks = true
    @State private var includePlaces = true
    @State private var includeNotificationHistory = false
    @State private var selectedFormat: DataExportRequest.ExportFormat = .json
    @State private var showingConfirmation = false
    
    var body: some View {
        NavigationView {
            List {
                dataSelectionSection
                formatSection
                exportSection
            }
            .navigationTitle("Export Data")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
            .alert("Export Requested", isPresented: $showingConfirmation) {
                Button("OK") {
                    dismiss()
                }
            } message: {
                Text("Your data export has been requested. You'll receive a notification when it's ready for download.")
            }
        }
    }
    
    // MARK: - Data Selection Section
    
    private var dataSelectionSection: some View {
        Section {
            Toggle("Location History", isOn: $includeLocationHistory)
            Toggle("Tasks", isOn: $includeTasks)
            Toggle("Places", isOn: $includePlaces)
            Toggle("Notification History", isOn: $includeNotificationHistory)
        } header: {
            Text("Data to Export")
        } footer: {
            Text("Select which data you want to include in your export. Location history includes approximate locations where you received reminders.")
        }
    }
    
    // MARK: - Format Section
    
    private var formatSection: some View {
        Section {
            Picker("Export Format", selection: $selectedFormat) {
                ForEach(DataExportRequest.ExportFormat.allCases, id: \.self) { format in
                    HStack {
                        Text(format.displayName)
                        Spacer()
                        Text(formatDescription(format))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .tag(format)
                }
            }
            .pickerStyle(.navigationLink)
        } header: {
            Text("Export Format")
        } footer: {
            Text("JSON format preserves data structure and relationships. CSV format is suitable for spreadsheet applications.")
        }
    }
    
    // MARK: - Export Section
    
    private var exportSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 16) {
                ExportSummaryCard(
                    includeLocationHistory: includeLocationHistory,
                    includeTasks: includeTasks,
                    includePlaces: includePlaces,
                    includeNotificationHistory: includeNotificationHistory,
                    format: selectedFormat
                )
                
                Button(action: requestExport) {
                    HStack {
                        if privacyService.isLoading {
                            ProgressView()
                                .scaleEffect(0.8)
                        } else {
                            Image(systemName: "square.and.arrow.up")
                        }
                        
                        Text("Request Export")
                            .fontWeight(.medium)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(canExport ? Color.blue : Color.gray)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                }
                .disabled(!canExport || privacyService.isLoading)
            }
        } header: {
            Text("Export Summary")
        } footer: {
            Text("Export processing may take a few minutes. You'll receive a notification when your data is ready for download. Export links expire after 7 days.")
        }
    }
    
    // MARK: - Helper Properties
    
    private var canExport: Bool {
        includeLocationHistory || includeTasks || includePlaces || includeNotificationHistory
    }
    
    // MARK: - Helper Methods
    
    private func formatDescription(_ format: DataExportRequest.ExportFormat) -> String {
        switch format {
        case .json:
            return "Structured data"
        case .csv:
            return "Spreadsheet compatible"
        }
    }
    
    private func requestExport() {
        guard let userId = UserDefaults.standard.string(forKey: "user_id") else { return }
        
        let exportRequest = DataExportRequest(
            userId: userId,
            includeLocationHistory: includeLocationHistory,
            includeTasks: includeTasks,
            includePlaces: includePlaces,
            includeNotificationHistory: includeNotificationHistory,
            format: selectedFormat
        )
        
        privacyService.requestDataExport(exportRequest)
        showingConfirmation = true
    }
}

// MARK: - Export Summary Card

struct ExportSummaryCard: View {
    let includeLocationHistory: Bool
    let includeTasks: Bool
    let includePlaces: Bool
    let includeNotificationHistory: Bool
    let format: DataExportRequest.ExportFormat
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "doc.text")
                    .foregroundColor(.blue)
                Text("Export Summary")
                    .font(.headline)
                Spacer()
            }
            
            VStack(alignment: .leading, spacing: 6) {
                if includeTasks {
                    ExportItemRow(icon: "checkmark.circle", title: "Tasks", description: "All your location-based reminders")
                }
                
                if includePlaces {
                    ExportItemRow(icon: "mappin.circle", title: "Places", description: "Custom locations you've added")
                }
                
                if includeLocationHistory {
                    ExportItemRow(icon: "location", title: "Location History", description: "Approximate reminder locations")
                }
                
                if includeNotificationHistory {
                    ExportItemRow(icon: "bell", title: "Notifications", description: "History of reminders sent")
                }
            }
            
            Divider()
            
            HStack {
                Text("Format:")
                    .foregroundColor(.secondary)
                Spacer()
                Text(format.displayName)
                    .fontWeight(.medium)
            }
            
            HStack {
                Text("Estimated size:")
                    .foregroundColor(.secondary)
                Spacer()
                Text(estimatedSize)
                    .fontWeight(.medium)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(10)
    }
    
    private var estimatedSize: String {
        let itemCount = [includeTasks, includePlaces, includeLocationHistory, includeNotificationHistory].filter { $0 }.count
        
        switch itemCount {
        case 0:
            return "0 KB"
        case 1:
            return "< 1 MB"
        case 2:
            return "1-2 MB"
        case 3:
            return "2-5 MB"
        case 4:
            return "5-10 MB"
        default:
            return "< 1 MB"
        }
    }
}

struct ExportItemRow: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundColor(.green)
                .frame(width: 20)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body)
                    .fontWeight(.medium)
                
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
    }
}

// MARK: - Data Export History View

struct DataExportHistoryView: View {
    @StateObject private var privacyService = PrivacyService.shared
    
    var body: some View {
        List {
            ForEach(privacyService.exportRequests, id: \.exportId) { exportRequest in
                ExportRequestRow(exportRequest: exportRequest)
            }
        }
        .navigationTitle("Export History")
        .navigationBarTitleDisplayMode(.large)
        .refreshable {
            // Refresh export statuses
            for exportRequest in privacyService.exportRequests {
                privacyService.getExportStatus(exportId: exportRequest.exportId)
            }
        }
    }
}

struct ExportRequestRow: View {
    let exportRequest: DataExportResponse
    @StateObject private var privacyService = PrivacyService.shared
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Export \(exportRequest.exportId.prefix(8))")
                    .font(.headline)
                
                Spacer()
                
                StatusBadge(status: exportRequest.status)
            }
            
            HStack {
                Text("Created: \(exportRequest.createdAt, style: .date)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                if let fileSize = exportRequest.fileSizeBytes {
                    Text(ByteCountFormatter.string(fromByteCount: Int64(fileSize), countStyle: .file))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            if exportRequest.status == .completed && exportRequest.downloadUrl != nil {
                Button("Download") {
                    privacyService.downloadExport(exportResponse: exportRequest)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
            }
            
            if exportRequest.status == .expired {
                Text("Expired on \(exportRequest.expiresAt, style: .date)")
                    .font(.caption)
                    .foregroundColor(.red)
            }
        }
        .padding(.vertical, 4)
    }
}

struct StatusBadge: View {
    let status: DataExportResponse.ExportStatus
    
    var body: some View {
        Text(status.rawValue.capitalized)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(backgroundColor)
            .foregroundColor(foregroundColor)
            .cornerRadius(6)
    }
    
    private var backgroundColor: Color {
        switch status {
        case .pending, .processing:
            return .orange.opacity(0.2)
        case .completed:
            return .green.opacity(0.2)
        case .failed, .expired:
            return .red.opacity(0.2)
        }
    }
    
    private var foregroundColor: Color {
        switch status {
        case .pending, .processing:
            return .orange
        case .completed:
            return .green
        case .failed, .expired:
            return .red
        }
    }
}

#Preview {
    DataExportView()
}