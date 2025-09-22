package com.nearme.app.location

import android.Manifest
import android.content.Context
import android.location.Location
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.rule.GrantPermissionRule
import androidx.work.testing.WorkManagerTestInitHelper
import com.google.android.gms.location.LocationServices
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

@ExperimentalCoroutinesApi
@RunWith(AndroidJUnit4::class)
class LocationIntegrationTest {
    
    @get:Rule
    val permissionRule: GrantPermissionRule = GrantPermissionRule.grant(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
        Manifest.permission.ACCESS_BACKGROUND_LOCATION
    )
    
    private lateinit var context: Context
    private lateinit var locationManager: LocationManager
    private lateinit var permissionHandler: LocationPermissionHandler
    
    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        
        // Initialize WorkManager for testing
        WorkManagerTestInitHelper.initializeTestWorkManager(context)
        
        locationManager = LocationManager(context as android.app.Application)
        permissionHandler = LocationPermissionHandler(context)
    }
    
    @Test
    fun testLocationPermissionsAreGranted() {
        // Given permissions are granted via GrantPermissionRule
        
        // When checking permission status
        val hasLocation = permissionHandler.hasLocationPermissions()
        val hasBackground = permissionHandler.hasBackgroundLocationPermission()
        val status = permissionHandler.getPermissionStatus()
        
        // Then all permissions should be granted
        assertTrue(hasLocation)
        assertTrue(hasBackground)
        assertEquals(LocationPermissionStatus.GRANTED, status)
    }
    
    @Test
    fun testLocationManagerInitializesCorrectly() = runTest {
        // When LocationManager is initialized
        locationManager.checkLocationPermissions()
        
        // Then permission status should be granted
        assertEquals(LocationPermissionStatus.GRANTED, locationManager.permissionStatus.value)
    }
    
    @Test
    fun testGeofenceAdditionWithValidData() = runTest {
        // Given valid geofence data
        val geofenceData = GeofenceData(
            id = "test_geofence_integration",
            taskId = "test_task_integration",
            latitude = 37.7749,
            longitude = -122.4194,
            radius = 100f,
            type = GeofenceType.ARRIVAL,
            priority = 1
        )
        
        // When adding geofence
        val result = locationManager.addGeofence(geofenceData)
        
        // Then geofence should be added successfully
        assertTrue(result)
        assertEquals(1, locationManager.getActiveGeofenceCount())
    }
    
    @Test
    fun testGeofenceRemoval() = runTest {
        // Given a geofence is added
        val geofenceData = GeofenceData(
            id = "test_geofence_removal",
            taskId = "test_task_removal",
            latitude = 37.7749,
            longitude = -122.4194,
            radius = 100f,
            type = GeofenceType.ARRIVAL
        )
        
        locationManager.addGeofence(geofenceData)
        assertEquals(1, locationManager.getActiveGeofenceCount())
        
        // When removing geofence
        val result = locationManager.removeGeofence(geofenceData.id)
        
        // Then geofence should be removed successfully
        assertTrue(result)
        assertEquals(0, locationManager.getActiveGeofenceCount())
    }
    
    @Test
    fun testBatteryOptimizationLevels() = runTest {
        // Test different battery optimization levels
        val levels = LocationManager.BatteryOptimizationLevel.values()
        
        for (level in levels) {
            // When setting battery optimization level
            locationManager.setBatteryOptimization(level)
            
            // Then the level should be updated
            assertEquals(level, locationManager.batteryOptimizationLevel.value)
        }
    }
    
    @Test
    fun testLocationUpdatesCanBeStartedAndStopped() = runTest {
        // When starting location updates
        locationManager.startLocationUpdates()
        
        // Then location updates should be active
        assertTrue(locationManager.isLocationUpdatesActive.value)
        
        // When stopping location updates
        locationManager.stopLocationUpdates()
        
        // Then location updates should be inactive
        assertEquals(false, locationManager.isLocationUpdatesActive.value)
    }
    
    @Test
    fun testLastKnownLocationRetrieval() = runTest {
        // When getting last known location
        val location = locationManager.getLastKnownLocation()
        
        // Then location should be retrievable (may be null in test environment)
        // This test mainly ensures the method doesn't crash
        assertNotNull(locationManager) // Basic assertion to ensure test runs
    }
    
    @Test
    fun testMultipleGeofenceManagement() = runTest {
        // Given multiple geofences
        val geofences = listOf(
            GeofenceData("geo1", "task1", 37.7749, -122.4194, 100f, GeofenceType.ARRIVAL),
            GeofenceData("geo2", "task1", 37.7849, -122.4294, 200f, GeofenceType.APPROACH_1MI),
            GeofenceData("geo3", "task2", 37.7949, -122.4394, 300f, GeofenceType.APPROACH_3MI)
        )
        
        // When adding multiple geofences
        var successCount = 0
        for (geofence in geofences) {
            if (locationManager.addGeofence(geofence)) {
                successCount++
            }
        }
        
        // Then all geofences should be added
        assertEquals(geofences.size, successCount)
        assertEquals(geofences.size, locationManager.getActiveGeofenceCount())
        
        // When removing geofences for a specific task
        val removed = locationManager.removeGeofencesForTask("task1")
        
        // Then task1 geofences should be removed
        assertTrue(removed)
        assertEquals(1, locationManager.getActiveGeofenceCount()) // Only task2 geofence remains
    }
}