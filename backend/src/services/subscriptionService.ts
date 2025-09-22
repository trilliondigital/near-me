import { query, transaction } from '../database/connection';
import { User } from '../models/User';
import { ValidationError } from '../models/validation';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration: 'monthly' | 'yearly';
  features: string[];
  trialDays: number;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'trial' | 'expired' | 'cancelled' | 'pending';
  startDate: Date;
  endDate: Date;
  trialEndDate?: Date;
  autoRenew: boolean;
  platform: 'ios' | 'android';
  transactionId?: string;
  originalTransactionId?: string;
  receiptData?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrialStartRequest {
  userId: string;
  planId: string;
  platform: 'ios' | 'android';
}

export interface SubscriptionPurchaseRequest {
  userId: string;
  planId: string;
  platform: 'ios' | 'android';
  transactionId: string;
  originalTransactionId?: string;
  receiptData: string;
}

export class SubscriptionService {
  private static readonly TRIAL_DURATION_DAYS = 7;
  
  private static readonly PLANS: SubscriptionPlan[] = [
    {
      id: 'premium_monthly',
      name: 'Premium Monthly',
      price: 4.99,
      currency: 'USD',
      duration: 'monthly',
      features: [
        'unlimited_tasks',
        'custom_notification_sounds',
        'detailed_notifications',
        'advanced_geofencing',
        'priority_support',
        'export_data'
      ],
      trialDays: 7
    },
    {
      id: 'premium_yearly',
      name: 'Premium Yearly',
      price: 49.99,
      currency: 'USD',
      duration: 'yearly',
      features: [
        'unlimited_tasks',
        'custom_notification_sounds',
        'detailed_notifications',
        'advanced_geofencing',
        'priority_support',
        'export_data'
      ],
      trialDays: 7
    }
  ];

  /**
   * Get available subscription plans
   */
  static getPlans(): SubscriptionPlan[] {
    return this.PLANS;
  }

  /**
   * Get plan by ID
   */
  static getPlan(planId: string): SubscriptionPlan | null {
    return this.PLANS.find(plan => plan.id === planId) || null;
  }

  /**
   * Start free trial for user
   */
  static async startTrial(request: TrialStartRequest): Promise<Subscription> {
    const { userId, planId, platform } = request;

    // Validate plan exists
    const plan = this.getPlan(planId);
    if (!plan) {
      throw new ValidationError('Invalid subscription plan', []);
    }

    // Check if user exists and is eligible for trial
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError('User not found', []);
    }

    if (user.premium_status !== 'free') {
      throw new ValidationError('User is not eligible for trial', []);
    }

    // Check if user has already used trial
    const existingTrial = await this.getUserSubscription(userId);
    if (existingTrial) {
      throw new ValidationError('User has already used trial', []);
    }

    const now = new Date();
    const trialEndDate = new Date(now.getTime() + (this.TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000));

