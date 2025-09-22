import { GeofenceEvent } from '../models/GeofenceEvent';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { Place } from '../models/Place';
import { Geofence } from '../models/Geofence';
import { 
  GeofenceType, 
  POICategory, 
  Coordinate,
  TimeRange,
  NotificationStyle 
} from '../models/types';
import { ValidationError } from '../models/validation';
import { NotificationTemplates } from './notificationTemplates';

export type NotificationType = 'approach' | 'arrival' | 'post_arrival';
export type NotificationActionType = 'complete' | 'snooze_15m' | 'snooze_1h' | 'snooze_today' | 'open_map' | 'mute';
export type SnoozeDuration = '15m' | '1h' | 'today';

export interface NotificationAction {
  id: string;
  title: string;
  type: NotificationActionType;
  destructive?: boolean;
}

export interface LocationNotification {
  id: string;
  taskId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  actions: NotificationAction[];
  scheduledTime: Date;
  bundled?: boolean;
  bundleId?: string;
  metadata: {
    geofenceId: string;
    geofenceType: GeofenceType;
    location: Coordinate;
    placeName?: string;
    category?: POICategory;
    distance?: number;
  };
}

export interface NotificationBundle {
  id: string;
  userId: string;
  notifications: LocationNotification[];
  title: string;
  body: string;
  actions: NotificationAction[];
  location: Coordinate;
  radius: number;
  scheduledTime: Date;
}

export interface NotificationTemplate {
  title: string;
  body: string;
  actions: NotificationAction[];
}

export interface NotificationDeliveryResult {
  success: boolean;
  notificationId: string;
  error?: string;
  deliveredAt?: Date;
}

export class NotificationService {
  // Standard notification actions
  private static readonly STANDARD_ACTIONS: Record<NotificationActionType, NotificationAction> = {
    complete: {
      id: 'complete',
      title: 'Complete',
      type: 'complete'
    },
    snooze_15m: {
      id: 'snooze_15m',
      title: 'Snooze 15m',
      type: 'snooze_15m'
    },
    snooze_1h: {
      id: 'snooze_1h',
      title: 'Snooze 1h',
      type: 'snooze_1h'
    },
    snooze_today: {
      id: 'snooze_today',
      title: 'Snooze Today',
      type: 'snooze_today'
    },
    open_map: {
      id: 'open_map',
      title: 'Open Map',
      type: 'open_map'
    },
    mute: {
      id: 'mute',
      title: 'Mute',
      type: 'mute',
      destructive: true
    }
  };

  // Quiet hours check tolerance (minutes)
  private static readonly QUIET_HOURS_TOLERANCE = 5;

  /**
   * Create notification for a geofence event
   */
  static async createNotificationForEvent(event: GeofenceEvent): Promise<LocationNotification> {
    // Get related entities
    const [task, user, geofence] = await Promise.all([
      Task.findById(event.task_id),
      User.findById(event.user_id),
      Geofence.findById(event.geofence_id)
    ]);

    if (!task || !user || !geofence) {
      throw new ValidationError('Required entities not found for notification', []);
    }

    // Determine notification type from geofence type
    const notificationType = this.getNotificationTypeFromGeofence(geofence.geofence_type);

    // Get place information if applicable
    let place: Place | null = null;
    if (task.location_type === 'custom_place' && task.place_id) {
      place = await Place.findById(task.place_id);
    }

    // Generate notification template
    const template = await this.generateNotificationTemplate(
      notificationType,
      task,
      geofence,
      place,
      event.location,
      user.preferences.notificationStyle
    );

    // Create notification object
    const notification: LocationNotification = {
      id: `notification_${event.id}`,
      taskId: task.id,
      userId: user.id,
      type: notificationType,
      title: template.title,
      body: template.body,
      actions: template.actions,
      scheduledTime: new Date(),
      metadata: {
        geofenceId: geofence.id,
        geofenceType: geofence.geofence_type,
        location: event.location,
        placeName: place?.name,
        category: task.poi_category,
        distance: geofence.calculateDistance(event.location)
      }
    };

    return notification;
  }

