import SwiftUI

struct TaskCreationView: View {
    @StateObject private var taskService = TaskService.shared
    @StateObject private var userService = UserService.shared
    @Environment(\.dismiss) private var dismiss
    
    @State private var title = ""
    @State private var description = ""
    @State private var selectedLocationType: LocationType = .poiCategory
    @State private var selectedPOICategory: POICategory = .grocery
    @State private var showingPremiumView = false
    @State private var showingTaskLimitAlert = false
    
    var body: some View {
        NavigationView {
            Form {
                Section("Task Details") {
                    TextField("Task Title", text: $title)
                    TextField("Description (Optional)", text: $description, axis: .vertical)
                        .lineLimit(3...6)
                }
                
                Section("Location") {
                    Picker("Location Type", selection: $selectedLocationType) {
                        ForEach(LocationType.allCases, id: \.self) { type in
                            Text(type.displayName).tag(type)
                        }
                    }
                    .pickerStyle(.segmented)
                    
                    if selectedLocationType == .poiCategory {
                        Picker("Category", selection: $selectedPOICategory) {
                            ForEach(POICategory.allCases, id: \.self) { category in
                                Label(category.displayName, systemImage: category.icon)
                                    .tag(category)
                            }
                        }
                    }
                }
                
                // Task Limit Status
                if let taskLimit = userService.taskLimitStatus, !taskLimit.isPremium {
                    Section("Task Limit") {
                        TaskLimitProgress(status: taskLimit)
                        
                        if taskLimit.warningThreshold {
                            UpgradePromptCard(
                                onUpgrade: {
                                    showingPremiumView = true
                                },
                                onDismiss: {
                                    // Dismiss handled by the card itself
                                }
                            )
                        }
                    }
                }
            }
            .navigationTitle("New Task")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Create") {
                        createTask()
                    }
                    .disabled(title.isEmpty || taskService.isLoading)
                }
            }
        }
        .sheet(isPresented: $showingPremiumView) {
            PremiumView()
        }
        .alert("Task Limit Reached", isPresented: $showingTaskLimitAlert) {
            Button("Upgrade to Premium") {
                showingPremiumView = true
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Free users are limited to 3 active tasks. Upgrade to Premium for unlimited tasks and more features.")
        }
        .onAppear {
            userService.fetchCurrentUser()
        }
        .onChange(of: taskService.error) { error in
            if case .taskLimitExceeded = error {
                showingTaskLimitAlert = true
            }
        }
    }
    
    private func createTask() {
        // Check task limit before creating
        if let taskLimit = userService.taskLimitStatus, taskLimit.isAtLimit {
            showingTaskLimitAlert = true
            return
        }
        
        let request = CreateTaskRequest(
            title: title,
            description: description.isEmpty ? nil : description,
            locationType: selectedLocationType,
            placeId: nil, // Would be set if custom place selected
            poiCategory: selectedLocationType == .poiCategory ? selectedPOICategory : nil,
            customRadii: nil
        )
        
        taskService.createTask(request)
        
        // Dismiss on success
        if taskService.error == nil {
            dismiss()
        }
    }
}

#if DEBUG
struct TaskCreationView_Previews: PreviewProvider {
    static var previews: some View {
        TaskCreationView()
    }
}
#endif