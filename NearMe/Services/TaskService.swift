import Foundation
import Combine

// MARK: - Task Service
class TaskService: ObservableObject {
    static let shared = TaskService()
    
    private let baseURL = "http://localhost:3000/api"
    private var cancellables = Set<AnyCancellable>()
    
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
    
    /// Fetch all tasks for the current user
    func fetchTasks(filters: TaskFilters = TaskFilters()) {
        isLoading = true
        error = nil
        
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
                        self?.tasks = response.data.tasks
                    } else {
                        self?.error = .serverError(response.message ?? "Unknown error")
                    }
                }
            )
            .store(in: &cancellables)
    }
    
    /// Create a new task
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
    
    /// Update an existing task
    func updateTask(id: String, request: UpdateTaskRequest) {
        isLoading = true
        error = nil
        
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
    
    /// Delete a task
    func deleteTask(id: String) {
        isLoading = true
        error = nil
        
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
}
