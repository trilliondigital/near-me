import { getDatabase } from '../database/connection';
import { 
  GeofenceEventEntity, 
  CreateGeofenceEventRequest, 
  GeofenceEventType,
  GeofenceEventStatus,
  Coordinate 
} from './types';
import { ValidationError, validateSchema, createGeofenceEventSchema } from './validation';

export class GeofenceEvent {
  public id: string;
  public user_id: string;
  public task_id: string;
  public geofence_id: string;
  public event_type: GeofenceEventType;
  public location: Coordinate;
  public confidence: number;
  public status: GeofenceEventStatus;
  public processed_at?: Date;
  public notification_sent: boolean;
  public bundled_with?: string;
  public cooldown_until?: Date;
  public created_at: Date;

  constructor(data: GeofenceEventEntity) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.task_id = data.task_id;
    this.geofence_id = data.geofence_id;
    this.event_type = data.event_type;
    this.location = {
      latitude: data.latitude,
      longitude: data.longitude
    };
    this.confidence = data.confidence;
    this.status = data.status;
    this.processed_at = data.processed_at;
    this.notification_sent = data.notification_sent;
    this.bundled_with = data.bundled_with;
    this.cooldown_until = data.cooldown_until;
    this.created_at = data.created_at;
  }

  /**
   * Create a new geofence event
   */
  static async create(data: CreateGeofenceEventRequest): Promise<GeofenceEvent> {
    const validatedData = validateSchema<CreateGeofenceEventRequest>(createGeofenceEventSchema, data);

    const query = `
      INSERT INTO geofence_events (
        user_id, task_id, geofence_id, event_type, latitude, longitude, 
        confidence, status, notification_sent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      validatedData.user_id,
      validatedData.task_id,
      validatedData.geofence_id,
      validatedData.event_type,
      validatedData.location.latitude,
      validatedData.location.longitude,
      validatedData.confidence || 1.0,
      'pending',
      false
    ];

    const result = await getDatabase().query(query, values);
    return new GeofenceEvent(result.rows[0]);
  }

  /**
   * Find event by ID
   */
  static async findById(id: string): Promise<GeofenceEvent | null> {
    const query = 'SELECT * FROM geofence_events WHERE id = $1';
    const result = await getDatabase().query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return new GeofenceEvent(result.rows[0]);
  }

  /**
   * Find events by user ID with optional filters
   */
  static async findByUserId(
    userId: string, 
    options: {
      status?: GeofenceEventStatus;
      limit?: number;
      offset?: number;
      since?: Date;
    } = {}
  ): Promise<GeofenceEvent[]> {
    let query = 'SELECT * FROM geofence_events WHERE user_id = $1';
    const values: any[] = [userId];
    let paramCount = 1;

    if (options.status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      values.push(options.status);
    }

    if (options.since) {
      paramCount++;
      query += ` AND created_at >= $${paramCount}`;
      values.push(options.since);
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      values.push(options.limit);
    }

    if (options.offset) {
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      values.push(options.offset);
    }

    const result = await getDatabase().query(query, values);
    return result.rows.map(row => new GeofenceEvent(row));
  }

  /**
   * Find pending events for processing
   */
  static async findPendingEvents(limit: number = 100): Promise<GeofenceEvent[]> {
    const query = `
      SELECT * FROM geofence_events 
      WHERE status = 'pending' 
      AND (cooldown_until IS NULL OR cooldown_until <= NOW())
      ORDER BY created_at ASC 
      LIMIT $1
    `;
    
    const result = await getDatabase().query(query, [limit]);
    return result.rows.map(row => new GeofenceEvent(row));
  }

  /**
   * Find events for deduplication check
   */
  static async findRecentEvents(
    userId: string,
    taskId: string,
    eventType: GeofenceEventType,
    withinMinutes: number = 15
  ): Promise<GeofenceEvent[]> {
    const query = `
      SELECT * FROM geofence_events 
      WHERE user_id = $1 
      AND task_id = $2 
      AND event_type = $3
      AND created_at >= NOW() - INTERVAL '${withinMinutes} minutes'
      ORDER BY created_at DESC
    `;
    
    const result = await getDatabase().query(query, [userId, taskId, eventType]);
    return result.rows.map(row => new GeofenceEvent(row));
  }

  /**
   * Update event status
   */
  async updateStatus(status: GeofenceEventStatus, processedAt?: Date): Promise<GeofenceEvent> {
    const query = `
      UPDATE geofence_events 
      SET status = $1, processed_at = $2
      WHERE id = $3
      RETURNING *
    `;

    const result = await getDatabase().query(query, [
      status, 
      processedAt || new Date(), 
      this.id
    ]);
    
    return new GeofenceEvent(result.rows[0]);
  }

  /**
   * Mark notification as sent
   */
  async markNotificationSent(bundledWith?: string): Promise<GeofenceEvent> {
    const query = `
      UPDATE geofence_events 
      SET notification_sent = true, bundled_with = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await getDatabase().query(query, [bundledWith, this.id]);
    return new GeofenceEvent(result.rows[0]);
  }

  /**
   * Set cooldown period
   */
  async setCooldown(cooldownMinutes: number): Promise<GeofenceEvent> {
    const cooldownUntil = new Date(Date.now() + cooldownMinutes * 60 * 1000);
    
    const query = `
      UPDATE geofence_events 
      SET cooldown_until = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await getDatabase().query(query, [cooldownUntil, this.id]);
    return new GeofenceEvent(result.rows[0]);
  }

  /**
   * Check if event is in cooldown
   */
  isInCooldown(): boolean {
    if (!this.cooldown_until) return false;
    return this.cooldown_until > new Date();
  }

  /**
   * Calculate distance from event location to a point
   */
  calculateDistanceTo(point: Coordinate): number {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = this.location.latitude * Math.PI / 180;
    const lat2Rad = point.latitude * Math.PI / 180;
    const deltaLatRad = (point.latitude - this.location.latitude) * Math.PI / 180;
    const deltaLonRad = (point.longitude - this.location.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Delete old events (cleanup)
   */
  static async deleteOldEvents(olderThanDays: number = 30): Promise<number> {
    const query = `
      DELETE FROM geofence_events 
      WHERE created_at < NOW() - INTERVAL '${olderThanDays} days'
    `;
    
    const result = await getDatabase().query(query);
    return result.rowCount || 0;
  }

  /**
   * Get event statistics for a user
   */
  static async getEventStats(userId: string, days: number = 7): Promise<{
    total: number;
    byType: Record<GeofenceEventType, number>;
    byStatus: Record<GeofenceEventStatus, number>;
    notificationsSent: number;
    bundledEvents: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        event_type,
        status,
        notification_sent,
        bundled_with IS NOT NULL as is_bundled
      FROM geofence_events 
      WHERE user_id = $1 
      AND created_at >= NOW() - INTERVAL '${days} days'
      GROUP BY event_type, status, notification_sent, is_bundled
    `;
    
    const result = await getDatabase().query(query, [userId]);
    
    const stats = {
      total: 0,
      byType: {} as Record<GeofenceEventType, number>,
      byStatus: {} as Record<GeofenceEventStatus, number>,
      notificationsSent: 0,
      bundledEvents: 0
    };

    result.rows.forEach(row => {
      stats.total += parseInt(row.total);
      const eventType = row.event_type as GeofenceEventType;
      const status = row.status as GeofenceEventStatus;
      stats.byType[eventType] = (stats.byType[eventType] || 0) + parseInt(row.total);
      stats.byStatus[status] = (stats.byStatus[status] || 0) + parseInt(row.total);
      
      if (row.notification_sent) {
        stats.notificationsSent += parseInt(row.total);
      }
      
      if (row.is_bundled) {
        stats.bundledEvents += parseInt(row.total);
      }
    });

    return stats;
  }

  /**
   * Convert to JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      user_id: this.user_id,
      task_id: this.task_id,
      geofence_id: this.geofence_id,
      event_type: this.event_type,
      location: this.location,
      confidence: this.confidence,
      status: this.status,
      processed_at: this.processed_at,
      notification_sent: this.notification_sent,
      bundled_with: this.bundled_with,
      cooldown_until: this.cooldown_until,
      created_at: this.created_at
    };
  }
}