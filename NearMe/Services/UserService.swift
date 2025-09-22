import Foundation
import Combine

// MARK: - User Service
class UserService: ObservableObject {
    static let shared = UserService()
    
    private let baseURL = "http://localhost:3000/api"
    private var cancellables = Set<AnyCancellable>()
    
    @Published var currentUser: User?
    @Published var taskLimitStatus: TaskLimitStatus?
    @Published var isLoading = false
    @Published var error: UserServiceError?
    
    private init() {
        loadCachedUser()
    }
    
    // MARK: - API Response Models
    private struct APIResponse<T: Codable>: Codable {
        let success: Bool
        let data: T
        let message: String?
        let timestamp: String
    }
    
    // MARK: - Error Handling
    enum UserServiceError: LocalizedError {
        case networkError(String)
        case serverError(String)
        case validationError(String)
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
            case .unauthorized:
                return "You are not authorized to perform this action"
            case .notFound:
                return "User not found"
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
    
    // MARK: - User Management
    
    /// Fetch current user profile
    func fetchCurrentUser() {
        isLoading = true
        error = nil
        
        guard let url = URL(string: "\(baseURL)/user/profile") else {
            error = .networkError("Invalid URL")
            isLoading = false
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.allHTTPHeaderFields = getAuthHeaders()
        
        URLSession.shared.dataTaskPublisher(for: request)
            .map(\.data)
            .decode(type: APIResponse<User>.self, decoder: JSONDecoder())
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
                        self?.currentUser = response.data
                        self?.cacheUser(response.data)
                        self?.updateTaskLimitStatus()
                    } else {
                        self?.error = .serverError(response.message ?? "Unknown error")
                    }
                }
            )
            .store(in: &cancellables)
    }
    
    /// Update user preferences
    func updateUser(_ request: UpdateUserRequest) {
        isLoading = true
        error = nil
        
        guard let url = URL(string: "\(baseURL)/user/profile") else {
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
            .decode(type: APIResponse<User>.self, decoder: JSONDecoder())
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
                        self?.currentUser = response.data
                        self?.cacheUser(response.data)
                        self?.updateTaskLimitStatus()
                    } else {
                        self?.error = .serverError(response.message ?? "Unknown error")
                    }
                }
            )
            .store(in: &cancellables)
    }
    
    /// Check if user can create more tasks
    func checkTaskLimit() -> AnyPublisher<TaskLimitStatus, UserServiceError> {
        guard let url = URL(string: "\(baseURL)/user/task-limit") else {
            return Fail(error: .networkError("Invalid URL"))
                .eraseToAnyPublisher()
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.allHTTPHeaderFields = getAuthHeaders()
        
        return URLSession.shared.dataTaskPublisher(for: request)
            .map(\.data)
            .decode(type: APIResponse<TaskLimitStatus>.self, decoder: JSONDecoder())
            .map { response in
                if response.success {
                    return response.data
                } else {
                    throw UserServiceError.serverError(response.message ?? "Unknown error")
                }
            }
            .mapError { error in
                if let userError = error as? UserServiceError {
                    return userError
                } else {
                    return .networkError(error.localizedDescription)
                }
            }
            .receive(on: DispatchQueue.main)
            .eraseToAnyPublisher()
    }
    
    /// Start premium trial
    func startTrial() {
        isLoading = true
        error = nil
        
        guard let url = URL(string: "\(baseURL)/user/start-trial") else {
            error = .networkError("Invalid URL")
            isLoading = false
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.allHTTPHeaderFields = getAuthHeaders()
        
        URLSession.shared.dataTaskPublisher(for: request)
            .map(\.data)
            .decode(type: APIResponse<User>.self, decoder: JSONDecoder())
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
                        self?.currentUser = response.data
                        self?.cacheUser(response.data)
                        self?.updateTaskLimitStatus()
                    } else {
                        self?.error = .serverError(response.message ?? "Unknown error")
                    }
                }
            )
            .store(in: &cancellables)
    }
    
    /// Check if feature is available for current user
    func hasFeature(_ feature: PremiumFeature) -> Bool {
        guard let user = currentUser else { return false }
        
        switch feature {
        case .unlimitedTasks:
            return user.isPremium
        case .customNotificationSounds:
            return user.isPremium
        case .detailedNotifications:
            return user.isPremium
        case .advancedGeofencing:
            return user.isPremium
        case .prioritySupport:
            return user.isPremium
        case .exportData:
            return user.isPremium
        }
    }
    
    /// Get premium features list
    func getPremiumFeatures() -> [PremiumFeature] {
        return PremiumFeature.allCases
    }
    
    /// Update task limit status
    private func updateTaskLimitStatus() {
        checkTaskLimit()
            .sink(
                receiveCompletion: { [weak self] completion in
                    if case .failure(let error) = completion {
                        print("Failed to update task limit status: \(error)")
                    }
                },
                receiveValue: { [weak self] status in
                    self?.taskLimitStatus = status
                }
            )
            .store(in: &cancellables)
    }
    
    // MARK: - Caching
    
    private func cacheUser(_ user: User) {
        if let encoded = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(encoded, forKey: "cached_user")
        }
    }
    
    private func loadCachedUser() {
        guard let data = UserDefaults.standard.data(forKey: "cached_user"),
              let user = try? JSONDecoder().decode(User.self, from: data) else {
            return
        }
        
        currentUser = user
        updateTaskLimitStatus()
    }
    
    /// Clear error state
    func clearError() {
        error = nil
    }
    
    /// Clear cached data
    func clearCache() {
        UserDefaults.standard.removeObject(forKey: "cached_user")
        currentUser = nil
        taskLimitStatus = nil
    }
}