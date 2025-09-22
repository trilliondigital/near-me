package com.nearme.app.data.analytics

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import com.nearme.app.data.api.ApiClient
import com.nearme.app.data.privacy.PrivacyRepository
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.util.*
import java.util.concurrent.ConcurrentLinkedQueue
import javax.inject.Inject
import javax.inject.Singleton

// MARK: - Analytics Models
@Serializable
data class AnalyticsEvent(
    val eventType: String,
    val eventData: JsonObject? = null,
    val timestamp: Long = System.currentTimeMillis()
)

@Serializable
data class AnalyticsSession(
    val sessionId: String,
    val deviceId: String,
    val platform: String = "android",
    val appVersion: String,
    val sessionStart: Long = System.currentTimeMillis(),
    var sessionEnd: Long? = null,
    val previousSessionId: String? = null
)

@Serializable
data class UserAnalyticsProperties(
    val nudgeStyle: String? = null,
    val quietHours: JsonObject? = null,
    val defaultRadii: JsonObject? = null,
    val premiumStatus: String? = null,
    val primaryCountry: String? = null,
    val primaryTimezone: String? = null,
    val primaryPlatform: String = "android"
)

// MARK: - Analytics Configuration
data class AnalyticsConfiguration(
    val batchSize: Int = 50,
    val flushIntervalMs: Long = 30_000L, // 30 seconds
    val sessionTimeoutMs: Long = 1_800_000L, // 30 minutes
    val privacyModeEnabled: Boolean = true,
    val samplingRate: Double = 1.0
)

// MARK: - API Request Models
@Serializable
data class StartSessionRequest(
    val sessionId: String,
    val deviceId: String,
    val platform: String,
    val appVersion: String,
    val previousSessionId: String? = null
)

@Serializable
data class TrackEventRequest(
    val eventType: String,
    val sessionId: String,
    val deviceId: String,
    val platform: String,
    val appVersion: String,
    val eventData: JsonObject? = null,
    val timestamp: Long,
    val analyticsConsent: Boolean,
    val timezone: String
)

@Serializable
data class BatchEventsRequest(
    val events: List<TrackEventRequest>
)

@Serializable
data class UpdateUserPropertiesRequest(
    val nudgeStyle: String? = null,
    val quietHours: JsonObject? = null,
    val defaultRadii: JsonObject? = null,
    val premiumStatus: String? = null,
    val primaryCountry: String? = null,
    val primaryTimezone: String? = null,
    val primaryPlatform: String? = null
)

