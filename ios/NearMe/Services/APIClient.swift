import Foundation

class APIClient {
    static let shared = APIClient()
    
    private let baseURL: String
    private let session: URLSession
    
    enum HTTPMethod: String {
        case GET = "GET"
        case POST = "POST"
        case PUT = "PUT"
        case DELETE = "DELETE"
    }
    
    enum APIError: LocalizedError {
        case invalidURL
        case noData
        case decodingError(Error)
        case networkError(Error)
        case serverError(Int, String)
        case rateLimited(retryAfter: Int?)
        case unauthorized
        
        var errorDescription: String? {
            switch self {
            case .invalidURL:
                return "Invalid URL"
            case .noData:
                return "No data received"
            case .decodingError(let error):
                return "Decoding error: \(error.localizedDescription)"
            case .networkError(let error):
                return "Network error: \(error.localizedDescription)"
            case .serverError(let code, let message):
                return "Server error (\(code)): \(message)"
            case .rateLimited(let retryAfter):
                if let retryAfter = retryAfter { return "Rate limited. Retry after \(retryAfter)s" }
                return "Rate limited. Please try again shortly"
            case .unauthorized:
                return "Unauthorized access"
            }
        }
    }
    
    private init() {
        self.baseURL = "http://localhost:3000/api"
        
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        self.session = URLSession(configuration: config)
    }
    
    struct APIErrorEnvelope: Codable {
        struct ErrorDetail: Codable {
            let code: String
            let message: String
            let timestamp: String?
            let requestId: String?
            let retryAfter: Int?
        }
        let error: ErrorDetail
    }
    
    func request<T: Codable>(
        endpoint: String,
        method: HTTPMethod,
        body: Codable? = nil,
        headers: [String: String]? = nil
    ) async throws -> T {
        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        
        // Add default headers
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        
        // Add auth headers if available
        if let authHeaders = getAuthHeaders() {
            for (key, value) in authHeaders {
                request.setValue(value, forHTTPHeaderField: key)
            }
        }
        
        // Add custom headers
        if let headers = headers {
            for (key, value) in headers {
                request.setValue(value, forHTTPHeaderField: key)
            }
        }
        
        // Add body if provided
        if let body = body {
            do {
                let encoder = JSONEncoder()
                encoder.dateEncodingStrategy = .iso8601
                request.httpBody = try encoder.encode(body)
            } catch {
                throw APIError.decodingError(error)
            }
        }
        
        // Retry with exponential backoff for transient errors
        let maxAttempts = 3
        var attempt = 0
        var lastError: Error?
        
        while attempt < maxAttempts {
            do {
                let (data, response) = try await session.data(for: request)
                guard let httpResponse = response as? HTTPURLResponse else {
                    throw APIError.networkError(URLError(.badServerResponse))
                }
                
                switch httpResponse.statusCode {
                case 200...299:
                    // Decode response
                    do {
                        let decoder = JSONDecoder()
                        decoder.dateDecodingStrategy = .iso8601
                        return try decoder.decode(T.self, from: data)
                    } catch {
                        throw APIError.decodingError(error)
                    }
                case 401:
                    throw APIError.unauthorized
                case 429:
                    // Try to parse retryAfter from headers or body
                    let retryAfterHeader = httpResponse.value(forHTTPHeaderField: "Retry-After")
                    let retryAfter = Int(retryAfterHeader ?? "") ?? (try? JSONDecoder().decode(APIErrorEnvelope.self, from: data).error.retryAfter) ?? nil
                    throw APIError.rateLimited(retryAfter: retryAfter)
                case 400...499, 500...599:
                    // Attempt to parse standardized error
                    if let envelope = try? JSONDecoder().decode(APIErrorEnvelope.self, from: data) {
                        throw APIError.serverError(httpResponse.statusCode, envelope.error.message)
                    } else {
                        let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
                        throw APIError.serverError(httpResponse.statusCode, errorMessage)
                    }
                default:
                    throw APIError.networkError(URLError(.badServerResponse))
                }
            } catch {
                lastError = error
                attempt += 1
                // Decide if we should retry
                let shouldRetry: Bool
                var suggestedDelay: UInt64 = 0
                if let apiError = error as? APIError {
                    switch apiError {
                    case .rateLimited(let retryAfter):
                        shouldRetry = true
                        if let retryAfter = retryAfter { suggestedDelay = UInt64(max(retryAfter, 1)) * 1_000_000_000 }
                    case .serverError(let status, _):
                        shouldRetry = (500...599).contains(status)
                    case .networkError:
                        shouldRetry = true
                    default:
                        shouldRetry = false
                    }
                } else {
                    shouldRetry = true
                }
                
                if attempt >= maxAttempts || !shouldRetry {
                    throw error
                }
                
                // Exponential backoff with jitter
                let baseDelay: UInt64 = suggestedDelay > 0 ? suggestedDelay : UInt64(pow(2.0, Double(attempt - 1)) * 0.5 * 1_000_000_000)
                let jitter = UInt64.random(in: 0..<(100_000_000)) // up to 100ms
                try? await Task.sleep(nanoseconds: baseDelay + jitter)
            }
        }
        throw lastError ?? APIError.networkError(URLError(.unknown))
    }
    
    private func getAuthHeaders() -> [String: String]? {
        // Get auth token from UserDefaults or Keychain
        guard let token = UserDefaults.standard.string(forKey: "auth_token") else {
            return nil
        }
        
        return ["Authorization": "Bearer \(token)"]
    }
}

// MARK: - Response Wrapper

struct APIResponse<T: Codable>: Codable {
    let data: T?
    let message: String?
    let error: String?
    
    init(data: T? = nil, message: String? = nil, error: String? = nil) {
        self.data = data
        self.message = message
        self.error = error
    }
}

// MARK: - Convenience Extensions

extension APIClient {
    func get<T: Codable>(_ endpoint: String, headers: [String: String]? = nil) async throws -> T {
        return try await request(endpoint: endpoint, method: .GET, headers: headers)
    }
    
    func post<T: Codable>(_ endpoint: String, body: Codable? = nil, headers: [String: String]? = nil) async throws -> T {
        return try await request(endpoint: endpoint, method: .POST, body: body, headers: headers)
    }
    
    func put<T: Codable>(_ endpoint: String, body: Codable? = nil, headers: [String: String]? = nil) async throws -> T {
        return try await request(endpoint: endpoint, method: .PUT, body: body, headers: headers)
    }
    
    func delete<T: Codable>(_ endpoint: String, headers: [String: String]? = nil) async throws -> T {
        return try await request(endpoint: endpoint, method: .DELETE, headers: headers)
    }
}