import SwiftUI

struct TaskFiltersView: View {
    @Environment(\.presentationMode) var presentationMode
    @Binding var filters: TaskFilters
    let onApply: () -> Void
    
    @State private var tempFilters: TaskFilters
    
    init(filters: Binding<TaskFilters>, onApply: @escaping () -> Void) {
        self._filters = filters
        self.onApply = onApply
        self._tempFilters = State(initialValue: filters.wrappedValue)
    }
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: DesignSystem.Spacing.lg) {
                    // Header
                    VStack(spacing: DesignSystem.Spacing.sm) {
                        Text("Filter Tasks")
                            .font(DesignSystem.Typography.title1)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                        
                        Text("Filter your tasks by status, location type, or category")
                            .font(DesignSystem.Typography.subheadline)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, DesignSystem.Spacing.lg)
                    
                    // Status Filter
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                        FilterSectionHeader(title: "Status", icon: "checkmark.circle.fill")
                        
                        VStack(spacing: DesignSystem.Spacing.sm) {
                            FilterOption(
                                title: "All Statuses",
                                isSelected: tempFilters.status == nil,
                                onTap: { tempFilters.status = nil }
                            )
                            
                            ForEach(TaskStatus.allCases, id: \.self) { status in
                                FilterOption(
                                    title: status.displayName,
                                    isSelected: tempFilters.status == status,
                                    onTap: { tempFilters.status = status }
                                )
                            }
                        }
                    }
                    .padding(.horizontal, DesignSystem.Spacing.padding)
                    
                    // Location Type Filter
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                        FilterSectionHeader(title: "Location Type", icon: "location.fill")
                        
                        VStack(spacing: DesignSystem.Spacing.sm) {
                            FilterOption(
                                title: "All Location Types",
                                isSelected: tempFilters.locationType == nil,
                                onTap: { tempFilters.locationType = nil }
                            )
                            
                            ForEach(LocationType.allCases, id: \.self) { locationType in
                                FilterOption(
                                    title: locationType.displayName,
                                    isSelected: tempFilters.locationType == locationType,
                                    onTap: { tempFilters.locationType = locationType }
                                )
                            }
                        }
                    }
                    .padding(.horizontal, DesignSystem.Spacing.padding)
                    
                    // POI Category Filter
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.md) {
                        FilterSectionHeader(title: "POI Category", icon: "building.2.fill")
                        
                        VStack(spacing: DesignSystem.Spacing.sm) {
                            FilterOption(
                                title: "All Categories",
                                isSelected: tempFilters.poiCategory == nil,
                                onTap: { tempFilters.poiCategory = nil }
                            )
                            
                            ForEach(POICategory.allCases, id: \.self) { category in
                                FilterOption(
                                    title: category.displayName,
                                    isSelected: tempFilters.poiCategory == category,
                                    onTap: { tempFilters.poiCategory = category }
                                )
                            }
                        }
                    }
                    .padding(.horizontal, DesignSystem.Spacing.padding)
                    
                    Spacer(minLength: DesignSystem.Spacing.xxl)
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Apply") {
                        applyFilters()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }
    
    private func applyFilters() {
        filters = tempFilters
        onApply()
        presentationMode.wrappedValue.dismiss()
    }
}

// MARK: - Filter Section Header
struct FilterSectionHeader: View {
    let title: String
    let icon: String
    
    var body: some View {
        HStack(spacing: DesignSystem.Spacing.sm) {
            Image(systemName: icon)
                .foregroundColor(DesignSystem.Colors.primary)
                .font(.title3)
            
            Text(title)
                .font(DesignSystem.Typography.title3)
                .foregroundColor(DesignSystem.Colors.textPrimary)
            
            Spacer()
        }
    }
}

// MARK: - Filter Option
struct FilterOption: View {
    let title: String
    let isSelected: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack {
                Text(title)
                    .font(DesignSystem.Typography.body)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                Spacer()
                
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(DesignSystem.Colors.primary)
                        .font(.title3)
                } else {
                    Image(systemName: "circle")
                        .foregroundColor(DesignSystem.Colors.border)
                        .font(.title3)
                }
            }
            .padding(DesignSystem.Spacing.md)
            .background(isSelected ? DesignSystem.Colors.primary.opacity(0.1) : DesignSystem.Colors.surface)
            .designSystemCornerRadius()
            .designSystemShadow(DesignSystem.Shadow.small)
            .overlay(
                RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.md)
                    .stroke(isSelected ? DesignSystem.Colors.primary : DesignSystem.Colors.border, lineWidth: isSelected ? 2 : 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Preview
struct TaskFiltersView_Previews: PreviewProvider {
    static var previews: some View {
        TaskFiltersView(filters: .constant(TaskFilters())) {
            // Preview action
        }
    }
}
