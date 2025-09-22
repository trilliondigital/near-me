import { User } from '../models/User';
import { UserEntity, UserPreferences } from '../models/types';

// Mock user entity for testing
const createMockUserEntity = (premiumStatus: 'free' | 'trial' | 'premium' = 'free'): UserEntity => ({
  id: 'test-user-id',
  device_id: 'test-device-id',
  email: undefined,
  preferences: {
    notificationStyle: 'standard',
    privacyMode: 'standard'
  } as UserPreferences,
  premium_status: premiumStatus,
  push_token: undefined,
  created_at: new Date(),
  updated_at: new Date()
});

describe('Freemium Model Unit Tests', () => {
  describe('User Premium Status Logic', () => {
    it('should identify free users correctly', () => {
      const userEntity = createMockUserEntity('free');
      const user = new User(userEntity);
      
      expect(user.premium_status).toBe('free');
      expect(user.isPremium()).toBe(false);
      expect(user.maxActiveTasks).toBe(3);
    });

    it('should identify trial users as premium', () => {
      const userEntity = createMockUserEntity('trial');
      const user = new User(userEntity);
      
      expect(user.premium_status).toBe('trial');
      expect(user.isPremium()).toBe(true);
      expect(user.maxActiveTasks).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should identify premium users correctly', () => {
      const userEntity = createMockUserEntity('premium');
      const user = new User(userEntity);
      
      expect(user.premium_status).toBe('premium');
      expect(user.isPremium()).toBe(true);
      expect(user.maxActiveTasks).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('Task Limit Logic', () => {
    it('should return correct max tasks for free users', () => {
      const userEntity = createMockUserEntity('free');
      const user = new User(userEntity);
      
      expect(user.maxActiveTasks).toBe(3);
    });

    it('should return unlimited tasks for premium users', () => {
      const userEntity = createMockUserEntity('premium');
      const user = new User(userEntity);
      
      expect(user.maxActiveTasks).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should return unlimited tasks for trial users', () => {
      const userEntity = createMockUserEntity('trial');
      const user = new User(userEntity);
      
      expect(user.maxActiveTasks).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('User JSON Serialization', () => {
    it('should serialize user without device_id', () => {
      const userEntity = createMockUserEntity('free');
      const user = new User(userEntity);
      
      const json = user.toJSON();
      
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('premium_status', 'free');
      expect(json).toHaveProperty('preferences');
      expect(json).not.toHaveProperty('device_id');
    });

    it('should include email when present', () => {
      const userEntity = createMockUserEntity('premium');
      userEntity.email = 'test@example.com';
      const user = new User(userEntity);
      
      const json = user.toJSON();
      
      expect(json).toHaveProperty('email', 'test@example.com');
    });
  });

  describe('Premium Feature Logic', () => {
    it('should correctly identify premium features availability', () => {
      const freeUser = new User(createMockUserEntity('free'));
      const premiumUser = new User(createMockUserEntity('premium'));
      const trialUser = new User(createMockUserEntity('trial'));
      
      // Free user should not have premium features
      expect(freeUser.isPremium()).toBe(false);
      
      // Premium user should have all features
      expect(premiumUser.isPremium()).toBe(true);
      
      // Trial user should have premium features
      expect(trialUser.isPremium()).toBe(true);
    });
  });
});