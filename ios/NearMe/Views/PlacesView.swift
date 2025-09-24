import SwiftUI
import MapKit

// MARK: - Places View
struct PlacesView: View {
    @EnvironmentObject var navigationCoordinator: NavigationCoordinator
    @StateObject private var placeService = PlaceService.shared
    @ObservedObject private var offlineManager = OfflineManager.shared
    @State private var isLoading = false
    @State private var searchText = ""
    @State private var selectedCategory: PlaceCategory? = nil
    @State private var showMapView = false
    @State private var region = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
        span: MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)
    )
    
    enum PlaceCategory: String, CaseIterable {
        case all = "All"
        case gas = "Gas Station"
        case pharmacy = "Pharmacy"
        case grocery = "Grocery Store"
        case bank = "Bank"
        case postOffice = "Post Office"
        case custom = "Custom Places"
        
        var icon: String {
            switch self {
            case .all: return "list.bullet"
            case .gas: return "fuelpump"
            case .pharmacy: return "cross.case"
            case .grocery: return "cart"
            case .bank: return "building.columns"
            case .postOffice: return "envelope"
            case .custom: return "star"
            }
        }
    }
    
    var filteredPlaces: [Place] {
        var filtered = placeService.places
        
        // Apply search filter
        if !searchText.isEmpty {
            filtered = filtered.filter { place in
                place.name.localizedCaseInsensitiveContains(searchText) ||
                (place.address ?? "").localizedCaseInsensitiveContains(searchText)
            }
        }
        
        // Apply category filter
        if let category = selectedCategory, category != .all {
            // For now, only filter custom places when selected; other categories are for POIs
            if category == .custom {
                filtered = filtered.filter { $0.placeType == .custom }
            } else {
                filtered = []
            }
        }
        
        return filtered.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }
    
    var body: some View {
        NavigationWrapper(
            title: "Places",
            trailingButton: {
                AnyView(
                    HStack(spacing: DesignSystem.Spacing.sm) {
                        IconButton(
                            icon: showMapView ? "list.bullet" : "map",
                            action: {
                                showMapView.toggle()
                            }
                        )
                        
                        IconButton(
                            icon: "plus",
                            action: {
                                navigationCoordinator.navigateTo(.createPlace)
                            }
                        )
                    }
                )
            }
        ) {
            VStack(spacing: 0) {
                if !offlineManager.isOnline {
                    OfflineBanner()
                }
                // Search and Filter Section
                VStack(spacing: DesignSystem.Spacing.md) {
                    SearchField(text: $searchText, placeholder: "Search places...")
                    
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: DesignSystem.Spacing.sm) {
                            ForEach(PlaceCategory.allCases, id: \.self) { category in
                                CategoryChip(
                                    title: category.rawValue,
                                    icon: category.icon,
                                    isSelected: selectedCategory == category,
                                    action: {
                                        selectedCategory = category
                                    }
                                )
                            }
                        }
                        .padding(.horizontal, DesignSystem.Spacing.md)
                    }
                }
                .padding(.vertical, DesignSystem.Spacing.md)
                .background(DesignSystem.Colors.surface)
                
                // Content Area
                if showMapView {
                    MapView(places: filteredPlaces, region: $region)
                } else {
                    // Places List
                    if isLoading || placeService.isLoading {
                        VStack {
                            Spacer()
                            ProgressView()
                                .scaleEffect(1.2)
                            Text("Loading places...")
                                .font(DesignSystem.Typography.body)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                                .padding(.top, DesignSystem.Spacing.md)
                            Spacer()
                        }
                    } else if filteredPlaces.isEmpty {
                        EmptyStateCard(
                            icon: searchText.isEmpty ? "location" : "magnifyingglass",
                            title: searchText.isEmpty ? "No Places Yet" : "No Results",
                            message: searchText.isEmpty ? 
                                "Add places to create location-based tasks and reminders." :
                                "No places match your search criteria.",
                            actionTitle: searchText.isEmpty ? "Add Place" : nil,
                            action: searchText.isEmpty ? {
                                navigationCoordinator.navigateTo(.createPlace)
                            } : nil
                        )
                        .padding()
                    } else {
                        ScrollView {
                            LazyVStack(spacing: DesignSystem.Spacing.md) {
                                ForEach(filteredPlaces) { place in
                                    PlaceCard(
                                        name: place.name,
                                        address: place.address ?? "",
                                        category: place.placeType.displayName,
                                        distance: nil,
                                        action: {
                                            navigationCoordinator.navigateTo(.placeDetail(place.id))
                                        }
                                    )
                                    .onTapGesture {
                                        navigationCoordinator.navigateTo(.placeDetail(place.id))
                                    }
                                }
                            }
                            .padding()
                        }
                    }
                }
            }
        }
        .onAppear {
            placeService.fetchPlaces()
        }
    }
}

