import Foundation

// MARK: - Local Cache Keys
enum CacheKey: String {
    case tasks = "tasks.json"
    case places = "places.json"
    case metadata = "metadata.json"
}

struct CacheMetadata: Codable {
    var lastTaskSyncAt: Date?
    var lastPlaceSyncAt: Date?
}

// MARK: - LocalCache
final class LocalCache {
    static let shared = LocalCache()
    private init() {}

    private let ioQueue = DispatchQueue(label: "LocalCache.ioQueue", qos: .utility)

    private var baseDirectory: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let appDir = dir.appendingPathComponent("NearMeCache", isDirectory: true)
        try? FileManager.default.createDirectory(at: appDir, withIntermediateDirectories: true)
        return appDir
    }

    private func url(for key: CacheKey) -> URL {
        baseDirectory.appendingPathComponent(key.rawValue)
    }

    // Generic save/load
    func save<T: Codable>(_ value: T, for key: CacheKey) {
        ioQueue.async {
            do {
                let encoder = JSONEncoder()
                encoder.dateEncodingStrategy = .iso8601
                let data = try encoder.encode(value)
                try data.write(to: self.url(for: key), options: .atomic)
            } catch {
                print("LocalCache save error for \(key): \(error)")
            }
        }
    }

    func load<T: Codable>(_ type: T.Type, for key: CacheKey) -> T? {
        do {
            let data = try Data(contentsOf: url(for: key))
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            return try decoder.decode(T.self, from: data)
        } catch {
            return nil
        }
    }

    // Convenience
    func saveTasks(_ tasks: [Task]) {
        save(tasks, for: .tasks)
    }

    func loadTasks() -> [Task] {
        load([Task].self, for: .tasks) ?? []
    }

    func savePlaces(_ places: [Place]) {
        save(places, for: .places)
    }

    func loadPlaces() -> [Place] {
        load([Place].self, for: .places) ?? []
    }

    func updateMetadata(_ transform: (inout CacheMetadata) -> Void) {
        var meta = load(CacheMetadata.self, for: .metadata) ?? CacheMetadata()
        transform(&meta)
        save(meta, for: .metadata)
    }

    func getMetadata() -> CacheMetadata {
        load(CacheMetadata.self, for: .metadata) ?? CacheMetadata()
    }
}
