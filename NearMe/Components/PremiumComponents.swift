import SwiftUI

// MARK: - Premium Badge
struct PremiumBadge: View {
    let status: PremiumStatus
    let size: BadgeSize
    
    enum BadgeSize {
        case small, medium, large
        
        var fontSize: CGFloat {
            switch self {
            case .small: return 10
            case .medium: return 12
            case .large: return 14
            }
        }
        
        var padding: EdgeInsets {
            switch self {
            case .small: return EdgeInsets(top: 2, leading: 6, bottom: 2, trailing: 6)
            case .medium: return EdgeInsets(top: 4, leading: 8, bottom: 4, trailing: 8)
            case .large: return EdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12)
            }
        }
    }
    
    var body: some View {
        Text(status.displayName.uppercased())
            .font(.system(size: size.fontSize, weight: .bold, design: .rounded))
            .foregroundColor(.white)
            .padding(size.padding)
            .background(
                RoundedRectangle(cornerRadius: size.fontSize)
                    .fill(Color(status.badgeColor))
            )
    }
}

// MARK: - Task Limit Progress
struct TaskLimitProgress: View {
    let status: TaskLimitStatus
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Active Tasks")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                if status.isPremium {
                    HStack(spacing: 4) {
                        Image(systemName: "infinity")
                            .foregroundColor(.blue)
                        Text("Unlimited")
                            .font(.subheadline)
                            .foregroundColor(.blue)
                    }
                } else {
                    Text("\(status.currentCount)/\(status.maxCount)")
                        .font(.subheadline)
                        .foregroundColor(status.warningThreshold ? .orange : .primary)
                }
            }
            
            if !status.isPremium {
                ProgressView(value: status.progressPercentage)
                    .progressViewStyle(LinearProgressViewStyle(tint: status.warningThreshold ? .orange : .blue))
                
                if status.isAtLimit {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.orange)
                        Text("Task limit reached")
                            .font(.caption)
                            .foregroundColor(.orange)
                    }
                } else if status.warningThreshold {
                    HStack {
                        Image(systemName: "info.circle.fill")
                            .foregroundColor(.orange)
                        Text("\(status.remainingTasks) task remaining")
                            .font(.caption)
                            .foregroundColor(.orange)
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

// MARK: - Premium Feature Row
struct PremiumFeatureRow: View {
    let feature: PremiumFeature
    let isAvailable: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: feature.icon)
                .font(.title2)
                .foregroundColor(isAvailable ? .blue : .gray)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(feature.displayName)
                    .font(.headline)
                    .foregroundColor(isAvailable ? .primary : .gray)
                
                Text(feature.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.leading)
            }
            
            Spacer()
            
            if isAvailable {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
            } else {
                Image(systemName: "lock.fill")
                    .foregroundColor(.gray)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Upgrade Prompt Card
struct UpgradePromptCard: View {
    let onUpgrade: () -> Void
    let onDismiss: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Upgrade to Premium")
                        .font(.headline)
                        .foregroundColor(.primary)
                    
                    Text("Unlock unlimited tasks and premium features")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .foregroundColor(.gray)
                        .font(.caption)
                }
            }
            
            HStack(spacing: 12) {
                Button("Learn More") {
                    onUpgrade()
                }
                .buttonStyle(.bordered)
                
                Button("Upgrade Now") {
                    onUpgrade()
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .background(
            LinearGradient(
                colors: [Color.blue.opacity(0.1), Color.purple.opacity(0.1)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.blue.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Feature Lock Overlay
struct FeatureLockOverlay: View {
    let feature: PremiumFeature
    let onUpgrade: () -> Void
    
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "lock.fill")
                .font(.largeTitle)
                .foregroundColor(.gray)
            
            VStack(spacing: 8) {
                Text("Premium Feature")
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Text(feature.displayName)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                Text(feature.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }
            
            Button("Upgrade to Premium") {
                onUpgrade()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(24)
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(radius: 10)
    }
}

// MARK: - Task Limit Alert
struct TaskLimitAlert: View {
    let onUpgrade: () -> Void
    let onDismiss: () -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.largeTitle)
                .foregroundColor(.orange)
            
            VStack(spacing: 8) {
                Text("Task Limit Reached")
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Text("Free users are limited to 3 active tasks. Upgrade to Premium for unlimited tasks and more features.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            VStack(spacing: 12) {
                Button("Upgrade to Premium") {
                    onUpgrade()
                }
                .buttonStyle(.borderedProminent)
                .frame(maxWidth: .infinity)
                
                Button("Maybe Later") {
                    onDismiss()
                }
                .buttonStyle(.bordered)
                .frame(maxWidth: .infinity)
            }
        }
        .padding(24)
        .background(Color(.systemBackground))
        .cornerRadius(16)
        .shadow(radius: 10)
    }
}

// MARK: - Premium Features List
struct PremiumFeaturesList: View {
    let features: [PremiumFeature]
    let userService: UserService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Premium Features")
                .font(.headline)
                .foregroundColor(.primary)
            
            VStack(spacing: 12) {
                ForEach(features, id: \.rawValue) { feature in
                    PremiumFeatureRow(
                        feature: feature,
                        isAvailable: userService.hasFeature(feature)
                    )
                }
            }
        }
    }
}

// MARK: - Preview Helpers
#if DEBUG
struct PremiumComponents_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 20) {
            PremiumBadge(status: .premium, size: .medium)
            
            TaskLimitProgress(status: TaskLimitStatus(
                currentCount: 2,
                maxCount: 3,
                isPremium: false
            ))
            
            PremiumFeatureRow(
                feature: .unlimitedTasks,
                isAvailable: false
            )
            
            UpgradePromptCard(
                onUpgrade: {},
                onDismiss: {}
            )
        }
        .padding()
        .previewLayout(.sizeThatFits)
    }
}
#endif