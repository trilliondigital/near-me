import SwiftUI

// MARK: - Categories Onboarding View
struct CategoriesOnboardingView: View {
    @ObservedObject var onboardingManager: OnboardingManager
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.xl) {
            // Title
            VStack(spacing: DesignSystem.Spacing.sm) {
                Text("Task Categories")
                    .font(DesignSystem.Typography.title1)
                    .fontWeight(.bold)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text("Select the types of tasks you'd like reminders for")
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            
            // Categories Grid
            ScrollView {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: DesignSystem.Spacing.md) {
                    ForEach(TaskCategory.defaultCategories, id: \.id) { category in
                        CategoryCard(
                            category: category,
                            isSelected: isCategorySelected(category.id),
                            onToggle: { toggleCategory(category.id) }
                        )
                    }
                }
            }
            
            // Selected Categories Summary
            if selectedCategoriesCount > 0 {
                VStack(spacing: DesignSystem.Spacing.sm) {
                    Text("Selected Categories")
                        .font(DesignSystem.Typography.bodyEmphasized)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    Text("\(selectedCategoriesCount) categories selected")
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
                .padding(.vertical, DesignSystem.Spacing.md)
                .padding(.horizontal, DesignSystem.Spacing.lg)
                .background(
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                        .fill(DesignSystem.Colors.primary.opacity(0.1))
                )
            }
            
            // Optional Note
            BaseCard(
                backgroundColor: DesignSystem.Colors.surface,
                padding: DesignSystem.Spacing.md
            ) {
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.sm) {
                    HStack {
                        Image(systemName: "info.circle.fill")
                            .foregroundColor(DesignSystem.Colors.primary)
                        Text("Optional")
                            .font(DesignSystem.Typography.bodyEmphasized)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                    }
                    
                    Text("You can always add or remove categories later in settings. Selecting categories helps us suggest relevant tasks and locations.")
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
            }
            
            Spacer()
        }
        .padding(.horizontal, DesignSystem.Spacing.padding)
    }
    
    // MARK: - Helper Methods
    private func isCategorySelected(_ categoryId: String) -> Bool {
        return onboardingManager.preferences.taskCategories.contains { $0.id == categoryId && $0.isSelected }
    }
    
    private func toggleCategory(_ categoryId: String) {
        onboardingManager.toggleTaskCategory(categoryId)
    }
    
    private var selectedCategoriesCount: Int {
        return onboardingManager.preferences.taskCategories.filter { $0.isSelected }.count
    }
}

// MARK: - Category Card
struct CategoryCard: View {
    let category: TaskCategory
    let isSelected: Bool
    let onToggle: () -> Void
    
    var body: some View {
        Button(action: onToggle) {
            VStack(spacing: DesignSystem.Spacing.sm) {
                ZStack {
                    Circle()
                        .fill(isSelected ? DesignSystem.Colors.primary : DesignSystem.Colors.surface)
                        .frame(width: 50, height: 50)
                    
                    Image(systemName: category.icon)
                        .font(.title2)
                        .foregroundColor(isSelected ? DesignSystem.Colors.textInverse : DesignSystem.Colors.primary)
                }
                
                Text(category.name)
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                    .multilineTextAlignment(.center)
                
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundColor(DesignSystem.Colors.success)
                }
            }
            .padding(.vertical, DesignSystem.Spacing.md)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .fill(isSelected ? DesignSystem.Colors.primary.opacity(0.1) : DesignSystem.Colors.card)
                    .overlay(
                        RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                            .stroke(isSelected ? DesignSystem.Colors.primary : DesignSystem.Colors.border, lineWidth: 1)
                    )
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Previews
struct CategoriesOnboardingView_Previews: PreviewProvider {
    static var previews: some View {
        CategoriesOnboardingView(onboardingManager: OnboardingManager())
    }
}
