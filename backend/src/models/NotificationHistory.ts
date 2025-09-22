import { query, transaction } from '../database/connection';
import { ValidationError } from './validation';
import { NotificationType, SnoozeDuration } from '../services/notificationService';

export interface NotificationHistoryEntity {
  id: string;
  user_id: string;
  task_id: string;
  notification_id: string;
  type: NotificationType;
  title: string;
  body: string;
  scheduled_time: Date;
  delivered_time?: Date;
  status: 'pending' | 'delivered' | 'cancelled' | 'failed' | 'snoozed';
  attempts: number;
  last_attempt?: Date;
  error_message?: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateNotificationHistoryRequest {
  userId: string;
  taskId: string;
  notificationId: string;
  type: NotificationType;
  title: string;
  body: string;
  scheduledTime: Date;
  metadata?: Record<string, any>;
}

export interface UpdateNotificationHistoryRequest {
  status?: 'pending' | 'delivered' | 'cancelled' | 'failed' | 'snoozed';
  deliveredTime?: Date;
  attempts?: number;
  lastAttempt?: Date;
  errorMessage?: string;
}

export class NotificationHistory {
  public id: string;
  public userId: string;
  public taskId: string;
  public notificationId: string;
  public type: NotificationType;
  public title: string;
  public body: string;
  public scheduledTime: Date;
  public deliveredTime?: Date;
  public status: 'pending' | 'delivered' | 'cancelled' | 'failed' | 'snoozed';
  public attempts: number;
  public lastAttempt?: Date;
  public errorMessage?: string;
  public metadata: Record<string, any>;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(entity: NotificationHistoryEntity) {
    this.id = entity.id;
    this.userId = entity.user_id;
    this.taskId = entity.task_id;
    this.notificationId = entity.notification_id;
    this.type = entity.type;
    this.title = entity.title;
    this.body = entity.body;
    this.scheduledTime = entity.scheduled_time;
    this.deliveredTime = entity.delivered_time;
    this.status = entity.status;
    this.attempts = entity.attempts;
    this.lastAttempt = entity.last_attempt;
    this.errorMessage = entity.error_message;
    this.metadata = entity.metadata;
    this.createdAt = entity.created_at;
    this.updatedAt = entity.updated_at;
  }

  /**
   * Create a new notification history record
   */
  static async create(data: CreateNotificationHistoryRequest): Promise<NotificationHistory> {
    const result = await query<NotificationHistoryEntity>(
      `INSERT INTO notification_history (
        user_id, task_id, notification_id, type, title, body, 
        scheduled_time, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        data.userId,
        data.taskId,
        data.notificationId,
        data.type,
        data.title,
        data.body,
        data.scheduledTime,
        JSON.stringify(data.metadata || {})
      ]
    );

    return new NotificationHistory(result.rows[0]);
  }

  /**
   * Find notification history by ID
   */
  static async findById(id: string): Promise<NotificationHistory | null> {
    const result = await query<NotificationHistoryEntity>(
      'SELECT * FROM notification_history WHERE id = $1',
      [id]
    );

    return result.rows.length > 0 ? new NotificationHistory(result.rows[0]) : null;
  }

  /**
   * Find notification history by notification ID
   */
  static async findByNotificationId(notificationId: string): Promise<NotificationHistory | null> {
    const result = await query<NotificationHistoryEntity>(
      'SELECT * FROM notification_history WHERE notification_id = $1',
      [notificationId]
    );

    return result.rows.length > 0 ? new NotificationHistory(result.rows[0]) : null;
  }

  /**
   * Get notification history for a user
   */
  static async findByUserId(
    userId: string, 
    page: number = 1, 
    limit: number = 20,
    status?: string
  ): Promise<{ notifications: NotificationHistory[], total: number }> {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE user_id = $1';
    let params: any[] = [userId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    const [notificationsResult, countResult] = await Promise.all([
      query<NotificationHistoryEntity>(
        `SELECT * FROM notification_history ${whereClause} 
         ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM notification_history ${whereClause}`,
        params
      )
    ]);

    const notifications = notificationsResult.rows.map(row => new NotificationHistory(row));
    const total = parseInt(countResult.rows[0].count, 10);

    return { notifications, total };
  }

  /**
   * Get pending notifications that need to be delivered
   */
  static async findPendingNotifications(beforeTime?: Date): Promise<NotificationHistory[]> {
    const time = beforeTime || new Date();
    const result = await query<NotificationHistoryEntity>(
      `SELECT * FROM notification_history 
       WHERE status = 'pending' AND scheduled_time <= $1
       ORDER BY scheduled_time ASC`,
      [time]
    );

    return result.rows.map(row => new NotificationHistory(row));
  }

  /**
   * Update notification history
   */
  async update(data: UpdateNotificationHistoryRequest): Promise<NotificationHistory> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (data.deliveredTime !== undefined) {
      updates.push(`delivered_time = $${paramIndex++}`);
      values.push(data.deliveredTime);
    }

    if (data.attempts !== undefined) {
      updates.push(`attempts = $${paramIndex++}`);
      values.push(data.attempts);
    }

    if (data.lastAttempt !== undefined) {
      updates.push(`last_attempt = $${paramIndex++}`);
      values.push(data.lastAttempt);
    }

    if (data.errorMessage !== undefined) {
      updates.push(`error_message = $${paramIndex++}`);
      values.push(data.errorMessage);
    }

    if (updates.length === 0) {
      return this;
    }

    updates.push(`updated_at = NOW()`);
    values.push(this.id);

    const result = await query<NotificationHistoryEntity>(
      `UPDATE notification_history SET ${updates.join(', ')} 
       WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    const updated = new NotificationHistory(result.rows[0]);
    Object.assign(this, updated);
    return this;
  }

  /**
   * Mark notification as delivered
   */
  async markDelivered(): Promise<NotificationHistory> {
    return this.update({
      status: 'delivered',
      deliveredTime: new Date(),
      lastAttempt: new Date()
    });
  }

  /**
   * Mark notification as failed
   */
  async markFailed(errorMessage: string): Promise<NotificationHistory> {
    return this.update({
      status: 'failed',
      errorMessage,
      lastAttempt: new Date(),
      attempts: this.attempts + 1
    });
  }

  /**
   * Mark notification as snoozed
   */
  async markSnoozed(): Promise<NotificationHistory> {
    return this.update({
      status: 'snoozed',
      lastAttempt: new Date()
    });
  }

  /**
   * Cancel notification
   */
  async cancel(): Promise<NotificationHistory> {
    return this.update({
      status: 'cancelled',
      lastAttempt: new Date()
    });
  }

  /**
   * Check if notification can be retried
   */
  canRetry(maxAttempts: number = 3): boolean {
    return this.status === 'failed' && this.attempts < maxAttempts;
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): Omit<NotificationHistoryEntity, 'user_id' | 'task_id'> {
    return {
      id: this.id,
      notification_id: this.notificationId,
      type: this.type,
      title: this.title,
      body: this.body,
      scheduled_time: this.scheduledTime,
      delivered_time: this.deliveredTime,
      status: this.status,
      attempts: this.attempts,
      last_attempt: this.lastAttempt,
      error_message: this.errorMessage,
      metadata: this.metadata,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }
}
