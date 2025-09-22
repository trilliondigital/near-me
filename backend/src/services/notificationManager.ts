import { NotificationService, SnoozeDuration } from './notificationService';
import { NotificationHistory } from '../models/NotificationHistory';
import { NotificationSnooze } from '../models/NotificationSnooze';
import { TaskMute, MuteDuration } from '../models/TaskMute';
import { Task } from '../models/Task';
import { ValidationError } from '../models/validation';

export interface NotificationSummary {
  totalNotifications: number;
  pendingNotifications: number;
  deliveredNotifications: number;
  failedNotifications: number;
  snoozedNotifications: number;
  activeSnoozes: number;
  activeMutes: number;
}

export interface UserNotificationPreferences {
  quietHours?: {
    start: string;
    end: string;
  };
  enableBundling: boolean;
  maxNotificationsPerHour: number;
  snoozeDefaults: {
    defaultDuration: SnoozeDuration;
    maxSnoozeCount: number;
  };
  muteDefaults: {
    defaultDuration: MuteDuration;
    allowPermanentMute: boolean;
  };
}

export class NotificationManager {
  /**
   * Get comprehensive notification summary for a user
   */
  static async getUserNotificationSummary(userId: string): Promise<NotificationSummary> {
    const [
      notificationHistory,
      activeSnoozes,
      activeMutes
    ] = await Promise.all([
      NotificationHistory.findByUserId(userId, 1, 1000), // Get all notifications
      NotificationSnooze.findActiveByUserId(userId),
      TaskMute.findActiveByUserId(userId)
    ]);

    const notifications = notificationHistory.notifications;
    
    return {
      totalNotifications: notifications.length,
      pendingNotifications: notifications.filter(n => n.status === 'pending').length,
      deliveredNotifications: notifications.filter(n => n.status === 'delivered').length,
      failedNotifications: notifications.filter(n => n.status === 'failed').length,
      snoozedNotifications: notifications.filter(n => n.status === 'snoozed').length,
      activeSnoozes: activeSnoozes.length,
      activeMutes: activeMutes.length
    };
  }

  /**
   * Snooze all notifications for a task
   */
  static async snoozeTaskNotifications(
    taskId: string,
    userId: string,
    duration: SnoozeDuration,
    reason?: string
  ): Promise<{ snoozedCount: number; snoozes: NotificationSnooze[] }> {
    // Verify task ownership
    const task = await Task.findById(taskId, userId);
    if (!task) {
      throw new ValidationError('Task not found or access denied', []);
    }

    // Find pending notifications for this task
    const { notifications } = await NotificationHistory.findByUserId(userId);
    const taskNotifications = notifications.filter(
      n => n.taskId === taskId && n.status === 'pending'
    );

    const snoozes: NotificationSnooze[] = [];

    for (const notification of taskNotifications) {
      // Check if already snoozed
      const existingSnooze = await NotificationSnooze.findByNotificationId(notification.notificationId);
      if (existingSnooze && existingSnooze.status === 'active') {
        // Extend existing snooze
        await existingSnooze.extendSnooze(duration);
        snoozes.push(existingSnooze);
      } else {
        // Create new snooze
        const snooze = await NotificationSnooze.create({
          userId,
          taskId,
          notificationId: notification.notificationId,
          snoozeDuration: duration,
          originalScheduledTime: notification.scheduledTime
        });
        snoozes.push(snooze);

        // Mark notification as snoozed
        await notification.markSnoozed();
      }
    }

    return {
      snoozedCount: snoozes.length,
      snoozes
    };
  }

