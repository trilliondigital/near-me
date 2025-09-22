import { Pool } from 'pg';
import { ValidationError } from './validation';
import { PushNotificationToken } from './types';

export interface CreatePushTokenRequest {
  userId: string;
  deviceToken: string;
  platform: 'ios' | 'android';
  deviceId?: string;
  appVersion?: string;
}

export interface UpdatePushTokenRequest {
  deviceToken?: string;
  isActive?: boolean;
  lastUsed?: Date;
}

export class PushToken {
  public id: string;
  public userId: string;
  public deviceToken: string;
  public platform: 'ios' | 'android';
  public deviceId?: string;
  public appVersion?: string;
  public isActive: boolean;
  public createdAt: Date;
  public updatedAt: Date;
  public lastUsed?: Date;

  constructor(data: PushNotificationToken) {
    this.id = data.id;
    this.userId = data.userId;
    this.deviceToken = data.deviceToken;
    this.platform = data.platform;
    this.deviceId = data.deviceId;
    this.appVersion = data.appVersion;
    this.isActive = data.isActive;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.lastUsed = data.lastUsed;
  }

  /**
   * Create a new push token
   */
  static async create(data: CreatePushTokenRequest): Promise<PushToken> {
    const pool = await this.getPool();
    
    // Validate input
    this.validateCreateRequest(data);

    // Check if token already exists for this user/device
    const existingToken = await this.findByUserAndDevice(data.userId, data.deviceToken);
    if (existingToken) {
      // Update existing token
      return existingToken.update({
        isActive: true,
        lastUsed: new Date()
      });
    }

    const query = `
      INSERT INTO push_tokens (user_id, device_token, platform, device_id, app_version, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *
    `;

    const values = [
      data.userId,
      data.deviceToken,
      data.platform,
      data.deviceId,
      data.appVersion
    ];

    try {
      const result = await pool.query(query, values);
      return new PushToken(result.rows[0]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate key')) {
        throw new ValidationError('Push token already exists', []);
      }
      throw error;
    }
  }

  /**
   * Find push token by ID
   */
  static async findById(id: string): Promise<PushToken | null> {
    const pool = await this.getPool();
    
    const query = 'SELECT * FROM push_tokens WHERE id = $1';
    const result = await pool.query(query, [id]);
    
    return result.rows.length > 0 ? new PushToken(result.rows[0]) : null;
  }

  /**
   * Find push token by user ID and device token
   */
  static async findByUserAndDevice(userId: string, deviceToken: string): Promise<PushToken | null> {
    const pool = await this.getPool();
    
    const query = 'SELECT * FROM push_tokens WHERE user_id = $1 AND device_token = $2';
    const result = await pool.query(query, [userId, deviceToken]);
    
    return result.rows.length > 0 ? new PushToken(result.rows[0]) : null;
  }

  /**
   * Find all active push tokens for a user
   */
  static async findByUserId(userId: string): Promise<PushToken[]> {
    const pool = await this.getPool();
    
    const query = `
      SELECT * FROM push_tokens 
      WHERE user_id = $1 AND is_active = true 
      ORDER BY updated_at DESC
    `;
    const result = await pool.query(query, [userId]);
    
    return result.rows.map(row => new PushToken(row));
  }

  /**
   * Find all active push tokens for multiple users
   */
  static async findByUserIds(userIds: string[]): Promise<PushToken[]> {
    if (userIds.length === 0) return [];
    
    const pool = await this.getPool();
    
    const query = `
      SELECT * FROM push_tokens 
      WHERE user_id = ANY($1) AND is_active = true 
      ORDER BY user_id, updated_at DESC
    `;
    const result = await pool.query(query, [userIds]);
    
    return result.rows.map(row => new PushToken(row));
  }

  /**
   * Find push tokens by platform
   */
  static async findByPlatform(platform: 'ios' | 'android'): Promise<PushToken[]> {
    const pool = await this.getPool();
    
    const query = `
      SELECT * FROM push_tokens 
      WHERE platform = $1 AND is_active = true 
      ORDER BY updated_at DESC
    `;
    const result = await pool.query(query, [platform]);
    
    return result.rows.map(row => new PushToken(row));
  }

