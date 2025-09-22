package com.nearme.app.location

import android.app.Application
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.PowerManager
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

data class BatteryMetrics(
    val batteryLevel: Int = 100,
    val isCharging: Boolean = false,
    val isLowPowerMode: Boolean = false,
    val dailyUsagePercentage: Double = 0.0,
    val locationUpdatesPerHour: Int = 0,
    val geofenceEventsPerHour: Int = 0,
    val averageAccuracyMeters: Double = 0.0,
    val lastOptimizationTime: Long = System.currentTimeMillis()
) {
    val isWithinTarget: Boolean
        get() = dailyUsagePercentage <= 3.0 // Target ≤3% daily battery usage
}

enum class OptimizationLevel(
    val locationPriority: Int,
    val updateIntervalMs: Long,
    val maxGeofences: Int,
    val backgroundProcessingEnabled: Boolean
) {
    HIGH_ACCURACY(
        locationPriority = com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY,
        updateIntervalMs = 15000L, // 15 seconds
        maxGeofences = 20,
        backgroundProcessingEnabled = true
    ),
    BALANCED(
        locationPriority = com.google.android.gms.location.Priority.PRIORITY_BALANCED_POWER_ACCURACY,
        updateIntervalMs = 60000L, // 1 minute
        maxGeofences = 15,
        backgroundProcessingEnabled = true
    ),
    POWER_SAVE(
        locationPriority = com.google.android.gms.location.Priority.PRIORITY_LOW_POWER,
        updateIntervalMs = 300000L, // 5 minutes
        maxGeofences = 10,
        backgroundProcessingEnabled = false
    ),
    MINIMAL(
        locationPriority = com.google.android.gms.location.Priority.PRIORITY_PASSIVE,
        updateIntervalMs = 900000L, // 15 minutes
        maxGeofences = 5,
        backgroundProcessingEnabled = false
    )
}

class BatteryOptimizationManager(application: Application) : AndroidViewModel(application) {
    companion object {
        private const val TAG = "BatteryOptimizationManager"
        private const val BATTERY_MONITORING_WORK = "battery_monitoring_work"
        private const val LOW_BATTERY_THRESHOLD = 20
        private const val CRITICAL_BATTERY_THRESHOLD = 10
    }
    
    private val context = getApplication<Application>()
    private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    private val workManager = WorkManager.getInstance(context)
    
    // State flows
    private val _batteryMetrics = MutableStateFlow(BatteryMetrics())
    val batteryMetrics: StateFlow<BatteryMetrics> = _batteryMetrics
    
    private val _currentOptimizationLevel = MutableStateFlow(OptimizationLevel.BALANCED)
    val currentOptimizationLevel: StateFlow<OptimizationLevel> = _currentOptimizationLevel
    
    private val _adaptiveOptimizationEnabled = MutableStateFlow(true)
    val adaptiveOptimizationEnabled: StateFlow<Boolean> = _adaptiveOptimizationEnabled
    
    // Internal tracking
    private var locationUpdateCount = 0
    private var geofenceEventCount = 0
    private var startTime = System.currentTimeMillis()
    private var lastBatteryLevel = 100
    private var batteryReceiver: BatteryBroadcastReceiver? = null
    
    init {
        setupBatteryMonitoring()
        schedulePeriodicOptimization()
        loadSavedSettings()
    }
    
