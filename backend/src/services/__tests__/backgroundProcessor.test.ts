import { BackgroundProcessor } from '../backgroundProcessor';
import { NotificationService } from '../notificationService';
import { NotificationScheduler } from '../notificationScheduler';
import { NotificationSnooze } from '../../models/NotificationSnooze';
import { TaskMute } from '../../models/TaskMute';

// Mock the services
jest.mock('../notificationService');
jest.mock('../notificationScheduler');
jest.mock('../../models/NotificationSnooze');
jest.mock('../../models/TaskMute');

const mockNotificationService = NotificationService as jest.Mocked<typeof NotificationService>;
const mockNotificationScheduler = NotificationScheduler as jest.Mocked<typeof NotificationScheduler>;
const mockNotificationSnooze = NotificationSnooze as jest.Mocked<typeof NotificationSnooze>;
const mockTaskMute = TaskMute as jest.Mocked<typeof TaskMute>;

describe('BackgroundProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    BackgroundProcessor.stop(); // Ensure processor is stopped before each test
    
    // Mock console methods to avoid test output noise
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    BackgroundProcessor.stop();
    jest.restoreAllMocks();
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const status = BackgroundProcessor.getStatus();
      
      expect(status.config).toEqual({
        intervalMinutes: 5,
        enableSnoozeProcessing: true,
        enableMuteProcessing: true,
        enableRetryProcessing: true,
        enableSchedulerProcessing: true,
        enableCleanup: true,
        cleanupOlderThanHours: 24
      });
    });

    it('should allow configuration updates', () => {
      const customConfig = {
        intervalMinutes: 10,
        enableSnoozeProcessing: false,
        cleanupOlderThanHours: 48
      };

      BackgroundProcessor.configure(customConfig);
      const status = BackgroundProcessor.getStatus();

      expect(status.config.intervalMinutes).toBe(10);
      expect(status.config.enableSnoozeProcessing).toBe(false);
      expect(status.config.cleanupOlderThanHours).toBe(48);
      // Other values should remain default
      expect(status.config.enableMuteProcessing).toBe(true);
    });
  });

  describe('Start/Stop', () => {
    it('should start and stop the processor', () => {
      expect(BackgroundProcessor.getStatus().isRunning).toBe(false);

      BackgroundProcessor.start();
      expect(BackgroundProcessor.getStatus().isRunning).toBe(true);

      BackgroundProcessor.stop();
      expect(BackgroundProcessor.getStatus().isRunning).toBe(false);
    });

    it('should not start if already running', () => {
      BackgroundProcessor.start();
      const consoleSpy = jest.spyOn(console, 'log');
      
      BackgroundProcessor.start(); // Try to start again
      
      expect(consoleSpy).toHaveBeenCalledWith('Background processor is already running');
    });

    it('should not stop if not running', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      BackgroundProcessor.stop(); // Try to stop when not running
      
      expect(consoleSpy).toHaveBeenCalledWith('Background processor is not running');
    });
  });

  describe('Processing', () => {
    beforeEach(() => {
      // Mock successful processing
      mockNotificationService.processExpiredSnoozes.mockResolvedValue();
      mockNotificationService.processExpiredMutes.mockResolvedValue();
      mockNotificationService.processNotificationRetries.mockResolvedValue();
      mockNotificationScheduler.processPendingNotifications.mockResolvedValue({
        processed: 5,
        delivered: 3,
        failed: 1,
        rescheduled: 1
      });
      mockNotificationScheduler.cleanupOldNotifications.mockReturnValue(2);
      
      // Mock count methods
      mockNotificationSnooze.findExpiredSnoozes.mockResolvedValue([]);
      mockTaskMute.findExpiredMutes.mockResolvedValue([]);
    });

    it('should process all tasks when enabled', async () => {
      await BackgroundProcessor.processAll();

      expect(mockNotificationService.processExpiredSnoozes).toHaveBeenCalled();
      expect(mockNotificationService.processExpiredMutes).toHaveBeenCalled();
      expect(mockNotificationService.processNotificationRetries).toHaveBeenCalled();
      expect(mockNotificationScheduler.processPendingNotifications).toHaveBeenCalled();
      expect(mockNotificationScheduler.cleanupOldNotifications).toHaveBeenCalledWith(24);
    });

    it('should skip disabled tasks', async () => {
      BackgroundProcessor.configure({
        enableSnoozeProcessing: false,
        enableMuteProcessing: false
      });

      await BackgroundProcessor.processAll();

      expect(mockNotificationService.processExpiredSnoozes).not.toHaveBeenCalled();
      expect(mockNotificationService.processExpiredMutes).not.toHaveBeenCalled();
      expect(mockNotificationService.processNotificationRetries).toHaveBeenCalled();
      expect(mockNotificationScheduler.processPendingNotifications).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Processing failed');
      mockNotificationService.processExpiredSnoozes.mockRejectedValue(error);

      await BackgroundProcessor.processAll();

      // Should continue processing other tasks despite error
      expect(mockNotificationService.processExpiredMutes).toHaveBeenCalled();
      expect(mockNotificationService.processNotificationRetries).toHaveBeenCalled();
    });

    it('should force run processing', async () => {
      await BackgroundProcessor.forceRun();

      expect(mockNotificationService.processExpiredSnoozes).toHaveBeenCalled();
      expect(mockNotificationService.processExpiredMutes).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      // Mock statistics data
      mockNotificationSnooze.findExpiredSnoozes.mockResolvedValue([
        { id: '1' } as any,
        { id: '2' } as any
      ]);
      mockTaskMute.findExpiredMutes.mockResolvedValue([
        { id: '1' } as any
      ]);
      mockNotificationScheduler.getStats.mockReturnValue({
        totalScheduled: 10,
        pending: 5,
        delivered: 3,
        failed: 1,
        cancelled: 1
      });
    });

    it('should return processing statistics', async () => {
      const stats = await BackgroundProcessor.getStats();

      expect(stats).toEqual({
        pendingSnoozes: 2,
        pendingMutes: 1,
        scheduledNotifications: 10,
        systemStats: {
          totalScheduled: 10,
          pending: 5,
          delivered: 3,
          failed: 1,
          cancelled: 1
        }
      });
    });

    it('should handle statistics errors gracefully', async () => {
      mockNotificationSnooze.findExpiredSnoozes.mockRejectedValue(new Error('DB error'));

      const stats = await BackgroundProcessor.getStats();

      expect(stats.pendingSnoozes).toBe(0);
      expect(stats.pendingMutes).toBe(1); // Should still work for mutes
    });
  });

  describe('Status', () => {
    it('should return status when not running', () => {
      const status = BackgroundProcessor.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.config).toBeDefined();
      expect(status.nextRun).toBeUndefined();
    });

    it('should return status with next run time when running', () => {
      BackgroundProcessor.start();
      const status = BackgroundProcessor.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.nextRun).toBeInstanceOf(Date);
      expect(status.nextRun!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Integration', () => {
    it('should run processing cycle on start', (done) => {
      // Mock quick processing
      mockNotificationService.processExpiredSnoozes.mockResolvedValue();
      mockNotificationService.processExpiredMutes.mockResolvedValue();
      mockNotificationService.processNotificationRetries.mockResolvedValue();
      mockNotificationScheduler.processPendingNotifications.mockResolvedValue({
        processed: 0,
        delivered: 0,
        failed: 0,
        rescheduled: 0
      });
      mockNotificationScheduler.cleanupOldNotifications.mockReturnValue(0);
      mockNotificationSnooze.findExpiredSnoozes.mockResolvedValue([]);
      mockTaskMute.findExpiredMutes.mockResolvedValue([]);

      BackgroundProcessor.configure({ intervalMinutes: 0.01 }); // Very short interval for testing
      BackgroundProcessor.start();

      // Give it a moment to run the initial processing
      setTimeout(() => {
        expect(mockNotificationService.processExpiredSnoozes).toHaveBeenCalled();
        BackgroundProcessor.stop();
        done();
      }, 100);
    });
  });
});