import Foundation
import Combine
import CoreLocation

// MARK: - Task Creation ViewModel
class TaskCreationViewModel: ObservableObject {
    @Published var title = ""
    @Published var description = ""
    @Published var locationType: LocationType = .customPlace
    @Published var selectedPlace: Place?
    @Published var selectedPOICategory: POICategory = .gas
    @Published var customRadii = GeofenceRadii.default
    
    // UI State
    @Published var isCreating = false
    @Published var showingLocationSelection = false
    @Published var showingPOISelection = false
    @Published var showingRadiusCustomization = false
    @Published var showingError = false
    @Published var errorMessage = ""
    
    private let taskService = TaskService.shared
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        // Update custom radii when POI category changes
        $selectedPOICategory
            .sink { [weak self] category in
                if self?.locationType == .poiCategory {
                    self?.customRadii = GeofenceRadii.defaultForPOI(category)
                }
            }
            .store(in: &cancellables)
        
        // Update custom radii when location type changes
        $locationType
            .sink { [weak self] locationType in
                guard let self = self else { return }
                if locationType == .poiCategory {
                    self.customRadii = GeofenceRadii.defaultForPOI(self.selectedPOICategory)
                } else {
                    self.customRadii = GeofenceRadii.default
                }
            }
            .store(in: &cancellables)
        
        // Listen for task service errors
        taskService.$error
            .compactMap { $0 }
            .sink { [weak self] error in
                self?.errorMessage = error.localizedDescription
                self?.showingError = true
                self?.isCreating = false
            }
            .store(in: &cancellables)
    }
    
    var canCreateTask: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        ((locationType == .customPlace && selectedPlace != nil) ||
         (locationType == .poiCategory))
    }
    
    func createTask(completion: @escaping (Bool) -> Void) {
        guard canCreateTask else {
            completion(false)
            return
        }
        
        isCreating = true
        
        let request = CreateTaskRequest(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : description.trimmingCharacters(in: .whitespacesAndNewlines),
            locationType: locationType,
            placeId: selectedPlace?.id,
            poiCategory: locationType == .poiCategory ? selectedPOICategory : nil,
            customRadii: customRadii
        )
        
        taskService.createTask(request)
        
        // Monitor for completion
        taskService.$isLoading
            .dropFirst()
            .sink { [weak self] isLoading in
                if !isLoading {
                    self?.isCreating = false
                    let success = self?.taskService.error == nil ?? false
                    
                    // Track analytics if task creation was successful
                    if success, let createdTask = self?.taskService.tasks.first {
                        Task {
                            await AnalyticsService.shared.trackTaskCreated(
                                taskId: createdTask.id,
                                locationType: request.locationType.rawValue,
                                placeId: request.placeId,
                                poiCategory: request.poiCategory?.rawValue,
                                hasDescription: request.description != nil
                            )
                        }
                    }
                    
                    completion(success)
                }
            }
            .store(in: &cancellables)
    }
    
    func reset() {
        title = ""
        description = ""
        locationType = .customPlace
        selectedPlace = nil
        selectedPOICategory = .gas
        customRadii = GeofenceRadii.default
        isCreating = false
        showingError = false
        errorMessage = ""
    }
}

// MARK: - Task Edit ViewModel
class TaskEditViewModel: ObservableObject {
    @Published var title: String
    @Published var description: String
    @Published var locationType: LocationType
    @Published var selectedPlace: Place?
    @Published var selectedPOICategory: POICategory
    @Published var customRadii: GeofenceRadii
    
    // UI State
    @Published var isUpdating = false
    @Published var showingLocationSelection = false
    @Published var showingPOISelection = false
    @Published var showingRadiusCustomization = false
    @Published var showingError = false
    @Published var errorMessage = ""
    
    private let task: Task
    private let taskService = TaskService.shared
    private var cancellables = Set<AnyCancellable>()
    
    init(task: Task) {
        self.task = task
        self.title = task.title
        self.description = task.description ?? ""
        self.locationType = task.locationType
        self.selectedPlace = nil // Would need to fetch place details
        self.selectedPOICategory = task.poiCategory ?? .gas
        self.customRadii = task.customRadii ?? GeofenceRadii.default
        
        // Listen for task service errors
        taskService.$error
            .compactMap { $0 }
            .sink { [weak self] error in
                self?.errorMessage = error.localizedDescription
                self?.showingError = true
                self?.isUpdating = false
            }
            .store(in: &cancellables)
    }
    
