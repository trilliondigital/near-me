package com.nearme.app.location

import android.Manifest
import android.app.Application
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.*
import com.google.android.gms.location.*
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.concurrent.TimeUnit

data class GeofenceData(
    val id: String,
    val taskId: String,
    val latitude: Double,
    val longitude: Double,
    val radius: Float,
    val type: GeofenceType,
    val priority: Int = 0
)

enum class GeofenceType {
    APPROACH_5MI,
    APPROACH_3MI, 
    APPROACH_1MI,
    ARRIVAL,
    POST_ARRIVAL
}

enum class LocationPermissionStatus {
    GRANTED,
    DENIED,
    BACKGROUND_DENIED,
    NOT_REQUESTED
}

class LocationManager(application: Application) : AndroidViewModel(application) {
    companion object {
        private const val TAG = "LocationManager"
        private const val MAX_GEOFENCES = 20
        private const val LOCATION_UPDATE_INTERVAL = 30000L // 30 seconds
        private const val LOCATION_FASTEST_INTERVAL = 10000L // 10 seconds
        private const val ADAPTIVE_SAMPLING_WORK = "adaptive_sampling_work"
        private const val GEOFENCE_MAINTENANCE_WORK = "geofence_maintenance_work"
    }
    
    private val context = getApplication<Application>()
    private val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
    private val geofencingClient = LocationServices.getGeofencingClient(context)
    private val workManager = WorkManager.getInstance(context)
    
    // State flows
    private val _permissionStatus = MutableStateFlow(LocationPermissionStatus.NOT_REQUESTED)
    val permissionStatus: StateFlow<LocationPermissionStatus> = _permissionStatus
    
    private val _currentLocation = MutableStateFlow<LatLng?>(null)
    val currentLocation: StateFlow<LatLng?> = _currentLocation
    
    private val _isLocationUpdatesActive = MutableStateFlow(false)
    val isLocationUpdatesActive: StateFlow<Boolean> = _isLocationUpdatesActive
    
    private val _batteryOptimizationLevel = MutableStateFlow(BatteryOptimizationLevel.BALANCED)
    val batteryOptimizationLevel: StateFlow<BatteryOptimizationLevel> = _batteryOptimizationLevel
    
    // Internal state
    private val activeGeofences = mutableMapOf<String, GeofenceData>()
    private var locationCallback: LocationCallback? = null
    private var currentLocationRequest: LocationRequest? = null
    private var lastLocationTime = 0L
    private var locationUpdateCount = 0
    
    enum class BatteryOptimizationLevel {
        HIGH_ACCURACY,
        BALANCED,
        POWER_SAVE,
        MINIMAL
    }
    
    init {
        checkLocationPermissions()
        schedulePeriodicMaintenance()
    }
    
    // Permission Management
    fun checkLocationPermissions() {
        val fineLocationGranted = ActivityCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        
        val coarseLocationGranted = ActivityCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        
        val backgroundLocationGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ActivityCompat.checkSelfPermission(
                context, Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true // Background location is included in fine location for API < 29
        }
        
        _permissionStatus.value = when {
            !fineLocationGranted && !coarseLocationGranted -> LocationPermissionStatus.DENIED
            !backgroundLocationGranted -> LocationPermissionStatus.BACKGROUND_DENIED
            else -> LocationPermissionStatus.GRANTED
        }
        
        if (_permissionStatus.value == LocationPermissionStatus.GRANTED) {
            startLocationUpdates()
        }
    }
    
