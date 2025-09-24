import Foundation
import Combine

final class SyncEngine {
    static let shared = SyncEngine()

    private var cancellables = Set<AnyCancellable>()
    private let cache = LocalCache.shared
    private let outbox = OutboxStore.shared

    private init() {
        OfflineManager.shared.$isOnline
            .removeDuplicates()
            .sink { [weak self] online in
                guard let self = self else { return }
                if online {
                    self.flushOutbox()
                    self.deltaSync()
                    // Also sync places when back online
                    PlaceService.shared.fetchPlaces()
                }
            }
            .store(in: &cancellables)
    }

    // MARK: - Delta Sync
    struct TaskListResponse: Codable {
        let tasks: [Task]
        let total: Int
        let page: Int
        let limit: Int
        let totalPages: Int?
    }

    struct APIResponse<T: Codable>: Codable {
        let success: Bool
        let data: T
        let message: String?
        let timestamp: String?
    }

    func deltaSync() {
        guard OfflineManager.shared.isOnline else { return }
        let meta = cache.getMetadata()
        let updatedSince = meta.lastTaskSyncAt

        var components = URLComponents(string: "http://localhost:3000/api/tasks")!
        var query: [URLQueryItem] = [
            URLQueryItem(name: "limit", value: "100")
        ]
        if let updatedSince = updatedSince {
            let iso = ISO8601DateFormatter().string(from: updatedSince)
            query.append(URLQueryItem(name: "updated_since", value: iso))
        }
        components.queryItems = query

        guard let url = components.url else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = UserDefaults.standard.string(forKey: "auth_token") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            if let data = data, let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) {
                do {
                    let decoder = JSONDecoder()
                    decoder.dateDecodingStrategy = .iso8601
                    let resp = try decoder.decode(APIResponse<TaskListResponse>.self, from: data)
                    if resp.success {
                        self.mergeTasks(resp.data.tasks)
                        self.cache.updateMetadata { meta in
                            meta.lastTaskSyncAt = Date()
                        }
                        DispatchQueue.main.async {
                            // Publish to TaskService
                            TaskService.shared.tasks = self.cache.loadTasks()
                        }
                    }
                } catch {
                    print("Delta sync decode error: \(error)")
                }
            }
        }.resume()
    }

    private func mergeTasks(_ updates: [Task]) {
        var current = cache.loadTasks()
        var indexById = Dictionary(uniqueKeysWithValues: current.enumerated().map { ($1.id, $0) })
        for t in updates {
            if let idx = indexById[t.id] {
                current[idx] = t
            } else {
                current.append(t)
                indexById[t.id] = current.count - 1
            }
        }
        cache.saveTasks(current)
    }

    // MARK: - Outbox
    func flushOutbox() {
        guard OfflineManager.shared.isOnline else { return }
        let batch = outbox.dequeueBatch(max: 20)
        guard !batch.isEmpty else { return }

        let group = DispatchGroup()
        var succeeded: [String] = []

        for op in batch {
            group.enter()
            perform(op) { success in
                if success { succeeded.append(op.id) }
                group.leave()
            }
        }

        group.notify(queue: .main) {
            if !succeeded.isEmpty {
                self.outbox.remove(ids: succeeded)
            }
        }
    }

    private func perform(_ op: OutboxOperation, completion: @escaping (Bool) -> Void) {
        guard let url = URL(string: "http://localhost:3000/api" + op.endpoint) else {
            completion(false); return
        }
        var req = URLRequest(url: url)
        req.httpMethod = op.method.rawValue
        req.httpBody = op.body
        for (k, v) in op.headers { req.setValue(v, forHTTPHeaderField: k) }

        URLSession.shared.dataTask(with: req) { _, response, error in
            if let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) {
                completion(true)
            } else {
                completion(false)
            }
        }.resume()
    }
}
