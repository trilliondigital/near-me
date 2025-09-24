import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

/**
 * Validates the request using express-validator's accumulated validation checks.
 * If there are errors, responds with 400 and a normalized error payload.
 */
export function validateRequest(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({
        param: e.param,
        msg: e.msg,
        location: (e as any).location,
        value: e.value
      }))
    });
    return;
  }
  next();
}
