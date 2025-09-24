import Foundation
import StoreKit

@MainActor
class SubscriptionService: ObservableObject {
    static let shared = SubscriptionService()
    
    @Published var subscriptionStatus: SubscriptionStatus = .unknown
    @Published var availableProducts: [Product] = []
    @Published var purchasedProducts: [Product] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private var updateListenerTask: Task<Void, Error>?
    
    // Product identifiers - these should match your App Store Connect configuration
    private let productIdentifiers: Set<String> = [
        "com.nearme.premium.monthly",
        "com.nearme.premium.yearly"
    ]
    
    enum SubscriptionStatus {
        case unknown
        case notSubscribed
        case trial
        case subscribed
        case expired
    }
    
    enum SubscriptionError: LocalizedError {
        case productNotFound
        case purchaseFailed(String)
        case verificationFailed
        case networkError
        case userCancelled
        
        var errorDescription: String? {
            switch self {
            case .productNotFound:
                return "Subscription product not found"
            case .purchaseFailed(let message):
                return "Purchase failed: \(message)"
            case .verificationFailed:
                return "Unable to verify purchase"
            case .networkError:
                return "Network error occurred"
            case .userCancelled:
                return "Purchase was cancelled"
            }
        }
    }
    
    private init() {
        // Start listening for transaction updates
        updateListenerTask = listenForTransactions()
        
        Task {
            await loadProducts()
            await updateSubscriptionStatus()
        }
    }
    
    deinit {
        updateListenerTask?.cancel()
    }
    
    // MARK: - Product Loading
    
    func loadProducts() async {
        isLoading = true
        errorMessage = nil
        
        do {
            let products = try await Product.products(for: productIdentifiers)
            
            await MainActor.run {
                self.availableProducts = products.sorted { product1, product2 in
                    // Sort by price, monthly first
                    if product1.id.contains("monthly") && product2.id.contains("yearly") {
                        return true
                    } else if product1.id.contains("yearly") && product2.id.contains("monthly") {
                        return false
                    }
                    return product1.price < product2.price
                }
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.errorMessage = "Failed to load products: \(error.localizedDescription)"
                self.isLoading = false
            }
        }
    }
    
    // MARK: - Purchase Handling
    
    func purchase(_ product: Product) async throws {
        isLoading = true
        errorMessage = nil
        
        do {
            let result = try await product.purchase()
            
            switch result {
            case .success(let verification):
                let transaction = try checkVerified(verification)
                
                // Process the successful purchase
                await processSuccessfulPurchase(transaction: transaction)
                
                // Finish the transaction
                await transaction.finish()
                
                await updateSubscriptionStatus()
                
            case .userCancelled:
                throw SubscriptionError.userCancelled
                
            case .pending:
                // Handle pending transactions (e.g., parental approval required)
                await MainActor.run {
                    self.errorMessage = "Purchase is pending approval"
                }
                
            @unknown default:
                throw SubscriptionError.purchaseFailed("Unknown purchase result")
            }
        } catch {
            await MainActor.run {
                if let subscriptionError = error as? SubscriptionError {
                    self.errorMessage = subscriptionError.localizedDescription
                } else {
                    self.errorMessage = "Purchase failed: \(error.localizedDescription)"
                }
            }
            throw error
        } finally {
            await MainActor.run {
                self.isLoading = false
            }
        }
    }
    
    // MARK: - Restore Purchases
    
    func restorePurchases() async {
        isLoading = true
        errorMessage = nil
        
        do {
            try await AppStore.sync()
            await updateSubscriptionStatus()
            
            await MainActor.run {
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.errorMessage = "Failed to restore purchases: \(error.localizedDescription)"
                self.isLoading = false
            }
        }
    }
    
    // MARK: - Subscription Status
    
    func updateSubscriptionStatus() async {
        var currentEntitlements: [Product] = []
        
        // Check for active subscriptions
        for await result in Transaction.currentEntitlements {
            do {
                let transaction = try checkVerified(result)
                
                if let product = availableProducts.first(where: { $0.id == transaction.productID }) {
                    currentEntitlements.append(product)
                }
            } catch {
                print("Failed to verify transaction: \(error)")
            }
        }
        
        await MainActor.run {
            self.purchasedProducts = currentEntitlements
            
            if !currentEntitlements.isEmpty {
                // Check if it's a trial or full subscription
                // This would require additional logic to determine trial status
                self.subscriptionStatus = .subscribed
            } else {
                self.subscriptionStatus = .notSubscribed
            }
        }
    }
    
