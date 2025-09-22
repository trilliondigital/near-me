import { MockAPNsService, APNsService } from '../apnsService';
import { LocationNotification } from '../notificationService';

describe('APNsService', () => {
  describe('MockAPNsService', () => {
    const mockDeviceToken = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const mockPayload = {
      aps: {
        alert: {
          title: 'Test Notification',
          body: 'This is a test notification'
        },
        sound: 'default',
        category: 'LOCATION_REMINDER'
      },
      task_id: 'test-task-123',
      notification_id: 'test-notification-456'
    };

    it('should send notification successfully', async () => {
      const result = await MockAPNsService.sendNotification(mockDeviceToken, mockPayload);
      
      expect(result.success).toBe(true);
      expect(result.apnsId).toBeDefined();
      expect(result.apnsId).toMatch(/^mock-/);
    });

    it('should handle bulk notifications', async () => {
      const tokens = [mockDeviceToken, mockDeviceToken, mockDeviceToken];
      const result = await MockAPNsService.sendBulkNotifications(tokens, mockPayload);
      
      expect(result.success).toBeGreaterThan(0);
      expect(result.failed).toBeGreaterThanOrEqual(0);
      expect(result.success + result.failed).toBe(tokens.length);
    });

    it('should validate device token format', () => {
      const validToken = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const invalidToken = 'invalid-token';
      
      expect(APNsService.isValidDeviceToken(validToken)).toBe(true);
      expect(APNsService.isValidDeviceToken(invalidToken)).toBe(false);
    });
  });

  describe('APNsService', () => {
    it('should validate device token format correctly', () => {
      const validTokens = [
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        'ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      ];

      const invalidTokens = [
        'short',
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcde', // 63 chars
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefg', // 65 chars
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdeg', // invalid hex
        ''
      ];

      validTokens.forEach(token => {
        expect(APNsService.isValidDeviceToken(token)).toBe(true);
      });

      invalidTokens.forEach(token => {
        expect(APNsService.isValidDeviceToken(token)).toBe(false);
      });
    });

    it('should create proper APNs payload', () => {
      const notification: LocationNotification = {
        id: 'test-notification-123',
        userId: 'test-user-456',
        taskId: 'test-task-789',
        type: 'approach',
        title: 'Approaching Location',
        body: 'You are approaching your destination',
        scheduledTime: new Date(),
        actions: ['complete', 'snooze']
      };

      const payload = APNsService.createPayload(notification);

      expect(payload.aps.alert.title).toBe(notification.title);
      expect(payload.aps.alert.body).toBe(notification.body);
      expect(payload.aps.sound).toBe('default');
      expect(payload.aps.category).toBe('LOCATION_REMINDER');
      expect(payload.task_id).toBe(notification.taskId);
      expect(payload.notification_id).toBe(notification.id);
      expect(payload.action_type).toBe(notification.type);
    });

    it('should create payload with custom data', () => {
      const notification: LocationNotification = {
        id: 'test-notification-123',
        userId: 'test-user-456',
        taskId: 'test-task-789',
        type: 'arrival',
        title: 'Arrived at Location',
        body: 'You have arrived at your destination',
        scheduledTime: new Date(),
        actions: ['complete', 'snooze']
      };

      const customData = {
        custom_field: 'custom_value',
        priority: 'high'
      };

      const payload = APNsService.createPayload(notification, customData);

      expect(payload.custom_field).toBe('custom_value');
      expect(payload.priority).toBe('high');
      expect(payload.task_id).toBe(notification.taskId);
    });
  });
});
