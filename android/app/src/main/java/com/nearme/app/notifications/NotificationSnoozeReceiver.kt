package com.nearme.app.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class NotificationSnoozeReceiver : BroadcastReceiver() {
    
    override fun onReceive(context: Context, intent: Intent) {
        val taskId = intent.getStringExtra("taskId")
        val originalNotificationId = intent.getIntExtra("originalNotificationId", -1)
        val duration = intent.getStringExtra("duration")
        
        Log.d("NotificationSnooze", "Snooze expired for task: $taskId, duration: $duration")
        
        // Create a new notification for the snoozed task
        val notificationManager = NotificationManager(context.applicationContext as android.app.Application)
        
        // Generate new notification ID for the snooze notification
        val snoozeNotificationId = originalNotificationId + 2000
        
        // Create notification content
        val title = "Task Reminder"
        val body = "Your snoozed task is ready for attention"
        
        // Create notification with actions
        val actions = listOf(
            NotificationAction("COMPLETE", "Complete"),
            NotificationAction("SNOOZE_15M", "Snooze 15m"),
            NotificationAction("SNOOZE_1H", "Snooze 1h"),
            NotificationAction("SNOOZE_TODAY", "Snooze Today"),
            NotificationAction("MUTE", "Mute")
        )
        
        notificationManager.showNotification(
            snoozeNotificationId,
            title,
            body,
            actions,
            taskId = taskId
        )
        
        Log.d("NotificationSnooze", "Snooze notification displayed for task: $taskId")
    }
}
