import { NotificationSnooze } from '../NotificationSnooze';
import { SnoozeDuration } from '../../services/notificationService';

describe('NotificationSnooze', () => {
  const mockSnoozeData = {
    userId: 'user-123',
    taskId: 'task-456',
    notificationId: 'notification-789',
    snoozeDuration: '15m' as SnoozeDuration,
    originalScheduledTime: new Date()
  };

  beforeEach(() => {
    // Reset any mocks or test data
  });

  describe('create', () => {
    it('should create a new snooze record', async () => {
      const snooze = await NotificationSnooze.create(mockSnoozeData);
      
      expect(snooze).toBeDefined();
      expect(snooze.userId).toBe(mockSnoozeData.userId);
      expect(snooze.taskId).toBe(mockSnoozeData.taskId);
      expect(snooze.notificationId).toBe(mockSnoozeData.notificationId);
      expect(snooze.snoozeDuration).toBe(mockSnoozeData.snoozeDuration);
      expect(snooze.snoozeCount).toBe(1);
      expect(snooze.status).toBe('active');
    });

    it('should calculate snooze until time correctly for 15m', async () => {
      const before = new Date();
      const snooze = await NotificationSnooze.create({
        ...mockSnoozeData,
        snoozeDuration: '15m'
      });
      const after = new Date();
      
      const expectedMin = before.getTime() + 15 * 60 * 1000;
      const expectedMax = after.getTime() + 15 * 60 * 1000;
      
      expect(snooze.snoozeUntil.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(snooze.snoozeUntil.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('should calculate snooze until time correctly for 1h', async () => {
      const before = new Date();
      const snooze = await NotificationSnooze.create({
        ...mockSnoozeData,
        snoozeDuration: '1h'
      });
      const after = new Date();
      
      const expectedMin = before.getTime() + 60 * 60 * 1000;
      const expectedMax = after.getTime() + 60 * 60 * 1000;
      
      expect(snooze.snoozeUntil.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(snooze.snoozeUntil.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('should calculate snooze until time correctly for today', async () => {
      const snooze = await NotificationSnooze.create({
        ...mockSnoozeData,
        snoozeDuration: 'today'
      });
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      
      expect(snooze.snoozeUntil.getHours()).toBe(9);
      expect(snooze.snoozeUntil.getMinutes()).toBe(0);
      expect(snooze.snoozeUntil.getSeconds()).toBe(0);
    });
  });

  describe('findByNotificationId', () => {
    it('should find active snooze by notification ID', async () => {
      const created = await NotificationSnooze.create(mockSnoozeData);
      const found = await NotificationSnooze.findByNotificationId(created.notificationId);
      
      expect(found).toBeDefined();
      expect(found?.notificationId).toBe(mockSnoozeData.notificationId);
      expect(found?.status).toBe('active');
    });

    it('should return null for non-existent notification ID', async () => {
      const found = await NotificationSnooze.findByNotificationId('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findActiveByUserId', () => {
    it('should find active snoozes for a user', async () => {
      await NotificationSnooze.create(mockSnoozeData);
      
      const snoozes = await NotificationSnooze.findActiveByUserId(mockSnoozeData.userId);
      
      expect(snoozes.length).toBeGreaterThan(0);
      expect(snoozes.every(s => s.userId === mockSnoozeData.userId)).toBe(true);
      expect(snoozes.every(s => s.status === 'active')).toBe(true);
    });
  });

  describe('findExpiredSnoozes', () => {
    it('should find expired snoozes', async () => {
      const pastTime = new Date(Date.now() - 1000);
      await NotificationSnooze.create({
        ...mockSnoozeData,
        snoozeDuration: '15m'
      });
      
      // Manually set snooze until to past time
      // This would typically be done through database manipulation in real tests
      
      const expired = await NotificationSnooze.findExpiredSnoozes(pastTime);
      
      expect(expired.length).toBeGreaterThan(0);
      expect(expired.every(s => s.status === 'active')).toBe(true);
    });
  });

  describe('isNotificationSnoozed', () => {
    it('should return true for snoozed notification', async () => {
      await NotificationSnooze.create(mockSnoozeData);
      
      const isSnoozed = await NotificationSnooze.isNotificationSnoozed(mockSnoozeData.notificationId);
      
      expect(isSnoozed).toBe(true);
    });

    it('should return false for non-snoozed notification', async () => {
      const isSnoozed = await NotificationSnooze.isNotificationSnoozed('non-snoozed-id');
      
      expect(isSnoozed).toBe(false);
    });
  });

  describe('calculateSnoozeUntil', () => {
    it('should calculate correct time for 15m', () => {
      const now = new Date();
      const result = NotificationSnooze.calculateSnoozeUntil('15m');
      
      const expected = new Date(now.getTime() + 15 * 60 * 1000);
      expect(result.getTime()).toBeCloseTo(expected.getTime(), -2); // Within 100ms
    });

    it('should calculate correct time for 1h', () => {
      const now = new Date();
      const result = NotificationSnooze.calculateSnoozeUntil('1h');
      
      const expected = new Date(now.getTime() + 60 * 60 * 1000);
      expect(result.getTime()).toBeCloseTo(expected.getTime(), -2); // Within 100ms
    });

    it('should calculate correct time for today', () => {
      const result = NotificationSnooze.calculateSnoozeUntil('today');
      
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    it('should throw error for invalid duration', () => {
      expect(() => {
        NotificationSnooze.calculateSnoozeUntil('invalid' as SnoozeDuration);
      }).toThrow('Unknown snooze duration: invalid');
    });
  });

  describe('extendSnooze', () => {
    it('should extend snooze duration', async () => {
      const created = await NotificationSnooze.create(mockSnoozeData);
      const originalUntil = created.snoozeUntil;
      
      const extended = await created.extendSnooze('1h');
      
      expect(extended.snoozeDuration).toBe('1h');
      expect(extended.snoozeCount).toBe(2);
      expect(extended.snoozeUntil.getTime()).toBeGreaterThan(originalUntil.getTime());
    });
  });

  describe('markExpired', () => {
    it('should mark snooze as expired', async () => {
      const created = await NotificationSnooze.create(mockSnoozeData);
      
      const expired = await created.markExpired();
      
      expect(expired.status).toBe('expired');
    });
  });

  describe('cancel', () => {
    it('should cancel snooze', async () => {
      const created = await NotificationSnooze.create(mockSnoozeData);
      
      const cancelled = await created.cancel();
      
      expect(cancelled.status).toBe('cancelled');
    });
  });

  describe('isExpired', () => {
    it('should return true for expired snooze', async () => {
      const pastTime = new Date(Date.now() - 1000);
      const snooze = await NotificationSnooze.create({
        ...mockSnoozeData,
        snoozeDuration: '15m'
      });
      
      // Manually set snooze until to past time
      snooze.snoozeUntil = pastTime;
      
      expect(snooze.isExpired()).toBe(true);
    });

    it('should return false for active snooze', async () => {
      const snooze = await NotificationSnooze.create(mockSnoozeData);
      
      expect(snooze.isExpired()).toBe(false);
    });
  });

  describe('getRemainingTime', () => {
    it('should return remaining time in milliseconds', async () => {
      const snooze = await NotificationSnooze.create(mockSnoozeData);
      const remaining = snooze.getRemainingTime();
      
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThan(15 * 60 * 1000); // Less than 15 minutes
    });

    it('should return 0 for expired snooze', async () => {
      const pastTime = new Date(Date.now() - 1000);
      const snooze = await NotificationSnooze.create({
        ...mockSnoozeData,
        snoozeDuration: '15m'
      });
      
      snooze.snoozeUntil = pastTime;
      
      expect(snooze.getRemainingTime()).toBe(0);
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON without sensitive fields', async () => {
      const created = await NotificationSnooze.create(mockSnoozeData);
      const json = created.toJSON();
      
      expect(json.id).toBe(created.id);
      expect(json.notification_id).toBe(created.notificationId);
      expect(json.snooze_duration).toBe(created.snoozeDuration);
      expect(json.snooze_until).toEqual(created.snoozeUntil);
      expect(json.snooze_count).toBe(created.snoozeCount);
      expect(json.status).toBe(created.status);
      
      // Should not include user_id or task_id
      expect(json).not.toHaveProperty('user_id');
      expect(json).not.toHaveProperty('task_id');
    });
  });
});
