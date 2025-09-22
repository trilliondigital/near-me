import { Router, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notificationService';
import { NotificationScheduler } from '../services/notificationScheduler';
import { GeofenceEvent } from '../models/GeofenceEvent';
import { AuthenticatedRequest } from '../middleware/auth';
import { ValidationError } from '../models/validation';

const router = Router();

/**
 * POST /api/notifications/geofence-event
 * Process a geofence event and create notification
 */
router.post('/geofence-event', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { geofence_id, event_type, location, confidence } = req.body;
    const userId = req.user!.id;

    // Validate required fields
    if (!geofence_id || !event_type || !location) {
      return res.status(400).json({
        error: 'Missing required fields: geofence_id, event_type, location'
      });
    }

    // Create geofence event (this would normally come from the geofence event processor)
    const eventData = {
      user_id: userId,
      task_id: req.body.task_id, // This should be derived from geofence_id
      geofence_id,
      event_type,
      location,
      confidence: confidence || 0.8
    };

    const geofenceEvent = await GeofenceEvent.create(eventData);

    // Create notification for the event
    const notification = await NotificationService.createNotificationForEvent(geofenceEvent);

    // Schedule the notification
    const scheduled = await NotificationScheduler.scheduleNotification(notification);

    res.status(201).json({
      message: 'Geofence event processed and notification scheduled',
      event: geofenceEvent.toJSON(),
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        scheduledTime: scheduled.scheduledTime
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/:notificationId/action
 * Handle notification action (complete, snooze, etc.)
 */
router.post('/:notificationId/action', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { notificationId } = req.params;
    const { action } = req.body;
    const userId = req.user!.id;

    // Validate required fields
    if (!action) {
      return res.status(400).json({
        error: 'Missing required field: action'
      });
    }

    // Validate action type
    const validActions = ['complete', 'snooze_15m', 'snooze_1h', 'snooze_today', 'open_map', 'mute'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: `Invalid action type. Must be one of: ${validActions.join(', ')}`
      });
    }

    // Handle the notification action
    await NotificationService.handleNotificationAction(notificationId, action, userId);

    res.status(200).json({
      message: 'Notification action processed successfully',
      notificationId,
      action
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/scheduled
 * Get scheduled notifications for the current user
 */
router.get('/scheduled', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const scheduledNotifications = NotificationScheduler.getScheduledNotifications(userId);

    res.status(200).json({
      notifications: scheduledNotifications.map(scheduled => ({
        id: scheduled.id,
        notification: {
          id: scheduled.notification.id,
          type: scheduled.notification.type,
          title: scheduled.notification.title,
          body: scheduled.notification.body,
          actions: scheduled.notification.actions,
          metadata: scheduled.notification.metadata
        },
        scheduledTime: scheduled.scheduledTime,
        status: scheduled.status,
        attempts: scheduled.attempts,
        lastAttempt: scheduled.lastAttempt,
        error: scheduled.error
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/notifications/:notificationId
 * Cancel a scheduled notification
 */
router.delete('/:notificationId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user!.id;

    // Verify the notification belongs to the user
    const scheduledNotifications = NotificationScheduler.getScheduledNotifications(userId);
    const userNotification = scheduledNotifications.find(n => n.id === notificationId);
    
    if (!userNotification) {
      return res.status(404).json({
        error: 'Notification not found or does not belong to user'
      });
    }

    const cancelled = await NotificationScheduler.cancelNotification(notificationId);

    if (cancelled) {
      res.status(200).json({
        message: 'Notification cancelled successfully',
        notificationId
      });
    } else {
      res.status(404).json({
        error: 'Notification not found'
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/bundle
 * Bundle multiple notifications for dense POI areas
 */
router.post('/bundle', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { notifications } = req.body;
    const userId = req.user!.id;

    // Validate required fields
    if (!notifications || !Array.isArray(notifications)) {
      return res.status(400).json({
        error: 'Missing or invalid notifications array'
      });
    }

    // Filter notifications to only include those belonging to the user
    const userNotifications = notifications.filter((n: any) => n.userId === userId);

    if (userNotifications.length === 0) {
      return res.status(400).json({
        error: 'No notifications found for user'
      });
    }

    // Bundle the notifications
    const bundles = await NotificationService.bundleNotifications(userNotifications);

    res.status(200).json({
      message: 'Notifications bundled successfully',
      bundles: bundles.map(bundle => ({
        id: bundle.id,
        title: bundle.title,
        body: bundle.body,
        actions: bundle.actions,
        location: bundle.location,
        radius: bundle.radius,
        scheduledTime: bundle.scheduledTime,
        notificationCount: bundle.notifications.length
      })),
      bundledCount: bundles.reduce((sum, bundle) => sum + bundle.notifications.length, 0),
      totalCount: userNotifications.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/stats
 * Get notification statistics for the current user
 */
router.get('/stats', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const userNotifications = NotificationScheduler.getScheduledNotifications(userId);
    const allStats = NotificationScheduler.getStats();

    // Calculate user-specific stats
    const userStats = {
      total: userNotifications.length,
      pending: userNotifications.filter(n => n.status === 'pending').length,
      delivered: userNotifications.filter(n => n.status === 'delivered').length,
      failed: userNotifications.filter(n => n.status === 'failed').length,
      cancelled: userNotifications.filter(n => n.status === 'cancelled').length
    };

    res.status(200).json({
      user: userStats,
      system: allStats
    });
  } catch (error) {
    next(error);
  }
});

export default router;