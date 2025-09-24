import SwiftUI

// MARK: - List Components
struct SectionHeader: View {
    let title: String
    var subtitle: String?
    var action: (() -> Void)?
    var actionTitle: String?
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                Text(title)
                    .font(DesignSystem.Typography.title3)
                    .foregroundColor(DesignSystem.Colors.textPrimary)
                
                if let subtitle = subtitle {
                    Text(subtitle)
                        .font(DesignSystem.Typography.caption1)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                }
            }
            
            Spacer()
            
            if let action = action, let actionTitle = actionTitle {
                Button(action: action) {
                    Text(actionTitle)
                        .font(DesignSystem.Typography.bodyEmphasized)
                        .foregroundColor(DesignSystem.Colors.primary)
                }
            }
        }
        .padding(.horizontal, DesignSystem.Spacing.padding)
        .padding(.vertical, DesignSystem.Spacing.sm)
    }
}

struct ListItem: View {
    let title: String
    var subtitle: String?
    var icon: String?
    var iconColor: Color = DesignSystem.Colors.primary
    var accessory: ListAccessory = .none
    var action: (() -> Void)?
    
    enum ListAccessory {
        case none
        case chevron
        case toggle(Binding<Bool>)
        case button(String, () -> Void)
        case badge(String, Color)
    }
    
    var body: some View {
        Button(action: action ?? {}) {
            HStack(spacing: DesignSystem.Spacing.md) {
                // Icon
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.title3)
                        .foregroundColor(iconColor)
                        .frame(width: 24, height: 24)
                }
                
                // Content
                VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                    Text(title)
                        .font(DesignSystem.Typography.body)
                        .foregroundColor(DesignSystem.Colors.textPrimary)
                        .multilineTextAlignment(.leading)
                    
                    if let subtitle = subtitle {
                        Text(subtitle)
                            .font(DesignSystem.Typography.caption1)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                            .multilineTextAlignment(.leading)
                    }
                }
                
                Spacer()
                
                // Accessory
                accessoryView
            }
            .padding(.horizontal, DesignSystem.Spacing.padding)
            .padding(.vertical, DesignSystem.Spacing.md)
            .background(DesignSystem.Colors.surface)
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    @ViewBuilder
    private var accessoryView: some View {
        switch accessory {
        case .none:
            EmptyView()
        case .chevron:
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(DesignSystem.Colors.textSecondary)
        case .toggle(let binding):
            Toggle("", isOn: binding)
                .toggleStyle(SwitchToggleStyle(tint: DesignSystem.Colors.primary))
        case .button(let title, let action):
            Button(action: action) {
                Text(title)
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.primary)
                    .padding(.horizontal, DesignSystem.Spacing.sm)
                    .padding(.vertical, DesignSystem.Spacing.xs)
                    .background(
                        RoundedRectangle(cornerRadius: DesignSystem.CornerRadius.sm)
                            .stroke(DesignSystem.Colors.primary, lineWidth: 1)
                    )
            }
        case .badge(let text, let color):
            Text(text)
                .font(DesignSystem.Typography.caption2)
                .foregroundColor(.white)
                .padding(.horizontal, DesignSystem.Spacing.sm)
                .padding(.vertical, DesignSystem.Spacing.xs)
                .background(
                    Capsule()
                        .fill(color)
                )
        }
    }
}

struct ExpandableListSection<Content: View>: View {
    let title: String
    var subtitle: String?
    var icon: String?
    @State private var isExpanded: Bool = false
    let content: Content
    
    init(title: String, subtitle: String? = nil, icon: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.icon = icon
        self.content = content()
    }
    
