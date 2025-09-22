import Foundation
import UIKit

// Simple crash reporting service that captures uncaught exceptions/signals and
// sends a crash report to the backend on next launch.
final class CrashReportingService {
    static let shared = CrashReportingService()

    private let crashFlagKey = "nm_last_crash_payload"

    private init() {}

    // MARK: - Setup
    func setup() {
        // Install uncaught exception handler (Objective-C exceptions)
        NSSetUncaughtExceptionHandler { exception in
            let payload: [String: Any] = [
                "crashType": "uncaught_exception",
                "name": exception.name.rawValue,
                "reason": exception.reason ?? "unknown",
                "stackTrace": exception.callStackSymbols.joined(separator: "\n")
            ]
            self.persistCrashPayload(payload)
        }

        // Install basic signal handlers (best-effort)
        signal(SIGABRT) { _ in self.persistCrashPayload(["crashType": "SIGABRT"]) }
        signal(SIGSEGV) { _ in self.persistCrashPayload(["crashType": "SIGSEGV"]) }
        signal(SIGILL)  { _ in self.persistCrashPayload(["crashType": "SIGILL"]) }
        signal(SIGFPE)  { _ in self.persistCrashPayload(["crashType": "SIGFPE"]) }

        // Attempt to send any pending crash report from previous run
        Task { await self.sendPendingCrashReportIfAny() }
    }

    // MARK: - Persistence
    private func persistCrashPayload(_ payload: [String: Any]) {
        do {
            let data = try JSONSerialization.data(withJSONObject: payload, options: [])
            UserDefaults.standard.set(data, forKey: crashFlagKey)
        } catch {
            // Ignore
        }
    }

    private func loadCrashPayload() -> [String: Any]? {
        guard let data = UserDefaults.standard.data(forKey: crashFlagKey) else { return nil }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return json
    }

    private func clearCrashPayload() {
        UserDefaults.standard.removeObject(forKey: crashFlagKey)
    }

    // MARK: - Send
    private func getDeviceId() async -> String {
        if let id = UIDevice.current.identifierForVendor?.uuidString { return id }
        return UUID().uuidString
    }

    private var appVersion: String {
        Bundle.main.infoDictionary?[("CFBundleShortVersionString")] as? String ?? "1.0.0"
    }

    @MainActor
    private func sendPendingCrashReportIfAny() async {
        guard let payload = loadCrashPayload() else { return }
        defer { clearCrashPayload() }

        let deviceId = await getDeviceId()
        let crashType = payload["crashType"] as? String ?? "unknown"
        let stackTrace = payload["stackTrace"] as? String

        struct CrashBody: Codable {
            let platform: String
            let appVersion: String
            let deviceId: String
            let crashType: String
            let stackTrace: String?
            let userActions: [String]?
        }

        let body = CrashBody(
            platform: "ios",
            appVersion: appVersion,
            deviceId: deviceId,
            crashType: crashType,
            stackTrace: stackTrace,
            userActions: nil
        )

        do {
            let _: APIResponse<[String: String]> = try await APIClient.shared.post("/performance/crash-report", body: body)
            print("📉 Crash report sent")
        } catch {
            // Keep payload for retry next launch
            persistCrashPayload(payload)
            print("❌ Failed to send crash report: \(error)")
        }
    }
}
