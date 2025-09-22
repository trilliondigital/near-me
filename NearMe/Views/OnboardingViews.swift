import SwiftUI
import CoreLocation

// MARK: - Onboarding Container
struct OnboardingContainer: View {
    @ObservedObject var onboardingManager: OnboardingManager
    @EnvironmentObject var locationManager: LocationManager
    @EnvironmentObject var notificationManager: NotificationManager
    
    var body: some View {
        ZStack {
            DesignSystem.Colors.background
                .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Progress Bar
                OnboardingProgressBar(
                    currentStep: onboardingManager.currentStep,
                    totalSteps: onboardingManager.totalSteps
                )
                .padding(.horizontal, DesignSystem.Spacing.lg)
                .padding(.top, DesignSystem.Spacing.md)
                
                // Content
                TabView(selection: $onboardingManager.currentStep) {
                    ForEach(OnboardingStep.allCases, id: \.self) { step in
                        onboardingView(for: step)
                            .tag(step)
                    }
                }
                .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
                .animation(DesignSystem.Animation.medium, value: onboardingManager.currentStep)
                
                // Navigation Buttons
                OnboardingNavigationButtons(onboardingManager: onboardingManager)
                    .padding(.horizontal, DesignSystem.Spacing.lg)
                    .padding(.bottom, DesignSystem.Spacing.xl)
            }
        }
    }
    
    @ViewBuilder
    private func onboardingView(for step: OnboardingStep) -> some View {
        switch step {
        case .welcome:
            OnboardingWelcomeView()
        case .concept:
            OnboardingConceptView()
        case .permissions:
            OnboardingPermissionsView()
                .environmentObject(locationManager)
                .environmentObject(notificationManager)
        case .preferences:
            OnboardingPreferencesView(onboardingManager: onboardingManager)
        case .locations:
            OnboardingLocationsView(onboardingManager: onboardingManager)
        case .categories:
            OnboardingCategoriesView(onboardingManager: onboardingManager)
        case .preview:
            OnboardingPreviewView()
        case .complete:
            OnboardingCompleteView(onboardingManager: onboardingManager)
        }
    }
}

// MARK: - Progress Bar
struct OnboardingProgressBar: View {
    let currentStep: OnboardingStep
    let totalSteps: Int
    
    private var progress: Double {
        Double(currentStep.rawValue) / Double(totalSteps - 1)
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
            HStack {
                Text("Step \(currentStep.rawValue + 1) of \(totalSteps)")
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                Spacer()
            }
            
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(DesignSystem.Colors.borderLight)
                        .frame(height: 4)
                        .cornerRadius(2)
                    
                    Rectangle()
                        .fill(DesignSystem.Colors.primary)
                        .frame(width: geometry.size.width * progress, height: 4)
                        .cornerRadius(2)
                        .animation(DesignSystem.Animation.medium, value: progress)
                }
            }
            .frame(height: 4)
        }
    }
}

// MARK: - Welcome View
struct OnboardingWelcomeView: View {
    var body: some View {
        OnboardingPageTemplate(
            title: "Welcome to Near Me",
            subtitle: "The reminder that meets you where you are",
            content: {
                VStack(spacing: DesignSystem.Spacing.xl) {
                    // Hero Illustration
                    Image(systemName: "location.circle.fill")
                        .font(.system(size: 120))
                        .foregroundColor(DesignSystem.Colors.primary)
                        .symbolRenderingMode(.hierarchical)
                    
                    VStack(spacing: DesignSystem.Spacing.md) {
                        Text("Never forget another errand")
                            .font(DesignSystem.Typography.title2)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                            .multilineTextAlignment(.center)
                        
                        Text("Get gentle reminders for your tasks when you're near the right places to complete them.")
                            .font(DesignSystem.Typography.body)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                            .multilineTextAlignment(.center)
                            .lineLimit(nil)
                    }
                }
            }
        )
    }
}

// MARK: - Concept View
struct OnboardingConceptView: View {
    var body: some View {
        OnboardingPageTemplate(
            title: "How It Works",
            subtitle: "Smart reminders based on your location",
            content: {
                VStack(spacing: DesignSystem.Spacing.xl) {
                    VStack(spacing: DesignSystem.Spacing.lg) {
                        ConceptStep(
                            icon: "plus.circle.fill",
                            title: "Create Tasks",
                            description: "Add reminders for things you need to do at specific places or categories of places."
                        )
                        
                        ConceptStep(
                            icon: "location.fill",
                            title: "We Watch Your Location",
                            description: "When you're approaching or arriving at relevant places, we'll gently remind you."
                        )
                        
                        ConceptStep(
                            icon: "checkmark.circle.fill",
                            title: "Complete & Forget",
                            description: "Mark tasks as done or snooze them. We'll keep reminding until you're ready."
                        )
                    }
                    
                    VStack(spacing: DesignSystem.Spacing.sm) {
                        Text("Example:")
                            .font(DesignSystem.Typography.bodyEmphasized)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                        
                        ExampleNotificationCard()
                    }
                }
            }
        )
    }
}

