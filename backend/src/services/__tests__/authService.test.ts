import jwt from 'jsonwebtoken';
import { AuthService, TokenPayload } from '../authService';
import { User } from '../../models/User';
import { getRedis } from '../../database/connection';
import { ValidationError } from '../../models/validation';

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../database/connection');
jest.mock('jsonwebtoken');

const mockUser = User as jest.Mocked<typeof User>;
const mockGetRedis = getRedis as jest.MockedFunction<typeof getRedis>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

// Mock Redis client
const mockRedisClient = {
  setEx: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  ttl: jest.fn(),
  ping: jest.fn()
};

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env['JWT_SECRET'] = 'test-secret';
    mockGetRedis.mockReturnValue(mockRedisClient as any);
  });

  afterEach(() => {
    delete process.env['JWT_SECRET'];
  });

  describe('generateDeviceId', () => {
    it('should generate a device ID with correct prefix', () => {
      const deviceId = AuthService.generateDeviceId();
      expect(deviceId).toMatch(/^device_[0-9a-f-]{36}$/);
    });

    it('should generate unique device IDs', () => {
      const id1 = AuthService.generateDeviceId();
      const id2 = AuthService.generateDeviceId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('createDeviceAccount', () => {
    it('should return existing user if device ID already exists', async () => {
      const existingUser = {
        id: 'user-123',
        device_id: 'device-456',
        email: 'test@example.com',
        created_at: new Date(),
        preferences: { notificationStyle: 'standard', privacyMode: 'standard' }
      };

      mockUser.findByDeviceId.mockResolvedValue(existingUser as any);

      const result = await AuthService.createDeviceAccount('device-456');

      expect(result).toEqual({
        id: 'user-123',
        deviceId: 'device-456',
        email: 'test@example.com',
        createdAt: existingUser.created_at,
        preferences: existingUser.preferences
      });
      expect(mockUser.create).not.toHaveBeenCalled();
    });

    it('should create new user if device ID does not exist', async () => {
      const newUser = {
        id: 'user-789',
        device_id: 'device-new',
        email: undefined,
        created_at: new Date(),
        preferences: { notificationStyle: 'standard', privacyMode: 'standard' }
      };

      mockUser.findByDeviceId.mockResolvedValue(null);
      mockUser.create.mockResolvedValue(newUser as any);

      const result = await AuthService.createDeviceAccount('device-new');

      expect(mockUser.create).toHaveBeenCalledWith({
        device_id: 'device-new'
      });
      expect(result).toEqual({
        id: 'user-789',
        deviceId: 'device-new',
        email: undefined,
        createdAt: newUser.created_at,
        preferences: newUser.preferences
      });
    });

    it('should generate device ID if not provided', async () => {
      mockUser.findByDeviceId.mockResolvedValue(null);
      mockUser.create.mockResolvedValue({
        id: 'user-123',
        device_id: 'generated-device-id',
        created_at: new Date(),
        preferences: {}
      } as any);

      await AuthService.createDeviceAccount();

      expect(mockUser.create).toHaveBeenCalledWith({
        device_id: expect.stringMatching(/^device_[0-9a-f-]{36}$/)
      });
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      (mockJwt.sign as jest.Mock)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await AuthService.generateTokens('user-123', 'device-456');

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900, // 15 minutes
        tokenType: 'Bearer'
      });

      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });

    it('should throw error if JWT_SECRET is not set', async () => {
      delete process.env['JWT_SECRET'];

      await expect(
        AuthService.generateTokens('user-123', 'device-456')
      ).rejects.toThrow('JWT_SECRET environment variable is required');
    });

    it('should handle Redis errors gracefully', async () => {
      (mockJwt.sign as jest.Mock)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));

      // Should not throw error even if Redis fails
      const result = await AuthService.generateTokens('user-123', 'device-456');
      expect(result.accessToken).toBe('access-token');
    });
  });

  describe('validateToken', () => {
    it('should validate and return token payload', async () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        deviceId: 'device-456',
        sessionId: 'session-789',
        type: 'access'
      };

      (mockJwt.verify as jest.Mock).mockReturnValue(payload);
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        userId: 'user-123',
        deviceId: 'device-456',
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      }));

      const result = await AuthService.validateToken('valid-token');

      expect(result).toEqual(payload);
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret', {
        issuer: 'nearme-api',
        audience: 'nearme-app'
      });
    });

    it('should throw ValidationError for invalid token', async () => {
      (mockJwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      await expect(
        AuthService.validateToken('invalid-token')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for expired token', async () => {
      (mockJwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      await expect(
        AuthService.validateToken('expired-token')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if session not found', async () => {
      const payload: TokenPayload = {
        userId: 'user-123',
        deviceId: 'device-456',
        sessionId: 'session-789',
        type: 'access'
      };

      (mockJwt.verify as jest.Mock).mockReturnValue(payload);
      mockRedisClient.get.mockResolvedValue(null);

      await expect(
        AuthService.validateToken('valid-token')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('refreshToken', () => {
    it('should generate new tokens for valid refresh token', async () => {
      const refreshPayload: TokenPayload = {
        userId: 'user-123',
        deviceId: 'device-456',
        sessionId: 'session-789',
        type: 'refresh'
      };

      (mockJwt.verify as jest.Mock).mockReturnValue(refreshPayload);
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        userId: 'user-123',
        deviceId: 'device-456'
      }));
      mockUser.findById.mockResolvedValue({ id: 'user-123' } as any);
      (mockJwt.sign as jest.Mock)
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await AuthService.refreshToken('refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should throw error for access token used as refresh token', async () => {
      const accessPayload: TokenPayload = {
        userId: 'user-123',
        deviceId: 'device-456',
        sessionId: 'session-789',
        type: 'access'
      };

      (mockJwt.verify as jest.Mock).mockReturnValue(accessPayload);
      mockRedisClient.get.mockResolvedValue(JSON.stringify({}));

      await expect(
        AuthService.refreshToken('access-token')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw error if user not found', async () => {
      const refreshPayload: TokenPayload = {
        userId: 'user-123',
        deviceId: 'device-456',
        sessionId: 'session-789',
        type: 'refresh'
      };

      (mockJwt.verify as jest.Mock).mockReturnValue(refreshPayload);
      mockRedisClient.get.mockResolvedValue(JSON.stringify({}));
      mockUser.findById.mockResolvedValue(null);

      await expect(
        AuthService.refreshToken('refresh-token')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('loginWithDevice', () => {
    it('should login existing user', async () => {
      const existingUser = {
        id: 'user-123',
        device_id: 'device-456',
        email: 'test@example.com',
        created_at: new Date(),
        preferences: {}
      };

      mockUser.findByDeviceId.mockResolvedValue(existingUser as any);
      (mockJwt.sign as jest.Mock)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await AuthService.loginWithDevice('device-456');

      expect(result.user.id).toBe('user-123');
      expect(result.tokens.accessToken).toBe('access-token');
    });

    it('should create new user if device not found', async () => {
      const newUser = {
        id: 'user-789',
        device_id: 'device-new',
        created_at: new Date(),
        preferences: {}
      };

      mockUser.findByDeviceId.mockResolvedValue(null);
      mockUser.create.mockResolvedValue(newUser as any);
      (mockJwt.sign as jest.Mock)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await AuthService.loginWithDevice('device-new');

      expect(result.user.id).toBe('user-789');
      expect(mockUser.create).toHaveBeenCalled();
    });
  });

  describe('associateEmail', () => {
    it('should associate email with user account', async () => {
      const user = {
        associateEmail: jest.fn().mockResolvedValue(undefined)
      };

      mockUser.findById.mockResolvedValue(user as any);

      await AuthService.associateEmail('user-123', 'test@example.com');

      expect(user.associateEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should throw error if user not found', async () => {
      mockUser.findById.mockResolvedValue(null);

      await expect(
        AuthService.associateEmail('user-123', 'test@example.com')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('logout', () => {
    it('should delete session from Redis', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await AuthService.logout('session-123');

      expect(mockRedisClient.del).toHaveBeenCalledWith('session:session-123');
    });

    it('should not throw error if Redis fails', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(AuthService.logout('session-123')).resolves.toBeUndefined();
    });
  });

  describe('logoutAllDevices', () => {
    it('should delete all user sessions', async () => {
      mockRedisClient.keys.mockResolvedValue(['session:1', 'session:2', 'session:3']);
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user-123' }))
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user-456' }))
        .mockResolvedValueOnce(JSON.stringify({ userId: 'user-123' }));
      mockRedisClient.del.mockResolvedValue(2);

      await AuthService.logoutAllDevices('user-123');

      expect(mockRedisClient.del).toHaveBeenCalledWith(['session:1', 'session:3']);
    });

    it('should handle empty session list', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      await AuthService.logoutAllDevices('user-123');

      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions for user', async () => {
      mockRedisClient.keys.mockResolvedValue(['session:1', 'session:2']);
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({
          userId: 'user-123',
          deviceId: 'device-1',
          createdAt: '2023-01-01T00:00:00Z',
          lastActivity: '2023-01-01T01:00:00Z'
        }))
        .mockResolvedValueOnce(JSON.stringify({
          userId: 'user-456',
          deviceId: 'device-2',
          createdAt: '2023-01-01T00:00:00Z',
          lastActivity: '2023-01-01T01:00:00Z'
        }));

      const result = await AuthService.getActiveSessions('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]?.sessionId).toBe('1');
      expect(result[0]?.deviceId).toBe('device-1');
    });

    it('should return empty array on Redis error', async () => {
      mockRedisClient.keys.mockRejectedValue(new Error('Redis error'));

      const result = await AuthService.getActiveSessions('user-123');

      expect(result).toEqual([]);
    });
  });
});