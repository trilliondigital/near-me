import Foundation
import CoreLocation

// MARK: - Task Models
struct Task: Identifiable, Codable {
    let id: String
    let userId: String
    let title: String
    let description: String?
    let locationType: LocationType
    let placeId: String?
    let poiCategory: POICategory?
    let customRadii: GeofenceRadii?
    let status: TaskStatus
    let createdAt: Date
    let completedAt: Date?
    let updatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case title
        case description
        case locationType = "location_type"
        case placeId = "place_id"
        case poiCategory = "poi_category"
        case customRadii = "custom_radii"
        case status
        case createdAt = "created_at"
        case completedAt = "completed_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - Task Status
enum TaskStatus: String, CaseIterable, Codable {
    case active = "active"
    case completed = "completed"
    case muted = "muted"
    
    var displayName: String {
        switch self {
        case .active: return "Active"
        case .completed: return "Completed"
        case .muted: return "Muted"
        }
    }
    
    var color: String {
        switch self {
        case .active: return "Primary"
        case .completed: return "Success"
        case .muted: return "Warning"
        }
    }
}

// MARK: - Location Type
enum LocationType: String, CaseIterable, Codable {
    case customPlace = "custom_place"
    case poiCategory = "poi_category"
    
    var displayName: String {
        switch self {
        case .customPlace: return "Custom Place"
        case .poiCategory: return "POI Category"
        }
    }
}

// MARK: - POI Category
enum POICategory: String, CaseIterable, Codable {
    case gas = "gas"
    case pharmacy = "pharmacy"
    case grocery = "grocery"
    case bank = "bank"
    case postOffice = "post_office"
    
    var displayName: String {
        switch self {
        case .gas: return "Gas Station"
        case .pharmacy: return "Pharmacy"
        case .grocery: return "Grocery Store"
        case .bank: return "Bank"
        case .postOffice: return "Post Office"
        }
    }
    
    var icon: String {
        switch self {
        case .gas: return "fuelpump.fill"
        case .pharmacy: return "cross.fill"
        case .grocery: return "cart.fill"
        case .bank: return "building.columns.fill"
        case .postOffice: return "envelope.fill"
        }
    }
    
    var defaultApproachRadius: Double {
        switch self {
        case .gas: return 3.0 // 3 miles
        case .pharmacy: return 1.0 // 1 mile
        case .grocery: return 1.0 // 1 mile
        case .bank: return 1.0 // 1 mile
        case .postOffice: return 1.0 // 1 mile
        }
    }
}

// MARK: - Geofence Radii
struct GeofenceRadii: Codable {
    let approach: Double // miles
    let arrival: Double // meters
    let postArrival: Bool
    
    static let `default` = GeofenceRadii(
        approach: 2.0,
        arrival: 100.0,
        postArrival: true
    )
    
    static func defaultForPOI(_ category: POICategory) -> GeofenceRadii {
        return GeofenceRadii(
            approach: category.defaultApproachRadius,
            arrival: 100.0,
            postArrival: true
        )
    }
}

// MARK: - Place Model
struct Place: Identifiable, Codable {
    let id: String
    let userId: String
    let name: String
    let latitude: Double
    let longitude: Double
    let address: String?
    let placeType: PlaceType
    let defaultRadii: GeofenceRadii
    let createdAt: Date
    let updatedAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case name
        case latitude
        case longitude
        case address
        case placeType = "place_type"
        case defaultRadii = "default_radii"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
    
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

// MARK: - Place Type
enum PlaceType: String, CaseIterable, Codable {
    case home = "home"
    case work = "work"
    case custom = "custom"
    
    var displayName: String {
        switch self {
        case .home: return "Home"
        case .work: return "Work"
        case .custom: return "Custom"
        }
    }
    
    var icon: String {
        switch self {
        case .home: return "house.fill"
        case .work: return "building.2.fill"
        case .custom: return "mappin.circle.fill"
        }
    }
}

// MARK: - Task Creation Request
struct CreateTaskRequest: Codable {
    let title: String
    let description: String?
    let locationType: LocationType
    let placeId: String?
    let poiCategory: POICategory?
    let customRadii: GeofenceRadii?
    
    enum CodingKeys: String, CodingKey {
        case title
        case description
        case locationType = "location_type"
        case placeId = "place_id"
        case poiCategory = "poi_category"
        case customRadii = "custom_radii"
    }
}

// MARK: - Task Update Request
struct UpdateTaskRequest: Codable {
    let title: String?
    let description: String?
    let locationType: LocationType?
    let placeId: String?
    let poiCategory: POICategory?
    let customRadii: GeofenceRadii?
    let status: TaskStatus?
    
    enum CodingKeys: String, CodingKey {
        case title
        case description
        case locationType = "location_type"
        case placeId = "place_id"
        case poiCategory = "poi_category"
        case customRadii = "custom_radii"
        case status
    }
}

// MARK: - Task Filters
struct TaskFilters {
    var status: TaskStatus?
    var locationType: LocationType?
    var poiCategory: POICategory?
    var page: Int = 1
    var limit: Int = 20
    
    var hasActiveFilters: Bool {
        return status != nil || locationType != nil || poiCategory != nil
    }
    
    mutating func clear() {
        status = nil
        locationType = nil
        poiCategory = nil
        page = 1
    }
}

// MARK: - Task Statistics
struct TaskStats: Codable {
    let total: Int
    let active: Int
    let completed: Int
    let muted: Int
    let customPlace: Int
    let poiCategory: Int
}
