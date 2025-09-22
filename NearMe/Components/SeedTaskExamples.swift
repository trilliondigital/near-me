import SwiftUI

// MARK: - Seed Task Examples
struct SeedTaskExamples: View {
    @ObservedObject var onboardingManager: OnboardingManager
    @State private var selectedExamples: Set<String> = []
    
    private let exampleTasks = [
        SeedTask(
            id: "grocery-example",
            title: "Buy groceries",
            description: "Pick up milk, bread, and eggs",
            locationType: .grocery,
            icon: "cart.fill"
        ),
        SeedTask(
            id: "pharmacy-example",
            title: "Pick up prescription",
            description: "Get medication from pharmacy",
            locationType: .pharmacy,
            icon: "cross.fill"
        ),
        SeedTask(
            id: "bank-example",
            title: "Deposit check",
            description: "Visit bank to deposit paycheck",
            locationType: .bank,
            icon: "banknote.fill"
        ),
        SeedTask(
            id: "post-example",
            title: "Mail package",
            description: "Send package at post office",
            locationType: .postOffice,
            icon: "envelope.fill"
        ),
        SeedTask(
            id: "gym-example",
            title: "Work out",
            description: "Go to gym for exercise",
            locationType: .gym,
            icon: "figure.strengthtraining.traditional"
        ),
        SeedTask(
            id: "work-example",
            title: "Return library book",
            description: "Drop off borrowed book",
            locationType: .custom,
            icon: "book.fill"
        )
    ]
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.lg) {
            VStack(spacing: DesignSystem.Spacing.sm) {
                Text("Quick Start Examples")
                    .font(DesignSystem.Typography.title3)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Text("Choose some example tasks to get started quickly")
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }
            
            ScrollView {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: DesignSystem.Spacing.md) {
                    ForEach(exampleTasks, id: \.id) { task in
                        SeedTaskCard(
                            task: task,
                            isSelected: selectedExamples.contains(task.id),
                            onToggle: { toggleTask(task.id) }
                        )
                    }
                }
            }
            
            if !selectedExamples.isEmpty {
                VStack(spacing: DesignSystem.Spacing.md) {
                    Text("Selected Examples")
                        .font(DesignSystem.Typography.bodyEmphasized)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                    
                    Text("\(selectedExamples.count) example tasks selected")
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                    
                    PrimaryButton(
                        title: "Add Selected Tasks",
                        action: addSelectedTasks
                    )
                }
                .padding(.vertical, DesignSystem.Spacing.md)
                .padding(.horizontal, DesignSystem.Spacing.lg)
                .background(
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                        .fill(DesignSystem.Colors.primary.opacity(0.1))
                )
            }
            
            // Skip option
            Button("Skip Examples") {
                // Skip adding examples
            }
            .font(DesignSystem.Typography.caption1)
            .foregroundColor(DesignSystem.Colors.textSecondary)
        }
    }
    
    // MARK: - Helper Methods
    private func toggleTask(_ taskId: String) {
        if selectedExamples.contains(taskId) {
            selectedExamples.remove(taskId)
        } else {
            selectedExamples.insert(taskId)
        }
    }
    
    private func addSelectedTasks() {
        // TODO: Implement adding selected tasks to user's task list
        // This would integrate with the task management system
        print("Adding \(selectedExamples.count) example tasks")
        
        // Clear selection after adding
        selectedExamples.removeAll()
    }
}

// MARK: - Seed Task Model
struct SeedTask {
    let id: String
    let title: String
    let description: String
    let locationType: CommonLocation.LocationType
    let icon: String
}

// MARK: - Seed Task Card
struct SeedTaskCard: View {
    let task: SeedTask
    let isSelected: Bool
    let onToggle: () -> Void
    
    var body: some View {
        Button(action: onToggle) {
            VStack(spacing: DesignSystem.Spacing.sm) {
                ZStack {
                    Circle()
                        .fill(isSelected ? DesignSystem.Colors.primary : DesignSystem.Colors.surface)
                        .frame(width: 50, height: 50)
                    
                    Image(systemName: task.icon)
                        .font(.title2)
                        .foregroundColor(isSelected ? DesignSystem.Colors.textInverse : DesignSystem.Colors.primary)
                }
                
                VStack(spacing: 2) {
                    Text(task.title)
                        .font(DesignSystem.Typography.caption1)
                        .fontWeight(.medium)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                        .multilineTextAlignment(.center)
                    
                    Text(task.description)
                        .font(DesignSystem.Typography.caption2)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                }
                
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
struct SeedTaskExamples_Previews: PreviewProvider {
    static var previews: some View {
        SeedTaskExamples(onboardingManager: OnboardingManager())
    }
}