    // Location Updates with Adaptive Sampling
    fun startLocationUpdates() {
        if (!hasLocationPermission()) {
            Log.w(TAG, "Cannot start location updates: missing permissions")
            return
        }
        
        stopLocationUpdates() // Stop any existing updates
        
        val priority = when (_batteryOptimizationLevel.value) {
            BatteryOptimizationLevel.HIGH_ACCURACY -> Priority.PRIORITY_HIGH_ACCURACY
            BatteryOptimizationLevel.BALANCED -> Priority.PRIORITY_BALANCED_POWER_ACCURACY
            BatteryOptimizationLevel.POWER_SAVE -> Priority.PRIORITY_LOW_POWER
            BatteryOptimizationLevel.MINIMAL -> Priority.PRIORITY_PASSIVE
        }
        
        val interval = getAdaptiveInterval()
        
        currentLocationRequest = LocationRequest.Builder(priority, interval)
            .setMinUpdateIntervalMillis(LOCATION_FASTEST_INTERVAL)
            .setMaxUpdateDelayMillis(interval * 2)
            .setWaitForAccurateLocation(false)
            .build()
        
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                handleLocationUpdate(locationResult)
            }
        }
        
        try {
            fusedLocationClient.requestLocationUpdates(
                currentLocationRequest!!,
                locationCallback!!,
                null
            )
            _isLocationUpdatesActive.value = true
            Log.d(TAG, "Location updates started with interval: ${interval}ms, priority: $priority")
        } catch (e: SecurityException) {
            Log.e(TAG, "Security exception starting location updates", e)
            _isLocationUpdatesActive.value = false
        }
    }
    
    fun stopLocationUpdates() {
        locationCallback?.let { callback ->
            fusedLocationClient.removeLocationUpdates(callback)
            locationCallback = null
        }
        _isLocationUpdatesActive.value = false
        Log.d(TAG, "Location updates stopped")
    }
    
    private fun handleLocationUpdate(locationResult: LocationResult) {
        locationResult.lastLocation?.let { location ->
            val newLocation = LatLng(location.latitude, location.longitude)
            _currentLocation.value = newLocation
            lastLocationTime = System.currentTimeMillis()
            locationUpdateCount++
            
            // Adaptive sampling based on movement and battery
            adaptSamplingStrategy(location)
            
            // Evaluate geofences locally for privacy
            evaluateGeofencesLocally(location)
            
            Log.d(TAG, "Location updated: $newLocation, accuracy: ${location.accuracy}m")
        }
    }
    
    private fun getAdaptiveInterval(): Long {
        return when (_batteryOptimizationLevel.value) {
            BatteryOptimizationLevel.HIGH_ACCURACY -> 15000L // 15 seconds
            BatteryOptimizationLevel.BALANCED -> LOCATION_UPDATE_INTERVAL // 30 seconds
            BatteryOptimizationLevel.POWER_SAVE -> 60000L // 1 minute
            BatteryOptimizationLevel.MINIMAL -> 300000L // 5 minutes
        }
    }
    
    private fun adaptSamplingStrategy(location: Location) {
        // Implement adaptive sampling based on speed and battery level
        val speed = location.speed
        val accuracy = location.accuracy
        
        val newOptimizationLevel = when {
            speed > 15 && accuracy < 50 -> BatteryOptimizationLevel.HIGH_ACCURACY // Moving fast, need accuracy
            speed > 5 -> BatteryOptimizationLevel.BALANCED // Moderate movement
            speed < 1 && accuracy > 100 -> BatteryOptimizationLevel.POWER_SAVE // Stationary or poor accuracy
            else -> BatteryOptimizationLevel.BALANCED
        }
        
        if (newOptimizationLevel != _batteryOptimizationLevel.value) {
            _batteryOptimizationLevel.value = newOptimizationLevel
            // Restart location updates with new settings
            viewModelScope.launch {
                startLocationUpdates()
            }
        }
    }
    
    // Geofence Management
    suspend fun addGeofence(geofenceData: GeofenceData): Boolean {
        if (!hasLocationPermission()) {
            Log.w(TAG, "Cannot add geofence: missing permissions")
            return false
        }
        
        // Check if we're at the limit and prioritize
        if (activeGeofences.size >= MAX_GEOFENCES) {
            optimizeActiveGeofences()
        }
        
        val geofence = Geofence.Builder()
            .setRequestId(geofenceData.id)
            .setCircularRegion(
                geofenceData.latitude,
                geofenceData.longitude,
                geofenceData.radius
            )
            .setExpirationDuration(Geofence.NEVER_EXPIRE)
            .setTransitionTypes(
                Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT
            )
            .build()
        
        val geofencingRequest = GeofencingRequest.Builder()
            .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
            .addGeofence(geofence)
            .build()
        
        return try {
            geofencingClient.addGeofences(geofencingRequest, getGeofencePendingIntent()).await()
            activeGeofences[geofenceData.id] = geofenceData
            Log.d(TAG, "Geofence added: ${geofenceData.id}")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to add geofence: ${geofenceData.id}", e)
            false
        }
    }
    
    suspend fun removeGeofence(geofenceId: String): Boolean {
        return try {
            geofencingClient.removeGeofences(listOf(geofenceId)).await()
            activeGeofences.remove(geofenceId)
            Log.d(TAG, "Geofence removed: $geofenceId")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to remove geofence: $geofenceId", e)
            false
        }
    }
    
    suspend fun removeGeofencesForTask(taskId: String): Boolean {
        val geofencesToRemove = activeGeofences.values
            .filter { it.taskId == taskId }
            .map { it.id }
        
        return if (geofencesToRemove.isNotEmpty()) {
            try {
                geofencingClient.removeGeofences(geofencesToRemove).await()
                geofencesToRemove.forEach { activeGeofences.remove(it) }
                Log.d(TAG, "Removed ${geofencesToRemove.size} geofences for task: $taskId")
                true
            } catch (e: Exception) {
                Log.e(TAG, "Failed to remove geofences for task: $taskId", e)
                false
            }
        } else {
            true
        }
    }
    
    private fun optimizeActiveGeofences() {
        // Remove lowest priority geofences to make room
        val sortedGeofences = activeGeofences.values.sortedBy { it.priority }
        val toRemove = sortedGeofences.take(5) // Remove 5 lowest priority
        
        viewModelScope.launch {
            toRemove.forEach { geofence ->
                removeGeofence(geofence.id)
            }
        }
        
        Log.d(TAG, "Optimized geofences, removed ${toRemove.size} low-priority geofences")
    }
    
    private fun evaluateGeofencesLocally(location: Location) {
        // Local geofence evaluation for privacy
        activeGeofences.values.forEach { geofenceData ->
            val distance = FloatArray(1)
            Location.distanceBetween(
                location.latitude, location.longitude,
                geofenceData.latitude, geofenceData.longitude,
                distance
            )
            
            val isInside = distance[0] <= geofenceData.radius
            // This would trigger local processing without sending location to server
            // Implementation would connect to notification system in later tasks
        }
    }
    
    private fun getGeofencePendingIntent(): PendingIntent {
        val intent = Intent(context, GeofenceBroadcastReceiver::class.java)
        return PendingIntent.getBroadcast(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
    
    // Background Processing with WorkManager
    private fun schedulePeriodicMaintenance() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build()
        
        val maintenanceWork = PeriodicWorkRequestBuilder<GeofenceMaintenanceWorker>(
            1, TimeUnit.HOURS
        )
            .setConstraints(constraints)
            .build()
        
        workManager.enqueueUniquePeriodicWork(
            GEOFENCE_MAINTENANCE_WORK,
            ExistingPeriodicWorkPolicy.KEEP,
            maintenanceWork
        )
    }
    
    fun scheduleAdaptiveSampling() {
        val constraints = Constraints.Builder()
            .setRequiresBatteryNotLow(false)
            .build()
        
        val adaptiveWork = OneTimeWorkRequestBuilder<AdaptiveSamplingWorker>()
            .setConstraints(constraints)
            .setInitialDelay(5, TimeUnit.MINUTES)
            .build()
        
        workManager.enqueueUniqueWork(
            ADAPTIVE_SAMPLING_WORK,
            ExistingWorkPolicy.REPLACE,
            adaptiveWork
        )
    }
    
    // Utility functions
    private fun hasLocationPermission(): Boolean {
        return _permissionStatus.value == LocationPermissionStatus.GRANTED
    }
    
    suspend fun getLastKnownLocation(): LatLng? {
        if (!hasLocationPermission()) return null
        
        return try {
            val location = fusedLocationClient.lastLocation.await()
            location?.let { LatLng(it.latitude, it.longitude) }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get last known location", e)
            null
        }
    }
    
    fun getActiveGeofenceCount(): Int = activeGeofences.size
    
    fun setBatteryOptimization(level: BatteryOptimizationLevel) {
        if (level != _batteryOptimizationLevel.value) {
            _batteryOptimizationLevel.value = level
            if (_isLocationUpdatesActive.value) {
                startLocationUpdates() // Restart with new settings
            }
        }
    }
    
    override fun onCleared() {
        super.onCleared()
        stopLocationUpdates()
    }
}