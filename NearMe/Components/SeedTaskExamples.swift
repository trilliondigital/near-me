import SwiftUI

// MARK: - Enhanced Seed Task Examples
struct SeedTaskExamples: View {
    @ObservedObject var onboardingManager: OnboardingManager
    @State private var selectedExamples: Set<String> = []
    @State private var selectedCategory: TaskCategory = .popular
    @State private var showingEducation = false
    
    enum TaskCategory: String, CaseIterable {
        case popular = "Popular"
        case errands = "Errands"
        case health = "Health"
        case work = "Work"
        case home = "Home"
        
        var icon: String {
            switch self {
            case .popular: return "star.fill"
            case .errands: return "bag.fill"
            case .health: return "heart.fill"
            case .work: return "briefcase.fill"
            case .home: return "house.fill"
            }
        }
    }
    
    private var categorizedTasks: [TaskCategory: [SeedTask]] {
        [
            .popular: [
                SeedTask(
                    id: "grocery-popular",
                    title: "Buy groceries",
                    description: "Pick up milk, bread, and eggs",
                    locationType: .grocery,
                    icon: "cart.fill",
                    explanation: "Get reminded at any grocery store when you need to shop"
                ),
                SeedTask(
                    id: "gas-popular",
                    title: "Get gas ⛽️",
                    description: "Fill up the tank",
                    locationType: .gas,
                    icon: "fuelpump.fill",
                    explanation: "Never drive past a gas station when you need fuel"
                ),
                SeedTask(
                    id: "pharmacy-popular",
                    title: "Pick up prescription",
                    description: "Get medication from pharmacy",
                    locationType: .pharmacy,
                    icon: "cross.fill",
                    explanation: "Remember to get your prescription at any pharmacy"
                )
            ],
            .errands: [
                SeedTask(
                    id: "bank-errands",
                    title: "Deposit check",
                    description: "Visit bank to make deposit",
                    locationType: .bank,
                    icon: "banknote.fill",
                    explanation: "Get reminded when you're near any bank branch"
                ),
                SeedTask(
                    id: "post-errands",
                    title: "Mail package",
                    description: "Send package at post office",
                    locationType: .postOffice,
                    icon: "envelope.fill",
                    explanation: "Don't forget to mail items when you're near a post office"
                ),
                SeedTask(
                    id: "dry-cleaning-errands",
                    title: "Pick up dry cleaning",
                    description: "Collect cleaned clothes",
                    locationType: .custom,
                    icon: "tshirt.fill",
                    explanation: "Set up at your specific dry cleaner location"
                )
            ],
            .health: [
                SeedTask(
                    id: "doctor-health",
                    title: "Schedule checkup",
                    description: "Call to book annual physical",
                    locationType: .custom,
                    icon: "stethoscope",
                    explanation: "Remember when you're near your doctor's office"
                ),
                SeedTask(
                    id: "gym-health",
                    title: "Work out",
                    description: "Hit the gym for exercise",
                    locationType: .custom,
                    icon: "figure.strengthtraining.traditional",
                    explanation: "Stay motivated when you're near your gym"
                ),
                SeedTask(
                    id: "vitamins-health",
                    title: "Buy vitamins",
                    description: "Restock supplements",
                    locationType: .pharmacy,
                    icon: "pills.fill",
                    explanation: "Remember at any pharmacy or health store"
                )
            ],
            .work: [
                SeedTask(
                    id: "coffee-work",
                    title: "Grab coffee",
                    description: "Get morning coffee",
                    locationType: .custom,
                    icon: "cup.and.saucer.fill",
                    explanation: "Perfect for your daily coffee shop routine"
                ),
                SeedTask(
                    id: "lunch-work",
                    title: "Pick up lunch",
                    description: "Get food for the team",
                    locationType: .custom,
                    icon: "takeoutbag.and.cup.and.straw.fill",
                    explanation: "Remember when you're near your favorite lunch spot"
                ),
                SeedTask(
                    id: "supplies-work",
                    title: "Buy office supplies",
                    description: "Get pens, paper, etc.",
                    locationType: .custom,
                    icon: "pencil.and.outline",
                    explanation: "Remember when you're near an office supply store"
                )
            ],
            .home: [
                SeedTask(
                    id: "defrost-home",
                    title: "Defrost chicken",
                    description: "Take out meat for dinner",
                    locationType: .home,
                    icon: "house.fill",
                    explanation: "Get reminded when you arrive home"
                ),
                SeedTask(
                    id: "trash-home",
                    title: "Take out trash",
                    description: "Put bins out for pickup",
                    locationType: .home,
                    icon: "trash.fill",
                    explanation: "Remember before you leave home"
                ),
                SeedTask(
                    id: "plants-home",
                    title: "Water plants",
                    description: "Give plants their weekly water",
                    locationType: .home,
                    icon: "leaf.fill",
                    explanation: "Perfect for weekend home reminders"
                )
            ]
        ]
    }
    
    private var currentTasks: [SeedTask] {
        categorizedTasks[selectedCategory] ?? []
    }
    
