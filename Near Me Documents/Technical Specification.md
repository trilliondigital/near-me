# Technical Specification

[← Back](./✱ Near Me.md#near-me--wiki)



Clients: iOS (SwiftUI + CoreLocation), Android (Kotlin + FusedLocation + Geofencing).
Services: Geofencing, POI, Notification, Analytics.
Background: low-power signals; escalate near candidates; recover from process death.
Offline: cached POIs.
Errors: backoff; local event queue.

See Architecture]] • [[API Endpoints]] • [[Geofencing Tuning Guide.