    var canUpdateTask: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        ((locationType == .customPlace && selectedPlace != nil) ||
         (locationType == .poiCategory)) &&
        hasChanges
    }
    
    var hasChanges: Bool {
        title != task.title ||
        description != (task.description ?? "") ||
        locationType != task.locationType ||
        selectedPlace?.id != task.placeId ||
        selectedPOICategory != task.poiCategory ||
        customRadii.approach != (task.customRadii?.approach ?? GeofenceRadii.default.approach) ||
        customRadii.arrival != (task.customRadii?.arrival ?? GeofenceRadii.default.arrival) ||
        customRadii.postArrival != (task.customRadii?.postArrival ?? GeofenceRadii.default.postArrival)
    }
    
    func updateTask(completion: @escaping (Bool) -> Void) {
        guard canUpdateTask else {
            completion(false)
            return
        }
        
        isUpdating = true
        
        let request = UpdateTaskRequest(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : description.trimmingCharacters(in: .whitespacesAndNewlines),
            locationType: locationType,
            placeId: selectedPlace?.id,
            poiCategory: locationType == .poiCategory ? selectedPOICategory : nil,
            customRadii: customRadii,
            status: nil
        )
        
        taskService.updateTask(id: task.id, request: request)
        
        // Monitor for completion
        taskService.$isLoading
            .dropFirst()
            .sink { [weak self] isLoading in
                if !isLoading {
                    self?.isUpdating = false
                    completion(self?.taskService.error == nil ?? false)
                }
            }
            .store(in: &cancellables)
    }
}

// MARK: - Task List ViewModel
class TaskListViewModel: ObservableObject {
    @Published var tasks: [Task] = []
    @Published var filters = TaskFilters()
    @Published var isLoading = false
    @Published var showingCreateTask = false
    @Published var showingFilters = false
    @Published var selectedTask: Task?
    @Published var showingTaskDetail = false
    @Published var showingError = false
    @Published var errorMessage = ""
    
    private let taskService = TaskService.shared
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        // Bind to task service
        taskService.$tasks
            .assign(to: \.tasks, on: self)
            .store(in: &cancellables)
        
        taskService.$isLoading
            .assign(to: \.isLoading, on: self)
            .store(in: &cancellables)
        
        taskService.$error
            .compactMap { $0 }
            .sink { [weak self] error in
                self?.errorMessage = error.localizedDescription
                self?.showingError = true
            }
            .store(in: &cancellables)
    }
    
    func loadTasks() {
        taskService.fetchTasks(filters: filters)
    }
    
    func refreshTasks() {
        taskService.fetchTasks(filters: filters)
    }
    
    func applyFilters() {
        taskService.fetchTasks(filters: filters)
    }
    
    func clearFilters() {
        filters.clear()
        taskService.fetchTasks(filters: filters)
    }
    
    func selectTask(_ task: Task) {
        selectedTask = task
        showingTaskDetail = true
    }
    
    func completeTask(_ task: Task) {
        taskService.completeTask(id: task.id)
    }
    
    func muteTask(_ task: Task) {
        taskService.muteTask(id: task.id)
    }
    
    func reactivateTask(_ task: Task) {
        taskService.reactivateTask(id: task.id)
    }
    
    func deleteTask(_ task: Task) {
        taskService.deleteTask(id: task.id)
    }
    
    func clearError() {
        taskService.clearError()
        showingError = false
        errorMessage = ""
    }
}

// MARK: - Place Selection ViewModel
class PlaceSelectionViewModel: ObservableObject {
    @Published var searchText = ""
    @Published var searchResults: [Place] = []
    @Published var isSearching = false
    @Published var showingMap = false
    @Published var selectedCoordinate: CLLocationCoordinate2D?
    @Published var selectedAddress = ""
    @Published var placeName = ""
    @Published var isCreatingPlace = false
    @Published var showingError = false
    @Published var errorMessage = ""
    
    private let locationSearchManager = LocationSearchManager()
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        // Bind to search manager
        locationSearchManager.$searchResults
            .assign(to: \.searchResults, on: self)
            .store(in: &cancellables)
        
        locationSearchManager.$isSearching
            .assign(to: \.isSearching, on: self)
            .store(in: &cancellables)
    }
    
    func searchForLocation() {
        guard !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        locationSearchManager.searchForLocation(query: searchText)
    }
    
    func createCustomPlace() -> Place? {
        guard let coordinate = selectedCoordinate,
              !placeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { 
            return nil
        }
        
        return Place(
            id: UUID().uuidString,
            userId: "current_user", // This would come from auth
            name: placeName.trimmingCharacters(in: .whitespacesAndNewlines),
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            address: selectedAddress.isEmpty ? nil : selectedAddress,
            placeType: .custom,
            defaultRadii: GeofenceRadii.default,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
    
    var canCreatePlace: Bool {
        selectedCoordinate != nil && !placeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}