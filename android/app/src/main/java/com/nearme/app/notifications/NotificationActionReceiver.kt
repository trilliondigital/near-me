package com.nearme.app.notifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import java.util.Calendar

class NotificationActionReceiver : BroadcastReceiver() {
    
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: intent.getStringExtra("action")
        val notificationId = intent.getIntExtra("notificationId", -1)
        val taskId = intent.getStringExtra("task_id")
        val fcmNotificationId = intent.getStringExtra("notification_id")
        
        Log.d("NotificationAction", "Received action: $action for notification: $notificationId, task: $taskId")
        
        when (action) {
            "COMPLETE_ACTION", "COMPLETE" -> {
                handleCompleteAction(context, taskId ?: extractTaskIdFromNotificationId(notificationId), fcmNotificationId)
            }
            "SNOOZE_ACTION", "SNOOZE_15M" -> {
                handleSnoozeAction(context, taskId ?: extractTaskIdFromNotificationId(notificationId), "15m", fcmNotificationId)
            }
            "SNOOZE_1H" -> {
                handleSnoozeAction(context, taskId ?: extractTaskIdFromNotificationId(notificationId), "1h", fcmNotificationId)
            }
            "SNOOZE_TODAY" -> {
                handleSnoozeAction(context, taskId ?: extractTaskIdFromNotificationId(notificationId), "today", fcmNotificationId)
            }
            "MUTE_ACTION", "MUTE" -> {
                handleMuteAction(context, taskId ?: extractTaskIdFromNotificationId(notificationId), fcmNotificationId)
            }
        }
        
        // Cancel the notification
        val notificationManager = NotificationManager(context.applicationContext as android.app.Application)
        notificationManager.cancelNotification(notificationId)
    }
    
    private fun handleCompleteAction(context: Context, taskId: String, notificationId: String?) {
        Log.d("NotificationAction", "Task completed: $taskId")
        
        // Send completion to backend API
        sendNotificationAction(context, notificationId ?: "notification_$taskId", "complete")
    }
    
    private fun handleSnoozeAction(context: Context, taskId: String, duration: String, notificationId: String?) {
        Log.d("NotificationAction", "Task snoozed for $duration: $taskId")
        
        // Send snooze to backend API
        val action = when (duration) {
            "15m" -> "snooze_15m"
            "1h" -> "snooze_1h"
            "today" -> "snooze_today"
            else -> "snooze_15m"
        }
        
        sendNotificationAction(context, notificationId ?: "notification_$taskId", action)
    }
    
    private fun handleMuteAction(context: Context, taskId: String, notificationId: String?) {
        Log.d("NotificationAction", "Task muted: $taskId")
        
        // Send mute to backend API
        sendNotificationAction(context, notificationId ?: "notification_$taskId", "mute")
    }
    
    // Helper methods
    private fun extractTaskIdFromNotificationId(notificationId: Int): String {
        // Assuming notification ID contains task ID
        // This would need to be implemented based on your notification ID scheme
        return "task_$notificationId"
    }
    
    private fun scheduleSnoozeNotification(context: Context, taskId: String, duration: String, originalNotificationId: Int) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        
        // Create intent for snooze notification
        val snoozeIntent = Intent(context, NotificationSnoozeReceiver::class.java).apply {
            putExtra("taskId", taskId)
            putExtra("originalNotificationId", originalNotificationId)
            putExtra("duration", duration)
        }
        
        val snoozePendingIntent = PendingIntent.getBroadcast(
            context,
            originalNotificationId + 1000, // Different request code for snooze
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        // Calculate trigger time
        val triggerTime = calculateSnoozeTriggerTime(duration)
        
        // Schedule the alarm
        alarmManager.setExactAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            triggerTime,
            snoozePendingIntent
        )
        
        Log.d("NotificationAction", "Snooze notification scheduled for $duration")
    }
    
    private fun calculateSnoozeTriggerTime(duration: String): Long {
        val calendar = Calendar.getInstance()
        
        when (duration) {
            "15m" -> {
                calendar.add(Calendar.MINUTE, 15)
            }
            "1h" -> {
                calendar.add(Calendar.HOUR, 1)
            }
            "today" -> {
                // Schedule for 9 AM tomorrow
                calendar.add(Calendar.DAY_OF_MONTH, 1)
                calendar.set(Calendar.HOUR_OF_DAY, 9)
                calendar.set(Calendar.MINUTE, 0)
                calendar.set(Calendar.SECOND, 0)
                calendar.set(Calendar.MILLISECOND, 0)
            }
            else -> {
                calendar.add(Calendar.MINUTE, 15) // Default to 15 minutes
            }
        }
        
        return calendar.timeInMillis
    }
    
    // Backend API calls
    private fun sendNotificationAction(context: Context, notificationId: String, action: String) {
        // Use coroutine to make API call
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            try {
                val url = java.net.URL("http://10.0.2.2:3000/api/push-notifications/action")
                val connection = url.openConnection() as java.net.HttpURLConnection
                
                connection.requestMethod = "POST"
                connection.setRequestProperty("Content-Type", "application/json")
                connection.doOutput = true
                
                // Get auth token from shared preferences
                val authToken = context.getSharedPreferences("auth_prefs", Context.MODE_PRIVATE)
                    .getString("auth_token", null)
                
                if (authToken != null) {
                    connection.setRequestProperty("Authorization", "Bearer $authToken")
                }
                
                val jsonBody = org.json.JSONObject().apply {
                    put("notification_id", notificationId)
                    put("action", action)
                }
                
                connection.outputStream.use { os ->
                    os.write(jsonBody.toString().toByteArray())
                }
                
                val responseCode = connection.responseCode
                if (responseCode == java.net.HttpURLConnection.HTTP_OK) {
                    Log.d("NotificationAction", "Action sent successfully: $action")
                } else {
                    Log.e("NotificationAction", "Failed to send action. Response code: $responseCode")
                }
                
            } catch (e: Exception) {
                Log.e("NotificationAction", "Error sending action to server", e)
            }
        }
    }
}