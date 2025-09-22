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
        
        do {
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.networkError(URLError(.badServerResponse))
            }
            
            // Handle HTTP status codes
            switch httpResponse.statusCode {
            case 200...299:
                break
            case 401:
                throw APIError.unauthorized
            case 400...499, 500...599:
                let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
                throw APIError.serverError(httpResponse.statusCode, errorMessage)
            default:
                throw APIError.networkError(URLError(.badServerResponse))
            }
            
            // Decode response
            do {
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }
            
        } catch {
            if error is APIError {
                throw error
            } else {
                throw APIError.networkError(error)
            }
        }
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