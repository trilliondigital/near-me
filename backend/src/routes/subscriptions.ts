import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { SubscriptionService } from '../services/subscriptionService';
import { ValidationError } from '../models/validation';

const router = express.Router();

/**
 * GET /api/subscriptions/plans
 * Get available subscription plans
 */
router.get('/plans', (req, res) => {
  try {
    const plans = SubscriptionService.getPlans();
    res.json({ plans });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({ 
      error: 'Failed to fetch subscription plans',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/subscriptions/current
 * Get user's current subscription
 */
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const subscription = await SubscriptionService.getUserSubscription(userId);
    res.json({ subscription });
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    res.status(500).json({ 
      error: 'Failed to fetch subscription',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/subscriptions/trial
 * Start free trial
 */
router.post('/trial', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { planId, platform } = req.body;

    if (!planId || !platform) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'planId and platform are required'
      });
    }

    if (!['ios', 'android'].includes(platform)) {
      return res.status(400).json({ 
        error: 'Invalid platform',
        details: 'Platform must be ios or android'
      });
    }

    const subscription = await SubscriptionService.startTrial({
      userId,
      planId,
      platform
    });

    res.status(201).json({ 
      subscription,
      message: 'Trial started successfully'
    });
  } catch (error) {
    console.error('Error starting trial:', error);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        error: 'Validation error',
        message: error.message,
        details: error.details
      });
    }

    res.status(500).json({ 
      error: 'Failed to start trial',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/subscriptions/purchase
 * Process subscription purchase
 */
router.post('/purchase', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { planId, platform, transactionId, originalTransactionId, receiptData } = req.body;

    if (!planId || !platform || !transactionId || !receiptData) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'planId, platform, transactionId, and receiptData are required'
      });
    }

    if (!['ios', 'android'].includes(platform)) {
      return res.status(400).json({ 
        error: 'Invalid platform',
        details: 'Platform must be ios or android'
      });
    }

    const subscription = await SubscriptionService.processPurchase({
      userId,
      planId,
      platform,
      transactionId,
      originalTransactionId,
      receiptData
    });

    res.status(201).json({ 
      subscription,
      message: 'Subscription activated successfully'
    });
  } catch (error) {
    console.error('Error processing purchase:', error);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        error: 'Validation error',
        message: error.message,
        details: error.details
      });
    }

    res.status(500).json({ 
      error: 'Failed to process purchase',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/subscriptions/restore
 * Restore subscription from receipt
 */
router.post('/restore', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { receiptData, platform } = req.body;

    if (!receiptData || !platform) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'receiptData and platform are required'
      });
    }

    if (!['ios', 'android'].includes(platform)) {
      return res.status(400).json({ 
        error: 'Invalid platform',
        details: 'Platform must be ios or android'
      });
    }

    const subscription = await SubscriptionService.restoreSubscription(userId, receiptData, platform);

    if (!subscription) {
      return res.status(404).json({ 
        error: 'No subscription found',
        message: 'No subscription found for the provided receipt'
      });
    }

    res.json({ 
      subscription,
      message: 'Subscription restored successfully'
    });
  } catch (error) {
    console.error('Error restoring subscription:', error);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        error: 'Validation error',
        message: error.message,
        details: error.details
      });
    }

    res.status(500).json({ 
      error: 'Failed to restore subscription',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/subscriptions/cancel
 * Cancel subscription
 */
router.delete('/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const subscription = await SubscriptionService.cancelSubscription(userId);

    res.json({ 
      subscription,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        error: 'Validation error',
        message: error.message,
        details: error.details
      });
    }

    res.status(500).json({ 
      error: 'Failed to cancel subscription',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/subscriptions/analytics
 * Get subscription analytics (admin only)
 */
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    // Note: In a real app, you'd check for admin permissions here
    const analytics = await SubscriptionService.getAnalytics();
    res.json({ analytics });
  } catch (error) {
    console.error('Error fetching subscription analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;