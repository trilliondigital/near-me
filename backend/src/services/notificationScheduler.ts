import { LocationNotification, NotificationBundle } from './notificationService';
import { User } from '../models/User';
import { TimeRange } from '../models/types';
import { ValidationError } from '../models/validation';

export interface ScheduledNotification {
  id: string;
  notification: LocationNotification | NotificationBundle;
  scheduledTime: Date;
  userId: string;
  status: 'pending' | 'delivered' | 'cancelled' | 'failed';
  attempts: number;
  lastAttempt?: Date;
  error?: string;
}

export interface NotificationSchedulerConfig {
  maxRetries: number;
  retryDelayMinutes: number;
  quietHoursToleranceMinutes: number;
  focusModeRespect: boolean;
}

export class NotificationScheduler {
  private static readonly DEFAULT_CONFIG: NotificationSchedulerConfig = {
    maxRetries: 3,
    retryDelayMinutes: 5,
    quietHoursToleranceMinutes: 5,
    focusModeRespect: true
  };

  private static scheduledNotifications = new Map<string, ScheduledNotification>();
  private static config: NotificationSchedulerConfig = this.DEFAULT_CONFIG;

  /**
   * Configure the scheduler
   */
  static configure(config: Partial<NotificationSchedulerConfig>): void {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  /**
   * Schedule a notification for delivery
   */
  static async scheduleNotification(
    notification: LocationNotification | NotificationBundle
  ): Promise<ScheduledNotification> {
    const user = await User.findById(notification.userId);
    if (!user) {
      throw new ValidationError('User not found', []);
    }

    // Determine delivery time based on user preferences
    const deliveryTime = await this.calculateDeliveryTime(notification, user);

    const scheduled: ScheduledNotification = {
      id: `scheduled_${notification.id}`,
      notification,
      scheduledTime: deliveryTime,
      userId: notification.userId,
      status: 'pending',
      attempts: 0
    };

    this.scheduledNotifications.set(scheduled.id, scheduled);

    // If delivery time is now or in the past, try to deliver immediately
    if (deliveryTime <= new Date()) {
      const delivered = await this.deliverNotification(scheduled.id);
      if (delivered) {
        scheduled.status = 'delivered';
      }
    }

    return scheduled;
  }

  /**
   * Cancel a scheduled notification
   */
  static async cancelNotification(scheduledId: string): Promise<boolean> {
    const scheduled = this.scheduledNotifications.get(scheduledId);
    if (!scheduled) {
      return false;
    }

    scheduled.status = 'cancelled';
    this.scheduledNotifications.delete(scheduledId);
    return true;
  }

  /**
   * Deliver a notification immediately
   */
  static async deliverNotification(scheduledId: string): Promise<boolean> {
    const scheduled = this.scheduledNotifications.get(scheduledId);
    if (!scheduled || scheduled.status !== 'pending') {
      return false;
    }

    try {
      scheduled.attempts++;
      scheduled.lastAttempt = new Date();

      // Check if user is still in quiet hours or focus mode
      const user = await User.findById(scheduled.userId);
      if (!user) {
        scheduled.status = 'failed';
        scheduled.error = 'User not found';
        return false;
      }

      const canDeliver = await this.canDeliverNow(scheduled.notification, user);
      if (!canDeliver.allowed) {
        // Reschedule for later
        scheduled.scheduledTime = canDeliver.nextDeliveryTime || 
          new Date(Date.now() + this.config.retryDelayMinutes * 60 * 1000);
        return false;
      }

      // Simulate notification delivery (integrate with APNs/FCM here)
      const deliveryResult = await this.sendPushNotification(scheduled.notification);
      
      if (deliveryResult.success) {
        scheduled.status = 'delivered';
        this.scheduledNotifications.delete(scheduledId);
        return true;
      } else {
        scheduled.error = deliveryResult.error;
        
        // Retry if under max attempts
        if (scheduled.attempts < this.config.maxRetries) {
          scheduled.scheduledTime = new Date(
            Date.now() + this.config.retryDelayMinutes * 60 * 1000
          );
          return false;
        } else {
          scheduled.status = 'failed';
          return false;
        }
      }
    } catch (error) {
      scheduled.status = 'failed';
      scheduled.error = error instanceof Error ? error.message : 'Unknown error';
      return false;
    }
  }

  /**
   * Process all pending notifications
   */
  static async processPendingNotifications(): Promise<{
    processed: number;
    delivered: number;
    failed: number;
    rescheduled: number;
  }> {
    const now = new Date();
    const stats = { processed: 0, delivered: 0, failed: 0, rescheduled: 0 };

    for (const [id, scheduled] of this.scheduledNotifications.entries()) {
      if (scheduled.status !== 'pending' || scheduled.scheduledTime > now) {
        continue;
      }

      stats.processed++;
      const delivered = await this.deliverNotification(id);
      
      const currentScheduled = this.scheduledNotifications.get(id);
      if (delivered) {
        stats.delivered++;
      } else if (currentScheduled && currentScheduled.status === 'failed') {
        stats.failed++;
      } else {
        stats.rescheduled++;
      }
    }

    return stats;
  }

  /**
   * Get scheduled notifications for a user
   */
  static getScheduledNotifications(userId: string): ScheduledNotification[] {
    return Array.from(this.scheduledNotifications.values())
      .filter(scheduled => scheduled.userId === userId);
  }

  /**
   * Get all scheduled notifications (admin function)
   */
  static getAllScheduledNotifications(): ScheduledNotification[] {
    return Array.from(this.scheduledNotifications.values());
  }

  /**
   * Clean up old notifications
   */
  static cleanupOldNotifications(olderThanHours: number = 24): number {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [id, scheduled] of this.scheduledNotifications.entries()) {
      if (scheduled.scheduledTime < cutoff && 
          (scheduled.status === 'delivered' || scheduled.status === 'failed' || scheduled.status === 'cancelled')) {
        this.scheduledNotifications.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Calculate when notification should be delivered
   */
  private static async calculateDeliveryTime(
    notification: LocationNotification | NotificationBundle,
    user: User
  ): Promise<Date> {
    const now = new Date();
    
    // Check quiet hours
    if (user.preferences.quietHours) {
      const inQuietHours = this.isInQuietHours(now, user.preferences.quietHours);
      if (inQuietHours) {
        return this.calculateNextDeliveryTime(user.preferences.quietHours);
      }
    }

    // Check focus mode (would integrate with device focus state)
    // For now, we'll assume focus mode is not active
    
    return now;
  }

  /**
   * Check if notification can be delivered now
   */
  private static async canDeliverNow(
    notification: LocationNotification | NotificationBundle,
    user: User
  ): Promise<{ allowed: boolean; reason?: string; nextDeliveryTime?: Date }> {
    const now = new Date();

    // Check quiet hours
    if (user.preferences.quietHours) {
      const inQuietHours = this.isInQuietHours(now, user.preferences.quietHours);
      if (inQuietHours) {
        return {
          allowed: false,
          reason: 'User is in quiet hours',
          nextDeliveryTime: this.calculateNextDeliveryTime(user.preferences.quietHours)
        };
      }
    }

    // Check focus mode (would integrate with device APIs)
    if (this.config.focusModeRespect) {
      const inFocusMode = await this.checkFocusMode(user.id);
      if (inFocusMode) {
        return {
          allowed: false,
          reason: 'User is in focus mode',
          nextDeliveryTime: new Date(now.getTime() + 30 * 60 * 1000) // Retry in 30 minutes
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if current time is in quiet hours
   */
  private static isInQuietHours(now: Date, quietHours: TimeRange): boolean {
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    
    const [startHour, startMinute] = quietHours.start.split(':').map(Number);
    const [endHour, endMinute] = quietHours.end.split(':').map(Number);
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;
    
    if (startTimeMinutes <= endTimeMinutes) {
      // Same day range (e.g., 09:00 to 17:00)
      return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
    } else {
      // Overnight range (e.g., 22:00 to 07:00)
      return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes;
    }
  }

  /**
   * Calculate next delivery time after quiet hours
   */
  private static calculateNextDeliveryTime(quietHours: TimeRange): Date {
    const now = new Date();
    const [endHour, endMinute] = quietHours.end.split(':').map(Number);
    
    const nextDelivery = new Date(now);
    nextDelivery.setHours(endHour, endMinute + this.config.quietHoursToleranceMinutes, 0, 0);

    // If end time is tomorrow (overnight quiet hours)
    if (quietHours.start > quietHours.end) {
      if (now.getHours() >= parseInt(quietHours.start.split(':')[0])) {
        nextDelivery.setDate(nextDelivery.getDate() + 1);
      }
    }

    // If calculated time is in the past, add a day
    if (nextDelivery <= now) {
      nextDelivery.setDate(nextDelivery.getDate() + 1);
    }

    return nextDelivery;
  }

  /**
   * Check if user is in focus mode (mock implementation)
   */
  private static async checkFocusMode(userId: string): Promise<boolean> {
    // This would integrate with device APIs to check focus/DND status
    // For now, return false (not in focus mode)
    return false;
  }

  /**
   * Send push notification (mock implementation)
   */
  private static async sendPushNotification(
    notification: LocationNotification | NotificationBundle
  ): Promise<{ success: boolean; error?: string }> {
    // This would integrate with APNs/FCM
    // For now, simulate successful delivery
    console.log(`Delivering notification: ${notification.title}`);
    
    // Simulate occasional failures for testing
    if (Math.random() < 0.05) { // 5% failure rate
      return {
        success: false,
        error: 'Push service temporarily unavailable'
      };
    }

    return { success: true };
  }

  /**
   * Get scheduler statistics
   */
  static getStats(): {
    totalScheduled: number;
    pending: number;
    delivered: number;
    failed: number;
    cancelled: number;
  } {
    const stats = {
      totalScheduled: this.scheduledNotifications.size,
      pending: 0,
      delivered: 0,
      failed: 0,
      cancelled: 0
    };

    for (const scheduled of this.scheduledNotifications.values()) {
      stats[scheduled.status]++;
    }

    return stats;
  }
}