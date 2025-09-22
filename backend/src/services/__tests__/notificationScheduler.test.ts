import { NotificationScheduler, ScheduledNotification } from '../notificationScheduler';
import { LocationNotification, NotificationBundle } from '../notificationService';
import { User } from '../../models/User';

// Mock dependencies
jest.mock('../../models/User');

const mockUser = {
  id: 'user-1',
  preferences: {
    notificationStyle: 'standard',
    quietHours: { start: '22:00', end: '07:00' }
  }
} as any;

const mockNotification: LocationNotification = {
  id: 'notification-1',
  taskId: 'task-1',
  userId: 'user-1',
  type: 'approach',
  title: 'Test Notification',
  body: 'Test body',
  actions: [],
  scheduledTime: new Date(),
  metadata: {
    geofenceId: 'geofence-1',
    geofenceType: 'approach_5mi',
    location: { latitude: 37.7749, longitude: -122.4194 }
  }
};

const mockBundle: NotificationBundle = {
  id: 'bundle-1',
  userId: 'user-1',
  notifications: [mockNotification],
  title: 'Bundle Title',
  body: 'Bundle body',
  actions: [],
  location: { latitude: 37.7749, longitude: -122.4194 },
  radius: 500,
  scheduledTime: new Date()
};

describe('NotificationScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear scheduled notifications
    (NotificationScheduler as any).scheduledNotifications.clear();
    
    // Setup default mocks
    (User.findById as jest.Mock).mockResolvedValue(mockUser);
    
    // Mock console.log to avoid test output noise
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('scheduleNotification', () => {
    it('should schedule notification for immediate delivery outside quiet hours', async () => {
      // Mock current time to 10:00 AM (outside quiet hours)
      const mockDate = new Date('2023-01-01T10:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const scheduled = await NotificationScheduler.scheduleNotification(mockNotification);

      expect(scheduled.status).toBe('delivered'); // Should be delivered immediately
      expect(scheduled.userId).toBe('user-1');
      expect(scheduled.notification).toBe(mockNotification);
    });

    it('should delay notification during quiet hours', async () => {
      // Mock user with quiet hours that include current time
      const quietHoursUser = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          quietHours: { start: '00:00', end: '02:00' } // Current time should be in this range
        }
      };
      (User.findById as jest.Mock).mockResolvedValue(quietHoursUser);

      const scheduled = await NotificationScheduler.scheduleNotification(mockNotification);

      expect(scheduled.status).toBe('pending');
      expect(scheduled.scheduledTime.getHours()).toBeGreaterThanOrEqual(2); // Should be scheduled after quiet hours
    });

    it('should handle user not found error', async () => {
      (User.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        NotificationScheduler.scheduleNotification(mockNotification)
      ).rejects.toThrow('User not found');
    });

    it('should schedule bundle notifications', async () => {
      const scheduled = await NotificationScheduler.scheduleNotification(mockBundle);

      expect(scheduled.notification).toBe(mockBundle);
      expect(scheduled.id).toBe('scheduled_bundle-1');
    });
  });

  describe('cancelNotification', () => {
    it('should cancel scheduled notification', async () => {
      const scheduled = await NotificationScheduler.scheduleNotification(mockNotification);
      const cancelled = await NotificationScheduler.cancelNotification(scheduled.id);

      expect(cancelled).toBe(true);
      
      const userNotifications = NotificationScheduler.getScheduledNotifications('user-1');
      expect(userNotifications).toHaveLength(0);
    });

    it('should return false for non-existent notification', async () => {
      const cancelled = await NotificationScheduler.cancelNotification('non-existent');
      expect(cancelled).toBe(false);
    });
  });

  describe('deliverNotification', () => {
    it('should deliver notification successfully', async () => {
      // Mock successful delivery
      const sendPushSpy = jest.spyOn(NotificationScheduler as any, 'sendPushNotification')
        .mockResolvedValue({ success: true });

      // Create a pending notification manually
      const scheduled = await NotificationScheduler.scheduleNotification(mockNotification);
      scheduled.status = 'pending'; // Ensure it's pending
      
      const delivered = await NotificationScheduler.deliverNotification(scheduled.id);

      expect(delivered).toBe(true);
      expect(sendPushSpy).toHaveBeenCalled();
    });

    it('should handle delivery failure and retry', async () => {
      // Mock failed delivery
      jest.spyOn(NotificationScheduler as any, 'sendPushNotification')
        .mockResolvedValue({ success: false, error: 'Network error' });

      // Create a pending notification manually
      const scheduled = await NotificationScheduler.scheduleNotification(mockNotification);
      scheduled.status = 'pending';
      
      const delivered = await NotificationScheduler.deliverNotification(scheduled.id);

      expect(delivered).toBe(false);
      expect(scheduled.attempts).toBe(1);
      expect(scheduled.error).toBe('Network error');
    });

    it('should fail after max retries', async () => {
      // Configure for 1 max retry
      NotificationScheduler.configure({ maxRetries: 1 });

      // Mock failed delivery
      jest.spyOn(NotificationScheduler as any, 'sendPushNotification')
        .mockResolvedValue({ success: false, error: 'Persistent error' });

      const scheduled = await NotificationScheduler.scheduleNotification(mockNotification);
      
      // First attempt
      await NotificationScheduler.deliverNotification(scheduled.id);
      expect(scheduled.status).toBe('pending');
      
      // Second attempt (should fail permanently)
      await NotificationScheduler.deliverNotification(scheduled.id);
      expect(scheduled.status).toBe('failed');
    });

    it('should respect quiet hours during delivery', async () => {
      // Mock current time to 1:00 AM (during quiet hours)
      const mockDate = new Date('2023-01-01T01:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const scheduled = await NotificationScheduler.scheduleNotification(mockNotification);
      const delivered = await NotificationScheduler.deliverNotification(scheduled.id);

      expect(delivered).toBe(false);
      expect(scheduled.status).toBe('pending');
    });
  });

  describe('processPendingNotifications', () => {
    it('should process multiple pending notifications', async () => {
      // Mock successful delivery
      jest.spyOn(NotificationScheduler as any, 'sendPushNotification')
        .mockResolvedValue({ success: true });

      // Schedule multiple notifications
      const notification1 = { ...mockNotification, id: 'notification-1' };
      const notification2 = { ...mockNotification, id: 'notification-2' };
      
      await NotificationScheduler.scheduleNotification(notification1);
      await NotificationScheduler.scheduleNotification(notification2);

      const stats = await NotificationScheduler.processPendingNotifications();

      expect(stats.processed).toBeGreaterThan(0);
      expect(stats.delivered).toBeGreaterThan(0);
    });

    it('should skip future notifications', async () => {
      // Create notification scheduled for future
      const futureNotification = {
        ...mockNotification,
        scheduledTime: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
      };

      await NotificationScheduler.scheduleNotification(futureNotification);
      const stats = await NotificationScheduler.processPendingNotifications();

      expect(stats.processed).toBe(0);
    });
  });

  describe('quiet hours handling', () => {
    it('should correctly identify quiet hours', () => {
      const isInQuietHours = (NotificationScheduler as any).isInQuietHours;
      
      // Test during quiet hours (1:00 AM local time)
      const nightTime = new Date();
      nightTime.setHours(1, 0, 0, 0);
      const quietHours = { start: '22:00', end: '07:00' };
      
      expect(isInQuietHours(nightTime, quietHours)).toBe(true);
      
      // Test outside quiet hours (10:00 AM local time)
      const dayTime = new Date();
      dayTime.setHours(10, 0, 0, 0);
      expect(isInQuietHours(dayTime, quietHours)).toBe(false);
    });

    it('should calculate next delivery time correctly', () => {
      const calculateNextDeliveryTime = (NotificationScheduler as any).calculateNextDeliveryTime;
      const quietHours = { start: '22:00', end: '07:00' };
      
      const nextDelivery = calculateNextDeliveryTime(quietHours);
      
      expect(nextDelivery.getHours()).toBe(7);
      expect(nextDelivery.getMinutes()).toBe(5); // 5 minute tolerance
    });

    it('should handle same-day quiet hours', () => {
      const isInQuietHours = (NotificationScheduler as any).isInQuietHours;
      
      // Test same-day quiet hours (12:00 PM during 11:00-13:00 quiet hours)
      const lunchTime = new Date();
      lunchTime.setHours(12, 0, 0, 0);
      const lunchQuietHours = { start: '11:00', end: '13:00' };
      
      expect(isInQuietHours(lunchTime, lunchQuietHours)).toBe(true);
    });
  });

  describe('getScheduledNotifications', () => {
    it('should return notifications for specific user', async () => {
      await NotificationScheduler.scheduleNotification(mockNotification);
      
      const userNotifications = NotificationScheduler.getScheduledNotifications('user-1');
      expect(userNotifications).toHaveLength(1);
      expect(userNotifications[0].userId).toBe('user-1');
      
      const otherUserNotifications = NotificationScheduler.getScheduledNotifications('user-2');
      expect(otherUserNotifications).toHaveLength(0);
    });
  });

  describe('cleanupOldNotifications', () => {
    it('should clean up old delivered notifications', async () => {
      // Create old delivered notification
      const oldNotification = {
        ...mockNotification,
        scheduledTime: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      };

      const scheduled = await NotificationScheduler.scheduleNotification(oldNotification);
      scheduled.status = 'delivered';

      const cleaned = NotificationScheduler.cleanupOldNotifications(24);
      expect(cleaned).toBe(1);
    });

    it('should not clean up recent notifications', async () => {
      await NotificationScheduler.scheduleNotification(mockNotification);
      
      const cleaned = NotificationScheduler.cleanupOldNotifications(24);
      expect(cleaned).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      // Schedule some notifications with different statuses
      const scheduled1 = await NotificationScheduler.scheduleNotification(mockNotification);
      const scheduled2 = await NotificationScheduler.scheduleNotification({
        ...mockNotification,
        id: 'notification-2'
      });

      scheduled2.status = 'failed';

      const stats = NotificationScheduler.getStats();
      
      expect(stats.totalScheduled).toBeGreaterThan(0);
      expect(stats.pending + stats.delivered + stats.failed + stats.cancelled).toBe(stats.totalScheduled);
    });
  });

  describe('configuration', () => {
    it('should allow configuration updates', () => {
      const newConfig = {
        maxRetries: 5,
        retryDelayMinutes: 10,
        quietHoursToleranceMinutes: 10
      };

      NotificationScheduler.configure(newConfig);
      
      // Configuration is private, but we can test its effects
      expect(() => NotificationScheduler.configure(newConfig)).not.toThrow();
    });
  });

  describe('focus mode integration', () => {
    it('should respect focus mode when configured', async () => {
      NotificationScheduler.configure({ focusModeRespect: true });
      
      // Mock focus mode check to return true
      jest.spyOn(NotificationScheduler as any, 'checkFocusMode')
        .mockResolvedValue(true);

      const canDeliver = await (NotificationScheduler as any).canDeliverNow(mockNotification, mockUser);
      
      expect(canDeliver.allowed).toBe(false);
      expect(canDeliver.reason).toBe('User is in focus mode');
    });

    it('should ignore focus mode when disabled', async () => {
      NotificationScheduler.configure({ focusModeRespect: false });
      
      const canDeliver = await (NotificationScheduler as any).canDeliverNow(mockNotification, mockUser);
      
      expect(canDeliver.allowed).toBe(true);
    });
  });
});