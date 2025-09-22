import { Pool } from 'pg';
import { Place } from '../models/Place';
import { PlaceEntity, CreatePlaceRequest, UpdatePlaceRequest, Coordinate } from '../models/types';
import { GeocodingService } from './geocodingService';
import { POIService } from './poiService';
import { analyticsService } from './analyticsService';

export class PlaceService {
  private db: Pool;
  private geocodingService: GeocodingService;
  private poiService: POIService;

  constructor(db: Pool) {
    this.db = db;
    this.geocodingService = new GeocodingService();
    this.poiService = new POIService();
  }

  /**
   * Create a new place
   */
  async createPlace(userId: string, request: CreatePlaceRequest): Promise<Place> {
    const placeData = Place.fromCreateRequest(userId, request);

    // If no address provided but coordinates are given, try reverse geocoding
    if (!placeData.address && placeData.latitude && placeData.longitude) {
      try {
        const geocodingResult = await this.geocodingService.reverseGeocode({
          latitude: placeData.latitude,
          longitude: placeData.longitude,
        });
        if (geocodingResult) {
          placeData.address = geocodingResult.formattedAddress;
        }
      } catch (error) {
        console.warn('Failed to reverse geocode place coordinates:', error);
      }
    }

    const query = `
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
      JSON.stringify(placeData.default_radii),
    ];

    try {
      const result = await this.db.query(query, values);
      const entity = this.mapRowToEntity(result.rows[0]);
      const place = new Place(entity);

      // Track analytics event
      try {
        await analyticsService.trackPlaceAdded(userId, 'session_id_placeholder', {
          placeId: place.id,
          placeType: place.place_type,
          method: request.address ? 'address_search' : 'map_selection'
        });
      } catch (error) {
        // Don't fail place creation if analytics fails
        console.warn('Failed to track place creation analytics:', error);
      }

      return place;
    } catch (error) {
      console.error('Error creating place:', error);
      throw new Error('Failed to create place');
    }
  }

  /**
   * Get place by ID
   */
  async getPlaceById(id: string, userId: string): Promise<Place | null> {
    const query = 'SELECT * FROM places WHERE id = $1 AND user_id = $2';
    
    try {
      const result = await this.db.query(query, [id, userId]);
      if (result.rows.length === 0) {
        return null;
      }
      
      const entity = this.mapRowToEntity(result.rows[0]);
      return new Place(entity);
    } catch (error) {
      console.error('Error getting place by ID:', error);
      throw new Error('Failed to get place');
    }
  }

  /**
   * Get all places for a user
   */
  async getUserPlaces(userId: string): Promise<Place[]> {
    const query = 'SELECT * FROM places WHERE user_id = $1 ORDER BY created_at DESC';
    
    try {
      const result = await this.db.query(query, [userId]);
      return result.rows.map(row => {
        const entity = this.mapRowToEntity(row);
        return new Place(entity);
      });
    } catch (error) {
      console.error('Error getting user places:', error);
      throw new Error('Failed to get user places');
    }
  }

  /**
   * Update a place
   */
  async updatePlace(id: string, userId: string, request: UpdatePlaceRequest): Promise<Place | null> {
    const updates = Place.fromUpdateRequest(request);
    
    if (Object.keys(updates).length === 0) {
      // No updates provided, return current place
      return this.getPlaceById(id, userId);
    }

    // If coordinates are being updated but no address, try reverse geocoding
    if ((updates.latitude || updates.longitude) && !updates.address) {
      const currentPlace = await this.getPlaceById(id, userId);
      if (currentPlace) {
        const newLat = updates.latitude || currentPlace.latitude;
        const newLng = updates.longitude || currentPlace.longitude;
        
        try {
          const geocodingResult = await this.geocodingService.reverseGeocode({
            latitude: newLat,
            longitude: newLng,
          });
          if (geocodingResult) {
            updates.address = geocodingResult.formattedAddress;
          }
        } catch (error) {
          console.warn('Failed to reverse geocode updated coordinates:', error);
        }
      }
    }

    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 3}`)
      .join(', ');