    var body: some View {
        VStack(spacing: 0) {
            Button(action: {
                withAnimation(DesignSystem.Animation.medium) {
                    isExpanded.toggle()
                }
            }) {
                HStack {
                    if let icon = icon {
                        Image(systemName: icon)
                            .font(.title3)
                            .foregroundColor(DesignSystem.Colors.primary)
                    }
                    
                    VStack(alignment: .leading, spacing: DesignSystem.Spacing.xs) {
                        Text(title)
                            .font(DesignSystem.Typography.bodyEmphasized)
                            .foregroundColor(DesignSystem.Colors.textPrimary)
                        
                        if let subtitle = subtitle {
                            Text(subtitle)
                                .font(DesignSystem.Typography.caption1)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                        }
                    }
                    
                    Spacer()
                    
                    Image(systemName: "chevron.down")
                        .font(.caption)
                        .foregroundColor(DesignSystem.Colors.textSecondary)
                        .rotationEffect(.degrees(isExpanded ? 180 : 0))
                        .animation(DesignSystem.Animation.fast, value: isExpanded)
                }
                .padding(.horizontal, DesignSystem.Spacing.padding)
                .padding(.vertical, DesignSystem.Spacing.md)
                .background(DesignSystem.Colors.surface)
            }
            .buttonStyle(PlainButtonStyle())
            
            if isExpanded {
                content
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }
}

struct SwipeActionRow<Content: View>: View {
    let content: Content
    let actions: [SwipeAction]
    
    @State private var offset: CGFloat = 0
    @State private var isDragging = false
    
    struct SwipeAction {
        let title: String
        let icon: String
        let color: Color
        let action: () -> Void
    }
    
    init(actions: [SwipeAction], @ViewBuilder content: () -> Content) {
        self.actions = actions
        self.content = content()
    }
    
    var body: some View {
        ZStack {
            // Background actions
            HStack(spacing: 0) {
                Spacer()
                
                HStack(spacing: 0) {
                    ForEach(actions.indices, id: \.self) { index in
                        let action = actions[index]
                        Button(action: {
                            action.action()
                            withAnimation {
                                offset = 0
                            }
                        }) {
                            VStack(spacing: DesignSystem.Spacing.xs) {
                                Image(systemName: action.icon)
                                    .font(.title3)
                                Text(action.title)
                                    .font(DesignSystem.Typography.caption2)
                            }
                            .foregroundColor(.white)
                            .frame(width: 80)
                            .frame(maxHeight: .infinity)
                            .background(action.color)
                        }
                    }
                }
            }
            
            // Main content
            content
                .background(DesignSystem.Colors.surface)
                .offset(x: offset)
                .gesture(
                    DragGesture()
                        .onChanged { value in
                            isDragging = true
                            let translation = value.translation.x
                            if translation < 0 {
                                offset = max(translation, -CGFloat(actions.count * 80))
                            }
                        }
                        .onEnded { value in
                            isDragging = false
                            let translation = value.translation.x
                            let velocity = value.velocity.x
                            
                            withAnimation(.spring()) {
                                if translation < -50 || velocity < -500 {
                                    offset = -CGFloat(actions.count * 80)
                                } else {
                                    offset = 0
                                }
                            }
                        }
                )
        }
        .clipped()
    }
}

struct PullToRefreshScrollView<Content: View>: View {
    let content: Content
    let onRefresh: () -> Void
    
    @State private var isRefreshing = false
    @State private var pullOffset: CGFloat = 0
    
    init(onRefresh: @escaping () -> Void, @ViewBuilder content: () -> Content) {
        self.onRefresh = onRefresh
        self.content = content()
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Pull to refresh indicator
                if pullOffset > 50 {
                    HStack {
                        if isRefreshing {
                            ProgressView()
                                .scaleEffect(0.8)
                        } else {
                            Image(systemName: "arrow.down")
                                .font(.caption)
                                .foregroundColor(DesignSystem.Colors.textSecondary)
                        }
                        
                        Text(isRefreshing ? "Refreshing..." : "Pull to refresh")
                            .font(DesignSystem.Typography.caption1)
                            .foregroundColor(DesignSystem.Colors.textSecondary)
                    }
                    .padding(.vertical, DesignSystem.Spacing.sm)
                }
                
                content
            }
        }
        .refreshable {
            await performRefresh()
        }
    }
    
    private func performRefresh() async {
        isRefreshing = true
        onRefresh()
        try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second delay
        isRefreshing = false
    }
}

// MARK: - List Previews
struct ListComponents_Previews: PreviewProvider {
    @State static var toggleValue = false
    
    static var previews: some View {
        ScrollView {
            VStack(spacing: DesignSystem.Spacing.lg) {
                SectionHeader(
                    title: "Recent Tasks",
                    subtitle: "3 active reminders",
                    action: {},
                    actionTitle: "See All"
                )
                
                VStack(spacing: 0) {
                    ListItem(
                        title: "Buy groceries",
                        subtitle: "Whole Foods Market",
                        icon: "cart.fill",
                        accessory: .chevron,
                        action: {}
                    )
                    
                    Divider()
                    
                    ListItem(
                        title: "Enable notifications",
                        subtitle: "Get reminders when near your tasks",
                        icon: "bell.fill",
                        accessory: .toggle($toggleValue)
                    )
                    
                    Divider()
                    
                    ListItem(
                        title: "Premium features",
                        subtitle: "Unlock unlimited tasks",
                        icon: "star.fill",
                        iconColor: DesignSystem.Colors.warning,
                        accessory: .badge("Pro", DesignSystem.Colors.warning),
                        action: {}
                    )
                }
                .background(DesignSystem.Colors.surface)
                .designSystemCornerRadius()
                
                ExpandableListSection(
                    title: "Advanced Settings",
                    subtitle: "Customize your experience",
                    icon: "gear"
                ) {
                    VStack(spacing: 0) {
                        ListItem(
                            title: "Battery optimization",
                            subtitle: "Manage location accuracy",
                            accessory: .chevron
                        )
                        
                        Divider()
                        
                        ListItem(
                            title: "Privacy settings",
                            subtitle: "Control data sharing",
                            accessory: .chevron
                        )
                    }
                    .background(DesignSystem.Colors.background)
                }
                
                SwipeActionRow(
                    actions: [
                        SwipeActionRow.SwipeAction(
                            title: "Complete",
                            icon: "checkmark",
                            color: DesignSystem.Colors.success,
                            action: {}
                        ),
                        SwipeActionRow.SwipeAction(
                            title: "Delete",
                            icon: "trash",
                            color: DesignSystem.Colors.error,
                            action: {}
                        )
                    ]
                ) {
                    ListItem(
                        title: "Swipe me left",
                        subtitle: "Try swiping this item",
                        icon: "hand.draw.fill"
                    )
                }
            }
            .padding()
        }
        .background(DesignSystem.Colors.background)
    }
}