import { query } from '../database/connection';
import { ValidationError } from './validation';
import { SnoozeDuration } from '../services/notificationService';

export interface NotificationSnoozeEntity {
  id: string;
  user_id: string;
  task_id: string;
  notification_id: string;
  snooze_duration: SnoozeDuration;
  snooze_until: Date;
  original_scheduled_time: Date;
  snooze_count: number;
  status: 'active' | 'expired' | 'cancelled';
  created_at: Date;
  updated_at: Date;
}

export interface CreateNotificationSnoozeRequest {
  userId: string;
  taskId: string;
  notificationId: string;
  snoozeDuration: SnoozeDuration;
  originalScheduledTime: Date;
}

export class NotificationSnooze {
  public id: string;
  public userId: string;
  public taskId: string;
  public notificationId: string;
  public snoozeDuration: SnoozeDuration;
  public snoozeUntil: Date;
  public originalScheduledTime: Date;
  public snoozeCount: number;
  public status: 'active' | 'expired' | 'cancelled';
  public createdAt: Date;
  public updatedAt: Date;

  constructor(entity: NotificationSnoozeEntity) {
    this.id = entity.id;
    this.userId = entity.user_id;
    this.taskId = entity.task_id;
    this.notificationId = entity.notification_id;
    this.snoozeDuration = entity.snooze_duration;
    this.snoozeUntil = entity.snooze_until;
    this.originalScheduledTime = entity.original_scheduled_time;
    this.snoozeCount = entity.snooze_count;
    this.status = entity.status;
    this.createdAt = entity.created_at;
    this.updatedAt = entity.updated_at;
  }

  /**
   * Create a new notification snooze record
   */
  static async create(data: CreateNotificationSnoozeRequest): Promise<NotificationSnooze> {
    const snoozeUntil = NotificationSnooze.calculateSnoozeUntil(data.snoozeDuration);
    
    const result = await query<NotificationSnoozeEntity>(
      `INSERT INTO notification_snoozes (
        user_id, task_id, notification_id, snooze_duration, 
        snooze_until, original_scheduled_time, snooze_count
      ) VALUES ($1, $2, $3, $4, $5, $6, 1)
      RETURNING *`,
      [
        data.userId,
        data.taskId,
        data.notificationId,
        data.snoozeDuration,
        snoozeUntil,
        data.originalScheduledTime
      ]
    );

    return new NotificationSnooze(result.rows[0]);
  }

  /**
   * Find active snooze by notification ID
   */
  static async findByNotificationId(notificationId: string): Promise<NotificationSnooze | null> {
    const result = await query<NotificationSnoozeEntity>(
      `SELECT * FROM notification_snoozes 
       WHERE notification_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [notificationId]
    );

    return result.rows.length > 0 ? new NotificationSnooze(result.rows[0]) : null;
  }

  /**
   * Find active snoozes for a user
   */
  static async findActiveByUserId(userId: string): Promise<NotificationSnooze[]> {
    const result = await query<NotificationSnoozeEntity>(
      `SELECT * FROM notification_snoozes 
       WHERE user_id = $1 AND status = 'active'
       ORDER BY snooze_until ASC`,
      [userId]
    );

    return result.rows.map(row => new NotificationSnooze(row));
  }

  /**
   * Find expired snoozes that need to be processed
   */
  static async findExpiredSnoozes(beforeTime?: Date): Promise<NotificationSnooze[]> {
    const time = beforeTime || new Date();
    const result = await query<NotificationSnoozeEntity>(
      `SELECT * FROM notification_snoozes 
       WHERE status = 'active' AND snooze_until <= $1
       ORDER BY snooze_until ASC`,
      [time]
    );

    return result.rows.map(row => new NotificationSnooze(row));
  }

  /**
   * Check if a notification is currently snoozed
   */
  static async isNotificationSnoozed(notificationId: string): Promise<boolean> {
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM notification_snoozes 
       WHERE notification_id = $1 AND status = 'active' AND snooze_until > NOW()`,
      [notificationId]
    );

    return parseInt(result.rows[0].count, 10) > 0;
  }

  /**
   * Calculate snooze until time based on duration
   */
  static calculateSnoozeUntil(duration: SnoozeDuration): Date {
    const now = new Date();
    
    switch (duration) {
      case '15m':
        return new Date(now.getTime() + 15 * 60 * 1000);
      
      case '1h':
        return new Date(now.getTime() + 60 * 60 * 1000);
      
      case 'today':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0); // 9 AM tomorrow
        return tomorrow;
      
      default:
        throw new ValidationError(`Unknown snooze duration: ${duration}`, []);
    }
  }

  /**
   * Extend an existing snooze
   */
  async extendSnooze(duration: SnoozeDuration): Promise<NotificationSnooze> {
    const newSnoozeUntil = NotificationSnooze.calculateSnoozeUntil(duration);
    
    const result = await query<NotificationSnoozeEntity>(
      `UPDATE notification_snoozes 
       SET snooze_until = $1, snooze_count = snooze_count + 1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [newSnoozeUntil, this.id]
    );

    const updated = new NotificationSnooze(result.rows[0]);
    Object.assign(this, updated);
    return this;
  }

  /**
   * Mark snooze as expired
   */
  async markExpired(): Promise<NotificationSnooze> {
    const result = await query<NotificationSnoozeEntity>(
      `UPDATE notification_snoozes 
       SET status = 'expired', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [this.id]
    );

    const updated = new NotificationSnooze(result.rows[0]);
    Object.assign(this, updated);
    return this;
  }

  /**
   * Cancel snooze
   */
  async cancel(): Promise<NotificationSnooze> {
    const result = await query<NotificationSnoozeEntity>(
      `UPDATE notification_snoozes 
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [this.id]
    );

    const updated = new NotificationSnooze(result.rows[0]);
    Object.assign(this, updated);
    return this;
  }

  /**
   * Check if snooze is expired
   */
  isExpired(): boolean {
    return new Date() >= this.snoozeUntil;
  }

  /**
   * Get remaining snooze time in milliseconds
   */
  getRemainingTime(): number {
    const now = new Date();
    const remaining = this.snoozeUntil.getTime() - now.getTime();
    return Math.max(0, remaining);
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): Omit<NotificationSnoozeEntity, 'user_id' | 'task_id'> {
    return {
      id: this.id,
      notification_id: this.notificationId,
      snooze_duration: this.snoozeDuration,
      snooze_until: this.snoozeUntil,
      original_scheduled_time: this.originalScheduledTime,
      snooze_count: this.snoozeCount,
      status: this.status,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }
}
