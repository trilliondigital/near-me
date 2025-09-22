package com.nearme.app.location

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofenceStatusCodes
import com.google.android.gms.location.GeofencingEvent

class GeofenceBroadcastReceiver : BroadcastReceiver() {
    
    override fun onReceive(context: Context, intent: Intent) {
        val geofencingEvent = GeofencingEvent.fromIntent(intent)
        
        if (geofencingEvent?.hasError() == true) {
            val errorMessage = GeofenceStatusCodes.getStatusCodeString(geofencingEvent.errorCode)
            Log.e("GeofenceReceiver", "Geofence error: $errorMessage")
            return
        }
        
        val geofenceTransition = geofencingEvent?.geofenceTransition
        
        when (geofenceTransition) {
            Geofence.GEOFENCE_TRANSITION_ENTER -> {
                handleGeofenceEnter(context, geofencingEvent.triggeringGeofences ?: emptyList())
            }
            Geofence.GEOFENCE_TRANSITION_EXIT -> {
                handleGeofenceExit(context, geofencingEvent.triggeringGeofences ?: emptyList())
            }
            else -> {
                Log.e("GeofenceReceiver", "Invalid geofence transition: $geofenceTransition")
            }
        }
    }
    
    private fun handleGeofenceEnter(context: Context, geofences: List<Geofence>) {
        for (geofence in geofences) {
            Log.d("GeofenceReceiver", "Entered geofence: ${geofence.requestId}")
            // TODO: Trigger notification for geofence entry
            // This will be implemented in later tasks
        }
    }
    
    private fun handleGeofenceExit(context: Context, geofences: List<Geofence>) {
        for (geofence in geofences) {
            Log.d("GeofenceReceiver", "Exited geofence: ${geofence.requestId}")
            // TODO: Handle geofence exit logic
            // This will be implemented in later tasks
        }
    }
}