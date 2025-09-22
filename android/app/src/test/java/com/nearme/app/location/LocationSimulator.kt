package com.nearme.app.location

import android.location.Location
import com.google.android.gms.maps.model.LatLng
import kotlin.math.*

/**
 * Utility class for simulating location data in tests
 * - Generates realistic location sequences
 * - Simulates movement patterns and geofence transitions
 * - Provides test data for various scenarios
 */
class LocationSimulator {
    
    companion object {
        // Test locations in San Francisco area
        val DOWNTOWN_SF = LatLng(37.7749, -122.4194)
        val MISSION_SF = LatLng(37.7599, -122.4148)
        val CASTRO_SF = LatLng(37.7609, -122.4350)
        val HAIGHT_SF = LatLng(37.7692, -122.4481)
        
        // Test POI locations
        val GROCERY_STORE = LatLng(37.7849, -122.4094)
        val GAS_STATION = LatLng(37.7649, -122.4294)
        val PHARMACY = LatLng(37.7549, -122.4394)
        val BANK = LatLng(37.7449, -122.4494)
        
        private const val EARTH_RADIUS_METERS = 6371000.0
    }
    
    /**
     * Create a mock Location object with specified coordinates
     */
    fun createMockLocation(
        latitude: Double,
        longitude: Double,
        accuracy: Float = 10f,
        speed: Float = 0f,
        bearing: Float = 0f,
        time: Long = System.currentTimeMillis()
    ): Location {
        return Location("test").apply {
            this.latitude = latitude
            this.longitude = longitude
            this.accuracy = accuracy
            this.speed = speed
            this.bearing = bearing
            this.time = time
        }
    }
    
    /**
     * Generate a sequence of locations simulating movement from start to end
     */
    fun generateMovementSequence(
        start: LatLng,
        end: LatLng,
        steps: Int = 10,
        speedMps: Float = 5f // meters per second
    ): List<Location> {
        val locations = mutableListOf<Location>()
        val startTime = System.currentTimeMillis()
        
        for (i in 0..steps) {
            val progress = i.toFloat() / steps
            val lat = start.latitude + (end.latitude - start.latitude) * progress
            val lng = start.longitude + (end.longitude - start.longitude) * progress
            val time = startTime + (i * 1000) // 1 second intervals
            
            locations.add(createMockLocation(
                latitude = lat,
                longitude = lng,
                speed = speedMps,
                time = time
            ))
        }
        
        return locations
    }
    
    /**
     * Generate locations approaching a geofence
     */
    fun generateGeofenceApproach(
        target: LatLng,
        startDistanceMeters: Double = 10000.0, // 10km away
        endDistanceMeters: Double = 50.0, // 50m away
        steps: Int = 20
    ): List<Location> {
        val locations = mutableListOf<Location>()
        val startTime = System.currentTimeMillis()
        
        // Generate approach from north
        val bearing = 180.0 // Approaching from north (heading south)
        
        for (i in 0..steps) {
            val progress = i.toFloat() / steps
            val distance = startDistanceMeters - (startDistanceMeters - endDistanceMeters) * progress
            val location = calculateLocationAtDistance(target, distance, bearing)
            val time = startTime + (i * 30000) // 30 second intervals
            
            locations.add(createMockLocation(
                latitude = location.latitude,
                longitude = location.longitude,
                speed = calculateSpeed(startDistanceMeters, endDistanceMeters, steps * 30f),
                time = time
            ))
        }
        
        return locations
    }
    
    /**
     * Generate locations for geofence entry and exit
     */
    fun generateGeofenceTransition(
        center: LatLng,
        radius: Float,
        enterFromOutside: Boolean = true
    ): List<Location> {
        val locations = mutableListOf<Location>()
        val startTime = System.currentTimeMillis()
        
        val outsideDistance = radius + 50.0 // 50m outside
        val insideDistance = radius - 20.0 // 20m inside
        
        val startDistance = if (enterFromOutside) outsideDistance else insideDistance
        val endDistance = if (enterFromOutside) insideDistance else outsideDistance
        
        // Generate 5 locations for the transition
        for (i in 0..4) {
            val progress = i.toFloat() / 4
            val distance = startDistance + (endDistance - startDistance) * progress
            val location = calculateLocationAtDistance(center, distance, 90.0) // From west
            val time = startTime + (i * 10000) // 10 second intervals
            
            locations.add(createMockLocation(
                latitude = location.latitude,
                longitude = location.longitude,
                time = time
            ))
        }
        
        return locations
    }
    
