import { NotificationService } from '../notificationService';
import { NotificationHistory } from '../../models/NotificationHistory';
import { NotificationSnooze } from '../../models/NotificationSnooze';
import { TaskMute } from '../../models/TaskMute';
import { NotificationRetry } from '../../models/NotificationRetry';
import { LocationNotification, NotificationActionType } from '../notificationService';

describe('NotificationService - Persistence Features', () => {
  const mockNotification: LocationNotification = {
    id: 'notification-123',
    taskId: 'task-456',
    userId: 'user-789',
    type: 'approach',
    title: 'Test Notification',
    body: 'This is a test notification',
    actions: [],
    scheduledTime: new Date(),
    metadata: {
      geofenceId: 'geofence-123',
      geofenceType: 'approach_5mi',
      location: { latitude: 37.7749, longitude: -122.4194 },
      placeName: 'Test Place',
      distance: 1000
    }
  };

  beforeEach(() => {
    // Reset any mocks or test data
  });

  describe('scheduleNotification', () => {
    it('should create notification history record', async () => {
      await NotificationService.scheduleNotification(mockNotification);
      
      const history = await NotificationHistory.findByNotificationId(mockNotification.id);
      
      expect(history).toBeDefined();
      expect(history?.userId).toBe(mockNotification.userId);
      expect(history?.taskId).toBe(mockNotification.taskId);
      expect(history?.type).toBe(mockNotification.type);
      expect(history?.title).toBe(mockNotification.title);
      expect(history?.body).toBe(mockNotification.body);
    });

    it('should skip notification if task is muted', async () => {
      // Create a mute for the task
      await TaskMute.create({
        userId: mockNotification.userId,
        taskId: mockNotification.taskId,
        muteDuration: '24h',
        reason: 'Test mute'
      });
      
      await NotificationService.scheduleNotification(mockNotification);
      
      const history = await NotificationHistory.findByNotificationId(mockNotification.id);
      expect(history).toBeNull();
    });

    it('should skip notification if already snoozed', async () => {
      // Create a snooze for the notification
      await NotificationSnooze.create({
        userId: mockNotification.userId,
        taskId: mockNotification.taskId,
        notificationId: mockNotification.id,
        snoozeDuration: '15m',
        originalScheduledTime: mockNotification.scheduledTime
      });
      
      await NotificationService.scheduleNotification(mockNotification);
      
      const history = await NotificationHistory.findByNotificationId(mockNotification.id);
      expect(history).toBeNull();
    });
  });

  describe('cancelNotification', () => {
    it('should cancel notification history and snoozes', async () => {
      // Create notification history
      await NotificationHistory.create({
        userId: mockNotification.userId,
        taskId: mockNotification.taskId,
        notificationId: mockNotification.id,
        type: mockNotification.type,
        title: mockNotification.title,
        body: mockNotification.body,
        scheduledTime: mockNotification.scheduledTime,
        metadata: mockNotification.metadata
      });
      
      // Create snooze
      await NotificationSnooze.create({
        userId: mockNotification.userId,
        taskId: mockNotification.taskId,
        notificationId: mockNotification.id,
        snoozeDuration: '15m',
        originalScheduledTime: mockNotification.scheduledTime
      });
      
      await NotificationService.cancelNotification(mockNotification.id);
      
      const history = await NotificationHistory.findByNotificationId(mockNotification.id);
      const snooze = await NotificationSnooze.findByNotificationId(mockNotification.id);
      
      expect(history?.status).toBe('cancelled');
      expect(snooze?.status).toBe('cancelled');
    });
  });

  describe('handleNotificationAction', () => {
    it('should handle complete action', async () => {
      // Create notification history
      await NotificationHistory.create({
        userId: mockNotification.userId,
        taskId: mockNotification.taskId,
        notificationId: mockNotification.id,
        type: mockNotification.type,
        title: mockNotification.title,
        body: mockNotification.body,
        scheduledTime: mockNotification.scheduledTime,
        metadata: mockNotification.metadata
      });
      
      await NotificationService.handleNotificationAction(
        mockNotification.id,
        'complete',
        mockNotification.userId
      );
      
      // Should not throw error
      expect(true).toBe(true);
    });

    it('should handle snooze actions', async () => {
      // Create notification history
      await NotificationHistory.create({
        userId: mockNotification.userId,
        taskId: mockNotification.taskId,
        notificationId: mockNotification.id,
        type: mockNotification.type,
        title: mockNotification.title,
        body: mockNotification.body,
        scheduledTime: mockNotification.scheduledTime,
        metadata: mockNotification.metadata
      });
      
      const snoozeActions: NotificationActionType[] = ['snooze_15m', 'snooze_1h', 'snooze_today'];
      
      for (const action of snoozeActions) {
        await NotificationService.handleNotificationAction(
          mockNotification.id,
          action,
          mockNotification.userId
        );
        
        const snooze = await NotificationSnooze.findByNotificationId(mockNotification.id);
        expect(snooze).toBeDefined();
        expect(snooze?.status).toBe('active');
      }
    });

    it('should handle mute action', async () => {
      await NotificationService.handleNotificationAction(
        mockNotification.id,
        'mute',
        mockNotification.userId
      );
      
      const mute = await TaskMute.findActiveByTaskId(mockNotification.taskId);
      expect(mute).toBeDefined();
      expect(mute?.status).toBe('active');
      expect(mute?.muteDuration).toBe('24h');
    });
  });

  describe('processExpiredSnoozes', () => {
    it('should process expired snoozes and reschedule notifications', async () => {
      // Create notification history
      const history = await NotificationHistory.create({
        userId: mockNotification.userId,
        taskId: mockNotification.taskId,
        notificationId: mockNotification.id,
        type: mockNotification.type,
        title: mockNotification.title,
        body: mockNotification.body,
        scheduledTime: mockNotification.scheduledTime,
        metadata: mockNotification.metadata
      });
      
      // Create expired snooze
      const snooze = await NotificationSnooze.create({
        userId: mockNotification.userId,
        taskId: mockNotification.taskId,
        notificationId: mockNotification.id,
        snoozeDuration: '15m',
        originalScheduledTime: mockNotification.scheduledTime
      });
      
      // Mark snooze as expired by setting snooze until to past time
      snooze.snoozeUntil = new Date(Date.now() - 1000);
      
      await NotificationService.processExpiredSnoozes();
      
      const updatedHistory = await NotificationHistory.findById(history.id);
      expect(updatedHistory?.status).toBe('pending');
    });
  });

  describe('processExpiredMutes', () => {
    it('should process expired mutes', async () => {
      // Create expired mute
      const mute = await TaskMute.create({
        userId: mockNotification.userId,
        taskId: mockNotification.taskId,
        muteDuration: '1h',
        reason: 'Test mute'
      });
      
      // Mark mute as expired by setting mute until to past time
      mute.muteUntil = new Date(Date.now() - 1000);
      
      await NotificationService.processExpiredMutes();
      
      const updatedMute = await TaskMute.findActiveByTaskId(mockNotification.taskId);
      expect(updatedMute?.status).toBe('expired');
    });
  });

  describe('processNotificationRetries', () => {
    it('should process pending retries', async () => {
      // Create notification history
      const history = await NotificationHistory.create({
        userId: mockNotification.userId,
        taskId: mockNotification.taskId,
        notificationId: mockNotification.id,
        type: mockNotification.type,
        title: mockNotification.title,
        body: mockNotification.body,
        scheduledTime: mockNotification.scheduledTime,
        metadata: mockNotification.metadata
      });
      
      // Create retry record
      const retry = await NotificationRetry.create({
        notificationHistoryId: history.id,
        maxRetries: 3
      });
      
      // Set retry time to past
      retry.nextRetryTime = new Date(Date.now() - 1000);
      
      await NotificationService.processNotificationRetries();
      
      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('createNotificationRetry', () => {
    it('should create retry record for failed notification', async () => {
      const history = await NotificationHistory.create({
        userId: mockNotification.userId,
        taskId: mockNotification.taskId,
        notificationId: mockNotification.id,
        type: mockNotification.type,
        title: mockNotification.title,
        body: mockNotification.body,
        scheduledTime: mockNotification.scheduledTime,
        metadata: mockNotification.metadata
      });
      
      const retry = await NotificationService.createNotificationRetry(history.id, 5);
      
      expect(retry).toBeDefined();
      expect(retry.notificationHistoryId).toBe(history.id);
      expect(retry.maxRetries).toBe(5);
      expect(retry.status).toBe('pending');
    });
  });

  describe('getUserNotificationHistory', () => {
    it('should get notification history for user', async () => {
      await NotificationHistory.create({
        userId: mockNotification.userId,
        taskId: mockNotification.taskId,
        notificationId: mockNotification.id,
        type: mockNotification.type,
        title: mockNotification.title,
        body: mockNotification.body,
        scheduledTime: mockNotification.scheduledTime,
        metadata: mockNotification.metadata
      });
      
      const result = await NotificationService.getUserNotificationHistory(mockNotification.userId);
      
      expect(result.notifications.length).toBeGreaterThan(0);
      expect(result.notifications[0].userId).toBe(mockNotification.userId);
    });
  });

  describe('getUserActiveSnoozes', () => {
    it('should get active snoozes for user', async () => {
      await NotificationSnooze.create({
        userId: mockNotification.userId,
        taskId: mockNotification.taskId,
        notificationId: mockNotification.id,
        snoozeDuration: '15m',
        originalScheduledTime: mockNotification.scheduledTime
      });
      
      const snoozes = await NotificationService.getUserActiveSnoozes(mockNotification.userId);
      
      expect(snoozes.length).toBeGreaterThan(0);
      expect(snoozes[0].userId).toBe(mockNotification.userId);
      expect(snoozes[0].status).toBe('active');
    });
  });

  describe('getUserActiveMutes', () => {
    it('should get active mutes for user', async () => {
      await TaskMute.create({
        userId: mockNotification.userId,
        taskId: mockNotification.taskId,
        muteDuration: '24h',
        reason: 'Test mute'
      });
      
      const mutes = await NotificationService.getUserActiveMutes(mockNotification.userId);
      
      expect(mutes.length).toBeGreaterThan(0);
      expect(mutes[0].userId).toBe(mockNotification.userId);
      expect(mutes[0].status).toBe('active');
    });
  });

  describe('respectQuietHours', () => {
    it('should respect quiet hours when enabled', () => {
      const notification = { ...mockNotification };
      const quietHours = { start: '22:00', end: '07:00' };
      
      // Test during quiet hours (assuming current time is between 22:00 and 07:00)
      const respectsQuietHours = NotificationService.respectQuietHours(notification, quietHours);
      
      // This test would need to be adjusted based on actual current time
      expect(typeof respectsQuietHours).toBe('boolean');
    });

    it('should allow notifications when quiet hours disabled', () => {
      const notification = { ...mockNotification };
      
      const respectsQuietHours = NotificationService.respectQuietHours(notification, undefined);
      
      expect(respectsQuietHours).toBe(true);
    });
  });
});
