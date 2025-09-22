import { query } from '../database/connection';
import { ValidationError } from './validation';

export type MuteDuration = '1h' | '4h' | '8h' | '24h' | 'until_tomorrow' | 'permanent';

export interface TaskMuteEntity {
  id: string;
  user_id: string;
  task_id: string;
  mute_duration?: MuteDuration;
  mute_until?: Date;
  reason?: string;
  status: 'active' | 'expired' | 'cancelled';
  created_at: Date;
  updated_at: Date;
}

export interface CreateTaskMuteRequest {
  userId: string;
  taskId: string;
  muteDuration: MuteDuration;
  reason?: string;
}

export class TaskMute {
  public id: string;
  public userId: string;
  public taskId: string;
  public muteDuration?: MuteDuration;
  public muteUntil?: Date;
  public reason?: string;
  public status: 'active' | 'expired' | 'cancelled';
  public createdAt: Date;
  public updatedAt: Date;

  constructor(entity: TaskMuteEntity) {
    this.id = entity.id;
    this.userId = entity.user_id;
    this.taskId = entity.task_id;
    this.muteDuration = entity.mute_duration;
    this.muteUntil = entity.mute_until;
    this.reason = entity.reason;
    this.status = entity.status;
    this.createdAt = entity.created_at;
    this.updatedAt = entity.updated_at;
  }

  /**
   * Create a new task mute record
   */
  static async create(data: CreateTaskMuteRequest): Promise<TaskMute> {
    // Check if task is already muted
    const existingMute = await TaskMute.findActiveByTaskId(data.taskId);
    if (existingMute) {
      throw new ValidationError('Task is already muted', []);
    }

    const muteUntil = data.muteDuration === 'permanent' 
      ? null 
      : TaskMute.calculateMuteUntil(data.muteDuration);

    const result = await query<TaskMuteEntity>(
      `INSERT INTO task_mutes (
        user_id, task_id, mute_duration, mute_until, reason
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        data.userId,
        data.taskId,
        data.muteDuration,
        muteUntil,
        data.reason || null
      ]
    );

    return new TaskMute(result.rows[0]);
  }

  /**
   * Find active mute by task ID
   */
  static async findActiveByTaskId(taskId: string): Promise<TaskMute | null> {
    const result = await query<TaskMuteEntity>(
      `SELECT * FROM task_mutes 
       WHERE task_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [taskId]
    );

    return result.rows.length > 0 ? new TaskMute(result.rows[0]) : null;
  }

  /**
   * Find active mutes for a user
   */
  static async findActiveByUserId(userId: string): Promise<TaskMute[]> {
    const result = await query<TaskMuteEntity>(
      `SELECT * FROM task_mutes 
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map(row => new TaskMute(row));
  }

  /**
   * Find expired mutes that need to be processed
   */
  static async findExpiredMutes(beforeTime?: Date): Promise<TaskMute[]> {
    const time = beforeTime || new Date();
    const result = await query<TaskMuteEntity>(
      `SELECT * FROM task_mutes 
       WHERE status = 'active' AND mute_until IS NOT NULL AND mute_until <= $1
       ORDER BY mute_until ASC`,
      [time]
    );

    return result.rows.map(row => new TaskMute(row));
  }

  /**
   * Check if a task is currently muted
   */
  static async isTaskMuted(taskId: string): Promise<boolean> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM task_mutes 
       WHERE task_id = $1 AND status = 'active' 
       AND (mute_until IS NULL OR mute_until > NOW())`,
      [taskId]
    );

    return parseInt(result.rows[0].count, 10) > 0;
  }

  /**
   * Calculate mute until time based on duration
   */
  static calculateMuteUntil(duration: MuteDuration): Date {
    const now = new Date();
    
    switch (duration) {
      case '1h':
        return new Date(now.getTime() + 60 * 60 * 1000);
      
      case '4h':
        return new Date(now.getTime() + 4 * 60 * 60 * 1000);
      
      case '8h':
        return new Date(now.getTime() + 8 * 60 * 60 * 1000);
      
      case '24h':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      case 'until_tomorrow':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0); // 9 AM tomorrow
        return tomorrow;
      
      case 'permanent':
        return new Date('2099-12-31'); // Far future date for permanent mutes
      
      default:
        throw new ValidationError(`Unknown mute duration: ${duration}`, []);
    }
  }

  /**
   * Extend an existing mute
   */
  async extendMute(duration: MuteDuration): Promise<TaskMute> {
    const newMuteUntil = duration === 'permanent' 
      ? null 
      : TaskMute.calculateMuteUntil(duration);
    
    const result = await query<TaskMuteEntity>(
      `UPDATE task_mutes 
       SET mute_duration = $1, mute_until = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [duration, newMuteUntil, this.id]
    );

    const updated = new TaskMute(result.rows[0]);
    Object.assign(this, updated);
    return this;
  }

  /**
   * Mark mute as expired
   */
  async markExpired(): Promise<TaskMute> {
    const result = await query<TaskMuteEntity>(
      `UPDATE task_mutes 
       SET status = 'expired', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [this.id]
    );

    const updated = new TaskMute(result.rows[0]);
    Object.assign(this, updated);
    return this;
  }

  /**
   * Cancel mute
   */
  async cancel(): Promise<TaskMute> {
    const result = await query<TaskMuteEntity>(
      `UPDATE task_mutes 
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [this.id]
    );

    const updated = new TaskMute(result.rows[0]);
    Object.assign(this, updated);
    return this;
  }

  /**
   * Check if mute is expired
   */
  isExpired(): boolean {
    if (this.muteDuration === 'permanent') {
      return false;
    }
    return this.muteUntil ? new Date() >= this.muteUntil : false;
  }

  /**
   * Check if mute is permanent
   */
  isPermanent(): boolean {
    return this.muteDuration === 'permanent';
  }

  /**
   * Get remaining mute time in milliseconds
   */
  getRemainingTime(): number | null {
    if (this.isPermanent()) {
      return null;
    }
    if (!this.muteUntil) {
      return null;
    }
    const now = new Date();
    const remaining = this.muteUntil.getTime() - now.getTime();
    return Math.max(0, remaining);
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): Omit<TaskMuteEntity, 'user_id' | 'task_id'> {
    return {
      id: this.id,
      mute_duration: this.muteDuration,
      mute_until: this.muteUntil,
      reason: this.reason,
      status: this.status,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }
}
