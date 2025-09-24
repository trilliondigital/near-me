import SwiftUI
import CoreLocation

// MARK: - Onboarding Components
struct OnboardingContainer: View {
    @ObservedObject var onboardingManager: OnboardingManager
    @EnvironmentObject var locationManager: LocationManager
    @EnvironmentObject var notificationManager: NotificationManager
    
    var body: some View {
        VStack(spacing: 0) {
            // Progress Bar
            OnboardingProgressBar(
                currentStep: onboardingManager.currentStepIndex,
                totalSteps: onboardingManager.totalSteps,
                progress: onboardingManager.progressPercentage
            )
            
            // Content
            TabView(selection: $onboardingManager.currentStep) {
                WelcomeOnboardingView(onboardingManager: onboardingManager)
                    .tag(OnboardingStep.welcome)
                
                ConceptOnboardingView(onboardingManager: onboardingManager)
                    .tag(OnboardingStep.concept)
                
                PermissionsOnboardingView(onboardingManager: onboardingManager)
                    .tag(OnboardingStep.permissions)
                
                PreferencesOnboardingView(onboardingManager: onboardingManager)
                    .tag(OnboardingStep.preferences)
                
                LocationsOnboardingView(onboardingManager: onboardingManager)
                    .tag(OnboardingStep.locations)
                
                CategoriesOnboardingView(onboardingManager: onboardingManager)
                    .tag(OnboardingStep.categories)
                
                PreviewOnboardingView(onboardingManager: onboardingManager)
                    .tag(OnboardingStep.preview)
                
                CompleteOnboardingView(onboardingManager: onboardingManager)
                    .tag(OnboardingStep.complete)
            }
            .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
            .animation(.easeInOut, value: onboardingManager.currentStep)
            
            // Navigation Controls
            OnboardingNavigationControls(onboardingManager: onboardingManager)
        }
        .background(DesignSystem.Colors.background)
    }
}

// MARK: - Progress Bar
struct OnboardingProgressBar: View {
    let currentStep: Int
    let totalSteps: Int
    let progress: Double
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.sm) {
            HStack {
                Text("Step \(currentStep + 1) of \(totalSteps)")
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                
                Spacer()
                
                Text("\(Int(progress * 100))%")
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
            }
            
            ProgressView(value: progress)
                .progressViewStyle(LinearProgressViewStyle(tint: DesignSystem.Colors.primary))
                .scaleEffect(x: 1, y: 2, anchor: .center)
        }
        .padding(.horizontal, DesignSystem.Spacing.padding)
        .padding(.top, DesignSystem.Spacing.md)
    }
}

// MARK: - Navigation Controls
struct OnboardingNavigationControls: View {
    @ObservedObject var onboardingManager: OnboardingManager
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.md) {
            HStack(spacing: DesignSystem.Spacing.md) {
                if onboardingManager.currentStep != .welcome {
                    SecondaryButton(
                        title: "Back",
                        action: { onboardingManager.previousStep() }
                    )
                }
                
                Spacer()
                
                if onboardingManager.currentStep == .complete {
                    PrimaryButton(
                        title: "Get Started",
                        action: { onboardingManager.completeOnboarding() }
                    )
                } else {
                    PrimaryButton(
                        title: onboardingManager.currentStep == .preview ? "Complete Setup" : "Continue",
                        action: { onboardingManager.nextStep() }
                    )
                }
            }
            
            if onboardingManager.currentStep != .complete {
                Button("Skip for now") {
                    onboardingManager.completeOnboarding()
                }
                .font(DesignSystem.Typography.caption1)
                .foregroundColor(DesignSystem.Colors.textSecondary)
            }
        }
        .padding(.horizontal, DesignSystem.Spacing.padding)
        .padding(.bottom, DesignSystem.Spacing.xl)
    }
}

