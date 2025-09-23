import SwiftUI
import MapKit

// MARK: - Map Components
struct LocationSelectionMap: View {
    @Binding var selectedLocation: CLLocationCoordinate2D?
    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
        span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
    )
    
    var body: some View {
        ZStack {
            Map(coordinateRegion: $region, interactionModes: .all, showsUserLocation: true)
                .onTapGesture { location in
                    let coordinate = convertToCoordinate(location: location)
                    selectedLocation = coordinate
                }
            
            // Center pin overlay
            if selectedLocation == nil {
                Image(systemName: "plus")
                    .font(.title)
                    .foregroundColor(DesignSystem.Colors.primary)
                    .background(
                        Circle()
                            .fill(DesignSystem.Colors.background)
                            .frame(width: 32, height: 32)
                    )
            }
            
            // Selected location pin
            if let location = selectedLocation {
                MapPin(coordinate: location, isSelected: true)
            }
        }
        .designSystemCornerRadius()
        .designSystemShadow(DesignSystem.Shadow.medium)
    }
    
    private func convertToCoordinate(location: CGPoint) -> CLLocationCoordinate2D {
        // This is a simplified conversion - in a real app you'd use proper map coordinate conversion
        let lat = region.center.latitude + Double(location.y - 200) * region.span.latitudeDelta / 400
        let lon = region.center.longitude + Double(location.x - 200) * region.span.longitudeDelta / 400
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }
}

struct MapPin: View {
    let coordinate: CLLocationCoordinate2D
    var isSelected: Bool = false
    var color: Color = DesignSystem.Colors.mapPin
    
    var body: some View {
        VStack(spacing: 0) {
            Image(systemName: "mappin.circle.fill")
                .font(.title)
                .foregroundColor(isSelected ? DesignSystem.Colors.mapPinSelected : color)
                .background(
                    Circle()
                        .fill(DesignSystem.Colors.background)
                        .frame(width: 24, height: 24)
                )
                .designSystemShadow(DesignSystem.Shadow.small)
        }
    }
}

struct GeofenceOverlay: View {
    let center: CLLocationCoordinate2D
    let radius: Double // in meters
    var strokeColor: Color = DesignSystem.Colors.geofenceStroke
    var fillColor: Color = DesignSystem.Colors.geofenceFill
    
    var body: some View {
        Circle()
            .stroke(strokeColor, lineWidth: 2)
            .background(Circle().fill(fillColor))
            .frame(width: radiusToPixels(radius), height: radiusToPixels(radius))
    }
    
    private func radiusToPixels(_ meters: Double) -> CGFloat {
        // Simplified conversion - in real app use proper map projection
        return CGFloat(meters / 10)
    }
}

struct POIMarker: View {
    let poi: POI
    var isSelected: Bool = false
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.xs) {
            Image(systemName: poi.category.icon)
                .font(.title2)
                .foregroundColor(.white)
                .frame(width: 32, height: 32)
                .background(
                    Circle()
                        .fill(isSelected ? DesignSystem.Colors.accent : poi.category.color)
                )
                .designSystemShadow(DesignSystem.Shadow.small)
            
            if isSelected {
                Text(poi.name)
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                    .padding(.horizontal, DesignSystem.Spacing.sm)
                    .padding(.vertical, DesignSystem.Spacing.xs)
                    .background(
                        RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.sm)
                            .fill(DesignSystem.Colors.background)
                            .designSystemShadow(DesignSystem.Shadow.small)
                    )
            }
        }
    }
}

// MARK: - Map Controls
struct MapControlsOverlay: View {
    let onLocationTap: () -> Void
    let onZoomIn: () -> Void
    let onZoomOut: () -> Void
    
    var body: some View {
        VStack {
            HStack {
                Spacer()
                
                VStack(spacing: DesignSystem.Spacing.xs) {
                    MapControlButton(icon: "location.fill", action: onLocationTap)
                    MapControlButton(icon: "plus", action: onZoomIn)
                    MapControlButton(icon: "minus", action: onZoomOut)
                }
                .padding(.trailing, DesignSystem.Spacing.md)
            }
            
            Spacer()
        }
        .padding(.top, DesignSystem.Spacing.md)
    }
}