    /**
     * Generate stationary locations (for dwell testing)
     */
    fun generateStationaryLocations(
        center: LatLng,
        durationMinutes: Int = 10,
        intervalSeconds: Int = 30
    ): List<Location> {
        val locations = mutableListOf<Location>()
        val startTime = System.currentTimeMillis()
        val totalIntervals = (durationMinutes * 60) / intervalSeconds
        
        for (i in 0 until totalIntervals) {
            // Add small random variations to simulate GPS drift
            val latVariation = (Math.random() - 0.5) * 0.0001 // ~10m variation
            val lngVariation = (Math.random() - 0.5) * 0.0001
            
            val time = startTime + (i * intervalSeconds * 1000)
            
            locations.add(createMockLocation(
                latitude = center.latitude + latVariation,
                longitude = center.longitude + lngVariation,
                accuracy = (5..15).random().toFloat(),
                time = time
            ))
        }
        
        return locations
    }
    
    /**
     * Calculate distance between two locations in meters
     */
    fun calculateDistance(location1: LatLng, location2: LatLng): Double {
        val lat1Rad = Math.toRadians(location1.latitude)
        val lat2Rad = Math.toRadians(location2.latitude)
        val deltaLatRad = Math.toRadians(location2.latitude - location1.latitude)
        val deltaLngRad = Math.toRadians(location2.longitude - location1.longitude)
        
        val a = sin(deltaLatRad / 2).pow(2) +
                cos(lat1Rad) * cos(lat2Rad) * sin(deltaLngRad / 2).pow(2)
        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        
        return EARTH_RADIUS_METERS * c
    }
    
    /**
     * Calculate a location at a specific distance and bearing from a center point
     */
    private fun calculateLocationAtDistance(
        center: LatLng,
        distanceMeters: Double,
        bearingDegrees: Double
    ): LatLng {
        val bearingRad = Math.toRadians(bearingDegrees)
        val latRad = Math.toRadians(center.latitude)
        val lngRad = Math.toRadians(center.longitude)
        val angularDistance = distanceMeters / EARTH_RADIUS_METERS
        
        val newLatRad = asin(
            sin(latRad) * cos(angularDistance) +
            cos(latRad) * sin(angularDistance) * cos(bearingRad)
        )
        
        val newLngRad = lngRad + atan2(
            sin(bearingRad) * sin(angularDistance) * cos(latRad),
            cos(angularDistance) - sin(latRad) * sin(newLatRad)
        )
        
        return LatLng(Math.toDegrees(newLatRad), Math.toDegrees(newLngRad))
    }
    
    /**
     * Calculate speed based on distance and time
     */
    private fun calculateSpeed(
        startDistanceMeters: Double,
        endDistanceMeters: Double,
        totalTimeSeconds: Float
    ): Float {
        val distanceTraveled = abs(startDistanceMeters - endDistanceMeters)
        return (distanceTraveled / totalTimeSeconds).toFloat()
    }
    
    /**
     * Create test scenarios for different geofence types
     */
    fun createTestScenarios(): Map<String, List<Location>> {
        return mapOf(
            "approach_5mi" to generateGeofenceApproach(
                GROCERY_STORE,
                startDistanceMeters = 8047.0, // 5 miles
                endDistanceMeters = 4828.0 // 3 miles
            ),
            "approach_3mi" to generateGeofenceApproach(
                GROCERY_STORE,
                startDistanceMeters = 4828.0, // 3 miles
                endDistanceMeters = 1609.0 // 1 mile
            ),
            "approach_1mi" to generateGeofenceApproach(
                GROCERY_STORE,
                startDistanceMeters = 1609.0, // 1 mile
                endDistanceMeters = 100.0 // 100m (arrival)
            ),
            "arrival" to generateGeofenceTransition(
                GROCERY_STORE,
                radius = 100f,
                enterFromOutside = true
            ),
            "dwell" to generateStationaryLocations(
                GROCERY_STORE,
                durationMinutes = 10
            ),
            "exit" to generateGeofenceTransition(
                GROCERY_STORE,
                radius = 100f,
                enterFromOutside = false
            )
        )
    }
}