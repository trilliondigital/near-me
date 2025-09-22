package com.nearme.app.location

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Utility class for handling location permissions with proper user education
 * - Manages fine, coarse, and background location permissions
 * - Provides user-friendly permission request flows
 * - Handles permission rationale and settings navigation
 */
class LocationPermissionHandler(private val context: Context) {
    
    companion object {
        const val LOCATION_PERMISSION_REQUEST_CODE = 1001
        const val BACKGROUND_LOCATION_REQUEST_CODE = 1002
        
        private val REQUIRED_PERMISSIONS = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        
        private val BACKGROUND_PERMISSION = arrayOf(
            Manifest.permission.ACCESS_BACKGROUND_LOCATION
        )
    }
    
    /**
     * Check if all required location permissions are granted
     */
    fun hasLocationPermissions(): Boolean {
        return REQUIRED_PERMISSIONS.all { permission ->
            ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
        }
    }
    
    /**
     * Check if background location permission is granted
     */
    fun hasBackgroundLocationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            // Background location is included in fine location for API < 29
            hasLocationPermissions()
        }
    }
    
    /**
     * Get detailed permission status
     */
    fun getPermissionStatus(): LocationPermissionStatus {
        val hasLocation = hasLocationPermissions()
        val hasBackground = hasBackgroundLocationPermission()
        
        return when {
            !hasLocation -> LocationPermissionStatus.DENIED
            !hasBackground -> LocationPermissionStatus.BACKGROUND_DENIED
            else -> LocationPermissionStatus.GRANTED
        }
    }
    
    /**
     * Check if we should show permission rationale
     */
    fun shouldShowLocationPermissionRationale(activity: Activity): Boolean {
        return REQUIRED_PERMISSIONS.any { permission ->
            ActivityCompat.shouldShowRequestPermissionRationale(activity, permission)
        }
    }
    
    /**
     * Check if we should show background permission rationale
     */
    fun shouldShowBackgroundPermissionRationale(activity: Activity): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ActivityCompat.shouldShowRequestPermissionRationale(
                activity,
                Manifest.permission.ACCESS_BACKGROUND_LOCATION
            )
        } else {
            false
        }
    }
    
    /**
     * Request basic location permissions
     */
    fun requestLocationPermissions(activity: Activity) {
        ActivityCompat.requestPermissions(
            activity,
            REQUIRED_PERMISSIONS,
            LOCATION_PERMISSION_REQUEST_CODE
        )
    }
    
    /**
     * Request background location permission (should be called after basic permissions are granted)
     */
    fun requestBackgroundLocationPermission(activity: Activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ActivityCompat.requestPermissions(
                activity,
                BACKGROUND_PERMISSION,
                BACKGROUND_LOCATION_REQUEST_CODE
            )
        }
    }
    
    /**
     * Handle permission request results
     */
    fun handlePermissionResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ): PermissionResult {
        return when (requestCode) {
            LOCATION_PERMISSION_REQUEST_CODE -> {
                val allGranted = grantResults.isNotEmpty() && 
                    grantResults.all { it == PackageManager.PERMISSION_GRANTED }
                
                if (allGranted) {
                    PermissionResult.LOCATION_GRANTED
                } else {
                    PermissionResult.LOCATION_DENIED
                }
            }
            BACKGROUND_LOCATION_REQUEST_CODE -> {
                val granted = grantResults.isNotEmpty() && 
                    grantResults[0] == PackageManager.PERMISSION_GRANTED
                
                if (granted) {
                    PermissionResult.BACKGROUND_GRANTED
                } else {
                    PermissionResult.BACKGROUND_DENIED
                }
            }
            else -> PermissionResult.UNKNOWN
        }
    }
    
    /**
     * Open app settings for manual permission management
     */
    fun openAppSettings(activity: Activity) {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", context.packageName, null)
        }
        activity.startActivity(intent)
    }
    
    /**
     * Get user-friendly permission explanation text
     */
    fun getPermissionExplanation(status: LocationPermissionStatus): String {
        return when (status) {
            LocationPermissionStatus.DENIED -> 
                "Near Me needs location access to remind you about tasks when you're near relevant places. " +
                "This helps you remember errands like picking up groceries when you're near a store."
            
            LocationPermissionStatus.BACKGROUND_DENIED -> 
                "For the best experience, Near Me needs background location access to send timely reminders " +
                "even when the app isn't open. This ensures you never miss important tasks."
            
            LocationPermissionStatus.GRANTED -> 
                "Location permissions are properly configured. Near Me can now provide location-based reminders."
            
            LocationPermissionStatus.NOT_REQUESTED -> 
                "Near Me uses your location to provide helpful reminders when you're near places where you " +
                "have tasks to complete."
        }
    }
    
    /**
     * Get permission request strategy based on current status
     */
    fun getPermissionStrategy(activity: Activity): PermissionStrategy {
        val status = getPermissionStatus()
        
        return when (status) {
            LocationPermissionStatus.NOT_REQUESTED -> {
                PermissionStrategy.REQUEST_BASIC
            }
            LocationPermissionStatus.DENIED -> {
                if (shouldShowLocationPermissionRationale(activity)) {
                    PermissionStrategy.SHOW_RATIONALE_AND_REQUEST
                } else {
                    PermissionStrategy.OPEN_SETTINGS
                }
            }
            LocationPermissionStatus.BACKGROUND_DENIED -> {
                if (shouldShowBackgroundPermissionRationale(activity)) {
                    PermissionStrategy.SHOW_BACKGROUND_RATIONALE
                } else {
                    PermissionStrategy.REQUEST_BACKGROUND
                }
            }
            LocationPermissionStatus.GRANTED -> {
                PermissionStrategy.ALREADY_GRANTED
            }
        }
    }
    
    enum class PermissionResult {
        LOCATION_GRANTED,
        LOCATION_DENIED,
        BACKGROUND_GRANTED,
        BACKGROUND_DENIED,
        UNKNOWN
    }
    
    enum class PermissionStrategy {
        REQUEST_BASIC,
        REQUEST_BACKGROUND,
        SHOW_RATIONALE_AND_REQUEST,
        SHOW_BACKGROUND_RATIONALE,
        OPEN_SETTINGS,
        ALREADY_GRANTED
    }
}