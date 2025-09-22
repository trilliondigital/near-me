import Foundation

struct OutboxOperation: Codable, Identifiable {
    enum Method: String, Codable { case GET, POST, PUT, DELETE }

    let id: String
    let endpoint: String
    let method: Method
    let body: Data?
    let headers: [String: String]
    let createdAt: Date
    var retryCount: Int
}

final class OutboxStore {
    static let shared = OutboxStore()
    private init() { load() }

    private let fileName = "outbox.json"
    private var ops: [OutboxOperation] = []
    private let queue = DispatchQueue(label: "OutboxStore.queue", qos: .utility)

    private var fileURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let appDir = dir.appendingPathComponent("NearMeCache", isDirectory: true)
        try? FileManager.default.createDirectory(at: appDir, withIntermediateDirectories: true)
        return appDir.appendingPathComponent(fileName)
    }

    func enqueue(_ op: OutboxOperation) {
        queue.async {
            self.ops.append(op)
            self.persist()
        }
    }

    func dequeueBatch(max: Int = 20) -> [OutboxOperation] {
        var batch: [OutboxOperation] = []
        queue.sync {
            batch = Array(self.ops.prefix(max))
        }
        return batch
    }

    func remove(ids: [String]) {
        queue.async {
            let idSet = Set(ids)
            self.ops.removeAll { idSet.contains($0.id) }
            self.persist()
        }
    }

    func update(_ op: OutboxOperation) {
        queue.async {
            if let idx = self.ops.firstIndex(where: { $0.id == op.id }) {
                self.ops[idx] = op
                self.persist()
            }
        }
    }

    private func persist() {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(ops)
            try data.write(to: fileURL, options: .atomic)
        } catch {
            print("OutboxStore persist error: \(error)")
        }
    }

    private func load() {
        do {
            let data = try Data(contentsOf: fileURL)
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            ops = try decoder.decode([OutboxOperation].self, from: data)
        } catch {
            ops = []
        }
    }
}