    var body: some View {
        VStack(spacing: DesignSystem.Spacing.lg) {
            // Header
            VStack(spacing: DesignSystem.Spacing.sm) {
                HStack {
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                        Text("Quick Start Examples")
                            .font(DesignSystem.Typography.title2)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                        
                        Text("Choose tasks to see how Near Me works")
                            .font(DesignSystem.Typography.body)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                    }
                    
                    Spacer()
                    
                    Button(action: { showingEducation = true }) {
                        Image(systemName: "questionmark.circle")
                            .font(.title2)
                            .foregroundColor(DesignSystem.Colors.primary)
                    }
                }
            }
            
            // Category Selector
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: DesignSystem.Spacing.sm) {
                    ForEach(TaskCategory.allCases, id: \.self) { category in
                        CategoryChip(
                            title: category.rawValue,
                            icon: category.icon,
                            isSelected: selectedCategory == category,
                            onTap: { selectedCategory = category }
                        )
                    }
                }
                .padding(.horizontal, DesignSystem.Spacing.md)
            }
            
            // Task Grid
            ScrollView {
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 1), spacing: DesignSystem.Spacing.md) {
                    ForEach(currentTasks, id: \.id) { task in
                        EnhancedSeedTaskCard(
                            task: task,
                            isSelected: selectedExamples.contains(task.id),
                            onToggle: { toggleTask(task.id) }
                        )
                    }
                }
                .padding(.horizontal, DesignSystem.Spacing.md)
            }
            
            // Selection Summary
            if !selectedExamples.isEmpty {
                VStack(spacing: DesignSystem.Spacing.md) {
                    HStack {
                        VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                            Text("Ready to Add")
                                .font(DesignSystem.Typography.bodyEmphasized)
                                .foregroundColor(DesignSystem.Colors.textPrimary)
                            
                            Text("\(selectedExamples.count) example tasks selected")
                                .font(DesignSystem.Typography.caption1)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                        }
                        
                        Spacer()
                        
                        Button("Clear All") {
                            selectedExamples.removeAll()
                        }
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                    }
                    
                    PrimaryButton(
                        title: "Add \(selectedExamples.count) Tasks",
                        action: addSelectedTasks
                    )
                }
                .padding(DesignSystem.Spacing.md)
                .background(
                    RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                        .fill(DesignSystem.Colors.success.opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                                .stroke(DesignSystem.Colors.success.opacity(0.3), lineWidth: 1)
                        )
                )
            }
            
            // Skip option
            Button("Skip Examples") {
                onboardingManager.completeOnboarding()
            }
            .font(DesignSystem.Typography.body)
            .foregroundColor(DesignSystem.Colors.textSecondary)
        }
        .sheet(isPresented: $showingEducation) {
            UserEducationView(
                config: .howItWorks(onComplete: {
                    showingEducation = false
                })
            )
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
    let explanation: String
}

// MARK: - Category Chip
struct CategoryChip: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack(spacing: DesignSystem.Spacing.xs) {
                Image(systemName: icon)
                    .font(.caption)
                Text(title)
                    .font(DesignSystem.Typography.caption1)
                    .fontWeight(.medium)
            }
            .padding(.horizontal, DesignSystem.Spacing.md)
            .padding(.vertical, DesignSystem.Spacing.sm)
            .background(
                Capsule()
                    .fill(isSelected ? DesignSystem.Colors.primary : DesignSystem.Colors.surface)
            )
            .foregroundColor(isSelected ? DesignSystem.Colors.textInverse : DesignSystem.Colors.textPrimary)
            .overlay(
                Capsule()
                    .stroke(isSelected ? Color.clear : DesignSystem.Colors.border, lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Enhanced Seed Task Card
struct EnhancedSeedTaskCard: View {
    let task: SeedTask
    let isSelected: Bool
    let onToggle: () -> Void
    
    var body: some View {
        Button(action: onToggle) {
            HStack(spacing: DesignSystem.Spacing.md) {
                // Icon
                ZStack {
                    Circle()
                        .fill(isSelected ? DesignSystem.Colors.primary : DesignSystem.Colors.surface)
                        .frame(width: 44, height: 44)
                    
                    Image(systemName: task.icon)
                        .font(.title3)
                        .foregroundColor(isSelected ? DesignSystem.Colors.textInverse : DesignSystem.Colors.primary)
                }
                
                // Content
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    HStack {
                        Text(task.title)
                            .font(DesignSystem.Typography.bodyEmphasized)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                        
                        Spacer()
                        
                        if isSelected {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.title3)
                                .foregroundColor(DesignSystem.Colors.success)
                        }
                    }
                    
                    Text(task.description)
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .multilineTextAlignment(.leading)
                    
                    Text(task.explanation)
                        .font(DesignSystem.Typography.caption2)
                        .foregroundColor(DesignSystem.Colors.textTertiary)
                        .multilineTextAlignment(.leading)
                        .italic()
                }
                
                Spacer()
            }
            .padding(DesignSystem.Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .fill(isSelected ? DesignSystem.Colors.primary.opacity(0.05) : DesignSystem.Colors.card)
                    .overlay(
                        RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                            .stroke(isSelected ? DesignSystem.Colors.primary : DesignSystem.Colors.border, lineWidth: isSelected ? 2 : 1)
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
