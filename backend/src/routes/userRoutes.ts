import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { authenticateToken } from '../middleware/auth';
import { validateSchema, updateUserSchema, ValidationError } from '../models/validation';
import { UpdateUserRequest } from '../models/types';

const router = Router();

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    email?: string;
    roles?: string[];
  };
};

/**
 * Get current user profile
 */
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        timestamp: new Date().toISOString()
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      data: user.toJSON(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Update user profile
 */
router.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        timestamp: new Date().toISOString()
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const validatedData = validateSchema<UpdateUserRequest>(updateUserSchema, req.body);
    const updatedUser = await user.update(validatedData);

    return res.json({
      success: true,
      data: updatedUser.toJSON(),
      message: 'User profile updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message,
        errors: error.details,
        timestamp: new Date().toISOString()
      });
    }

    console.error('Error updating user profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get task limit status for current user
 */
router.get('/task-limit', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        timestamp: new Date().toISOString()
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const activeTaskCount = await user.getActiveTaskCount();
    const maxTasks = user.isPremium() ? Number.MAX_SAFE_INTEGER : 3;

    const taskLimitStatus = {
      currentCount: activeTaskCount,
      maxCount: maxTasks,
      isPremium: user.isPremium()
    };

    return res.json({
      success: true,
      data: taskLimitStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching task limit:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Start premium trial
 */
router.post('/start-trial', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        timestamp: new Date().toISOString()
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    if (user.premium_status !== 'free') {
      return res.status(400).json({
        success: false,
        message: 'User is not eligible for trial',
        timestamp: new Date().toISOString()
      });
    }

    const updatedUser = await user.startTrial();

    return res.json({
      success: true,
      data: updatedUser.toJSON(),
      message: 'Trial started successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message,
        errors: error.details,
        timestamp: new Date().toISOString()
      });
    }

    console.error('Error starting trial:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Upgrade to premium
 */
router.post('/upgrade-premium', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        timestamp: new Date().toISOString()
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    // In a real implementation, you would verify the subscription purchase here
    // For now, we'll just upgrade the user
    const updatedUser = await user.upgradeToPremium();

    return res.json({
      success: true,
      data: updatedUser.toJSON(),
      message: 'Upgraded to premium successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error upgrading to premium:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Associate email with account
 */
router.post('/associate-email', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        timestamp: new Date().toISOString()
      });
    }

    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required',
        timestamp: new Date().toISOString()
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const updatedUser = await user.associateEmail(email);

    return res.json({
      success: true,
      data: updatedUser.toJSON(),
      message: 'Email associated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message,
        errors: error.details,
        timestamp: new Date().toISOString()
      });
    }

    console.error('Error associating email:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Get premium features list
 */
router.get('/premium-features', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        timestamp: new Date().toISOString()
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        timestamp: new Date().toISOString()
      });
    }

    const features = [
      {
        id: 'unlimited_tasks',
        name: 'Unlimited Tasks',
        description: 'Create as many location-based tasks as you need',
        available: user.isPremium()
      },
      {
        id: 'custom_notification_sounds',
        name: 'Custom Notification Sounds',
        description: 'Choose custom sounds for your notifications',
        available: user.isPremium()
      },
      {
        id: 'detailed_notifications',
        name: 'Detailed Notifications',
        description: 'Rich notifications with more context and actions',
        available: user.isPremium()
      },
      {
        id: 'advanced_geofencing',
        name: 'Advanced Geofencing',
        description: 'Fine-tune geofence radii and timing',
        available: user.isPremium()
      },
      {
        id: 'priority_support',
        name: 'Priority Support',
        description: 'Get help faster with priority customer support',
        available: user.isPremium()
      },
      {
        id: 'export_data',
        name: 'Export Data',
        description: 'Export your tasks and data anytime',
        available: user.isPremium()
      }
    ];

    return res.json({
      success: true,
      data: features,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching premium features:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;