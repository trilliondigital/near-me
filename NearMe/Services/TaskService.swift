import Foundation
import Combine

// MARK: - Task Service
class TaskService: ObservableObject {
    static let shared = TaskService()
    
    private let baseURL = "http://localhost:3000/api"
    private var cancellables = Set<AnyCancellable>()
    private let cache = LocalCache.shared
    private let offline = OfflineManager.shared
    private let outbox = OutboxStore.shared
    
    @Published var tasks: [Task] = []
    @Published var isLoading = false
    @Published var error: TaskServiceError?
    
    private init() {}
    
    // MARK: - API Response Models
    private struct APIResponse<T: Codable>: Codable {
        let success: Bool
        let data: T
        let message: String?
        let timestamp: String
    }
    
    private struct TaskListResponse: Codable {
        let tasks: [Task]
        let total: Int
        let page: Int
        let limit: Int
    }
    
    // MARK: - Error Handling
    enum TaskServiceError: LocalizedError {
        case networkError(String)
        case serverError(String)
        case validationError(String)
        case taskLimitExceeded
        case unauthorized
        case notFound
        case queuedOffline(String)
        
        var errorDescription: String? {
            switch self {
            case .networkError(let message):
                return "Network error: \(message)"
            case .serverError(let message):
                return "Server error: \(message)"
            case .validationError(let message):
                return "Validation error: \(message)"
            case .taskLimitExceeded:
                return "Free users are limited to 3 active tasks. Upgrade to premium for unlimited tasks."
            case .unauthorized:
                return "You are not authorized to perform this action"
            case .notFound:
                return "Task not found"
            case .queuedOffline(let msg):
                return msg
            }
        }
    }
    
    // MARK: - Authentication
    private func getAuthHeaders() -> [String: String] {
        guard let token = UserDefaults.standard.string(forKey: "auth_token") else {
            return [:]
        }
        return ["Authorization": "Bearer \(token)"]
    }
    
    // MARK: - Task CRUD Operations
    
