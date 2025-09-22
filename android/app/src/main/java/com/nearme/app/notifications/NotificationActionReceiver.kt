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
        val action = intent.getStringExtra("action")
        val notificationId = intent.getIntExtra("notificationId", -1)
        
        Log.d("NotificationAction", "Received action: $action for notification: $notificationId")
        
        when (action) {
            "COMPLETE" -> {
                handleCompleteAction(context, notificationId)
            }
            "SNOOZE_15M" -> {
                handleSnoozeAction(context, notificationId, "15m")
            }
            "SNOOZE_1H" -> {
                handleSnoozeAction(context, notificationId, "1h")
            }
            "SNOOZE_TODAY" -> {
                handleSnoozeAction(context, notificationId, "today")
            }
            "MUTE" -> {
                handleMuteAction(context, notificationId)
            }
        }
        
        // Cancel the notification
        val notificationManager = NotificationManager(context.applicationContext as android.app.Application)
        notificationManager.cancelNotification(notificationId)
    }
    
    private fun handleCompleteAction(context: Context, notificationId: Int) {
        Log.d("NotificationAction", "Task completed for notification: $notificationId")
        
        // Extract task ID from notification ID
        val taskId = extractTaskIdFromNotificationId(notificationId)
        
        // TODO: Send completion to backend API
        sendTaskCompletion(context, taskId)
    }
    
    private fun handleSnoozeAction(context: Context, notificationId: Int, duration: String) {
        Log.d("NotificationAction", "Task snoozed for $duration, notification: $notificationId")
        
        // Extract task ID from notification ID
        val taskId = extractTaskIdFromNotificationId(notificationId)
        
        // Schedule snooze notification
        scheduleSnoozeNotification(context, taskId, duration, notificationId)
        
        // TODO: Send snooze to backend API
        sendTaskSnooze(context, taskId, duration)
    }
    
    private fun handleMuteAction(context: Context, notificationId: Int) {
        Log.d("NotificationAction", "Task muted for notification: $notificationId")
        
        // Extract task ID from notification ID
        val taskId = extractTaskIdFromNotificationId(notificationId)
        
        // TODO: Send mute to backend API
        sendTaskMute(context, taskId)
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
    
    // Backend API calls (placeholder)
    private fun sendTaskCompletion(context: Context, taskId: String) {
        // TODO: Implement API call to backend
        Log.d("NotificationAction", "Task completed: $taskId")
    }
    
    private fun sendTaskSnooze(context: Context, taskId: String, duration: String) {
        // TODO: Implement API call to backend
        Log.d("NotificationAction", "Task snoozed: $taskId for $duration")
    }
    
    private fun sendTaskMute(context: Context, taskId: String) {
        // TODO: Implement API call to backend
        Log.d("NotificationAction", "Task muted: $taskId")
    }
}