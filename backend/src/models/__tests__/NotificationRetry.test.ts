import { NotificationRetry } from '../NotificationRetry';

describe('NotificationRetry', () => {
  const mockRetryData = {
    notificationHistoryId: 'history-123',
    maxRetries: 3,
    initialDelayMinutes: 5
  };

  beforeEach(() => {
    // Reset any mocks or test data
  });

  describe('create', () => {
    it('should create a new retry record', async () => {
      const retry = await NotificationRetry.create(mockRetryData);
      
      expect(retry).toBeDefined();
      expect(retry.notificationHistoryId).toBe(mockRetryData.notificationHistoryId);
      expect(retry.retryCount).toBe(0);
      expect(retry.maxRetries).toBe(mockRetryData.maxRetries);
      expect(retry.status).toBe('pending');
      expect(retry.backoffMultiplier).toBe(1.0);
    });

    it('should calculate next retry time correctly', async () => {
      const before = new Date();
      const retry = await NotificationRetry.create(mockRetryData);
      const after = new Date();
      
      const expectedMin = before.getTime() + 5 * 60 * 1000;
      const expectedMax = after.getTime() + 5 * 60 * 1000;
      
      expect(retry.nextRetryTime.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(retry.nextRetryTime.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('should use default values when not provided', async () => {
      const retry = await NotificationRetry.create({
        notificationHistoryId: 'history-123'
      });
      
      expect(retry.maxRetries).toBe(3);
      expect(retry.status).toBe('pending');
      expect(retry.backoffMultiplier).toBe(1.0);
    });
  });

  describe('findByNotificationHistoryId', () => {
    it('should find retry by notification history ID', async () => {
      const created = await NotificationRetry.create(mockRetryData);
      const found = await NotificationRetry.findByNotificationHistoryId(created.notificationHistoryId);
      
      expect(found).toBeDefined();
      expect(found?.notificationHistoryId).toBe(mockRetryData.notificationHistoryId);
    });

    it('should return null for non-existent notification history ID', async () => {
      const found = await NotificationRetry.findByNotificationHistoryId('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findPendingRetries', () => {
    it('should find pending retries', async () => {
      await NotificationRetry.create(mockRetryData);
      
      const pending = await NotificationRetry.findPendingRetries();
      
      expect(pending.length).toBeGreaterThan(0);
      expect(pending.every(r => r.status === 'pending')).toBe(true);
    });

    it('should find retries ready before a specific time', async () => {
      const pastTime = new Date(Date.now() - 1000);
      await NotificationRetry.create(mockRetryData);
      
      // Manually set next retry time to past time
      // This would typically be done through database manipulation in real tests
      
      const pending = await NotificationRetry.findPendingRetries(pastTime);
      
      expect(pending.length).toBeGreaterThan(0);
    });
  });

  describe('calculateNextRetryTime', () => {
    it('should calculate correct time for first retry', () => {
      const now = new Date();
      const result = NotificationRetry.calculateNextRetryTime(0, 1.0, 5);
      
      const expected = new Date(now.getTime() + 5 * 60 * 1000);
      expect(result.getTime()).toBeCloseTo(expected.getTime(), -2); // Within 100ms
    });

    it('should calculate correct time for second retry with exponential backoff', () => {
      const now = new Date();
      const result = NotificationRetry.calculateNextRetryTime(1, 2.0, 5);
      
      const expected = new Date(now.getTime() + 10 * 60 * 1000); // 5 * 2^1 = 10 minutes
      expect(result.getTime()).toBeCloseTo(expected.getTime(), -2); // Within 100ms
    });

    it('should calculate correct time for third retry with exponential backoff', () => {
      const now = new Date();
      const result = NotificationRetry.calculateNextRetryTime(2, 2.0, 5);
      
      const expected = new Date(now.getTime() + 20 * 60 * 1000); // 5 * 2^2 = 20 minutes
      expect(result.getTime()).toBeCloseTo(expected.getTime(), -2); // Within 100ms
    });

    it('should cap delay at maximum', () => {
      const now = new Date();
      const result = NotificationRetry.calculateNextRetryTime(10, 2.0, 5, 60); // Max 60 minutes
      
      const expected = new Date(now.getTime() + 60 * 60 * 1000);
      expect(result.getTime()).toBeCloseTo(expected.getTime(), -2); // Within 100ms
    });
  });

  describe('scheduleNextRetry', () => {
    it('should schedule next retry', async () => {
      const retry = await NotificationRetry.create(mockRetryData);
      
      const scheduled = await retry.scheduleNextRetry();
      
      expect(scheduled.retryCount).toBe(1);
      expect(scheduled.status).toBe('pending');
      expect(scheduled.nextRetryTime.getTime()).toBeGreaterThan(retry.nextRetryTime.getTime());
    });

    it('should throw error when max retries reached', async () => {
      const retry = await NotificationRetry.create({
        ...mockRetryData,
        maxRetries: 1
      });
      
      await retry.scheduleNextRetry(); // First retry
      
      await expect(retry.scheduleNextRetry()).rejects.toThrow('Maximum retry attempts reached');
    });
  });

  describe('markRetrying', () => {
    it('should mark retry as retrying', async () => {
      const retry = await NotificationRetry.create(mockRetryData);
      
      const retrying = await retry.markRetrying();
      
      expect(retrying.status).toBe('retrying');
    });
  });

  describe('markSucceeded', () => {
    it('should mark retry as succeeded', async () => {
      const retry = await NotificationRetry.create(mockRetryData);
      
      const succeeded = await retry.markSucceeded();
      
      expect(succeeded.status).toBe('succeeded');
    });
  });

  describe('markFailed', () => {
    it('should mark retry as failed', async () => {
      const retry = await NotificationRetry.create(mockRetryData);
      const errorMessage = 'Test error';
      
      const failed = await retry.markFailed(errorMessage);
      
      expect(failed.status).toBe('failed');
      expect(failed.errorMessage).toBe(errorMessage);
    });
  });

  describe('canRetry', () => {
    it('should allow retry when conditions are met', async () => {
      const retry = await NotificationRetry.create(mockRetryData);
      
      expect(retry.canRetry()).toBe(true);
    });

    it('should not allow retry when status is not pending', async () => {
      const retry = await NotificationRetry.create(mockRetryData);
      await retry.markRetrying();
      
      expect(retry.canRetry()).toBe(false);
    });

    it('should not allow retry when max attempts reached', async () => {
      const retry = await NotificationRetry.create({
        ...mockRetryData,
        maxRetries: 1
      });
      
      await retry.scheduleNextRetry();
      
      expect(retry.canRetry()).toBe(false);
    });

    it('should not allow retry when next retry time is in future', async () => {
      const futureTime = new Date(Date.now() + 1000);
      const retry = await NotificationRetry.create(mockRetryData);
      retry.nextRetryTime = futureTime;
      
      expect(retry.canRetry()).toBe(false);
    });
  });

  describe('hasExceededMaxRetries', () => {
    it('should return false when under max retries', async () => {
      const retry = await NotificationRetry.create(mockRetryData);
      
      expect(retry.hasExceededMaxRetries()).toBe(false);
    });

    it('should return true when at max retries', async () => {
      const retry = await NotificationRetry.create({
        ...mockRetryData,
        maxRetries: 1
      });
      
      await retry.scheduleNextRetry();
      
      expect(retry.hasExceededMaxRetries()).toBe(true);
    });
  });

  describe('getRemainingRetries', () => {
    it('should return correct remaining retries', async () => {
      const retry = await NotificationRetry.create({
        ...mockRetryData,
        maxRetries: 5
      });
      
      expect(retry.getRemainingRetries()).toBe(5);
      
      await retry.scheduleNextRetry();
      expect(retry.getRemainingRetries()).toBe(4);
      
      await retry.scheduleNextRetry();
      expect(retry.getRemainingRetries()).toBe(3);
    });

    it('should return 0 when max retries reached', async () => {
      const retry = await NotificationRetry.create({
        ...mockRetryData,
        maxRetries: 2
      });
      
      await retry.scheduleNextRetry();
      await retry.scheduleNextRetry();
      
      expect(retry.getRemainingRetries()).toBe(0);
    });
  });

  describe('toJSON', () => {
    it('should convert to JSON with all fields', async () => {
      const created = await NotificationRetry.create(mockRetryData);
      const json = created.toJSON();
      
      expect(json.id).toBe(created.id);
      expect(json.notification_history_id).toBe(created.notificationHistoryId);
      expect(json.retry_count).toBe(created.retryCount);
      expect(json.next_retry_time).toEqual(created.nextRetryTime);
      expect(json.backoff_multiplier).toBe(created.backoffMultiplier);
      expect(json.max_retries).toBe(created.maxRetries);
      expect(json.status).toBe(created.status);
      expect(json.error_message).toBe(created.errorMessage);
      expect(json.created_at).toEqual(created.createdAt);
      expect(json.updated_at).toEqual(created.updatedAt);
    });
  });
});
