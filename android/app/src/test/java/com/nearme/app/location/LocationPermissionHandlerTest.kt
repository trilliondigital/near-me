package com.nearme.app.location

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import androidx.test.core.app.ApplicationProvider
import io.mockk.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class LocationPermissionHandlerTest {
    
    private lateinit var context: Context
    private lateinit var mockActivity: Activity
    private lateinit var permissionHandler: LocationPermissionHandler
    
    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        mockActivity = mockk(relaxed = true)
        permissionHandler = LocationPermissionHandler(context)
        
        // Mock static methods
        mockkStatic("androidx.core.content.ContextCompat")
        mockkStatic("androidx.core.app.ActivityCompat")
    }
    
    @Test
    fun `hasLocationPermissions returns true when all permissions granted`() {
        // Given
        every { 
            androidx.core.content.ContextCompat.checkSelfPermission(context, any())
        } returns PackageManager.PERMISSION_GRANTED
        
        // When
        val result = permissionHandler.hasLocationPermissions()
        
        // Then
        assertTrue(result)
    }
    
    @Test
    fun `hasLocationPermissions returns false when permissions denied`() {
        // Given
        every { 
            androidx.core.content.ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
        } returns PackageManager.PERMISSION_DENIED
        every { 
            androidx.core.content.ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION)
        } returns PackageManager.PERMISSION_GRANTED
        
        // When
        val result = permissionHandler.hasLocationPermissions()
        
        // Then
        assertFalse(result)
    }
    
    @Test
    fun `hasBackgroundLocationPermission returns true on API less than 29`() {
        // Given - API level 28 (set in @Config)
        every { 
            androidx.core.content.ContextCompat.checkSelfPermission(context, any())
        } returns PackageManager.PERMISSION_GRANTED
        
        // When
        val result = permissionHandler.hasBackgroundLocationPermission()
        
        // Then
        assertTrue(result) // Should return true for API < 29
    }
    
    @Test
    fun `getPermissionStatus returns DENIED when location permissions not granted`() {
        // Given
        every { 
            androidx.core.content.ContextCompat.checkSelfPermission(context, any())
        } returns PackageManager.PERMISSION_DENIED
        
        // When
        val status = permissionHandler.getPermissionStatus()
        
        // Then
        assertEquals(LocationPermissionStatus.DENIED, status)
    }
    
    @Test
    fun `getPermissionStatus returns GRANTED when all permissions granted`() {
        // Given
        every { 
            androidx.core.content.ContextCompat.checkSelfPermission(context, any())
        } returns PackageManager.PERMISSION_GRANTED
        
        // When
        val status = permissionHandler.getPermissionStatus()
        
        // Then
        assertEquals(LocationPermissionStatus.GRANTED, status)
    }
    
    @Test
    fun `shouldShowLocationPermissionRationale returns correct value`() {
        // Given
        every { 
            androidx.core.app.ActivityCompat.shouldShowRequestPermissionRationale(mockActivity, any())
        } returns true
        
        // When
        val result = permissionHandler.shouldShowLocationPermissionRationale(mockActivity)
        
        // Then
        assertTrue(result)
    }
    
    @Test
    fun `requestLocationPermissions calls ActivityCompat with correct parameters`() {
        // When
        permissionHandler.requestLocationPermissions(mockActivity)
        
        // Then
        verify { 
            androidx.core.app.ActivityCompat.requestPermissions(
                mockActivity,
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ),
                LocationPermissionHandler.LOCATION_PERMISSION_REQUEST_CODE
            )
        }
    }
    
    @Test
    fun `handlePermissionResult returns LOCATION_GRANTED when all permissions granted`() {
        // Given
        val permissions = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        val grantResults = intArrayOf(
            PackageManager.PERMISSION_GRANTED,
            PackageManager.PERMISSION_GRANTED
        )
        
        // When
        val result = permissionHandler.handlePermissionResult(
            LocationPermissionHandler.LOCATION_PERMISSION_REQUEST_CODE,
            permissions,
            grantResults
        )
        
        // Then
        assertEquals(LocationPermissionHandler.PermissionResult.LOCATION_GRANTED, result)
    }
    
    @Test
    fun `handlePermissionResult returns LOCATION_DENIED when permissions denied`() {
        // Given
        val permissions = arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        val grantResults = intArrayOf(PackageManager.PERMISSION_DENIED)
        
        // When
        val result = permissionHandler.handlePermissionResult(
            LocationPermissionHandler.LOCATION_PERMISSION_REQUEST_CODE,
            permissions,
            grantResults
        )
        
        // Then
        assertEquals(LocationPermissionHandler.PermissionResult.LOCATION_DENIED, result)
    }
    
    @Test
    fun `getPermissionExplanation returns appropriate text for each status`() {
        // Test each permission status
        val deniedExplanation = permissionHandler.getPermissionExplanation(LocationPermissionStatus.DENIED)
        val backgroundDeniedExplanation = permissionHandler.getPermissionExplanation(LocationPermissionStatus.BACKGROUND_DENIED)
        val grantedExplanation = permissionHandler.getPermissionExplanation(LocationPermissionStatus.GRANTED)
        
        assertTrue(deniedExplanation.contains("location access"))
        assertTrue(backgroundDeniedExplanation.contains("background location"))
        assertTrue(grantedExplanation.contains("properly configured"))
    }
    
    @Test
    fun `getPermissionStrategy returns correct strategy for denied permissions`() {
        // Given
        every { 
            androidx.core.content.ContextCompat.checkSelfPermission(context, any())
        } returns PackageManager.PERMISSION_DENIED
        every { 
            androidx.core.app.ActivityCompat.shouldShowRequestPermissionRationale(mockActivity, any())
        } returns true
        
        // When
        val strategy = permissionHandler.getPermissionStrategy(mockActivity)
        
        // Then
        assertEquals(LocationPermissionHandler.PermissionStrategy.SHOW_RATIONALE_AND_REQUEST, strategy)
    }
}