    private fun setupBatteryMonitoring() {
        batteryReceiver = BatteryBroadcastReceiver { batteryInfo ->
            updateBatteryMetrics(batteryInfo)
        }
        
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_BATTERY_CHANGED)
            addAction(Intent.ACTION_POWER_CONNECTED)
            addAction(Intent.ACTION_POWER_DISCONNECTED)
            addAction(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED)
        }
        
        context.registerReceiver(batteryReceiver, filter)
        
        // Initial battery state
        val batteryStatus = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        batteryStatus?.let { intent ->
            val batteryInfo = extractBatteryInfo(intent)
            updateBatteryMetrics(batteryInfo)
        }
    }
    
    private fun schedulePeriodicOptimization() {
        val constraints = Constraints.Builder()
            .setRequiresBatteryNotLow(false)
            .build()
        
        val optimizationWork = PeriodicWorkRequestBuilder<BatteryOptimizationWorker>(
            15, TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .build()
        
        workManager.enqueueUniquePeriodicWork(
            BATTERY_MONITORING_WORK,
            ExistingPeriodicWorkPolicy.KEEP,
            optimizationWork
        )
    }
    
    // MARK: - Adaptive Optimization
    fun analyzeAndOptimize() {
        if (!_adaptiveOptimizationEnabled.value) return
        
        val metrics = _batteryMetrics.value
        val recommendedLevel = determineOptimalLevel(metrics)
        
        if (recommendedLevel != _currentOptimizationLevel.value) {
            applyOptimizationLevel(recommendedLevel)
        }
    }
    
    private fun determineOptimalLevel(metrics: BatteryMetrics): OptimizationLevel {
        // Emergency conditions
        if (metrics.isLowPowerMode || metrics.batteryLevel <= CRITICAL_BATTERY_THRESHOLD) {
            return OptimizationLevel.MINIMAL
        }
        
        // Charging - can use higher accuracy
        if (metrics.isCharging && metrics.batteryLevel > 80) {
            return OptimizationLevel.HIGH_ACCURACY
        }
        
        // Low battery conditions
        if (metrics.batteryLevel <= LOW_BATTERY_THRESHOLD) {
            return OptimizationLevel.POWER_SAVE
        }
        
        // Battery usage exceeds target
        if (metrics.dailyUsagePercentage > 3.0) {
            return when (_currentOptimizationLevel.value) {
                OptimizationLevel.HIGH_ACCURACY -> OptimizationLevel.BALANCED
                OptimizationLevel.BALANCED -> OptimizationLevel.POWER_SAVE
                else -> OptimizationLevel.MINIMAL
            }
        }
        
        // High activity periods
        if (metrics.locationUpdatesPerHour > 120) { // More than 2 per minute
            return OptimizationLevel.POWER_SAVE
        }
        
        // Default to balanced for normal conditions
        return OptimizationLevel.BALANCED
    }
    
    fun applyOptimizationLevel(level: OptimizationLevel) {
        _currentOptimizationLevel.value = level
        
        // Notify location manager
        notifyLocationManagerOfOptimization(level)
        
        // Apply geofence optimizations
        optimizeGeofences(level)
        
        // Apply background processing optimizations
        optimizeBackgroundProcessing(level)
        
        // Save preference
        saveOptimizationLevel(level)
        
        Log.d(TAG, "Applied battery optimization level: $level")
    }
    
    private fun notifyLocationManagerOfOptimization(level: OptimizationLevel) {
        // This would integrate with LocationManager
        // For now, log the optimization
        Log.d(TAG, "Location optimization: Priority=${level.locationPriority}, Interval=${level.updateIntervalMs}ms")
    }
    
    private fun optimizeGeofences(level: OptimizationLevel) {
        // This would integrate with geofence management
        Log.d(TAG, "Geofence optimization: Max geofences=${level.maxGeofences}")
    }
    
    private fun optimizeBackgroundProcessing(level: OptimizationLevel) {
        if (!level.backgroundProcessingEnabled) {
            // Cancel non-essential background work
            workManager.cancelAllWorkByTag("non_essential")
            Log.d(TAG, "Disabled background processing for battery optimization")
        }
    }
    
    // MARK: - Metrics Tracking
    fun recordLocationUpdate(accuracyMeters: Double) {
        locationUpdateCount++
        
        val currentMetrics = _batteryMetrics.value
        val newCount = locationUpdateCount.toDouble()
        val newAverageAccuracy = (currentMetrics.averageAccuracyMeters * (newCount - 1) + accuracyMeters) / newCount
        
        val hoursElapsed = (System.currentTimeMillis() - startTime) / 3600000.0
        val updatesPerHour = (locationUpdateCount / maxOf(hoursElapsed, 1.0)).toInt()
        
        _batteryMetrics.value = currentMetrics.copy(
            averageAccuracyMeters = newAverageAccuracy,
            locationUpdatesPerHour = updatesPerHour
        )
        
        saveMetrics()
    }
    
    fun recordGeofenceEvent() {
        geofenceEventCount++
        
        val hoursElapsed = (System.currentTimeMillis() - startTime) / 3600000.0
        val eventsPerHour = (geofenceEventCount / maxOf(hoursElapsed, 1.0)).toInt()
        
        _batteryMetrics.value = _batteryMetrics.value.copy(
            geofenceEventsPerHour = eventsPerHour
        )
        
        saveMetrics()
    }
    
    private fun updateBatteryMetrics(batteryInfo: BatteryInfo) {
        val batteryDelta = lastBatteryLevel - batteryInfo.batteryPercentage
        
        var dailyUsage = _batteryMetrics.value.dailyUsagePercentage
        
        if (batteryDelta > 0 && !batteryInfo.isCharging) {
            // Estimate daily usage based on current drain rate
            val hoursElapsed = (System.currentTimeMillis() - startTime) / 3600000.0
            val hourlyDrain = batteryDelta / maxOf(hoursElapsed, 1.0)
            dailyUsage = hourlyDrain * 24
        }
        
        _batteryMetrics.value = _batteryMetrics.value.copy(
            batteryLevel = batteryInfo.batteryPercentage,
            isCharging = batteryInfo.isCharging,
            isLowPowerMode = powerManager.isPowerSaveMode,
            dailyUsagePercentage = dailyUsage,
            lastOptimizationTime = System.currentTimeMillis()
        )
        
        lastBatteryLevel = batteryInfo.batteryPercentage
        
        // Trigger optimization if needed
        if (!_batteryMetrics.value.isWithinTarget) {
            viewModelScope.launch {
                analyzeAndOptimize()
            }
        }
        
        saveMetrics()
    }
    
    // MARK: - Emergency Optimizations
    fun activateEmergencyPowerSave() {
        applyOptimizationLevel(OptimizationLevel.MINIMAL)
        
        // Additional emergency measures
        workManager.cancelAllWork()
        
        Log.w(TAG, "Emergency power save activated")
    }
    
    // MARK: - Public Interface
    fun getBatteryReport(): BatteryReport {
        val metrics = _batteryMetrics.value
        return BatteryReport(
            batteryLevel = metrics.batteryLevel,
            dailyUsagePercentage = metrics.dailyUsagePercentage,
            isWithinTarget = metrics.isWithinTarget,
            currentOptimizationLevel = _currentOptimizationLevel.value,
            locationUpdatesPerHour = metrics.locationUpdatesPerHour,
            geofenceEventsPerHour = metrics.geofenceEventsPerHour,
            averageAccuracyMeters = metrics.averageAccuracyMeters,
            recommendations = generateRecommendations(metrics)
        )
    }
    
    private fun generateRecommendations(metrics: BatteryMetrics): List<String> {
        val recommendations = mutableListOf<String>()
        
        if (metrics.dailyUsagePercentage > 3.0) {
            recommendations.add("Consider reducing location accuracy to improve battery life")
        }
        
        if (metrics.locationUpdatesPerHour > 120) {
            recommendations.add("High location update frequency detected - enable power save mode")
        }
        
        if (metrics.averageAccuracyMeters > 100) {
            recommendations.add("Poor location accuracy - consider moving to areas with better GPS signal")
        }
        
        if (!_adaptiveOptimizationEnabled.value) {
            recommendations.add("Enable adaptive optimization for automatic battery management")
        }
        
        if (metrics.batteryLevel <= LOW_BATTERY_THRESHOLD && !metrics.isCharging) {
            recommendations.add("Low battery detected - consider enabling power save mode")
        }
        
        return recommendations
    }
    
    fun setAdaptiveOptimization(enabled: Boolean) {
        _adaptiveOptimizationEnabled.value = enabled
        saveSettings()
    }
    
    fun resetMetrics() {
        _batteryMetrics.value = BatteryMetrics()
        locationUpdateCount = 0
        geofenceEventCount = 0
        startTime = System.currentTimeMillis()
        saveMetrics()
    }
    
    // MARK: - Persistence
    private fun saveMetrics() {
        val prefs = context.getSharedPreferences("battery_metrics", Context.MODE_PRIVATE)
        val metrics = _batteryMetrics.value
        
        prefs.edit().apply {
            putInt("battery_level", metrics.batteryLevel)
            putBoolean("is_charging", metrics.isCharging)
            putBoolean("is_low_power_mode", metrics.isLowPowerMode)
            putFloat("daily_usage_percentage", metrics.dailyUsagePercentage.toFloat())
            putInt("location_updates_per_hour", metrics.locationUpdatesPerHour)
            putInt("geofence_events_per_hour", metrics.geofenceEventsPerHour)
            putFloat("average_accuracy_meters", metrics.averageAccuracyMeters.toFloat())
            putLong("last_optimization_time", metrics.lastOptimizationTime)
            apply()
        }
    }
    
    private fun saveOptimizationLevel(level: OptimizationLevel) {
        val prefs = context.getSharedPreferences("battery_optimization", Context.MODE_PRIVATE)
        prefs.edit().putString("optimization_level", level.name).apply()
    }
    
    private fun saveSettings() {
        val prefs = context.getSharedPreferences("battery_optimization", Context.MODE_PRIVATE)
        prefs.edit().putBoolean("adaptive_optimization_enabled", _adaptiveOptimizationEnabled.value).apply()
    }
    
    private fun loadSavedSettings() {
        val prefs = context.getSharedPreferences("battery_optimization", Context.MODE_PRIVATE)
        
        // Load optimization level
        val levelName = prefs.getString("optimization_level", OptimizationLevel.BALANCED.name)
        levelName?.let { name ->
            try {
                _currentOptimizationLevel.value = OptimizationLevel.valueOf(name)
            } catch (e: IllegalArgumentException) {
                Log.w(TAG, "Invalid optimization level: $name")
            }
        }
        
        // Load adaptive optimization setting
        _adaptiveOptimizationEnabled.value = prefs.getBoolean("adaptive_optimization_enabled", true)
        
        // Load metrics
        val metricsPrefs = context.getSharedPreferences("battery_metrics", Context.MODE_PRIVATE)
        _batteryMetrics.value = BatteryMetrics(
            batteryLevel = metricsPrefs.getInt("battery_level", 100),
            isCharging = metricsPrefs.getBoolean("is_charging", false),
            isLowPowerMode = metricsPrefs.getBoolean("is_low_power_mode", false),
            dailyUsagePercentage = metricsPrefs.getFloat("daily_usage_percentage", 0f).toDouble(),
            locationUpdatesPerHour = metricsPrefs.getInt("location_updates_per_hour", 0),
            geofenceEventsPerHour = metricsPrefs.getInt("geofence_events_per_hour", 0),
            averageAccuracyMeters = metricsPrefs.getFloat("average_accuracy_meters", 0f).toDouble(),
            lastOptimizationTime = metricsPrefs.getLong("last_optimization_time", System.currentTimeMillis())
        )
    }
    
    override fun onCleared() {
        super.onCleared()
        batteryReceiver?.let { receiver ->
            try {
                context.unregisterReceiver(receiver)
            } catch (e: IllegalArgumentException) {
                // Receiver was not registered
            }
        }
    }
    
    // MARK: - Helper Classes
    data class BatteryInfo(
        val batteryPercentage: Int,
        val isCharging: Boolean,
        val isPlugged: Boolean
    )
    
    private fun extractBatteryInfo(intent: Intent): BatteryInfo {
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        val batteryPct = if (level != -1 && scale != -1) {
            (level * 100 / scale.toFloat()).toInt()
        } else {
            -1
        }
        
        val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                status == BatteryManager.BATTERY_STATUS_FULL
        
        val plugged = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1)
        val isPlugged = plugged == BatteryManager.BATTERY_PLUGGED_AC ||
                plugged == BatteryManager.BATTERY_PLUGGED_USB ||
                plugged == BatteryManager.BATTERY_PLUGGED_WIRELESS
        
        return BatteryInfo(batteryPct, isCharging, isPlugged)
    }
    
    private class BatteryBroadcastReceiver(
        private val onBatteryChanged: (BatteryInfo) -> Unit
    ) : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            intent?.let { batteryIntent ->
                val batteryInfo = extractBatteryInfo(batteryIntent)
                onBatteryChanged(batteryInfo)
            }
        }
        
        private fun extractBatteryInfo(intent: Intent): BatteryInfo {
            val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            val batteryPct = if (level != -1 && scale != -1) {
                (level * 100 / scale.toFloat()).toInt()
            } else {
                100
            }
            
            val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
            val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                    status == BatteryManager.BATTERY_STATUS_FULL
            
            val plugged = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1)
            val isPlugged = plugged == BatteryManager.BATTERY_PLUGGED_AC ||
                    plugged == BatteryManager.BATTERY_PLUGGED_USB ||
                    plugged == BatteryManager.BATTERY_PLUGGED_WIRELESS
            
            return BatteryInfo(batteryPct, isCharging, isPlugged)
        }
    }
}

// MARK: - Supporting Types
data class BatteryReport(
    val batteryLevel: Int,
    val dailyUsagePercentage: Double,
    val isWithinTarget: Boolean,
    val currentOptimizationLevel: OptimizationLevel,
    val locationUpdatesPerHour: Int,
    val geofenceEventsPerHour: Int,
    val averageAccuracyMeters: Double,
    val recommendations: List<String>
)

// MARK: - Background Worker
class BatteryOptimizationWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {
    
    override suspend fun doWork(): Result {
        return try {
            // This would integrate with BatteryOptimizationManager
            // to perform periodic optimization analysis
            Log.d("BatteryOptimizationWorker", "Performing periodic battery optimization analysis")
            Result.success()
        } catch (e: Exception) {
            Log.e("BatteryOptimizationWorker", "Battery optimization analysis failed", e)
            Result.retry()
        }
    }
}