import SwiftUI
import StoreKit

struct SubscriptionManagementView: View {
    @StateObject private var subscriptionService = SubscriptionService.shared
    @StateObject private var userService = UserService.shared
    @Environment(\.dismiss) private var dismiss
    
    @State private var showingCancelAlert = false
    @State private var subscriptionInfo: SubscriptionInfo?
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Current Subscription Status
                    currentSubscriptionSection
                    
                    // Subscription Details
                    if let subscription = subscriptionInfo {
                        subscriptionDetailsSection(subscription)
                    }
                    
                    // Manage Subscription Actions
                    managementActionsSection
                    
                    // Billing Information
                    billingInformationSection
                }
                .padding()
            }
            .navigationTitle("Manage Subscription")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .alert("Cancel Subscription", isPresented: $showingCancelAlert) {
            Button("Cancel Subscription", role: .destructive) {
                Task {
                    await cancelSubscription()
                }
            }
            Button("Keep Subscription", role: .cancel) {}
        } message: {
            Text("Are you sure you want to cancel your subscription? You'll lose access to premium features at the end of your current billing period.")
        }
        .onAppear {
            Task {
                await loadSubscriptionInfo()
            }
        }
    }
    
    // MARK: - Current Subscription Section
    
    private var currentSubscriptionSection: some View {
        VStack(spacing: 16) {
            HStack {
                Image(systemName: "crown.fill")
                    .font(.title2)
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.yellow, .orange],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Premium Subscription")
                        .font(.headline)
                    
                    if let user = userService.currentUser {
                        PremiumBadge(status: user.premiumStatus, size: .small)
                    }
                }
                
                Spacer()
            }
            
            if subscriptionService.isLoading {
                ProgressView("Loading subscription details...")
                    .frame(maxWidth: .infinity)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
    
    // MARK: - Subscription Details Section
    
    private func subscriptionDetailsSection(_ subscription: SubscriptionInfo) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Subscription Details")
                .font(.headline)
            
            VStack(spacing: 12) {
                DetailRow(title: "Plan", value: subscription.planId.replacingOccurrences(of: "_", with: " ").capitalized)
                DetailRow(title: "Status", value: subscription.status.capitalized)
                DetailRow(title: "Started", value: DateFormatter.shortDate.string(from: subscription.startDate))
                DetailRow(title: "Renews", value: DateFormatter.shortDate.string(from: subscription.endDate))
                
                if subscription.isTrial, let trialEnd = subscription.trialEndDate {
                    DetailRow(title: "Trial Ends", value: DateFormatter.shortDate.string(from: trialEnd))
                }
                
                DetailRow(title: "Auto-Renewal", value: subscription.autoRenew ? "On" : "Off")
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(.systemGray4), lineWidth: 1)
        )
    }
    
    // MARK: - Management Actions Section
    
    private var managementActionsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Manage Subscription")
                .font(.headline)
            
            VStack(spacing: 12) {
                // Restore Purchases
                Button(action: {
                    Task {
                        await subscriptionService.restorePurchases()
                        await loadSubscriptionInfo()
                    }
                }) {
                    HStack {
                        Image(systemName: "arrow.clockwise")
                        Text("Restore Purchases")
                        Spacer()
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                }
                .disabled(subscriptionService.isLoading)
                
                // Manage in App Store
                Button(action: {
                    Task {
                        await openSubscriptionManagement()
                    }
                }) {
                    HStack {
                        Image(systemName: "gear")
                        Text("Manage in App Store")
                        Spacer()
                        Image(systemName: "arrow.up.right")
                            .font(.caption)
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                }
                
                // Cancel Subscription (if active)
                if subscriptionInfo?.isActive == true {
                    Button(action: {
                        showingCancelAlert = true
                    }) {
                        HStack {
                            Image(systemName: "xmark.circle")
                            Text("Cancel Subscription")
                            Spacer()
                        }
                        .padding()
                        .background(Color.red.opacity(0.1))
                        .cornerRadius(8)
                    }
                    .foregroundColor(.red)
                }
            }
        }
    }
    
    // MARK: - Billing Information Section
    
    private var billingInformationSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Billing Information")
                .font(.headline)
            
            VStack(alignment: .leading, spacing: 8) {
                Text("• Subscriptions are billed through your Apple ID account")
                Text("• You can manage your subscription and turn off auto-renewal in your Apple ID settings")
                Text("• Cancellation takes effect at the end of your current billing period")
                Text("• No refunds for partial periods")
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
    
    // MARK: - Helper Methods
    
    private func loadSubscriptionInfo() async {
        subscriptionInfo = await userService.getSubscriptionStatus()?.subscription
    }
    
    private func cancelSubscription() async {
        // Note: In StoreKit 2, cancellation is handled through the App Store
        // We can only update our backend to reflect the cancellation intent
        do {
            let _: APIResponse<SubscriptionResponse> = try await APIClient.shared.request(
                endpoint: "/subscriptions/cancel",
                method: .DELETE
            )
            
            await loadSubscriptionInfo()
            await userService.fetchCurrentUser()
        } catch {
            print("Failed to cancel subscription: \(error)")
        }
    }
    
    private func openSubscriptionManagement() async {
        do {
            try await AppStore.showManageSubscriptions(in: UIApplication.shared.connectedScenes.first as? UIWindowScene ?? UIWindowScene())
        } catch {
            print("Failed to open subscription management: \(error)")
        }
    }
}

// MARK: - Detail Row Component

struct DetailRow: View {
    let title: String
    let value: String
    
    var body: some View {
        HStack {
            Text(title)
                .foregroundColor(.secondary)
            
            Spacer()
            
            Text(value)
                .fontWeight(.medium)
        }
    }
}

// MARK: - Date Formatter Extension

extension DateFormatter {
    static let shortDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()
}

// MARK: - Preview

#if DEBUG
struct SubscriptionManagementView_Previews: PreviewProvider {
    static var previews: some View {
        SubscriptionManagementView()
    }
}
#endif