import { Router, Request, Response } from 'express';

const router = Router();

// Placeholder routes - will be implemented in later tasks
router.get('/', (req: Request, res: Response) => {
  res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Places listing not yet implemented',
      timestamp: new Date().toISOString()
    }
  });
});

router.post('/', (req: Request, res: Response) => {
  res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Place creation not yet implemented',
      timestamp: new Date().toISOString()
    }
  });
});

router.put('/:id', (req: Request, res: Response) => {
  res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Place update not yet implemented',
      timestamp: new Date().toISOString()
    }
  });
});

router.delete('/:id', (req: Request, res: Response) => {
  res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Place deletion not yet implemented',
      timestamp: new Date().toISOString()
    }
  });
});

export { router as placeRoutes };