// MARK: - Welcome Screen
struct WelcomeOnboardingView: View {
    @ObservedObject var onboardingManager: OnboardingManager
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.xl) {
            Spacer()
            
            // App Icon and Title
            VStack(spacing: DesignSystem.Spacing.lg) {
                Image(systemName: "location.circle.fill")
                    .font(.system(size: 80, weight: .light))
                    .foregroundColor(DesignSystem.Colors.primary)
                
                VStack(spacing: DesignSystem.Spacing.sm) {
                    Text("Near Me")
                        .font(DesignSystem.Typography.largeTitle)
                        .fontWeight(.bold)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    Text("Location-aware reminders")
                        .font(DesignSystem.Typography.title3)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
            }
            
            // Description
            VStack(spacing: DesignSystem.Spacing.md) {
                Text("Never forget important tasks when you're near the right places")
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                
                Text("Get reminded to buy groceries when you're near the store, or pick up prescriptions when you're at the pharmacy.")
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            
            // Feature Highlights
            VStack(spacing: DesignSystem.Spacing.md) {
                FeatureHighlight(
                    icon: "location.fill",
                    title: "Smart Location Detection",
                    description: "Automatically detects when you're approaching or arriving at relevant places"
                )
                
                FeatureHighlight(
                    icon: "bell.fill",
                    title: "Timely Notifications",
                    description: "Get reminders at the perfect moment, not too early or too late"
                )
                
                FeatureHighlight(
                    icon: "shield.fill",
                    title: "Privacy First",
                    description: "Your location data stays on your device and is never shared"
                )
            }
            
            Spacer()
        }
        .padding(.horizontal, DesignSystem.Spacing.padding)
    }
}

// MARK: - Concept Screen
struct ConceptOnboardingView: View {
    @ObservedObject var onboardingManager: OnboardingManager
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.xl) {
            Spacer()
            
            // Title
            VStack(spacing: DesignSystem.Spacing.sm) {
                Text("How It Works")
                    .font(DesignSystem.Typography.title1)
                    .fontWeight(.bold)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text("Simple, smart, and helpful")
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
            }
            
            // Visual Example
            VStack(spacing: DesignSystem.Spacing.lg) {
                // Map visualization
                ZStack {
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.lg)
                        .fill(DesignSystem.Colors.surface)
                        .frame(height: 200)
                    
                    VStack(spacing: DesignSystem.Spacing.md) {
                        // User location
                        HStack {
                            Circle()
                                .fill(DesignSystem.Colors.primary)
                                .frame(width: 20, height: 20)
                            Text("You")
                                .font(DesignSystem.Typography.caption1)
                                .foregroundColor(DesignSystem.Colors.textPrimary)
                        }
                        
                        // Geofence circles
                        ZStack {
                            Circle()
                                .stroke(DesignSystem.Colors.primary.opacity(0.3), lineWidth: 2)
                                .frame(width: 120, height: 120)
                            
                            Circle()
                                .stroke(DesignSystem.Colors.primary.opacity(0.5), lineWidth: 2)
                                .frame(width: 80, height: 80)
                            
                            Circle()
                                .stroke(DesignSystem.Colors.primary, lineWidth: 2)
                                .frame(width: 40, height: 40)
                            
                            Image(systemName: "cart.fill")
                                .foregroundColor(DesignSystem.Colors.primary)
                                .font(.title2)
                        }
                        
                        Text("Grocery Store")
                            .font(DesignSystem.Typography.caption1)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                    }
                }
                
                // Step-by-step explanation
                VStack(spacing: DesignSystem.Spacing.md) {
                    ConceptStep(
                        number: 1,
                        title: "Create a Task",
                        description: "Add tasks like 'Buy groceries' and select the relevant location",
                        icon: "plus.circle.fill"
                    )
                    
                    ConceptStep(
                        number: 2,
                        title: "Set Geofences",
                        description: "We create invisible boundaries around your locations",
                        icon: "location.circle.fill"
                    )
                    
                    ConceptStep(
                        number: 3,
                        title: "Get Reminded",
                        description: "Receive notifications when you're approaching or arriving",
                        icon: "bell.circle.fill"
                    )
                }
            }
            
            Spacer()
        }
        .padding(.horizontal, DesignSystem.Spacing.padding)
    }
}

// MARK: - Supporting Views
struct FeatureHighlight: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(DesignSystem.Colors.primary)
                .frame(width: 30)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text(description)
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
            }
            
            Spacer()
        }
    }
}

struct ConceptStep: View {
    let number: Int
    let title: String
    let description: String
    let icon: String
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            ZStack {
                Circle()
                    .fill(DesignSystem.Colors.primary)
                    .frame(width: 32, height: 32)
                
                Text("\(number)")
                    .font(DesignSystem.Typography.caption1)
                    .fontWeight(.bold)
                    .foregroundColor(DesignSystem.Colors.textInverse)
            }
            
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(DesignSystem.Colors.primary)
                .frame(width: 30)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text(description)
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
            }
            
            Spacer()
        }
    }
}

// MARK: - Previews
struct OnboardingComponents_Previews: PreviewProvider {
    static var previews: some View {
        OnboardingContainer(onboardingManager: OnboardingManager())
            .environmentObject(LocationManager())
            .environmentObject(NotificationManager())
    }
}
