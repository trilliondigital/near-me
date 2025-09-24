import Foundation
import Network
import Combine

// MARK: - OfflineManager
final class OfflineManager: ObservableObject {
    static let shared = OfflineManager()

    @Published private(set) var isOnline: Bool = true

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "OfflineManager.network")

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            DispatchQueue.main.async {
                self?.isOnline = online
            }
        }
        monitor.start(queue: queue)
    }
}
