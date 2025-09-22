import { getDatabase } from '../database/connection';
import { 
  GeofenceEntity, 
  CreateGeofenceRequest, 
  GeofenceType,
  Coordinate 
} from './types';
import { ValidationError, validateSchema, createGeofenceSchema } from './validation';

export class Geofence {
  public id: string;
  public task_id: string;
  public latitude: number;
  public longitude: number;
  public radius: number; // meters
  public geofence_type: GeofenceType;
  public is_active: boolean;
  public created_at: Date;

  constructor(data: GeofenceEntity) {
    this.id = data.id;
    this.task_id = data.task_id;
    this.latitude = data.latitude;
    this.longitude = data.longitude;
    this.radius = data.radius;
    this.geofence_type = data.geofence_type;
    this.is_active = data.is_active;
    this.created_at = data.created_at;
  }

  /**
   * Create a new geofence
   */
  static async create(data: CreateGeofenceRequest): Promise<Geofence> {
    // Validate input using schema
    const validatedData = validateSchema<CreateGeofenceRequest>(createGeofenceSchema, data);

    const query = `
      INSERT INTO geofences (task_id, latitude, longitude, radius, geofence_type, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      validatedData.task_id,
      validatedData.latitude,
      validatedData.longitude,
      validatedData.radius,
      validatedData.geofence_type,
      true // is_active defaults to true
    ];

    const result = await getDatabase().query(query, values);
    return new Geofence(result.rows[0]);
  }

  /**
   * Find geofence by ID
   */
  static async findById(id: string): Promise<Geofence | null> {
    const query = 'SELECT * FROM geofences WHERE id = $1';
    const result = await getDatabase().query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return new Geofence(result.rows[0]);
  }

  /**
   * Find all geofences for a task
   */
  static async findByTaskId(taskId: string): Promise<Geofence[]> {
    const query = 'SELECT * FROM geofences WHERE task_id = $1 ORDER BY created_at ASC';
    const result = await getDatabase().query(query, [taskId]);
    
    return result.rows.map(row => new Geofence(row));
  }

  /**
   * Find all active geofences
   */
  static async findActive(): Promise<Geofence[]> {
    const query = 'SELECT * FROM geofences WHERE is_active = true ORDER BY created_at ASC';
    const result = await getDatabase().query(query);
    
    return result.rows.map(row => new Geofence(row));
  }

  /**
   * Find active geofences for a user (via tasks)
   */
  static async findActiveByUserId(userId: string): Promise<Geofence[]> {
    const query = `
      SELECT g.* FROM geofences g
      JOIN tasks t ON g.task_id = t.id
      WHERE t.user_id = $1 AND g.is_active = true
      ORDER BY g.created_at ASC
    `;
    const result = await getDatabase().query(query, [userId]);
    
    return result.rows.map(row => new Geofence(row));
  }

  /**
   * Count active geofences for a user
   */
  static async countActiveByUserId(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count FROM geofences g
      JOIN tasks t ON g.task_id = t.id
      WHERE t.user_id = $1 AND g.is_active = true
    `;
    const result = await getDatabase().query(query, [userId]);
    
    return parseInt(result.rows[0].count);
  }

  /**
   * Update geofence active status
   */
  async updateActiveStatus(isActive: boolean): Promise<Geofence> {
    const query = `
      UPDATE geofences 
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await getDatabase().query(query, [isActive, this.id]);
    return new Geofence(result.rows[0]);
  }

  /**
   * Delete geofence
   */
  async delete(): Promise<void> {
    const query = 'DELETE FROM geofences WHERE id = $1';
    await getDatabase().query(query, [this.id]);
  }

  /**
   * Delete all geofences for a task
   */
  static async deleteByTaskId(taskId: string): Promise<void> {
    const query = 'DELETE FROM geofences WHERE task_id = $1';
    await getDatabase().query(query, [taskId]);
  }

  /**
   * Deactivate all geofences for a task
   */
  static async deactivateByTaskId(taskId: string): Promise<void> {
    const query = `
      UPDATE geofences 
      SET is_active = false, updated_at = NOW()
      WHERE task_id = $1
    `;
    await getDatabase().query(query, [taskId]);
  }

  /**
   * Get geofence location as Coordinate
   */
  getLocation(): Coordinate {
    return {
      latitude: this.latitude,
      longitude: this.longitude
    };
  }

  /**
   * Check if geofence contains a point
   */
  containsPoint(point: Coordinate): boolean {
    const distance = this.calculateDistance(point);
    return distance <= this.radius;
  }

  /**
   * Calculate distance from geofence center to a point in meters
   */
  calculateDistance(point: Coordinate): number {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = this.latitude * Math.PI / 180;
    const lat2Rad = point.latitude * Math.PI / 180;
    const deltaLatRad = (point.latitude - this.latitude) * Math.PI / 180;
    const deltaLonRad = (point.longitude - this.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Convert to JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      task_id: this.task_id,
      latitude: this.latitude,
      longitude: this.longitude,
      radius: this.radius,
      geofence_type: this.geofence_type,
      is_active: this.is_active,
      created_at: this.created_at
    };
  }
}