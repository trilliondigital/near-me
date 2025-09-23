import { Router, Response, NextFunction, Request } from 'express';
import { NotificationService } from '../services/notificationService';
import { NotificationScheduler } from '../services/notificationScheduler';
import { GeofenceEvent } from '../models/GeofenceEvent';
type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    email?: string;
    roles?: string[];
  };
};
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

    return res.status(201).json({
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
    return next(error);
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

    return res.status(200).json({
      message: 'Notification action processed successfully',
      notificationId,
      action
    });
  } catch (error) {
    return next(error);
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

    const notifications = scheduledNotifications.map(scheduled => {
      const n = scheduled.notification as any;
      const isLocation = 'type' in n;
      return {
        id: scheduled.id,
        notification: {
          id: n.id,
          type: isLocation ? n.type : 'bundle',
          title: n.title,
          body: n.body,
          actions: n.actions,
          metadata: isLocation ? n.metadata : undefined
        },
        scheduledTime: scheduled.scheduledTime,
        status: scheduled.status,
        attempts: scheduled.attempts,
        lastAttempt: scheduled.lastAttempt,
        error: scheduled.error
      };
    });

    return res.status(200).json({ notifications });
  } catch (error) {
    return next(error);
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
      return res.status(200).json({
        message: 'Notification cancelled successfully',
        notificationId
      });
    } else {
      return res.status(404).json({
        error: 'Notification not found'
      });
    }
  } catch (error) {
    return next(error);
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

    return res.status(200).json({
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
    return next(error);
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

    return res.status(200).json({
      user: userStats,
      system: allStats
    });
  } catch (error) {
    return next(error);
  }
});

export default router;