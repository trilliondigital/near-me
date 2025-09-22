import { Router, Request, Response } from 'express';
import { NotificationService } from '../services/notificationService';
import { NotificationHistory } from '../models/NotificationHistory';
import { NotificationSnooze } from '../models/NotificationSnooze';
import { TaskMute } from '../models/TaskMute';
import { ValidationError } from '../models/validation';

const router = Router();

/**
 * Get notification history for a user
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    const result = await NotificationService.getUserNotificationHistory(
      userId,
      page,
      limit,
      status
    );

    res.json({
      notifications: result.notifications.map(n => n.toJSON()),
      total: result.total,
      page,
      limit
    });
  } catch (error) {
    console.error('Error fetching notification history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch notification history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get active snoozes for a user
 */
router.get('/snoozes', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const snoozes = await NotificationService.getUserActiveSnoozes(userId);

    res.json({
      snoozes: snoozes.map(s => s.toJSON())
    });
  } catch (error) {
    console.error('Error fetching active snoozes:', error);
    res.status(500).json({ 
      error: 'Failed to fetch active snoozes',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get active mutes for a user
 */
router.get('/mutes', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const mutes = await NotificationService.getUserActiveMutes(userId);

    res.json({
      mutes: mutes.map(m => m.toJSON())
    });
  } catch (error) {
    console.error('Error fetching active mutes:', error);
    res.status(500).json({ 
      error: 'Failed to fetch active mutes',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Cancel a snooze
 */
router.post('/snoozes/:snoozeId/cancel', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { snoozeId } = req.params;

    // Find the snooze and verify ownership
    const snooze = await NotificationSnooze.findByNotificationId(snoozeId);
    if (!snooze || snooze.userId !== userId) {
      return res.status(404).json({ error: 'Snooze not found' });
    }

    await snooze.cancel();

    res.json({ 
      message: 'Snooze cancelled successfully',
      snooze: snooze.toJSON()
    });
  } catch (error) {
    console.error('Error cancelling snooze:', error);
    res.status(500).json({ 
      error: 'Failed to cancel snooze',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Extend a snooze
 */
router.post('/snoozes/:snoozeId/extend', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { snoozeId } = req.params;
    const { duration } = req.body;

    if (!duration || !['15m', '1h', 'today'].includes(duration)) {
      return res.status(400).json({ error: 'Invalid snooze duration' });
    }

    // Find the snooze and verify ownership
    const snooze = await NotificationSnooze.findByNotificationId(snoozeId);
    if (!snooze || snooze.userId !== userId) {
      return res.status(404).json({ error: 'Snooze not found' });
    }

    await snooze.extendSnooze(duration);

    res.json({ 
      message: 'Snooze extended successfully',
      snooze: snooze.toJSON()
    });
  } catch (error) {
    console.error('Error extending snooze:', error);
    res.status(500).json({ 
      error: 'Failed to extend snooze',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Cancel a task mute
 */
router.post('/mutes/:muteId/cancel', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { muteId } = req.params;

    // Find the mute and verify ownership
    const mute = await TaskMute.findActiveByTaskId(muteId);
    if (!mute || mute.userId !== userId) {
      return res.status(404).json({ error: 'Mute not found' });
    }

    await mute.cancel();

    res.json({ 
      message: 'Mute cancelled successfully',
      mute: mute.toJSON()
    });
  } catch (error) {
    console.error('Error cancelling mute:', error);
    res.status(500).json({ 
      error: 'Failed to cancel mute',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Extend a task mute
 */
router.post('/mutes/:muteId/extend', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { muteId } = req.params;
    const { duration } = req.body;

    if (!duration || !['1h', '4h', '8h', '24h', 'until_tomorrow', 'permanent'].includes(duration)) {
      return res.status(400).json({ error: 'Invalid mute duration' });
    }

    // Find the mute and verify ownership
    const mute = await TaskMute.findActiveByTaskId(muteId);
    if (!mute || mute.userId !== userId) {
      return res.status(404).json({ error: 'Mute not found' });
    }

    await mute.extendMute(duration);

    res.json({ 
      message: 'Mute extended successfully',
      mute: mute.toJSON()
    });
  } catch (error) {
    console.error('Error extending mute:', error);
    res.status(500).json({ 
      error: 'Failed to extend mute',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Process expired snoozes (admin/system endpoint)
 */
router.post('/process-expired-snoozes', async (req: Request, res: Response) => {
  try {
    await NotificationService.processExpiredSnoozes();
    res.json({ message: 'Expired snoozes processed successfully' });
  } catch (error) {
    console.error('Error processing expired snoozes:', error);
    res.status(500).json({ 
      error: 'Failed to process expired snoozes',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Process expired mutes (admin/system endpoint)
 */
router.post('/process-expired-mutes', async (req: Request, res: Response) => {
  try {
    await NotificationService.processExpiredMutes();
    res.json({ message: 'Expired mutes processed successfully' });
  } catch (error) {
    console.error('Error processing expired mutes:', error);
    res.status(500).json({ 
      error: 'Failed to process expired mutes',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Process notification retries (admin/system endpoint)
 */
router.post('/process-retries', async (req: Request, res: Response) => {
  try {
    await NotificationService.processNotificationRetries();
    res.json({ message: 'Notification retries processed successfully' });
  } catch (error) {
    console.error('Error processing notification retries:', error);
    res.status(500).json({ 
      error: 'Failed to process notification retries',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
