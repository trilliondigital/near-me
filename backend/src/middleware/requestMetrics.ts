import { Request, Response, NextFunction } from 'express';
import { query } from '../database/connection';

// Middleware to record API request metrics for SLA monitoring
export const requestMetrics = async (req: Request, res: Response, next: NextFunction) => {
  const start = process.hrtime.bigint();

  // Proceed and capture when response finishes
  const onFinish = async () => {
    res.removeListener('finish', onFinish);
    res.removeListener('close', onFinish);

    try {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000; // ns to ms

      const method = req.method;
      // Prefer the matched route path, fallback to originalUrl (without query)
      const route = (req.route && (req.baseUrl + req.route.path)) || req.originalUrl.split('?')[0] || 'unknown';
      const status = res.statusCode;
      const userId = (req as any).user?.id || null;
      const ip = (req.headers['cf-connecting-ip'] as string) || req.ip;
      const userAgent = req.get('User-Agent') || null;
      const error = status >= 400;

      const sql = `
        INSERT INTO api_request_metrics (
          timestamp, method, route, status_code, response_time_ms, user_id, ip_address, user_agent, error, error_code
        ) VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7, $8, NULL)
      `;

      await query(sql, [
        method,
        route,
        status,
        Math.round(durationMs),
        userId,
        ip,
        userAgent,
        error
      ]);
    } catch (e) {
      // Best-effort; never throw from middleware
    }
  };

  res.on('finish', onFinish);
  res.on('close', onFinish);

  next();
};