  /**
   * Schedule notification delivery
   */
  static async scheduleNotification(notification: LocationNotification): Promise<void> {
    // Check if user is in quiet hours
    const user = await User.findById(notification.userId);
    if (!user) {
      throw new ValidationError('User not found', []);
    }

    const shouldRespectQuietHours = this.respectQuietHours(notification, user.preferences.quietHours);
    if (!shouldRespectQuietHours) {
      // Queue notification for after quiet hours
      const nextDeliveryTime = this.calculateNextDeliveryTime(user.preferences.quietHours);
      notification.scheduledTime = nextDeliveryTime;
    }

    // TODO: Integrate with actual push notification service (APNs/FCM)
    // For now, we'll simulate scheduling
    console.log(`Scheduling notification ${notification.id} for ${notification.scheduledTime}`);
  }

  /**
   * Cancel scheduled notification
   */
  static async cancelNotification(notificationId: string): Promise<void> {
    // TODO: Integrate with actual push notification service
    console.log(`Cancelling notification ${notificationId}`);
  }

  /**
   * Handle notification action
   */
  static async handleNotificationAction(
    notificationId: string,
    actionType: NotificationActionType,
    userId: string
  ): Promise<void> {
    // Extract task ID from notification ID
    const taskId = notificationId.replace('notification_', '').split('_')[0];
    
    switch (actionType) {
      case 'complete':
        await this.handleCompleteAction(taskId, userId);
        break;
      case 'snooze_15m':
      case 'snooze_1h':
      case 'snooze_today':
        await this.handleSnoozeAction(taskId, userId, actionType);
        break;
      case 'open_map':
        await this.handleOpenMapAction(taskId, userId);
        break;
      case 'mute':
        await this.handleMuteAction(taskId, userId);
        break;
      default:
        throw new ValidationError(`Unknown action type: ${actionType}`, []);
    }
  }

  /**
   * Bundle notifications for dense POI areas
   */
  static async bundleNotifications(notifications: LocationNotification[]): Promise<NotificationBundle[]> {
    if (notifications.length === 0) return [];

    const bundles: NotificationBundle[] = [];
    const processedNotifications = new Set<string>();
    const BUNDLE_RADIUS = 500; // 500 meters

    for (const notification of notifications) {
      if (processedNotifications.has(notification.id)) continue;

      // Find nearby notifications to bundle
      const nearbyNotifications = notifications.filter(n => {
        if (processedNotifications.has(n.id) || n.id === notification.id) return false;
        if (n.userId !== notification.userId) return false;
        
        const distance = this.calculateDistance(
          notification.metadata.location,
          n.metadata.location
        );
        return distance <= BUNDLE_RADIUS;
      });

      if (nearbyNotifications.length > 0) {
        // Create bundle
        const bundleNotifications = [notification, ...nearbyNotifications];
        const bundle = await this.createNotificationBundle(bundleNotifications);
        bundles.push(bundle);

        // Mark notifications as processed
        bundleNotifications.forEach(n => {
          processedNotifications.add(n.id);
          n.bundled = true;
          n.bundleId = bundle.id;
        });
      } else {
        // Single notification
        processedNotifications.add(notification.id);
      }
    }

    return bundles;
  }