    const query = `
      UPDATE places 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const values = [id, userId, ...Object.values(updates).map(value => 
      typeof value === 'object' ? JSON.stringify(value) : value
    )];

    try {
      const result = await this.db.query(query, values);
      if (result.rows.length === 0) {
        return null;
      }
      
      const entity = this.mapRowToEntity(result.rows[0]);
      return new Place(entity);
    } catch (error) {
      console.error('Error updating place:', error);
      throw new Error('Failed to update place');
    }
  }

  /**
   * Delete a place
   */
  async deletePlace(id: string, userId: string): Promise<boolean> {
    // First check if place has associated tasks
    const taskCheckQuery = 'SELECT COUNT(*) FROM tasks WHERE place_id = $1 AND user_id = $2 AND status = $3';
    
    try {
      const taskResult = await this.db.query(taskCheckQuery, [id, userId, 'active']);
      const activeTaskCount = parseInt(taskResult.rows[0].count);
      
      if (activeTaskCount > 0) {
        throw new Error('Cannot delete place with active tasks');
      }

      const deleteQuery = 'DELETE FROM places WHERE id = $1 AND user_id = $2';
      const result = await this.db.query(deleteQuery, [id, userId]);
      
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting place:', error);
      if (error.message === 'Cannot delete place with active tasks') {
        throw error;
      }
      throw new Error('Failed to delete place');
    }
  }

  /**
   * Search places by name or address
   */
  async searchPlaces(userId: string, query: string): Promise<Place[]> {
    const searchQuery = `
      SELECT * FROM places 
      WHERE user_id = $1 
      AND (name ILIKE $2 OR address ILIKE $2)
      ORDER BY name
    `;
    
    try {
      const result = await this.db.query(searchQuery, [userId, `%${query}%`]);
      return result.rows.map(row => {
        const entity = this.mapRowToEntity(row);
        return new Place(entity);
      });
    } catch (error) {
      console.error('Error searching places:', error);
      throw new Error('Failed to search places');
    }
  }

  /**
   * Find places near a coordinate
   */
  async findNearbyPlaces(userId: string, coordinate: Coordinate, radiusMiles: number = 10): Promise<Place[]> {
    // Using Haversine formula in SQL for distance calculation
    const query = `
      SELECT *, 
        (3959 * acos(cos(radians($2)) * cos(radians(latitude)) * 
        cos(radians(longitude) - radians($3)) + sin(radians($2)) * 
        sin(radians(latitude)))) AS distance
      FROM places 
      WHERE user_id = $1
      HAVING distance <= $4
      ORDER BY distance
    `;
    
    try {
      const result = await this.db.query(query, [
        userId,
        coordinate.latitude,
        coordinate.longitude,
        radiusMiles,
      ]);
      
      return result.rows.map(row => {
        const entity = this.mapRowToEntity(row);
        return new Place(entity);
      });
    } catch (error) {
      console.error('Error finding nearby places:', error);
      throw new Error('Failed to find nearby places');
    }
  }

  /**
   * Geocode an address and create a place
   */
  async createPlaceFromAddress(userId: string, name: string, address: string, placeType: string = 'custom'): Promise<Place> {
    const geocodingResult = await this.geocodingService.geocodeAddress(address);
    
    if (!geocodingResult) {
      throw new Error('Could not geocode the provided address');
    }

    const createRequest: CreatePlaceRequest = {
      name,
      latitude: geocodingResult.coordinate.latitude,
      longitude: geocodingResult.coordinate.longitude,
      address: geocodingResult.formattedAddress,
      place_type: placeType as any,
    };

    return this.createPlace(userId, createRequest);
  }

  /**
   * Get place statistics for a user
   */
  async getPlaceStats(userId: string): Promise<{
    totalPlaces: number;
    placesByType: Record<string, number>;
    placesWithActiveTasks: number;
  }> {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_places,
        COUNT(CASE WHEN place_type = 'home' THEN 1 END) as home_places,
        COUNT(CASE WHEN place_type = 'work' THEN 1 END) as work_places,
        COUNT(CASE WHEN place_type = 'custom' THEN 1 END) as custom_places,
        COUNT(CASE WHEN EXISTS(
          SELECT 1 FROM tasks t WHERE t.place_id = p.id AND t.status = 'active'
        ) THEN 1 END) as places_with_active_tasks
      FROM places p
      WHERE p.user_id = $1
    `;

    try {
      const result = await this.db.query(statsQuery, [userId]);
      const row = result.rows[0];

      return {
        totalPlaces: parseInt(row.total_places),
        placesByType: {
          home: parseInt(row.home_places),
          work: parseInt(row.work_places),
          custom: parseInt(row.custom_places),
        },
        placesWithActiveTasks: parseInt(row.places_with_active_tasks),
      };
    } catch (error) {
      console.error('Error getting place stats:', error);
      throw new Error('Failed to get place statistics');
    }
  }

  /**
   * Map database row to PlaceEntity
   */
  private mapRowToEntity(row: any): PlaceEntity {
    return {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      address: row.address,
      place_type: row.place_type,
      default_radii: typeof row.default_radii === 'string' 
        ? JSON.parse(row.default_radii) 
        : row.default_radii,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}