package com.nearme.app.location

import android.content.Context
import android.content.Intent
import android.location.Location
import androidx.test.core.app.ApplicationProvider
import androidx.work.WorkManager
import androidx.work.testing.WorkManagerTestInitHelper
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent
import io.mockk.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class GeofenceBroadcastReceiverTest {
    
    private lateinit var context: Context
    private lateinit var receiver: GeofenceBroadcastReceiver
    private lateinit var mockIntent: Intent
    private lateinit var mockGeofencingEvent: GeofencingEvent
    private lateinit var mockGeofence: Geofence
    private lateinit var mockLocation: Location
    
    @Before
    fun setup() {
        context = ApplicationProvider.getApplicationContext()
        receiver = GeofenceBroadcastReceiver()
        
        // Initialize WorkManager for testing
        WorkManagerTestInitHelper.initializeTestWorkManager(context)
        
        // Mock objects
        mockIntent = mockk(relaxed = true)
        mockGeofencingEvent = mockk(relaxed = true)
        mockGeofence = mockk(relaxed = true)
        mockLocation = mockk(relaxed = true)
        
        // Mock static methods
        mockkStatic(GeofencingEvent::class)
        
        // Setup default mock behavior
        every { GeofencingEvent.fromIntent(mockIntent) } returns mockGeofencingEvent
        every { mockGeofencingEvent.hasError() } returns false
        every { mockGeofencingEvent.triggeringGeofences } returns listOf(mockGeofence)
        every { mockGeofencingEvent.triggeringLocation } returns mockLocation
        every { mockGeofence.requestId } returns "test_geofence_id"
        every { mockLocation.latitude } returns 37.7749
        every { mockLocation.longitude } returns -122.4194
    }
    
    @Test
    fun `onReceive handles geofence enter event correctly`() {
        // Given
        every { mockGeofencingEvent.geofenceTransition } returns Geofence.GEOFENCE_TRANSITION_ENTER
        
        // When
        receiver.onReceive(context, mockIntent)
        
        // Then
        verify { mockGeofencingEvent.geofenceTransition }
        verify { mockGeofencingEvent.triggeringGeofences }
        verify { mockGeofencingEvent.triggeringLocation }
    }
    
    @Test
    fun `onReceive handles geofence exit event correctly`() {
        // Given
        every { mockGeofencingEvent.geofenceTransition } returns Geofence.GEOFENCE_TRANSITION_EXIT
        
        // When
        receiver.onReceive(context, mockIntent)
        
        // Then
        verify { mockGeofencingEvent.geofenceTransition }
        verify { mockGeofencingEvent.triggeringGeofences }
    }
    
    @Test
    fun `onReceive handles geofence dwell event correctly`() {
        // Given
        every { mockGeofencingEvent.geofenceTransition } returns Geofence.GEOFENCE_TRANSITION_DWELL
        
        // When
        receiver.onReceive(context, mockIntent)
        
        // Then
        verify { mockGeofencingEvent.geofenceTransition }
        verify { mockGeofencingEvent.triggeringGeofences }
    }
    
    @Test
    fun `onReceive handles geofencing errors gracefully`() {
        // Given
        every { mockGeofencingEvent.hasError() } returns true
        every { mockGeofencingEvent.errorCode } returns 1000
        
        // When
        receiver.onReceive(context, mockIntent)
        
        // Then
        verify { mockGeofencingEvent.hasError() }
        verify { mockGeofencingEvent.errorCode }
    }
    
    @Test
    fun `onReceive ignores unknown transition types`() {
        // Given
        every { mockGeofencingEvent.geofenceTransition } returns 999 // Unknown transition
        
        // When
        receiver.onReceive(context, mockIntent)
        
        // Then
        verify { mockGeofencingEvent.geofenceTransition }
        // Should not process further
    }
    
    @Test
    fun `onReceive handles multiple geofences in single event`() {
        // Given
        val mockGeofence2 = mockk<Geofence>(relaxed = true)
        every { mockGeofence2.requestId } returns "test_geofence_id_2"
        every { mockGeofencingEvent.triggeringGeofences } returns listOf(mockGeofence, mockGeofence2)
        every { mockGeofencingEvent.geofenceTransition } returns Geofence.GEOFENCE_TRANSITION_ENTER
        
        // When
        receiver.onReceive(context, mockIntent)
        
        // Then
        verify { mockGeofencingEvent.triggeringGeofences }
        // Should process both geofences
    }
    
    @Test
    fun `onReceive handles null geofencing event`() {
        // Given
        every { GeofencingEvent.fromIntent(mockIntent) } returns null
        
        // When
        receiver.onReceive(context, mockIntent)
        
        // Then
        // Should handle gracefully without crashing
        verify { GeofencingEvent.fromIntent(mockIntent) }
    }
}