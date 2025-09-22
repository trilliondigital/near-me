import SwiftUI

// MARK: - User Education Components
struct UserEducationView: View {
    let config: UserEducationConfig
    @State private var currentStep = 0
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Progress Indicator
                if config.steps.count > 1 {
                    ProgressIndicator(
                        currentStep: currentStep,
                        totalSteps: config.steps.count
                    )
                    .padding(.horizontal, DesignSystem.Spacing.lg)
                    .padding(.top, DesignSystem.Spacing.md)
                }
                
                // Content
                TabView(selection: $currentStep) {
                    ForEach(Array(config.steps.enumerated()), id: \.offset) { index, step in
                        EducationStepView(
                            step: step,
                            isLastStep: index == config.steps.count - 1,
                            onNext: {
                                if index < config.steps.count - 1 {
                                    withAnimation(.easeInOut(duration: 0.3)) {
                                        currentStep = index + 1
                                    }
                                } else {
                                    config.onComplete()
                                    dismiss()
                                }
                            },
                            onSkip: {
                                config.onSkip?()
                                dismiss()
                            }
                        )
                        .tag(index)
                    }
                }
                .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Skip") {
                        config.onSkip?()
                        dismiss()
                    }
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                }
            }
        }
    }
}

// MARK: - Education Step View
struct EducationStepView: View {
    let step: EducationStep
    let isLastStep: Bool
    let onNext: () -> Void
    let onSkip: (() -> Void)?
    
    var body: some View {
        ScrollView {
            VStack(spacing: DesignSystem.Spacing.xl) {
                Spacer(minLength: DesignSystem.Spacing.lg)
                
                // Visual
                if let illustration = step.illustration {
                    illustration
                        .frame(maxHeight: 200)
                } else {
                    Image(systemName: step.icon)
                        .font(.system(size: 80))
                        .foregroundColor(DesignSystem.Colors.primary)
                }
                
                // Content
                VStack(spacing: DesignSystem.Spacing.lg) {
                    VStack(spacing: DesignSystem.Spacing.md) {
                        Text(step.title)
                            .font(DesignSystem.Typography.largeTitle)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                            .multilineTextAlignment(.center)
                        
                        Text(step.description)
                            .font(DesignSystem.Typography.body)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                            .multilineTextAlignment(.center)
                            .lineLimit(nil)
                    }
                    
                    // Interactive Demo
                    if let demo = step.interactiveDemo {
                        demo
                            .padding(.vertical, DesignSystem.Spacing.md)
                    }
                    
                    // Key Points
                    if !step.keyPoints.isEmpty {
                        VStack(spacing: DesignSystem.Spacing.sm) {
                            ForEach(step.keyPoints, id: \.self) { point in
                                KeyPointRow(text: point)
                            }
                        }
                    }
                }
                
                Spacer(minLength: DesignSystem.Spacing.xl)
                
                // Actions
                VStack(spacing: DesignSystem.Spacing.md) {
                    PrimaryButton(
                        title: isLastStep ? "Get Started" : "Continue",
                        action: onNext
                    )
                    
                    if !isLastStep && onSkip != nil {
                        Button("Skip Tutorial") {
                            onSkip?()
                        }
                        .font(DesignSystem.Typography.body)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                    }
                }
            }
            .padding(.horizontal, DesignSystem.Spacing.xl)
        }
    }
}

// MARK: - Key Point Row
struct KeyPointRow: View {
    let text: String
    
    var body: some View {
        HStack(alignment: .top, spacing: DesignSystem.Spacing.md) {
            Image(systemName: "checkmark.circle.fill")
                .font(.title3)
                .foregroundColor(DesignSystem.Colors.success)
            
            Text(text)
                .font(DesignSystem.Typography.body)
                .foregroundColor(DesignSystem.Colors.textPrimary)
                .multilineTextAlignment(.leading)
            
            Spacer()
        }
    }
}

// MARK: - Progress Indicator
struct ProgressIndicator: View {
    let currentStep: Int
    let totalSteps: Int
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.sm) {
            ForEach(0..<totalSteps, id: \.self) { index in
                Circle()
                    .fill(index <= currentStep ? DesignSystem.Colors.primary : DesignSystem.Colors.border)
                    .frame(width: 8, height: 8)
                    .animation(.easeInOut(duration: 0.3), value: currentStep)
            }
        }
    }
}

// MARK: - Education Configuration
struct UserEducationConfig {
    let steps: [EducationStep]
    let onComplete: () -> Void
    let onSkip: (() -> Void)?
    
