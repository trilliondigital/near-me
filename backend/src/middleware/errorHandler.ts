import { Request, Response, NextFunction } from 'express';

export interface APIError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: APIError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_ERROR';

  console.error(`Error ${statusCode}: ${message}`, {
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  res.status(statusCode).json({
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    }
  });
};