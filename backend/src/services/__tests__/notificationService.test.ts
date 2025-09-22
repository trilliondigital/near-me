import { NotificationService, LocationNotification, NotificationBundle } from '../notificationService';
import { GeofenceEvent } from '../../models/GeofenceEvent';
import { Task } from '../../models/Task';
import { User } from '../../models/User';
import { Place } from '../../models/Place';
import { Geofence } from '../../models/Geofence';

// Mock dependencies
jest.mock('../../models/GeofenceEvent');
jest.mock('../../models/Task');
jest.mock('../../models/User');
jest.mock('../../models/Place');
jest.mock('../../models/Geofence');

const mockGeofenceEvent = {
  id: 'event-1',
  user_id: 'user-1',
  task_id: 'task-1',
  geofence_id: 'geofence-1',
  event_type: 'enter',
  location: { latitude: 37.7749, longitude: -122.4194 },
  confidence: 0.9
} as any;

const mockTask = {
  id: 'task-1',
  user_id: 'user-1',
  title: 'Buy groceries',
  description: 'Get milk and bread',
  location_type: 'poi_category',
  poi_category: 'grocery',
  status: 'active'
} as any;

const mockUser = {
  id: 'user-1',
  preferences: {
    notificationStyle: 'standard',
    quietHours: { start: '22:00', end: '07:00' }
  }
} as any;

const mockGeofence = {
  id: 'geofence-1',
  task_id: 'task-1',
  latitude: 37.7749,
  longitude: -122.4194,
  radius: 1609, // 1 mile in meters
  geofence_type: 'approach_5mi',
  calculateDistance: jest.fn().mockReturnValue(8047) // 5 miles in meters
} as any;

