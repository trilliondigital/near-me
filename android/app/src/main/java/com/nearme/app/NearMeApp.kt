package com.nearme.app

import androidx.compose.runtime.*
import androidx.lifecycle.viewmodel.compose.viewModel
import com.nearme.app.location.LocationManager
import com.nearme.app.navigation.MainNavigation
import com.nearme.app.notifications.NotificationManager

@Composable
fun NearMeApp() {
    val locationManager: LocationManager = viewModel()
    val notificationManager: NotificationManager = viewModel()
    
    LaunchedEffect(Unit) {
        locationManager.requestLocationPermission()
        notificationManager.requestNotificationPermission()
    }
    
    MainNavigation()
}