    init(steps: [EducationStep], onComplete: @escaping () -> Void, onSkip: (() -> Void)? = nil) {
        self.steps = steps
        self.onComplete = onComplete
        self.onSkip = onSkip
    }
}

struct EducationStep {
    let title: String
    let description: String
    let icon: String
    let illustration: AnyView?
    let keyPoints: [String]
    let interactiveDemo: AnyView?
    
    init(
        title: String,
        description: String,
        icon: String,
        illustration: AnyView? = nil,
        keyPoints: [String] = [],
        interactiveDemo: AnyView? = nil
    ) {
        self.title = title
        self.description = description
        self.icon = icon
        self.illustration = illustration
        self.keyPoints = keyPoints
        self.interactiveDemo = interactiveDemo
    }
}

// MARK: - Predefined Education Flows
extension UserEducationConfig {
    // How Near Me Works
    static func howItWorks(onComplete: @escaping () -> Void) -> UserEducationConfig {
        UserEducationConfig(
            steps: [
                EducationStep(
                    title: "Location-Based Reminders",
                    description: "Near Me sends you reminders when you're near the right place to complete your tasks.",
                    icon: "location.circle.fill",
                    illustration: AnyView(
                        VStack(spacing: DesignSystem.Spacing.md) {
                            HStack(spacing: DesignSystem.Spacing.lg) {
                                VStack {
                                    Image(systemName: "mappin.circle.fill")
                                        .font(.system(size: 40))
                                        .foregroundColor(DesignSystem.Colors.primary)
                                    Text("Store")
                                        .font(DesignSystem.Typography.caption1)
                                        .foregroundColor(DesignSystem.Colors.textSecondary)
                                }
                                
                                Image(systemName: "arrow.right")
                                    .font(.title2)
                                    .foregroundColor(DesignSystem.Colors.textTertiary)
                                
                                VStack {
                                    Image(systemName: "bell.fill")
                                        .font(.system(size: 40))
                                        .foregroundColor(DesignSystem.Colors.warning)
                                    Text("Reminder")
                                        .font(DesignSystem.Typography.caption1)
                                        .foregroundColor(DesignSystem.Colors.textSecondary)
                                }
                            }
                        }
                    ),
                    keyPoints: [
                        "Get notified when approaching relevant locations",
                        "Never forget tasks when you're in the right place",
                        "Works automatically in the background"
                    ]
                ),
                
                EducationStep(
                    title: "Smart Geofencing",
                    description: "We use intelligent distance-based alerts that adapt to different types of locations.",
                    icon: "target",
                    keyPoints: [
                        "5-mile alerts for category-based tasks (gas stations, pharmacies)",
                        "2-mile alerts for specific places (home, work)",
                        "Arrival and post-arrival reminders for persistence"
                    ]
                ),
                
                EducationStep(
                    title: "Two Types of Tasks",
                    description: "Create reminders for specific places you know, or for any location in a category.",
                    icon: "list.bullet",
                    keyPoints: [
                        "Specific places: \"Pick up dry cleaning at Main Street Cleaners\"",
                        "Category-based: \"Get gas at any gas station\"",
                        "Perfect for both planned and opportunistic tasks"
                    ]
                ),
                
                EducationStep(
                    title: "Privacy First",
                    description: "Your location data stays on your device. We only process what's needed for reminders.",
                    icon: "lock.shield.fill",
                    keyPoints: [
                        "No continuous GPS tracking",
                        "Location processing happens on your device",
                        "Minimal data collection with strong encryption"
                    ]
                )
            ],
            onComplete: onComplete
        )
    }
    
