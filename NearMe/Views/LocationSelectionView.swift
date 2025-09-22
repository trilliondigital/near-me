import SwiftUI
import MapKit
import CoreLocation

struct LocationSelectionView: View {
    @Environment(\.presentationMode) var presentationMode
    @StateObject private var locationManager = LocationManager()
    @StateObject private var searchManager = LocationSearchManager()
    
    @Binding var selectedPlace: Place?
    
    @State private var searchText = ""
    @State private var showingMap = false
    @State private var selectedCoordinate: CLLocationCoordinate2D?
    @State private var selectedAddress = ""
    @State private var placeName = ""
    @State private var isCreatingPlace = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Search Bar
                SearchBar(text: $searchText, onSearchButtonClicked: searchLocations)
                    .padding(.horizontal, DesignSystem.Spacing.padding)
                    .padding(.top, DesignSystem.Spacing.sm)
                
                if showingMap {
                    // Map View
                    MapSelectionView(
                        selectedCoordinate: $selectedCoordinate,
                        selectedAddress: $selectedAddress,
                        placeName: $placeName
                    )
                    .frame(maxHeight: 300)
                    .padding(.horizontal, DesignSystem.Spacing.padding)
                    .padding(.top, DesignSystem.Spacing.md)
                }
                
                // Search Results
                if !searchManager.searchResults.isEmpty {
                    SearchResultsView(
                        results: searchManager.searchResults,
                        onPlaceSelected: selectPlace
                    )
                } else if showingMap && selectedCoordinate != nil {
                    // Place Creation Form
                    PlaceCreationForm(
                        placeName: $placeName,
                        selectedCoordinate: selectedCoordinate!,
                        selectedAddress: $selectedAddress,
                        isCreating: $isCreatingPlace,
                        onSave: createCustomPlace
                    )
                } else {
                    // Empty State
                    EmptyStateView(
                        title: "Search for a location",
                        subtitle: "Enter an address or place name to get started",
                        icon: "magnifyingglass"
                    )
                }
                
                Spacer()
            }
            .navigationTitle("Select Location")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Map") {
                        withAnimation {
                            showingMap.toggle()
                        }
                    }
                }
            }
        }
        .onAppear {
            locationManager.requestLocationPermission()
        }
    }
    
    private func searchLocations() {
        guard !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        searchManager.searchForLocation(query: searchText)
    }
    
    private func selectPlace(_ place: Place) {
        selectedPlace = place
        presentationMode.wrappedValue.dismiss()
    }
    
    private func createCustomPlace() {
        guard let coordinate = selectedCoordinate,
              !placeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        
        isCreatingPlace = true
        
        let newPlace = Place(
            id: UUID().uuidString,
            userId: "current_user", // This would come from auth
            name: placeName.trimmingCharacters(in: .whitespacesAndNewlines),
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            address: selectedAddress.isEmpty ? nil : selectedAddress,
            placeType: .custom,
            defaultRadii: GeofenceRadii.default,
            createdAt: Date(),
            updatedAt: Date()
        )
        
        selectedPlace = newPlace
        presentationMode.wrappedValue.dismiss()
    }
}

// MARK: - Search Bar
struct SearchBar: View {
    @Binding var text: String
    let onSearchButtonClicked: () -> Void
    
