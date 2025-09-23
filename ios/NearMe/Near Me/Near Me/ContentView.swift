//
//  ContentView.swift
//  Near Me
//
//  Created by Kaegan Braud on 9/22/25.
//

import SwiftUI
import CoreData
import MapKit
import CoreLocation
import UIKit
import Combine

struct ContentView: View {
    @Environment(\.managedObjectContext) private var viewContext
    @Environment(\.openURL) private var openURL

    // Core Data items (kept for Items sheet)
    @FetchRequest(
        sortDescriptors: [NSSortDescriptor(keyPath: \Item.timestamp, ascending: true)],
        animation: .default)
    private var items: FetchedResults<Item>

    // Persisted preferences
    @AppStorage("showsUserLocation") private var showsUserLocation: Bool = true
    @AppStorage("mapStyle") private var mapStyleKey: String = "standard" // standard | muted | satellite | hybrid
    @AppStorage("lastLat") private var lastLat: Double = 37.3349
    @AppStorage("lastLon") private var lastLon: Double = -122.0090
    @AppStorage("lastSpanLat") private var lastSpanLat: Double = 0.05
    @AppStorage("lastSpanLon") private var lastSpanLon: Double = 0.05

    // Map & location state
    @State private var position: MapCameraPosition = .automatic
    @State private var showItemsSheet = false
    @StateObject private var locationManager = LocationManager()

    // Dropped pins
    @State private var droppedPins: [DroppedPin] = []

    var body: some View {
        NavigationStack {
            MapReader { proxy in
                ZStack {
                    Map(position: $position) {
                        if showsUserLocation {
                            UserAnnotation()
                        }
                        ForEach(droppedPins) { pin in
                            Marker(pin.title, systemImage: "mappin", coordinate: pin.coordinate)
                        }
                    }
                    .mapStyle(currentMapStyle)
                    .mapControls {
                        MapUserLocationButton()
                        MapCompass()
                        MapPitchToggle()
                        MapScaleView()
                    }
                    .onAppear(perform: handleOnAppear)
                    .onReceive(locationManager.$lastLocation) { loc in
                        guard let loc = loc else { return }
                        withAnimation(.easeInOut) {
                            position = .region(
                                MKCoordinateRegion(
                                    center: loc.coordinate,
                                    span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)
                                )
                            )
                        }
                    }
                    .onMapCameraChange(frequency: .onEnd) { context in
                        persist(region: context.region)
                    }
                    // Tap to drop a pin
                    .overlay {
                        TapOverlay(proxy: proxy) { coord in
                            withAnimation(.spring) {
                                droppedPins.append(DroppedPin(coordinate: coord))
                            }
                        }
                    }

                    // Top overlays: authorization banner + info card
                    VStack(spacing: 8) {
                        if needsAuthorizationBanner {
                            AuthorizationBanner(openSettings: openSettings)
                                .transition(.move(edge: .top).combined(with: .opacity))
                                .zIndex(2)
                        }

                        HStack {
                            if let info = locationInfoText {
                                InfoCard(text: info)
                                    .transition(.opacity)
                            }
                            Spacer()
                        }
                        .padding(.horizontal)

                        Spacer()
                    }
                    .padding(.top)

                    // Floating recenter button (bottom trailing)
                    VStack {
                        Spacer()
                        HStack {
                            Spacer()
                            Button(action: recenterToUser) {
                                Image(systemName: "location.fill")
                                    .font(.title2)
                                    .padding(12)
                                    .background(.thinMaterial, in: Circle())
                            }
                            .padding(16)
                            .accessibilityLabel("Recenter to my location")
                        }
                    }
                }
            }
            .navigationTitle("Near Me")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        // Map style picker
                        Section("Map Style") {
                            Picker("Map Style", selection: $mapStyleKey) {
                                Text("Standard").tag("standard")
                                Text("Muted").tag("muted")
                                Text("Satellite").tag("satellite")
                                Text("Hybrid").tag("hybrid")
                            }
                        }

                        // Location controls
                        Section("Location") {
                            Toggle("Show My Location", isOn: $showsUserLocation)
                            Button("Recenter", action: recenterToUser)
                        }

                        // Share/copy current location
                        if let shareURL = shareURLForCurrentLocation() {
                            Section("Share") {
                                ShareLink(item: shareURL) {
                                    Label("Share My Location", systemImage: "square.and.arrow.up")
                                }
                                Button {
                                    UIPasteboard.general.string = shareURL.absoluteString
                                    haptic(.light)
                                } label: {
                                    Label("Copy Maps Link", systemImage: "doc.on.doc")
                                }
                            }
                        }

                        // Items management
                        Section("Items") {
                            Button("Manage Items") { showItemsSheet = true }
                            if !items.isEmpty {
                                Button(role: .destructive) {
                                    clearAllItems()
                                } label: {
                                    Label("Clear All", systemImage: "trash")
                                }
                            }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .sheet(isPresented: $showItemsSheet) {
                ItemsSheet(items: items,
                           addItem: addItem,
                           deleteItems: deleteItems)
                    .environment(\.managedObjectContext, viewContext)
                    .presentationDetents([.medium, .large])
            }
            .onAppear {
                // Initialize camera from persisted region if available
                let region = MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: lastLat, longitude: lastLon),
                    span: MKCoordinateSpan(latitudeDelta: lastSpanLat, longitudeDelta: lastSpanLon)
                )
                position = .region(region)
            }
        }
    }

    // MARK: - Derived values

    private var currentMapStyle: MapStyle {
        switch mapStyleKey {
        case "muted": return .standard
        case "satellite": return .imagery
        case "hybrid": return .hybrid
        default: return .standard
        }
    }

    private var needsAuthorizationBanner: Bool {
        switch locationManager.authorizationStatus {
        case .denied, .restricted: return true
        default: return false
        }
    }

    private var locationInfoText: String? {
        guard let loc = locationManager.lastLocation else { return nil }
        let lat = String(format: "%.5f", loc.coordinate.latitude)
        let lon = String(format: "%.5f", loc.coordinate.longitude)
        let acc = String(format: "%.0f", loc.horizontalAccuracy)
        return "Lat: \(lat)  Lon: \(lon)  ±\(acc)m"
    }

    // MARK: - Actions

    private func handleOnAppear() {
        switch locationManager.authorizationStatus {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            locationManager.startUpdatingLocation()
        default:
            break
        }
    }

    private func recenterToUser() {
        guard let loc = locationManager.lastLocation else { return }
        withAnimation(.easeInOut) {
            position = .region(
                MKCoordinateRegion(
                    center: loc.coordinate,
                    span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)
                )
            )
        }
        haptic(.light)
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            openURL(url)
        }
    }

    private func shareURLForCurrentLocation() -> URL? {
        guard let loc = locationManager.lastLocation else { return nil }
        let lat = loc.coordinate.latitude
        let lon = loc.coordinate.longitude
        let urlString = "http://maps.apple.com/?ll=\(lat),\(lon)"
        return URL(string: urlString)
    }

    private func persist(region: MKCoordinateRegion) {
        lastLat = region.center.latitude
        lastLon = region.center.longitude
        lastSpanLat = region.span.latitudeDelta
        lastSpanLon = region.span.longitudeDelta
    }

    private func clearAllItems() {
        let all = IndexSet(items.indices)
        deleteItems(offsets: all)
    }

    private func addItem() {
        withAnimation {
            let newItem = Item(context: viewContext)
            newItem.timestamp = Date()

            do {
                try viewContext.save()
            } catch {
                let nsError = error as NSError
                fatalError("Unresolved error \(nsError), \(nsError.userInfo)")
            }
        }
    }

    private func deleteItems(offsets: IndexSet) {
        withAnimation {
            offsets.map { items[$0] }.forEach(viewContext.delete)

            do {
                try viewContext.save()
            } catch {
                let nsError = error as NSError
                fatalError("Unresolved error \(nsError), \(nsError.userInfo)")
            }
        }
    }

    private func haptic(_ style: UIImpactFeedbackGenerator.FeedbackStyle) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.impactOccurred()
    }
}

