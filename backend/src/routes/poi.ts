import { Router, Request, Response } from 'express';

const router = Router();

// Placeholder routes - will be implemented in later tasks
router.get('/nearby', (req: Request, res: Response) => {
  res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Nearby POI search not yet implemented',
      timestamp: new Date().toISOString()
    }
  });
});

router.get('/categories', (req: Request, res: Response) => {
  res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'POI categories not yet implemented',
      timestamp: new Date().toISOString()
    }
  });
});

export { router as poiRoutes };