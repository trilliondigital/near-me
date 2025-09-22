import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { db } from '../database/connection';
import { privacyService } from './privacyService';

export interface UserEvent {
  userId: string;
  deviceId: string;
  sessionId: string;
  eventType: string;
  eventData?: Record<string, any>;
  platform: 'ios' | 'android';
  appVersion: string;
  timestamp?: Date;
  analyticsConsent?: boolean;
  userAgent?: string;
  ipAddress?: string;
  countryCode?: string;
  timezone?: string;
}

export interface AnalyticsSession {
  sessionId: string;
  userId: string;
  deviceId: string;
  platform: 'ios' | 'android';
  appVersion: string;
  sessionStart: Date;
  sessionEnd?: Date;
  isFirstSession?: boolean;
  previousSessionId?: string;
}

export interface UserAnalyticsProperties {
  userId: string;
  nudgeStyle?: string;
  quietHours?: Record<string, any>;
  defaultRadii?: Record<string, any>;
  premiumStatus?: string;
  totalTasksCreated?: number;
  totalPlacesAdded?: number;
  totalNotificationsReceived?: number;
  totalTasksCompleted?: number;
  daysActive?: number;
  lastActiveDate?: Date;
  retentionCohort?: Date;
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: Date;
  trialStarted?: boolean;
  trialStartedAt?: Date;
  premiumConverted?: boolean;
  premiumConvertedAt?: Date;
  primaryCountry?: string;
  primaryTimezone?: string;
  primaryPlatform?: string;
}

export interface AnalyticsConfig {
  eventRetentionDays: number;
  sessionTimeoutMinutes: number;
  batchSize: number;
  privacyModeEnabled: boolean;
  anonymizationEnabled: boolean;
  samplingRate: number;
}

class AnalyticsService extends EventEmitter {
  private static instance: AnalyticsService;
  private eventBuffer: UserEvent[] = [];
  private sessionCache = new Map<string, AnalyticsSession>();
  private config: AnalyticsConfig;
  private bufferFlushInterval: NodeJS.Timeout;
  private sessionCleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    this.config = {
      eventRetentionDays: 90,
      sessionTimeoutMinutes: 30,
      batchSize: 100,
      privacyModeEnabled: true,
      anonymizationEnabled: true,
      samplingRate: 1.0
    };

    // Flush event buffer every 10 seconds
    this.bufferFlushInterval = setInterval(() => {
      this.flushEventBuffer();
    }, 10000);

