import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { ValidationError } from '../models/validation';

/**
 * Middleware to authenticate JWT tokens
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization header is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN_FORMAT',
          message: 'Authorization header must be in format: Bearer <token>',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const token = parts[1];
    const { user, sessionId } = await AuthService.validateSession(token);

    // Attach user and session info to request
    (req as any).user = user;
    (req as any).sessionId = sessionId;

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    
    if (error instanceof ValidationError) {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed',
        timestamp: new Date().toISOString()
      }
    });
  }
}

/**
 * Middleware to authenticate JWT tokens but allow requests to continue if no token
 */
export async function optionalAuthentication(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      next();
      return;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      next();
      return;
    }

    const token = parts[1];
    const { user, sessionId } = await AuthService.validateSession(token);

    // Attach user and session info to request
    (req as any).user = user;
    (req as any).sessionId = sessionId;

    next();
  } catch (error) {
    // For optional auth, we don't fail the request if token is invalid
    console.warn('Optional authentication failed:', error);
    next();
  }
}

/**
 * Middleware to check if user has premium access
 */
export function requirePremium(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  
  if (!user) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  if (!user.isPremium()) {
    res.status(403).json({
      error: {
        code: 'PREMIUM_REQUIRED',
        message: 'Premium subscription required for this feature',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  next();
}

/**
 * Middleware to check task creation limits for free users
 */
export async function checkTaskLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;
    
    if (!user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const canCreate = await user.canCreateTask();
    if (!canCreate) {
      res.status(403).json({
        error: {
          code: 'TASK_LIMIT_EXCEEDED',
          message: 'Free users are limited to 3 active tasks. Upgrade to premium for unlimited tasks.',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Task limit check error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check task limits',
        timestamp: new Date().toISOString()
      }
    });
  }
}

/**
 * Rate limiting middleware (basic implementation)
 */
export function rateLimit(windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const identifier = req.ip || 'unknown';
    const now = Date.now();
    
    const userRequests = requests.get(identifier);
    
    if (!userRequests || now > userRequests.resetTime) {
      requests.set(identifier, {
        count: 1,
        resetTime: now + windowMs
      });
      next();
      return;
    }

    if (userRequests.count >= maxRequests) {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          timestamp: new Date().toISOString(),
          retryAfter: Math.ceil((userRequests.resetTime - now) / 1000)
        }
      });
      return;
    }

    userRequests.count++;
    next();
  };
}