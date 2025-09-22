package com.nearme.app.notifications

import android.Manifest
import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.nearme.app.MainActivity
import com.nearme.app.R
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class NotificationManager(application: Application) : AndroidViewModel(application) {
    private val context = getApplication<Application>()
    
    private val _isNotificationEnabled = MutableStateFlow(false)
    val isNotificationEnabled: StateFlow<Boolean> = _isNotificationEnabled
    
    companion object {
        const val CHANNEL_ID = "location_reminders"
        const val CHANNEL_NAME = "Location Reminders"
        const val CHANNEL_DESCRIPTION = "Notifications for location-based reminders"
    }
    
    init {
        createNotificationChannel()
        checkNotificationPermission()
    }
    
    fun requestNotificationPermission() {
        viewModelScope.launch {
            checkNotificationPermission()
        }
    }
    
    private fun checkNotificationPermission() {
        val hasPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            NotificationManagerCompat.from(context).areNotificationsEnabled()
        }
        
        _isNotificationEnabled.value = hasPermission
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, importance).apply {
                description = CHANNEL_DESCRIPTION
                enableVibration(true)
                setShowBadge(true)
            }
            
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    fun showLocationNotification(
        id: Int,
        title: String,
        content: String,
        actions: List<NotificationAction> = emptyList()
    ) {
        if (!_isNotificationEnabled.value) return
        
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info) // TODO: Replace with app icon
            .setContentTitle(title)
            .setContentText(content)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
        
        // Add action buttons
        actions.forEach { action ->
            val actionIntent = Intent(context, NotificationActionReceiver::class.java).apply {
                putExtra("action", action.action)
                putExtra("notificationId", id)
            }
            
            val actionPendingIntent = PendingIntent.getBroadcast(
                context,
                action.action.hashCode(),
                actionIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            
            builder.addAction(
                android.R.drawable.ic_menu_info_details,
                action.title,
                actionPendingIntent
            )
        }
        
        with(NotificationManagerCompat.from(context)) {
            if (ActivityCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            ) {
                notify(id, builder.build())
            }
        }
    }
    
    fun cancelNotification(id: Int) {
        NotificationManagerCompat.from(context).cancel(id)
    }
}

data class NotificationAction(
    val action: String,
    val title: String
)