// MARK: - Analytics Service
@Singleton
class AnalyticsService @Inject constructor(
    private val context: Context,
    private val apiClient: ApiClient,
    private val privacyRepository: PrivacyRepository
) : DefaultLifecycleObserver {

    private val preferences: SharedPreferences = context.getSharedPreferences("analytics_prefs", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }
    
    private var configuration = AnalyticsConfiguration()
    private var currentSession: AnalyticsSession? = null
    private val eventBuffer = ConcurrentLinkedQueue<AnalyticsEvent>()
    
    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var flushJob: Job? = null
    private var sessionTimeoutJob: Job? = null
    
    private val _analyticsEnabled = MutableStateFlow(true)
    val analyticsEnabled: StateFlow<Boolean> = _analyticsEnabled.asStateFlow()
    
    private val _isSessionActive = MutableStateFlow(false)
    val isSessionActive: StateFlow<Boolean> = _isSessionActive.asStateFlow()
    
    private val deviceId: String by lazy {
        preferences.getString("device_id", null) ?: run {
            val newId = UUID.randomUUID().toString()
            preferences.edit().putString("device_id", newId).apply()
            newId
        }
    }
    
    private val appVersion: String by lazy {
        try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            packageInfo.versionName ?: "1.0.0"
        } catch (e: Exception) {
            "1.0.0"
        }
    }
    
    init {
        ProcessLifecycleOwner.get().lifecycle.addObserver(this)
        loadConfiguration()
        loadAnalyticsConsent()
    }
    
    // MARK: - Lifecycle Observer
    override fun onStart(owner: LifecycleOwner) {
        super.onStart(owner)
        coroutineScope.launch {
            startSession()
        }
    }
    
    override fun onStop(owner: LifecycleOwner) {
        super.onStop(owner)
        coroutineScope.launch {
            flushEvents()
        }
    }
    
    // MARK: - Public Interface
    
    suspend fun startSession() {
        if (!_analyticsEnabled.value) return
        
        try {
            val previousSessionId = currentSession?.sessionId
            
            val session = AnalyticsSession(
                sessionId = UUID.randomUUID().toString(),
                deviceId = deviceId,
                appVersion = appVersion,
                previousSessionId = previousSessionId
            )
            
            currentSession = session
            _isSessionActive.value = true
            
            // Send session start to backend
            sendSessionStart(session)
            
            // Start flush timer
            startFlushTimer()
            
            // Start session timeout timer
            startSessionTimer()
            
            println("📊 Analytics session started: ${session.sessionId}")
            
        } catch (e: Exception) {
            println("❌ Failed to start analytics session: $e")
        }
    }
    
    suspend fun endSession() {
        val session = currentSession ?: return
        
        try {
            // Flush remaining events
            flushEvents()
            
            // Send session end to backend
            sendSessionEnd(session.sessionId)
            
            currentSession = null
            _isSessionActive.value = false
            
            // Stop timers
            stopFlushTimer()
            stopSessionTimer()
            
            println("📊 Analytics session ended: ${session.sessionId}")
            
        } catch (e: Exception) {
            println("❌ Failed to end analytics session: $e")
        }
    }
    
    suspend fun trackEvent(eventType: String, data: Map<String, Any>? = null) {
        if (!_analyticsEnabled.value || currentSession == null) return
        
        // Apply sampling
        if (!shouldSampleEvent()) return
        
        val eventData = data?.let { convertToJsonObject(it) }
        val event = AnalyticsEvent(eventType, eventData)
        eventBuffer.offer(event)
        
        // Flush if buffer is full
        if (eventBuffer.size >= configuration.batchSize) {
            flushEvents()
        }
        
        println("📊 Event tracked: $eventType")
    }
    
    suspend fun updateUserProperties(properties: UserAnalyticsProperties) {
        if (!_analyticsEnabled.value) return
        
        try {
            val request = UpdateUserPropertiesRequest(
                nudgeStyle = properties.nudgeStyle,
                quietHours = properties.quietHours,
                defaultRadii = properties.defaultRadii,
                premiumStatus = properties.premiumStatus,
                primaryCountry = properties.primaryCountry,
                primaryTimezone = properties.primaryTimezone,
                primaryPlatform = properties.primaryPlatform
            )
            
            apiClient.updateUserProperties(request)
            println("📊 User properties updated")
            
        } catch (e: Exception) {
            println("❌ Failed to update user properties: $e")
        }
    }
    
    // MARK: - Business Event Tracking
    
    suspend fun trackTaskCreated(
        taskId: String,
        locationType: String,
        placeId: String? = null,
        poiCategory: String? = null,
        hasDescription: Boolean
    ) {
        val data = mapOf(
            "task_id" to taskId,
            "location_type" to locationType,
            "place_id" to placeId,
            "poi_category" to poiCategory,
            "has_description" to hasDescription
        ).filterValues { it != null }
        
        trackEvent("task_created", data)
    }
    
    suspend fun trackPlaceAdded(placeId: String, placeType: String, method: String) {
        val data = mapOf(
            "place_id" to placeId,
            "place_type" to placeType,
            "method" to method
        )
        trackEvent("place_added", data)
    }
    
    suspend fun trackGeofenceRegistered(
        taskId: String,
        geofenceId: String,
        geofenceType: String,
        radiusMeters: Double
    ) {
        val data = mapOf(
            "task_id" to taskId,
            "geofence_id" to geofenceId,
            "geofence_type" to geofenceType,
            "radius_meters" to radiusMeters
        )
        trackEvent("geofence_registered", data)
    }
    
    suspend fun trackNudgeShown(
        taskId: String,
        nudgeType: String,
        locationName: String? = null,
        distanceMeters: Double? = null
    ) {
        val data = mapOf(
            "task_id" to taskId,
            "nudge_type" to nudgeType,
            "location_name" to locationName,
            "distance_meters" to distanceMeters
        ).filterValues { it != null }
        
        trackEvent("nudge_shown", data)
    }
    
    suspend fun trackTaskCompleted(
        taskId: String,
        completionMethod: String,
        timeToCompleteHours: Double? = null,
        nudgesReceived: Int? = null
    ) {
        val data = mapOf(
            "task_id" to taskId,
            "completion_method" to completionMethod,
            "time_to_complete_hours" to timeToCompleteHours,
            "nudges_received" to nudgesReceived
        ).filterValues { it != null }
        
        trackEvent("task_completed", data)
    }
    
    suspend fun trackSnoozeSelected(
        taskId: String,
        snoozeDuration: String,
        nudgeType: String? = null
    ) {
        val data = mapOf(
            "task_id" to taskId,
            "snooze_duration" to snoozeDuration,
            "nudge_type" to nudgeType
        ).filterValues { it != null }
        
        trackEvent("snooze_selected", data)
    }
    
    suspend fun trackPaywallViewed(trigger: String, currentTaskCount: Int? = null) {
        val data = mapOf(
            "trigger" to trigger,
            "current_task_count" to currentTaskCount
        ).filterValues { it != null }
        
        trackEvent("paywall_viewed", data)
    }
    
    suspend fun trackTrialStarted(trialDurationDays: Int, triggerSource: String? = null) {
        val data = mapOf(
            "trial_duration_days" to trialDurationDays,
            "trigger_source" to triggerSource
        ).filterValues { it != null }
        
        trackEvent("trial_started", data)
    }
    
    suspend fun trackPremiumConverted(
        subscriptionType: String,
        price: Double? = null,
        currency: String? = null,
        trialDurationDays: Int? = null
    ) {
        val data = mapOf(
            "subscription_type" to subscriptionType,
            "price" to price,
            "currency" to currency,
            "trial_duration_days" to trialDurationDays
        ).filterValues { it != null }
        
        trackEvent("premium_converted", data)
    }
    
    // MARK: - Screen Tracking
    
    suspend fun trackScreenView(screenName: String, properties: Map<String, Any>? = null) {
        val data = mutableMapOf<String, Any>("screen_name" to screenName)
        properties?.let { data.putAll(it) }
        trackEvent("screen_viewed", data)
    }
    
    // MARK: - Configuration
    
    fun updateConfiguration(newConfig: AnalyticsConfiguration) {
        configuration = newConfig
        
        // Restart timers with new intervals
        if (_isSessionActive.value) {
            stopFlushTimer()
            startFlushTimer()
        }
    }
    
    suspend fun setAnalyticsEnabled(enabled: Boolean) {
        _analyticsEnabled.value = enabled
        
        if (!enabled) {
            endSession()
        }
        
        // Update privacy settings
        privacyRepository.updateAnalyticsConsent(enabled)
        
        // Save to preferences
        preferences.edit().putBoolean("analytics_enabled", enabled).apply()
    }
    
    // MARK: - Private Methods
    
    private fun loadConfiguration() {
        // Load configuration from SharedPreferences or remote config
        // For now, use default configuration
    }
    
    private fun loadAnalyticsConsent() {
        coroutineScope.launch {
            try {
                val privacySettings = privacyRepository.getPrivacySettings()
                _analyticsEnabled.value = privacySettings?.analyticsEnabled ?: true
            } catch (e: Exception) {
                // Default to enabled if we can't load settings
                _analyticsEnabled.value = preferences.getBoolean("analytics_enabled", true)
            }
        }
    }
    
    private fun shouldSampleEvent(): Boolean {
        return Math.random() <= configuration.samplingRate
    }
    
    // MARK: - Timer Management
    
    private fun startFlushTimer() {
        stopFlushTimer()
        flushJob = coroutineScope.launch {
            while (isActive) {
                delay(configuration.flushIntervalMs)
                flushEvents()
            }
        }
    }
    
    private fun stopFlushTimer() {
        flushJob?.cancel()
        flushJob = null
    }
    
    private fun startSessionTimer() {
        stopSessionTimer()
        sessionTimeoutJob = coroutineScope.launch {
            delay(configuration.sessionTimeoutMs)
            endSession()
        }
    }
    
    private fun stopSessionTimer() {
        sessionTimeoutJob?.cancel()
        sessionTimeoutJob = null
    }
    
    // MARK: - Network Operations
    
    private suspend fun sendSessionStart(session: AnalyticsSession) {
        try {
            val request = StartSessionRequest(
                sessionId = session.sessionId,
                deviceId = session.deviceId,
                platform = session.platform,
                appVersion = session.appVersion,
                previousSessionId = session.previousSessionId
            )
            
            apiClient.startAnalyticsSession(request)
        } catch (e: Exception) {
            println("❌ Failed to send session start: $e")
        }
    }
    
    private suspend fun sendSessionEnd(sessionId: String) {
        try {
            apiClient.endAnalyticsSession(sessionId)
        } catch (e: Exception) {
            println("❌ Failed to send session end: $e")
        }
    }
    
    private suspend fun flushEvents() {
        if (eventBuffer.isEmpty() || currentSession == null) return
        
        val session = currentSession ?: return
        val eventsToFlush = mutableListOf<AnalyticsEvent>()
        
        // Drain the buffer
        while (eventBuffer.isNotEmpty() && eventsToFlush.size < configuration.batchSize) {
            eventBuffer.poll()?.let { eventsToFlush.add(it) }
        }
        
        if (eventsToFlush.isEmpty()) return
        
        try {
            val events = eventsToFlush.map { event ->
                TrackEventRequest(
                    eventType = event.eventType,
                    sessionId = session.sessionId,
                    deviceId = session.deviceId,
                    platform = session.platform,
                    appVersion = session.appVersion,
                    eventData = event.eventData,
                    timestamp = event.timestamp,
                    analyticsConsent = _analyticsEnabled.value,
                    timezone = TimeZone.getDefault().id
                )
            }
            
            if (events.size == 1) {
                apiClient.trackEvent(events[0])
            } else {
                apiClient.trackEventsBatch(BatchEventsRequest(events))
            }
            
            println("📊 Flushed ${events.size} events")
            
        } catch (e: Exception) {
            // Re-add events to buffer for retry
            eventsToFlush.forEach { eventBuffer.offer(it) }
            println("❌ Failed to flush events: $e")
        }
    }
    
    private fun convertToJsonObject(map: Map<String, Any>): JsonObject {
        val jsonMap = mutableMapOf<String, JsonElement>()
        
        for ((key, value) in map) {
            jsonMap[key] = when (value) {
                is String -> JsonPrimitive(value)
                is Number -> JsonPrimitive(value)
                is Boolean -> JsonPrimitive(value)
                is Map<*, *> -> convertToJsonObject(value as Map<String, Any>)
                is List<*> -> {
                    // Convert list to JSON array (simplified)
                    JsonPrimitive(value.toString())
                }
                else -> JsonPrimitive(value.toString())
            }
        }
        
        return JsonObject(jsonMap)
    }
    
    // MARK: - Cleanup
    
    fun destroy() {
        coroutineScope.launch {
            endSession()
        }
        coroutineScope.cancel()
    }
}

// MARK: - API Client Extension
suspend fun ApiClient.startAnalyticsSession(request: StartSessionRequest) {
    post("/analytics/sessions/start", request)
}

suspend fun ApiClient.endAnalyticsSession(sessionId: String) {
    post("/analytics/sessions/$sessionId/end", mapOf<String, Any>())
}

suspend fun ApiClient.trackEvent(request: TrackEventRequest) {
    post("/analytics/events", request)
}

suspend fun ApiClient.trackEventsBatch(request: BatchEventsRequest) {
    post("/analytics/events/batch", request)
}

suspend fun ApiClient.updateUserProperties(request: UpdateUserPropertiesRequest) {
    put("/analytics/user-properties", request)
}