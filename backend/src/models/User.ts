import { query, transaction } from '../database/connection';
import { 
  UserEntity, 
  CreateUserRequest, 
  UpdateUserRequest, 
  UserPreferences,
  PremiumStatus,
  PushNotificationToken 
} from './types';
import { validateSchema, createUserSchema, updateUserSchema, ValidationError } from './validation';
// import { v4 as uuidv4 } from 'uuid'; // Not used in this file

export class User {
  public id: string;
  public device_id: string;
  public email?: string;
  public preferences: UserPreferences;
  public premium_status: PremiumStatus;
  public push_token?: PushNotificationToken;
  public created_at: Date;
  public updated_at: Date;

  constructor(entity: UserEntity) {
    this.id = entity.id;
    this.device_id = entity.device_id;
    this.email = entity.email;
    this.preferences = entity.preferences;
    this.premium_status = entity.premium_status;
    this.push_token = entity.push_token;
    this.created_at = entity.created_at;
    this.updated_at = entity.updated_at;
  }

  /**
   * Create a new user
   */
  static async create(data: CreateUserRequest): Promise<User> {
    const validatedData = validateSchema<CreateUserRequest>(createUserSchema, data);
    
    // Check if device_id already exists
    const existingUser = await User.findByDeviceId(validatedData.device_id);
    if (existingUser) {
      throw new ValidationError('Device ID already exists', []);
    }

    // Set default preferences
    const defaultPreferences: UserPreferences = {
      notificationStyle: 'standard',
      privacyMode: 'standard',
      ...validatedData.preferences
    };

    const result = await query<UserEntity>(
      `INSERT INTO users (device_id, email, preferences, premium_status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        validatedData.device_id,
        validatedData.email || null,
        JSON.stringify(defaultPreferences),
        'free'
      ]
    );

    return new User(result.rows[0]);
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | null> {
    const result = await query<UserEntity>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    return result.rows.length > 0 ? new User(result.rows[0]) : null;
  }

  /**
   * Find user by device ID
   */
  static async findByDeviceId(deviceId: string): Promise<User | null> {
    const result = await query<UserEntity>(
      'SELECT * FROM users WHERE device_id = $1',
      [deviceId]
    );

    return result.rows.length > 0 ? new User(result.rows[0]) : null;
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const result = await query<UserEntity>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    return result.rows.length > 0 ? new User(result.rows[0]) : null;
  }

  /**
   * Update user
   */
  async update(data: UpdateUserRequest): Promise<User> {
    const validatedData = validateSchema<UpdateUserRequest>(updateUserSchema, data);
    
    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (validatedData.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(validatedData.email);
    }

    if (validatedData.preferences !== undefined) {
      const mergedPreferences = { ...this.preferences, ...validatedData.preferences };
      updates.push(`preferences = $${paramIndex++}`);
      values.push(JSON.stringify(mergedPreferences));
    }

    if (validatedData.premium_status !== undefined) {
      updates.push(`premium_status = $${paramIndex++}`);
      values.push(validatedData.premium_status);
    }

    if (updates.length === 0) {
      return this; // No updates to make
    }

    updates.push(`updated_at = NOW()`);
    values.push(this.id);

    const result = await query<UserEntity>(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    const updatedUser = new User(result.rows[0]);
    Object.assign(this, updatedUser);
    return this;
  }

  /**
   * Delete user and all associated data
   */
  async delete(): Promise<void> {
    await transaction(async (client) => {
      // Delete in correct order due to foreign key constraints
      await client.query('DELETE FROM events WHERE user_id = $1', [this.id]);
      await client.query('DELETE FROM geofences WHERE task_id IN (SELECT id FROM tasks WHERE user_id = $1)', [this.id]);
      await client.query('DELETE FROM tasks WHERE user_id = $1', [this.id]);
      await client.query('DELETE FROM places WHERE user_id = $1', [this.id]);
      await client.query('DELETE FROM users WHERE id = $1', [this.id]);
    });
  }

  /**
   * Check if user has premium access
   */
  isPremium(): boolean {
    return this.premium_status === 'premium' || this.premium_status === 'trial';
  }

  /**
   * Get active task count for freemium limits
   */
  async getActiveTaskCount(): Promise<number> {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM tasks WHERE user_id = $1 AND status = $2',
      [this.id, 'active']
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Check if user can create more tasks
   */
  async canCreateTask(): Promise<boolean> {
    if (this.isPremium()) {
      return true;
    }

    const activeTaskCount = await this.getActiveTaskCount();
    return activeTaskCount < 3; // Free users limited to 3 active tasks
  }

  /**
   * Update preferences
   */
  async updatePreferences(preferences: Partial<UserPreferences>): Promise<User> {
    return this.update({ preferences });
  }

  /**
   * Associate email with account
   */
  async associateEmail(email: string): Promise<User> {
    // Check if email is already associated with another account
    const existingUser = await User.findByEmail(email);
    if (existingUser && existingUser.id !== this.id) {
      throw new ValidationError('Email is already associated with another account', []);
    }

    return this.update({ email });
  }

  /**
   * Upgrade to premium
   */
  async upgradeToPremium(): Promise<User> {
    return this.update({ premium_status: 'premium' });
  }

  /**
   * Start trial
   */
  async startTrial(): Promise<User> {
    if (this.premium_status !== 'free') {
      throw new ValidationError('User is not eligible for trial', []);
    }
    return this.update({ premium_status: 'trial' });
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): Omit<UserEntity, 'device_id'> {
    return {
      id: this.id,
      email: this.email,
      preferences: this.preferences,
      premium_status: this.premium_status,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  /**
   * Get all users (admin function)
   */
  static async findAll(page: number = 1, limit: number = 20): Promise<{ users: User[], total: number }> {
    const offset = (page - 1) * limit;
    
    const [usersResult, countResult] = await Promise.all([
      query<UserEntity>(
        'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      ),
      query<{ count: string }>('SELECT COUNT(*) as count FROM users')
    ]);

    const users = usersResult.rows.map(row => new User(row));
    const total = parseInt(countResult.rows[0].count, 10);

    return { users, total };
  }

  /**
   * Update push notification token for user
   */
  static async updatePushToken(userId: string, deviceToken: string, platform: 'ios' | 'android'): Promise<void> {
    const pushToken: PushNotificationToken = {
      device_token: deviceToken,
      platform,
      is_active: true,
      last_updated: new Date()
    };

    await query(
      'UPDATE users SET push_token = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(pushToken), userId]
    );
  }

  /**
   * Get users with active push tokens
   */
  static async findUsersWithPushTokens(): Promise<User[]> {
    const result = await query<UserEntity>(
      'SELECT * FROM users WHERE push_token IS NOT NULL AND (push_token->>\'is_active\')::boolean = true'
    );

    return result.rows.map(row => new User(row));
  }

  /**
   * Deactivate push token for user
   */
  static async deactivatePushToken(userId: string): Promise<void> {
    await query(
      'UPDATE users SET push_token = jsonb_set(push_token, \'{is_active}\', \'false\'), updated_at = NOW() WHERE id = $1',
      [userId]
    );
  }
}