import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { query } from '../database/connection';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/feedback - submit user feedback (bug/idea/ux/performance/other)
router.post('/', authenticateToken, [
  body('category').isIn(['bug','idea','ux','performance','other']).withMessage('Invalid category'),
  body('message').isString().isLength({ min: 5 }).withMessage('Message is too short'),
  body('platform').optional().isIn(['ios','android']).withMessage('Invalid platform'),
  body('appVersion').optional().isString().withMessage('Invalid appVersion'),
  body('metadata').optional().isObject().withMessage('metadata must be an object')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const userId = (req as any).user?.id || null;

    const sql = `
      INSERT INTO user_feedback (user_id, platform, app_version, category, message, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `;

    const result = await query(sql, [
      userId,
      req.body.platform || null,
      req.body.appVersion || null,
      req.body.category,
      req.body.message,
      req.body.metadata ? JSON.stringify(req.body.metadata) : null
    ]);

    logger.info('User feedback submitted', { userId, category: req.body.category });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Failed to submit feedback', error);
    return res.status(500).json({ success: false, message: 'Failed to submit feedback' });
  }
});

// GET /api/feedback/recent - list recent feedback (TODO: admin check)
router.get('/recent', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT id, user_id, platform, app_version, category, message, metadata, created_at
      FROM user_feedback
      ORDER BY created_at DESC
      LIMIT 50
    `);
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    logger.error('Failed to get feedback', error);
    return res.status(500).json({ success: false, message: 'Failed to get feedback' });
  }
});

export default router;
