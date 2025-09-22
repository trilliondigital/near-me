package com.nearme.app.data.repository

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.nearme.app.data.api.NearMeApiService
import com.nearme.app.data.local.LocationPermissionManager
import com.nearme.app.ui.privacy.LocationPrivacyMode
import com.nearme.app.viewmodels.PrivacySettings
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

data class LocationPermissions(
    val fineLocationGranted: Boolean,
    val backgroundLocationGranted: Boolean
)

@Serializable
data class DataExportRequest(
    val userId: String,
    val includeLocationHistory: Boolean,
    val includeTasks: Boolean,
    val includePlaces: Boolean,
    val includeNotificationHistory: Boolean,
    val format: String
)

@Serializable
data class DataDeletionRequest(
    val userId: String,
    val deleteLocationHistory: Boolean,
    val deleteTasks: Boolean,
    val deletePlaces: Boolean,
    val deleteNotificationHistory: Boolean,
    val deleteAccount: Boolean,
    val confirmationCode: String
)

@Singleton
class PrivacyRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val apiService: NearMeApiService,
    private val locationPermissionManager: LocationPermissionManager
) {
    
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()
    
    private val encryptedPrefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "privacy_settings",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
    
    private val _locationPermissionFlow = MutableStateFlow(
        LocationPermissions(
            fineLocationGranted = locationPermissionManager.hasFineLocationPermission(),
            backgroundLocationGranted = locationPermissionManager.hasBackgroundLocationPermission()
        )
    )
    val locationPermissionFlow: Flow<LocationPermissions> = _locationPermissionFlow.asStateFlow()
    
    companion object {
        private const val PRIVACY_SETTINGS_KEY = "privacy_settings"
        private const val DEFAULT_RETENTION_DAYS = 30
    }
    
    init {
        // Observe location permission changes
        locationPermissionManager.observePermissionChanges { permissions ->
            _locationPermissionFlow.value = LocationPermissions(
                fineLocationGranted = permissions.fineLocationGranted,
                backgroundLocationGranted = permissions.backgroundLocationGranted
            )
        }
    }
    
    suspend fun getPrivacySettings(): PrivacySettings {
        return try {
            val settingsJson = encryptedPrefs.getString(PRIVACY_SETTINGS_KEY, null)
            if (settingsJson != null) {
                Json.decodeFromString<PrivacySettings>(settingsJson)
            } else {
                getDefaultPrivacySettings()
            }
        } catch (e: Exception) {
            getDefaultPrivacySettings()
        }
    }
    
    suspend fun updatePrivacySettings(settings: PrivacySettings) {
        try {
            // Save locally
            val settingsJson = Json.encodeToString(settings)
            encryptedPrefs.edit()
                .putString(PRIVACY_SETTINGS_KEY, settingsJson)
                .apply()
            
            // Sync with server
            syncPrivacySettingsToServer(settings)
            
            // Apply data retention policy if changed
            if (settings.locationHistoryRetention != DEFAULT_RETENTION_DAYS) {
                applyDataRetentionPolicy(settings.locationHistoryRetention)
            }
            
        } catch (e: Exception) {
            throw Exception("Failed to update privacy settings: ${e.message}")
        }
    }
    
    private suspend fun syncPrivacySettingsToServer(settings: PrivacySettings) {
        try {
            apiService.updatePrivacySettings(settings)
        } catch (e: Exception) {
            // Log error but don't fail the local update
            println("Failed to sync privacy settings to server: ${e.message}")
        }
    }
    
    fun applyLocationPrivacyMode(mode: LocationPrivacyMode) {
        when (mode) {
            LocationPrivacyMode.STANDARD -> {
                // Allow background location if permission is granted
                locationPermissionManager.enableBackgroundLocation()
            }
            LocationPrivacyMode.FOREGROUND_ONLY -> {
                // Restrict to foreground only
                locationPermissionManager.disableBackgroundLocation()
            }
        }
    }
    
    private fun applyDataRetentionPolicy(retentionDays: Int) {
        // This would typically involve cleaning up old location history
        // Implementation depends on local database structure
    }
    
    suspend fun requestDataExport(
        includeLocationHistory: Boolean,
        includeTasks: Boolean,
        includePlaces: Boolean,
        includeNotificationHistory: Boolean,
        format: String
    ) {
        try {
            val userId = getUserId() ?: throw Exception("User not authenticated")
            
            val exportRequest = DataExportRequest(
                userId = userId,
                includeLocationHistory = includeLocationHistory,
                includeTasks = includeTasks,
                includePlaces = includePlaces,
                includeNotificationHistory = includeNotificationHistory,
                format = format
            )
            
            apiService.requestDataExport(exportRequest)
            
        } catch (e: Exception) {
            throw Exception("Failed to request data export: ${e.message}")
        }
    }
    
    suspend fun deleteUserData(
        deleteLocationHistory: Boolean,
        deleteTasks: Boolean,
        deletePlaces: Boolean,
        deleteNotificationHistory: Boolean,
        deleteAccount: Boolean,
        confirmationCode: String
    ) {
        try {
            val userId = getUserId() ?: throw Exception("User not authenticated")
            
            val deletionRequest = DataDeletionRequest(
                userId = userId,
                deleteLocationHistory = deleteLocationHistory,
                deleteTasks = deleteTasks,
                deletePlaces = deletePlaces,
                deleteNotificationHistory = deleteNotificationHistory,
                deleteAccount = deleteAccount,
                confirmationCode = confirmationCode
            )
            
            apiService.requestDataDeletion(deletionRequest)
            
            // Clear local data if account was deleted
            if (deleteAccount) {
                clearAllLocalData()
            }
            
        } catch (e: Exception) {
            throw Exception("Failed to delete user data: ${e.message}")
        }
    }
    
    fun clearAllLocalData() {
        try {
            // Clear encrypted preferences
            encryptedPrefs.edit().clear().apply()
            
            // Clear regular shared preferences
            val regularPrefs = context.getSharedPreferences("nearme_prefs", Context.MODE_PRIVATE)
            regularPrefs.edit().clear().apply()
            
            // Clear database (would need database instance)
            // database.clearAllTables()
            
            // Clear file cache
            clearFileCache()
            
        } catch (e: Exception) {
            println("Error clearing local data: ${e.message}")
        }
    }
    
    private fun clearFileCache() {
        try {
            val cacheDir = context.cacheDir
            cacheDir.listFiles()?.forEach { file ->
                if (file.isDirectory) {
                    file.deleteRecursively()
                } else {
                    file.delete()
                }
            }
            
            val filesDir = context.filesDir
            filesDir.listFiles()?.forEach { file ->
                if (file.isDirectory) {
                    file.deleteRecursively()
                } else {
                    file.delete()
                }
            }
        } catch (e: Exception) {
            println("Error clearing file cache: ${e.message}")
        }
    }
    
    private fun getDefaultPrivacySettings(): PrivacySettings {
        return PrivacySettings(
            locationPrivacyMode = LocationPrivacyMode.STANDARD,
            onDeviceProcessing = true,
            dataMinimization = true,
            analyticsOptOut = false,
            crashReportingOptOut = false,
            locationHistoryRetention = DEFAULT_RETENTION_DAYS
        )
    }
    
    private fun getUserId(): String? {
        return context.getSharedPreferences("nearme_prefs", Context.MODE_PRIVATE)
            .getString("user_id", null)
    }
    
    // On-device geofence evaluation for privacy
    fun evaluateGeofenceOnDevice(
        userLatitude: Double,
        userLongitude: Double,
        geofences: List<GeofenceData>
    ): List<GeofenceEvent> {
        val settings = runCatching { 
            // This would be a synchronous version of getPrivacySettings
            getPrivacySettingsSync()
        }.getOrNull() ?: getDefaultPrivacySettings()
        
        if (!settings.onDeviceProcessing) {
            return emptyList() // Fallback to server processing
        }
        
        val events = mutableListOf<GeofenceEvent>()
        
        for (geofence in geofences) {
            val distance = calculateDistance(
                userLatitude, userLongitude,
                geofence.latitude, geofence.longitude
            )
            
            val isInside = distance <= geofence.radius
            
            if (isInside) {
                events.add(
                    GeofenceEvent(
                        geofenceId = geofence.id,
                        taskId = geofence.taskId,
                        eventType = "enter",
                        timestamp = System.currentTimeMillis(),
                        latitude = userLatitude,
                        longitude = userLongitude,
                        confidence = calculateConfidence(distance, geofence.radius)
                    )
                )
            }
        }
        
        return events
    }
    
    private fun getPrivacySettingsSync(): PrivacySettings {
        return try {
            val settingsJson = encryptedPrefs.getString(PRIVACY_SETTINGS_KEY, null)
            if (settingsJson != null) {
                Json.decodeFromString<PrivacySettings>(settingsJson)
            } else {
                getDefaultPrivacySettings()
            }
        } catch (e: Exception) {
            getDefaultPrivacySettings()
        }
    }
    
    private fun calculateDistance(
        lat1: Double, lon1: Double,
        lat2: Double, lon2: Double
    ): Double {
        val earthRadius = 6371000.0 // Earth radius in meters
        
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        
        val a = kotlin.math.sin(dLat / 2) * kotlin.math.sin(dLat / 2) +
                kotlin.math.cos(Math.toRadians(lat1)) * kotlin.math.cos(Math.toRadians(lat2)) *
                kotlin.math.sin(dLon / 2) * kotlin.math.sin(dLon / 2)
        
        val c = 2 * kotlin.math.atan2(kotlin.math.sqrt(a), kotlin.math.sqrt(1 - a))
        
        return earthRadius * c
    }
    
    private fun calculateConfidence(distance: Double, radius: Double): Double {
        return when {
            distance <= radius * 0.5 -> 1.0 // High confidence
            distance <= radius * 0.8 -> 0.8 // Medium confidence
            else -> 0.6 // Lower confidence near edge
        }
    }
}

data class GeofenceData(
    val id: String,
    val taskId: String,
    val latitude: Double,
    val longitude: Double,
    val radius: Double
)

data class GeofenceEvent(
    val geofenceId: String,
    val taskId: String,
    val eventType: String,
    val timestamp: Long,
    val latitude: Double,
    val longitude: Double,
    val confidence: Double
)