const mockPlace = {
  id: 'place-1',
  name: 'Home',
  latitude: 37.7749,
  longitude: -122.4194
} as any;

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    (Task.findById as jest.Mock).mockResolvedValue(mockTask);
    (User.findById as jest.Mock).mockResolvedValue(mockUser);
    (Geofence.findById as jest.Mock).mockResolvedValue(mockGeofence);
    (Place.findById as jest.Mock).mockResolvedValue(null);
  });

  describe('createNotificationForEvent', () => {
    it('should create approach notification for POI category task', async () => {
      const notification = await NotificationService.createNotificationForEvent(mockGeofenceEvent);

      expect(notification).toMatchObject({
        id: 'notification_event-1',
        taskId: 'task-1',
        userId: 'user-1',
        type: 'approach',
        title: 'Approaching grocery store',
        body: 'You\'re 5 miles from grocery store — Buy groceries?'
      });

      expect(notification.actions).toHaveLength(4);
      expect(notification.actions[0].type).toBe('complete');
      expect(notification.metadata.geofenceType).toBe('approach_5mi');
    });

    it('should create arrival notification for arrival geofence', async () => {
      const arrivalGeofence = {
        ...mockGeofence,
        geofence_type: 'arrival',
        calculateDistance: jest.fn().mockReturnValue(50) // 50 meters
      };
      (Geofence.findById as jest.Mock).mockResolvedValue(arrivalGeofence);

      const notification = await NotificationService.createNotificationForEvent(mockGeofenceEvent);

      expect(notification.type).toBe('arrival');
      expect(notification.title).toBe('Arrived at grocery store');
      expect(notification.body).toBe('Arriving at grocery store — Buy groceries now?');
    });

    it('should create post-arrival notification', async () => {
      const postArrivalGeofence = {
        ...mockGeofence,
        geofence_type: 'post_arrival',
        calculateDistance: jest.fn().mockReturnValue(30)
      };
      (Geofence.findById as jest.Mock).mockResolvedValue(postArrivalGeofence);

      const notification = await NotificationService.createNotificationForEvent(mockGeofenceEvent);

      expect(notification.type).toBe('post_arrival');
      expect(notification.title).toBe('Still at grocery store');
      expect(notification.body).toBe('Still at grocery store — buy groceries?');
    });

    it('should use custom place name when available', async () => {
      const customPlaceTask = {
        ...mockTask,
        location_type: 'custom_place',
        place_id: 'place-1',
        poi_category: undefined
      };
      (Task.findById as jest.Mock).mockResolvedValue(customPlaceTask);
      (Place.findById as jest.Mock).mockResolvedValue(mockPlace);

      const notification = await NotificationService.createNotificationForEvent(mockGeofenceEvent);

      expect(notification.title).toBe('Approaching Home');
      expect(notification.body).toContain('Home');
      expect(notification.metadata.placeName).toBe('Home');
    });

    it('should adjust content based on notification style', async () => {
      const detailedUser = {
        ...mockUser,
        preferences: { ...mockUser.preferences, notificationStyle: 'detailed' }
      };
      (User.findById as jest.Mock).mockResolvedValue(detailedUser);

      const notification = await NotificationService.createNotificationForEvent(mockGeofenceEvent);

      expect(notification.body).toContain('Get milk and bread');
    });

    it('should throw error when required entities are missing', async () => {
      (Task.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        NotificationService.createNotificationForEvent(mockGeofenceEvent)
      ).rejects.toThrow('Required entities not found for notification');
    });
  });

  describe('handleNotificationAction', () => {
    it('should complete task when complete action is triggered', async () => {
      const mockTaskInstance = {
        complete: jest.fn().mockResolvedValue(undefined)
      };
      (Task.findById as jest.Mock).mockResolvedValue(mockTaskInstance);

      await NotificationService.handleNotificationAction(
        'notification_event-1',
        'complete',
        'user-1'
      );

      expect(mockTaskInstance.complete).toHaveBeenCalled();
    });

    it('should mute task when mute action is triggered', async () => {
      const mockTaskInstance = {
        mute: jest.fn().mockResolvedValue(undefined)
      };
      (Task.findById as jest.Mock).mockResolvedValue(mockTaskInstance);

      await NotificationService.handleNotificationAction(
        'notification_event-1',
        'mute',
        'user-1'
      );

      expect(mockTaskInstance.mute).toHaveBeenCalled();
    });

    it('should handle snooze actions', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await NotificationService.handleNotificationAction(
        'notification_event-1',
        'snooze_15m',
        'user-1'
      );

      expect(consoleSpy).toHaveBeenCalledWith('Snoozing task event-1 for snooze_15m');
      consoleSpy.mockRestore();
    });

    it('should throw error for unknown action type', async () => {
      await expect(
        NotificationService.handleNotificationAction(
          'notification_event-1',
          'unknown_action' as any,
          'user-1'
        )
      ).rejects.toThrow('Unknown action type: unknown_action');
    });
  });

  describe('bundleNotifications', () => {
    const createMockNotification = (id: string, location: { latitude: number; longitude: number }): LocationNotification => ({
      id,
      taskId: `task-${id}`,
      userId: 'user-1',
      type: 'approach',
      title: `Notification ${id}`,
      body: `Body ${id}`,
      actions: [],
      scheduledTime: new Date(),
      metadata: {
        geofenceId: `geofence-${id}`,
        geofenceType: 'approach_5mi',
        location
      }
    });

    it('should bundle nearby notifications', async () => {
      const notifications = [
        createMockNotification('1', { latitude: 37.7749, longitude: -122.4194 }),
        createMockNotification('2', { latitude: 37.7750, longitude: -122.4195 }), // ~100m away
        createMockNotification('3', { latitude: 37.7800, longitude: -122.4300 })  // ~1km away
      ];

      const bundles = await NotificationService.bundleNotifications(notifications);

      expect(bundles).toHaveLength(1);
      expect(bundles[0].notifications).toHaveLength(2);
      expect(bundles[0].title).toBe('2 reminders nearby');
      expect(bundles[0].body).toBe('You have 2 reminders for 2 tasks in this area');
      
      // Check that notifications are marked as bundled
      expect(notifications[0].bundled).toBe(true);
      expect(notifications[1].bundled).toBe(true);
      expect(notifications[2].bundled).toBeUndefined();
    });

    it('should create separate bundles for different users', async () => {
      const notifications = [
        createMockNotification('1', { latitude: 37.7749, longitude: -122.4194 }),
        { ...createMockNotification('2', { latitude: 37.7750, longitude: -122.4195 }), userId: 'user-2' }
      ];

      const bundles = await NotificationService.bundleNotifications(notifications);

      expect(bundles).toHaveLength(0); // No bundles created since notifications are for different users
    });

    it('should handle single notification correctly', async () => {
      const notifications = [
        createMockNotification('1', { latitude: 37.7749, longitude: -122.4194 })
      ];

      const bundles = await NotificationService.bundleNotifications(notifications);

      expect(bundles).toHaveLength(0);
      expect(notifications[0].bundled).toBeUndefined();
    });

    it('should handle empty notification array', async () => {
      const bundles = await NotificationService.bundleNotifications([]);
      expect(bundles).toHaveLength(0);
    });
  });

  describe('respectQuietHours', () => {
    const mockNotification: LocationNotification = {
      id: 'test-notification',
      taskId: 'task-1',
      userId: 'user-1',
      type: 'approach',
      title: 'Test',
      body: 'Test body',
      actions: [],
      scheduledTime: new Date(),
      metadata: {
        geofenceId: 'geofence-1',
        geofenceType: 'approach_5mi',
        location: { latitude: 37.7749, longitude: -122.4194 }
      }
    };

    beforeEach(() => {
      // Mock current time to 10:00 AM
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(10);
      jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should allow notification outside quiet hours', () => {
      const quietHours = { start: '22:00', end: '07:00' };
      const result = NotificationService.respectQuietHours(mockNotification, quietHours);
      expect(result).toBe(true);
    });

    it('should block notification during quiet hours', () => {
      const quietHours = { start: '09:00', end: '11:00' };
      const result = NotificationService.respectQuietHours(mockNotification, quietHours);
      expect(result).toBe(false);
    });

    it('should allow notification when no quiet hours set', () => {
      const result = NotificationService.respectQuietHours(mockNotification, undefined);
      expect(result).toBe(true);
    });

    it('should handle overnight quiet hours correctly', () => {
      // Test at 1:00 AM (should be blocked)
      jest.spyOn(Date.prototype, 'getHours').mockReturnValue(1);
      
      const quietHours = { start: '22:00', end: '07:00' };
      const result = NotificationService.respectQuietHours(mockNotification, quietHours);
      expect(result).toBe(false);
    });
  });

  describe('distance calculation', () => {
    it('should calculate distance correctly', () => {
      const coord1 = { latitude: 37.7749, longitude: -122.4194 };
      const coord2 = { latitude: 37.7849, longitude: -122.4094 };
      
      // Use reflection to access private method for testing
      const calculateDistance = (NotificationService as any).calculateDistance;
      const distance = calculateDistance(coord1, coord2);
      
      expect(distance).toBeGreaterThan(1000); // Should be more than 1km
      expect(distance).toBeLessThan(2000);    // Should be less than 2km
    });
  });

  describe('notification templates', () => {
    it('should format distance in miles for long distances', async () => {
      const longDistanceGeofence = {
        ...mockGeofence,
        calculateDistance: jest.fn().mockReturnValue(8047) // 5 miles
      };
      (Geofence.findById as jest.Mock).mockResolvedValue(longDistanceGeofence);

      const notification = await NotificationService.createNotificationForEvent(mockGeofenceEvent);

      expect(notification.body).toContain('5 miles');
    });

    it('should use appropriate actions for different notification types', async () => {
      // Test approach notification actions
      const notification = await NotificationService.createNotificationForEvent(mockGeofenceEvent);
      
      const actionTypes = notification.actions.map(a => a.type);
      expect(actionTypes).toContain('complete');
      expect(actionTypes).toContain('snooze_15m');
      expect(actionTypes).toContain('open_map');
      expect(actionTypes).toContain('mute');
    });

    it('should limit actions for minimal notification style', async () => {
      const minimalUser = {
        ...mockUser,
        preferences: { ...mockUser.preferences, notificationStyle: 'minimal' }
      };
      (User.findById as jest.Mock).mockResolvedValue(minimalUser);

      const notification = await NotificationService.createNotificationForEvent(mockGeofenceEvent);

      expect(notification.actions).toHaveLength(2);
    });
  });
});