    // Geofencing Explained
    static func geofencingExplained(onComplete: @escaping () -> Void) -> UserEducationConfig {
        UserEducationConfig(
            steps: [
                EducationStep(
                    title: "What are Geofences?",
                    description: "Geofences are virtual boundaries around locations that trigger notifications when you enter or exit them.",
                    icon: "circle.dashed",
                    keyPoints: [
                        "Invisible circles around places",
                        "Trigger when you cross the boundary",
                        "Work even when the app is closed"
                    ]
                ),
                
                EducationStep(
                    title: "Multiple Alert Zones",
                    description: "Each task creates multiple geofences at different distances to give you several chances to remember.",
                    icon: "target",
                    interactiveDemo: AnyView(
                        VStack(spacing: DesignSystem.Spacing.md) {
                            ZStack {
                                // Outer circle (5 miles)
                                Circle()
                                    .stroke(DesignSystem.Colors.primary.opacity(0.3), lineWidth: 2)
                                    .frame(width: 120, height: 120)
                                
                                // Middle circle (3 miles)
                                Circle()
                                    .stroke(DesignSystem.Colors.primary.opacity(0.5), lineWidth: 2)
                                    .frame(width: 80, height: 80)
                                
                                // Inner circle (1 mile)
                                Circle()
                                    .stroke(DesignSystem.Colors.primary.opacity(0.7), lineWidth: 2)
                                    .frame(width: 40, height: 40)
                                
                                // Center point
                                Circle()
                                    .fill(DesignSystem.Colors.primary)
                                    .frame(width: 8, height: 8)
                            }
                            
                            VStack(spacing: DesignSystem.Spacing.xs) {
                                Text("5 mi → 3 mi → 1 mi → Arrival")
                                    .font(DesignSystem.Typography.caption1)
                                    .foregroundColor(DesignSystem.Colors.textSecondary)
                            }
                        }
                    ),
                    keyPoints: [
                        "Approach alerts: 5, 3, and 1 mile out",
                        "Arrival alert: When you reach the location",
                        "Post-arrival: 5 minutes after arriving"
                    ]
                ),
                
                EducationStep(
                    title: "Battery Optimized",
                    description: "Our geofencing is designed to be battery-efficient while remaining reliable.",
                    icon: "battery.100",
                    keyPoints: [
                        "Uses system-level location services",
                        "No continuous GPS tracking",
                        "Intelligent power management"
                    ]
                )
            ],
            onComplete: onComplete
        )
    }
    
    // Troubleshooting Guide
    static func troubleshooting(onComplete: @escaping () -> Void) -> UserEducationConfig {
        UserEducationConfig(
            steps: [
                EducationStep(
                    title: "Not Getting Notifications?",
                    description: "Here are the most common issues and how to fix them.",
                    icon: "exclamationmark.triangle",
                    keyPoints: [
                        "Check that location services are enabled",
                        "Ensure notifications are allowed",
                        "Verify background app refresh is on"
                    ]
                ),
                
                EducationStep(
                    title: "Location Settings",
                    description: "Near Me needs \"Always\" location access to work properly in the background.",
                    icon: "location.fill",
                    keyPoints: [
                        "Go to Settings > Privacy & Security > Location Services",
                        "Find Near Me and select \"Always\"",
                        "Enable \"Precise Location\" for best results"
                    ]
                ),
                
                EducationStep(
                    title: "Notification Settings",
                    description: "Make sure notifications are enabled and configured correctly.",
                    icon: "bell.fill",
                    keyPoints: [
                        "Go to Settings > Notifications > Near Me",
                        "Enable \"Allow Notifications\"",
                        "Choose your preferred alert style"
                    ]
                ),
                
                EducationStep(
                    title: "Background Refresh",
                    description: "This allows Near Me to update geofences and sync data when not actively used.",
                    icon: "arrow.clockwise",
                    keyPoints: [
                        "Go to Settings > General > Background App Refresh",
                        "Enable it globally, then enable for Near Me",
                        "This helps maintain accurate geofences"
                    ]
                )
            ],
            onComplete: onComplete
        )
    }
}

// MARK: - Contextual Help Tooltip
struct ContextualHelpTooltip: View {
    let text: String
    let isVisible: Bool
    let onDismiss: () -> Void
    
    var body: some View {
        if isVisible {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                HStack {
                    Text(text)
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                        .multilineTextAlignment(.leading)
                    
                    Spacer()
                    
                    Button(action: onDismiss) {
                        Image(systemName: "xmark")
                            .font(.caption2)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                    }
                }
            }
            .padding(DesignSystem.Spacing.sm)
            .background(DesignSystem.Colors.warning.opacity(0.1))
            .overlay(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.sm)
                    .stroke(DesignSystem.Colors.warning.opacity(0.3), lineWidth: 1)
            )
            .designSystemCornerRadius(DesignSystem.CornerRadius.sm)
        }
    }
}

// MARK: - Preview
struct UserEducationComponents_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            UserEducationView(
                config: .howItWorks(onComplete: {})
            )
            .previewDisplayName("How It Works")
            
            ContextualHelpTooltip(
                text: "This is where you'll see your location-based reminders when you're near relevant places.",
                isVisible: true,
                onDismiss: {}
            )
            .previewDisplayName("Contextual Help")
        }
    }
}