    return transaction(async (client) => {
      // Create subscription record
      const subscriptionResult = await client.query<Subscription>(
        `INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date, trial_end_date, auto_renew, platform)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [userId, planId, 'trial', now, trialEndDate, trialEndDate, true, platform]
      );

      const subscription = subscriptionResult.rows[0];

      // Update user premium status
      await client.query(
        'UPDATE users SET premium_status = $1, updated_at = NOW() WHERE id = $2',
        ['trial', userId]
      );

      return subscription;
    });
  }

  /**
   * Process subscription purchase
   */
  static async processPurchase(request: SubscriptionPurchaseRequest): Promise<Subscription> {
    const { userId, planId, platform, transactionId, originalTransactionId, receiptData } = request;

    // Validate plan exists
    const plan = this.getPlan(planId);
    if (!plan) {
      throw new ValidationError('Invalid subscription plan', []);
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError('User not found', []);
    }

    // Check for duplicate transaction
    const existingTransaction = await query<Subscription>(
      'SELECT * FROM subscriptions WHERE transaction_id = $1',
      [transactionId]
    );

    if (existingTransaction.rows.length > 0) {
      throw new ValidationError('Transaction already processed', []);
    }

    const now = new Date();
    const endDate = new Date(now.getTime() + (plan.duration === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000);

    return transaction(async (client) => {
      // Get existing subscription if any
      const existingSubscription = await this.getUserSubscription(userId);

      if (existingSubscription) {
        // Update existing subscription
        const updatedResult = await client.query<Subscription>(
          `UPDATE subscriptions 
           SET plan_id = $1, status = $2, end_date = $3, auto_renew = $4, 
               transaction_id = $5, original_transaction_id = $6, receipt_data = $7, updated_at = NOW()
           WHERE user_id = $8
           RETURNING *`,
          [planId, 'active', endDate, true, transactionId, originalTransactionId, receiptData, userId]
        );

        // Update user premium status
        await client.query(
          'UPDATE users SET premium_status = $1, updated_at = NOW() WHERE id = $2',
          ['premium', userId]
        );

        return updatedResult.rows[0];
      } else {
        // Create new subscription
        const subscriptionResult = await client.query<Subscription>(
          `INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date, auto_renew, platform, transaction_id, original_transaction_id, receipt_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [userId, planId, 'active', now, endDate, true, platform, transactionId, originalTransactionId, receiptData]
        );

        // Update user premium status
        await client.query(
          'UPDATE users SET premium_status = $1, updated_at = NOW() WHERE id = $2',
          ['premium', userId]
        );

        return subscriptionResult.rows[0];
      }
    });
  }

  /**
   * Get user's current subscription
   */
  static async getUserSubscription(userId: string): Promise<Subscription | null> {
    const result = await query<Subscription>(
      'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(userId: string): Promise<Subscription> {
    const subscription = await this.getUserSubscription(userId);
    if (!subscription) {
      throw new ValidationError('No active subscription found', []);
    }

    return transaction(async (client) => {
      // Update subscription status
      const updatedResult = await client.query<Subscription>(
        `UPDATE subscriptions 
         SET status = $1, auto_renew = $2, updated_at = NOW()
         WHERE user_id = $3
         RETURNING *`,
        ['cancelled', false, userId]
      );

      // Update user premium status if subscription has expired
      const now = new Date();
      if (subscription.endDate <= now) {
        await client.query(
          'UPDATE users SET premium_status = $1, updated_at = NOW() WHERE id = $2',
          ['free', userId]
        );
      }

      return updatedResult.rows[0];
    });
  }

  /**
   * Restore subscription (for app store restoration)
   */
  static async restoreSubscription(userId: string, receiptData: string, platform: 'ios' | 'android'): Promise<Subscription | null> {
    // This would typically involve validating the receipt with Apple/Google
    // For now, we'll implement a basic restoration based on receipt data
    
    const existingSubscription = await query<Subscription>(
      'SELECT * FROM subscriptions WHERE receipt_data = $1 AND platform = $2 ORDER BY created_at DESC LIMIT 1',
      [receiptData, platform]
    );

    if (existingSubscription.rows.length === 0) {
      return null;
    }

    const subscription = existingSubscription.rows[0];

    // Update user association if different
    if (subscription.userId !== userId) {
      return transaction(async (client) => {
        const updatedResult = await client.query<Subscription>(
          'UPDATE subscriptions SET user_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
          [userId, subscription.id]
        );

        // Update user premium status
        const now = new Date();
        const isActive = subscription.status === 'active' && subscription.endDate > now;
        
        await client.query(
          'UPDATE users SET premium_status = $1, updated_at = NOW() WHERE id = $2',
          [isActive ? 'premium' : 'free', userId]
        );

        return updatedResult.rows[0];
      });
    }

    return subscription;
  }

  /**
   * Check and update expired subscriptions
   */
  static async processExpiredSubscriptions(): Promise<void> {
    const now = new Date();
    
    await transaction(async (client) => {
      // Find expired subscriptions
      const expiredResult = await client.query<Subscription>(
        `SELECT * FROM subscriptions 
         WHERE status IN ('active', 'trial') AND end_date <= $1`,
        [now]
      );

      for (const subscription of expiredResult.rows) {
        // Update subscription status
        await client.query(
          'UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2',
          ['expired', subscription.id]
        );

        // Update user premium status
        await client.query(
          'UPDATE users SET premium_status = $1, updated_at = NOW() WHERE id = $2',
          ['free', subscription.userId]
        );
      }
    });
  }

  /**
   * Get subscription analytics
   */
  static async getAnalytics(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    trialSubscriptions: number;
    monthlyRevenue: number;
    conversionRate: number;
  }> {
    const [totalResult, activeResult, trialResult, revenueResult] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*) as count FROM subscriptions'),
      query<{ count: string }>('SELECT COUNT(*) as count FROM subscriptions WHERE status = $1', ['active']),
      query<{ count: string }>('SELECT COUNT(*) as count FROM subscriptions WHERE status = $1', ['trial']),
      query<{ revenue: string }>(
        `SELECT COALESCE(SUM(
          CASE 
            WHEN s.plan_id = 'premium_monthly' THEN 4.99
            WHEN s.plan_id = 'premium_yearly' THEN 49.99 / 12
            ELSE 0
          END
        ), 0) as revenue
        FROM subscriptions s
        WHERE s.status = 'active'`
      )
    ]);

    const totalSubscriptions = parseInt(totalResult.rows[0].count, 10);
    const activeSubscriptions = parseInt(activeResult.rows[0].count, 10);
    const trialSubscriptions = parseInt(trialResult.rows[0].count, 10);
    const monthlyRevenue = parseFloat(revenueResult.rows[0].revenue);
    
    const conversionRate = totalSubscriptions > 0 ? (activeSubscriptions / totalSubscriptions) * 100 : 0;

    return {
      totalSubscriptions,
      activeSubscriptions,
      trialSubscriptions,
      monthlyRevenue,
      conversionRate
    };
  }
}