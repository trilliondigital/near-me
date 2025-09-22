import { NotificationStyle, POICategory } from '../models/types';
import { NotificationAction, NotificationType } from './notificationService';

export interface NotificationTemplateContext {
  taskTitle: string;
  taskDescription?: string;
  locationName: string;
  distance?: number;
  distanceUnit?: 'miles' | 'meters';
  style: NotificationStyle;
}

export interface NotificationTemplate {
  title: string;
  body: string;
  actions: NotificationAction[];
}

export class NotificationTemplates {
  // Standard notification actions
  private static readonly ACTIONS = {
    complete: {
      id: 'complete',
      title: 'Complete',
      type: 'complete' as const
    },
    snooze_15m: {
      id: 'snooze_15m',
      title: 'Snooze 15m',
      type: 'snooze_15m' as const
    },
    snooze_1h: {
      id: 'snooze_1h',
      title: 'Snooze 1h',
      type: 'snooze_1h' as const
    },
    snooze_today: {
      id: 'snooze_today',
      title: 'Snooze Today',
      type: 'snooze_today' as const
    },
    open_map: {
      id: 'open_map',
      title: 'Open Map',
      type: 'open_map' as const
    },
    mute: {
      id: 'mute',
      title: 'Mute',
      type: 'mute' as const,
      destructive: true
    }
  };

  /**
   * Generate approach notification template
   */
  static generateApproachTemplate(context: NotificationTemplateContext): NotificationTemplate {
    const { taskTitle, locationName, distance, style } = context;
    
    let title: string;
    let body: string;

    if (distance && distance > 1609) { // More than 1 mile
      const miles = Math.round(distance / 1609.34 * 10) / 10;
      title = `Approaching ${locationName}`;
      body = `You're ${miles} miles from ${locationName} — ${taskTitle}?`;
    } else {
      title = `Near ${locationName}`;
      body = `You're close to ${locationName} — ${taskTitle}?`;
    }

    // Adjust body based on style
    if (style === 'detailed' && context.taskDescription) {
      body += `\n${context.taskDescription}`;
    }

    const actions = this.getActionsForType('approach', style);

    return { title, body, actions };
  }

  /**
   * Generate arrival notification template
   */
  static generateArrivalTemplate(context: NotificationTemplateContext): NotificationTemplate {
    const { taskTitle, locationName, style } = context;
    
    const title = `Arrived at ${locationName}`;
    let body = `Arriving at ${locationName} — ${taskTitle} now?`;

    // Adjust body based on style
    if (style === 'detailed' && context.taskDescription) {
      body += `\n${context.taskDescription}`;
    } else if (style === 'minimal') {
      body = `${taskTitle} now?`;
    }

    const actions = this.getActionsForType('arrival', style);

    return { title, body, actions };
  }

  /**
   * Generate post-arrival notification template
   */
  static generatePostArrivalTemplate(context: NotificationTemplateContext): NotificationTemplate {
    const { taskTitle, locationName, style } = context;
    
    const title = `Still at ${locationName}`;
    let body = `Still need to ${taskTitle.toLowerCase()}?`;

    // Adjust body based on style
    if (style === 'detailed' && context.taskDescription) {
      body += `\n${context.taskDescription}`;
    } else if (style === 'standard') {
      body = `Still at ${locationName} — ${taskTitle.toLowerCase()}?`;
    }

    const actions = this.getActionsForType('post_arrival', style);

    return { title, body, actions };
  }

  /**
   * Generate bundle notification template
   */
  static generateBundleTemplate(
    taskCount: number,
    reminderCount: number,
    locationName: string,
    style: NotificationStyle
  ): NotificationTemplate {
    const title = `${reminderCount} reminders nearby`;
    
    let body: string;
    if (taskCount === 1) {
      body = `You have ${reminderCount} reminders for this area`;
    } else {
      body = `You have ${reminderCount} reminders for ${taskCount} tasks in this area`;
    }

    if (style === 'detailed') {
      body += ` near ${locationName}`;
    }

    const actions = [
      this.ACTIONS.complete,
      this.ACTIONS.snooze_1h,
      this.ACTIONS.open_map,
      this.ACTIONS.mute
    ];

    return { title, body, actions };
  }

  /**
   * Get display name for POI category
   */
  static getCategoryDisplayName(category: POICategory): string {
    const displayNames: Record<POICategory, string> = {
      gas: 'gas station',
      pharmacy: 'pharmacy',
      grocery: 'grocery store',
      bank: 'bank',
      post_office: 'post office'
    };
    return displayNames[category] || category;
  }

  /**
   * Get appropriate actions for notification type and style
   */
  private static getActionsForType(type: NotificationType, style: NotificationStyle): NotificationAction[] {
    let actions: NotificationAction[];

    switch (type) {
      case 'approach':
        actions = [
          this.ACTIONS.complete,
          this.ACTIONS.snooze_15m,
          this.ACTIONS.open_map,
          this.ACTIONS.mute
        ];
        break;

      case 'arrival':
        actions = [
          this.ACTIONS.complete,
          this.ACTIONS.snooze_15m,
          this.ACTIONS.snooze_1h,
          this.ACTIONS.mute
        ];
        break;

      case 'post_arrival':
        actions = [
          this.ACTIONS.complete,
          this.ACTIONS.snooze_1h,
          this.ACTIONS.snooze_today,
          this.ACTIONS.mute
        ];
        break;

      default:
        actions = [this.ACTIONS.complete, this.ACTIONS.mute];
    }

    // Adjust based on style
    if (style === 'minimal') {
      return actions.slice(0, 2); // Only show first 2 actions
    }

    return actions;
  }

  /**
   * Validate template context
   */
  static validateContext(context: NotificationTemplateContext): void {
    if (!context.taskTitle) {
      throw new Error('Task title is required');
    }
    if (!context.locationName) {
      throw new Error('Location name is required');
    }
    if (!context.style) {
      throw new Error('Notification style is required');
    }
  }

  /**
   * Format distance for display
   */
  static formatDistance(distanceMeters: number): { value: number; unit: string; display: string } {
    if (distanceMeters >= 1609) { // 1 mile or more
      const miles = Math.round(distanceMeters / 1609.34 * 10) / 10;
      return {
        value: miles,
        unit: 'miles',
        display: `${miles} mile${miles !== 1 ? 's' : ''}`
      };
    } else if (distanceMeters >= 100) { // 100 meters or more
      const meters = Math.round(distanceMeters / 10) * 10; // Round to nearest 10m
      return {
        value: meters,
        unit: 'meters',
        display: `${meters}m`
      };
    } else {
      return {
        value: distanceMeters,
        unit: 'meters',
        display: 'very close'
      };
    }
  }
}