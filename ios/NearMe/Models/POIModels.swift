import Foundation
import CoreLocation

// MARK: - POI Model (iOS)
struct POI: Identifiable, Codable {
    let id: String
    let externalId: String?
    let name: String
    let category: String
    let latitude: Double
    let longitude: Double
    let address: String?
    let verified: Bool
    let source: String
    let lastUpdated: Date

    enum CodingKeys: String, CodingKey {
        case id
        case externalId = "externalId"
        case name
        case category
        case latitude
        case longitude
        case address
        case verified
        case source
        case lastUpdated = "lastUpdated"
    }

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}
