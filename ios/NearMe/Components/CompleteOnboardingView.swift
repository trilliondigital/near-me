import SwiftUI

// MARK: - Complete Onboarding View
struct CompleteOnboardingView: View {
    @ObservedObject var onboardingManager: OnboardingManager
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.xl) {
            Spacer()
            
            // Success Animation
            VStack(spacing: DesignSystem.Spacing.lg) {
                ZStack {
                    Circle()
                        .fill(DesignSystem.Colors.success.opacity(0.1))
                        .frame(width: 120, height: 120)
                    
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 60, weight: .light))
                        .foregroundColor(DesignSystem.Colors.success)
                }
                
                VStack(spacing: DesignSystem.Spacing.sm) {
                    Text("All Set!")
                        .font(DesignSystem.Typography.largeTitle)
                        .fontWeight(.bold)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    Text("You're ready to start using Near Me")
                        .font(DesignSystem.Typography.title3)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }
            }
            
            // Setup Summary
            VStack(spacing: DesignSystem.Spacing.md) {
                Text("Your Setup Summary")
                    .font(DesignSystem.Typography.title3)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                VStack(spacing: DesignSystem.Spacing.sm) {
                    SetupSummaryItem(
                        icon: "location.fill",
                        title: "Location Access",
                        status: "Enabled",
                        isEnabled: true
                    )
                    
                    SetupSummaryItem(
                        icon: "bell.fill",
                        title: "Notifications",
                        status: "Enabled",
                        isEnabled: true
                    )
                    
                    SetupSummaryItem(
                        icon: "house.fill",
                        title: "Common Locations",
                        status: "\(onboardingManager.preferences.commonLocations.count) added",
                        isEnabled: !onboardingManager.preferences.commonLocations.isEmpty
                    )
                    
                    SetupSummaryItem(
                        icon: "tag.fill",
                        title: "Task Categories",
                        status: "\(selectedCategoriesCount) selected",
                        isEnabled: selectedCategoriesCount > 0
                    )
                }
            }
            
            // Next Steps
            VStack(spacing: DesignSystem.Spacing.md) {
                Text("What's Next?")
                    .font(DesignSystem.Typography.title3)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                VStack(spacing: DesignSystem.Spacing.sm) {
                    NextStepItem(
                        icon: "plus.circle.fill",
                        title: "Create Your First Task",
                        description: "Add a task and select a location to get started"
                    )
                    
                    NextStepItem(
                        icon: "location.circle.fill",
                        title: "Set Up Locations",
                        description: "Add more places you visit regularly"
                    )
                    
                    NextStepItem(
                        icon: "gear",
                        title: "Customize Settings",
                        description: "Adjust notification preferences and quiet hours"
                    )
                }
            }
            
            // Seed Task Examples
            SeedTaskExamples(onboardingManager: onboardingManager)
            
            // Tips
            BaseCard(
                backgroundColor: DesignSystem.Colors.surface,
                padding: DesignSystem.Spacing.md
            ) {
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                    HStack {
                        Image(systemName: "lightbulb.fill")
                            .foregroundColor(DesignSystem.Colors.warning)
                        Text("Pro Tip")
                            .font(DesignSystem.Typography.bodyEmphasized)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                    }
                    
                    Text("Start with 2-3 simple tasks to get familiar with how location-based reminders work. You can always add more later!")
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
            }
            
            Spacer()
        }
        .padding(.horizontal, DesignSystem.Spacing.padding)
    }
    
    // MARK: - Helper Methods
    private var selectedCategoriesCount: Int {
        return onboardingManager.preferences.taskCategories.filter { $0.isSelected }.count
    }
}

// MARK: - Setup Summary Item
struct SetupSummaryItem: View {
    let icon: String
    let title: String
    let status: String
    let isEnabled: Bool
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(isEnabled ? DesignSystem.Colors.success : DesignSystem.Colors.textTertiary)
                .frame(width: 30)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(DesignSystem.Typography.bodyEmphasized)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text(status)
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(isEnabled ? DesignSystem.Colors.success : DesignSystem.Colors.textSecondary)
            }
            
            Spacer()
            
            Image(systemName: isEnabled ? "checkmark.circle.fill" : "circle")
                .font(.title3)
                .foregroundColor(isEnabled ? DesignSystem.Colors.success : DesignSystem.Colors.textTertiary)
        }
        .padding(.vertical, DesignSystem.Spacing.sm)
    }
}

// MARK: - Next Step Item
struct NextStepItem: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.md) {
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
        .padding(.vertical, DesignSystem.Spacing.sm)
    }
}

// MARK: - Previews
struct CompleteOnboardingView_Previews: PreviewProvider {
    static var previews: some View {
        CompleteOnboardingView(onboardingManager: OnboardingManager())
    }
}
