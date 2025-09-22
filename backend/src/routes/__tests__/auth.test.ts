import request from 'supertest';
import express from 'express';
import { authRoutes } from '../auth';
import { AuthService } from '../../services/authService';
import { ValidationError } from '../../models/validation';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock the AuthService
jest.mock('../../services/authService');
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    // Mock authenticated user
    req.user = {
      id: 'user-123',
      toJSON: () => ({ id: 'user-123', email: 'test@example.com' })
    };
    req.sessionId = 'session-123';
    next();
  }
}));

const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/device', () => {
    it('should create device account successfully', async () => {
      const mockResult = {
        user: {
          id: 'user-123',
          deviceId: 'device-456',
          email: undefined,
          createdAt: new Date(),
          preferences: {}
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
          tokenType: 'Bearer' as const
        }
      };

      (mockAuthService.loginWithDevice as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/auth/device')
        .send({ device_id: 'device-456' })
        .expect(200);

      expect(response.body.data.user.id).toBe(mockResult.user.id);
      expect(response.body.data.user.deviceId).toBe(mockResult.user.deviceId);
      expect(response.body.data.tokens.accessToken).toBe(mockResult.tokens.accessToken);
      expect(mockAuthService.loginWithDevice).toHaveBeenCalledWith('device-456');
    });

    it('should create device account without device_id', async () => {
      const mockResult = {
        user: {
          id: 'user-123',
          deviceId: 'generated-device-id',
          email: undefined,
          createdAt: new Date(),
          preferences: {}
        },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
          tokenType: 'Bearer' as const
        }
      };

      (mockAuthService.loginWithDevice as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/auth/device')
        .send({})
        .expect(200);

      expect(response.body.data.user.id).toBe(mockResult.user.id);
      expect(response.body.data.user.deviceId).toBe(mockResult.user.deviceId);
      expect(response.body.data.tokens.accessToken).toBe(mockResult.tokens.accessToken);
      expect(mockAuthService.loginWithDevice).toHaveBeenCalledWith(undefined);
    });

    it('should return 400 for invalid device_id', async () => {
      const response = await request(app)
        .post('/auth/device')
        .send({ device_id: '' })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_REQUEST');
    });

    it('should handle validation errors', async () => {
      (mockAuthService.loginWithDevice as jest.Mock).mockRejectedValue(
        new ValidationError('Device ID already exists', [])
      );

      const response = await request(app)
        .post('/auth/device')
        .send({ device_id: 'device-456' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Device ID already exists');
    });

    it('should handle internal errors', async () => {
      (mockAuthService.loginWithDevice as jest.Mock).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/auth/device')
        .send({ device_id: 'device-456' })
        .expect(500);

      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /auth/email', () => {
    it('should associate email successfully', async () => {
      (mockAuthService.associateEmail as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/auth/email')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body.data.message).toBe('Email associated successfully');
      expect(mockAuthService.associateEmail).toHaveBeenCalledWith('user-123', 'test@example.com');
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/auth/email')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_REQUEST');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/auth/email')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_REQUEST');
    });

    it('should handle validation errors', async () => {
      (mockAuthService.associateEmail as jest.Mock).mockRejectedValue(
        new ValidationError('Email is already associated with another account', [])
      );

      const response = await request(app)
        .post('/auth/email')
        .send({ email: 'test@example.com' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      const mockTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer' as const
      };

      (mockAuthService.refreshToken as jest.Mock).mockResolvedValue(mockTokens);

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refresh_token: 'refresh-token' })
        .expect(200);

      expect(response.body.data.tokens).toEqual(mockTokens);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('refresh-token');
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_REQUEST');
    });

    it('should return 401 for invalid refresh token', async () => {
      (mockAuthService.refreshToken as jest.Mock).mockRejectedValue(
        new ValidationError('Invalid refresh token', [])
      );

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refresh_token: 'invalid-token' })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      (mockAuthService.logout as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/auth/logout')
        .expect(200);

      expect(response.body.data.message).toBe('Logged out successfully');
      expect(mockAuthService.logout).toHaveBeenCalledWith('session-123');
    });

    it('should handle logout errors gracefully', async () => {
      (mockAuthService.logout as jest.Mock).mockRejectedValue(new Error('Redis error'));

      const response = await request(app)
        .post('/auth/logout')
        .expect(500);

      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /auth/logout-all', () => {
    it('should logout from all devices successfully', async () => {
      (mockAuthService.logoutAllDevices as jest.Mock).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/auth/logout-all')
        .expect(200);

      expect(response.body.data.message).toBe('Logged out from all devices successfully');
      expect(mockAuthService.logoutAllDevices).toHaveBeenCalledWith('user-123');
    });
  });

  describe('GET /auth/sessions', () => {
    it('should return active sessions', async () => {
      const mockSessions = [
        {
          sessionId: 'session-1',
          createdAt: '2023-01-01T00:00:00Z',
          lastActivity: '2023-01-01T01:00:00Z',
          deviceId: 'device-1'
        },
        {
          sessionId: 'session-2',
          createdAt: '2023-01-01T00:00:00Z',
          lastActivity: '2023-01-01T02:00:00Z',
          deviceId: 'device-2'
        }
      ];

      (mockAuthService.getActiveSessions as jest.Mock).mockResolvedValue(mockSessions);

      const response = await request(app)
        .get('/auth/sessions')
        .expect(200);

      expect(response.body.data.sessions).toEqual(mockSessions);
      expect(mockAuthService.getActiveSessions).toHaveBeenCalledWith('user-123');
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user information', async () => {
      const response = await request(app)
        .get('/auth/me')
        .expect(200);

      expect(response.body.data.user).toEqual({
        id: 'user-123',
        email: 'test@example.com'
      });
    });
  });
});