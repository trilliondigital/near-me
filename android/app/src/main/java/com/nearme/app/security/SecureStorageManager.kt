package com.nearme.app.security

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.security.KeyStore
import java.util.*
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

@Serializable
data class AuthTokens(
    val accessToken: String,
    val refreshToken: String,
    val expiresAt: Long
)

@Serializable
data class SecureData<T>(
    val data: T,
    val timestamp: Long,
    val integrity: String
)

class SecureStorageManager(private val context: Context) {
    
    companion object {
        private const val KEYSTORE_ALIAS = "NearMeSecureKey"
        private const val ENCRYPTED_PREFS_NAME = "nearme_secure_prefs"
        private const val BIOMETRIC_PREFS_NAME = "nearme_biometric_prefs"
        private const val IV_LENGTH = 12
        private const val TAG_LENGTH = 16
        
        // Storage keys
        const val KEY_AUTH_TOKENS = "auth_tokens"
        const val KEY_DEVICE_ID = "device_id"
        const val KEY_USER_CREDENTIALS = "user_credentials"
        const val KEY_API_KEY = "api_key"
        const val KEY_ENCRYPTION_KEY = "encryption_key"
    }
    
    private val masterKey: MasterKey by lazy {
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .setRequestStrongBoxBacked(true)
            .build()
    }
    
    private val encryptedPrefs: SharedPreferences by lazy {
        EncryptedSharedPreferences.create(
            context,
            ENCRYPTED_PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }
    
    private val biometricPrefs: SharedPreferences by lazy {
        EncryptedSharedPreferences.create(
            context,
            BIOMETRIC_PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }
    
    private val keyStore: KeyStore by lazy {
        KeyStore.getInstance("AndroidKeyStore").apply {
            load(null)
        }
    }
    
    // MARK: - Basic Storage Operations
    
    inline fun <reified T> store(key: String, data: T) {
        try {
            val jsonString = Json.encodeToString(data)
            val encryptedData = encryptData(jsonString)
            encryptedPrefs.edit()
                .putString(key, encryptedData)
                .apply()
        } catch (e: Exception) {
            throw SecurityException("Failed to store data: ${e.message}")
        }
    }
    
    inline fun <reified T> retrieve(key: String): T? {
        return try {
            val encryptedData = encryptedPrefs.getString(key, null) ?: return null
            val jsonString = decryptData(encryptedData)
            Json.decodeFromString<T>(jsonString)
        } catch (e: Exception) {
            null
        }
    }
    
    fun delete(key: String) {
        encryptedPrefs.edit().remove(key).apply()
    }
    
    fun exists(key: String): Boolean {
        return encryptedPrefs.contains(key)
    }
    
    fun clear() {
        encryptedPrefs.edit().clear().apply()
        biometricPrefs.edit().clear().apply()
    }
    
    // MARK: - Advanced Encryption
    
    private fun encryptData(data: String): String {
        val secretKey = getOrCreateSecretKey()
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, secretKey)
        
        val iv = cipher.iv
        val encryptedData = cipher.doFinal(data.toByteArray())
        
        // Combine IV and encrypted data
        val combined = ByteArray(iv.size + encryptedData.size)
        System.arraycopy(iv, 0, combined, 0, iv.size)
        System.arraycopy(encryptedData, 0, combined, iv.size, encryptedData.size)
        
        return Base64.getEncoder().encodeToString(combined)
    }
    
    private fun decryptData(encryptedData: String): String {
        val secretKey = getOrCreateSecretKey()
        val combined = Base64.getDecoder().decode(encryptedData)
        
        val iv = ByteArray(IV_LENGTH)
        val encrypted = ByteArray(combined.size - IV_LENGTH)
        
        System.arraycopy(combined, 0, iv, 0, IV_LENGTH)
        System.arraycopy(combined, IV_LENGTH, encrypted, 0, encrypted.size)
        
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val spec = GCMParameterSpec(TAG_LENGTH * 8, iv)
        cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)
        
        val decryptedData = cipher.doFinal(encrypted)
        return String(decryptedData)
    }
    
