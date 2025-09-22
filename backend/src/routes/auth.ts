import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { AuthService } from '../services/authService';
import { User } from '../models/User';
import { ValidationError } from '../models/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Validation schemas
const deviceAuthSchema = Joi.object({
  device_id: Joi.string().min(1).max(255).optional()
});

const emailAssociationSchema = Joi.object({
  email: Joi.string().email().required()
});

const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string().required()
});

const deviceTokenSchema = Joi.object({
  device_token: Joi.string().min(1).required(),
  platform: Joi.string().valid('ios', 'android').required()
});

/**
 * POST /auth/device
 * Create or login with device-based authentication
 */
router.post('/device', async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = deviceAuthSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: error.details.map(d => d.message).join(', '),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { device_id } = value;
    const result = await AuthService.loginWithDevice(device_id);

    res.status(200).json({
      data: {
        user: result.user,
        tokens: result.tokens
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Device authentication error:', error);
    
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
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
});

/**
 * POST /auth/email
 * Associate email with device account
 */
router.post('/email', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = emailAssociationSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: error.details.map(d => d.message).join(', '),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { email } = value;
    const userId = (req as any).user.id;

    await AuthService.associateEmail(userId, email);

    res.status(200).json({
      data: {
        message: 'Email associated successfully'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Email association error:', error);
    
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Email association failed',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = refreshTokenSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: error.details.map(d => d.message).join(', '),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { refresh_token } = value;
    const tokens = await AuthService.refreshToken(refresh_token);

    res.status(200).json({
      data: {
        tokens
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    
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
        message: 'Token refresh failed',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /auth/device-token
 * Register or update device push notification token
 */
router.post('/device-token', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { error, value } = deviceTokenSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: error.details.map(d => d.message).join(', '),
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    const { device_token, platform } = value;
    const userId = (req as any).user.id;

    // Update user's push token
    await User.updatePushToken(userId, device_token, platform);

    res.status(200).json({
      data: {
        message: 'Device token registered successfully',
        platform,
        registered_at: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Device token registration error:', error);
    
    if (error instanceof ValidationError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Device token registration failed',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /auth/logout
 * Logout and invalidate current session
 */
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).sessionId;
    await AuthService.logout(sessionId);

    res.status(200).json({
      data: {
        message: 'Logged out successfully'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Logout error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Logout failed',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /auth/logout-all
 * Logout from all devices
 */
router.post('/logout-all', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    await AuthService.logoutAllDevices(userId);

    res.status(200).json({
      data: {
        message: 'Logged out from all devices successfully'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Logout all error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Logout from all devices failed',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /auth/sessions
 * Get active sessions for current user
 */
router.get('/sessions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const sessions = await AuthService.getActiveSessions(userId);

    res.status(200).json({
      data: {
        sessions
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve sessions',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /auth/me
 * Get current user information
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    res.status(200).json({
      data: {
        user: user.toJSON()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get user info error:', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve user information',
        timestamp: new Date().toISOString()
      }
    });
  }
});

export { router as authRoutes };