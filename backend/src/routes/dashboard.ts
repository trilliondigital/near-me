import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { analyticsService } from '../services/analyticsService';
import { analyticsProcessingService } from '../services/analyticsProcessingService';
import { abTestingService } from '../services/abTestingService';
import { alertingService } from '../services/alertingService';
import { logger } from '../utils/logger';
import path from 'path';

const router = Router();

// Serve dashboard HTML
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/index.html'));
});

// Serve dashboard JavaScript
router.get('/dashboard.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../dashboard/dashboard.js'));
});

// MARK: - Dashboard API Endpoints

// GET /api/dashboard/overview - Get dashboard overview data
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    
    const [
      dailyMetrics,
      conversionFunnel,
      retentionCohorts,
      activeAlerts,
      systemHealth
    ] = await Promise.all([
      analyticsService.getDailyMetrics(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        new Date()
      ),
      analyticsService.getConversionFunnel(),
      analyticsService.getRetentionCohorts(),
      alertingService.getActiveAlerts(),
      analyticsService.getSystemHealth()
    ]);

    const overview = {
      summary: {
        totalUsers: dailyMetrics.reduce((sum, day) => sum + (day.daily_active_users || 0), 0),
        totalSessions: dailyMetrics.reduce((sum, day) => sum + (day.daily_sessions || 0), 0),
        totalTasks: dailyMetrics.reduce((sum, day) => sum + (day.tasks_created || 0), 0),
        avgCompletionRate: dailyMetrics.length > 0 
          ? dailyMetrics.reduce((sum, day) => sum + (day.completion_rate || 0), 0) / dailyMetrics.length
          : 0
      },
      trends: {
        dailyMetrics: dailyMetrics.slice(0, 7),
        conversionFunnel: conversionFunnel[0] || {},
        retentionCohorts: retentionCohorts.slice(0, 5)
      },
      alerts: {
        active: activeAlerts.length,
        critical: activeAlerts.filter(alert => alert.severity === 'critical').length,
        recent: activeAlerts.slice(0, 5)
      },
      health: systemHealth
    };

    res.json({
      success: true,
      data: overview
    });

  } catch (error) {
    logger.error('Failed to get dashboard overview', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard overview'
    });
  }
});

// GET /api/dashboard/real-time - Get real-time metrics
router.get('/real-time', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    
    const [
      recentEvents,
      activeUsers,
      systemHealth,
      activeAlerts
    ] = await Promise.all([
      analyticsService.getRecentEvents(20),
      analyticsService.getDailyMetrics(new Date(), new Date()),
      analyticsService.getSystemHealth(),
      alertingService.getActiveAlerts()
    ]);

    const realTimeData = {
      timestamp: new Date(),
      events: recentEvents,
      activeUsers: activeUsers[0]?.daily_active_users || 0,
      systemStatus: systemHealth.overall_status,
      alerts: activeAlerts.filter(alert => alert.severity === 'critical').length,
      healthChecks: systemHealth.checks
    };

    res.json({
      success: true,
      data: realTimeData
    });

  } catch (error) {
    logger.error('Failed to get real-time data', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get real-time data'
    });
  }
});

// MARK: - Processing Jobs

// POST /api/dashboard/jobs/schedule - Schedule analytics processing job
router.post('/jobs/schedule', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    
    const { jobType } = req.body;
    
    if (!['aggregation', 'cohort_analysis', 'funnel_analysis', 'retention_calculation'].includes(jobType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job type'
      });
    }

    const jobId = await analyticsProcessingService.scheduleJob(jobType);

    res.json({
      success: true,
      data: { jobId }
    });

  } catch (error) {
    logger.error('Failed to schedule processing job', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule processing job'
    });
  }
});

// GET /api/dashboard/jobs/:jobId - Get job status
router.get('/jobs/:jobId', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    
    const { jobId } = req.params;
    const job = await analyticsProcessingService.getJobStatus(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: job
    });

  } catch (error) {
    logger.error('Failed to get job status', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job status'
    });
  }
});

// MARK: - A/B Testing

// GET /api/dashboard/experiments - Get all experiments
router.get('/experiments', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    
    const experiments = await abTestingService.getActiveExperiments();

    res.json({
      success: true,
      data: experiments
    });

  } catch (error) {
    logger.error('Failed to get experiments', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get experiments'
    });
  }
});

// POST /api/dashboard/experiments - Create new experiment
router.post('/experiments', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    
    const experiment = req.body;
    const experimentId = await abTestingService.createExperiment(experiment);

    res.json({
      success: true,
      data: { experimentId }
    });

  } catch (error) {
    logger.error('Failed to create experiment', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create experiment'
    });
  }
});

// GET /api/dashboard/experiments/:experimentId/analysis - Get experiment analysis
router.get('/experiments/:experimentId/analysis', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    
    const { experimentId } = req.params;
    const analysis = await abTestingService.analyzeExperiment(experimentId);

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    logger.error('Failed to analyze experiment', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze experiment'
    });
  }
});

// POST /api/dashboard/experiments/:experimentId/start - Start experiment
router.post('/experiments/:experimentId/start', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    
    const { experimentId } = req.params;
    await abTestingService.startExperiment(experimentId);

    res.json({
      success: true,
      message: 'Experiment started successfully'
    });

  } catch (error) {
    logger.error('Failed to start experiment', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start experiment'
    });
  }
});

// POST /api/dashboard/experiments/:experimentId/complete - Complete experiment
router.post('/experiments/:experimentId/complete', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    
    const { experimentId } = req.params;
    await abTestingService.completeExperiment(experimentId);

    res.json({
      success: true,
      message: 'Experiment completed successfully'
    });

  } catch (error) {
    logger.error('Failed to complete experiment', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete experiment'
    });
  }
});

// MARK: - Alerts Management

// GET /api/dashboard/alerts - Get active alerts
router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    
    const alerts = await alertingService.getActiveAlerts();

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

// POST /api/dashboard/alerts/:alertId/acknowledge - Acknowledge alert
router.post('/alerts/:alertId/acknowledge', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    
    const { alertId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found'
      });
    }

    await alertingService.acknowledgeAlert(alertId, userId);

    res.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });

  } catch (error) {
    logger.error('Failed to acknowledge alert', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert'
    });
  }
});

// POST /api/dashboard/alerts/:alertId/resolve - Resolve alert
router.post('/alerts/:alertId/resolve', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    
    const { alertId } = req.params;
    await alertingService.resolveAlert(alertId);

    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });

  } catch (error) {
    logger.error('Failed to resolve alert', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve alert'
    });
  }
});

// GET /api/dashboard/alerts/rules - Get alert rules
router.get('/alerts/rules', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    
    const rules = alertingService.getAlertRules();

    res.json({
      success: true,
      data: rules
    });

  } catch (error) {
    logger.error('Failed to get alert rules', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get alert rules'
    });
  }
});

// POST /api/dashboard/alerts/rules - Create alert rule
router.post('/alerts/rules', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    
    const rule = req.body;
    const ruleId = await alertingService.addAlertRule(rule);

    res.json({
      success: true,
      data: { ruleId }
    });

  } catch (error) {
    logger.error('Failed to create alert rule', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create alert rule'
    });
  }
});

export default router;