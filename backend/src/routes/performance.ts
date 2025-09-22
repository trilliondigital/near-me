import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { performanceAnalyticsService } from '../services/performanceAnalyticsService';
import { logger } from '../utils/logger';

const router = Router();

// Validation middleware
const validateMetrics = [
  body('platform').isIn(['ios', 'android']).withMessage('Platform must be ios or android'),
  body('appVersion').isString().notEmpty().withMessage('App version is required'),
  body('deviceId').isString().notEmpty().withMessage('Device ID is required'),
  body('batteryLevel').optional().isInt({ min: 0, max: 100 }).withMessage('Battery level must be 0-100'),
  body('batteryDrainRate').optional().isFloat({ min: 0 }).withMessage('Battery drain rate must be positive'),
  body('locationAccuracy').optional().isFloat({ min: 0 }).withMessage('Location accuracy must be positive'),
  body('memoryUsageMB').optional().isFloat({ min: 0 }).withMessage('Memory usage must be positive'),
  body('cpuUsagePercentage').optional().isFloat({ min: 0, max: 100 }).withMessage('CPU usage must be 0-100'),
];

const validateTimeRange = [
  query('timeRange').optional().isIn(['day', 'week', 'month']).withMessage('Time range must be day, week, or month')
];

// POST /api/performance/metrics - Record performance metrics
router.post('/metrics', authenticateToken, validateMetrics, async (req, res) => {
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

    const metrics = {
      userId,
      deviceId: req.body.deviceId,
      platform: req.body.platform,
      appVersion: req.body.appVersion,
      batteryLevel: req.body.batteryLevel,
      batteryDrainRate: req.body.batteryDrainRate,
      isCharging: req.body.isCharging,
      isLowPowerMode: req.body.isLowPowerMode,
      locationAccuracy: req.body.locationAccuracy,
      locationUpdatesPerHour: req.body.locationUpdatesPerHour,
      geofenceEventsPerHour: req.body.geofenceEventsPerHour,
      geofenceResponseTimeMs: req.body.geofenceResponseTimeMs,
      memoryUsageMB: req.body.memoryUsageMB,
      cpuUsagePercentage: req.body.cpuUsagePercentage,
      crashFreePercentage: req.body.crashFreePercentage,
      falsePositiveRate: req.body.falsePositiveRate,
      apiResponseTimeMs: req.body.apiResponseTimeMs,
      networkRequestCount: req.body.networkRequestCount,
      cacheHitRate: req.body.cacheHitRate,
      backgroundExecutionTimeMs: req.body.backgroundExecutionTimeMs,
      notificationDeliveryTimeMs: req.body.notificationDeliveryTimeMs,
      timestamp: new Date()
    };

    await performanceAnalyticsService.recordMetrics(metrics);

    res.json({
      success: true,
      message: 'Performance metrics recorded successfully'
    });

  } catch (error) {
    logger.error('Failed to record performance metrics', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record performance metrics'
    });
  }
});

// GET /api/performance/report - Get performance report
router.get('/report', authenticateToken, validateTimeRange, async (req, res) => {
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

    const timeRange = (req.query.timeRange as 'day' | 'week' | 'month') || 'day';
    const report = await performanceAnalyticsService.getPerformanceReport(userId, timeRange);

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('Failed to get performance report', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get performance report'
    });
  }
});

// GET /api/performance/thresholds - Get performance thresholds
router.get('/thresholds', authenticateToken, async (req, res) => {
  try {
    const thresholds = performanceAnalyticsService.getThresholds();

    res.json({
      success: true,
      data: thresholds
    });

  } catch (error) {
    logger.error('Failed to get performance thresholds', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get performance thresholds'
    });
  }
});

// POST /api/performance/battery-optimization - Update battery optimization settings
router.post('/battery-optimization', authenticateToken, [
  body('optimizationLevel').isIn(['high_accuracy', 'balanced', 'power_save', 'minimal'])
    .withMessage('Invalid optimization level'),
  body('adaptiveOptimizationEnabled').optional().isBoolean()
    .withMessage('Adaptive optimization must be boolean'),
  body('customThresholds').optional().isObject()
    .withMessage('Custom thresholds must be an object')
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

    // This would integrate with a battery optimization settings service
    // For now, just return success
    logger.info('Battery optimization settings updated', {
      userId,
      optimizationLevel: req.body.optimizationLevel,
      adaptiveOptimizationEnabled: req.body.adaptiveOptimizationEnabled
    });

    res.json({
      success: true,
      message: 'Battery optimization settings updated successfully'
    });

  } catch (error) {
    logger.error('Failed to update battery optimization settings', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update battery optimization settings'
    });
  }
});

// GET /api/performance/battery-optimization - Get battery optimization settings
router.get('/battery-optimization', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
    }

    // This would fetch from database
    // For now, return default settings
    const settings = {
      optimizationLevel: 'balanced',
      adaptiveOptimizationEnabled: true,
      customThresholds: null
    };

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    logger.error('Failed to get battery optimization settings', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get battery optimization settings'
    });
  }
});

// POST /api/performance/crash-report - Report application crash
router.post('/crash-report', authenticateToken, [
  body('platform').isIn(['ios', 'android']).withMessage('Platform must be ios or android'),
  body('appVersion').isString().notEmpty().withMessage('App version is required'),
  body('deviceId').isString().notEmpty().withMessage('Device ID is required'),
  body('crashType').isString().notEmpty().withMessage('Crash type is required'),
  body('stackTrace').optional().isString().withMessage('Stack trace must be string'),
  body('userActions').optional().isArray().withMessage('User actions must be array')
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

    // Record crash metrics
    const crashMetrics = {
      userId,
      deviceId: req.body.deviceId,
      platform: req.body.platform,
      appVersion: req.body.appVersion,
      crashFreePercentage: 0, // This would be calculated based on session data
      timestamp: new Date()
    };

    await performanceAnalyticsService.recordMetrics(crashMetrics);

    logger.error('Application crash reported', {
      userId,
      platform: req.body.platform,
      crashType: req.body.crashType,
      appVersion: req.body.appVersion
    });

    res.json({
      success: true,
      message: 'Crash report recorded successfully'
    });

  } catch (error) {
    logger.error('Failed to record crash report', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record crash report'
    });
  }
});

// GET /api/performance/health-check - Get system health status
router.get('/health-check', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
    }

    const report = await performanceAnalyticsService.getPerformanceReport(userId, 'day');
    
    const healthStatus = {
      overall: report.healthScore >= 80 ? 'good' : report.healthScore >= 60 ? 'fair' : 'poor',
      healthScore: report.healthScore,
      criticalIssues: report.alerts.filter((alert: any) => alert.severity === 'critical' && !alert.resolved).length,
      recommendations: report.recommendations,
      lastUpdated: new Date()
    };

    res.json({
      success: true,
      data: healthStatus
    });

  } catch (error) {
    logger.error('Failed to get health check', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get health check'
    });
  }
});

export default router;