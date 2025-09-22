import SwiftUI
import CoreLocation

struct POISelectionView: View {
    @Environment(\.presentationMode) var presentationMode
    @StateObject private var locationManager = LocationManager()
    @StateObject private var poiService = POIService.shared
    
    @Binding var selectedCategory: POICategory
    
    @State private var nearbyPOIs: [POI] = []
    @State private var isLoading = false
    @State private var showingError = false
    @State private var errorMessage = ""
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Header
                VStack(spacing: DesignSystem.Spacing.sm) {
                    Text("Select POI Category")
                        .font(DesignSystem.Typography.title1)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    Text("Choose a category to get reminders when you're near any location of this type")
                        .font(DesignSystem.Typography.subheadline)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, DesignSystem.Spacing.padding)
                .padding(.top, DesignSystem.Spacing.lg)
                
                // Category Selection
                ScrollView {
                    LazyVStack(spacing: DesignSystem.Spacing.md) {
                        ForEach(POICategory.allCases, id: \.self) { category in
                            POICategoryCard(
                                category: category,
                                isSelected: selectedCategory == category,
                                onTap: {
                                    selectedCategory = category
                                    loadNearbyPOIs(for: category)
                                }
                            )
                        }
                    }
                    .padding(.horizontal, DesignSystem.Spacing.padding)
                    .padding(.top, DesignSystem.Spacing.lg)
                }
                
                // Nearby POIs Section
                if !nearbyPOIs.isEmpty {
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                        HStack {
                            Text("Nearby \(selectedCategory.displayName)s")
                                .font(DesignSystem.Typography.title3)
                                .foregroundColor(DesignSystem.Colors.textPrimary)
                            
                            Spacer()
                            
                            if isLoading {
                                ProgressView()
                                    .scaleEffect(0.8)
                            }
                        }
                        .padding(.horizontal, DesignSystem.Spacing.padding)
                        
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: DesignSystem.Spacing.md) {
                                ForEach(nearbyPOIs.prefix(5)) { poi in
                                    NearbyPOICard(poi: poi)
                                }
                            }
                            .padding(.horizontal, DesignSystem.Spacing.padding)
                        }
                    }
                    .padding(.vertical, DesignSystem.Spacing.md)
                }
                
                Spacer()
                
                // Bottom Action Bar
                VStack(spacing: 0) {
                    Divider()
                        .background(DesignSystem.Colors.border)
                    
                    HStack(spacing: DesignSystem.Spacing.md) {
                        Button(action: {
                            presentationMode.wrappedValue.dismiss()
                        }) {
                            Text("Cancel")
                                .font(DesignSystem.Typography.buttonMedium)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                                .frame(maxWidth: .infinity)
                                .frame(height: 50)
                                .background(DesignSystem.Colors.surface)
                                .designSystemCornerRadius()
                                .designSystemShadow(DesignSystem.Shadow.small)
                        }
                        .buttonStyle(PlainButtonStyle())
                        
                        Button(action: {
                            presentationMode.wrappedValue.dismiss()
                        }) {
                            HStack {
                                Image(systemName: selectedCategory.icon)
                                Text("Select \(selectedCategory.displayName)")
                            }
                            .font(DesignSystem.Typography.buttonMedium)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(DesignSystem.Colors.primary)
                            .designSystemCornerRadius()
                            .designSystemShadow(DesignSystem.Shadow.small)
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                    .padding(.horizontal, DesignSystem.Spacing.padding)
                    .padding(.vertical, DesignSystem.Spacing.md)
                    .background(DesignSystem.Colors.background)
                }
            }
            .navigationBarHidden(true)
        }
        .onAppear {
            loadNearbyPOIs(for: selectedCategory)
        }
        .alert("Error", isPresented: $showingError) {
            Button("OK") { }
        } message: {
            Text(errorMessage)
        }
    }
    
    private func loadNearbyPOIs(for category: POICategory) {
        guard let userLocation = locationManager.currentLocation else {
            // If no location available, show empty state
            nearbyPOIs = []
            return
        }
        
        isLoading = true
        
        poiService.fetchNearbyPOIs(
            category: category,
            location: userLocation,
            radius: 5000 // 5km radius
        ) { result in
            DispatchQueue.main.async {
                isLoading = false
                
                switch result {
                case .success(let pois):
                    nearbyPOIs = pois
                case .failure(let error):
                    errorMessage = error.localizedDescription
                    showingError = true
                    nearbyPOIs = []
                }
            }
        }
    }
}