    // MARK: - Trial Management
    
    func startTrial(for product: Product) async throws {
        // For StoreKit 2, trials are handled automatically by the App Store
        // when the product is configured with a free trial period
        try await purchase(product)
    }
    
    func isEligibleForTrial(product: Product) async -> Bool {
        // Check if user is eligible for introductory pricing
        let eligibility = await product.subscription?.introductoryOffer?.paymentMode
        return eligibility == .freeTrial
    }
    
    // MARK: - Private Methods
    
    private func listenForTransactions() -> Task<Void, Error> {
        return Task.detached {
            for await result in Transaction.updates {
                do {
                    let transaction = try self.checkVerified(result)
                    
                    // Process the transaction update
                    await self.processTransactionUpdate(transaction: transaction)
                    
                    // Finish the transaction
                    await transaction.finish()
                } catch {
                    print("Transaction verification failed: \(error)")
                }
            }
        }
    }
    
    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw SubscriptionError.verificationFailed
        case .verified(let safe):
            return safe
        }
    }
    
    private func processSuccessfulPurchase(transaction: Transaction) async {
        // Send purchase information to backend
        await sendPurchaseToBackend(transaction: transaction)
        
        // Update local subscription status
        await updateSubscriptionStatus()
    }
    
    private func processTransactionUpdate(transaction: Transaction) async {
        // Handle transaction updates (renewals, cancellations, etc.)
        await sendPurchaseToBackend(transaction: transaction)
        await updateSubscriptionStatus()
    }
    
    private func sendPurchaseToBackend(transaction: Transaction) async {
        guard let userService = UserService.shared.currentUser else {
            print("No current user to associate purchase with")
            return
        }
        
        do {
            // Get the receipt data
            guard let receiptData = await getReceiptData() else {
                print("Failed to get receipt data")
                return
            }
            
            let purchaseRequest = PurchaseRequest(
                planId: mapProductIdToPlanId(transaction.productID),
                platform: "ios",
                transactionId: String(transaction.id),
                originalTransactionId: transaction.originalID.map(String.init),
                receiptData: receiptData
            )
            
            let response = try await APIClient.shared.request(
                endpoint: "/subscriptions/purchase",
                method: .POST,
                body: purchaseRequest
            )
            
            print("Purchase sent to backend successfully")
            
        } catch {
            print("Failed to send purchase to backend: \(error)")
        }
    }
    
    private func getReceiptData() async -> String? {
        // In StoreKit 2, we use the transaction information instead of receipt data
        // For compatibility with backend, we'll create a simple receipt representation
        do {
            let transactions = await Transaction.all
            var receiptInfo: [String: Any] = [:]
            
            for await result in transactions {
                if case .verified(let transaction) = result {
                    receiptInfo[transaction.productID] = [
                        "transactionId": transaction.id,
                        "originalTransactionId": transaction.originalID,
                        "purchaseDate": transaction.purchaseDate,
                        "expirationDate": transaction.expirationDate
                    ]
                }
            }
            
            let receiptData = try JSONSerialization.data(withJSONObject: receiptInfo)
            return receiptData.base64EncodedString()
        } catch {
            print("Failed to create receipt data: \(error)")
            return nil
        }
    }
    
    private func mapProductIdToPlanId(_ productId: String) -> String {
        switch productId {
        case "com.nearme.premium.monthly":
            return "premium_monthly"
        case "com.nearme.premium.yearly":
            return "premium_yearly"
        default:
            return productId
        }
    }
}

// MARK: - Supporting Types

struct PurchaseRequest: Codable {
    let planId: String
    let platform: String
    let transactionId: String
    let originalTransactionId: String?
    let receiptData: String
}

struct SubscriptionPlan: Codable, Identifiable {
    let id: String
    let name: String
    let price: Double
    let currency: String
    let duration: String
    let features: [String]
    let trialDays: Int
}

struct TrialRequest: Codable {
    let planId: String
    let platform: String
}

// MARK: - Product Extensions

extension Product {
    var localizedPrice: String {
        return displayPrice
    }
    
    var isMonthly: Bool {
        return id.contains("monthly")
    }
    
    var isYearly: Bool {
        return id.contains("yearly")
    }
    
    var planId: String {
        switch id {
        case "com.nearme.premium.monthly":
            return "premium_monthly"
        case "com.nearme.premium.yearly":
            return "premium_yearly"
        default:
            return id
        }
    }
}