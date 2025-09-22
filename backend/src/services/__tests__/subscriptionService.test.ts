import { SubscriptionService } from '../subscriptionService';
import { User } from '../../models/User';
import { query, transaction } from '../../database/connection';
import { ValidationError } from '../../models/validation';

// Mock the database connection
jest.mock('../../database/connection');
jest.mock('../../models/User');

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockTransaction = transaction as jest.MockedFunction<typeof transaction>;
const mockUserFindById = User.findById as jest.MockedFunction<typeof User.findById>;

describe('SubscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlans', () => {
    it('should return available subscription plans', () => {
      const plans = SubscriptionService.getPlans();
      
      expect(plans).toHaveLength(2);
      expect(plans[0].id).toBe('premium_monthly');
      expect(plans[1].id).toBe('premium_yearly');
      expect(plans[0].price).toBe(4.99);
      expect(plans[1].price).toBe(49.99);
    });
  });

  describe('getPlan', () => {
    it('should return plan by ID', () => {
      const plan = SubscriptionService.getPlan('premium_monthly');
      
      expect(plan).toBeDefined();
      expect(plan?.id).toBe('premium_monthly');
      expect(plan?.price).toBe(4.99);
    });

    it('should return null for invalid plan ID', () => {
      const plan = SubscriptionService.getPlan('invalid_plan');
      
      expect(plan).toBeNull();
    });
  });

  describe('startTrial', () => {
    const mockUser = {
      id: 'user-123',
      premium_status: 'free'
    };

    beforeEach(() => {
      mockUserFindById.mockResolvedValue(mockUser as any);
      mockTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({
            rows: [{
              id: 'sub-123',
              user_id: 'user-123',
              plan_id: 'premium_monthly',
              status: 'trial',
              start_date: new Date(),
              end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              trial_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              auto_renew: true,
              platform: 'ios'
            }]
          })
        };
        return callback(mockClient as any);
      });
    });

    it('should start trial for eligible user', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as any);

      const subscription = await SubscriptionService.startTrial({
        userId: 'user-123',
        planId: 'premium_monthly',
        platform: 'ios'
      });

      expect(subscription).toBeDefined();
      expect(subscription.status).toBe('trial');
      expect(subscription.plan_id).toBe('premium_monthly');
    });

    it('should throw error for invalid plan', async () => {
      await expect(SubscriptionService.startTrial({
        userId: 'user-123',
        planId: 'invalid_plan',
        platform: 'ios'
      })).rejects.toThrow(ValidationError);
    });

    it('should throw error for non-existent user', async () => {
      mockUserFindById.mockResolvedValue(null);

      await expect(SubscriptionService.startTrial({
        userId: 'invalid-user',
        planId: 'premium_monthly',
        platform: 'ios'
      })).rejects.toThrow(ValidationError);
    });

    it('should throw error for ineligible user', async () => {
      mockUserFindById.mockResolvedValue({
        ...mockUser,
        premium_status: 'premium'
      } as any);

      await expect(SubscriptionService.startTrial({
        userId: 'user-123',
        planId: 'premium_monthly',
        platform: 'ios'
      })).rejects.toThrow(ValidationError);
    });

    it('should throw error if user already used trial', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'existing-sub' }]
      } as any);

      await expect(SubscriptionService.startTrial({
        userId: 'user-123',
        planId: 'premium_monthly',
        platform: 'ios'
      })).rejects.toThrow(ValidationError);
    });
  });

  describe('processPurchase', () => {
    const mockUser = {
      id: 'user-123',
      premium_status: 'free'
    };

    beforeEach(() => {
      mockUserFindById.mockResolvedValue(mockUser as any);
      mockTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({
            rows: [{
              id: 'sub-123',
              user_id: 'user-123',
              plan_id: 'premium_monthly',
              status: 'active',
              start_date: new Date(),
              end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              auto_renew: true,
              platform: 'ios',
              transaction_id: 'txn-123'
            }]
          })
        };
        return callback(mockClient as any);
      });
    });

    it('should process purchase for valid transaction', async () => {
      // Mock no existing transaction
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);
      // Mock no existing subscription
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const subscription = await SubscriptionService.processPurchase({
        userId: 'user-123',
        planId: 'premium_monthly',
        platform: 'ios',
        transactionId: 'txn-123',
        receiptData: 'receipt-data'
      });

      expect(subscription).toBeDefined();
      expect(subscription.status).toBe('active');
      expect(subscription.transaction_id).toBe('txn-123');
    });

    it('should throw error for duplicate transaction', async () => {
      mockQuery.mockResolvedValue({
        rows: [{ id: 'existing-sub' }]
      } as any);

      await expect(SubscriptionService.processPurchase({
        userId: 'user-123',
        planId: 'premium_monthly',
        platform: 'ios',
        transactionId: 'txn-123',
        receiptData: 'receipt-data'
      })).rejects.toThrow(ValidationError);
    });
  });

  describe('getUserSubscription', () => {
    it('should return user subscription if exists', async () => {
      const mockSubscription = {
        id: 'sub-123',
        user_id: 'user-123',
        status: 'active'
      };

      mockQuery.mockResolvedValue({
        rows: [mockSubscription]
      } as any);

      const subscription = await SubscriptionService.getUserSubscription('user-123');

      expect(subscription).toEqual(mockSubscription);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        ['user-123']
      );
    });

    it('should return null if no subscription exists', async () => {
      mockQuery.mockResolvedValue({ rows: [] } as any);

      const subscription = await SubscriptionService.getUserSubscription('user-123');

      expect(subscription).toBeNull();
    });
  });

  describe('processExpiredSubscriptions', () => {
    it('should update expired subscriptions', async () => {
      const mockExpiredSubscriptions = [
        {
          id: 'sub-1',
          userId: 'user-1',
          status: 'active',
          endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
        },
        {
          id: 'sub-2',
          userId: 'user-2',
          status: 'trial',
          endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
        }
      ];

      mockTransaction.mockImplementation(async (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: mockExpiredSubscriptions })
            .mockResolvedValue({ rows: [] })
        };
        return callback(mockClient as any);
      });

      await SubscriptionService.processExpiredSubscriptions();

      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('getAnalytics', () => {
    it('should return subscription analytics', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '100' }] }) // total
        .mockResolvedValueOnce({ rows: [{ count: '75' }] })  // active
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })  // trial
        .mockResolvedValueOnce({ rows: [{ revenue: '374.25' }] }); // revenue

      const analytics = await SubscriptionService.getAnalytics();

      expect(analytics).toEqual({
        totalSubscriptions: 100,
        activeSubscriptions: 75,
        trialSubscriptions: 10,
        monthlyRevenue: 374.25,
        conversionRate: 75
      });
    });
  });
});