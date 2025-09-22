import request from 'supertest';
import express from 'express';
import { authRouter } from '../auth';
import { User } from '../../models/User';
import { AuthService } from '../../services/authService';

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../services/authService');

const mockUser = User as jest.Mocked<typeof User>;
const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;

describe('Auth Device Token Endpoint', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRouter);
    jest.clearAllMocks();
  });

  describe('POST /auth/device-token', () => {
    const validTokenData = {
      device_token: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      platform: 'ios'
    };

    const mockAuthMiddleware = (req: any, res: any, next: any) => {
      req.user = { id: 'test-user-123' };
      next();
    };

    it('should register device token successfully', async () => {
      mockUser.updatePushToken.mockResolvedValue();

      const response = await request(app)
        .post('/auth/device-token')
        .set('Authorization', 'Bearer valid-token')
        .send(validTokenData)
        .expect(200);

      expect(response.body.data.message).toBe('Device token registered successfully');
      expect(response.body.data.platform).toBe('ios');
      expect(response.body.data.registered_at).toBeDefined();

      expect(mockUser.updatePushToken).toHaveBeenCalledWith(
        'test-user-123',
        validTokenData.device_token,
        'ios'
      );
    });

    it('should handle android platform', async () => {
      const androidTokenData = {
        ...validTokenData,
        platform: 'android'
      };

      mockUser.updatePushToken.mockResolvedValue();

      const response = await request(app)
        .post('/auth/device-token')
        .set('Authorization', 'Bearer valid-token')
        .send(androidTokenData)
        .expect(200);

      expect(response.body.data.platform).toBe('android');
      expect(mockUser.updatePushToken).toHaveBeenCalledWith(
        'test-user-123',
        androidTokenData.device_token,
        'android'
      );
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/auth/device-token')
        .set('Authorization', 'Bearer valid-token')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_REQUEST');
      expect(response.body.error.message).toContain('device_token');
      expect(response.body.error.message).toContain('platform');
    });

    it('should validate platform values', async () => {
      const invalidTokenData = {
        ...validTokenData,
        platform: 'invalid-platform'
      };

      const response = await request(app)
        .post('/auth/device-token')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidTokenData)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_REQUEST');
      expect(response.body.error.message).toContain('platform');
    });

    it('should validate device token format', async () => {
      const invalidTokenData = {
        device_token: 'invalid-token',
        platform: 'ios'
      };

      const response = await request(app)
        .post('/auth/device-token')
        .set('Authorization', 'Bearer valid-token')
        .send(invalidTokenData)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_REQUEST');
      expect(response.body.error.message).toContain('device_token');
    });

    it('should handle database errors', async () => {
      mockUser.updatePushToken.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/auth/device-token')
        .set('Authorization', 'Bearer valid-token')
        .send(validTokenData)
        .expect(500);

      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(response.body.error.message).toBe('Device token registration failed');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/auth/device-token')
        .send(validTokenData)
        .expect(401);

      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Token validation', () => {
    it('should accept valid iOS device tokens', async () => {
      const validTokens = [
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        'ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      ];

      mockUser.updatePushToken.mockResolvedValue();

      for (const token of validTokens) {
        const response = await request(app)
          .post('/auth/device-token')
          .set('Authorization', 'Bearer valid-token')
          .send({
            device_token: token,
            platform: 'ios'
          })
          .expect(200);

        expect(response.body.data.message).toBe('Device token registered successfully');
      }
    });

    it('should reject invalid device tokens', async () => {
      const invalidTokens = [
        'short',
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcde', // 63 chars
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefg', // 65 chars
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdeg', // invalid hex
        ''
      ];

      for (const token of invalidTokens) {
        const response = await request(app)
          .post('/auth/device-token')
          .set('Authorization', 'Bearer valid-token')
          .send({
            device_token: token,
            platform: 'ios'
          })
          .expect(400);

        expect(response.body.error.code).toBe('INVALID_REQUEST');
      }
    });
  });
});