// MARK: - POI Category Card
struct POICategoryCard: View {
    let category: POICategory
    let isSelected: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: DesignSystem.Spacing.md) {
                // Icon
                ZStack {
                    Circle()
                        .fill(isSelected ? DesignSystem.Colors.primary : DesignSystem.Colors.surface)
                        .frame(width: 60, height: 60)
                    
                    Image(systemName: category.icon)
                        .font(.title2)
                        .foregroundColor(isSelected ? .white : DesignSystem.Colors.primary)
                }
                
                // Content
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    Text(category.displayName)
                        .font(DesignSystem.Typography.title3)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    Text(categoryDescription(for: category))
                        .font(DesignSystem.Typography.body)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .multilineTextAlignment(.leading)
                    
                    Text("Default: \(Int(category.defaultApproachRadius)) mile radius")
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textTertiary)
                }
                
                Spacer()
                
                // Selection Indicator
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(DesignSystem.Colors.primary)
                        .font(.title2)
                } else {
                    Image(systemName: "circle")
                        .foregroundColor(DesignSystem.Colors.border)
                        .font(.title2)
                }
            }
            .padding(DesignSystem.Spacing.md)
            .background(isSelected ? DesignSystem.Colors.primary.opacity(0.1) : DesignSystem.Colors.surface)
            .designSystemCornerRadius()
            .designSystemShadow(DesignSystem.Shadow.small)
            .overlay(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .stroke(isSelected ? DesignSystem.Colors.primary : DesignSystem.Colors.border, lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private func categoryDescription(for category: POICategory) -> String {
        switch category {
        case .gas:
            return "Get reminded when you're near gas stations"
        case .pharmacy:
            return "Get reminded when you're near pharmacies"
        case .grocery:
            return "Get reminded when you're near grocery stores"
        case .bank:
            return "Get reminded when you're near banks"
        case .postOffice:
            return "Get reminded when you're near post offices"
        }
    }
}

// MARK: - Nearby POI Card
struct NearbyPOICard: View {
    let poi: POI
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
            HStack {
                Image(systemName: poi.category.icon)
                    .foregroundColor(DesignSystem.Colors.primary)
                    .font(.title3)
                
                Spacer()
                
                if let distance = poi.distance {
                    Text(distanceString(distance))
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
            }
            
            Text(poi.name)
                .font(DesignSystem.Typography.bodyEmphasized)
                .foregroundColor(DesignSystem.Colors.textPrimary)
                .lineLimit(2)
            
            if let address = poi.address {
                Text(address)
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .lineLimit(2)
            }
        }
        .padding(DesignSystem.Spacing.md)
        .frame(width: 200)
        .background(DesignSystem.Colors.surface)
        .designSystemCornerRadius()
        .designSystemShadow(DesignSystem.Shadow.small)
    }
    
    private func distanceString(_ distance: Double) -> String {
        if distance < 1000 {
            return "\(Int(distance))m"
        } else {
            return String(format: "%.1fkm", distance / 1000)
        }
    }
}

// MARK: - POI Model
struct POI: Identifiable, Codable {
    let id: String
    let externalId: String?
    let name: String
    let category: POICategory
    let latitude: Double
    let longitude: Double
    let address: String?
    let verified: Bool
    let source: String
    let lastUpdated: Date
    let distance: Double?
    
    enum CodingKeys: String, CodingKey {
        case id
        case externalId = "external_id"
        case name
        case category
        case latitude
        case longitude
        case address
        case verified
        case source
        case lastUpdated = "last_updated"
        case distance
    }
    
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

// MARK: - POI Service
class POIService: ObservableObject {
    static let shared = POIService()
    
    private let baseURL = "http://localhost:3000/api"
    
    private init() {}
    
    func fetchNearbyPOIs(
        category: POICategory,
        location: CLLocation,
        radius: Double,
        completion: @escaping (Result<[POI], Error>) -> Void
    ) {
        // For demo purposes, return mock data
        // In a real implementation, this would make an API call
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            let mockPOIs = self.generateMockPOIs(for: category, near: location)
            completion(.success(mockPOIs))
        }
    }
    
    private func generateMockPOIs(for category: POICategory, near location: CLLocation) -> [POI] {
        let mockData: [POICategory: [(String, String)]] = [
            .gas: [
                ("Shell Station", "123 Main St"),
                ("Chevron", "456 Oak Ave"),
                ("BP Gas Station", "789 Pine Rd"),
                ("Exxon Mobil", "321 Elm St"),
                ("76 Station", "654 Maple Dr")
            ],
            .pharmacy: [
                ("CVS Pharmacy", "111 Health St"),
                ("Walgreens", "222 Wellness Ave"),
                ("Rite Aid", "333 Care Rd"),
                ("Walmart Pharmacy", "444 Health Blvd"),
                ("Target Pharmacy", "555 Wellness Way")
            ],
            .grocery: [
                ("Safeway", "666 Food St"),
                ("Whole Foods", "777 Organic Ave"),
                ("Trader Joe's", "888 Fresh Rd"),
                ("Kroger", "999 Market Blvd"),
                ("Albertsons", "101 Grocery Way")
            ],
            .bank: [
                ("Chase Bank", "202 Money St"),
                ("Bank of America", "303 Finance Ave"),
                ("Wells Fargo", "404 Banking Rd"),
                ("Citibank", "505 Capital Blvd"),
                ("US Bank", "606 Investment Way")
            ],
            .postOffice: [
                ("USPS Main Office", "707 Mail St"),
                ("Post Office Branch", "808 Delivery Ave"),
                ("USPS Express", "909 Package Rd"),
                ("Postal Service", "010 Shipping Blvd"),
                ("Mail Center", "111 Postal Way")
            ]
        ]
        
        guard let names = mockData[category] else { return [] }
        
        return names.enumerated().map { index, (name, address) in
            let distance = Double.random(in: 100...2000) // Random distance in meters
            let angle = Double.random(in: 0...2 * .pi)
            let latOffset = (distance * cos(angle)) / 111000 // Rough conversion to degrees
            let lonOffset = (distance * sin(angle)) / (111000 * cos(location.coordinate.latitude * .pi / 180))
            
            return POI(
                id: UUID().uuidString,
                externalId: "mock_\(index)",
                name: name,
                category: category,
                latitude: location.coordinate.latitude + latOffset,
                longitude: location.coordinate.longitude + lonOffset,
                address: address,
                verified: true,
                source: "mock",
                lastUpdated: Date(),
                distance: distance
            )
        }.sorted { $0.distance ?? 0 < $1.distance ?? 0 }
    }
}

// MARK: - Preview
struct POISelectionView_Previews: PreviewProvider {
    static var previews: some View {
        POISelectionView(selectedCategory: .constant(.gas))
    }
}
