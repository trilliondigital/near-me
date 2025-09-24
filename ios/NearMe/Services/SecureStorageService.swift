import Foundation
import Security
import CryptoKit

// MARK: - Secure Storage Service

class SecureStorageService {
    static let shared = SecureStorageService()
    
    private let serviceName = "com.nearme.app"
    private let accessGroup: String? = nil // Set if using app groups
    
    private init() {}
    
    // MARK: - Error Types
    
    enum SecureStorageError: LocalizedError {
        case itemNotFound
        case duplicateItem
        case invalidData
        case encryptionFailed
        case decryptionFailed
        case keychainError(OSStatus)
        
        var errorDescription: String? {
            switch self {
            case .itemNotFound:
                return "Item not found in secure storage"
            case .duplicateItem:
                return "Item already exists in secure storage"
            case .invalidData:
                return "Invalid data format"
            case .encryptionFailed:
                return "Failed to encrypt data"
            case .decryptionFailed:
                return "Failed to decrypt data"
            case .keychainError(let status):
                return "Keychain error: \(status)"
            }
        }
    }
    
    // MARK: - Storage Keys
    
    enum StorageKey: String, CaseIterable {
        case authToken = "auth_token"
        case refreshToken = "refresh_token"
        case deviceId = "device_id"
        case encryptionKey = "encryption_key"
        case userCredentials = "user_credentials"
        case biometricKey = "biometric_key"
        case apiKey = "api_key"
        
        var accessibility: CFString {
            switch self {
            case .authToken, .refreshToken, .apiKey:
                return kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            case .deviceId, .encryptionKey:
                return kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            case .userCredentials, .biometricKey:
                return kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly
            }
        }
    }
    
    // MARK: - Basic Keychain Operations
    
    /// Store data in keychain with encryption
    func store<T: Codable>(_ item: T, for key: StorageKey) throws {
        let data = try encryptData(item)
        try storeData(data, for: key)
    }
    
    /// Retrieve and decrypt data from keychain
    func retrieve<T: Codable>(_ type: T.Type, for key: StorageKey) throws -> T {
        let encryptedData = try retrieveData(for: key)
        return try decryptData(encryptedData, as: type)
    }
    
