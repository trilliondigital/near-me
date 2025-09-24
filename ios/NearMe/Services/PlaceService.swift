import Foundation
import Combine

// MARK: - Place Service (iOS)
final class PlaceService: ObservableObject {
    static let shared = PlaceService()

    private let baseURL = "http://localhost:3000/api"
    private var cancellables = Set<AnyCancellable>()
    private let cache = LocalCache.shared
    private let offline = OfflineManager.shared
    private let outbox = OutboxStore.shared

    @Published var places: [Place] = []
    @Published var isLoading = false
    @Published var error: Error?

    private init() {}

    private struct APIResponse<T: Codable>: Codable {
        let success: Bool
        let data: T
        let message: String?
        let timestamp: String?
    }

    // MARK: - Fetch Places (uses cache when offline, supports delta)
    func fetchPlaces() {
        isLoading = true
        error = nil

        // Offline: serve from cache
        if !offline.isOnline {
            let cached = cache.loadPlaces()
            self.places = cached
            self.isLoading = false
            return
        }

        var urlComponents = URLComponents(string: "\(baseURL)/places")!
        var queryItems: [URLQueryItem] = []
        let meta = cache.getMetadata()
        if let updatedSince = meta.lastPlaceSyncAt {
            let iso = ISO8601DateFormatter().string(from: updatedSince)
            queryItems.append(URLQueryItem(name: "updated_since", value: iso))
        }
        urlComponents.queryItems = queryItems

        guard let url = urlComponents.url else {
            self.error = NSError(domain: "PlaceService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
            self.isLoading = false
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        if let token = UserDefaults.standard.string(forKey: "auth_token") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        URLSession.shared.dataTaskPublisher(for: request)
            .map(\.data)
            .decode(type: APIResponse<[Place]>.self, decoder: decoder)
            .receive(on: DispatchQueue.main)
            .sink(receiveCompletion: { [weak self] completion in
                guard let self = self else { return }
                self.isLoading = false
                if case .failure(let err) = completion {
                    // Fallback to cache on failure
                    self.places = self.cache.loadPlaces()
                    self.error = err
                }
            }, receiveValue: { [weak self] response in
                guard let self = self else { return }
                if response.success {
                    // Merge with cache (upsert by id)
                    let incoming = response.data
                    var current = self.cache.loadPlaces()
                    var indexById = Dictionary(uniqueKeysWithValues: current.enumerated().map { ($1.id, $0) })
                    for p in incoming {
                        if let idx = indexById[p.id] {
                            current[idx] = p
                        } else {
                            current.append(p)
                            indexById[p.id] = current.count - 1
                        }
                    }
                    self.cache.savePlaces(current)
                    self.cache.updateMetadata { meta in
                        meta.lastPlaceSyncAt = Date()
                    }
                    self.places = current
                } else {
                    self.error = NSError(domain: "PlaceService", code: -2, userInfo: [NSLocalizedDescriptionKey: response.message ?? "Unknown error"])
                }
            })
            .store(in: &cancellables)
    }

    // MARK: - Helper: Find cached place
    func getCachedPlace(by id: String) -> Place? {
        return cache.loadPlaces().first(where: { $0.id == id })
    }

    // MARK: - Outbox helpers for future mutations
    func enqueueCreatePlace(_ body: Codable) {
        do {
            let data = try JSONEncoder().encode(body)
            enqueueOutbox(endpoint: "/places", method: .POST, body: data)
        } catch {
            self.error = error
        }
    }

    func enqueueUpdatePlace(id: String, body: Codable) {
        do {
            let data = try JSONEncoder().encode(body)
            enqueueOutbox(endpoint: "/places/\(id)", method: .PUT, body: data)
        } catch {
            self.error = error
        }
    }

    func enqueueDeletePlace(id: String) {
        enqueueOutbox(endpoint: "/places/\(id)", method: .DELETE, body: nil)
    }

    private func enqueueOutbox(endpoint: String, method: OutboxOperation.Method, body: Data?) {
        var headers: [String: String] = ["Content-Type": "application/json", "Accept": "application/json"]
        if let token = UserDefaults.standard.string(forKey: "auth_token") {
            headers["Authorization"] = "Bearer \(token)"
        }
        let op = OutboxOperation(
            id: UUID().uuidString,
            endpoint: endpoint,
            method: method,
            body: body,
            headers: headers,
            createdAt: Date(),
            retryCount: 0
        )
        outbox.enqueue(op)
    }
}
