import { query } from '../database/connection';
import { ValidationError } from './validation';

export interface NotificationRetryEntity {
  id: string;
  notification_history_id: string;
  retry_count: number;
  next_retry_time: Date;
  backoff_multiplier: number;
  max_retries: number;
  status: 'pending' | 'retrying' | 'failed' | 'succeeded';
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateNotificationRetryRequest {
  notificationHistoryId: string;
  maxRetries?: number;
  initialDelayMinutes?: number;
}

export class NotificationRetry {
  public id: string;
  public notificationHistoryId: string;
  public retryCount: number;
  public nextRetryTime: Date;
  public backoffMultiplier: number;
  public maxRetries: number;
  public status: 'pending' | 'retrying' | 'failed' | 'succeeded';
  public errorMessage?: string;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(entity: NotificationRetryEntity) {
    this.id = entity.id;
    this.notificationHistoryId = entity.notification_history_id;
    this.retryCount = entity.retry_count;
    this.nextRetryTime = entity.next_retry_time;
    this.backoffMultiplier = entity.backoff_multiplier;
    this.maxRetries = entity.max_retries;
    this.status = entity.status;
    this.errorMessage = entity.error_message;
    this.createdAt = entity.created_at;
    this.updatedAt = entity.updated_at;
  }

  /**
   * Create a new notification retry record
   */
  static async create(data: CreateNotificationRetryRequest): Promise<NotificationRetry> {
    const initialDelayMinutes = data.initialDelayMinutes || 5;
    const nextRetryTime = new Date(Date.now() + initialDelayMinutes * 60 * 1000);

    const result = await query<NotificationRetryEntity>(
      `INSERT INTO notification_retries (
        notification_history_id, retry_count, next_retry_time, 
        backoff_multiplier, max_retries, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        data.notificationHistoryId,
        0,
        nextRetryTime,
        1.0,
        data.maxRetries || 3,
        'pending'
      ]
    );

    return new NotificationRetry(result.rows[0]);
  }

  /**
   * Find retry by notification history ID
   */
  static async findByNotificationHistoryId(notificationHistoryId: string): Promise<NotificationRetry | null> {
    const result = await query<NotificationRetryEntity>(
      `SELECT * FROM notification_retries 
       WHERE notification_history_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [notificationHistoryId]
    );

    return result.rows.length > 0 ? new NotificationRetry(result.rows[0]) : null;
  }

  /**
   * Find pending retries that are ready to be processed
   */
  static async findPendingRetries(beforeTime?: Date): Promise<NotificationRetry[]> {
    const time = beforeTime || new Date();
    const result = await query<NotificationRetryEntity>(
      `SELECT * FROM notification_retries 
       WHERE status = 'pending' AND next_retry_time <= $1
       ORDER BY next_retry_time ASC`,
      [time]
    );

    return result.rows.map(row => new NotificationRetry(row));
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  static calculateNextRetryTime(
    retryCount: number, 
    backoffMultiplier: number = 1.0,
    baseDelayMinutes: number = 5
  ): Date {
    // Exponential backoff: delay = baseDelay * (backoffMultiplier ^ retryCount)
    const delayMinutes = baseDelayMinutes * Math.pow(backoffMultiplier, retryCount);
    const maxDelayMinutes = 60; // Cap at 1 hour
    const finalDelayMinutes = Math.min(delayMinutes, maxDelayMinutes);
    
    return new Date(Date.now() + finalDelayMinutes * 60 * 1000);
  }

  /**
   * Schedule next retry
   */
  async scheduleNextRetry(): Promise<NotificationRetry> {
    if (this.retryCount >= this.maxRetries) {
      throw new ValidationError('Maximum retry attempts reached', []);
    }

    const nextRetryTime = NotificationRetry.calculateNextRetryTime(
      this.retryCount + 1,
      this.backoffMultiplier
    );

    const result = await query<NotificationRetryEntity>(
      `UPDATE notification_retries 
       SET retry_count = retry_count + 1, 
           next_retry_time = $1, 
           status = 'pending',
           updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [nextRetryTime, this.id]
    );

    const updated = new NotificationRetry(result.rows[0]);
    Object.assign(this, updated);
    return this;
  }

  /**
   * Mark retry as retrying
   */
  async markRetrying(): Promise<NotificationRetry> {
    const result = await query<NotificationRetryEntity>(
      `UPDATE notification_retries 
       SET status = 'retrying', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [this.id]
    );

    const updated = new NotificationRetry(result.rows[0]);
    Object.assign(this, updated);
    return this;
  }

  /**
   * Mark retry as succeeded
   */
  async markSucceeded(): Promise<NotificationRetry> {
    const result = await query<NotificationRetryEntity>(
      `UPDATE notification_retries 
       SET status = 'succeeded', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [this.id]
    );

    const updated = new NotificationRetry(result.rows[0]);
    Object.assign(this, updated);
    return this;
  }

  /**
   * Mark retry as failed
   */
  async markFailed(errorMessage: string): Promise<NotificationRetry> {
    const result = await query<NotificationRetryEntity>(
      `UPDATE notification_retries 
       SET status = 'failed', error_message = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [errorMessage, this.id]
    );

    const updated = new NotificationRetry(result.rows[0]);
    Object.assign(this, updated);
    return this;
  }

  /**
   * Check if retry can be attempted
   */
  canRetry(): boolean {
    return this.status === 'pending' && 
           this.retryCount < this.maxRetries && 
           new Date() >= this.nextRetryTime;
  }

  /**
   * Check if retry has exceeded max attempts
   */
  hasExceededMaxRetries(): boolean {
    return this.retryCount >= this.maxRetries;
  }

  /**
   * Get remaining retry attempts
   */
  getRemainingRetries(): number {
    return Math.max(0, this.maxRetries - this.retryCount);
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): NotificationRetryEntity {
    return {
      id: this.id,
      notification_history_id: this.notificationHistoryId,
      retry_count: this.retryCount,
      next_retry_time: this.nextRetryTime,
      backoff_multiplier: this.backoffMultiplier,
      max_retries: this.maxRetries,
      status: this.status,
      error_message: this.errorMessage,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }
}