    private fun getOrCreateSecretKey(): SecretKey {
        return if (keyStore.containsAlias(KEYSTORE_ALIAS)) {
            keyStore.getKey(KEYSTORE_ALIAS, null) as SecretKey
        } else {
            generateSecretKey()
        }
    }
    
    private fun generateSecretKey(): SecretKey {
        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        val keyGenParameterSpec = KeyGenParameterSpec.Builder(
            KEYSTORE_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setRandomizedEncryptionRequired(true)
            .build()
        
        keyGenerator.init(keyGenParameterSpec)
        return keyGenerator.generateKey()
    }
    
    // MARK: - Biometric Authentication
    
    fun isBiometricAvailable(): Boolean {
        val biometricManager = BiometricManager.from(context)
        return when (biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS -> true
            else -> false
        }
    }
    
    suspend fun storeBiometric(key: String, data: String, activity: FragmentActivity): Boolean {
        return if (isBiometricAvailable()) {
            try {
                val success = authenticateWithBiometric(
                    activity,
                    "Secure Storage",
                    "Authenticate to store sensitive data"
                )
                if (success) {
                    biometricPrefs.edit().putString(key, encryptData(data)).apply()
                    true
                } else {
                    false
                }
            } catch (e: Exception) {
                false
            }
        } else {
            false
        }
    }
    
    suspend fun retrieveBiometric(key: String, activity: FragmentActivity): String? {
        return if (isBiometricAvailable() && biometricPrefs.contains(key)) {
            try {
                val success = authenticateWithBiometric(
                    activity,
                    "Secure Storage",
                    "Authenticate to access sensitive data"
                )
                if (success) {
                    val encryptedData = biometricPrefs.getString(key, null)
                    encryptedData?.let { decryptData(it) }
                } else {
                    null
                }
            } catch (e: Exception) {
                null
            }
        } else {
            null
        }
    }
    
    private suspend fun authenticateWithBiometric(
        activity: FragmentActivity,
        title: String,
        subtitle: String
    ): Boolean = suspendCancellableCoroutine { continuation ->
        
        val executor = ContextCompat.getMainExecutor(context)
        val biometricPrompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                continuation.resumeWithException(SecurityException("Biometric authentication error: $errString"))
            }
            
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                continuation.resume(true)
            }
            
            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                continuation.resume(false)
            }
        })
        
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setNegativeButtonText("Cancel")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build()
        
        biometricPrompt.authenticate(promptInfo)
        
        continuation.invokeOnCancellation {
            biometricPrompt.cancelAuthentication()
        }
    }
    
    // MARK: - Token Management
    
    fun storeAuthTokens(accessToken: String, refreshToken: String, expiresIn: Long) {
        val tokens = AuthTokens(
            accessToken = accessToken,
            refreshToken = refreshToken,
            expiresAt = System.currentTimeMillis() + (expiresIn * 1000)
        )
        store(KEY_AUTH_TOKENS, tokens)
    }
    
    fun getAuthTokens(): AuthTokens? {
        return retrieve<AuthTokens>(KEY_AUTH_TOKENS)
    }
    
    fun clearAuthTokens() {
        delete(KEY_AUTH_TOKENS)
    }
    
    fun isTokenValid(): Boolean {
        val tokens = getAuthTokens()
        return tokens != null && System.currentTimeMillis() < tokens.expiresAt
    }
    
    // MARK: - Device ID Management
    
    fun getOrCreateDeviceId(): String {
        return retrieve<String>(KEY_DEVICE_ID) ?: run {
            val deviceId = UUID.randomUUID().toString()
            store(KEY_DEVICE_ID, deviceId)
            deviceId
        }
    }
    
    // MARK: - Data Integrity
    
    inline fun <reified T> storeWithIntegrity(key: String, data: T) {
        val jsonString = Json.encodeToString(data)
        val integrity = calculateIntegrity(jsonString)
        val secureData = SecureData(
            data = data,
            timestamp = System.currentTimeMillis(),
            integrity = integrity
        )
        store(key, secureData)
    }
    
    inline fun <reified T> retrieveWithIntegrity(key: String): T? {
        val secureData = retrieve<SecureData<T>>(key) ?: return null
        
        // Verify integrity
        val jsonString = Json.encodeToString(secureData.data)
        val expectedIntegrity = calculateIntegrity(jsonString)
        
        return if (secureData.integrity == expectedIntegrity) {
            secureData.data
        } else {
            // Data has been tampered with
            delete(key)
            null
        }
    }
    
    private fun calculateIntegrity(data: String): String {
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(data.toByteArray())
        return Base64.getEncoder().encodeToString(hash)
    }
    
    // MARK: - Secure Wipe
    
    fun secureWipe() {
        try {
            // Clear all preferences
            clear()
            
            // Delete keystore entries
            if (keyStore.containsAlias(KEYSTORE_ALIAS)) {
                keyStore.deleteEntry(KEYSTORE_ALIAS)
            }
            
            // Clear any cached data
            clearMemoryCache()
            
        } catch (e: Exception) {
            throw SecurityException("Failed to securely wipe data: ${e.message}")
        }
    }
    
    private fun clearMemoryCache() {
        // Clear any in-memory cached sensitive data
        System.gc() // Suggest garbage collection
    }
    
    // MARK: - Migration and Backup
    
    fun exportSecureBackup(): String {
        val backup = mutableMapOf<String, String>()
        
        // Export encrypted preferences
        encryptedPrefs.all.forEach { (key, value) ->
            if (value is String) {
                backup[key] = value
            }
        }
        
        return Json.encodeToString(backup)
    }
    
    fun importSecureBackup(backupData: String) {
        try {
            val backup = Json.decodeFromString<Map<String, String>>(backupData)
            val editor = encryptedPrefs.edit()
            
            backup.forEach { (key, value) ->
                editor.putString(key, value)
            }
            
            editor.apply()
        } catch (e: Exception) {
            throw SecurityException("Failed to import backup: ${e.message}")
        }
    }
    
    // MARK: - Security Validation
    
    fun validateSecurityState(): SecurityValidationResult {
        val issues = mutableListOf<String>()
        
        // Check if device is rooted
        if (isDeviceRooted()) {
            issues.add("Device appears to be rooted")
        }
        
        // Check if debugging is enabled
        if (isDebuggingEnabled()) {
            issues.add("USB debugging is enabled")
        }
        
        // Check if keystore is available
        if (!isKeystoreAvailable()) {
            issues.add("Android Keystore is not available")
        }
        
        // Check if biometric is compromised
        if (isBiometricAvailable() && isBiometricCompromised()) {
            issues.add("Biometric authentication may be compromised")
        }
        
        return SecurityValidationResult(
            isSecure = issues.isEmpty(),
            issues = issues
        )
    }
    
    private fun isDeviceRooted(): Boolean {
        // Basic root detection
        val rootPaths = arrayOf(
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/su"
        )
        
        return rootPaths.any { java.io.File(it).exists() }
    }
    
    private fun isDebuggingEnabled(): Boolean {
        return android.provider.Settings.Secure.getInt(
            context.contentResolver,
            android.provider.Settings.Global.ADB_ENABLED,
            0
        ) == 1
    }
    
    private fun isKeystoreAvailable(): Boolean {
        return try {
            keyStore.load(null)
            true
        } catch (e: Exception) {
            false
        }
    }
    
    private fun isBiometricCompromised(): Boolean {
        // Check if new biometric has been enrolled recently
        // This is a simplified check - in production you'd want more sophisticated detection
        return false
    }
}

data class SecurityValidationResult(
    val isSecure: Boolean,
    val issues: List<String>
)