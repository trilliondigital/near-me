import { Router, Request, Response, NextFunction } from 'express';
import { NotificationManager } from '../services/notificationManager';
import { AuthenticatedRequest } from '../middleware/auth';
import { ValidationError } from '../models/validation';

const router = Router();

/**
 * GET /api/notifications/manager/summary
 * Get comprehensive notification summary for user
 */
router.get('/summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const summary = await NotificationManager.getUserNotificationSummary(userId);

    res.status(200).json({
      summary
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/manager/insights
 * Get notification insights and recommendations for user
 */
router.get('/insights', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const insights = await NotificationManager.getNotificationInsights(userId);

    res.status(200).json({
      insights
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/manager/tasks/:taskId/snooze
 * Snooze all notifications for a specific task
 */
router.post('/tasks/:taskId/snooze', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { taskId } = req.params;
    const { duration, reason } = req.body;

    // Validate duration
    if (!duration || !['15m', '1h', 'today'].includes(duration)) {
      return res.status(400).json({
        error: 'Invalid snooze duration. Must be one of: 15m, 1h, today'
      });
    }

    const result = await NotificationManager.snoozeTaskNotifications(
      taskId,
      userId,
      duration,
      reason
    );

    res.status(200).json({
      message: `Snoozed ${result.snoozedCount} notifications for task`,
      taskId,
      duration,
      snoozedCount: result.snoozedCount,
      snoozes: result.snoozes.map(s => s.toJSON())
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/manager/tasks/:taskId/mute
 * Mute a task with specified duration
 */
router.post('/tasks/:taskId/mute', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { taskId } = req.params;
    const { duration, reason } = req.body;

    // Validate duration
    const validDurations = ['1h', '4h', '8h', '24h', 'until_tomorrow', 'permanent'];
    if (!duration || !validDurations.includes(duration)) {
      return res.status(400).json({
        error: `Invalid mute duration. Must be one of: ${validDurations.join(', ')}`
      });
    }

    const mute = await NotificationManager.muteTask(taskId, userId, duration, reason);

    res.status(200).json({
      message: 'Task muted successfully',
      taskId,
      mute: mute.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/manager/tasks/:taskId/unmute
 * Unmute a task
 */
router.post('/tasks/:taskId/unmute', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { taskId } = req.params;

    await NotificationManager.unmuteTask(taskId, userId);

    res.status(200).json({
      message: 'Task unmuted successfully',
      taskId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/manager/tasks/:taskId/cancel-snoozes
 * Cancel all snoozes for a task
 */
router.post('/tasks/:taskId/cancel-snoozes', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { taskId } = req.params;

    const cancelledCount = await NotificationManager.cancelTaskSnoozes(taskId, userId);

    res.status(200).json({
      message: `Cancelled ${cancelledCount} snoozes for task`,
      taskId,
      cancelledCount
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/manager/delivery-rate
 * Get notification delivery rate statistics
 */
router.get('/delivery-rate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const days = parseInt(req.query.days as string) || 7;

    if (days < 1 || days > 30) {
      return res.status(400).json({
        error: 'Days parameter must be between 1 and 30'
      });
    }

    const deliveryRate = await NotificationManager.getNotificationDeliveryRate(userId, days);

    res.status(200).json({
      deliveryRate,
      period: `${days} days`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/manager/frequency
 * Get notification frequency analysis
 */
router.get('/frequency', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const hours = parseInt(req.query.hours as string) || 24;

    if (hours < 1 || hours > 168) { // Max 1 week
      return res.status(400).json({
        error: 'Hours parameter must be between 1 and 168'
      });
    }

    const frequency = await NotificationManager.getNotificationFrequency(userId, hours);

    res.status(200).json({
      frequency,
      period: `${hours} hours`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/manager/limits
 * Check notification limits for user
 */
router.get('/limits', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const timeWindowHours = parseInt(req.query.timeWindow as string) || 1;

    if (timeWindowHours < 1 || timeWindowHours > 24) {
      return res.status(400).json({
        error: 'Time window must be between 1 and 24 hours'
      });
    }

    const limits = await NotificationManager.checkNotificationLimits(userId, timeWindowHours);

    res.status(200).json({
      limits,
      timeWindow: `${timeWindowHours} hours`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/manager/preferences
 * Get user notification preferences
 */
router.get('/preferences', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const preferences = await NotificationManager.getUserNotificationPreferences(userId);

    res.status(200).json({
      preferences
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/notifications/manager/preferences
 * Update user notification preferences
 */
router.put('/preferences', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const {
      quietHours,
      enableBundling,
      maxNotificationsPerHour,
      snoozeDefaults,
      muteDefaults
    } = req.body;

    // Validate preferences
    const updates: any = {};

    if (quietHours !== undefined) {
      if (quietHours && (!quietHours.start || !quietHours.end)) {
        return res.status(400).json({
          error: 'Quiet hours must include both start and end times'
        });
      }
      updates.quietHours = quietHours;
    }

    if (enableBundling !== undefined) {
      updates.enableBundling = Boolean(enableBundling);
    }

    if (maxNotificationsPerHour !== undefined) {
      if (typeof maxNotificationsPerHour !== 'number' || maxNotificationsPerHour < 1 || maxNotificationsPerHour > 60) {
        return res.status(400).json({
          error: 'Max notifications per hour must be between 1 and 60'
        });
      }
      updates.maxNotificationsPerHour = maxNotificationsPerHour;
    }

    if (snoozeDefaults !== undefined) {
      if (snoozeDefaults.defaultDuration && !['15m', '1h', 'today'].includes(snoozeDefaults.defaultDuration)) {
        return res.status(400).json({
          error: 'Invalid default snooze duration'
        });
      }
      updates.snoozeDefaults = snoozeDefaults;
    }

    if (muteDefaults !== undefined) {
      const validMuteDurations = ['1h', '4h', '8h', '24h', 'until_tomorrow', 'permanent'];
      if (muteDefaults.defaultDuration && !validMuteDurations.includes(muteDefaults.defaultDuration)) {
        return res.status(400).json({
          error: 'Invalid default mute duration'
        });
      }
      updates.muteDefaults = muteDefaults;
    }

    const preferences = await NotificationManager.updateUserNotificationPreferences(userId, updates);

    res.status(200).json({
      message: 'Notification preferences updated successfully',
      preferences
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/manager/cleanup
 * Clean up old notification data
 */
router.post('/cleanup', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { olderThanDays } = req.body;

    const days = olderThanDays || 30;
    if (days < 7 || days > 365) {
      return res.status(400).json({
        error: 'Cleanup period must be between 7 and 365 days'
      });
    }

    const result = await NotificationManager.cleanupUserNotifications(userId, days);

    res.status(200).json({
      message: 'Notification cleanup completed',
      result,
      period: `${days} days`
    });
  } catch (error) {
    next(error);
  }
});

export default router;