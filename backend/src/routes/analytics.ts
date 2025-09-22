import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { analyticsService } from '../services/analyticsService';
import { logger } from '../utils/logger';

const router = Router();

// Validation middleware
const validateEvent = [
  body('eventType').isString().notEmpty().withMessage('Event type is required'),
  body('sessionId').isString().notEmpty().withMessage('Session ID is required'),
  body('deviceId').isString().notEmpty().withMessage('Device ID is required'),
  body('platform').isIn(['ios', 'android']).withMessage('Platform must be ios or android'),
  body('appVersion').isString().notEmpty().withMessage('App version is required'),
  body('eventData').optional().isObject().withMessage('Event data must be an object'),
  body('timestamp').optional().isISO8601().withMessage('Timestamp must be valid ISO8601 date'),
  body('analyticsConsent').optional().isBoolean().withMessage('Analytics consent must be boolean')
];

const validateSession = [
  body('sessionId').isString().notEmpty().withMessage('Session ID is required'),
  body('deviceId').isString().notEmpty().withMessage('Device ID is required'),
  body('platform').isIn(['ios', 'android']).withMessage('Platform must be ios or android'),
  body('appVersion').isString().notEmpty().withMessage('App version is required'),
  body('previousSessionId').optional().isString().withMessage('Previous session ID must be string')
];

const validateTimeRange = [
  query('timeRange').optional().isIn(['day', 'week', 'month']).withMessage('Time range must be day, week, or month'),
  query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO8601 date'),
  query('endDate').optional().isISO8601().withMessage('End date must be valid ISO8601 date'),
  query('platform').optional().isIn(['ios', 'android']).withMessage('Platform must be ios or android')
];

// POST /api/analytics/events - Track user event
router.post('/events', authenticateToken, validateEvent, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
    }

    const event = {
      userId,
      deviceId: req.body.deviceId,
      sessionId: req.body.sessionId,
      eventType: req.body.eventType,
      eventData: req.body.eventData,
      platform: req.body.platform,
      appVersion: req.body.appVersion,
      timestamp: req.body.timestamp ? new Date(req.body.timestamp) : undefined,
      analyticsConsent: req.body.analyticsConsent,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      countryCode: req.get('CF-IPCountry'), // Cloudflare header
      timezone: req.body.timezone
    };

    await analyticsService.trackEvent(event);

    res.json({
      success: true,
      message: 'Event tracked successfully'
    });

  } catch (error) {
    logger.error('Failed to track event', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track event'
    });
  }
});

// POST /api/analytics/events/batch - Track multiple events in batch
router.post('/events/batch', authenticateToken, [
  body('events').isArray({ min: 1, max: 100 }).withMessage('Events must be array with 1-100 items'),
  body('events.*.eventType').isString().notEmpty().withMessage('Event type is required'),
  body('events.*.sessionId').isString().notEmpty().withMessage('Session ID is required'),
  body('events.*.deviceId').isString().notEmpty().withMessage('Device ID is required'),
  body('events.*.platform').isIn(['ios', 'android']).withMessage('Platform must be ios or android'),
  body('events.*.appVersion').isString().notEmpty().withMessage('App version is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
    }

    const events = req.body.events.map((event: any) => ({
      userId,
      deviceId: event.deviceId,
      sessionId: event.sessionId,
      eventType: event.eventType,
      eventData: event.eventData,
      platform: event.platform,
      appVersion: event.appVersion,
      timestamp: event.timestamp ? new Date(event.timestamp) : undefined,
      analyticsConsent: event.analyticsConsent,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      countryCode: req.get('CF-IPCountry'),
      timezone: event.timezone
    }));

    // Track events in parallel
    await Promise.all(events.map(event => analyticsService.trackEvent(event)));

    res.json({
      success: true,
      message: `${events.length} events tracked successfully`
    });

  } catch (error) {
    logger.error('Failed to track batch events', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track batch events'
    });
  }
});

// POST /api/analytics/sessions/start - Start analytics session
router.post('/sessions/start', authenticateToken, validateSession, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
    }

    const session = {
      sessionId: req.body.sessionId,
      userId,
      deviceId: req.body.deviceId,
      platform: req.body.platform,
      appVersion: req.body.appVersion,
      sessionStart: new Date(),
      previousSessionId: req.body.previousSessionId
    };

    await analyticsService.startSession(session);

    res.json({
      success: true,
      message: 'Session started successfully',
      data: {
        sessionId: session.sessionId,
        sessionStart: session.sessionStart
      }
    });

  } catch (error) {
    logger.error('Failed to start session', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start session'
    });
  }
});

