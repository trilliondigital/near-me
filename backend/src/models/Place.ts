import { PlaceEntity, CreatePlaceRequest, UpdatePlaceRequest, GeofenceRadii, PlaceType } from './types';
import { ValidationError } from './validation';
import { query } from '../database/connection';

export class Place {
  public id: string;
  public userId: string;
  public name: string;
  public latitude: number;
  public longitude: number;
  public address?: string;
  public placeType: PlaceType;
  public defaultRadii: GeofenceRadii;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(entity: PlaceEntity) {
    this.id = entity.id;
    this.userId = entity.user_id;
    this.name = entity.name;
    this.latitude = entity.latitude;
    this.longitude = entity.longitude;
    this.address = entity.address;
    this.placeType = entity.place_type;
    this.defaultRadii = entity.default_radii;
    this.createdAt = entity.created_at;
    this.updatedAt = entity.updated_at;
  }

  public static fromCreateRequest(userId: string, request: CreatePlaceRequest): Omit<PlaceEntity, 'id' | 'created_at' | 'updated_at'> {
    // Basic validation
    if (!request.name || !request.latitude || !request.longitude || !request.place_type) {
      throw new ValidationError('Missing required fields', []);
    }

    const defaultRadii: GeofenceRadii = request.default_radii || Place.getDefaultRadiiForType(request.place_type);

    return {
      user_id: userId,
      name: request.name,
      latitude: request.latitude,
      longitude: request.longitude,
      address: request.address,
      place_type: request.place_type,
      default_radii: defaultRadii
    };
  }

  public static fromUpdateRequest(request: UpdatePlaceRequest): Partial<PlaceEntity> {
    // Basic validation - at least one field should be provided
    if (Object.keys(request).length === 0) {
      throw new ValidationError('No update fields provided', []);
    }

    const updates: Partial<PlaceEntity> = {};
    
    if (request.name !== undefined) updates.name = request.name;
    if (request.latitude !== undefined) updates.latitude = request.latitude;
    if (request.longitude !== undefined) updates.longitude = request.longitude;
    if (request.address !== undefined) updates.address = request.address;
    if (request.place_type !== undefined) updates.place_type = request.place_type;
    if (request.default_radii !== undefined) updates.default_radii = request.default_radii;

    return updates;
  }

  public static getDefaultRadiiForType(placeType: PlaceType): GeofenceRadii {
    switch (placeType) {
      case 'home':
      case 'work':
        return {
          approach: 2, // 2 miles
          arrival: 100, // 100 meters
          postArrival: true // 5 minutes post-arrival
        };
      case 'custom':
      default:
        return {
          approach: 5, // 5 miles
          arrival: 100, // 100 meters
          postArrival: true // 5 minutes post-arrival
        };
    }
  }

  public toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      latitude: this.latitude,
      longitude: this.longitude,
      address: this.address,
      placeType: this.placeType,
      defaultRadii: this.defaultRadii,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  public getCoordinate() {
    return {
      latitude: this.latitude,
      longitude: this.longitude
    };
  }

  public distanceTo(other: { latitude: number; longitude: number }): number {
    // Haversine formula to calculate distance in miles
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(other.latitude - this.latitude);
    const dLon = this.toRadians(other.longitude - this.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(this.latitude)) * Math.cos(this.toRadians(other.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Find place by ID and user ID
   */
  static async findById(id: string, userId?: string): Promise<Place | null> {
    let queryText = 'SELECT * FROM places WHERE id = $1';
    const params = [id];
    
    if (userId) {
      queryText += ' AND user_id = $2';
      params.push(userId);
    }
    
    const result = await query<PlaceEntity>(queryText, params);
    
    if (result.rows.length === 0) {
      return null;
    }

    return new Place(result.rows[0]);
  }

  /**
   * Find all places for a user
   */
  static async findByUserId(userId: string): Promise<Place[]> {
    const queryText = 'SELECT * FROM places WHERE user_id = $1 ORDER BY created_at DESC';
    const result = await query<PlaceEntity>(queryText, [userId]);
    
    return result.rows.map((row: PlaceEntity) => new Place(row));
  }

  /**
   * Create a new place
   */
  static async create(userId: string, data: CreatePlaceRequest): Promise<Place> {
    const placeData = Place.fromCreateRequest(userId, data);
    
    const queryText = `
      INSERT INTO places (user_id, name, latitude, longitude, address, place_type, default_radii)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      placeData.user_id,
      placeData.name,
      placeData.latitude,
      placeData.longitude,
      placeData.address,
      placeData.place_type,
      JSON.stringify(placeData.default_radii)
    ];

    const result = await query<PlaceEntity>(queryText, values);
    return new Place(result.rows[0]);
  }

  /**
   * Update a place
   */
  async update(data: UpdatePlaceRequest): Promise<Place> {
    const updates = Place.fromUpdateRequest(data);
    
    if (Object.keys(updates).length === 0) {
      return this;
    }

    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const queryText = `
      UPDATE places 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const values = [this.id, ...Object.values(updates)];
    const result = await query<PlaceEntity>(queryText, values);
    
    return new Place(result.rows[0]);
  }

  /**
   * Delete a place
   */
  async delete(): Promise<void> {
    const queryText = 'DELETE FROM places WHERE id = $1';
    await query(queryText, [this.id]);
  }
}