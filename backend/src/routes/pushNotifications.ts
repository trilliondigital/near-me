import { Router, Request, Response } from 'express';
import { PushNotificationService } from '../services/pushNotificationService';
import { PushToken } from '../models/PushToken';
import { ValidationError } from '../models/validation';
import { authenticateUser } from '../middleware/auth';

const router = Router();

/**
 * Register device token for push notifications
 * POST /api/push-notifications/register
 */
router.post('/register', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { device_token, platform, device_id, app_version } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!device_token || !platform) {
      return res.status(400).json({ 
        error: 'Device token and platform are required' 
      });
    }

    if (!['ios', 'android'].includes(platform)) {
      return res.status(400).json({ 
        error: 'Platform must be either "ios" or "android"' 
      });
    }

    const pushToken = await PushNotificationService.registerDeviceToken(
      userId,
      device_token,
      platform,
      device_id,
      app_version
    );

    res.status(201).json({
      success: true,
      data: {
        id: pushToken.id,
        platform: pushToken.platform,
        is_active: pushToken.isActive,
        created_at: pushToken.createdAt
      }
    });
  } catch (error) {
    console.error('Error registering device token:', error);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        error: error.message,
        details: error.details 
      });
    }

    res.status(500).json({ error: 'Failed to register device token' });
  }
});

/**
 * Deactivate device token
 * DELETE /api/push-notifications/deactivate
 */
router.delete('/deactivate', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { device_token } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!device_token) {
      return res.status(400).json({ 
        error: 'Device token is required' 
      });
    }

    await PushNotificationService.deactivateDeviceToken(userId, device_token);

    res.json({
      success: true,
      message: 'Device token deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating device token:', error);
    res.status(500).json({ error: 'Failed to deactivate device token' });
  }
});

/**
 * Get user's push tokens
 * GET /api/push-notifications/tokens
 */
router.get('/tokens', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const pushTokens = await PushToken.findByUserId(userId);

    res.json({
      success: true,
      data: pushTokens.map(token => ({
        id: token.id,
        platform: token.platform,
        device_id: token.deviceId,
        app_version: token.appVersion,
        is_active: token.isActive,
        created_at: token.createdAt,
        last_used: token.lastUsed
      }))
    });
  } catch (error) {
    console.error('Error fetching push tokens:', error);
    res.status(500).json({ error: 'Failed to fetch push tokens' });
  }
});

/**
 * Send test notification
 * POST /api/push-notifications/test
 */
router.post('/test', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { title, body } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const result = await PushNotificationService.testNotification(
      userId,
      title || 'Test Notification',
      body || 'This is a test notification from Near Me'
    );

    res.json({
      success: true,
      data: {
        total_sent: result.totalSent,
        success_count: result.successCount,
        failure_count: result.failureCount,
        results: result.results.map(r => ({
          platform: r.platform,
          success: r.success,
          error: r.error
        }))
      }
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

/**
 * Get push notification statistics (admin only)
 * GET /api/push-notifications/stats
 */
router.get('/stats', authenticateUser, async (req: Request, res: Response) => {
  try {
    // TODO: Add admin role check
    const stats = await PushNotificationService.getStatistics();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching push notification stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * Clean up old push tokens (admin only)
 * POST /api/push-notifications/cleanup
 */
router.post('/cleanup', authenticateUser, async (req: Request, res: Response) => {
  try {
    // TODO: Add admin role check
    const result = await PushNotificationService.cleanupTokens();

    res.json({
      success: true,
      data: {
        inactive_removed: result.inactiveRemoved,
        duplicates_removed: result.duplicatesRemoved
      }
    });
  } catch (error) {
    console.error('Error cleaning up push tokens:', error);
    res.status(500).json({ error: 'Failed to clean up tokens' });
  }
});

/**
 * Handle notification action (called by mobile apps)
 * POST /api/push-notifications/action
 */
router.post('/action', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { notification_id, action, task_id } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!notification_id || !action) {
      return res.status(400).json({ 
        error: 'Notification ID and action are required' 
      });
    }

    // Import notification service to handle the action
    const { NotificationService } = await import('../services/notificationService');
    
    await NotificationService.handleNotificationAction(
      notification_id,
      action,
      userId
    );

    res.json({
      success: true,
      message: 'Notification action processed successfully'
    });
  } catch (error) {
    console.error('Error processing notification action:', error);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        error: error.message,
        details: error.details 
      });
    }

    res.status(500).json({ error: 'Failed to process notification action' });
  }
});

export default router;