  /**
   * Mute a task with specified duration
   */
  static async muteTask(
    taskId: string,
    userId: string,
    duration: MuteDuration,
    reason?: string
  ): Promise<TaskMute> {
    // Verify task ownership
    const task = await Task.findById(taskId, userId);
    if (!task) {
      throw new ValidationError('Task not found or access denied', []);
    }

    // Check if task is already muted
    const existingMute = await TaskMute.findActiveByTaskId(taskId);
    if (existingMute) {
      // Extend existing mute
      return existingMute.extendMute(duration);
    }

    // Create new mute
    const mute = await TaskMute.create({
      userId,
      taskId,
      muteDuration: duration,
      reason
    });

    // Mark task as muted
    await task.mute();

    // Cancel any pending notifications for this task
    const { notifications } = await NotificationHistory.findByUserId(userId);
    const taskNotifications = notifications.filter(
      n => n.taskId === taskId && n.status === 'pending'
    );

    for (const notification of taskNotifications) {
      await notification.cancel();
    }

    return mute;
  }

  /**
   * Unmute a task
   */
  static async unmuteTask(taskId: string, userId: string): Promise<void> {
    // Verify task ownership
    const task = await Task.findById(taskId, userId);
    if (!task) {
      throw new ValidationError('Task not found or access denied', []);
    }

    // Find and cancel active mute
    const activeMute = await TaskMute.findActiveByTaskId(taskId);
    if (activeMute) {
      await activeMute.cancel();
    }

    // Unmute task
    await task.unmute();
  }

  /**
   * Cancel all snoozes for a task
   */
  static async cancelTaskSnoozes(taskId: string, userId: string): Promise<number> {
    // Verify task ownership
    const task = await Task.findById(taskId, userId);
    if (!task) {
      throw new ValidationError('Task not found or access denied', []);
    }

    const activeSnoozes = await NotificationSnooze.findActiveByUserId(userId);
    const taskSnoozes = activeSnoozes.filter(s => s.taskId === taskId);

    for (const snooze of taskSnoozes) {
      await snooze.cancel();
    }

    return taskSnoozes.length;
  }

  /**
   * Get notification delivery rate for a user
   */
  static async getNotificationDeliveryRate(
    userId: string,
    days: number = 7
  ): Promise<{
    totalSent: number;
    delivered: number;
    failed: number;
    deliveryRate: number;
    avgDeliveryTime: number;
  }> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const { notifications } = await NotificationHistory.findByUserId(userId, 1, 1000);
    const recentNotifications = notifications.filter(n => n.createdAt >= since);

    const delivered = recentNotifications.filter(n => n.status === 'delivered');
    const failed = recentNotifications.filter(n => n.status === 'failed');

    const deliveryTimes = delivered
      .filter(n => n.deliveredTime)
      .map(n => n.deliveredTime!.getTime() - n.scheduledTime.getTime());

    const avgDeliveryTime = deliveryTimes.length > 0
      ? deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length
      : 0;

