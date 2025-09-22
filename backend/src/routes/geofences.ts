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
    const userId = req.user!.id;
    const { events } = req.body;

    if (!events || !Array.isArray(events)) {
      throw new ValidationError('Events array is required', []);
    }

    // Import services
    const { GeofenceEventProcessor } = await import('../services/geofenceEventProcessor');
    const { EventQueueService } = await import('../services/eventQueueService');

    // Add user_id to each event
    const eventsWithUserId = events.map(event => ({
      ...event,
      user_id: userId
    }));

    // Try to process events immediately, queue failures for retry
    const results = [];
    const queuedEvents = [];

    for (const eventData of eventsWithUserId) {
      try {
        const result = await GeofenceEventProcessor.processEvent(eventData);
        results.push(result);
      } catch (error) {
        // Queue for retry if immediate processing fails
        const eventId = await EventQueueService.enqueueEvent(eventData);
        queuedEvents.push({ 
          eventId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    res.json({
      success: true,
      data: {
        processed: results.length,
        queued: queuedEvents.length,
        results: results.map(r => ({
          eventId: r.event.id,
          shouldNotify: r.shouldNotify,
          reason: r.reason,
          bundledWith: r.bundledWith
        })),
        queuedEvents
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/geofences/events/sync
 * Sync offline events from mobile clients
 */
router.post('/events/sync', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { events } = req.body;

    if (!events || !Array.isArray(events)) {
      throw new ValidationError('Events array is required', []);
    }

    const { EventQueueService } = await import('../services/eventQueueService');

    // Add user_id to each event
    const eventsWithUserId = events.map(event => ({
      ...event,
      user_id: userId
    }));

    const syncResult = await EventQueueService.syncOfflineEvents(userId, eventsWithUserId);

    res.json({
      success: true,
      data: syncResult,
      message: `Synced ${events.length} offline events`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/geofences/events/queue
 * Get queued events for the authenticated user
 */
router.get('/events/queue', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { EventQueueService } = await import('../services/eventQueueService');

    const queuedEvents = EventQueueService.getQueuedEventsForUser(userId);
    const queueStats = EventQueueService.getQueueStats();

    res.json({
      success: true,
      data: {
        events: queuedEvents,
        stats: queueStats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/geofences/events/stats
 * Get event processing statistics
 */
router.get('/events/stats', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const days = parseInt(req.query.days as string) || 7;

    const { GeofenceEventProcessor } = await import('../services/geofenceEventProcessor');
    const stats = await GeofenceEventProcessor.getProcessingStats(userId, days);

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
 * POST /api/geofences/events/retry/:eventId
 * Retry a failed queued event
 */
router.post('/events/retry/:eventId', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const eventId = req.params.eventId;
    const { EventQueueService } = await import('../services/eventQueueService');

    const success = await EventQueueService.retryEvent(eventId);

    if (!success) {
      throw new ValidationError('Event not found in queue or currently processing', []);
    }

    res.json({
      success: true,
      message: 'Event retry initiated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/geofences/events/history
 * Get event history for the authenticated user
 */
router.get('/events/history', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as any;

    const { GeofenceEvent } = await import('../models/GeofenceEvent');
    const events = await GeofenceEvent.findByUserId(userId, {
      status,
      limit,
      offset
    });

    res.json({
      success: true,
      data: events.map(e => e.toJSON()),
      pagination: {
        limit,
        offset,
        total: events.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

export { router as geofenceRoutes };