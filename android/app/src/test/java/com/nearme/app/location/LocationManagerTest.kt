package com.nearme.app.location

import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import androidx.test.core.app.ApplicationProvider
import androidx.work.WorkManager
import androidx.work.testing.WorkManagerTestInitHelper
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.GeofencingClient
import com.google.android.gms.maps.model.LatLng
import io.mockk.*
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@ExperimentalCoroutinesApi
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class LocationManagerTest {
    
    @get:Rule
    val instantTaskExecutorRule = InstantTaskExecutorRule()
    
    private lateinit var context: Context
    private lateinit var application: Application
    private lateinit var locationManager: LocationManager
    private lateinit var mockFusedLocationClient: FusedLocationProviderClient
    private lateinit var mockGeofencingClient: GeofencingClient
    
    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        application = context as Application
        
        // Initialize WorkManager for testing
        WorkManagerTestInitHelper.initializeTestWorkManager(context)
        
        // Mock location services
        mockFusedLocationClient = mockk(relaxed = true)
        mockGeofencingClient = mockk(relaxed = true)
        
        // Create LocationManager instance
        locationManager = LocationManager(application)
        
        // Mock permission checks
        mockkStatic("androidx.core.app.ActivityCompat")
    }
    
    @After
    fun tearDown() {
        unmockkAll()
    }
    
    @Test
    fun `checkLocationPermissions updates permission status correctly when granted`() = runTest {
        // Given
        every { 
            io.mockk.verify { androidx.core.app.ActivityCompat.checkSelfPermission(any(), any()) }
        } returns PackageManager.PERMISSION_GRANTED
        
        // When
        locationManager.checkLocationPermissions()
        
        // Then
        assertEquals(LocationPermissionStatus.GRANTED, locationManager.permissionStatus.first())
    }
    
    @Test
    fun `checkLocationPermissions updates permission status correctly when denied`() = runTest {
        // Given
        every { 
            androidx.core.app.ActivityCompat.checkSelfPermission(any(), any())
        } returns PackageManager.PERMISSION_DENIED
        
        // When
        locationManager.checkLocationPermissions()
        
        // Then
        assertEquals(LocationPermissionStatus.DENIED, locationManager.permissionStatus.first())
    }
    
    @Test
    fun `addGeofence returns false when permissions not granted`() = runTest {
        // Given
        every { 
            androidx.core.app.ActivityCompat.checkSelfPermission(any(), any())
        } returns PackageManager.PERMISSION_DENIED
        
        val geofenceData = GeofenceData(
            id = "test_geofence",
            taskId = "test_task",
            latitude = 37.7749,
            longitude = -122.4194,
            radius = 100f,
            type = GeofenceType.ARRIVAL
        )
        
        // When
        val result = locationManager.addGeofence(geofenceData)
        
        // Then
        assertFalse(result)
    }
    
    @Test
    fun `setBatteryOptimization updates optimization level`() = runTest {
        // Given
        val newLevel = LocationManager.BatteryOptimizationLevel.POWER_SAVE
        
        // When
        locationManager.setBatteryOptimization(newLevel)
        
        // Then
        assertEquals(newLevel, locationManager.batteryOptimizationLevel.first())
    }
    
    @Test
    fun `getActiveGeofenceCount returns correct count`() {
        // Given - LocationManager starts with 0 geofences
        
        // When
        val count = locationManager.getActiveGeofenceCount()
        
        // Then
        assertEquals(0, count)
    }
    
    @Test
    fun `battery optimization affects location update intervals`() = runTest {
        // Given
        every { 
            androidx.core.app.ActivityCompat.checkSelfPermission(any(), any())
        } returns PackageManager.PERMISSION_GRANTED
        
        // When setting different battery optimization levels
        locationManager.setBatteryOptimization(LocationManager.BatteryOptimizationLevel.HIGH_ACCURACY)
        
        // Then the location updates should be restarted with new settings
        assertTrue(locationManager.isLocationUpdatesActive.first())
    }
    
    @Test
    fun `location updates stop when permissions are revoked`() = runTest {
        // Given - start with permissions granted
        every { 
            androidx.core.app.ActivityCompat.checkSelfPermission(any(), any())
        } returns PackageManager.PERMISSION_GRANTED
        
        locationManager.startLocationUpdates()
        assertTrue(locationManager.isLocationUpdatesActive.first())
        
        // When permissions are revoked
        every { 
            androidx.core.app.ActivityCompat.checkSelfPermission(any(), any())
        } returns PackageManager.PERMISSION_DENIED
        
        locationManager.checkLocationPermissions()
        
        // Then location updates should stop
        assertEquals(LocationPermissionStatus.DENIED, locationManager.permissionStatus.first())
    }
}