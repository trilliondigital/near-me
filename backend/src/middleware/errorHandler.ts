import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../models/validation';

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
  // Map error to HTTP status and code
  const { statusCode, code, message, details } = mapError(err);

  console.error(`Error ${statusCode}: ${message}`, {
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    code
  });

  const payload: any = {
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    }
  };

  if (details) {
    payload.error.details = details;
  }

  res.status(statusCode).json(payload);
};

function mapError(err: APIError | Error): { statusCode: number; code: string; message: string; details?: unknown } {
  // Validation errors
  if (err instanceof ValidationError || err.name === 'ValidationError') {
    const ve = err as ValidationError;
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: ve.message,
      details: (ve as any).details || undefined
    };
  }

  // Errors that already specify status/code
  if ((err as APIError).statusCode || (err as APIError).code) {
    return {
      statusCode: (err as APIError).statusCode || 500,
      code: (err as APIError).code || 'INTERNAL_ERROR',
      message: err.message || 'Internal Server Error'
    };
  }

  // Map by common error names/messages if available
  const name = err.name || '';
  const msg = err.message || 'Internal Server Error';
  const mappings: Record<string, { status: number; code: string }> = {
    UnauthorizedError: { status: 401, code: 'UNAUTHORIZED' },
    ForbiddenError: { status: 403, code: 'FORBIDDEN' },
    NotFoundError: { status: 404, code: 'NOT_FOUND' },
    RateLimitError: { status: 429, code: 'RATE_LIMITED' }
  };

  if (mappings[name]) {
    return { statusCode: mappings[name].status, code: mappings[name].code, message: msg };
  }

  // Default
  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: msg
  };
}