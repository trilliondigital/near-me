import SwiftUI

struct PremiumView: View {
    @StateObject private var userService = UserService.shared
    @Environment(\.dismiss) private var dismiss
    
    @State private var selectedTab = 0
    @State private var showingTrialAlert = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    headerSection
                    
                    // Current Status
                    if let user = userService.currentUser {
                        currentStatusSection(user: user)
                    }
                    
                    // Tab Selection
                    tabSelector
                    
                    // Content based on selected tab
                    if selectedTab == 0 {
                        featuresSection
                    } else {
                        pricingSection
                    }
                    
                    // Action Buttons
                    actionButtons
                }
                .padding()
            }
            .navigationTitle("Premium")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .alert("Start Free Trial", isPresented: $showingTrialAlert) {
            Button("Start Trial") {
                userService.startTrial()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Start your 7-day free trial to unlock all premium features. Cancel anytime.")
        }
        .onAppear {
            userService.fetchCurrentUser()
        }
    }
    
    // MARK: - Header Section
    private var headerSection: some View {
        VStack(spacing: 16) {
            Image(systemName: "crown.fill")
                .font(.system(size: 60))
                .foregroundStyle(
                    LinearGradient(
                        colors: [.yellow, .orange],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
            
            VStack(spacing: 8) {
                Text("Near Me Premium")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Unlock the full potential of location-based reminders")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.vertical)
    }
    
    // MARK: - Current Status Section
    private func currentStatusSection(user: User) -> some View {
        VStack(spacing: 16) {
            HStack {
                Text("Current Plan")
                    .font(.headline)
                
                Spacer()
                
                PremiumBadge(status: user.premiumStatus, size: .medium)
            }
            
            if let taskLimit = userService.taskLimitStatus {
                TaskLimitProgress(status: taskLimit)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
    
    // MARK: - Tab Selector
    private var tabSelector: some View {
        HStack(spacing: 0) {
            Button("Features") {
                selectedTab = 0
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(selectedTab == 0 ? Color.blue : Color.clear)
            .foregroundColor(selectedTab == 0 ? .white : .blue)
            
            Button("Pricing") {
                selectedTab = 1
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(selectedTab == 1 ? Color.blue : Color.clear)
            .foregroundColor(selectedTab == 1 ? .white : .blue)
        }
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
    
    // MARK: - Features Section
    private var featuresSection: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("What's Included")
                .font(.headline)
            
            VStack(spacing: 16) {
                ForEach(userService.getPremiumFeatures(), id: \.rawValue) { feature in
                    PremiumFeatureRow(
                        feature: feature,
                        isAvailable: userService.hasFeature(feature)
                    )
                }
            }
        }
    }
    
    // MARK: - Pricing Section
    private var pricingSection: some View {
        VStack(spacing: 20) {
            Text("Choose Your Plan")
                .font(.headline)
            
            VStack(spacing: 16) {
                // Free Plan
                PricingCard(
                    title: "Free",
                    price: "$0",
                    period: "forever",
                    features: [
                        "Up to 3 active tasks",
                        "Basic notifications",
                        "Standard geofencing"
                    ],
                    isCurrentPlan: userService.currentUser?.premiumStatus == .free,
                    isRecommended: false,
                    action: nil
                )
                
                // Premium Plan
                PricingCard(
                    title: "Premium",
                    price: "$4.99",
                    period: "month",
                    features: [
                        "Unlimited tasks",
                        "Custom notification sounds",
                        "Detailed notifications",
                        "Advanced geofencing",
                        "Priority support",
                        "Export data"
                    ],
                    isCurrentPlan: userService.currentUser?.premiumStatus == .premium,
                    isRecommended: true,
                    action: {
                        // Handle subscription purchase
                    }
                )
            }
        }
    }
    
    // MARK: - Action Buttons
    private var actionButtons: some View {
        VStack(spacing: 12) {
            if userService.currentUser?.premiumStatus == .free {
                Button("Start 7-Day Free Trial") {
                    showingTrialAlert = true
                }
                .buttonStyle(.borderedProminent)
                .frame(maxWidth: .infinity)
                
                Button("Upgrade to Premium") {
                    // Handle direct purchase
                }
                .buttonStyle(.bordered)
                .frame(maxWidth: .infinity)
            } else if userService.currentUser?.premiumStatus == .trial {
                Button("Upgrade to Premium") {
                    // Handle subscription purchase
                }
                .buttonStyle(.borderedProminent)
                .frame(maxWidth: .infinity)
            }
            
            Text("Cancel anytime • No hidden fees")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Pricing Card
struct PricingCard: View {
    let title: String
    let price: String
    let period: String
    let features: [String]
    let isCurrentPlan: Bool
    let isRecommended: Bool
    let action: (() -> Void)?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(title)
                            .font(.headline)
                        
                        if isRecommended {
                            Text("RECOMMENDED")
                                .font(.caption2)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(Color.blue)
                                .cornerRadius(4)
                        }
                    }
                    
                    HStack(alignment: .bottom, spacing: 2) {
                        Text(price)
                            .font(.title)
                            .fontWeight(.bold)
                        
                        if !period.isEmpty {
                            Text("/\(period)")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                
                Spacer()
                
                if isCurrentPlan {
                    Text("CURRENT")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundColor(.green)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color.green.opacity(0.2))
                        .cornerRadius(4)
                }
            }
            
            // Features
            VStack(alignment: .leading, spacing: 8) {
                ForEach(features, id: \.self) { feature in
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark")
                            .foregroundColor(.green)
                            .font(.caption)
                        
                        Text(feature)
                            .font(.subheadline)
                    }
                }
            }
            
            // Action Button
            if let action = action, !isCurrentPlan {
                Button("Choose Plan") {
                    action()
                }
                .buttonStyle(.borderedProminent)
                .frame(maxWidth: .infinity)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isRecommended ? Color.blue : Color(.systemGray4), lineWidth: isRecommended ? 2 : 1)
        )
    }
}

// MARK: - Preview
#if DEBUG
struct PremiumView_Previews: PreviewProvider {
    static var previews: some View {
        PremiumView()
    }
}
#endif