private struct DroppedPin: Identifiable {
    let id = UUID()
    let coordinate: CLLocationCoordinate2D
    var title: String { "Pin" }
}

private struct TapOverlay: View {
    let proxy: MapProxy
    let onTap: (CLLocationCoordinate2D) -> Void

    var body: some View {
        Color.clear
            .contentShape(Rectangle())
            .gesture(SpatialTapGesture().onEnded { value in
                let point = CGPoint(x: value.location.x, y: value.location.y)
                if let coord = proxy.convert(point, from: .local) {
                    onTap(coord)
                }
            })
    }
}

private struct AuthorizationBanner: View {
    var openSettings: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "location.slash")
                .foregroundStyle(.white)
            Text("Location access is off. Enable it in Settings.")
                .foregroundStyle(.white)
            Spacer(minLength: 8)
            Button("Open Settings", action: openSettings)
                .buttonStyle(.borderedProminent)
                .tint(.white)
                .foregroundStyle(.blue)
        }
        .font(.footnote)
        .padding(10)
        .background(.ultraThinMaterial, in: Capsule())
        .padding(.horizontal)
        .shadow(radius: 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Location access is off. Open Settings.")
    }
}

private struct InfoCard: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.footnote.monospaced())
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(.thinMaterial, in: Capsule())
            .shadow(radius: 2)
            .accessibilityLabel(text)
    }
}

private let itemFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateStyle = .short
    formatter.timeStyle = .medium
    return formatter
}()

#Preview {
    ContentView().environment(\.managedObjectContext, PersistenceController.preview.container.viewContext)
}
