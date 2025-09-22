import { Router, Request, Response, NextFunction } from 'express';
import { GeofenceService } from '../services/geofenceService';
import { Geofence } from '../models/Geofence';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { ValidationError } from '../models/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Extend Request interface to include user
interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 * GET /api/geofences
 * Get all active geofences for the authenticated user
 */
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const geofences = await Geofence.findActiveByUserId(userId);

    res.json({
      success: true,
      data: geofences.map(g => g.toJSON()),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/geofences/stats
 * Get geofence statistics for the authenticated user
 */
router.get('/stats', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const stats = await GeofenceService.getGeofenceStats(userId);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/geofences/task/:taskId
 * Get all geofences for a specific task
 */
router.get('/task/:taskId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const taskId = req.params.taskId;

    // Verify task belongs to user
    const task = await Task.findById(taskId, userId);
    if (!task) {
      throw new ValidationError('Task not found', []);
    }

    const geofences = await Geofence.findByTaskId(taskId);

    res.json({
      success: true,
      data: geofences.map(g => g.toJSON()),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/geofences/task/:taskId/regenerate
 * Regenerate geofences for a specific task
 */
router.post('/task/:taskId/regenerate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const taskId = req.params.taskId;

    // Verify task belongs to user
    const task = await Task.findById(taskId, userId);
    if (!task) {
      throw new ValidationError('Task not found', []);
    }

    const geofences = await GeofenceService.updateGeofencesForTask(task);

    res.json({
      success: true,
      data: geofences.map(g => g.toJSON()),
      message: 'Geofences regenerated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/geofences/optimize
 * Optimize geofences for the authenticated user
 */
router.post('/optimize', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    
    // Get current active geofences count
    const currentCount = await Geofence.countActiveByUserId(userId);
    
    if (currentCount <= 15) {
      res.json({
        success: true,
        message: 'No optimization needed',
        data: { currentCount, optimized: false },
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Force optimization by setting newGeofencesCount to 0
    await GeofenceService.optimizeGeofencesForUser(userId, 0);
    
    const newCount = await Geofence.countActiveByUserId(userId);

    res.json({
      success: true,
      message: 'Geofences optimized successfully',
      data: { 
        previousCount: currentCount, 
        newCount, 
        optimized: true 
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/geofences/validate-radii
 * Validate geofence radii configuration
 */
router.post('/validate-radii', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { radii } = req.body;
    
    if (!radii) {
      throw new ValidationError('Radii configuration required', []);
    }

    const errors = GeofenceService.validateGeofenceRadii(radii);

    res.json({
      success: true,
      data: {
        valid: errors.length === 0,
        errors
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/geofences/defaults/:locationType
 * Get default radii for a location type
 */
router.get('/defaults/:locationType', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const locationType = req.params.locationType as 'custom_place' | 'poi_category';
    const placeType = req.query.placeType as 'home' | 'work' | 'custom';

    if (!['custom_place', 'poi_category'].includes(locationType)) {
      throw new ValidationError('Invalid location type', []);
    }

    const defaultRadii = GeofenceService.getDefaultRadii(locationType, placeType);

    res.json({
      success: true,
      data: defaultRadii,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/geofences/task/:taskId
 * Remove all geofences for a specific task
 */
router.delete('/task/:taskId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const taskId = req.params.taskId;

    // Verify task belongs to user
    const task = await Task.findById(taskId, userId);
    if (!task) {
      throw new ValidationError('Task not found', []);
    }

    await GeofenceService.removeGeofencesForTask(taskId);

    res.json({
      success: true,
      message: 'Geofences removed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/geofences/events
 * Process geofence events (for mobile clients)
 */
router.post('/events', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // This endpoint will be implemented in later tasks when we build
    // the notification system and geofence event processing
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Geofence event processing will be implemented in Phase 3',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

export { router as geofenceRoutes };