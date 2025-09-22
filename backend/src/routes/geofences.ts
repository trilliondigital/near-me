import { Router, Request, Response } from 'express';

const router = Router();

// Placeholder routes - will be implemented in later tasks
router.post('/register', (req: Request, res: Response) => {
  res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Geofence registration not yet implemented',
      timestamp: new Date().toISOString()
    }
  });
});

router.delete('/:id', (req: Request, res: Response) => {
  res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Geofence removal not yet implemented',
      timestamp: new Date().toISOString()
    }
  });
});

router.post('/events', (req: Request, res: Response) => {
  res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Geofence event processing not yet implemented',
      timestamp: new Date().toISOString()
    }
  });
});

export { router as geofenceRoutes };