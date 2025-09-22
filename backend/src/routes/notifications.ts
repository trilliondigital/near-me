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

    if (!action) {
      return res.status(400).json({
        error: 'Missing required field: action'
      });
    }

    await NotificationService.handleNotificationAction(notificationId, action, userId);

    res.json({
      message: `Notification action '${action}' processed successfully`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/scheduled
 * Get scheduled notifications for the user
 */
router.get('/scheduled', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const scheduledNotifications = NotificationScheduler.getScheduledNotifications(userId);

    res.json({
      notifications: scheduledNotifications.map(scheduled => ({
        id: scheduled.id,
        status: scheduled.status,
        scheduledTime: scheduled.scheduledTime,
        attempts: scheduled.attempts,
        notification: {
          id: scheduled.notification.id,
          type: scheduled.notification.type,
          title: scheduled.notification.title,
          body: scheduled.notification.body
        }
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/notifications/scheduled/:scheduledId
 * Cancel a scheduled notification
 */
router.delete('/scheduled/:scheduledId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { scheduledId } = req.params;
    const cancelled = await NotificationScheduler.cancelNotification(scheduledId);

    if (!cancelled) {
      return res.status(404).json({
        error: 'Scheduled notification not found'
      });
    }

    res.json({
      message: 'Notification cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/process-pending
 * Process pending notifications (admin/background job endpoint)
 */
router.post('/process-pending', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // This would typically be restricted to admin users or called by background jobs
    const stats = await NotificationScheduler.processPendingNotifications();

    res.json({
      message: 'Pending notifications processed',
      stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notifications/stats
 * Get notification system statistics
 */
router.get('/stats', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const stats = NotificationScheduler.getStats();

    res.json({
      scheduler: stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notifications/test
 * Test notification creation (development only)
 */
router.post('/test', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'Test endpoint not available in production'
      });
    }

    const { type = 'approach', title = 'Test Notification', body = 'This is a test notification' } = req.body;
    const userId = req.user!.id;

    // Create a test notification
    const testNotification = {
      id: `test_${Date.now()}`,
      taskId: 'test-task',
      userId,
      type,
      title,
      body,
      actions: [
        { id: 'complete', title: 'Complete', type: 'complete' },
        { id: 'snooze', title: 'Snooze', type: 'snooze_15m' }
      ],
      scheduledTime: new Date(),
      metadata: {
        geofenceId: 'test-geofence',
        geofenceType: 'approach_5mi',
        location: { latitude: 37.7749, longitude: -122.4194 }
      }
    } as any;

    const scheduled = await NotificationScheduler.scheduleNotification(testNotification);

    res.json({
      message: 'Test notification created',
      notification: testNotification,
      scheduled: {
        id: scheduled.id,
        status: scheduled.status,
        scheduledTime: scheduled.scheduledTime
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;