// POST /api/analytics/sessions/:sessionId/end - End analytics session
router.post('/sessions/:sessionId/end', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    await analyticsService.endSession(sessionId);

    res.json({
      success: true,
      message: 'Session ended successfully'
    });

  } catch (error) {
    logger.error('Failed to end session', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end session'
    });
  }
});

// PUT /api/analytics/user-properties - Update user analytics properties
router.put('/user-properties', authenticateToken, [
  body('nudgeStyle').optional().isString().withMessage('Nudge style must be string'),
  body('quietHours').optional().isObject().withMessage('Quiet hours must be object'),
  body('defaultRadii').optional().isObject().withMessage('Default radii must be object'),
  body('premiumStatus').optional().isIn(['free', 'trial', 'premium']).withMessage('Invalid premium status'),
  body('primaryCountry').optional().isString().withMessage('Primary country must be string'),
  body('primaryTimezone').optional().isString().withMessage('Primary timezone must be string'),
  body('primaryPlatform').optional().isIn(['ios', 'android']).withMessage('Primary platform must be ios or android')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
    }

    const properties = {
      nudgeStyle: req.body.nudgeStyle,
      quietHours: req.body.quietHours,
      defaultRadii: req.body.defaultRadii,
      premiumStatus: req.body.premiumStatus,
      primaryCountry: req.body.primaryCountry,
      primaryTimezone: req.body.primaryTimezone,
      primaryPlatform: req.body.primaryPlatform
    };

    // Remove undefined values
    const cleanProperties = Object.fromEntries(
      Object.entries(properties).filter(([_, value]) => value !== undefined)
    );

    await analyticsService.updateUserProperties(userId, cleanProperties);

    res.json({
      success: true,
      message: 'User properties updated successfully'
    });

  } catch (error) {
    logger.error('Failed to update user properties', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user properties'
    });
  }
});

// GET /api/analytics/user - Get user analytics data
router.get('/user', authenticateToken, validateTimeRange, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
    }

    const timeRange = (req.query.timeRange as 'day' | 'week' | 'month') || 'week';
    const analytics = await analyticsService.getUserAnalytics(userId, timeRange);

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error('Failed to get user analytics', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user analytics'
    });
  }
});

// GET /api/analytics/metrics/daily - Get daily metrics (admin only)
router.get('/metrics/daily', authenticateToken, validateTimeRange, async (req, res) => {
  try {
    // TODO: Add admin role check
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const platform = req.query.platform as string;

    const metrics = await analyticsService.getDailyMetrics(startDate, endDate, platform);

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    logger.error('Failed to get daily metrics', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get daily metrics'
    });
  }
});

// GET /api/analytics/retention - Get retention cohorts (admin only)
router.get('/retention', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    const cohorts = await analyticsService.getRetentionCohorts();

    res.json({
      success: true,
      data: cohorts
    });

  } catch (error) {
    logger.error('Failed to get retention cohorts', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get retention cohorts'
    });
  }
});

// GET /api/analytics/conversion - Get conversion funnel (admin only)
router.get('/conversion', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    const funnel = await analyticsService.getConversionFunnel();

    res.json({
      success: true,
      data: funnel
    });

  } catch (error) {
    logger.error('Failed to get conversion funnel', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get conversion funnel'
    });
  }
});

// GET /api/analytics/events/recent - Get recent events (admin only)
router.get('/events/recent', authenticateToken, [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    // TODO: Add admin role check
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const events = await analyticsService.getRecentEvents(limit);

    res.json({
      success: true,
      data: events
    });

  } catch (error) {
    logger.error('Failed to get recent events', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recent events'
    });
  }
});

// GET /api/analytics/health - Get system health metrics
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const health = await analyticsService.getSystemHealth();

    res.json({
      success: true,
      data: health
    });

  } catch (error) {
    logger.error('Failed to get system health', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system health'
    });
  }
});

// GET /api/analytics/alerts - Get active alerts
router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const alerts = await analyticsService.getActiveAlerts();

    res.json({
      success: true,
      data: alerts
    });

  } catch (error) {
    logger.error('Failed to get alerts', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get alerts'
    });
  }
});

