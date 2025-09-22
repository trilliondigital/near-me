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

## Testing

### Backend (Node/Express)

Prereqs:
- Postgres and Redis running locally. The simplest way is to use the project compose file:
  - From `database/`, run: `docker-compose up -d` (Postgres on 5432, Redis on 6379)

Commands (run inside `backend/`):
- `npm install` (first time only, to install all deps)
- `npm test` (runs Jest with coverage; 90% global threshold enforced)
- `npm run test:watch` (watch mode for local development)
- Coverage output: `backend/coverage/` (HTML report at `coverage/lcov-report/index.html`)

Test environment:
- `src/test/setup.ts` automatically:
  - Connects to Postgres/Redis using `.env.test`
  - Applies SQL schema from `database/init/`
  - Truncates all public tables and flushes Redis between tests

### iOS (Xcode / Swift)

You can run tests in Xcode or via CLI:
- Xcode: Product > Test
- CLI example:
  ```bash
  xcodebuild -project NearMe.xcodeproj \
    -scheme NearMe \
    -destination 'platform=iOS Simulator,name=iPhone 15,OS=17.0' \
    -configuration Debug \
    test
  ```

### Android (Gradle / Kotlin)

Run from the `android/` directory:
- Unit tests: `./gradlew testDebugUnitTest`
- Lint: `./gradlew lint`
- Build Debug APK: `./gradlew assembleDebug`
- Instrumented tests (if configured): `./gradlew connectedDebugAndroidTest`

### Continuous Integration

GitHub Actions workflows are provided in `.github/workflows/`:
- Backend: spins up Postgres (PostGIS-enabled) and Redis services, runs lint, build, and Jest tests with coverage upload
- iOS: builds and runs tests on macOS runners using Xcode 15
- Android: runs lint, builds Debug, and runs unit tests

Notes:
- Backend CI uses the PostGIS image to support `CREATE EXTENSION postgis` used by schema SQL
- Ensure any new tests are deterministic (DB is truncated and Redis flushed per test)

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

## Release

- Store listings templates: `Near Me Documents/Release/AppStore_Listing_Template.md`, `Near Me Documents/Release/PlayStore_Listing_Template.md`
- Staged rollout plan: `Near Me Documents/Release/Rollout_Plan.md`
- Support & FAQ: `Near Me Documents/Release/Support_and_FAQ.md`
- Launch validation checklist: `Near Me Documents/Release/Launch_Validation_Checklist.md`
- Privacy policy draft: `Near Me Documents/Release/Privacy_Policy_Draft.md`
- Monitoring dashboard: `backend/src/dashboard/` (includes Launch KPIs)

### Android (Release build)

- Update `versionCode`/`versionName` in `android/app/build.gradle`
- Generate AAB: `cd android && ./gradlew bundleRelease`
- Upload to Play Console and start staged rollout per the rollout plan

### iOS (App Store)

- Update `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` in `NearMe.xcodeproj`
- Archive and upload via Xcode Organizer
- Configure App Store Connect listing and in-app purchases

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