    var body: some View {
        HStack {
            Image(systemName: "magnifyingglass")
                .foregroundColor(DesignSystem.Colors.textSecondary)
            
            TextField("Search for a location", text: $text)
                .textFieldStyle(PlainTextFieldStyle())
                .onSubmit {
                    onSearchButtonClicked()
                }
            
            if !text.isEmpty {
                Button(action: {
                    text = ""
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
            }
        }
        .padding(DesignSystem.Spacing.md)
        .background(DesignSystem.Colors.surface)
        .designSystemCornerRadius()
        .designSystemShadow(DesignSystem.Shadow.small)
    }
}

// MARK: - Map Selection View
struct MapSelectionView: View {
    @Binding var selectedCoordinate: CLLocationCoordinate2D?
    @Binding var selectedAddress: String
    @Binding var placeName: String
    
    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
        span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
    )
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.md) {
            Map(coordinateRegion: $region, annotationItems: annotations) { annotation in
                MapAnnotation(coordinate: annotation.coordinate) {
                    VStack {
                        Image(systemName: "mappin.circle.fill")
                            .foregroundColor(DesignSystem.Colors.primary)
                            .font(.title)
                        
                        Text(annotation.title)
                            .font(DesignSystem.Typography.caption1)
                            .padding(.horizontal, DesignSystem.Spacing.xs)
                            .padding(.vertical, 2)
                            .background(DesignSystem.Colors.primary)
                            .foregroundColor(.white)
                            .designSystemCornerRadius(DesignSystem.CornerRadius.xs)
                    }
                }
            }
            .frame(height: 250)
            .designSystemCornerRadius()
            .onTapGesture { location in
                let coordinate = region.center // Simplified for demo
                selectedCoordinate = coordinate
                reverseGeocode(coordinate: coordinate)
            }
            
            if let coordinate = selectedCoordinate {
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                    Text("Selected Location")
                        .font(DesignSystem.Typography.bodyEmphasized)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    HStack {
                        Image(systemName: "location.fill")
                            .foregroundColor(DesignSystem.Colors.primary)
                        
                        Text("\(coordinate.latitude, specifier: "%.4f"), \(coordinate.longitude, specifier: "%.4f")")
                            .font(DesignSystem.Typography.caption1)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                        
                        Spacer()
                    }
                    
                    if !selectedAddress.isEmpty {
                        HStack {
                            Image(systemName: "house.fill")
                                .foregroundColor(DesignSystem.Colors.primary)
                            
                            Text(selectedAddress)
                                .font(DesignSystem.Typography.caption1)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                            
                            Spacer()
                        }
                    }
                }
                .padding(DesignSystem.Spacing.md)
                .background(DesignSystem.Colors.surface)
                .designSystemCornerRadius()
            }
        }
    }
    
    private var annotations: [MapAnnotation] {
        guard let coordinate = selectedCoordinate else { return [] }
        return [MapAnnotation(coordinate: coordinate, title: "Selected")]
    }
    
    private func reverseGeocode(coordinate: CLLocationCoordinate2D) {
        let geocoder = CLGeocoder()
        geocoder.reverseGeocodeLocation(CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)) { placemarks, error in
            DispatchQueue.main.async {
                if let placemark = placemarks?.first {
                    var addressComponents: [String] = []
                    
                    if let streetNumber = placemark.subThoroughfare {
                        addressComponents.append(streetNumber)
                    }
                    if let streetName = placemark.thoroughfare {
                        addressComponents.append(streetName)
                    }
                    if let city = placemark.locality {
                        addressComponents.append(city)
                    }
                    if let state = placemark.administrativeArea {
                        addressComponents.append(state)
                    }
                    
                    selectedAddress = addressComponents.joined(separator: " ")
                    
                    if placeName.isEmpty {
                        placeName = placemark.name ?? placemark.locality ?? "Custom Location"
                    }
                }
            }
        }
    }
}

// MARK: - Search Results View
struct SearchResultsView: View {
    let results: [Place]
    let onPlaceSelected: (Place) -> Void
    
    var body: some View {
        ScrollView {
            LazyVStack(spacing: DesignSystem.Spacing.sm) {
                ForEach(results) { place in
                    PlaceResultRow(place: place) {
                        onPlaceSelected(place)
                    }
                }
            }
            .padding(.horizontal, DesignSystem.Spacing.padding)
        }
    }
}

