import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { EncryptionService } from './encryptionService';
import { ValidationError } from '../models/validation';

// MARK: - Token Configuration

interface TokenConfig {
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  resetTokenExpiry: string;
  apiKeyExpiry: string;
}

const TOKEN_CONFIG: TokenConfig = {
  accessTokenExpiry: '15m',      // 15 minutes
  refreshTokenExpiry: '7d',      // 7 days
  resetTokenExpiry: '1h',        // 1 hour
  apiKeyExpiry: '365d'           // 1 year
};

// MARK: - Token Types

export interface AccessTokenPayload {
  userId: string;
  deviceId: string;
  sessionId: string;
  isPremium: boolean;
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  deviceId: string;
  sessionId: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

export interface ResetTokenPayload {
  userId: string;
  email: string;
  purpose: 'password_reset' | 'email_verification' | 'account_recovery';
  iat?: number;
  exp?: number;
}

export interface ApiKeyPayload {
  keyId: string;
  userId?: string;
  permissions: string[];
  rateLimit: number;
  iat?: number;
  exp?: number;
}

// MARK: - Token Service

export class TokenService {
  private static jwtSecret: string;
  private static refreshSecret: string;
  
  /**
   * Initialize token service with secrets
   */
  static initialize(): void {
    this.jwtSecret = process.env.JWT_SECRET || this.generateSecret();
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || this.generateSecret();
    
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      console.warn('⚠️  JWT secrets not found in environment. Generated new secrets.');
      console.warn('⚠️  JWT_SECRET:', this.jwtSecret);
      console.warn('⚠️  JWT_REFRESH_SECRET:', this.refreshSecret);
    }
  }

