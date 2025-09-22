# Near Me

A location-aware reminder application that helps users complete context-sensitive tasks by delivering timely notifications when they approach, arrive at, or spend time at relevant locations.

## Project Structure

```
Near Me/
├── NearMe/                 # iOS app (SwiftUI)
├── android/                # Android app (Kotlin + Jetpack Compose)
├── backend/                # Node.js/Express API server
├── database/               # Database configuration and migrations
├── .github/workflows/      # CI/CD pipelines
└── Near Me Documents/      # Project documentation
```

## Development Setup

### Prerequisites

- **iOS Development**: Xcode 15+, iOS 16+ target
- **Android Development**: Android Studio, JDK 17+, Android API 26+
- **Backend Development**: Node.js 18+, npm/yarn
- **Database**: Docker & Docker Compose

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "Near Me"
   ```

2. **Start development databases**
   ```bash
   cd database
   docker-compose up -d
   ```

3. **Set up backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   npm run dev
   ```

4. **iOS Development**
   - Open `NearMe.xcodeproj` in Xcode
   - Build and run on simulator or device

5. **Android Development**
   - Open `android/` folder in Android Studio
   - Build and run on emulator or device

## Features

- **Tiered Geofencing**: Multiple notification zones (5mi, 3mi, 1mi, arrival, post-arrival)
- **Smart Notifications**: Context-aware reminders with snooze and completion actions
- **Privacy-First**: On-device processing, minimal data collection
- **Battery Optimized**: Efficient location monitoring and visit detection
- **Cross-Platform**: Native iOS and Android apps with shared backend

## Architecture

- **Mobile Apps**: SwiftUI (iOS) and Jetpack Compose (Android)
- **Backend**: Node.js/Express with TypeScript
- **Database**: PostgreSQL with PostGIS for geospatial data
- **Cache**: Redis for session management and performance
- **Location Services**: CoreLocation (iOS) and FusedLocationProvider (Android)

## Development Status

This project is currently in active development. See the [task list](.kiro/specs/near-me-v1/tasks.md) for implementation progress.

## License

MIT License - see LICENSE file for details.

A location-based iOS app built with Swift and UIKit.

## Features

- Location-based services
- Clean, modern UI
- iOS 17+ support

## Setup

1. Open `NearMe.xcodeproj` in Xcode
2. Select your development team in project settings
3. Build and run on simulator or device

## Development

- **Language**: Swift 5.0
- **Minimum iOS**: 17.0
- **Architecture**: MVC with Storyboards

## Getting Started

The app is ready to build and run. The main view controller displays a simple "Near Me App" label. You can start adding location services and UI components from here.

## Next Steps

- Add Core Location framework
- Implement location permissions
- Add map view
- Create location-based features