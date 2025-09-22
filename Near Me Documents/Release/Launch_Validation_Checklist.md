# Launch Validation Checklist

## iOS
- [ ] Bump `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in `NearMe.xcodeproj/project.pbxproj`
- [ ] Verify `UIBackgroundModes`: `location`, `fetch`, `remote-notification` in `NearMe/Info.plist`
- [ ] Ensure location usage descriptions present (build settings inject)
- [ ] Archive in Xcode and validate in Organizer
- [ ] Test push token registration and APNs
- [ ] Manual route simulation for geofences: 5/3/1, arrival, post-arrival

## Android
- [ ] Update `versionCode` and `versionName` in `android/app/build.gradle`
- [ ] Verify `ACCESS_BACKGROUND_LOCATION`, `POST_NOTIFICATIONS`, `WAKE_LOCK`, `INTERNET` in `AndroidManifest.xml`
- [ ] Ensure FCM service `exported=true`
- [ ] Build release AAB: `./gradlew bundleRelease`
- [ ] Test background geofences and notification actions

## Backend/Monitoring
- [ ] Verify `/api/analytics/*` and `/api/monitoring/*` endpoints healthy
- [ ] Dashboard shows Launch KPIs

## Store Metadata
- [ ] App name, subtitle/short description, full description
- [ ] Screenshots for required sizes
- [ ] Privacy policy URL and contact details
- [ ] In-app purchases configured (iOS) / Subscriptions (Android)

## Go/No-Go gates
- [ ] Crash-free > 99.5%
- [ ] API success > 99%
- [ ] p95 latency < 800ms
