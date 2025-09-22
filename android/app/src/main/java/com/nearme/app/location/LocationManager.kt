package com.nearme.app.location

import android.Manifest
import android.app.Application
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.location.*
import com.google.android.gms.maps.model.LatLng
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class LocationManager(application: Application) : AndroidViewModel(application) {
    private val context = getApplication<Application>()
    private val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
    private val geofencingClient = LocationServices.getGeofencingClient(context)
    
    private val _isLocationEnabled = MutableStateFlow(false)
    val isLocationEnabled: StateFlow<Boolean> = _isLocationEnabled
    
    private val _currentLocation = MutableStateFlow<LatLng?>(null)
    val currentLocation: StateFlow<LatLng?> = _currentLocation
    
    private val geofenceList = mutableListOf<Geofence>()
    
    fun requestLocationPermission() {
        viewModelScope.launch {
            checkLocationPermission()
        }
    }
    
    private fun checkLocationPermission() {
        val hasLocationPermission = ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        
        val hasBackgroundPermission = ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_BACKGROUND_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        
        _isLocationEnabled.value = hasLocationPermission && hasBackgroundPermission
        
        if (hasLocationPermission) {
            startLocationUpdates()
        }
    }
    
    private fun startLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            10000L // 10 seconds
        ).build()
        
        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    _currentLocation.value = LatLng(location.latitude, location.longitude)
                }
            }
        }
        
        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            null
        )
    }
    
    fun addGeofence(
        id: String,
        center: LatLng,
        radius: Float,
        transitionTypes: Int = Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT
    ) {
        val geofence = Geofence.Builder()
            .setRequestId(id)
            .setCircularRegion(center.latitude, center.longitude, radius)
            .setExpirationDuration(Geofence.NEVER_EXPIRE)
            .setTransitionTypes(transitionTypes)
            .build()
        
        geofenceList.add(geofence)
        registerGeofences()
    }
    
    fun removeGeofence(id: String) {
        geofenceList.removeAll { it.requestId == id }
        geofencingClient.removeGeofences(listOf(id))
    }
    
    private fun registerGeofences() {
        if (ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        
        val geofencingRequest = GeofencingRequest.Builder()
            .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
            .addGeofences(geofenceList)
            .build()
        
        val intent = Intent(context, GeofenceBroadcastReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        geofencingClient.addGeofences(geofencingRequest, pendingIntent)
    }
}