    // Clean up expired sessions every 5 minutes
    this.sessionCleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 300000);

    this.loadConfiguration();
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  // MARK: - Event Tracking
  async trackEvent(event: UserEvent): Promise<void> {
    try {
      // Check user consent and privacy settings
      if (!await this.checkAnalyticsConsent(event.userId)) {
        logger.debug('Analytics tracking declined for user', { userId: event.userId });
        return;
      }

      // Apply sampling if configured
      if (Math.random() > this.config.samplingRate) {
        return;
      }

      // Validate event type
      if (!await this.isValidEventType(event.eventType)) {
        logger.warn('Invalid event type', { eventType: event.eventType });
        return;
      }

      // Enrich event with metadata
      const enrichedEvent = await this.enrichEvent(event);

      // Add to buffer for batch processing
      this.eventBuffer.push(enrichedEvent);

      // Update session if needed
      await this.updateSession(enrichedEvent);

      // Emit event for real-time processing
      this.emit('eventTracked', enrichedEvent);

      logger.debug('Event tracked', {
        userId: event.userId,
        eventType: event.eventType,
        sessionId: event.sessionId
      });

    } catch (error) {
      logger.error('Failed to track event', error);
      throw error;
    }
  }

  private async enrichEvent(event: UserEvent): Promise<UserEvent> {
    return {
      ...event,
      timestamp: event.timestamp || new Date(),
      analyticsConsent: event.analyticsConsent ?? true
    };
  }

  private async checkAnalyticsConsent(userId: string): Promise<boolean> {
    try {
      // Check user's privacy settings
      const privacySettings = await privacyService.getPrivacySettings(userId);
      return privacySettings?.analyticsEnabled ?? true;
    } catch (error) {
      logger.error('Failed to check analytics consent', error);
      return false; // Fail closed for privacy
    }
  }

  private async isValidEventType(eventType: string): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) as count 
        FROM event_type_definitions 
        WHERE event_type = $1 AND is_active = true
      `;
      const result = await db.query(query, [eventType]);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      logger.error('Failed to validate event type', error);
      return false;
    }
  }

  // MARK: - Session Management
  async startSession(session: AnalyticsSession): Promise<void> {
    try {
      // Check if this is user's first session
      const isFirstSession = await this.isFirstSession(session.userId);
      
      const enrichedSession = {
        ...session,
        sessionStart: new Date(),
        isFirstSession
      };

      // Cache session
      this.sessionCache.set(session.sessionId, enrichedSession);

      // Store in database
      await this.storeSession(enrichedSession);

      // Update user properties if first session
      if (isFirstSession) {
        await this.initializeUserProperties(session.userId);
      }

      logger.debug('Session started', {
        sessionId: session.sessionId,
        userId: session.userId,
        isFirstSession
      });

    } catch (error) {
      logger.error('Failed to start session', error);
      throw error;
    }
  }

  async endSession(sessionId: string): Promise<void> {
    try {
      const session = this.sessionCache.get(sessionId);
      if (!session) {
        logger.warn('Session not found for ending', { sessionId });
        return;
      }

      session.sessionEnd = new Date();
      
      // Update session in database
      await this.updateSessionInDatabase(session);

      // Remove from cache
      this.sessionCache.delete(sessionId);

      logger.debug('Session ended', {
        sessionId,
        duration: session.sessionEnd.getTime() - session.sessionStart.getTime()
      });

    } catch (error) {
      logger.error('Failed to end session', error);
      throw error;
    }
  }

  private async updateSession(event: UserEvent): Promise<void> {
    try {
      let session = this.sessionCache.get(event.sessionId);
      
      if (!session) {
        // Create new session if not exists
        session = {
          sessionId: event.sessionId,
          userId: event.userId,
          deviceId: event.deviceId,
          platform: event.platform,
          appVersion: event.appVersion,
          sessionStart: new Date(),
          isFirstSession: await this.isFirstSession(event.userId)
        };
        
        this.sessionCache.set(event.sessionId, session);
        await this.storeSession(session);
      }

      // Update session activity
      await this.updateSessionActivity(event.sessionId, event.eventType);

    } catch (error) {
      logger.error('Failed to update session', error);
    }
  }

  private async isFirstSession(userId: string): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) as count 
        FROM analytics_sessions 
        WHERE user_id = $1
      `;
      const result = await db.query(query, [userId]);
      return parseInt(result.rows[0].count) === 0;
    } catch (error) {
      logger.error('Failed to check first session', error);
      return false;
    }
  }

  private async updateSessionActivity(sessionId: string, eventType: string): Promise<void> {
    try {
      const updateQuery = `
        UPDATE analytics_sessions 
        SET 
          actions_performed = actions_performed + 1,
          screens_viewed = CASE 
            WHEN $2 LIKE '%_screen_viewed' THEN screens_viewed + 1 
            ELSE screens_viewed 
          END,
          notifications_interacted = CASE 
            WHEN $2 IN ('snooze_selected', 'task_completed') THEN notifications_interacted + 1 
            ELSE notifications_interacted 
          END,
          updated_at = NOW()
        WHERE session_id = $1
      `;
      
      await db.query(updateQuery, [sessionId, eventType]);
    } catch (error) {
      logger.error('Failed to update session activity', error);
    }
  }

  // MARK: - User Properties Management
  async updateUserProperties(userId: string, properties: Partial<UserAnalyticsProperties>): Promise<void> {
    try {
      const setClause = Object.keys(properties)
        .map((key, index) => `${this.camelToSnake(key)} = $${index + 2}`)
        .join(', ');
      
      const values = [userId, ...Object.values(properties)];
      
      const query = `
        INSERT INTO user_analytics_properties (user_id, ${Object.keys(properties).map(this.camelToSnake).join(', ')})
        VALUES ($1, ${Object.keys(properties).map((_, index) => `$${index + 2}`).join(', ')})
        ON CONFLICT (user_id) 
        DO UPDATE SET ${setClause}, updated_at = NOW()
      `;
      
      await db.query(query, values);

      logger.debug('User properties updated', { userId, properties });

    } catch (error) {
      logger.error('Failed to update user properties', error);
      throw error;
    }
  }

  private async initializeUserProperties(userId: string): Promise<void> {
    try {
      const query = `
        INSERT INTO user_analytics_properties (user_id, retention_cohort)
        VALUES ($1, CURRENT_DATE)
        ON CONFLICT (user_id) DO NOTHING
      `;
      
      await db.query(query, [userId]);
    } catch (error) {
      logger.error('Failed to initialize user properties', error);
    }
  }

  // MARK: - Business Event Tracking
  async trackTaskCreated(userId: string, sessionId: string, taskData: {
    taskId: string;
    locationType: string;
    placeId?: string;
    poiCategory?: string;
    hasDescription: boolean;
  }): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId,
      deviceId: '', // Will be enriched
      eventType: 'task_created',
      eventData: taskData,
      platform: 'ios', // Will be enriched
      appVersion: '' // Will be enriched
    });
  }

  async trackPlaceAdded(userId: string, sessionId: string, placeData: {
    placeId: string;
    placeType: string;
    method: string;
  }): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId,
      deviceId: '',
      eventType: 'place_added',
      eventData: placeData,
      platform: 'ios',
      appVersion: ''
    });
  }

  async trackGeofenceRegistered(userId: string, sessionId: string, geofenceData: {
    taskId: string;
    geofenceId: string;
    geofenceType: string;
    radiusMeters: number;
  }): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId,
      deviceId: '',
      eventType: 'geofence_registered',
      eventData: geofenceData,
      platform: 'ios',
      appVersion: ''
    });
  }

  async trackNudgeShown(userId: string, sessionId: string, nudgeData: {
    taskId: string;
    nudgeType: string;
    locationName?: string;
    distanceMeters?: number;
  }): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId,
      deviceId: '',
      eventType: 'nudge_shown',
      eventData: nudgeData,
      platform: 'ios',
      appVersion: ''
    });
  }

  async trackTaskCompleted(userId: string, sessionId: string, completionData: {
    taskId: string;
    completionMethod: string;
    timeToCompleteHours?: number;
    nudgesReceived?: number;
  }): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId,
      deviceId: '',
      eventType: 'task_completed',
      eventData: completionData,
      platform: 'ios',
      appVersion: ''
    });
  }

  async trackSnoozeSelected(userId: string, sessionId: string, snoozeData: {
    taskId: string;
    snoozeDuration: string;
    nudgeType?: string;
  }): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId,
      deviceId: '',
      eventType: 'snooze_selected',
      eventData: snoozeData,
      platform: 'ios',
      appVersion: ''
    });
  }

  async trackPaywallViewed(userId: string, sessionId: string, paywallData: {
    trigger: string;
    currentTaskCount?: number;
  }): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId,
      deviceId: '',
      eventType: 'paywall_viewed',
      eventData: paywallData,
      platform: 'ios',
      appVersion: ''
    });
  }

  async trackTrialStarted(userId: string, sessionId: string, trialData: {
    trialDurationDays: number;
    triggerSource?: string;
  }): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId,
      deviceId: '',
      eventType: 'trial_started',
      eventData: trialData,
      platform: 'ios',
      appVersion: ''
    });

    // Update user properties
    await this.updateUserProperties(userId, {
      trialStarted: true,
      trialStartedAt: new Date()
    });
  }

  async trackPremiumConverted(userId: string, sessionId: string, conversionData: {
    subscriptionType: string;
    price?: number;
    currency?: string;
    trialDurationDays?: number;
  }): Promise<void> {
    await this.trackEvent({
      userId,
      sessionId,
      deviceId: '',
      eventType: 'premium_converted',
      eventData: conversionData,
      platform: 'ios',
      appVersion: ''
    });

    // Update user properties
    await this.updateUserProperties(userId, {
      premiumConverted: true,
      premiumConvertedAt: new Date(),
      premiumStatus: 'premium'
    });
  }

  // MARK: - Analytics Reporting
  async getDailyMetrics(startDate: Date, endDate: Date, platform?: string): Promise<any> {
    try {
      let query = `
        SELECT * FROM daily_user_metrics 
        WHERE date >= $1 AND date <= $2
      `;
      const params = [startDate, endDate];

      if (platform) {
        query += ` AND platform = $3`;
        params.push(platform);
      }

      query += ` ORDER BY date DESC`;

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get daily metrics', error);
      throw error;
    }
  }

  async getRetentionCohorts(): Promise<any> {
    try {
      const query = `SELECT * FROM user_retention_cohorts ORDER BY retention_cohort DESC`;
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get retention cohorts', error);
      throw error;
    }
  }

  async getConversionFunnel(): Promise<any> {
    try {
      const query = `SELECT * FROM conversion_funnel`;
      const result = await db.query(query);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get conversion funnel', error);
      throw error;
    }
  }

  async getUserAnalytics(userId: string, timeRange: 'day' | 'week' | 'month' = 'week'): Promise<any> {
    try {
      const timeFilter = this.getTimeFilter(timeRange);
      
      // Get user events
      const eventsQuery = `
        SELECT 
          event_type,
          COUNT(*) as count,
          DATE_TRUNC('day', timestamp) as date
        FROM user_events 
        WHERE user_id = $1 AND timestamp >= $2
        GROUP BY event_type, DATE_TRUNC('day', timestamp)
        ORDER BY date DESC
      `;
      
      const eventsResult = await db.query(eventsQuery, [userId, timeFilter]);
      
      // Get user properties
      const propertiesQuery = `
        SELECT * FROM user_analytics_properties WHERE user_id = $1
      `;
      
      const propertiesResult = await db.query(propertiesQuery, [userId]);
      
      // Get recent sessions
      const sessionsQuery = `
        SELECT 
          session_id,
          session_start,
          session_end,
          session_duration_ms,
          actions_performed,
          screens_viewed
        FROM analytics_sessions 
        WHERE user_id = $1 AND session_start >= $2
        ORDER BY session_start DESC
        LIMIT 10
      `;
      
      const sessionsResult = await db.query(sessionsQuery, [userId, timeFilter]);
      
      return {
        events: eventsResult.rows,
        properties: propertiesResult.rows[0] || {},
        sessions: sessionsResult.rows
      };
    } catch (error) {
      logger.error('Failed to get user analytics', error);
      throw error;
    }
  }

  // MARK: - Data Management
  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    try {
      const eventsToFlush = [...this.eventBuffer];
      this.eventBuffer = [];

      await this.batchStoreEvents(eventsToFlush);
      
      logger.debug('Flushed event buffer', { count: eventsToFlush.length });
    } catch (error) {
      logger.error('Failed to flush event buffer', error);
      // Re-add events to buffer for retry
      this.eventBuffer.unshift(...this.eventBuffer);
    }
  }

  private async batchStoreEvents(events: UserEvent[]): Promise<void> {
    const query = `
      INSERT INTO user_events (
        user_id, device_id, session_id, event_type, event_data,
        platform, app_version, timestamp, analytics_consent,
        user_agent, ip_address, country_code, timezone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      for (const event of events) {
        await client.query(query, [
          event.userId,
          event.deviceId,
          event.sessionId,
          event.eventType,
          JSON.stringify(event.eventData || {}),
          event.platform,
          event.appVersion,
          event.timestamp,
          event.analyticsConsent,
          event.userAgent,
          event.ipAddress,
          event.countryCode,
          event.timezone
        ]);
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async storeSession(session: AnalyticsSession): Promise<void> {
    const query = `
      INSERT INTO analytics_sessions (
        session_id, user_id, device_id, platform, app_version,
        session_start, is_first_session, previous_session_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (session_id) DO NOTHING
    `;

    await db.query(query, [
      session.sessionId,
      session.userId,
      session.deviceId,
      session.platform,
      session.appVersion,
      session.sessionStart,
      session.isFirstSession,
      session.previousSessionId
    ]);
  }

  private async updateSessionInDatabase(session: AnalyticsSession): Promise<void> {
    const query = `
      UPDATE analytics_sessions 
      SET session_end = $1, updated_at = NOW()
      WHERE session_id = $2
    `;

    await db.query(query, [session.sessionEnd, session.sessionId]);
  }

  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const expiredSessions = Array.from(this.sessionCache.entries()).filter(
        ([_, session]) => {
          const now = new Date();
          const sessionAge = now.getTime() - session.sessionStart.getTime();
          return sessionAge > this.config.sessionTimeoutMinutes * 60 * 1000;
        }
      );

      for (const [sessionId, session] of expiredSessions) {
        session.sessionEnd = new Date();
        await this.updateSessionInDatabase(session);
        this.sessionCache.delete(sessionId);
      }

      if (expiredSessions.length > 0) {
        logger.debug('Cleaned up expired sessions', { count: expiredSessions.length });
      }
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', error);
    }
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const query = `SELECT config_key, config_value FROM analytics_config WHERE is_active = true`;
      const result = await db.query(query);
      
      for (const row of result.rows) {
        const key = row.config_key;
        const value = row.config_value;
        
        switch (key) {
          case 'event_retention_days':
            this.config.eventRetentionDays = parseInt(value);
            break;
          case 'session_timeout_minutes':
            this.config.sessionTimeoutMinutes = parseInt(value);
            break;
          case 'batch_size':
            this.config.batchSize = parseInt(value);
            break;
          case 'privacy_mode_enabled':
            this.config.privacyModeEnabled = value === 'true';
            break;
          case 'anonymization_enabled':
            this.config.anonymizationEnabled = value === 'true';
            break;
          case 'sampling_rate':
            this.config.samplingRate = parseFloat(value);
            break;
        }
      }
    } catch (error) {
      logger.error('Failed to load analytics configuration', error);
    }
  }

  private getTimeFilter(timeRange: 'day' | 'week' | 'month'): Date {
    const now = new Date();
    switch (timeRange) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  // MARK: - Configuration
  updateConfiguration(newConfig: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Analytics configuration updated', newConfig);
  }

  getConfiguration(): AnalyticsConfig {
    return { ...this.config };
  }

  // MARK: - Cleanup
  destroy(): void {
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
    }
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
    }
    this.flushEventBuffer();
  }
}

export const analyticsService = AnalyticsService.getInstance();