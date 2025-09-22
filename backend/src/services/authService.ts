import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getRedis } from '../database/connection';
import { User } from '../models/User';
import { ValidationError } from '../models/validation';

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface DeviceAccount {
  id: string;
  deviceId: string;
  email?: string | undefined;
  createdAt: Date;
  preferences: any;
}

export interface TokenPayload {
  userId: string;
  deviceId: string;
  sessionId: string;
  type: 'access' | 'refresh';
}

export class AuthService {
  private static readonly ACCESS_TOKEN_EXPIRY = '15m';
  private static readonly REFRESH_TOKEN_EXPIRY = '7d';
  private static readonly SESSION_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

  /**
   * Generate unique device ID
   */
  static generateDeviceId(): string {
    return `device_${uuidv4()}`;
  }

  /**
   * Create device-based account
   */
  static async createDeviceAccount(deviceId?: string): Promise<DeviceAccount> {
    const finalDeviceId = deviceId || this.generateDeviceId();
    
    // Check if device already exists
    const existingUser = await User.findByDeviceId(finalDeviceId);
    if (existingUser) {
      return {
        id: existingUser.id,
        deviceId: existingUser.device_id,
        email: existingUser.email || undefined,
        createdAt: existingUser.created_at,
        preferences: existingUser.preferences
      };
    }

    // Create new user
    const user = await User.create({
      device_id: finalDeviceId
    });

    return {
      id: user.id,
      deviceId: user.device_id,
      email: user.email || undefined,
      createdAt: user.created_at,
      preferences: user.preferences
    };
  }

  /**
   * Generate JWT tokens
   */
  static async generateTokens(userId: string, deviceId: string): Promise<AuthToken> {
    const sessionId = uuidv4();
    const jwtSecret = process.env['JWT_SECRET'];
    
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    const accessTokenPayload: TokenPayload = {
      userId,
      deviceId,
      sessionId,
      type: 'access'
    };

    const refreshTokenPayload: TokenPayload = {
      userId,
      deviceId,
      sessionId,
      type: 'refresh'
    };

    const accessToken = jwt.sign(accessTokenPayload, jwtSecret, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: 'nearme-api',
      audience: 'nearme-app'
    });