    /// Store raw data in keychain
    func storeData(_ data: Data, for key: StorageKey) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key.rawValue,
            kSecValueData as String: data,
            kSecAttrAccessible as String: key.accessibility
        ]
        
        // Delete existing item first
        let deleteStatus = SecItemDelete(query as CFDictionary)
        
        // Add new item
        let status = SecItemAdd(query as CFDictionary, nil)
        
        guard status == errSecSuccess else {
            throw SecureStorageError.keychainError(status)
        }
    }
    
    /// Retrieve raw data from keychain
    func retrieveData(for key: StorageKey) throws -> Data {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key.rawValue,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess else {
            if status == errSecItemNotFound {
                throw SecureStorageError.itemNotFound
            } else {
                throw SecureStorageError.keychainError(status)
            }
        }
        
        guard let data = result as? Data else {
            throw SecureStorageError.invalidData
        }
        
        return data
    }
    
    /// Delete item from keychain
    func delete(for key: StorageKey) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key.rawValue
        ]
        
        let status = SecItemDelete(query as CFDictionary)
        
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw SecureStorageError.keychainError(status)
        }
    }
    
    /// Check if item exists in keychain
    func exists(for key: StorageKey) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key.rawValue,
            kSecReturnData as String: false
        ]
        
        let status = SecItemCopyMatching(query as CFDictionary, nil)
        return status == errSecSuccess
    }
    
    // MARK: - Encryption/Decryption
    
    private func encryptData<T: Codable>(_ item: T) throws -> Data {
        do {
            let jsonData = try JSONEncoder().encode(item)
            let encryptionKey = try getOrCreateEncryptionKey()
            
            let sealedBox = try AES.GCM.seal(jsonData, using: encryptionKey)
            return sealedBox.combined!
        } catch {
            throw SecureStorageError.encryptionFailed
        }
    }
    
    private func decryptData<T: Codable>(_ data: Data, as type: T.Type) throws -> T {
        do {
            let encryptionKey = try getOrCreateEncryptionKey()
            let sealedBox = try AES.GCM.SealedBox(combined: data)
            let decryptedData = try AES.GCM.open(sealedBox, using: encryptionKey)
            
            return try JSONDecoder().decode(type, from: decryptedData)
        } catch {
            throw SecureStorageError.decryptionFailed
        }
    }
    
    private func getOrCreateEncryptionKey() throws -> SymmetricKey {
        do {
            let keyData = try retrieveData(for: .encryptionKey)
            return SymmetricKey(data: keyData)
        } catch SecureStorageError.itemNotFound {
            // Generate new key
            let key = SymmetricKey(size: .bits256)
            let keyData = key.withUnsafeBytes { Data($0) }
            try storeData(keyData, for: .encryptionKey)
            return key
        }
    }
    
    // MARK: - Biometric Authentication
    
    /// Store data with biometric authentication requirement
    func storeBiometric<T: Codable>(_ item: T, for key: StorageKey) throws {
        let data = try encryptData(item)
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key.rawValue,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleBiometryCurrentSet
        ]
        
        // Delete existing item first
        let deleteStatus = SecItemDelete(query as CFDictionary)
        
        // Add new item
        let status = SecItemAdd(query as CFDictionary, nil)
        
        guard status == errSecSuccess else {
            throw SecureStorageError.keychainError(status)
        }
    }
    
    /// Retrieve data with biometric authentication
    func retrieveBiometric<T: Codable>(_ type: T.Type, for key: StorageKey, prompt: String) async throws -> T {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key.rawValue,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecUseOperationPrompt as String: prompt
        ]
        
        return try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                var result: AnyObject?
                let status = SecItemCopyMatching(query as CFDictionary, &result)
                
                DispatchQueue.main.async {
                    do {
                        guard status == errSecSuccess else {
                            if status == errSecItemNotFound {
                                continuation.resume(throwing: SecureStorageError.itemNotFound)
                            } else {
                                continuation.resume(throwing: SecureStorageError.keychainError(status))
                            }
                            return
                        }
                        
                        guard let data = result as? Data else {
                            continuation.resume(throwing: SecureStorageError.invalidData)
                            return
                        }
                        
                        let decryptedItem = try self.decryptData(data, as: type)
                        continuation.resume(returning: decryptedItem)
                    } catch {
                        continuation.resume(throwing: error)
                    }
                }
            }
        }
    }
    
    // MARK: - Token Management
    
    /// Store authentication tokens securely
    func storeAuthTokens(accessToken: String, refreshToken: String) throws {
        try store(accessToken, for: .authToken)
        try store(refreshToken, for: .refreshToken)
    }
    
    /// Retrieve authentication tokens
    func getAuthTokens() throws -> (accessToken: String, refreshToken: String) {
        let accessToken = try retrieve(String.self, for: .authToken)
        let refreshToken = try retrieve(String.self, for: .refreshToken)
        return (accessToken, refreshToken)
    }
    
    /// Clear authentication tokens
    func clearAuthTokens() {
        try? delete(for: .authToken)
        try? delete(for: .refreshToken)
    }
    
    /// Store device ID
    func storeDeviceId(_ deviceId: String) throws {
        try store(deviceId, for: .deviceId)
    }
    
    /// Get or generate device ID
    func getOrCreateDeviceId() throws -> String {
        do {
            return try retrieve(String.self, for: .deviceId)
        } catch SecureStorageError.itemNotFound {
            let deviceId = UUID().uuidString
            try storeDeviceId(deviceId)
            return deviceId
        }
    }
    
    // MARK: - Secure Data Wiping
    
    /// Securely wipe all stored data
    func wipeAllData() {
        for key in StorageKey.allCases {
            try? delete(for: key)
        }
        
        // Also clear any cached encryption keys
        clearMemoryCache()
    }
    
    private func clearMemoryCache() {
        // Clear any in-memory cached keys or sensitive data
        // This would be implemented based on your caching strategy
    }
    
    // MARK: - Data Integrity
    
    /// Verify data integrity using HMAC
    func storeWithIntegrity<T: Codable>(_ item: T, for key: StorageKey) throws {
        let jsonData = try JSONEncoder().encode(item)
        let hmac = calculateHMAC(for: jsonData)
        
        let dataWithHMAC = DataWithIntegrity(data: jsonData, hmac: hmac)
        let encryptedData = try encryptData(dataWithHMAC)
        try storeData(encryptedData, for: key)
    }
    
    /// Retrieve and verify data integrity
    func retrieveWithIntegrity<T: Codable>(_ type: T.Type, for key: StorageKey) throws -> T {
        let encryptedData = try retrieveData(for: key)
        let dataWithHMAC = try decryptData(encryptedData, as: DataWithIntegrity.self)
        
        // Verify HMAC
        let expectedHMAC = calculateHMAC(for: dataWithHMAC.data)
        guard dataWithHMAC.hmac == expectedHMAC else {
            throw SecureStorageError.invalidData
        }
        
        return try JSONDecoder().decode(type, from: dataWithHMAC.data)
    }
    
    private func calculateHMAC(for data: Data) -> String {
        let key = SymmetricKey(size: .bits256)
        let hmac = HMAC<SHA256>.authenticationCode(for: data, using: key)
        return Data(hmac).base64EncodedString()
    }
    
    // MARK: - Migration and Backup
    
    /// Migrate data to new encryption scheme
    func migrateEncryption() throws {
        // Implementation for migrating existing data to new encryption
        // This would be called during app updates
    }
    
    /// Export encrypted backup of keychain data
    func exportBackup() throws -> Data {
        var backup: [String: Data] = [:]
        
        for key in StorageKey.allCases {
            if exists(for: key) {
                backup[key.rawValue] = try retrieveData(for: key)
            }
        }
        
        return try JSONEncoder().encode(backup)
    }
    
    /// Import encrypted backup
    func importBackup(_ backupData: Data) throws {
        let backup = try JSONDecoder().decode([String: Data].self, from: backupData)
        
        for (keyString, data) in backup {
            if let key = StorageKey(rawValue: keyString) {
                try storeData(data, for: key)
            }
        }
    }
}

// MARK: - Supporting Types

private struct DataWithIntegrity: Codable {
    let data: Data
    let hmac: String
}

// MARK: - Convenience Extensions

extension SecureStorageService {
    /// Check if user is authenticated
    var isAuthenticated: Bool {
        return exists(for: .authToken) && exists(for: .refreshToken)
    }
    
    /// Get current access token if available
    var currentAccessToken: String? {
        return try? retrieve(String.self, for: .authToken)
    }
    
    /// Check if biometric authentication is available
    var isBiometricAvailable: Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.biometryAny, error: &error)
    }
}

import LocalAuthentication

extension SecureStorageService {
    /// Check biometric authentication availability
    func checkBiometricAvailability() -> (available: Bool, type: LABiometryType) {
        let context = LAContext()
        var error: NSError?
        
        let available = context.canEvaluatePolicy(.biometryAny, error: &error)
        return (available, context.biometryType)
    }
}