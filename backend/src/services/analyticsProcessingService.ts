import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { db } from '../database/connection';
import { analyticsService } from './analyticsService';

interface ProcessingJob {
  id: string;
  type: 'aggregation' | 'cohort_analysis' | 'funnel_analysis' | 'retention_calculation';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  error?: string;
  result?: any;
}

interface AggregationConfig {
  timeWindow: 'hourly' | 'daily' | 'weekly' | 'monthly';
  metrics: string[];
  dimensions: string[];
}

class AnalyticsProcessingService extends EventEmitter {
  private static instance: AnalyticsProcessingService;
  private processingQueue: ProcessingJob[] = [];
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.startProcessingLoop();
  }

  static getInstance(): AnalyticsProcessingService {
    if (!AnalyticsProcessingService.instance) {
      AnalyticsProcessingService.instance = new AnalyticsProcessingService();
    }
    return AnalyticsProcessingService.instance;
  }

  // MARK: - Job Management
  
  async scheduleJob(type: ProcessingJob['type'], config?: any): Promise<string> {
    const job: ProcessingJob = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      status: 'pending'
    };

    this.processingQueue.push(job);
    logger.info('Analytics processing job scheduled', { jobId: job.id, type });
    
    return job.id;
  }

  async getJobStatus(jobId: string): Promise<ProcessingJob | null> {
    return this.processingQueue.find(job => job.id === jobId) || null;
  }

  private startProcessingLoop(): void {
    // Process jobs every 30 seconds
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing && this.processingQueue.length > 0) {
        await this.processNextJob();
      }
    }, 30000);

    // Also process immediately if there are pending jobs
    setInterval(() => {
      if (!this.isProcessing && this.processingQueue.some(job => job.status === 'pending')) {
        this.processNextJob();
      }
    }, 5000);
  }

  private async processNextJob(): Promise<void> {
    const job = this.processingQueue.find(job => job.status === 'pending');
    if (!job) return;

    this.isProcessing = true;
    job.status = 'running';
    job.startTime = new Date();

    try {
      logger.info('Processing analytics job', { jobId: job.id, type: job.type });

      let result;
      switch (job.type) {
        case 'aggregation':
          result = await this.processAggregation();
          break;
        case 'cohort_analysis':
          result = await this.processCohortAnalysis();
          break;
        case 'funnel_analysis':
          result = await this.processFunnelAnalysis();
          break;
        case 'retention_calculation':
          result = await this.processRetentionCalculation();
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      job.status = 'completed';
      job.result = result;
      job.endTime = new Date();

      this.emit('jobCompleted', job);
      logger.info('Analytics job completed', { 
        jobId: job.id, 
        type: job.type,
        duration: job.endTime.getTime() - job.startTime!.getTime()
      });

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.endTime = new Date();

      this.emit('jobFailed', job);
      logger.error('Analytics job failed', { 
        jobId: job.id, 
        type: job.type, 
        error: error.message 
      });
    } finally {
      this.isProcessing = false;
    }
  }

  // MARK: - Processing Methods

  private async processAggregation(): Promise<any> {
    try {
      // Create daily aggregations for the last 7 days
      const query = `
        INSERT INTO daily_analytics_summary (
          date,
          platform,
          daily_active_users,
          daily_sessions,
          total_events,
          tasks_created,
          tasks_completed,
          nudges_shown,
          places_added,
          completion_rate,
          engagement_rate
        )
        SELECT 
          DATE_TRUNC('day', timestamp) as date,
          platform,
          COUNT(DISTINCT user_id) as daily_active_users,
          COUNT(DISTINCT session_id) as daily_sessions,
          COUNT(*) as total_events,
          COUNT(CASE WHEN event_type = 'task_created' THEN 1 END) as tasks_created,
          COUNT(CASE WHEN event_type = 'task_completed' THEN 1 END) as tasks_completed,
          COUNT(CASE WHEN event_type = 'nudge_shown' THEN 1 END) as nudges_shown,
          COUNT(CASE WHEN event_type = 'place_added' THEN 1 END) as places_added,
          CASE 
            WHEN COUNT(CASE WHEN event_type = 'task_created' THEN 1 END) > 0 
            THEN COUNT(CASE WHEN event_type = 'task_completed' THEN 1 END)::DECIMAL / 
                 COUNT(CASE WHEN event_type = 'task_created' THEN 1 END) * 100
            ELSE 0 
          END as completion_rate,
          CASE 
            WHEN COUNT(CASE WHEN event_type = 'nudge_shown' THEN 1 END) > 0 
            THEN COUNT(CASE WHEN event_type = 'task_completed' THEN 1 END)::DECIMAL / 
                 COUNT(CASE WHEN event_type = 'nudge_shown' THEN 1 END) * 100
            ELSE 0 
          END as engagement_rate
        FROM user_events 
        WHERE timestamp >= NOW() - INTERVAL '7 days'
        AND timestamp < DATE_TRUNC('day', NOW())
        GROUP BY DATE_TRUNC('day', timestamp), platform
        ON CONFLICT (date, platform) 
        DO UPDATE SET
          daily_active_users = EXCLUDED.daily_active_users,
          daily_sessions = EXCLUDED.daily_sessions,
          total_events = EXCLUDED.total_events,
          tasks_created = EXCLUDED.tasks_created,
          tasks_completed = EXCLUDED.tasks_completed,
          nudges_shown = EXCLUDED.nudges_shown,
          places_added = EXCLUDED.places_added,
          completion_rate = EXCLUDED.completion_rate,
          engagement_rate = EXCLUDED.engagement_rate,
          updated_at = NOW()
      `;

      const result = await db.query(query);
      return { aggregated_rows: result.rowCount };
    } catch (error) {
      logger.error('Failed to process aggregation', error);
      throw error;
    }
  }

  private async processCohortAnalysis(): Promise<any> {
    try {
      // Update cohort analysis for users
      const query = `
        WITH user_cohorts AS (
          SELECT 
            user_id,
            DATE_TRUNC('week', MIN(timestamp)) as cohort_week,
            MIN(timestamp) as first_event
          FROM user_events
          GROUP BY user_id
        ),
        cohort_activity AS (
          SELECT 
            uc.cohort_week,
            uc.user_id,
            DATE_TRUNC('week', ue.timestamp) as activity_week,
            EXTRACT(WEEK FROM ue.timestamp) - EXTRACT(WEEK FROM uc.first_event) as week_number
          FROM user_cohorts uc
          JOIN user_events ue ON uc.user_id = ue.user_id
          WHERE ue.timestamp >= uc.first_event
        )
        INSERT INTO cohort_analysis (
          cohort_week,
          week_number,
          cohort_size,
          active_users,
          retention_rate
        )
        SELECT 
          cohort_week,
          week_number,
          COUNT(DISTINCT user_id) OVER (PARTITION BY cohort_week) as cohort_size,
          COUNT(DISTINCT user_id) as active_users,
          COUNT(DISTINCT user_id)::DECIMAL / 
            COUNT(DISTINCT user_id) OVER (PARTITION BY cohort_week) * 100 as retention_rate
        FROM cohort_activity
        WHERE week_number <= 12 -- Track up to 12 weeks
        GROUP BY cohort_week, week_number
        ON CONFLICT (cohort_week, week_number)
        DO UPDATE SET
          active_users = EXCLUDED.active_users,
          retention_rate = EXCLUDED.retention_rate,
          updated_at = NOW()
      `;

      const result = await db.query(query);
      return { cohort_rows: result.rowCount };
    } catch (error) {
      logger.error('Failed to process cohort analysis', error);
      throw error;
    }
  }

  private async processFunnelAnalysis(): Promise<any> {
    try {
      // Calculate conversion funnel metrics
      const query = `
        WITH funnel_data AS (
          SELECT 
            DATE_TRUNC('day', timestamp) as date,
            platform,
            COUNT(DISTINCT CASE WHEN event_type = 'app_opened' THEN user_id END) as app_opens,
            COUNT(DISTINCT CASE WHEN event_type = 'onboarding_started' THEN user_id END) as onboarding_starts,
            COUNT(DISTINCT CASE WHEN event_type = 'onboarding_completed' THEN user_id END) as onboarding_completions,
            COUNT(DISTINCT CASE WHEN event_type = 'task_created' THEN user_id END) as first_task_created,
            COUNT(DISTINCT CASE WHEN event_type = 'paywall_viewed' THEN user_id END) as paywall_views,
            COUNT(DISTINCT CASE WHEN event_type = 'trial_started' THEN user_id END) as trial_starts,
            COUNT(DISTINCT CASE WHEN event_type = 'premium_converted' THEN user_id END) as premium_conversions
          FROM user_events
          WHERE timestamp >= NOW() - INTERVAL '30 days'
          GROUP BY DATE_TRUNC('day', timestamp), platform
        )
        INSERT INTO funnel_analysis (
          date,
          platform,
          app_opens,
          onboarding_starts,
          onboarding_completions,
          first_task_created,
          paywall_views,
          trial_starts,
          premium_conversions,
          onboarding_conversion_rate,
          task_creation_rate,
          trial_conversion_rate,
          premium_conversion_rate
        )
        SELECT 
          date,
          platform,
          app_opens,
          onboarding_starts,
          onboarding_completions,
          first_task_created,
          paywall_views,
          trial_starts,
          premium_conversions,
          CASE WHEN onboarding_starts > 0 THEN onboarding_completions::DECIMAL / onboarding_starts * 100 ELSE 0 END,
          CASE WHEN onboarding_completions > 0 THEN first_task_created::DECIMAL / onboarding_completions * 100 ELSE 0 END,
          CASE WHEN paywall_views > 0 THEN trial_starts::DECIMAL / paywall_views * 100 ELSE 0 END,
          CASE WHEN trial_starts > 0 THEN premium_conversions::DECIMAL / trial_starts * 100 ELSE 0 END
        FROM funnel_data
        ON CONFLICT (date, platform)
        DO UPDATE SET
          app_opens = EXCLUDED.app_opens,
          onboarding_starts = EXCLUDED.onboarding_starts,
          onboarding_completions = EXCLUDED.onboarding_completions,
          first_task_created = EXCLUDED.first_task_created,
          paywall_views = EXCLUDED.paywall_views,
          trial_starts = EXCLUDED.trial_starts,
          premium_conversions = EXCLUDED.premium_conversions,
          onboarding_conversion_rate = EXCLUDED.onboarding_conversion_rate,
          task_creation_rate = EXCLUDED.task_creation_rate,
          trial_conversion_rate = EXCLUDED.trial_conversion_rate,
          premium_conversion_rate = EXCLUDED.premium_conversion_rate,
          updated_at = NOW()
      `;

      const result = await db.query(query);
      return { funnel_rows: result.rowCount };
    } catch (error) {
      logger.error('Failed to process funnel analysis', error);
      throw error;
    }
  }

  private async processRetentionCalculation(): Promise<any> {
    try {
      // Calculate user retention metrics
      const query = `
        WITH user_first_activity AS (
          SELECT 
            user_id,
            DATE_TRUNC('day', MIN(timestamp)) as first_activity_date
          FROM user_events
          GROUP BY user_id
        ),
        retention_data AS (
          SELECT 
            ufa.first_activity_date as cohort_date,
            ufa.user_id,
            CASE WHEN MAX(CASE WHEN DATE_TRUNC('day', ue.timestamp) = ufa.first_activity_date + INTERVAL '1 day' THEN 1 ELSE 0 END) = 1 THEN 1 ELSE 0 END as day_1_retained,
            CASE WHEN MAX(CASE WHEN DATE_TRUNC('day', ue.timestamp) BETWEEN ufa.first_activity_date + INTERVAL '7 days' AND ufa.first_activity_date + INTERVAL '13 days' THEN 1 ELSE 0 END) = 1 THEN 1 ELSE 0 END as day_7_retained,
            CASE WHEN MAX(CASE WHEN DATE_TRUNC('day', ue.timestamp) BETWEEN ufa.first_activity_date + INTERVAL '30 days' AND ufa.first_activity_date + INTERVAL '36 days' THEN 1 ELSE 0 END) = 1 THEN 1 ELSE 0 END as day_30_retained
          FROM user_first_activity ufa
          LEFT JOIN user_events ue ON ufa.user_id = ue.user_id
          WHERE ufa.first_activity_date >= NOW() - INTERVAL '60 days'
          GROUP BY ufa.first_activity_date, ufa.user_id
        )
        INSERT INTO retention_analysis (
          cohort_date,
          cohort_size,
          day_1_retained,
          day_7_retained,
          day_30_retained,
          day_1_retention_rate,
          day_7_retention_rate,
          day_30_retention_rate
        )
        SELECT 
          cohort_date,
          COUNT(*) as cohort_size,
          SUM(day_1_retained) as day_1_retained,
          SUM(day_7_retained) as day_7_retained,
          SUM(day_30_retained) as day_30_retained,
          SUM(day_1_retained)::DECIMAL / COUNT(*) * 100 as day_1_retention_rate,
          SUM(day_7_retained)::DECIMAL / COUNT(*) * 100 as day_7_retention_rate,
          SUM(day_30_retained)::DECIMAL / COUNT(*) * 100 as day_30_retention_rate
        FROM retention_data
        GROUP BY cohort_date
        ON CONFLICT (cohort_date)
        DO UPDATE SET
          cohort_size = EXCLUDED.cohort_size,
          day_1_retained = EXCLUDED.day_1_retained,
          day_7_retained = EXCLUDED.day_7_retained,
          day_30_retained = EXCLUDED.day_30_retained,
          day_1_retention_rate = EXCLUDED.day_1_retention_rate,
          day_7_retention_rate = EXCLUDED.day_7_retention_rate,
          day_30_retention_rate = EXCLUDED.day_30_retention_rate,
          updated_at = NOW()
      `;

      const result = await db.query(query);
      return { retention_rows: result.rowCount };
    } catch (error) {
      logger.error('Failed to process retention calculation', error);
      throw error;
    }
  }

  // MARK: - Scheduled Processing

  async scheduleRegularProcessing(): Promise<void> {
    // Schedule daily aggregation
    await this.scheduleJob('aggregation');
    
    // Schedule weekly cohort analysis
    const now = new Date();
    if (now.getDay() === 1) { // Monday
      await this.scheduleJob('cohort_analysis');
    }
    
    // Schedule daily funnel analysis
    await this.scheduleJob('funnel_analysis');
    
    // Schedule daily retention calculation
    await this.scheduleJob('retention_calculation');
    
    logger.info('Regular analytics processing jobs scheduled');
  }

  // MARK: - Cleanup

  async cleanup(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Remove completed jobs older than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.processingQueue = this.processingQueue.filter(job => 
      job.status === 'pending' || job.status === 'running' || 
      (job.endTime && job.endTime > cutoff)
    );
  }
}

export const analyticsProcessingService = AnalyticsProcessingService.getInstance();