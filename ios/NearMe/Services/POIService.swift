import Foundation
import CoreLocation
import Combine

// MARK: - POI Service (iOS)
final class POIService: ObservableObject {
    static let shared = POIService()

    private let baseURL = "http://localhost:3000/api"
    private let cache = LocalCache.shared
    private let offline = OfflineManager.shared

    @Published var pois: [POI] = []
    @Published var isLoading = false
    @Published var error: Error?

    private var cancellables = Set<AnyCancellable>()

    private init() {}

    private struct APIResponse<T: Codable>: Codable {
        let success: Bool
        let data: T
        let message: String?
    }

    // MARK: - Fetch Nearby POIs
    func fetchNearby(coordinate: CLLocationCoordinate2D, radiusMiles: Double = 10, categoryRaw: String? = nil, limit: Int = 50) {
        isLoading = true
        error = nil

        // If offline, serve cached
        if !offline.isOnline {
            self.pois = cache.loadPOIs()
            self.isLoading = false
            return
        }

        var components: URLComponents
        if let category = categoryRaw, !category.isEmpty {
            components = URLComponents(string: "\(baseURL)/pois/category/\(category)")!
        } else {
            components = URLComponents(string: "\(baseURL)/pois/search")!
        }

        components.queryItems = [
            URLQueryItem(name: "latitude", value: String(coordinate.latitude)),
            URLQueryItem(name: "longitude", value: String(coordinate.longitude)),
            URLQueryItem(name: "radius", value: String(radiusMiles)),
            URLQueryItem(name: "limit", value: String(limit))
        ]
        if categoryRaw != nil && components.path.hasSuffix("/search") {
            components.queryItems?.append(URLQueryItem(name: "category", value: categoryRaw))
        }

        guard let url = components.url else {
            self.error = NSError(domain: "POIService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
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
            .decode(type: APIResponse<[POI]>.self, decoder: decoder)
            .receive(on: DispatchQueue.main)
            .sink(receiveCompletion: { [weak self] completion in
                guard let self = self else { return }
                self.isLoading = false
                if case .failure(let err) = completion {
                    self.pois = self.cache.loadPOIs()
                    self.error = err
                }
            }, receiveValue: { [weak self] response in
                guard let self = self else { return }
                if response.success {
                    // Merge with cache by id
                    let incoming = response.data
                    var current = self.cache.loadPOIs()
                    var indexById = Dictionary(uniqueKeysWithValues: current.enumerated().map { ($1.id, $0) })
                    for p in incoming {
                        if let idx = indexById[p.id] {
                            current[idx] = p
                        } else {
                            current.append(p)
                            indexById[p.id] = current.count - 1
                        }
                    }
                    self.cache.savePOIs(current)
                    self.cache.updateMetadata { meta in
                        meta.lastPOISyncAt = Date()
                    }
                    self.pois = current
                } else {
                    self.error = NSError(domain: "POIService", code: -2, userInfo: [NSLocalizedDescriptionKey: response.message ?? "Unknown error"])
                }
            })
            .store(in: &cancellables)
    }

    // MARK: - Cache access
    func getCachedPOIs(categoryRaw: String? = nil) -> [POI] {
        let all = cache.loadPOIs()
        guard let categoryRaw = categoryRaw, !categoryRaw.isEmpty else { return all }
        return all.filter { $0.category.rawValue == categoryRaw }
    }
}
