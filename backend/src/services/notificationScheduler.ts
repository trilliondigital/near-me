import { LocationNotification, NotificationBundle } from './notificationService';
import { User } from '../models/User';
import { TimeRange } from '../models/types';
import { ValidationError } from '../models/validation';
import { MockAPNsService } from './apnsService';

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
   * Check if user is in focus mode
   * This integrates with device APIs to check focus/DND status
   */
  private static async checkFocusMode(userId: string): Promise<boolean> {
    try {
      // In a real implementation, this would:
      // 1. Check iOS Focus modes via device API
      // 2. Check Android Do Not Disturb status
      // 3. Check custom app-level focus settings
      
      // For now, we'll simulate checking user preferences for focus mode
      const user = await User.findById(userId);
      if (!user) return false;
      
      // Check if user has enabled focus mode respect
      const focusModeEnabled = this.config.focusModeRespect;
      if (!focusModeEnabled) return false;
      
      // Check if user is currently in a focus session
      // This would typically come from device APIs or user activity tracking
      const currentFocusSession = await this.getCurrentFocusSession(userId);
      
      return currentFocusSession?.active || false;
    } catch (error) {
      console.error('Error checking focus mode:', error);
      return false; // Default to not in focus mode on error
    }
  }

  /**
   * Get current focus session for user (mock implementation)
   * In production, this would integrate with device focus APIs
   */
  private static async getCurrentFocusSession(userId: string): Promise<{ active: boolean; type?: string; endTime?: Date } | null> {
    // Mock implementation - in production this would:
    // 1. Query device focus state APIs
    // 2. Check user's custom focus sessions
    // 3. Consider calendar events, meetings, etc.
    
    // For now, simulate occasional focus sessions for testing
    const now = new Date();
    const hour = now.getHours();
    
    // Simulate focus mode during typical work hours (9 AM - 5 PM)
    if (hour >= 9 && hour < 17) {
      // 20% chance of being in focus mode during work hours
      if (Math.random() < 0.2) {
        return {
          active: true,
          type: 'work',
          endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 hours from now
        };
      }
    }
    
    return null;
  }

  /**
   * Send push notification via APNs
   */
  private static async sendPushNotification(
    notification: LocationNotification | NotificationBundle
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get user's push token
      const user = await User.findById(notification.userId);
      if (!user || !user.push_token || !user.push_token.isActive) {
        return {
          success: false,
          error: 'User has no active push token'
        };
      }

      // Create APNs payload
      const isLocation = 'type' in notification;
      const payload = {
        aps: {
          alert: {
            title: notification.title,
            body: notification.body
          },
          sound: 'default',
          category: 'LOCATION_REMINDER'
        },
        task_id: isLocation ? (notification as any).taskId : undefined,
        notification_id: notification.id,
        action_type: isLocation ? (notification as any).type : 'bundle'
      };

      // Send via APNs (using mock service for now)
      const result = await MockAPNsService.sendNotification(
        user.push_token.deviceToken,
        payload
      );

      if (result.success) {
        console.log(`Notification delivered successfully: ${notification.id}`);
        return { success: true };
      } else {
        console.error(`Notification delivery failed: ${result.error}`);
        return {
          success: false,
          error: result.error || 'Unknown APNs error'
        };
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
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