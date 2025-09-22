import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { analyticsService } from './analyticsService';
import { analyticsProcessingService } from './analyticsProcessingService';
import { abTestingService } from './abTestingService';
import { alertingService } from './alertingService';

class AnalyticsManager extends EventEmitter {
  private static instance: AnalyticsManager;
  private isInitialized = false;
  private scheduledJobs: NodeJS.Timeout[] = [];

  private constructor() {
    super();
  }

  static getInstance(): AnalyticsManager {
    if (!AnalyticsManager.instance) {
      AnalyticsManager.instance = new AnalyticsManager();
    }
    return AnalyticsManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Analytics manager already initialized');
      return;
    }

    try {
      logger.info('Initializing analytics manager...');

      // Initialize services
      await this.initializeServices();

      // Set up event listeners
      this.setupEventListeners();

      // Schedule regular processing
      this.scheduleRegularTasks();

      this.isInitialized = true;
      logger.info('Analytics manager initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize analytics manager', error);
      throw error;
    }
  }

  private async initializeServices(): Promise<void> {
    // Services are initialized via their getInstance() methods
    // This ensures they're properly set up
    analyticsService;
    analyticsProcessingService;
    abTestingService;
    alertingService;

    logger.info('Analytics services initialized');
  }

  private setupEventListeners(): void {
    // Analytics processing events
    analyticsProcessingService.on('jobCompleted', (job) => {
      logger.info('Analytics processing job completed', { 
        jobId: job.id, 
        type: job.type,
        duration: job.endTime ? job.endTime.getTime() - job.startTime!.getTime() : 0
      });
    });

    analyticsProcessingService.on('jobFailed', (job) => {
      logger.error('Analytics processing job failed', { 
        jobId: job.id, 
        type: job.type, 
        error: job.error 
      });
      
      // Create alert for failed processing job
      alertingService.createAlert({
        alertType: 'processing_job_failed',
        severity: 'warning',
        title: 'Analytics Processing Job Failed',
        message: `Job ${job.type} (${job.id}) failed: ${job.error}`,
        metadata: { jobId: job.id, jobType: job.type }
      });
    });

    // A/B testing events
    abTestingService.on('experimentStarted', ({ experimentId }) => {
      logger.info('A/B experiment started', { experimentId });
    });

    abTestingService.on('experimentCompleted', ({ experimentId }) => {
      logger.info('A/B experiment completed', { experimentId });
    });

    abTestingService.on('userAssigned', ({ userId, experimentId, variant }) => {
      logger.debug('User assigned to A/B test', { userId, experimentId, variant });
    });

    // Alerting events
    alertingService.on('alertCreated', ({ alertId, severity, title }) => {
      logger.warn('Alert created', { alertId, severity, title });
    });

    alertingService.on('criticalAlert', ({ alertId, alert }) => {
      logger.critical('CRITICAL ALERT TRIGGERED', { alertId, alert });
      // In production, this would trigger immediate notifications
    });

    alertingService.on('alertResolved', ({ alertId }) => {
      logger.info('Alert resolved', { alertId });
    });

    logger.info('Analytics event listeners set up');
  }

  private scheduleRegularTasks(): void {
    // Schedule daily processing at 2 AM
    const dailyProcessing = this.scheduleDaily(2, 0, async () => {
      logger.info('Running daily analytics processing...');
      await analyticsProcessingService.scheduleRegularProcessing();
    });

    // Schedule hourly health checks
    const hourlyHealthCheck = setInterval(async () => {
      try {
        const health = await analyticsService.getSystemHealth();
        if (health.overall_status !== 'healthy') {
          logger.warn('System health check failed', { health });
        }
      } catch (error) {
        logger.error('Health check failed', error);
      }
    }, 60 * 60 * 1000); // Every hour

    // Schedule cleanup every 6 hours
    const cleanup = setInterval(async () => {
      try {
        logger.info('Running analytics cleanup...');
        await this.runCleanup();
      } catch (error) {
        logger.error('Cleanup failed', error);
      }
    }, 6 * 60 * 60 * 1000); // Every 6 hours

    this.scheduledJobs.push(dailyProcessing, hourlyHealthCheck, cleanup);
    logger.info('Regular analytics tasks scheduled');
  }

  private scheduleDaily(hour: number, minute: number, task: () => Promise<void>): NodeJS.Timeout {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(hour, minute, 0, 0);

    // If the scheduled time has passed today, schedule for tomorrow
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    const timeUntilExecution = scheduledTime.getTime() - now.getTime();

    return setTimeout(async () => {
      await task();
      
      // Reschedule for the next day
      this.scheduleDaily(hour, minute, task);
    }, timeUntilExecution);
  }

  private async runCleanup(): Promise<void> {
    try {
      // Clean up old analytics data
      await analyticsProcessingService.cleanup();
      await alertingService.cleanup();
      
      logger.info('Analytics cleanup completed');
    } catch (error) {
      logger.error('Analytics cleanup failed', error);
      throw error;
    }
  }

  // MARK: - Public Methods

  async getSystemStatus(): Promise<any> {
    try {
      const [
        systemHealth,
        activeAlerts,
        processingStatus
      ] = await Promise.all([
        analyticsService.getSystemHealth(),
        alertingService.getActiveAlerts(),
        this.getProcessingStatus()
      ]);

      return {
        timestamp: new Date(),
        overall_status: systemHealth.overall_status,
        health_checks: systemHealth.checks,
        active_alerts: activeAlerts.length,
        critical_alerts: activeAlerts.filter(alert => alert.severity === 'critical').length,
        processing_status: processingStatus,
        services: {
          analytics: 'running',
          processing: 'running',
          ab_testing: 'running',
          alerting: 'running'
        }
      };
    } catch (error) {
      logger.error('Failed to get system status', error);
      throw error;
    }
  }

  private async getProcessingStatus(): Promise<any> {
    // This would typically check the processing queue status
    // For now, return a simple status
    return {
      queue_size: 0,
      last_processing: new Date(),
      status: 'healthy'
    };
  }

  async triggerManualProcessing(): Promise<void> {
    try {
      logger.info('Triggering manual analytics processing...');
      await analyticsProcessingService.scheduleRegularProcessing();
      logger.info('Manual analytics processing triggered');
    } catch (error) {
      logger.error('Failed to trigger manual processing', error);
      throw error;
    }
  }

  // MARK: - Shutdown

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down analytics manager...');

      // Clear scheduled jobs
      this.scheduledJobs.forEach(job => clearTimeout(job));
      this.scheduledJobs = [];

      // Cleanup services
      await analyticsProcessingService.cleanup();
      await alertingService.cleanup();

      this.isInitialized = false;
      logger.info('Analytics manager shut down successfully');

    } catch (error) {
      logger.error('Failed to shutdown analytics manager', error);
      throw error;
    }
  }
}

export const analyticsManager = AnalyticsManager.getInstance();