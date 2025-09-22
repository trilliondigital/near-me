import request from 'supertest';
import app from '../server';
import { User } from '../models/User';
import { Task } from '../models/Task';
import { AuthService } from '../services/authService';

describe('Freemium Model Tests', () => {
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    // Create a test user
    const deviceId = 'test-device-freemium';
    const user = await User.create({ device_id: deviceId });
    userId = user.id;

    // Generate auth token
    const tokens = await AuthService.generateTokens(userId, deviceId);
    authToken = tokens.accessToken;
  });

  afterEach(async () => {
    // Clean up test data
    const user = await User.findById(userId);
    if (user) {
      await user.delete();
    }
  });

  describe('Task Limits', () => {
    it('should allow free users to create up to 3 tasks', async () => {
      // Create 3 tasks (should succeed)
      for (let i = 1; i <= 3; i++) {
        const response = await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Test Task ${i}`,
            description: 'Test description',
            location_type: 'poi_category',
            poi_category: 'grocery'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      }

      // Try to create 4th task (should fail)
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Task 4',
          description: 'Test description',
          location_type: 'poi_category',
          poi_category: 'grocery'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('limited to 3 active tasks');
    });

    it('should allow premium users to create unlimited tasks', async () => {
      // Upgrade user to premium
      const user = await User.findById(userId);
      await user!.upgradeToPremium();

      // Create more than 3 tasks (should succeed)
      for (let i = 1; i <= 5; i++) {
        const response = await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Premium Task ${i}`,
            description: 'Test description',
            location_type: 'poi_category',
            poi_category: 'grocery'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      }
    });

    it('should return correct task limit status for free users', async () => {
      // Create 2 tasks
      for (let i = 1; i <= 2; i++) {
        await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Test Task ${i}`,
            description: 'Test description',
            location_type: 'poi_category',
            poi_category: 'grocery'
          });
      }

      const response = await request(app)
        .get('/api/user/task-limit')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        currentCount: 2,
        maxCount: 3,
        isPremium: false
      });
    });

    it('should return correct task limit status for premium users', async () => {
      // Upgrade user to premium
      const user = await User.findById(userId);
      await user!.upgradeToPremium();

      const response = await request(app)
        .get('/api/user/task-limit')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isPremium).toBe(true);
      expect(response.body.data.maxCount).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('Premium Features', () => {
    it('should return premium features list with availability', async () => {
      const response = await request(app)
        .get('/api/user/premium-features')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(6);
      
      // All features should be unavailable for free users
      response.body.data.forEach((feature: any) => {
        expect(feature.available).toBe(false);
      });
    });

    it('should show features as available for premium users', async () => {
      // Upgrade user to premium
      const user = await User.findById(userId);
      await user!.upgradeToPremium();

      const response = await request(app)
        .get('/api/user/premium-features')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // All features should be available for premium users
      response.body.data.forEach((feature: any) => {
        expect(feature.available).toBe(true);
      });
    });
  });

  describe('Trial Management', () => {
    it('should allow free users to start trial', async () => {
      const response = await request(app)
        .post('/api/user/start-trial')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.premium_status).toBe('trial');
    });

    it('should not allow non-free users to start trial', async () => {
      // Start trial first
      await request(app)
        .post('/api/user/start-trial')
        .set('Authorization', `Bearer ${authToken}`);

      // Try to start trial again
      const response = await request(app)
        .post('/api/user/start-trial')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not eligible for trial');
    });

    it('should allow trial users to create unlimited tasks', async () => {
      // Start trial
      await request(app)
        .post('/api/user/start-trial')
        .set('Authorization', `Bearer ${authToken}`);

      // Create more than 3 tasks (should succeed)
      for (let i = 1; i <= 5; i++) {
        const response = await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Trial Task ${i}`,
            description: 'Test description',
            location_type: 'poi_category',
            poi_category: 'grocery'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('User Profile Management', () => {
    it('should return user profile with premium status', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('premium_status', 'free');
      expect(response.body.data).toHaveProperty('preferences');
    });

    it('should allow updating user preferences', async () => {
      const updateData = {
        preferences: {
          notification_style: 'minimal',
          privacy_mode: 'foreground_only'
        }
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.preferences.notification_style).toBe('minimal');
      expect(response.body.data.preferences.privacy_mode).toBe('foreground_only');
    });

    it('should allow associating email with account', async () => {
      const email = 'test@example.com';

      const response = await request(app)
        .post('/api/user/associate-email')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(email);
    });
  });

  describe('Premium Upgrade', () => {
    it('should allow upgrading to premium', async () => {
      const response = await request(app)
        .post('/api/user/upgrade-premium')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.premium_status).toBe('premium');
    });

    it('should allow creating unlimited tasks after upgrade', async () => {
      // Upgrade to premium
      await request(app)
        .post('/api/user/upgrade-premium')
        .set('Authorization', `Bearer ${authToken}`);

      // Create more than 3 tasks (should succeed)
      for (let i = 1; i <= 5; i++) {
        const response = await request(app)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Premium Task ${i}`,
            description: 'Test description',
            location_type: 'poi_category',
            poi_category: 'grocery'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      }
    });
  });
});