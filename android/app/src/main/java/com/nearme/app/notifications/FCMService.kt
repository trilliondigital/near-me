package com.nearme.app.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.nearme.app.MainActivity
import com.nearme.app.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

class FCMService : FirebaseMessagingService() {
    
    companion object {
        private const val TAG = "FCMService"
        private const val CHANNEL_ID = "location_reminders"
        private const val API_BASE_URL = "http://10.0.2.2:3000/api" // Android emulator localhost
    }
    
    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }
    
    override fun onNewToken(token: String) {
        Log.d(TAG, "Refreshed token: $token")
        
        // Send token to backend
        sendTokenToServer(token)
        
        // Store token locally
        getSharedPreferences("fcm_prefs", Context.MODE_PRIVATE)
            .edit()
            .putString("fcm_token", token)
            .apply()
    }
    
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d(TAG, "From: ${remoteMessage.from}")
        
        // Check if message contains a data payload
        if (remoteMessage.data.isNotEmpty()) {
            Log.d(TAG, "Message data payload: ${remoteMessage.data}")
            handleDataMessage(remoteMessage.data)
        }
        
        // Check if message contains a notification payload
        remoteMessage.notification?.let {
            Log.d(TAG, "Message Notification Body: ${it.body}")
            showNotification(
                title = it.title ?: "Near Me",
                body = it.body ?: "",
                data = remoteMessage.data
            )
        }
    }
    
    private fun handleDataMessage(data: Map<String, String>) {
        val taskId = data["task_id"]
        val notificationId = data["notification_id"]
        val actionType = data["action_type"]
        val title = data["title"] ?: "Near Me"
        val body = data["body"] ?: ""
        
        Log.d(TAG, "Handling data message - Task: $taskId, Type: $actionType")
        
        // Show notification with custom actions
        showNotification(title, body, data)
        
        // Handle any immediate processing if needed
        if (taskId != null && actionType != null) {
            // Could trigger local processing here
        }
    }
    
    private fun showNotification(title: String, body: String, data: Map<String, String>) {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            // Add task data to intent
            data["task_id"]?.let { putExtra("task_id", it) }
            data["notification_id"]?.let { putExtra("notification_id", it) }
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info) // TODO: Replace with app icon
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setContentIntent(pendingIntent)
        
        // Add action buttons based on notification type
        addNotificationActions(notificationBuilder, data)
        
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notificationId = data["notification_id"]?.hashCode() ?: System.currentTimeMillis().toInt()
        notificationManager.notify(notificationId, notificationBuilder.build())
    }
    
    private fun addNotificationActions(
        builder: NotificationCompat.Builder,
        data: Map<String, String>
    ) {
        val taskId = data["task_id"] ?: return
        val notificationId = data["notification_id"] ?: return
        
        // Complete action
        val completeIntent = Intent(this, NotificationActionReceiver::class.java).apply {
            action = "COMPLETE_ACTION"
            putExtra("task_id", taskId)
            putExtra("notification_id", notificationId)
        }
        val completePendingIntent = PendingIntent.getBroadcast(
            this, 1, completeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        builder.addAction(
            android.R.drawable.ic_menu_save,
            "Complete",
            completePendingIntent
        )
        
        // Snooze action
        val snoozeIntent = Intent(this, NotificationActionReceiver::class.java).apply {
            action = "SNOOZE_ACTION"
            putExtra("task_id", taskId)
            putExtra("notification_id", notificationId)
        }
        val snoozePendingIntent = PendingIntent.getBroadcast(
            this, 2, snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        builder.addAction(
            android.R.drawable.ic_menu_recent_history,
            "Snooze",
            snoozePendingIntent
        )
        
        // Mute action
        val muteIntent = Intent(this, NotificationActionReceiver::class.java).apply {
            action = "MUTE_ACTION"
            putExtra("task_id", taskId)
            putExtra("notification_id", notificationId)
        }
        val mutePendingIntent = PendingIntent.getBroadcast(
            this, 3, muteIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        builder.addAction(
            android.R.drawable.ic_menu_close_clear_cancel,
            "Mute",
            mutePendingIntent
        )
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Location Reminders",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for location-based reminders"
                enableVibration(true)
                setShowBadge(true)
            }
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    private fun sendTokenToServer(token: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = URL("$API_BASE_URL/auth/device-token")
                val connection = url.openConnection() as HttpURLConnection
                
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json")
                connection.doOutput = true
                
                // Get auth token from shared preferences
                val authToken = getSharedPreferences("auth_prefs", Context.MODE_PRIVATE)
                    .getString("auth_token", null)
                
                if (authToken != null) {
                    connection.setRequestProperty("Authorization", "Bearer $authToken")
                }
                
                val jsonBody = JSONObject().apply {
                    put("device_token", token)
                    put("platform", "android")
                }
                
                connection.outputStream.use { os ->
                    os.write(jsonBody.toString().toByteArray())
                }
                
                val responseCode = connection.responseCode
                if (responseCode == HttpURLConnection.HTTP_OK) {
                    Log.d(TAG, "Token sent to server successfully")
                } else {
                    Log.e(TAG, "Failed to send token to server. Response code: $responseCode")
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "Error sending token to server", e)
            }
        }
    }
}