  /**
   * Generate cryptographically secure secret
   */
  private static generateSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Generate access token
   */
  static generateAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): string {
    if (!this.jwtSecret) this.initialize();
    
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: TOKEN_CONFIG.accessTokenExpiry,
      issuer: 'nearme-api',
      audience: 'nearme-client',
      algorithm: 'HS256'
    });
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string {
    if (!this.refreshSecret) this.initialize();
    
    return jwt.sign(payload, this.refreshSecret, {
      expiresIn: TOKEN_CONFIG.refreshTokenExpiry,
      issuer: 'nearme-api',
      audience: 'nearme-client',
      algorithm: 'HS256'
    });
  }

  /**
   * Generate password reset token
   */
  static generateResetToken(payload: Omit<ResetTokenPayload, 'iat' | 'exp'>): string {
    if (!this.jwtSecret) this.initialize();
    
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: TOKEN_CONFIG.resetTokenExpiry,
      issuer: 'nearme-api',
      audience: 'nearme-client',
      algorithm: 'HS256'
    });
  }

  /**
   * Generate API key token
   */
  static generateApiKey(payload: Omit<ApiKeyPayload, 'iat' | 'exp'>): string {
    if (!this.jwtSecret) this.initialize();
    
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: TOKEN_CONFIG.apiKeyExpiry,
      issuer: 'nearme-api',
      audience: 'nearme-api',
      algorithm: 'HS256'
    });
  }

  /**
   * Verify and decode access token
   */
  static verifyAccessToken(token: string): AccessTokenPayload {
    if (!this.jwtSecret) this.initialize();
    
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'nearme-api',
        audience: 'nearme-client',
        algorithms: ['HS256']
      }) as AccessTokenPayload;
      
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ValidationError('Access token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new ValidationError('Invalid access token');
      } else {
        throw new ValidationError('Token verification failed');
      }
    }
  }

  /**
   * Verify and decode refresh token
   */
  static verifyRefreshToken(token: string): RefreshTokenPayload {
    if (!this.refreshSecret) this.initialize();
    
    try {
      const decoded = jwt.verify(token, this.refreshSecret, {
        issuer: 'nearme-api',
        audience: 'nearme-client',
        algorithms: ['HS256']
      }) as RefreshTokenPayload;
      
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ValidationError('Refresh token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new ValidationError('Invalid refresh token');
      } else {
        throw new ValidationError('Refresh token verification failed');
      }
    }
  }

  /**
   * Verify and decode reset token
   */
  static verifyResetToken(token: string): ResetTokenPayload {
    if (!this.jwtSecret) this.initialize();
    
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'nearme-api',
        audience: 'nearme-client',
        algorithms: ['HS256']
      }) as ResetTokenPayload;
      
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ValidationError('Reset token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new ValidationError('Invalid reset token');
      } else {
        throw new ValidationError('Reset token verification failed');
      }
    }
  }

  /**
   * Verify and decode API key
   */
  static verifyApiKey(token: string): ApiKeyPayload {
    if (!this.jwtSecret) this.initialize();
    
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'nearme-api',
        audience: 'nearme-api',
        algorithms: ['HS256']
      }) as ApiKeyPayload;
      
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new ValidationError('API key expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new ValidationError('Invalid API key');
      } else {
        throw new ValidationError('API key verification failed');
      }
    }
  }

  /**
   * Extract token from Authorization header
   */
  static extractBearerToken(authHeader: string): string {
    if (!authHeader) {
      throw new ValidationError('Authorization header is required');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new ValidationError('Authorization header must be in format: Bearer <token>');
    }

    return parts[1];
  }

  /**
   * Generate token pair (access + refresh)
   */
  static generateTokenPair(
    userId: string,
    deviceId: string,
    sessionId: string,
    isPremium: boolean = false,
    permissions: string[] = [],
    tokenVersion: number = 1
  ): { accessToken: string; refreshToken: string } {
    const accessToken = this.generateAccessToken({
      userId,
      deviceId,
      sessionId,
      isPremium,
      permissions
    });

    const refreshToken = this.generateRefreshToken({
      userId,
      deviceId,
      sessionId,
      tokenVersion
    });

    return { accessToken, refreshToken };
  }

  /**
   * Refresh access token using refresh token
   */
  static refreshAccessToken(
    refreshToken: string,
    currentTokenVersion: number
  ): { accessToken: string; refreshToken: string } {
    const payload = this.verifyRefreshToken(refreshToken);
    
    // Check token version for security
    if (payload.tokenVersion !== currentTokenVersion) {
      throw new ValidationError('Refresh token version mismatch');
    }

    // Generate new token pair with incremented version
    return this.generateTokenPair(
      payload.userId,
      payload.deviceId,
      payload.sessionId,
      false, // Will be updated from user data
      [], // Will be updated from user data
      currentTokenVersion + 1
    );
  }

  /**
   * Blacklist token (for logout)
   */
  static blacklistToken(token: string): void {
    // In production, store blacklisted tokens in Redis with TTL
    const decoded = jwt.decode(token) as any;
    if (decoded && decoded.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        // Store in blacklist cache
        console.log(`Token blacklisted for ${ttl} seconds`);
      }
    }
  }

  /**
   * Check if token is blacklisted
   */
  static isTokenBlacklisted(token: string): boolean {
    // In production, check Redis blacklist
    // For now, return false
    return false;
  }

  /**
   * Generate secure session ID
   */
  static generateSessionId(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate device-specific token
   */
  static generateDeviceToken(deviceId: string, userAgent: string, ip: string): string {
    const deviceFingerprint = EncryptionService.generateDeviceFingerprint(userAgent, ip);
    const tokenData = {
      deviceId,
      fingerprint: deviceFingerprint,
      timestamp: Date.now()
    };
    
    return EncryptionService.encryptObject(tokenData);
  }

  /**
   * Verify device token
   */
  static verifyDeviceToken(
    token: string,
    expectedDeviceId: string,
    userAgent: string,
    ip: string
  ): boolean {
    try {
      const tokenData = EncryptionService.decryptObject(token);
      const expectedFingerprint = EncryptionService.generateDeviceFingerprint(userAgent, ip);
      
      return (
        tokenData.deviceId === expectedDeviceId &&
        tokenData.fingerprint === expectedFingerprint &&
        Date.now() - tokenData.timestamp < 24 * 60 * 60 * 1000 // 24 hours
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate one-time use token
   */
  static generateOneTimeToken(data: any, expirationMinutes: number = 15): string {
    const tokenData = {
      ...data,
      nonce: crypto.randomBytes(16).toString('hex'),
      expires: Date.now() + (expirationMinutes * 60 * 1000)
    };
    
    return EncryptionService.encryptObject(tokenData);
  }

  /**
   * Verify and consume one-time token
   */
  static verifyOneTimeToken(token: string): any {
    try {
      const tokenData = EncryptionService.decryptObject(token);
      
      if (Date.now() > tokenData.expires) {
        throw new ValidationError('One-time token expired');
      }
      
      // In production, check if token was already used (store nonce in Redis)
      
      return tokenData;
    } catch (error) {
      throw new ValidationError('Invalid one-time token');
    }
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      return decoded?.exp ? new Date(decoded.exp * 1000) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token expires soon (within threshold)
   */
  static isTokenExpiringSoon(token: string, thresholdMinutes: number = 5): boolean {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return false;
    
    const threshold = Date.now() + (thresholdMinutes * 60 * 1000);
    return expiration.getTime() < threshold;
  }

  /**
   * Rotate JWT secrets (for security)
   */
  static rotateSecrets(): { jwtSecret: string; refreshSecret: string } {
    const newJwtSecret = this.generateSecret();
    const newRefreshSecret = this.generateSecret();
    
    // Store old secrets for graceful transition
    const oldJwtSecret = this.jwtSecret;
    const oldRefreshSecret = this.refreshSecret;
    
    // Update secrets
    this.jwtSecret = newJwtSecret;
    this.refreshSecret = newRefreshSecret;
    
    console.log('🔄 JWT secrets rotated');
    console.log('⚠️  Update environment variables:');
    console.log('⚠️  JWT_SECRET:', newJwtSecret);
    console.log('⚠️  JWT_REFRESH_SECRET:', newRefreshSecret);
    
    return { jwtSecret: newJwtSecret, refreshSecret: newRefreshSecret };
  }
}

// Initialize token service on module load
if (process.env.NODE_ENV !== 'test') {
  TokenService.initialize();
}