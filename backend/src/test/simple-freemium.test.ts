import { User } from '../models/User';

describe('Simple Freemium Model Tests', () => {
  let testUser: User;

  beforeEach(async () => {
    // Create a test user
    const deviceId = `test-device-${Date.now()}`;
    testUser = await User.create({ device_id: deviceId });
  });

  afterEach(async () => {
    // Clean up test data
    if (testUser) {
      await testUser.delete();
    }
  });

  describe('User Premium Status', () => {
    it('should create user with free status by default', () => {
      expect(testUser.premium_status).toBe('free');
      expect(testUser.isPremium()).toBe(false);
    });

    it('should allow upgrading to premium', async () => {
      const updatedUser = await testUser.upgradeToPremium();
      expect(updatedUser.premium_status).toBe('premium');
      expect(updatedUser.isPremium()).toBe(true);
    });

    it('should allow starting trial', async () => {
      const updatedUser = await testUser.startTrial();
      expect(updatedUser.premium_status).toBe('trial');
      expect(updatedUser.isPremium()).toBe(true);
    });

    it('should not allow starting trial for non-free users', async () => {
      await testUser.startTrial();
      
      await expect(testUser.startTrial()).rejects.toThrow('User is not eligible for trial');
    });
  });

  describe('Task Limits', () => {
    it('should return correct task count for new user', async () => {
      const taskCount = await testUser.getActiveTaskCount();
      expect(taskCount).toBe(0);
    });

    it('should allow free users to create tasks up to limit', async () => {
      const canCreate = await testUser.canCreateTask();
      expect(canCreate).toBe(true);
    });

    it('should allow premium users unlimited tasks', async () => {
      await testUser.upgradeToPremium();
      const canCreate = await testUser.canCreateTask();
      expect(canCreate).toBe(true);
    });

    it('should have correct max task limits', () => {
      expect(testUser.maxActiveTasks).toBe(3);
      
      testUser.premium_status = 'premium';
      expect(testUser.maxActiveTasks).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('User Preferences', () => {
    it('should have default preferences', () => {
      expect(testUser.preferences).toBeDefined();
      expect(testUser.preferences.notificationStyle).toBe('standard');
      expect(testUser.preferences.privacyMode).toBe('standard');
    });

    it('should allow updating preferences', async () => {
      const newPreferences = {
        notificationStyle: 'minimal' as const,
        privacyMode: 'foreground_only' as const
      };

      const updatedUser = await testUser.updatePreferences(newPreferences);
      expect(updatedUser.preferences.notificationStyle).toBe('minimal');
      expect(updatedUser.preferences.privacyMode).toBe('foreground_only');
    });
  });

  describe('Email Association', () => {
    it('should allow associating email with account', async () => {
      const email = 'test@example.com';
      const updatedUser = await testUser.associateEmail(email);
      expect(updatedUser.email).toBe(email);
    });

    it('should not allow duplicate email association', async () => {
      const email = 'test@example.com';
      await testUser.associateEmail(email);

      // Create another user and try to associate same email
      const anotherUser = await User.create({ device_id: 'another-device' });
      
      await expect(anotherUser.associateEmail(email)).rejects.toThrow('Email is already associated with another account');
      
      // Clean up
      await anotherUser.delete();
    });
  });
});