    /// Fetch all tasks for the current user (uses cache when offline)
    func fetchTasks(filters: TaskFilters = TaskFilters()) {
        isLoading = true
        error = nil
        
        // Offline: serve from cache
        if !offline.isOnline {
            let cached = cache.loadTasks()
            self.tasks = cached
            self.isLoading = false
            return
        }

        var urlComponents = URLComponents(string: "\(baseURL)/tasks")!
        var queryItems: [URLQueryItem] = []
        
        if let status = filters.status {
            queryItems.append(URLQueryItem(name: "status", value: status.rawValue))
        }
        if let locationType = filters.locationType {
            queryItems.append(URLQueryItem(name: "location_type", value: locationType.rawValue))
        }
        if let poiCategory = filters.poiCategory {
            queryItems.append(URLQueryItem(name: "poi_category", value: poiCategory.rawValue))
        }
        if let updatedSince = filters.updatedSince {
            let iso = ISO8601DateFormatter().string(from: updatedSince)
            queryItems.append(URLQueryItem(name: "updated_since", value: iso))
        }
        queryItems.append(URLQueryItem(name: "page", value: String(filters.page)))
        queryItems.append(URLQueryItem(name: "limit", value: String(filters.limit)))
        
        urlComponents.queryItems = queryItems
        
        guard let url = urlComponents.url else {
            error = .networkError("Invalid URL")
            isLoading = false
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.allHTTPHeaderFields = getAuthHeaders()
        
        URLSession.shared.dataTaskPublisher(for: request)
            .map(\.data)
            .decode(type: APIResponse<TaskListResponse>.self, decoder: JSONDecoder())
            .handleEvents(receiveOutput: { [weak self] response in
                // Cache tasks and bump last sync timestamp
                guard let self = self else { return }
                if response.success {
                    self.cache.saveTasks(response.data.tasks)
                    self.cache.updateMetadata { meta in
                        meta.lastTaskSyncAt = Date()
                    }
                }
            })
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion {
                        // Fallback to cache on failure
                        let cached = self?.cache.loadTasks() ?? []
                        self?.tasks = cached
                        self?.error = .networkError(error.localizedDescription)
                    }
                },
                receiveValue: { [weak self] response in
                    if response.success {
                        self?.tasks = response.data.tasks
                    } else {
                        self?.error = .serverError(response.message ?? "Unknown error")
                    }
                }
            )
            .store(in: &cancellables)
    }
    
    /// Create a new task (queues when offline)
    func createTask(_ request: CreateTaskRequest) {
        isLoading = true
        error = nil
        
        // Check task limit before creating
        let userService = UserService.shared
        if let taskLimit = userService.taskLimitStatus, taskLimit.isAtLimit {
            error = .taskLimitExceeded
            isLoading = false
            return
        }
        // If offline, queue operation and return
        if !offline.isOnline {
            do {
                let body = try JSONEncoder().encode(request)
                enqueueOutbox(endpoint: "/tasks", method: .POST, body: body)
                self.error = .queuedOffline("Task creation queued – will sync when online")
            } catch {
                self.error = .validationError("Failed to encode request")
            }
            self.isLoading = false
            return
        }

        guard let url = URL(string: "\(baseURL)/tasks") else {
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
            error = .validationError("Failed to encode request")
            isLoading = false
            return
        }
        
        URLSession.shared.dataTaskPublisher(for: urlRequest)
            .map(\.data)
            .decode(type: APIResponse<Task>.self, decoder: JSONDecoder())
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion {
                        self?.error = .networkError(error.localizedDescription)
                    }
                },
                receiveValue: { [weak self] response in
                    if response.success {
                        self?.tasks.insert(response.data, at: 0)
                        // Update user service task limit status
                        UserService.shared.checkTaskLimit()
                            .sink(receiveCompletion: { _ in }, receiveValue: { status in
                                UserService.shared.taskLimitStatus = status
                            })
                            .store(in: &self?.cancellables ?? Set<AnyCancellable>())
                        // Refresh tasks to get updated list
                        self?.fetchTasks()
                    } else {
                        if response.message?.contains("limit") == true {
                            self?.error = .taskLimitExceeded
                        } else {
                            self?.error = .serverError(response.message ?? "Unknown error")
                        }
                    }
                }
            )
            .store(in: &cancellables)
    }
    
    /// Update an existing task (queues when offline, optimistic local update)
    func updateTask(id: String, request: UpdateTaskRequest) {
        isLoading = true
        error = nil
        
        if !offline.isOnline {
            do {
                let body = try JSONEncoder().encode(request)
                enqueueOutbox(endpoint: "/tasks/\(id)", method: .PUT, body: body)
                // Optimistically update local cache and published tasks
                var current = cache.loadTasks()
                if let idx = current.firstIndex(where: { $0.id == id }) {
                    // Build a patched Task locally with minimal fields
                    var t = current[idx]
                    if let title = request.title { t = Task(id: t.id, userId: t.userId, title: title, description: t.description, locationType: t.locationType, placeId: t.placeId, poiCategory: t.poiCategory, customRadii: t.customRadii, status: t.status, createdAt: t.createdAt, completedAt: t.completedAt, updatedAt: Date()) }
                    if let status = request.status { t = Task(id: t.id, userId: t.userId, title: t.title, description: t.description, locationType: t.locationType, placeId: t.placeId, poiCategory: t.poiCategory, customRadii: t.customRadii, status: status, createdAt: t.createdAt, completedAt: t.completedAt, updatedAt: Date()) }
                    current[idx] = t
                    cache.saveTasks(current)
                    DispatchQueue.main.async { self.tasks = current }
                }
                self.error = .queuedOffline("Task update queued – will sync when online")
            } catch {
                self.error = .validationError("Failed to encode request")
            }
            self.isLoading = false
            return
        }

        guard let url = URL(string: "\(baseURL)/tasks/\(id)") else {
            error = .networkError("Invalid URL")
            isLoading = false
            return
        }
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "PUT"
        urlRequest.allHTTPHeaderFields = getAuthHeaders()
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        do {
            urlRequest.httpBody = try JSONEncoder().encode(request)
        } catch {
            error = .validationError("Failed to encode request")
            isLoading = false
            return
        }
        
        URLSession.shared.dataTaskPublisher(for: urlRequest)
            .map(\.data)
            .decode(type: APIResponse<Task>.self, decoder: JSONDecoder())
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion {
                        self?.error = .networkError(error.localizedDescription)
                    }
                },
                receiveValue: { [weak self] response in
                    if response.success {
                        // Update the task in the local array
                        if let index = self?.tasks.firstIndex(where: { $0.id == id }) {
                            self?.tasks[index] = response.data
                        }
                    } else {
                        self?.error = .serverError(response.message ?? "Unknown error")
                    }
                }
            )
            .store(in: &cancellables)
    }
    
    /// Complete a task
    func completeTask(id: String) {
        let request = UpdateTaskRequest(
            title: nil,
            description: nil,
            locationType: nil,
            placeId: nil,
            poiCategory: nil,
            customRadii: nil,
            status: .completed
        )
        updateTask(id: id, request: request)
    }
    
    /// Mute a task
    func muteTask(id: String) {
        let request = UpdateTaskRequest(
            title: nil,
            description: nil,
            locationType: nil,
            placeId: nil,
            poiCategory: nil,
            customRadii: nil,
            status: .muted
        )
        updateTask(id: id, request: request)
    }
    
    /// Reactivate a task
    func reactivateTask(id: String) {
        let request = UpdateTaskRequest(
            title: nil,
            description: nil,
            locationType: nil,
            placeId: nil,
            poiCategory: nil,
            customRadii: nil,
            status: .active
        )
        updateTask(id: id, request: request)
    }
    
    /// Delete a task (queues when offline, optimistic local delete)
    func deleteTask(id: String) {
        isLoading = true
        error = nil
        
        if !offline.isOnline {
            enqueueOutbox(endpoint: "/tasks/\(id)", method: .DELETE, body: nil)
            // Optimistically remove from cache and published list
            var current = cache.loadTasks()
            current.removeAll { $0.id == id }
            cache.saveTasks(current)
            DispatchQueue.main.async { self.tasks = current }
            self.error = .queuedOffline("Task deletion queued – will sync when online")
            self.isLoading = false
            return
        }

        guard let url = URL(string: "\(baseURL)/tasks/\(id)") else {
            error = .networkError("Invalid URL")
            isLoading = false
            return
        }
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "DELETE"
        urlRequest.allHTTPHeaderFields = getAuthHeaders()
        
        URLSession.shared.dataTaskPublisher(for: urlRequest)
            .map(\.data)
            .decode(type: APIResponse<[String: String]>.self, decoder: JSONDecoder())
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion {
                        self?.error = .networkError(error.localizedDescription)
                    }
                },
                receiveValue: { [weak self] response in
                    if response.success {
                        // Remove the task from the local array
                        self?.tasks.removeAll { $0.id == id }
                    } else {
                        self?.error = .serverError(response.message ?? "Unknown error")
                    }
                }
            )
            .store(in: &cancellables)
    }
    
    /// Get task statistics
    func fetchTaskStats() -> AnyPublisher<TaskStats, TaskServiceError> {
        guard let url = URL(string: "\(baseURL)/tasks/stats") else {
            return Fail(error: .networkError("Invalid URL"))
                .eraseToAnyPublisher()
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.allHTTPHeaderFields = getAuthHeaders()
        
        return URLSession.shared.dataTaskPublisher(for: request)
            .map(\.data)
            .decode(type: APIResponse<TaskStats>.self, decoder: JSONDecoder())
            .map { response in
                if response.success {
                    return response.data
                } else {
                    throw TaskServiceError.serverError(response.message ?? "Unknown error")
                }
            }
            .mapError { error in
                if let taskError = error as? TaskServiceError {
                    return taskError
                } else {
                    return .networkError(error.localizedDescription)
                }
            }
            .receive(on: DispatchQueue.main)
            .eraseToAnyPublisher()
    }
    
    /// Clear error state
    func clearError() {
        error = nil
    }

    // MARK: - Outbox helper
    private func enqueueOutbox(endpoint: String, method: OutboxOperation.Method, body: Data?) {
        var headers: [String: String] = ["Content-Type": "application/json", "Accept": "application/json"]
        getAuthHeaders().forEach { headers[$0.key] = $0.value }
        let op = OutboxOperation(
            id: UUID().uuidString,
            endpoint: endpoint,
            method: method,
            body: body,
            headers: headers,
            createdAt: Date(),
            retryCount: 0
        )
        outbox.enqueue(op)
    }
}