// MARK: - Permissions View
struct OnboardingPermissionsView: View {
    @EnvironmentObject var locationManager: LocationManager
    @EnvironmentObject var notificationManager: NotificationManager
    @State private var locationPermissionGranted = false
    @State private var notificationPermissionGranted = false
    
    var body: some View {
        OnboardingPageTemplate(
            title: "Permissions",
            subtitle: "We need a couple of permissions to work properly",
            content: {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    PermissionCard(
                        icon: "location.fill",
                        title: "Location Access",
                        description: "We use your location to know when you're near places where you have tasks to complete.",
                        isGranted: locationPermissionGranted,
                        action: requestLocationPermission
                    )
                    
                    PermissionCard(
                        icon: "bell.fill",
                        title: "Notifications",
                        description: "We'll send you gentle reminders when you're near relevant places.",
                        isGranted: notificationPermissionGranted,
                        action: requestNotificationPermission
                    )
                    
                    VStack(spacing: DesignSystem.Spacing.sm) {
                        Text("Privacy First")
                            .font(DesignSystem.Typography.bodyEmphasized)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                        
                        Text("Your location data stays on your device. We only use it to determine when to send reminders.")
                            .font(DesignSystem.Typography.footnote)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, DesignSystem.Spacing.md)
                }
            }
        )
        .onAppear {
            checkPermissionStatus()
        }
    }
    
    private func requestLocationPermission() {
        locationManager.requestLocationPermission()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            checkPermissionStatus()
        }
    }
    
    private func requestNotificationPermission() {
        notificationManager.requestNotificationPermission { granted in
            DispatchQueue.main.async {
                notificationPermissionGranted = granted
            }
        }
    }
    
    private func checkPermissionStatus() {
        locationPermissionGranted = locationManager.authorizationStatus == .authorizedWhenInUse || 
                                   locationManager.authorizationStatus == .authorizedAlways
        
        notificationManager.checkNotificationPermission { granted in
            DispatchQueue.main.async {
                notificationPermissionGranted = granted
            }
        }
    }
}

// MARK: - Preferences View
struct OnboardingPreferencesView: View {
    @ObservedObject var onboardingManager: OnboardingManager
    @State private var preferences: NotificationPreferences
    
    init(onboardingManager: OnboardingManager) {
        self.onboardingManager = onboardingManager
        self._preferences = State(initialValue: onboardingManager.preferences.notificationPreferences)
    }
    
    var body: some View {
        OnboardingPageTemplate(
            title: "Notification Preferences",
            subtitle: "Customize when and how you receive reminders",
            content: {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    VStack(spacing: DesignSystem.Spacing.md) {
                        PreferenceToggle(
                            title: "Approach Notifications",
                            description: "Get notified when you're getting close (1-5 miles away)",
                            isOn: $preferences.approachNotifications
                        )
                        
                        PreferenceToggle(
                            title: "Arrival Notifications",
                            description: "Get notified when you arrive at a location",
                            isOn: $preferences.arrivalNotifications
                        )
                        
                        PreferenceToggle(
                            title: "Post-Arrival Reminders",
                            description: "Get reminded if you haven't completed a task after 5 minutes",
                            isOn: $preferences.postArrivalNotifications
                        )
                    }
                    
                    Divider()
                        .padding(.vertical, DesignSystem.Spacing.sm)
                    
                    VStack(spacing: DesignSystem.Spacing.md) {
                        PreferenceToggle(
                            title: "Quiet Hours",
                            description: "Pause notifications during specific hours",
                            isOn: $preferences.quietHoursEnabled
                        )
                        
                        if preferences.quietHoursEnabled {
                            QuietHoursSelector(
                                startTime: $preferences.quietStartTime,
                                endTime: $preferences.quietEndTime,
                                weekendQuietHours: $preferences.weekendQuietHours
                            )
                        }
                    }
                }
            }
        )
        .onChange(of: preferences) { newPreferences in
            onboardingManager.updateNotificationPreferences(newPreferences)
        }
    }
}

// MARK: - Supporting Views
struct ConceptStep: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(alignment: .top, spacing: DesignSystem.Spacing.md) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(DesignSystem.Colors.primary)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                Text(title)
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text(description)
                    .font(DesignSystem.Typography.callout)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .lineLimit(nil)
            }
            
            Spacer()
        }
    }
}

struct ExampleNotificationCard: View {
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            Image(systemName: "location.fill")
                .font(.title3)
                .foregroundColor(DesignSystem.Colors.primary)
            
            VStack(alignment: .leading, spacing: 2) {
                Text("Near Me")
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text("You're 2 miles from Whole Foods — pick up groceries?")
                    .font(DesignSystem.Typography.callout)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
            }
            
            Spacer()
        }
        .padding(DesignSystem.Spacing.md)
        .background(DesignSystem.Colors.card)
        .cornerRadius(DesignSystem.CornerRadius.md)
        .designSystemShadow(DesignSystem.Shadow.small)
    }
}