struct MapControlButton: View {
    let icon: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(DesignSystem.Colors.textPrimary)
                .frame(width: 40, height: 40)
                .background(
                    Circle()
                        .fill(DesignSystem.Colors.background)
                        .designSystemShadow(DesignSystem.Shadow.medium)
                )
        }
    }
}

// MARK: - Location Search
struct LocationSearchBar: View {
    @Binding var searchText: String
    @Binding var searchResults: [SearchResult]
    let onResultSelected: (SearchResult) -> Void
    
    @State private var isSearching = false
    
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: DesignSystem.Spacing.sm) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                
                TextField("Search for a location", text: $searchText)
                    .font(DesignSystem.Typography.body)
                    .onTapGesture {
                        isSearching = true
                    }
                    .onChange(of: searchText) { _ in
                        performSearch()
                    }
                
                if isSearching && !searchText.isEmpty {
                    Button(action: {
                        searchText = ""
                        searchResults = []
                        isSearching = false
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                    }
                }
            }
            .padding(DesignSystem.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .fill(DesignSystem.Colors.surface)
                    .designSystemShadow(DesignSystem.Shadow.small)
            )
            
            if isSearching && !searchResults.isEmpty {
                SearchResultsList(
                    results: searchResults,
                    onResultSelected: { result in
                        onResultSelected(result)
                        isSearching = false
                        searchText = result.title
                    }
                )
            }
        }
    }
    
    private func performSearch() {
        // Simulate search - in real app, use MKLocalSearch
        guard !searchText.isEmpty else {
            searchResults = []
            return
        }
        
        // Mock results
        searchResults = [
            SearchResult(title: "Starbucks", subtitle: "Coffee Shop • 0.2 mi", coordinate: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)),
            SearchResult(title: "Whole Foods Market", subtitle: "Grocery Store • 0.5 mi", coordinate: CLLocationCoordinate2D(latitude: 37.7849, longitude: -122.4094))
        ]
    }
}

struct SearchResultsList: View {
    let results: [SearchResult]
    let onResultSelected: (SearchResult) -> Void
    
    var body: some View {
        VStack(spacing: 0) {
            ForEach(results, id: \.title) { result in
                Button(action: {
                    onResultSelected(result)
                }) {
                    HStack {
                        VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                            Text(result.title)
                                .font(DesignSystem.Typography.body)
                                .foregroundColor(DesignSystem.Colors.textPrimary)
                            
                            Text(result.subtitle)
                                .font(DesignSystem.Typography.caption1)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                        }
                        
                        Spacer()
                        
                        Image(systemName: "arrow.up.left")
                            .font(.caption)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                    }
                    .padding(DesignSystem.Spacing.md)
                    .background(DesignSystem.Colors.background)
                }
                .buttonStyle(PlainButtonStyle())
                
                if result != results.last {
                    Divider()
                        .background(DesignSystem.Colors.border)
                }
            }
        }
        .background(
            RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                .fill(DesignSystem.Colors.background)
                .designSystemShadow(DesignSystem.Shadow.medium)
        )
        .padding(.top, DesignSystem.Spacing.xs)
    }
}

// MARK: - Supporting Models
struct SearchResult {
    let title: String
    let subtitle: String
    let coordinate: CLLocationCoordinate2D
}

struct POI {
    let id: String
    let name: String
    let category: POICategory
    let coordinate: CLLocationCoordinate2D
    let address: String
}

enum POICategory: String, CaseIterable {
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
    
    var color: Color {
        switch self {
        case .gas: return .blue
        case .pharmacy: return .red
        case .grocery: return .green
        case .bank: return .orange
        case .postOffice: return .purple
        }
    }
}

// MARK: - Map Previews
struct MapComponents_Previews: PreviewProvider {
    @State static var selectedLocation: CLLocationCoordinate2D? = nil
    @State static var searchText = ""
    @State static var searchResults: [SearchResult] = []
    
    static var previews: some View {
        VStack(spacing: DesignSystem.Spacing.lg) {
            LocationSelectionMap(selectedLocation: $selectedLocation)
                .frame(height: 300)
            
            LocationSearchBar(
                searchText: $searchText,
                searchResults: $searchResults,
                onResultSelected: { _ in }
            )
        }
        .padding()
        .background(DesignSystem.Colors.background)
    }
}