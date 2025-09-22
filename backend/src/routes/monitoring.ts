import { Router } from 'express';
import { query } from '../database/connection';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

function parseWindow(window?: string): string {
  switch (window) {
    case '1h':
    case '24h':
    case '7d':
      return window;
    default:
      return '1h';
  }
}

function intervalForWindow(window: string): string {
  switch (window) {
    case '1h':
      return "NOW() - INTERVAL '1 hour'";
    case '24h':
      return "NOW() - INTERVAL '24 hours'";
    case '7d':
      return "NOW() - INTERVAL '7 days'";
    default:
      return "NOW() - INTERVAL '1 hour'";
  }
}

// GET /api/monitoring/sla - summary metrics for API reliability & latency
router.get('/sla', authenticateToken, async (req, res) => {
  try {
    const win = parseWindow(req.query.window as string | undefined);
    const sinceExpr = intervalForWindow(win);

    const sql = `
      SELECT 
        COUNT(*)::INT AS total_requests,
        COALESCE(AVG(response_time_ms),0)::INT AS avg_latency_ms,
        COALESCE(PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY response_time_ms), 0)::INT AS p95_latency_ms,
        COALESCE(SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END),0)::INT AS server_errors,
        COALESCE(SUM(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 ELSE 0 END),0)::INT AS client_errors,
        COALESCE(ROUND(SUM(CASE WHEN status_code < 400 THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(*),0) * 100, 2), 0) AS success_rate
      FROM api_request_metrics
      WHERE timestamp >= ${sinceExpr}
    `;

    const result = await query(sql);
    const row = result.rows[0] || {} as any;

    return res.json({ success: true, data: { window: win, ...row } });
  } catch (error: any) {
    logger.error('Failed to get SLA summary', error);
    return res.status(500).json({ success: false, message: 'Failed to get SLA summary' });
  }
});

// GET /api/monitoring/sla/timeseries?minutes=60 - per-minute latency & errors
router.get('/sla/timeseries', authenticateToken, async (req, res) => {
  try {
    const minutes = Math.min(Math.max(parseInt((req.query.minutes as string) || '60', 10), 1), 1440);

    const sql = `
      SELECT 
        DATE_TRUNC('minute', timestamp) AS minute,
        COUNT(*)::INT AS total,
        AVG(response_time_ms)::INT AS avg_latency_ms,
        COALESCE(PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY response_time_ms), 0)::INT AS p95_latency_ms,
        SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END)::INT AS server_errors,
        SUM(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 ELSE 0 END)::INT AS client_errors
      FROM api_request_metrics
      WHERE timestamp >= NOW() - ($1 || ' minutes')::INTERVAL
      GROUP BY 1
      ORDER BY minute ASC
    `;

    const result = await query(sql, [minutes.toString()]);
    return res.json({ success: true, data: result.rows });
  } catch (error: any) {
    logger.error('Failed to get SLA timeseries', error);
    return res.status(500).json({ success: false, message: 'Failed to get SLA timeseries' });
  }
});

export default router;
