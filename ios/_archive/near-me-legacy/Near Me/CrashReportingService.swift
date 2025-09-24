//
//  CrashReportingService.swift
//  Near Me
//
//  Created by Kaegan Braud on 9/22/25.
//

import Foundation
import OSLog

/// A lightweight crash reporting stub.
///
/// Replace the internals of this service with your preferred crash reporting SDK
/// (e.g., Firebase Crashlytics, Sentry) and keep the same API so the rest of the
/// app doesn't need to change.
final class CrashReportingService {
    static let shared = CrashReportingService()

    private let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "Near_Me", category: "CrashReporting")

    private init() { }

    /// Perform crash reporting setup early in app launch.
    func setup() {
        // Placeholder setup. Add SDK initialization here if needed.
        logger.debug("CrashReportingService setup completed.")

        // If you integrate a real crash SDK, initialize it here.
        // Example (pseudocode):
        // Crashlytics.start()
        // SentrySDK.start { options in ... }
    }

    /// Record a non-fatal error for diagnostics.
    func record(error: Error, context: [String: String] = [:]) {
        let contextDescription = context.map { "\($0.key)=\($0.value)" }.joined(separator: ", ")
        logger.error("Recorded error: \(String(describing: error), privacy: .public) context: \(contextDescription, privacy: .public)")
    }
}
