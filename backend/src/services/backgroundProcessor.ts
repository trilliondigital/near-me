import { NotificationService } from './notificationService';
import { NotificationScheduler } from './notificationScheduler';

export interface BackgroundProcessorConfig {
  intervalMinutes: number;
  enableSnoozeProcessing: boolean;
  enableMuteProcessing: boolean;
  enableRetryProcessing: boolean;
  enableSchedulerProcessing: boolean;
  enableCleanup: boolean;
  cleanupOlderThanHours: number;
}

export class BackgroundProcessor {
  private static readonly DEFAULT_CONFIG: BackgroundProcessorConfig = {
    intervalMinutes: 5, // Run every 5 minutes
    enableSnoozeProcessing: true,
    enableMuteProcessing: true,
    enableRetryProcessing: true,
    enableSchedulerProcessing: true,
    enableCleanup: true,
    cleanupOlderThanHours: 24
  };

  private static config: BackgroundProcessorConfig = this.DEFAULT_CONFIG;
  private static intervalId: NodeJS.Timeout | null = null;
  private static isRunning = false;

  /**
   * Configure the background processor
   */
  static configure(config: Partial<BackgroundProcessorConfig>): void {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the background processor
   */
  static start(): void {
    if (this.isRunning) {
      console.log('Background processor is already running');
      return;
    }

    console.log(`🔄 Starting background processor (interval: ${this.config.intervalMinutes} minutes)`);
    
    // Run immediately on start
    this.processAll();

    // Set up recurring processing
    this.intervalId = setInterval(() => {
      this.processAll();
    }, this.config.intervalMinutes * 60 * 1000);

    this.isRunning = true;
  }

  /**
   * Stop the background processor
   */
  static stop(): void {
    if (!this.isRunning) {
      console.log('Background processor is not running');
      return;
    }

    console.log('🛑 Stopping background processor');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
  }

  /**
   * Process all background tasks
   */
  static async processAll(): Promise<void> {
    const startTime = Date.now();
    console.log('🔄 Starting background processing cycle');

    const results = {
      expiredSnoozes: 0,
      expiredMutes: 0,
      processedRetries: 0,
      deliveredNotifications: 0,
      cleanedNotifications: 0,
      errors: [] as string[]
    };

    try {
      // Process expired snoozes
      if (this.config.enableSnoozeProcessing) {
        try {
          const snoozesBefore = await this.countExpiredSnoozes();
          await NotificationService.processExpiredSnoozes();
          const snoozesAfter = await this.countExpiredSnoozes();
          results.expiredSnoozes = snoozesBefore - snoozesAfter;
        } catch (error) {
          const errorMsg = `Error processing expired snoozes: ${error instanceof Error ? error.message : 'Unknown error'}`;
          results.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Process expired mutes
      if (this.config.enableMuteProcessing) {
        try {
          const mutesBefore = await this.countExpiredMutes();
          await NotificationService.processExpiredMutes();
          const mutesAfter = await this.countExpiredMutes();
          results.expiredMutes = mutesBefore - mutesAfter;
        } catch (error) {
          const errorMsg = `Error processing expired mutes: ${error instanceof Error ? error.message : 'Unknown error'}`;
          results.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Process notification retries
      if (this.config.enableRetryProcessing) {
        try {
          await NotificationService.processNotificationRetries();
          results.processedRetries = 1; // Placeholder - would need to track actual count
        } catch (error) {
          const errorMsg = `Error processing notification retries: ${error instanceof Error ? error.message : 'Unknown error'}`;
          results.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Process pending notifications
      if (this.config.enableSchedulerProcessing) {
        try {
          const schedulerStats = await NotificationScheduler.processPendingNotifications();
          results.deliveredNotifications = schedulerStats.delivered;
        } catch (error) {
          const errorMsg = `Error processing pending notifications: ${error instanceof Error ? error.message : 'Unknown error'}`;
          results.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Cleanup old notifications
      if (this.config.enableCleanup) {
        try {
          results.cleanedNotifications = NotificationScheduler.cleanupOldNotifications(
            this.config.cleanupOlderThanHours
          );
        } catch (error) {
          const errorMsg = `Error cleaning up old notifications: ${error instanceof Error ? error.message : 'Unknown error'}`;
          results.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Background processing completed in ${duration}ms:`, {
        expiredSnoozes: results.expiredSnoozes,
        expiredMutes: results.expiredMutes,
        deliveredNotifications: results.deliveredNotifications,
        cleanedNotifications: results.cleanedNotifications,
        errors: results.errors.length
      });

      if (results.errors.length > 0) {
        console.error('Background processing errors:', results.errors);
      }

    } catch (error) {
      console.error('Critical error in background processing:', error);
    }
  }

  /**
   * Get processor status
   */
  static getStatus(): {
    isRunning: boolean;
    config: BackgroundProcessorConfig;
    nextRun?: Date;
  } {
    const status = {
      isRunning: this.isRunning,
      config: this.config
    };

    if (this.isRunning) {
      return {
        ...status,
        nextRun: new Date(Date.now() + this.config.intervalMinutes * 60 * 1000)
      };
    }

    return status;
  }

  /**
   * Force run all background tasks (for testing/admin)
   */
  static async forceRun(): Promise<void> {
    console.log('🔧 Force running background processor');
    await this.processAll();
  }

  /**
   * Count expired snoozes (helper for metrics)
   */
  private static async countExpiredSnoozes(): Promise<number> {
    try {
      const { NotificationSnooze } = await import('../models/NotificationSnooze');
      const expiredSnoozes = await NotificationSnooze.findExpiredSnoozes();
      return expiredSnoozes.length;
    } catch (error) {
      console.error('Error counting expired snoozes:', error);
      return 0;
    }
  }

  /**
   * Count expired mutes (helper for metrics)
   */
  private static async countExpiredMutes(): Promise<number> {
    try {
      const { TaskMute } = await import('../models/TaskMute');
      const expiredMutes = await TaskMute.findExpiredMutes();
      return expiredMutes.length;
    } catch (error) {
      console.error('Error counting expired mutes:', error);
      return 0;
    }
  }

  /**
   * Get processing statistics
   */
  static async getStats(): Promise<{
    pendingSnoozes: number;
    pendingMutes: number;
    scheduledNotifications: number;
    systemStats: any;
  }> {
    try {
      const [pendingSnoozes, pendingMutes] = await Promise.all([
        this.countExpiredSnoozes(),
        this.countExpiredMutes()
      ]);

      const systemStats = NotificationScheduler.getStats();

      return {
        pendingSnoozes,
        pendingMutes,
        scheduledNotifications: systemStats.totalScheduled,
        systemStats
      };
    } catch (error) {
      console.error('Error getting background processor stats:', error);
      return {
        pendingSnoozes: 0,
        pendingMutes: 0,
        scheduledNotifications: 0,
        systemStats: {}
      };
    }
  }
}