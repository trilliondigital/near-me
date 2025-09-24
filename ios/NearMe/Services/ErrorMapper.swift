import Foundation

struct UserFriendlyError {
    let title: String
    let message: String
    let recoverySuggestions: [String]
}

enum ErrorMapper {
    static func map(_ error: Error) -> UserFriendlyError {
        if let apiError = error as? APIClient.APIError {
            switch apiError {
            case .unauthorized:
                return UserFriendlyError(
                    title: "Sign In Required",
                    message: "Your session has expired or is invalid.",
                    recoverySuggestions: [
                        "Sign in again",
                        "If the issue persists, try restarting the app"
                    ]
                )
            case .rateLimited(let retryAfter):
                let after = retryAfter != nil ? " in \(retryAfter!)s" : " shortly"
                return UserFriendlyError(
                    title: "Too Many Requests",
                    message: "You're doing that too quickly. Please try again\(after).",
                    recoverySuggestions: [
                        "Wait and try again",
                        "Reduce repeated actions"
                    ]
                )
            case .serverError(_, let message):
                return UserFriendlyError(
                    title: "Server Error",
                    message: message,
                    recoverySuggestions: [
                        "Try again in a moment",
                        "Check your internet connection"
                    ]
                )
            case .networkError:
                return UserFriendlyError(
                    title: "Network Issue",
                    message: "We couldn't reach the server.",
                    recoverySuggestions: [
                        "Check your internet connection",
                        "Try again"
                    ]
                )
            case .decodingError:
                return UserFriendlyError(
                    title: "Unexpected Response",
                    message: "We received an unexpected response.",
                    recoverySuggestions: [
                        "Try again",
                        "Update the app if the problem continues"
                    ]
                )
            case .invalidURL, .noData:
                return UserFriendlyError(
                    title: "Request Error",
                    message: "There was an issue forming the request.",
                    recoverySuggestions: [
                        "Try again"
                    ]
                )
            }
        }
        // Fallback
        return UserFriendlyError(
            title: "Something Went Wrong",
            message: error.localizedDescription,
            recoverySuggestions: ["Try again"]
        )
    }
}