    return {
      totalSent: recentNotifications.length,
      delivered: delivered.length,
      failed: failed.length,
      deliveryRate: recentNotifications.length > 0 
        ? delivered.length / recentNotifications.length 
        : 0,
      avgDeliveryTime: Math.round(avgDeliveryTime / 1000) // Convert to seconds
    };
  }

  /**
   * Get notification frequency analysis
   */
  static async getNotificationFrequency(
    userId: string,
    hours: number = 24
  ): Promise<{
    totalNotifications: number;
    notificationsPerHour: number;
    peakHour: number;
    hourlyDistribution: Record<number, number>;
  }> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const { notifications } = await NotificationHistory.findByUserId(userId, 1, 1000);
    const recentNotifications = notifications.filter(n => n.createdAt >= since);

    const hourlyDistribution: Record<number, number> = {};
    
    // Initialize all hours
    for (let i = 0; i < 24; i++) {
      hourlyDistribution[i] = 0;
    }

    // Count notifications by hour
    recentNotifications.forEach(notification => {
      const hour = notification.createdAt.getHours();
      hourlyDistribution[hour]++;
    });

    // Find peak hour
    const peakHour = Object.entries(hourlyDistribution)
      .reduce((peak, [hour, count]) => 
        count > hourlyDistribution[peak] ? parseInt(hour) : peak, 0
      );

    return {
      totalNotifications: recentNotifications.length,
      notificationsPerHour: recentNotifications.length / hours,
      peakHour,
      hourlyDistribution
    };
  }

  /**
   * Clean up old notification data for a user
   */
  static async cleanupUserNotifications(
    userId: string,
    olderThanDays: number = 30
  ): Promise<{
    deletedNotifications: number;
    deletedSnoozes: number;
    deletedMutes: number;
  }> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    
    // This would require additional methods in the models to delete old records
    // For now, return placeholder counts
    return {
      deletedNotifications: 0,
      deletedSnoozes: 0,
      deletedMutes: 0
    };
  }

  /**
   * Get user's notification preferences (placeholder for future implementation)
   */
  static async getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences> {
    // This would integrate with user preferences system
    return {
      enableBundling: true,
      maxNotificationsPerHour: 10,
      snoozeDefaults: {
        defaultDuration: '15m',
        maxSnoozeCount: 5
      },
      muteDefaults: {
        defaultDuration: '1h',
        allowPermanentMute: true
      }
    };
  }

  /**
   * Update user's notification preferences (placeholder for future implementation)
   */
  static async updateUserNotificationPreferences(
    userId: string,
    preferences: Partial<UserNotificationPreferences>
  ): Promise<UserNotificationPreferences> {
    // This would integrate with user preferences system
    const current = await this.getUserNotificationPreferences(userId);
    return { ...current, ...preferences };
  }

  /**
   * Check if user has exceeded notification limits
   */
  static async checkNotificationLimits(
    userId: string,
    timeWindowHours: number = 1
  ): Promise<{
    withinLimits: boolean;
    currentCount: number;
    limit: number;
    resetTime: Date;
  }> {
    const preferences = await this.getUserNotificationPreferences(userId);
    const frequency = await this.getNotificationFrequency(userId, timeWindowHours);
    
    const currentCount = Math.round(frequency.notificationsPerHour * timeWindowHours);
    const limit = Math.round(preferences.maxNotificationsPerHour * timeWindowHours);
    
    return {
      withinLimits: currentCount < limit,
      currentCount,
      limit,
      resetTime: new Date(Date.now() + timeWindowHours * 60 * 60 * 1000)
    };
  }

  /**
   * Get notification insights for a user
   */
  static async getNotificationInsights(userId: string): Promise<{
    summary: NotificationSummary;
    deliveryRate: Awaited<ReturnType<typeof NotificationManager.getNotificationDeliveryRate>>;
    frequency: Awaited<ReturnType<typeof NotificationManager.getNotificationFrequency>>;
    limits: Awaited<ReturnType<typeof NotificationManager.checkNotificationLimits>>;
    recommendations: string[];
  }> {
    const [summary, deliveryRate, frequency, limits] = await Promise.all([
      this.getUserNotificationSummary(userId),
      this.getNotificationDeliveryRate(userId),
      this.getNotificationFrequency(userId),
      this.checkNotificationLimits(userId)
    ]);

    const recommendations: string[] = [];

    // Generate recommendations based on data
    if (deliveryRate.deliveryRate < 0.8) {
      recommendations.push('Consider checking your device notification settings - delivery rate is below 80%');
    }

    if (frequency.notificationsPerHour > 5) {
      recommendations.push('You may be receiving too many notifications - consider adjusting your task locations or muting some tasks');
    }

    if (summary.activeSnoozes > 10) {
      recommendations.push('You have many snoozed notifications - consider completing or muting some tasks');
    }

    if (summary.failedNotifications > summary.deliveredNotifications * 0.2) {
      recommendations.push('High failure rate detected - check your internet connection and notification permissions');
    }

    return {
      summary,
      deliveryRate,
      frequency,
      limits,
      recommendations
    };
  }
}