  /**
   * Update push token
   */
  async update(data: UpdatePushTokenRequest): Promise<PushToken> {
    const pool = await PushToken.getPool();
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.deviceToken !== undefined) {
      updates.push(`device_token = $${paramCount++}`);
      values.push(data.deviceToken);
    }

    if (data.isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(data.isActive);
    }

    if (data.lastUsed !== undefined) {
      updates.push(`last_used = $${paramCount++}`);
      values.push(data.lastUsed);
    }

    updates.push(`updated_at = $${paramCount++}`);
    values.push(new Date());

    values.push(this.id);

    const query = `
      UPDATE push_tokens 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      throw new ValidationError('Push token not found', []);
    }

    const updatedToken = new PushToken(result.rows[0]);
    Object.assign(this, updatedToken);
    return this;
  }

  /**
   * Deactivate push token
   */
  async deactivate(): Promise<void> {
    await this.update({ isActive: false });
  }

  /**
   * Mark token as used
   */
  async markUsed(): Promise<void> {
    await this.update({ lastUsed: new Date() });
  }

  /**
   * Delete push token
   */
  async delete(): Promise<void> {
    const pool = await PushToken.getPool();
    
    const query = 'DELETE FROM push_tokens WHERE id = $1';
    await pool.query(query, [this.id]);
  }

  /**
   * Clean up inactive tokens older than specified days
   */
  static async cleanupInactiveTokens(daysOld: number = 30): Promise<number> {
    const pool = await this.getPool();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const query = `
      DELETE FROM push_tokens 
      WHERE is_active = false AND updated_at < $1
    `;
    
    const result = await pool.query(query, [cutoffDate]);
    return result.rowCount || 0;
  }

  /**
   * Clean up duplicate tokens for the same user/device
   */
  static async cleanupDuplicateTokens(): Promise<number> {
    const pool = await this.getPool();
    
    const query = `
      DELETE FROM push_tokens 
      WHERE id NOT IN (
        SELECT DISTINCT ON (user_id, device_token) id
        FROM push_tokens
        ORDER BY user_id, device_token, updated_at DESC
      )
    `;
    
    const result = await pool.query(query);
    return result.rowCount || 0;
  }

  /**
   * Get statistics about push tokens
   */
  static async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byPlatform: { ios: number; android: number };
  }> {
    const pool = await this.getPool();
    
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE is_active = false) as inactive,
        COUNT(*) FILTER (WHERE platform = 'ios' AND is_active = true) as ios,
        COUNT(*) FILTER (WHERE platform = 'android' AND is_active = true) as android
      FROM push_tokens
    `;
    
    const result = await pool.query(query);
    const row = result.rows[0];
    
    return {
      total: parseInt(row.total),
      active: parseInt(row.active),
      inactive: parseInt(row.inactive),
      byPlatform: {
        ios: parseInt(row.ios),
        android: parseInt(row.android)
      }
    };
  }

  /**
   * Validate create request
   */
  private static validateCreateRequest(data: CreatePushTokenRequest): void {
    const errors: string[] = [];

    if (!data.userId) {
      errors.push('User ID is required');
    }

    if (!data.deviceToken) {
      errors.push('Device token is required');
    }

    if (!data.platform || !['ios', 'android'].includes(data.platform)) {
      errors.push('Platform must be either "ios" or "android"');
    }

    // Validate token format based on platform
    if (data.deviceToken) {
      if (data.platform === 'ios') {
        // APNs tokens are 64 hex characters
        if (!/^[0-9a-fA-F]{64}$/.test(data.deviceToken)) {
          errors.push('Invalid iOS device token format');
        }
      } else if (data.platform === 'android') {
        // FCM tokens are typically 152+ characters
        if (data.deviceToken.length < 140) {
          errors.push('Invalid Android device token format');
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid push token data', errors);
    }
  }

  /**
   * Get database pool
   */
  private static async getPool(): Promise<Pool> {
    // This should be imported from your database connection module
    const { getPool } = await import('../database/connection');
    return getPool();
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): PushNotificationToken {
    return {
      id: this.id,
      userId: this.userId,
      deviceToken: this.deviceToken,
      platform: this.platform,
      deviceId: this.deviceId,
      appVersion: this.appVersion,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastUsed: this.lastUsed
    };
  }
}