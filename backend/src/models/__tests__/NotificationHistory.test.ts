import { NotificationHistory } from '../NotificationHistory';
import { NotificationType } from '../../services/notificationService';

describe('NotificationHistory', () => {
  const mockNotificationData = {
    userId: 'user-123',
    taskId: 'task-456',
    notificationId: 'notification-789',
    type: 'approach' as NotificationType,
    title: 'Test Notification',
    body: 'This is a test notification',
    scheduledTime: new Date(),
    metadata: { test: true }
  };

  beforeEach(() => {
    // Reset any mocks or test data
  });

  describe('create', () => {
    it('should create a new notification history record', async () => {
      const notification = await NotificationHistory.create(mockNotificationData);
      
      expect(notification).toBeDefined();
      expect(notification.userId).toBe(mockNotificationData.userId);
      expect(notification.taskId).toBe(mockNotificationData.taskId);
      expect(notification.notificationId).toBe(mockNotificationData.notificationId);
      expect(notification.type).toBe(mockNotificationData.type);
      expect(notification.title).toBe(mockNotificationData.title);
      expect(notification.body).toBe(mockNotificationData.body);
      expect(notification.status).toBe('pending');
      expect(notification.attempts).toBe(0);
    });

    it('should handle metadata correctly', async () => {
      const notification = await NotificationHistory.create(mockNotificationData);
      
      expect(notification.metadata).toEqual(mockNotificationData.metadata);
    });
  });

  describe('findById', () => {
    it('should find notification by ID', async () => {
      const created = await NotificationHistory.create(mockNotificationData);
      const found = await NotificationHistory.findById(created.id);
      
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const found = await NotificationHistory.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findByNotificationId', () => {
    it('should find notification by notification ID', async () => {
      const created = await NotificationHistory.create(mockNotificationData);
      const found = await NotificationHistory.findByNotificationId(created.notificationId);
      
      expect(found).toBeDefined();
      expect(found?.notificationId).toBe(mockNotificationData.notificationId);
    });
  });

  describe('findByUserId', () => {
    it('should find notifications for a user', async () => {
      await NotificationHistory.create(mockNotificationData);
      
      const result = await NotificationHistory.findByUserId(mockNotificationData.userId);
      
      expect(result.notifications).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
      expect(result.notifications[0].userId).toBe(mockNotificationData.userId);
    });

    it('should support pagination', async () => {
      await NotificationHistory.create(mockNotificationData);
      
      const result = await NotificationHistory.findByUserId(mockNotificationData.userId, 1, 10);
      
      expect(result.notifications.length).toBeLessThanOrEqual(10);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should filter by status', async () => {
      await NotificationHistory.create(mockNotificationData);
      
      const result = await NotificationHistory.findByUserId(mockNotificationData.userId, 1, 10, 'pending');
      
      expect(result.notifications.every(n => n.status === 'pending')).toBe(true);
    });
  });

  describe('findPendingNotifications', () => {
    it('should find pending notifications', async () => {
      await NotificationHistory.create(mockNotificationData);
      
      const pending = await NotificationHistory.findPendingNotifications();
      
      expect(pending.length).toBeGreaterThan(0);
      expect(pending.every(n => n.status === 'pending')).toBe(true);
    });

    it('should find notifications scheduled before a specific time', async () => {
      const pastTime = new Date(Date.now() - 1000);
      await NotificationHistory.create({
        ...mockNotificationData,
        scheduledTime: pastTime
      });
      
      const pending = await NotificationHistory.findPendingNotifications(pastTime);
      
      expect(pending.length).toBeGreaterThan(0);
    });
  });

  describe('update', () => {
    it('should update notification status', async () => {
      const created = await NotificationHistory.create(mockNotificationData);
      
      const updated = await created.update({ status: 'delivered' });
      
      expect(updated.status).toBe('delivered');
    });

    it('should update multiple fields', async () => {
      const created = await NotificationHistory.create(mockNotificationData);
      const deliveredTime = new Date();
      
      const updated = await created.update({
        status: 'delivered',
        deliveredTime,
        attempts: 1
      });
      
      expect(updated.status).toBe('delivered');
      expect(updated.deliveredTime).toEqual(deliveredTime);
      expect(updated.attempts).toBe(1);
    });
  });

  describe('markDelivered', () => {
    it('should mark notification as delivered', async () => {
      const created = await NotificationHistory.create(mockNotificationData);
      
      const updated = await created.markDelivered();
      
      expect(updated.status).toBe('delivered');
      expect(updated.deliveredTime).toBeDefined();
      expect(updated.lastAttempt).toBeDefined();
    });
  });

  describe('markFailed', () => {
    it('should mark notification as failed', async () => {
      const created = await NotificationHistory.create(mockNotificationData);
      const errorMessage = 'Test error';
      
      const updated = await created.markFailed(errorMessage);
      
      expect(updated.status).toBe('failed');
      expect(updated.errorMessage).toBe(errorMessage);
      expect(updated.attempts).toBe(1);
      expect(updated.lastAttempt).toBeDefined();
    });
  });

  describe('markSnoozed', () => {
    it('should mark notification as snoozed', async () => {
      const created = await NotificationHistory.create(mockNotificationData);
      
      const updated = await created.markSnoozed();
      
      expect(updated.status).toBe('snoozed');
      expect(updated.lastAttempt).toBeDefined();
    });
  });

  describe('cancel', () => {
    it('should cancel notification', async () => {
      const created = await NotificationHistory.create(mockNotificationData);
      
      const updated = await created.cancel();
      
      expect(updated.status).toBe('cancelled');
      expect(updated.lastAttempt).toBeDefined();
    });
  });

  describe('canRetry', () => {
    it('should allow retry when under max attempts', async () => {
      const created = await NotificationHistory.create(mockNotificationData);
      
      expect(created.canRetry(3)).toBe(true);
    });

    it('should not allow retry when at max attempts', async () => {
      const created = await NotificationHistory.create(mockNotificationData);
      await created.update({ attempts: 3 });
      
      expect(created.canRetry(3)).toBe(false);
    });

    it('should not allow retry for non-failed notifications', async () => {
      const created = await NotificationHistory.create(mockNotificationData);
      
      expect(created.canRetry(3)).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON without sensitive fields', async () => {
      const created = await NotificationHistory.create(mockNotificationData);
      const json = created.toJSON();
      
      expect(json.id).toBe(created.id);
      expect(json.notification_id).toBe(created.notificationId);
      expect(json.type).toBe(created.type);
      expect(json.title).toBe(created.title);
      expect(json.body).toBe(created.body);
      expect(json.status).toBe(created.status);
      expect(json.attempts).toBe(created.attempts);
      expect(json.metadata).toEqual(created.metadata);
      
      // Should not include user_id or task_id
      expect(json).not.toHaveProperty('user_id');
      expect(json).not.toHaveProperty('task_id');
    });
  });
});