// MARK: - Category Chip Component
struct CategoryChip: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignSystem.Spacing.xs) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .medium))
                
                Text(title)
                    .font(DesignSystem.Typography.caption1)
                    .fontWeight(.medium)
            }
            .padding(.horizontal, DesignSystem.Spacing.md)
            .padding(.vertical, DesignSystem.Spacing.sm)
            .background(
                Capsule()
                    .fill(isSelected ? DesignSystem.Colors.primary : DesignSystem.Colors.surface)
            )
            .foregroundColor(isSelected ? DesignSystem.Colors.textInverse : DesignSystem.Colors.textPrimary)
            .overlay(
                Capsule()
                    .stroke(DesignSystem.Colors.border, lineWidth: 1)
            )
        }
    }
}

// MARK: - Map View Component
struct MapView: View {
    let places: [Place]
    @Binding var region: MKCoordinateRegion
    @State private var selectedPlace: Place?
    
    var body: some View {
        ZStack {
            Map(coordinateRegion: $region, annotationItems: places) { place in
                MapAnnotation(coordinate: CLLocationCoordinate2D(latitude: place.latitude, longitude: place.longitude)) {
                    MapPinView(
                        place: place,
                        isSelected: selectedPlace?.id == place.id,
                        action: {
                            selectedPlace = place
                        }
                    )
                }
            }
            .ignoresSafeArea()
            
            // Place Details Overlay
            if let selectedPlace = selectedPlace {
                VStack {
                    Spacer()
                    
                    PlaceCard(
                        name: selectedPlace.name,
                        address: selectedPlace.address ?? "",
                        category: selectedPlace.placeType.displayName,
                        distance: nil,
                        action: {
                            // TODO: Navigate to place detail
                        }
                    )
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.lg)
                            .fill(DesignSystem.Colors.background)
                            .designSystemShadow(DesignSystem.Shadow.large)
                    )
                    .padding()
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .onTapGesture {
            selectedPlace = nil
        }
    }
}

// MARK: - Map Pin View
struct MapPinView: View {
    let place: Place
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 0) {
                Image(systemName: categoryIcon(place.placeType.displayName))
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(DesignSystem.Colors.textInverse)
                    .frame(width: 32, height: 32)
                    .background(
                        Circle()
                            .fill(isSelected ? DesignSystem.Colors.primary : DesignSystem.Colors.accent)
                    )
                    .overlay(
                        Circle()
                            .stroke(DesignSystem.Colors.background, lineWidth: 2)
                    )
                
                Triangle()
                    .fill(isSelected ? DesignSystem.Colors.primary : DesignSystem.Colors.accent)
                    .frame(width: 8, height: 8)
                    .offset(y: -2)
            }
        }
        .scaleEffect(isSelected ? 1.2 : 1.0)
        .animation(DesignSystem.Animation.spring, value: isSelected)
    }
    
    private func categoryIcon(_ category: String) -> String {
        switch category {
        case "Gas Station": return "fuelpump"
        case "Pharmacy": return "cross.case"
        case "Grocery Store": return "cart"
        case "Bank": return "building.columns"
        case "Post Office": return "envelope"
        case "Home": return "house"
        case "Work": return "building.2"
        case "Custom": return "mappin.circle"
        default: return "location"
        }
    }
}

// MARK: - Triangle Shape
struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.closeSubpath()
        return path
    }
}

// Removed temporary Place model in favor of app-wide model in Models/TaskModels.swift

// MARK: - Places View Previews
struct PlacesView_Previews: PreviewProvider {
    static var previews: some View {
        PlacesView()
            .environmentObject(NavigationCoordinator())
            .environmentObject(LocationManager())
            .environmentObject(NotificationManager())
    }
}
