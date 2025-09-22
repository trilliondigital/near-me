package com.nearme.app.location

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.work.*
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofenceStatusCodes
import com.google.android.gms.location.GeofencingEvent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

/**
 * Broadcast receiver that handles geofence transition events
 * - Processes geofence enter/exit events
 * - Implements local evaluation for privacy
 * - Manages event deduplication and cooldown logic
 * - Triggers background processing for notification handling
 */
class GeofenceBroadcastReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "GeofenceReceiver"
        private const val GEOFENCE_EVENT_WORK = "geofence_event_work"
        private const val EVENT_COOLDOWN_MS = 30000L // 30 seconds cooldown between same geofence events
    }
    
    private val eventCache = mutableMapOf<String, Long>() // geofenceId -> lastEventTime
    
    override fun onReceive(context: Context, intent: Intent) {
        val geofencingEvent = GeofencingEvent.fromIntent(intent)
        
        if (geofencingEvent?.hasError() == true) {
            val errorMessage = GeofenceStatusCodes.getStatusCodeString(geofencingEvent.errorCode)
            Log.e(TAG, "Geofence error: $errorMessage")
            handleGeofenceError(context, geofencingEvent.errorCode)
            return
        }
        
        val geofenceTransition = geofencingEvent?.geofenceTransition
        val triggeringGeofences = geofencingEvent?.triggeringGeofences ?: emptyList()
        val location = geofencingEvent?.triggeringLocation
        
        Log.d(TAG, "Geofence transition: $geofenceTransition, geofences: ${triggeringGeofences.size}")
        
        when (geofenceTransition) {
            Geofence.GEOFENCE_TRANSITION_ENTER -> {
                handleGeofenceEnter(context, triggeringGeofences, location?.latitude, location?.longitude)
            }
            Geofence.GEOFENCE_TRANSITION_EXIT -> {
                handleGeofenceExit(context, triggeringGeofences, location?.latitude, location?.longitude)
            }
            Geofence.GEOFENCE_TRANSITION_DWELL -> {
                handleGeofenceDwell(context, triggeringGeofences, location?.latitude, location?.longitude)
            }
            else -> {
                Log.w(TAG, "Unknown geofence transition: $geofenceTransition")
            }
        }
    }
    
    private fun handleGeofenceEnter(
        context: Context, 
        geofences: List<Geofence>,
        latitude: Double?,
        longitude: Double?
    ) {
        val currentTime = System.currentTimeMillis()
        val validGeofences = geofences.filter { geofence ->
            val lastEventTime = eventCache[geofence.requestId] ?: 0L
            val isNotInCooldown = (currentTime - lastEventTime) > EVENT_COOLDOWN_MS
            
            if (isNotInCooldown) {
                eventCache[geofence.requestId] = currentTime
                Log.d(TAG, "Entered geofence: ${geofence.requestId}")
                true
            } else {
                Log.d(TAG, "Geofence ${geofence.requestId} in cooldown, ignoring")
                false
            }
        }
        
        if (validGeofences.isNotEmpty()) {
            scheduleGeofenceEventProcessing(
                context,
                validGeofences.map { it.requestId },
                GeofenceEventType.ENTER,
                latitude,
                longitude
            )
        }
    }
    
    private fun handleGeofenceExit(
        context: Context,
        geofences: List<Geofence>,
        latitude: Double?,
        longitude: Double?
    ) {
        val geofenceIds = geofences.map { geofence ->
            Log.d(TAG, "Exited geofence: ${geofence.requestId}")
            geofence.requestId
        }
        
        if (geofenceIds.isNotEmpty()) {
            scheduleGeofenceEventProcessing(
                context,
                geofenceIds,
                GeofenceEventType.EXIT,
                latitude,
                longitude
            )
        }
    }
    
    private fun handleGeofenceDwell(
        context: Context,
        geofences: List<Geofence>,
        latitude: Double?,
        longitude: Double?
    ) {
        val geofenceIds = geofences.map { geofence ->
            Log.d(TAG, "Dwelling in geofence: ${geofence.requestId}")
            geofence.requestId
        }
        
        if (geofenceIds.isNotEmpty()) {
            scheduleGeofenceEventProcessing(
                context,
                geofenceIds,
                GeofenceEventType.DWELL,
                latitude,
                longitude
            )
        }
    }
    
    private fun handleGeofenceError(context: Context, errorCode: Int) {
        Log.e(TAG, "Geofence error code: $errorCode")
        
        when (errorCode) {
            GeofenceStatusCodes.GEOFENCE_NOT_AVAILABLE -> {
                Log.e(TAG, "Geofencing not available on this device")
            }
            GeofenceStatusCodes.GEOFENCE_TOO_MANY_GEOFENCES -> {
                Log.e(TAG, "Too many geofences registered")
                // Trigger geofence optimization
                scheduleGeofenceOptimization(context)
            }
            GeofenceStatusCodes.GEOFENCE_TOO_MANY_PENDING_INTENTS -> {
                Log.e(TAG, "Too many pending intents for geofences")
            }
            else -> {
                Log.e(TAG, "Unknown geofence error: $errorCode")
            }
        }
    }
    
    private fun scheduleGeofenceEventProcessing(
        context: Context,
        geofenceIds: List<String>,
        eventType: GeofenceEventType,
        latitude: Double?,
        longitude: Double?
    ) {
        val inputData = Data.Builder()
            .putStringArray("geofence_ids", geofenceIds.toTypedArray())
            .putString("event_type", eventType.name)
            .putDouble("latitude", latitude ?: 0.0)
            .putDouble("longitude", longitude ?: 0.0)
            .putLong("timestamp", System.currentTimeMillis())
            .build()
        
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.NOT_REQUIRED) // Can work offline
            .build()
        
        val workRequest = OneTimeWorkRequestBuilder<GeofenceEventWorker>()
            .setInputData(inputData)
            .setConstraints(constraints)
            .setInitialDelay(0, TimeUnit.SECONDS) // Process immediately
            .build()
        
        WorkManager.getInstance(context).enqueueUniqueWork(
            "${GEOFENCE_EVENT_WORK}_${System.currentTimeMillis()}",
            ExistingWorkPolicy.APPEND,
            workRequest
        )
    }
    
    private fun scheduleGeofenceOptimization(context: Context) {
        val workRequest = OneTimeWorkRequestBuilder<GeofenceMaintenanceWorker>()
            .setInitialDelay(1, TimeUnit.MINUTES)
            .build()
        
        WorkManager.getInstance(context).enqueueUniqueWork(
            "geofence_optimization",
            ExistingWorkPolicy.REPLACE,
            workRequest
        )
    }
}

enum class GeofenceEventType {
    ENTER,
    EXIT,
    DWELL
}