// MARK: - Place Result Row
struct PlaceResultRow: View {
    let place: Place
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: DesignSystem.Spacing.md) {
                Image(systemName: place.placeType.icon)
                    .foregroundColor(DesignSystem.Colors.primary)
                    .font(.title2)
                    .frame(width: 30)
                
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    Text(place.name)
                        .font(DesignSystem.Typography.bodyEmphasized)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                        .multilineTextAlignment(.leading)
                    
                    if let address = place.address {
                        Text(address)
                            .font(DesignSystem.Typography.caption1)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                            .multilineTextAlignment(.leading)
                    }
                }
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .font(.caption)
            }
            .padding(DesignSystem.Spacing.md)
            .background(DesignSystem.Colors.surface)
            .designSystemCornerRadius()
            .designSystemShadow(DesignSystem.Shadow.small)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Place Creation Form
struct PlaceCreationForm: View {
    @Binding var placeName: String
    let selectedCoordinate: CLLocationCoordinate2D
    @Binding var selectedAddress: String
    @Binding var isCreating: Bool
    let onSave: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
            Text("Create Custom Place")
                .font(DesignSystem.Typography.title3)
                .foregroundColor(DesignSystem.Colors.textPrimary)
            
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                Text("Place Name")
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                TextField("Enter place name", text: $placeName)
                    .textFieldStyle(CustomTextFieldStyle())
            }
            
            Button(action: onSave) {
                HStack {
                    if isCreating {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: "plus.circle.fill")
                    }
                    Text(isCreating ? "Creating..." : "Create Place")
                }
                .font(DesignSystem.Typography.buttonMedium)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background(canCreatePlace ? DesignSystem.Colors.primary : DesignSystem.Colors.textTertiary)
                .designSystemCornerRadius()
                .designSystemShadow(DesignSystem.Shadow.small)
            }
            .buttonStyle(PlainButtonStyle())
            .disabled(!canCreatePlace || isCreating)
        }
        .padding(.horizontal, DesignSystem.Spacing.padding)
    }
    
    private var canCreatePlace: Bool {
        !placeName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

// MARK: - Empty State View
struct EmptyStateView: View {
    let title: String
    let subtitle: String
    let icon: String
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.lg) {
            Image(systemName: icon)
                .font(.system(size: 60))
                .foregroundColor(DesignSystem.Colors.textTertiary)
            
            VStack(spacing: DesignSystem.Spacing.sm) {
                Text(title)
                    .font(DesignSystem.Typography.title3)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text(subtitle)
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(DesignSystem.Spacing.padding)
    }
}

// MARK: - Map Annotation
struct MapAnnotation: Identifiable {
    let id = UUID()
    let coordinate: CLLocationCoordinate2D
    let title: String
}

// MARK: - Location Search Manager
class LocationSearchManager: ObservableObject {
    @Published var searchResults: [Place] = []
    @Published var isSearching = false
    
    private let searchCompleter = MKLocalSearchCompleter()
    
    init() {
        searchCompleter.resultTypes = [.address, .pointOfInterest]
    }
    
    func searchForLocation(query: String) {
        isSearching = true
        
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = query
        request.region = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
            span: MKCoordinateSpan(latitudeDelta: 0.5, longitudeDelta: 0.5)
        )
        
        let search = MKLocalSearch(request: request)
        search.start { [weak self] response, error in
            DispatchQueue.main.async {
                self?.isSearching = false
                
                if let error = error {
                    print("Search error: \(error)")
                    return
                }
                
                guard let response = response else { return }
                
                self?.searchResults = response.mapItems.compactMap { item in
                    Place(
                        id: UUID().uuidString,
                        userId: "current_user",
                        name: item.name ?? "Unknown Place",
                        latitude: item.placemark.coordinate.latitude,
                        longitude: item.placemark.coordinate.longitude,
                        address: item.placemark.title,
                        placeType: .custom,
                        defaultRadii: GeofenceRadii.default,
                        createdAt: Date(),
                        updatedAt: Date()
                    )
                }
            }
        }
    }
}

// MARK: - Preview
struct LocationSelectionView_Previews: PreviewProvider {
    static var previews: some View {
        LocationSelectionView(selectedPlace: .constant(nil))
    }
}