// Business event tracking endpoints
// POST /api/analytics/task-created
router.post('/task-created', authenticateToken, [
  body('sessionId').isString().notEmpty().withMessage('Session ID is required'),
  body('taskId').isString().notEmpty().withMessage('Task ID is required'),
  body('locationType').isIn(['custom_place', 'poi_category']).withMessage('Invalid location type'),
  body('placeId').optional().isString().withMessage('Place ID must be string'),
  body('poiCategory').optional().isString().withMessage('POI category must be string'),
  body('hasDescription').isBoolean().withMessage('Has description must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
    }

    await analyticsService.trackTaskCreated(userId, req.body.sessionId, {
      taskId: req.body.taskId,
      locationType: req.body.locationType,
      placeId: req.body.placeId,
      poiCategory: req.body.poiCategory,
      hasDescription: req.body.hasDescription
    });

    res.json({
      success: true,
      message: 'Task created event tracked'
    });

  } catch (error) {
    logger.error('Failed to track task created', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track task created'
    });
  }
});

// POST /api/analytics/place-added
router.post('/place-added', authenticateToken, [
  body('sessionId').isString().notEmpty().withMessage('Session ID is required'),
  body('placeId').isString().notEmpty().withMessage('Place ID is required'),
  body('placeType').isIn(['home', 'work', 'custom']).withMessage('Invalid place type'),
  body('method').isIn(['map_selection', 'address_search', 'current_location']).withMessage('Invalid method')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
    }

    await analyticsService.trackPlaceAdded(userId, req.body.sessionId, {
      placeId: req.body.placeId,
      placeType: req.body.placeType,
      method: req.body.method
    });

    res.json({
      success: true,
      message: 'Place added event tracked'
    });

  } catch (error) {
    logger.error('Failed to track place added', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track place added'
    });
  }
});

// POST /api/analytics/nudge-shown
router.post('/nudge-shown', authenticateToken, [
  body('sessionId').isString().notEmpty().withMessage('Session ID is required'),
  body('taskId').isString().notEmpty().withMessage('Task ID is required'),
  body('nudgeType').isIn(['approach', 'arrival', 'post_arrival']).withMessage('Invalid nudge type'),
  body('locationName').optional().isString().withMessage('Location name must be string'),
  body('distanceMeters').optional().isNumeric().withMessage('Distance must be numeric')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
    }

    await analyticsService.trackNudgeShown(userId, req.body.sessionId, {
      taskId: req.body.taskId,
      nudgeType: req.body.nudgeType,
      locationName: req.body.locationName,
      distanceMeters: req.body.distanceMeters
    });

    res.json({
      success: true,
      message: 'Nudge shown event tracked'
    });

  } catch (error) {
    logger.error('Failed to track nudge shown', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track nudge shown'
    });
  }
});

// POST /api/analytics/task-completed
router.post('/task-completed', authenticateToken, [
  body('sessionId').isString().notEmpty().withMessage('Session ID is required'),
  body('taskId').isString().notEmpty().withMessage('Task ID is required'),
  body('completionMethod').isIn(['notification_action', 'app_action', 'auto_complete']).withMessage('Invalid completion method'),
  body('timeToCompleteHours').optional().isNumeric().withMessage('Time to complete must be numeric'),
  body('nudgesReceived').optional().isInt({ min: 0 }).withMessage('Nudges received must be non-negative integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
    }

    await analyticsService.trackTaskCompleted(userId, req.body.sessionId, {
      taskId: req.body.taskId,
      completionMethod: req.body.completionMethod,
      timeToCompleteHours: req.body.timeToCompleteHours,
      nudgesReceived: req.body.nudgesReceived
    });

    res.json({
      success: true,
      message: 'Task completed event tracked'
    });

  } catch (error) {
    logger.error('Failed to track task completed', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track task completed'
    });
  }
});

// POST /api/analytics/paywall-viewed
router.post('/paywall-viewed', authenticateToken, [
  body('sessionId').isString().notEmpty().withMessage('Session ID is required'),
  body('trigger').isIn(['onboarding', 'task_limit', 'feature_access']).withMessage('Invalid trigger'),
  body('currentTaskCount').optional().isInt({ min: 0 }).withMessage('Current task count must be non-negative integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
    }

    await analyticsService.trackPaywallViewed(userId, req.body.sessionId, {
      trigger: req.body.trigger,
      currentTaskCount: req.body.currentTaskCount
    });

    res.json({
      success: true,
      message: 'Paywall viewed event tracked'
    });

  } catch (error) {
    logger.error('Failed to track paywall viewed', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track paywall viewed'
    });
  }
});

export default router;