import { Router, Request, Response, NextFunction } from 'express';
import { BackgroundProcessor } from '../services/backgroundProcessor';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/background/status
 * Get background processor status
 */
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = BackgroundProcessor.getStatus();
    const stats = await BackgroundProcessor.getStats();

    res.status(200).json({
      status,
      stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/background/force-run
 * Force run background processor (admin only)
 */
router.post('/force-run', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // In a production app, you'd want to check for admin permissions here
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    await BackgroundProcessor.forceRun();

    res.status(200).json({
      message: 'Background processor executed successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/background/start
 * Start background processor (admin only)
 */
router.post('/start', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    BackgroundProcessor.start();

    res.status(200).json({
      message: 'Background processor started successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/background/stop
 * Stop background processor (admin only)
 */
router.post('/stop', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    BackgroundProcessor.stop();

    res.status(200).json({
      message: 'Background processor stopped successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/background/config
 * Update background processor configuration (admin only)
 */
router.put('/config', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      intervalMinutes,
      enableSnoozeProcessing,
      enableMuteProcessing,
      enableRetryProcessing,
      enableSchedulerProcessing,
      enableCleanup,
      cleanupOlderThanHours
    } = req.body;

    // Validate configuration
    const config: any = {};
    
    if (intervalMinutes !== undefined) {
      if (typeof intervalMinutes !== 'number' || intervalMinutes < 1 || intervalMinutes > 60) {
        return res.status(400).json({ 
          error: 'intervalMinutes must be a number between 1 and 60' 
        });
      }
      config.intervalMinutes = intervalMinutes;
    }

    if (enableSnoozeProcessing !== undefined) {
      config.enableSnoozeProcessing = Boolean(enableSnoozeProcessing);
    }

    if (enableMuteProcessing !== undefined) {
      config.enableMuteProcessing = Boolean(enableMuteProcessing);
    }

    if (enableRetryProcessing !== undefined) {
      config.enableRetryProcessing = Boolean(enableRetryProcessing);
    }

    if (enableSchedulerProcessing !== undefined) {
      config.enableSchedulerProcessing = Boolean(enableSchedulerProcessing);
    }

    if (enableCleanup !== undefined) {
      config.enableCleanup = Boolean(enableCleanup);
    }

    if (cleanupOlderThanHours !== undefined) {
      if (typeof cleanupOlderThanHours !== 'number' || cleanupOlderThanHours < 1) {
        return res.status(400).json({ 
          error: 'cleanupOlderThanHours must be a positive number' 
        });
      }
      config.cleanupOlderThanHours = cleanupOlderThanHours;
    }

    BackgroundProcessor.configure(config);

    res.status(200).json({
      message: 'Background processor configuration updated successfully',
      config: BackgroundProcessor.getStatus().config
    });
  } catch (error) {
    next(error);
  }
});

export default router;