  /**
   * Check if notification should respect quiet hours
   */
  static respectQuietHours(notification: LocationNotification, quietHours?: TimeRange): boolean {
    if (!quietHours) return true;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Simple time range check (doesn't handle overnight ranges)
    if (quietHours.start <= quietHours.end) {
      return currentTime < quietHours.start || currentTime > quietHours.end;
    } else {
      // Overnight range (e.g., 22:00 to 07:00)
      return currentTime > quietHours.end && currentTime < quietHours.start;
    }
  }

  /**
   * Generate notification template based on type and context
   */
  private static async generateNotificationTemplate(
    type: NotificationType,
    task: Task,
    geofence: Geofence,
    place: Place | null,
    location: Coordinate,
    style: NotificationStyle
  ): Promise<NotificationTemplate> {
    const distance = geofence.calculateDistance(location);
    const locationName = this.getLocationName(task, place);
    
    const context = {
      taskTitle: task.title,
      taskDescription: task.description,
      locationName,
      distance,
      style
    };

    let template: NotificationTemplate;

    switch (type) {
      case 'approach':
        template = NotificationTemplates.generateApproachTemplate(context);
        break;
      case 'arrival':
        template = NotificationTemplates.generateArrivalTemplate(context);
        break;
      case 'post_arrival':
        template = NotificationTemplates.generatePostArrivalTemplate(context);
        break;
      default:
        throw new ValidationError(`Unknown notification type: ${type}`, []);
    }

    return template;
  }

  /**
   * Get notification type from geofence type
   */
  private static getNotificationTypeFromGeofence(geofenceType: GeofenceType): NotificationType {
    switch (geofenceType) {
      case 'approach_5mi':
      case 'approach_3mi':
      case 'approach_1mi':
        return 'approach';
      case 'arrival':
        return 'arrival';
      case 'post_arrival':
        return 'post_arrival';
      default:
        return 'arrival';
    }
  }

  /**
   * Get location name for display
   */
  private static getLocationName(task: Task, place: Place | null): string {
    if (task.location_type === 'custom_place' && place) {
      return place.name;
    } else if (task.location_type === 'poi_category' && task.poi_category) {
      return this.getCategoryDisplayName(task.poi_category);
    }
    return 'location';
  }

  /**
   * Get display name for POI category
   */
  private static getCategoryDisplayName(category: POICategory): string {
    return NotificationTemplates.getCategoryDisplayName(category);
  }

  /**
   * Create notification bundle
   */
  private static async createNotificationBundle(notifications: LocationNotification[]): Promise<NotificationBundle> {
    const centerLocation = this.calculateCenterPoint(
      notifications.map(n => n.metadata.location)
    );

    const taskCount = new Set(notifications.map(n => n.taskId)).size;
    const template = NotificationTemplates.generateBundleTemplate(
      taskCount,
      notifications.length,
      'this area', // Generic location name for bundles
      notifications[0].userId ? 'standard' : 'standard' // Default to standard style
    );

    return {
      id: `bundle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: notifications[0].userId,
      notifications,
      title: template.title,
      body: template.body,
      actions: template.actions,
      location: centerLocation,
      radius: 500,
      scheduledTime: new Date()
    };
  }

  /**
   * Calculate center point of coordinates
   */
  private static calculateCenterPoint(coordinates: Coordinate[]): Coordinate {
    if (coordinates.length === 0) {
      return { latitude: 0, longitude: 0 };
    }

    const sum = coordinates.reduce(
      (acc, coord) => ({
        latitude: acc.latitude + coord.latitude,
        longitude: acc.longitude + coord.longitude
      }),
      { latitude: 0, longitude: 0 }
    );

    return {
      latitude: sum.latitude / coordinates.length,
      longitude: sum.longitude / coordinates.length
    };
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private static calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = coord1.latitude * Math.PI / 180;
    const φ2 = coord2.latitude * Math.PI / 180;
    const Δφ = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const Δλ = (coord2.longitude - coord1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Calculate next delivery time after quiet hours
   */
  private static calculateNextDeliveryTime(quietHours?: TimeRange): Date {
    if (!quietHours) return new Date();

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Parse end time
    const [endHour, endMinute] = quietHours.end.split(':').map(Number);
    
    const nextDelivery = new Date(now);
    nextDelivery.setHours(endHour, endMinute + this.QUIET_HOURS_TOLERANCE, 0, 0);

    // If end time is tomorrow (overnight quiet hours)
    if (quietHours.start > quietHours.end) {
      if (now.getHours() >= parseInt(quietHours.start.split(':')[0])) {
        nextDelivery.setDate(nextDelivery.getDate() + 1);
      }
    }

    return nextDelivery;
  }

  /**
   * Handle complete action
   */
  private static async handleCompleteAction(taskId: string, userId: string): Promise<void> {
    const task = await Task.findById(taskId, userId);
    if (!task) {
      throw new ValidationError('Task not found', []);
    }

    await task.complete();
  }

  /**
   * Handle snooze action
   */
  private static async handleSnoozeAction(
    taskId: string, 
    userId: string, 
    snoozeType: 'snooze_15m' | 'snooze_1h' | 'snooze_today'
  ): Promise<void> {
    // TODO: Implement snooze functionality
    // This would involve storing snooze state and preventing notifications
    // until the snooze period expires
    console.log(`Snoozing task ${taskId} for ${snoozeType}`);
  }

  /**
   * Handle open map action
   */
  private static async handleOpenMapAction(taskId: string, userId: string): Promise<void> {
    // This would typically return deep link information for the mobile app
    // to open the map view for the task location
    console.log(`Opening map for task ${taskId}`);
  }

  /**
   * Handle mute action
   */
  private static async handleMuteAction(taskId: string, userId: string): Promise<void> {
    const task = await Task.findById(taskId, userId);
    if (!task) {
      throw new ValidationError('Task not found', []);
    }

    await task.mute();
  }
}