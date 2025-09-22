import { NotificationService } from '../notificationService';
import { NotificationManager } from '../notificationManager';
import { BackgroundProcessor } from '../backgroundProcessor';
import { NotificationHistory } from '../../models/NotificationHistory';
import { NotificationSnooze } from '../../models/NotificationSnooze';
import { TaskMute } from '../../models/TaskMute';
import { Task } from '../../models/Task';
import { User } from '../../models/User';
import { LocationNotification } from '../notificationService';

describe('Notification Persistence Integration', () => {
  let testUser: User;
  let testTask: Task;
  let mockNotification: LocationNotification;

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      deviceId: 'test-device-123',
      email: 'test@example.com',
      preferences: {
        quietHours: { start: '22:00', end: '07:00' },
        notificationStyle: 'standard'
      }
    });

    // Create test task
    testTask = await Task.create({
      userId: testUser.id,
      title: 'Test Task',
      description: 'Test task for notification persistence',
      locationType: 'custom_place',
      placeId: 'test-place-123'
    });

    // Create mock notification
    mockNotification = {
      id: `notification_${testTask.id}`,
      taskId: testTask.id,
      userId: testUser.id,
      type: 'approach',
      title: 'Approaching Test Location',
      body: 'You are approaching your test location',
      actions: [
        { id: 'complete', title: 'Complete', type: 'complete' },
        { id: 'snooze_15m', title: 'Snooze 15m', type: 'snooze_15m' },
        { id: 'mute', title: 'Mute', type: 'mute' }
      ],
      scheduledTime: new Date(),
      metadata: {
        geofenceId: 'test-geofence-123',
        geofenceType: 'approach_1mi',
        location: { latitude: 37.7749, longitude: -122.4194 }
      }
    };

    // Mock console methods to avoid test output noise
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(async () => {
    // Clean up test data
    try {
      if (testTask) await testTask.delete();
      if (testUser) await testUser.delete();
    } catch (error) {
      // Ignore cleanup errors
    }
    
    jest.restoreAllMocks();
  });

  describe('End-to-End Notification Flow', () => {
    it('should create, schedule, snooze, and process notification', async () => {
      // 1. Schedule notification
      await NotificationService.scheduleNotification(mockNotification);

      // Verify notification history was created
      const history = await NotificationHistory.findByNotificationId(mockNotification.id);
      expect(history).toBeTruthy();
      expect(history!.status).toBe('pending');
      expect(history!.title).toBe(mockNotification.title);

      // 2. Snooze the notification
      const snoozeResult = await NotificationManager.snoozeTaskNotifications(
        testTask.id,
        testUser.id,
        '15m',
        'User requested snooze'
      );

      expect(snoozeResult.snoozedCount).toBe(1);
      expect(snoozeResult.snoozes).toHaveLength(1);

      // Verify snooze was created
      const snooze = await NotificationSnooze.findByNotificationId(mockNotification.id);
      expect(snooze).toBeTruthy();
      expect(snooze!.snoozeDuration).toBe('15m');
      expect(snooze!.status).toBe('active');

      // Verify notification was marked as snoozed
      const updatedHistory = await NotificationHistory.findByNotificationId(mockNotification.id);
      expect(updatedHistory!.status).toBe('snoozed');

      // 3. Simulate snooze expiration by updating the snooze_until time
      await snooze!.markExpired();

      // 4. Process expired snoozes
      await NotificationService.processExpiredSnoozes();

      // Verify notification was rescheduled
      const rescheduledHistory = await NotificationHistory.findByNotificationId(mockNotification.id);
      expect(rescheduledHistory!.status).toBe('pending');
    });

    it('should handle task muting and unmuting', async () => {
      // 1. Schedule notification
      await NotificationService.scheduleNotification(mockNotification);

      // 2. Mute the task
      const mute = await NotificationManager.muteTask(
        testTask.id,
        testUser.id,
        '1h',
        'User requested mute'
      );

      expect(mute.muteDuration).toBe('1h');
      expect(mute.status).toBe('active');

      // Verify task is muted
      const isMuted = await TaskMute.isTaskMuted(testTask.id);
      expect(isMuted).toBe(true);

      // Verify pending notifications were cancelled
      const history = await NotificationHistory.findByNotificationId(mockNotification.id);
      expect(history!.status).toBe('cancelled');

      // 3. Unmute the task
      await NotificationManager.unmuteTask(testTask.id, testUser.id);

      // Verify mute was cancelled
      const updatedMute = await TaskMute.findActiveByTaskId(testTask.id);
      expect(updatedMute).toBeNull();
    });

    it('should provide comprehensive notification insights', async () => {
      // Create multiple notifications with different statuses
      const notifications = [
        { ...mockNotification, id: 'notification_1' },
        { ...mockNotification, id: 'notification_2' },
        { ...mockNotification, id: 'notification_3' }
      ];

      for (const notification of notifications) {
        await NotificationService.scheduleNotification(notification);
      }

      // Mark one as delivered
      const history1 = await NotificationHistory.findByNotificationId('notification_1');
      await history1!.markDelivered();

      // Mark one as failed
      const history2 = await NotificationHistory.findByNotificationId('notification_2');
      await history2!.markFailed('Test failure');

      // Snooze one
      await NotificationSnooze.create({
        userId: testUser.id,
        taskId: testTask.id,
        notificationId: 'notification_3',
        snoozeDuration: '15m',
        originalScheduledTime: new Date()
      });

      // Get insights
      const insights = await NotificationManager.getNotificationInsights(testUser.id);

      expect(insights.summary.totalNotifications).toBe(3);
      expect(insights.summary.deliveredNotifications).toBe(1);
      expect(insights.summary.failedNotifications).toBe(1);
      expect(insights.summary.activeSnoozes).toBe(1);
      expect(insights.deliveryRate.deliveryRate).toBeCloseTo(0.33, 1);
      expect(insights.recommendations).toContain(
        expect.stringContaining('delivery rate is below 80%')
      );
    });
  });

  describe('Background Processing', () => {
    it('should process expired snoozes and mutes', async () => {
      // Create expired snooze
      const expiredSnooze = await NotificationSnooze.create({
        userId: testUser.id,
        taskId: testTask.id,
        notificationId: mockNotification.id,
        snoozeDuration: '15m',
        originalScheduledTime: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      });

      // Manually set snooze_until to past time
      await expiredSnooze.markExpired();

      // Create expired mute
      const expiredMute = await TaskMute.create({
        userId: testUser.id,
        taskId: testTask.id,
        muteDuration: '1h'
      });

      // Manually set mute_until to past time
      await expiredMute.markExpired();

      // Create notification history for the snooze
      await NotificationHistory.create({
        userId: testUser.id,
        taskId: testTask.id,
        notificationId: mockNotification.id,
        type: 'approach',
        title: mockNotification.title,
        body: mockNotification.body,
        scheduledTime: mockNotification.scheduledTime,
        metadata: mockNotification.metadata
      });

      // Process expired items
      await BackgroundProcessor.processAll();

      // Verify snooze was processed
      const processedSnooze = await NotificationSnooze.findByNotificationId(mockNotification.id);
      expect(processedSnooze!.status).toBe('expired');

      // Verify mute was processed
      const processedMute = await TaskMute.findActiveByTaskId(testTask.id);
      expect(processedMute).toBeNull();
    });

    it('should handle background processor lifecycle', async () => {
      // Configure processor
      BackgroundProcessor.configure({
        intervalMinutes: 1,
        enableSnoozeProcessing: true,
        enableMuteProcessing: true
      });

      // Check initial status
      let status = BackgroundProcessor.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.config.intervalMinutes).toBe(1);

      // Start processor
      BackgroundProcessor.start();
      status = BackgroundProcessor.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.nextRun).toBeInstanceOf(Date);

      // Get stats
      const stats = await BackgroundProcessor.getStats();
      expect(stats).toHaveProperty('pendingSnoozes');
      expect(stats).toHaveProperty('pendingMutes');
      expect(stats).toHaveProperty('scheduledNotifications');

      // Stop processor
      BackgroundProcessor.stop();
      status = BackgroundProcessor.getStatus();
      expect(status.isRunning).toBe(false);
    });
  });

  describe('Notification Actions', () => {
    it('should handle complete action', async () => {
      await NotificationService.scheduleNotification(mockNotification);

      // Handle complete action
      await NotificationService.handleNotificationAction(
        mockNotification.id,
        'complete',
        testUser.id
      );

      // Verify task was completed
      const updatedTask = await Task.findById(testTask.id, testUser.id);
      expect(updatedTask!.status).toBe('completed');
    });

    it('should handle snooze actions', async () => {
      await NotificationService.scheduleNotification(mockNotification);

      // Handle snooze action
      await NotificationService.handleNotificationAction(
        mockNotification.id,
        'snooze_1h',
        testUser.id
      );

      // Verify snooze was created
      const snooze = await NotificationSnooze.findByNotificationId(mockNotification.id);
      expect(snooze).toBeTruthy();
      expect(snooze!.snoozeDuration).toBe('1h');

      // Verify notification was marked as snoozed
      const history = await NotificationHistory.findByNotificationId(mockNotification.id);
      expect(history!.status).toBe('snoozed');
    });

    it('should handle mute action', async () => {
      await NotificationService.scheduleNotification(mockNotification);

      // Handle mute action
      await NotificationService.handleNotificationAction(
        mockNotification.id,
        'mute',
        testUser.id
      );

      // Verify task was muted
      const isMuted = await TaskMute.isTaskMuted(testTask.id);
      expect(isMuted).toBe(true);

      // Verify mute record was created
      const mute = await TaskMute.findActiveByTaskId(testTask.id);
      expect(mute).toBeTruthy();
      expect(mute!.muteDuration).toBe('24h');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid notification actions gracefully', async () => {
      await expect(
        NotificationService.handleNotificationAction(
          'invalid-notification-id',
          'complete',
          testUser.id
        )
      ).rejects.toThrow();
    });

    it('should handle unauthorized access attempts', async () => {
      const otherUser = await User.create({
        deviceId: 'other-device-123',
        email: 'other@example.com'
      });

      await expect(
        NotificationManager.snoozeTaskNotifications(
          testTask.id,
          otherUser.id,
          '15m'
        )
      ).rejects.toThrow('Task not found or access denied');

      await otherUser.delete();
    });

    it('should handle duplicate snooze attempts', async () => {
      await NotificationService.scheduleNotification(mockNotification);

      // Create first snooze
      await NotificationManager.snoozeTaskNotifications(
        testTask.id,
        testUser.id,
        '15m'
      );

      // Attempt to create another snooze (should extend existing)
      const result = await NotificationManager.snoozeTaskNotifications(
        testTask.id,
        testUser.id,
        '1h'
      );

      expect(result.snoozedCount).toBe(1);

      // Verify snooze was extended, not duplicated
      const snoozes = await NotificationSnooze.findActiveByUserId(testUser.id);
      expect(snoozes).toHaveLength(1);
      expect(snoozes[0].snoozeDuration).toBe('1h'); // Should be updated to new duration
    });
  });

  describe('Performance and Limits', () => {
    it('should handle notification frequency limits', async () => {
      // Create multiple notifications
      const notifications = Array.from({ length: 15 }, (_, i) => ({
        ...mockNotification,
        id: `notification_${i}`,
        scheduledTime: new Date(Date.now() - i * 60 * 1000) // Spread over last 15 minutes
      }));

      for (const notification of notifications) {
        await NotificationService.scheduleNotification(notification);
      }

      // Check limits
      const limits = await NotificationManager.checkNotificationLimits(testUser.id, 1);
      expect(limits.currentCount).toBeGreaterThan(10);
      expect(limits.withinLimits).toBe(false);
    });

    it('should provide accurate delivery rate calculations', async () => {
      // Create notifications with mixed delivery status
      const notifications = [
        { ...mockNotification, id: 'delivered_1' },
        { ...mockNotification, id: 'delivered_2' },
        { ...mockNotification, id: 'failed_1' },
        { ...mockNotification, id: 'pending_1' }
      ];

      for (const notification of notifications) {
        await NotificationService.scheduleNotification(notification);
      }

      // Mark some as delivered
      const delivered1 = await NotificationHistory.findByNotificationId('delivered_1');
      await delivered1!.markDelivered();

      const delivered2 = await NotificationHistory.findByNotificationId('delivered_2');
      await delivered2!.markDelivered();

      // Mark one as failed
      const failed1 = await NotificationHistory.findByNotificationId('failed_1');
      await failed1!.markFailed('Test failure');

      // Get delivery rate
      const deliveryRate = await NotificationManager.getNotificationDeliveryRate(testUser.id, 1);
      
      expect(deliveryRate.totalSent).toBe(4);
      expect(deliveryRate.delivered).toBe(2);
      expect(deliveryRate.failed).toBe(1);
      expect(deliveryRate.deliveryRate).toBe(0.5); // 2 delivered out of 4 total
    });
  });
});