    const refreshToken = jwt.sign(refreshTokenPayload, jwtSecret, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: 'nearme-api',
      audience: 'nearme-app'
    });

    // Store session in Redis
    await this.storeSession(sessionId, userId, deviceId);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      tokenType: 'Bearer'
    };
  }

  /**
   * Store session in Redis
   */
  private static async storeSession(sessionId: string, userId: string, deviceId: string): Promise<void> {
    try {
      const redis = getRedis();
      const sessionData = {
        userId,
        deviceId,
        createdAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };

      await redis.setEx(
        `session:${sessionId}`,
        this.SESSION_EXPIRY,
        JSON.stringify(sessionData)
      );
    } catch (error) {
      console.error('Failed to store session in Redis:', error);
      // Don't throw error - session storage is not critical for basic auth
    }
  }

  /**
   * Validate and decode JWT token
   */
  static async validateToken(token: string): Promise<TokenPayload> {
    const jwtSecret = process.env['JWT_SECRET'];
    
    if (!jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    try {
      const decoded = jwt.verify(token, jwtSecret, {
        issuer: 'nearme-api',
        audience: 'nearme-app'
      }) as TokenPayload;

      // Validate session exists in Redis
      await this.validateSessionInRedis(decoded.sessionId);

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ValidationError('Invalid token', []);
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new ValidationError('Token expired', []);
      }
      throw error;
    }
  }

  /**
   * Validate session exists and is active
   */
  private static async validateSessionInRedis(sessionId: string): Promise<void> {
    try {
      const redis = getRedis();
      const sessionData = await redis.get(`session:${sessionId}`);
      
      if (!sessionData) {
        throw new ValidationError('Session not found or expired', []);
      }

      // Update last activity
      const session = JSON.parse(sessionData);
      session.lastActivity = new Date().toISOString();
      
      await redis.setEx(
        `session:${sessionId}`,
        this.SESSION_EXPIRY,
        JSON.stringify(session)
      );
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      console.error('Session validation error:', error);
      // If Redis is down, allow the request to continue
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(refreshToken: string): Promise<AuthToken> {
    const decoded = await this.validateToken(refreshToken);
    
    if (decoded.type !== 'refresh') {
      throw new ValidationError('Invalid refresh token', []);
    }

    // Verify user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new ValidationError('User not found', []);
    }

    // Generate new tokens
    return this.generateTokens(decoded.userId, decoded.deviceId);
  }

  /**
   * Associate email with device account
   */
  static async associateEmail(userId: string, email: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError('User not found', []);
    }

    await user.associateEmail(email);
  }

  /**
   * Login with device ID
   */
  static async loginWithDevice(deviceId: string): Promise<{ user: DeviceAccount; tokens: AuthToken }> {
    const user = await User.findByDeviceId(deviceId);
    
    if (!user) {
      // Create new device account if not found
      const deviceAccount = await this.createDeviceAccount(deviceId);
      const tokens = await this.generateTokens(deviceAccount.id, deviceAccount.deviceId);
      
      return { user: deviceAccount, tokens };
    }

    const tokens = await this.generateTokens(user.id, user.device_id);
    
    const deviceAccount: DeviceAccount = {
      id: user.id,
      deviceId: user.device_id,
      email: user.email || undefined,
      createdAt: user.created_at,
      preferences: user.preferences
    };

    return { user: deviceAccount, tokens };
  }

  /**
   * Logout and invalidate session
   */
  static async logout(sessionId: string): Promise<void> {
    try {
      const redis = getRedis();
      await redis.del(`session:${sessionId}`);
    } catch (error) {
      console.error('Failed to delete session from Redis:', error);
      // Don't throw error - logout should always succeed
    }
  }

  /**
   * Logout from all devices
   */
  static async logoutAllDevices(userId: string): Promise<void> {
    try {
      const redis = getRedis();
      
      // Find all sessions for this user
      const keys = await redis.keys('session:*');
      const sessions = await Promise.all(
        keys.map(async (key) => {
          const data = await redis.get(key);
          return data ? { key, data: JSON.parse(data) } : null;
        })
      );

      // Delete sessions belonging to this user
      const userSessions = sessions
        .filter(session => session && session.data.userId === userId)
        .map(session => session!.key);

      if (userSessions.length > 0) {
        await redis.del(userSessions);
      }
    } catch (error) {
      console.error('Failed to logout all devices:', error);
      // Don't throw error - logout should always succeed
    }
  }

  /**
   * Validate session and return user info
   */
  static async validateSession(token: string): Promise<{ user: User; sessionId: string }> {
    const decoded = await this.validateToken(token);
    
    if (decoded.type !== 'access') {
      throw new ValidationError('Invalid access token', []);
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new ValidationError('User not found', []);
    }

    return { user, sessionId: decoded.sessionId };
  }

  /**
   * Get active sessions for user
   */
  static async getActiveSessions(userId: string): Promise<Array<{ sessionId: string; createdAt: string; lastActivity: string; deviceId: string }>> {
    try {
      const redis = getRedis();
      const keys = await redis.keys('session:*');
      
      const sessions = await Promise.all(
        keys.map(async (key) => {
          const data = await redis.get(key);
          if (!data) return null;
          
          const sessionData = JSON.parse(data);
          if (sessionData.userId !== userId) return null;
          
          return {
            sessionId: key.replace('session:', ''),
            createdAt: sessionData.createdAt,
            lastActivity: sessionData.lastActivity,
            deviceId: sessionData.deviceId
          };
        })
      );

      return sessions.filter(session => session !== null) as Array<{ sessionId: string; createdAt: string; lastActivity: string; deviceId: string }>;
    } catch (error) {
      console.error('Failed to get active sessions:', error);
      return [];
    }
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions(): Promise<void> {
    try {
      const redis = getRedis();
      const keys = await redis.keys('session:*');
      
      // Redis automatically handles TTL expiration, but we can manually clean up if needed
      const expiredKeys: string[] = [];
      
      for (const key of keys) {
        const ttl = await redis.ttl(key);
        if (ttl === -2) { // Key doesn't exist
          expiredKeys.push(key);
        }
      }

      if (expiredKeys.length > 0) {
        await redis.del(expiredKeys);
      }
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error);
    }
  }
}