struct PermissionCard: View {
    let icon: String
    let title: String
    let description: String
    let isGranted: Bool
    let action: () -> Void
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.md) {
            HStack(alignment: .top, spacing: DesignSystem.Spacing.md) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(isGranted ? DesignSystem.Colors.success : DesignSystem.Colors.primary)
                
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    Text(title)
                        .font(DesignSystem.Typography.bodyEmphasized)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    Text(description)
                        .font(DesignSystem.Typography.callout)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .lineLimit(nil)
                }
                
                Spacer()
                
                if isGranted {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title3)
                        .foregroundColor(DesignSystem.Colors.success)
                }
            }
            
            if !isGranted {
                Button(action: action) {
                    Text("Grant Permission")
                        .font(DesignSystem.Typography.buttonMedium)
                        .foregroundColor(DesignSystem.Colors.textInverse)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, DesignSystem.Spacing.sm)
                        .background(DesignSystem.Colors.primary)
                        .cornerRadius(DesignSystem.CornerRadius.md)
                }
            }
        }
        .padding(DesignSystem.Spacing.md)
        .background(DesignSystem.Colors.card)
        .cornerRadius(DesignSystem.CornerRadius.md)
        .designSystemShadow(DesignSystem.Shadow.small)
    }
}

struct PreferenceToggle: View {
    let title: String
    let description: String
    @Binding var isOn: Bool
    
    var body: some View {
        HStack(alignment: .top, spacing: DesignSystem.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                Text(title)
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text(description)
                    .font(DesignSystem.Typography.callout)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .lineLimit(nil)
            }
            
            Spacer()
            
            Toggle("", isOn: $isOn)
                .labelsHidden()
        }
    }
}

struct QuietHoursSelector: View {
    @Binding var startTime: Date
    @Binding var endTime: Date
    @Binding var weekendQuietHours: Bool
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.md) {
            HStack {
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    Text("Start Time")
                        .font(DesignSystem.Typography.callout)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                    
                    DatePicker("", selection: $startTime, displayedComponents: .hourAndMinute)
                        .labelsHidden()
                        .datePickerStyle(CompactDatePickerStyle())
                }
                
                Spacer()
                
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    Text("End Time")
                        .font(DesignSystem.Typography.callout)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                    
                    DatePicker("", selection: $endTime, displayedComponents: .hourAndMinute)
                        .labelsHidden()
                        .datePickerStyle(CompactDatePickerStyle())
                }
            }
            
            PreferenceToggle(
                title: "Weekend Quiet Hours",
                description: "Apply quiet hours on weekends too",
                isOn: $weekendQuietHours
            )
        }
        .padding(DesignSystem.Spacing.md)
        .background(DesignSystem.Colors.surface)
        .cornerRadius(DesignSystem.CornerRadius.md)
    }
}

// MARK: - Page Template
struct OnboardingPageTemplate<Content: View>: View {
    let title: String
    let subtitle: String
    let content: Content
    
    init(title: String, subtitle: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.content = content()
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: DesignSystem.Spacing.xl) {
                VStack(spacing: DesignSystem.Spacing.md) {
                    Text(title)
                        .font(DesignSystem.Typography.largeTitle)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                        .multilineTextAlignment(.center)
                    
                    Text(subtitle)
                        .font(DesignSystem.Typography.body)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(nil)
                }
                .padding(.top, DesignSystem.Spacing.xl)
                
                content
                
                Spacer(minLength: DesignSystem.Spacing.xxxl)
            }
            .padding(.horizontal, DesignSystem.Spacing.lg)
        }
    }
}

// MARK: - Navigation Buttons
struct OnboardingNavigationButtons: View {
    @ObservedObject var onboardingManager: OnboardingManager
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            if onboardingManager.currentStep != .welcome {
                Button("Back") {
                    onboardingManager.previousStep()
                }
                .font(DesignSystem.Typography.buttonMedium)
                .foregroundColor(DesignSystem.Colors.textSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, DesignSystem.Spacing.md)
                .background(DesignSystem.Colors.surface)
                .cornerRadius(DesignSystem.CornerRadius.md)
            }
            
            Button(nextButtonTitle) {
                if onboardingManager.currentStep == .complete {
                    onboardingManager.completeOnboarding()
                } else {
                    onboardingManager.nextStep()
                }
            }
            .font(DesignSystem.Typography.buttonMedium)
            .foregroundColor(DesignSystem.Colors.textInverse)
            .frame(maxWidth: .infinity)
            .padding(.vertical, DesignSystem.Spacing.md)
            .background(onboardingManager.canProceedToNextStep ? DesignSystem.Colors.primary : DesignSystem.Colors.border)
            .cornerRadius(DesignSystem.CornerRadius.md)
            .disabled(!onboardingManager.canProceedToNextStep)
        }
    }
    
    private var nextButtonTitle: String {
        switch onboardingManager.currentStep {
        case .complete:
            return "Get Started"
        case .preview:
            return "Continue"
        default:
            return "Next"
        }
    }
}