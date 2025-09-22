import { NotificationService } from '../notificationService';
import { NotificationScheduler } from '../notificationScheduler';
import { NotificationTemplates } from '../notificationTemplates';

describe('Notification System Integration', () => {
  beforeEach(() => {
    // Clear any scheduled notifications
    (NotificationScheduler as any).scheduledNotifications.clear();
    
    // Mock console.log to avoid test output noise
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('End-to-End Notification Flow', () => {
    it('should create, format, and schedule a notification', async () => {
      // Test notification templates
      const context = {
        taskTitle: 'Buy groceries',
        taskDescription: 'Get milk and bread',
        locationName: 'Safeway',
        distance: 8047, // 5 miles
        style: 'standard' as const
      };

      const template = NotificationTemplates.generateApproachTemplate(context);
      
      expect(template.title).toBe('Approaching Safeway');
      expect(template.body).toBe('You\'re 5 miles from Safeway — Buy groceries?');
      expect(template.actions).toHaveLength(4);

      // Test notification scheduling
      const mockNotification = {
        id: 'test-notification-1',
        taskId: 'task-1',
        userId: 'user-1',
        type: 'approach' as const,
        title: template.title,
        body: template.body,
        actions: template.actions,
        scheduledTime: new Date(),
        metadata: {
          geofenceId: 'geofence-1',
          geofenceType: 'approach_5mi' as const,
          location: { latitude: 37.7749, longitude: -122.4194 }
        }
      };

      // Mock successful delivery
      jest.spyOn(NotificationScheduler as any, 'sendPushNotification')
        .mockResolvedValue({ success: true });

      const scheduled = await NotificationScheduler.scheduleNotification(mockNotification);

      expect(scheduled.notification).toBe(mockNotification);
      expect(scheduled.status).toBe('delivered'); // Should be delivered immediately
      expect(scheduled.userId).toBe('user-1');
    });

    it('should handle notification bundling', async () => {
      const notifications = [
        {
          id: 'notification-1',
          taskId: 'task-1',
          userId: 'user-1',
          type: 'approach' as const,
          title: 'Approaching Safeway',
          body: 'Buy groceries?',
          actions: [],
          scheduledTime: new Date(),
          metadata: {
            geofenceId: 'geofence-1',
            geofenceType: 'approach_5mi' as const,
            location: { latitude: 37.7749, longitude: -122.4194 }
          }
        },
        {
          id: 'notification-2',
          taskId: 'task-2',
          userId: 'user-1',
          type: 'approach' as const,
          title: 'Approaching Bank',
          body: 'Deposit check?',
          actions: [],
          scheduledTime: new Date(),
          metadata: {
            geofenceId: 'geofence-2',
            geofenceType: 'approach_5mi' as const,
            location: { latitude: 37.7750, longitude: -122.4195 } // ~100m away
          }
        }
      ];

      const bundles = await NotificationService.bundleNotifications(notifications);

      expect(bundles).toHaveLength(1);
      expect(bundles[0].notifications).toHaveLength(2);
      expect(bundles[0].title).toBe('2 reminders nearby');
      expect(bundles[0].body).toBe('You have 2 reminders for 2 tasks in this area');
    });

    it('should format distances correctly', () => {
      // Test mile formatting
      const milesResult = NotificationTemplates.formatDistance(8047); // 5 miles
      expect(milesResult.display).toBe('5 miles');

      // Test meter formatting
      const metersResult = NotificationTemplates.formatDistance(500);
      expect(metersResult.display).toBe('500m');

      // Test very close formatting
      const closeResult = NotificationTemplates.formatDistance(50);
      expect(closeResult.display).toBe('very close');
    });

    it('should generate appropriate actions for different notification types', () => {
      const baseContext = {
        taskTitle: 'Test task',
        locationName: 'Test location',
        style: 'standard' as const
      };

      // Approach notification
      const approachTemplate = NotificationTemplates.generateApproachTemplate(baseContext);
      const approachActions = approachTemplate.actions.map(a => a.type);
      expect(approachActions).toContain('complete');
      expect(approachActions).toContain('snooze_15m');
      expect(approachActions).toContain('open_map');
      expect(approachActions).toContain('mute');

      // Arrival notification
      const arrivalTemplate = NotificationTemplates.generateArrivalTemplate(baseContext);
      const arrivalActions = arrivalTemplate.actions.map(a => a.type);
      expect(arrivalActions).toContain('complete');
      expect(arrivalActions).toContain('snooze_15m');
      expect(arrivalActions).toContain('snooze_1h');
      expect(arrivalActions).toContain('mute');

      // Post-arrival notification
      const postArrivalTemplate = NotificationTemplates.generatePostArrivalTemplate(baseContext);
      const postArrivalActions = postArrivalTemplate.actions.map(a => a.type);
      expect(postArrivalActions).toContain('complete');
      expect(postArrivalActions).toContain('snooze_1h');
      expect(postArrivalActions).toContain('snooze_today');
      expect(postArrivalActions).toContain('mute');
    });

    it('should respect notification style preferences', () => {
      const baseContext = {
        taskTitle: 'Buy groceries',
        taskDescription: 'Get milk and bread',
        locationName: 'Safeway',
        distance: 8047,
        style: 'detailed' as const
      };

      const detailedTemplate = NotificationTemplates.generateApproachTemplate(baseContext);
      expect(detailedTemplate.body).toContain('Get milk and bread');

      const minimalContext = { ...baseContext, style: 'minimal' as const };
      const minimalTemplate = NotificationTemplates.generateApproachTemplate(minimalContext);
      expect(minimalTemplate.actions).toHaveLength(2); // Limited actions for minimal style
    });

    it('should handle POI category display names', () => {
      expect(NotificationTemplates.getCategoryDisplayName('gas')).toBe('gas station');
      expect(NotificationTemplates.getCategoryDisplayName('pharmacy')).toBe('pharmacy');
      expect(NotificationTemplates.getCategoryDisplayName('grocery')).toBe('grocery store');
      expect(NotificationTemplates.getCategoryDisplayName('bank')).toBe('bank');
      expect(NotificationTemplates.getCategoryDisplayName('post_office')).toBe('post office');
    });

    it('should validate notification context', () => {
      const validContext = {
        taskTitle: 'Test task',
        locationName: 'Test location',
        style: 'standard' as const
      };

      expect(() => NotificationTemplates.validateContext(validContext)).not.toThrow();

      const invalidContext = {
        taskTitle: '',
        locationName: 'Test location',
        style: 'standard' as const
      };

      expect(() => NotificationTemplates.validateContext(invalidContext)).toThrow('Task title is required');
    });
  });

  describe('Scheduler Statistics', () => {
    it('should track notification statistics correctly', async () => {
      const mockNotification = {
        id: 'stats-test-notification',
        taskId: 'task-1',
        userId: 'user-1',
        type: 'approach' as const,
        title: 'Test',
        body: 'Test body',
        actions: [],
        scheduledTime: new Date(),
        metadata: {
          geofenceId: 'geofence-1',
          geofenceType: 'approach_5mi' as const,
          location: { latitude: 37.7749, longitude: -122.4194 }
        }
      };

      // Mock successful delivery
      jest.spyOn(NotificationScheduler as any, 'sendPushNotification')
        .mockResolvedValue({ success: true });

      await NotificationScheduler.scheduleNotification(mockNotification);

      const stats = NotificationScheduler.getStats();
      expect(stats.totalScheduled).toBeGreaterThanOrEqual(0);
      expect(stats.delivered + stats.pending + stats.failed + stats.cancelled).toBe(stats.totalScheduled);
    });
  });

  describe('Error Handling', () => {
    it('should handle template validation errors', () => {
      expect(() => {
        NotificationTemplates.generateApproachTemplate({
          taskTitle: '',
          locationName: 'Test',
          style: 'standard'
        });
      }).toThrow();
    });

    it('should handle unknown POI categories gracefully', () => {
      const result = NotificationTemplates.getCategoryDisplayName('unknown_category' as any);
      expect(result).toBe('unknown_category');
    });
  });
});