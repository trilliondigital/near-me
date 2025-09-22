import { Geofence } from '../models/Geofence';
import { Task } from '../models/Task';
import { Place } from '../models/Place';
import { POI } from '../models/POI';
import { 
  GeofenceType, 
  GeofenceRadii, 
  LocationType, 
  PlaceType,
  POICategory,
  Coordinate,
  CreateGeofenceRequest 
} from '../models/types';
import { ValidationError } from '../models/validation';

export interface GeofenceCalculationResult {
  geofences: CreateGeofenceRequest[];
  totalCount: number;
}

export interface GeofencePriorityInfo {
  geofence: Geofence;
  priority: number;
  lastUsed?: Date;
}

export class GeofenceService {
  // Maximum number of active geofences per user (platform limitation)
  private static readonly MAX_ACTIVE_GEOFENCES = 20;

  // Default radii for different location types
  private static readonly DEFAULT_RADII = {
    POI_CATEGORY: {
      approach_5mi: 8047, // 5 miles in meters
      approach_3mi: 4828, // 3 miles in meters  
      approach_1mi: 1609, // 1 mile in meters
      arrival: 100,       // 100 meters
      post_arrival: 100   // 100 meters (same as arrival)
    },
    HOME_WORK: {
      approach: 3219,     // 2 miles in meters
      arrival: 100,       // 100 meters
      post_arrival: 100   // 100 meters
    },
    CUSTOM_PLACE: {
      approach: 8047,     // 5 miles in meters (default)
      arrival: 100,       // 100 meters
      post_arrival: 100   // 100 meters
    }
  };

  /**
   * Create geofences for a task based on its location type
   */
  static async createGeofencesForTask(task: Task): Promise<Geofence[]> {
    if (task.status !== 'active') {
      throw new ValidationError('Can only create geofences for active tasks', []);
    }

    // Calculate geofences based on location type
    const calculationResult = await this.calculateGeofencesForTask(task);
    
    // Check if adding these geofences would exceed the limit
    const currentCount = await Geofence.countActiveByUserId(task.user_id);
    const newTotal = currentCount + calculationResult.totalCount;
    
    if (newTotal > this.MAX_ACTIVE_GEOFENCES) {
      // Need to prioritize and potentially deactivate some geofences
      await this.optimizeGeofencesForUser(task.user_id, calculationResult.totalCount);
    }

    // Create the geofences
    const createdGeofences: Geofence[] = [];
    for (const geofenceData of calculationResult.geofences) {
      const geofence = await Geofence.create(geofenceData);
      createdGeofences.push(geofence);
    }

    return createdGeofences;
  }

  /**
   * Calculate geofences for a task without creating them
   */
  static async calculateGeofencesForTask(task: Task): Promise<GeofenceCalculationResult> {
    const geofences: CreateGeofenceRequest[] = [];

    if (task.location_type === 'custom_place') {
      if (!task.place_id) {
        throw new ValidationError('Place ID required for custom place tasks', []);
      }

      const place = await Place.findById(task.place_id, task.user_id);
      if (!place) {
        throw new ValidationError('Place not found', []);
      }

      const placeGeofences = this.calculateGeofencesForPlace(task, place);
      geofences.push(...placeGeofences);

    } else if (task.location_type === 'poi_category') {
      if (!task.poi_category) {
        throw new ValidationError('POI category required for category tasks', []);
      }

      // For POI categories, we create template geofences that will be applied
      // to specific POIs when the user is near them
      const categoryGeofences = this.calculateGeofencesForPOICategory(task);
      geofences.push(...categoryGeofences);
    }

    return {
      geofences,
      totalCount: geofences.length
    };
  }

  /**
   * Calculate geofences for a custom place
   */
  private static calculateGeofencesForPlace(task: Task, place: Place): CreateGeofenceRequest[] {
    const geofences: CreateGeofenceRequest[] = [];
    const location: Coordinate = {
      latitude: place.latitude,
      longitude: place.longitude
    };

    // Use custom radii if provided, otherwise use defaults based on place type
    const radii = task.custom_radii || place.defaultRadii;
    
    if (place.placeType === 'home' || place.placeType === 'work') {
      // Home/Work: 2mi approach + arrival + 5min post-arrival
      geofences.push({
        task_id: task.id,
        latitude: location.latitude,
        longitude: location.longitude,
        radius: radii.approach ? this.milesToMeters(radii.approach) : this.DEFAULT_RADII.HOME_WORK.approach,
        geofence_type: 'approach_5mi' // Using 5mi type for approach
      });

      geofences.push({
        task_id: task.id,
        latitude: location.latitude,
        longitude: location.longitude,
        radius: radii.arrival || this.DEFAULT_RADII.HOME_WORK.arrival,
        geofence_type: 'arrival'
      });

      if (radii.postArrival) {
        geofences.push({
          task_id: task.id,
          latitude: location.latitude,
          longitude: location.longitude,
          radius: radii.arrival || this.DEFAULT_RADII.HOME_WORK.post_arrival,
          geofence_type: 'post_arrival'
        });
      }
    } else {
      // Custom places: 5mi approach + arrival + optional post-arrival
      geofences.push({
        task_id: task.id,
        latitude: location.latitude,
        longitude: location.longitude,
        radius: radii.approach ? this.milesToMeters(radii.approach) : this.DEFAULT_RADII.CUSTOM_PLACE.approach,
        geofence_type: 'approach_5mi'
      });

      geofences.push({
        task_id: task.id,
        latitude: location.latitude,
        longitude: location.longitude,
        radius: radii.arrival || this.DEFAULT_RADII.CUSTOM_PLACE.arrival,
        geofence_type: 'arrival'
      });

      if (radii.postArrival) {
        geofences.push({
          task_id: task.id,
          latitude: location.latitude,
          longitude: location.longitude,
          radius: radii.arrival || this.DEFAULT_RADII.CUSTOM_PLACE.post_arrival,
          geofence_type: 'post_arrival'
        });
      }
    }

    return geofences;
  }

  /**
   * Calculate template geofences for POI categories
   * These will be applied to specific POIs when user is nearby
   */
  private static calculateGeofencesForPOICategory(task: Task): CreateGeofenceRequest[] {
    // For POI categories, we create template geofences at 0,0 
    // These will be updated with actual POI locations when needed
    const geofences: CreateGeofenceRequest[] = [];
    const templateLocation: Coordinate = { latitude: 0, longitude: 0 };

    // POI Categories: 5mi, 3mi, 1mi approach + arrival
    const radii = task.custom_radii;

    geofences.push({
      task_id: task.id,
      latitude: templateLocation.latitude,
      longitude: templateLocation.longitude,
      radius: radii?.approach ? this.milesToMeters(radii.approach) : this.DEFAULT_RADII.POI_CATEGORY.approach_5mi,
      geofence_type: 'approach_5mi'
    });

    geofences.push({
      task_id: task.id,
      latitude: templateLocation.latitude,
      longitude: templateLocation.longitude,
      radius: this.DEFAULT_RADII.POI_CATEGORY.approach_3mi,
      geofence_type: 'approach_3mi'
    });

    geofences.push({
      task_id: task.id,
      latitude: templateLocation.latitude,
      longitude: templateLocation.longitude,
      radius: this.DEFAULT_RADII.POI_CATEGORY.approach_1mi,
      geofence_type: 'approach_1mi'
    });

    geofences.push({
      task_id: task.id,
      latitude: templateLocation.latitude,
      longitude: templateLocation.longitude,
      radius: radii?.arrival || this.DEFAULT_RADII.POI_CATEGORY.arrival,
      geofence_type: 'arrival'
    });

    return geofences;
  }

  /**
   * Update geofences for a task (when task location or radii change)
   */
  static async updateGeofencesForTask(task: Task): Promise<Geofence[]> {
    // Remove existing geofences
    await Geofence.deleteByTaskId(task.id);

    // Create new geofences if task is active
    if (task.status === 'active') {
      return this.createGeofencesForTask(task);
    }

    return [];
  }

  /**
   * Remove all geofences for a task
   */
  static async removeGeofencesForTask(taskId: string): Promise<void> {
    await Geofence.deleteByTaskId(taskId);
  }

  /**
   * Deactivate geofences for a task (for muting)
   */
  static async deactivateGeofencesForTask(taskId: string): Promise<void> {
    await Geofence.deactivateByTaskId(taskId);
  }

  /**
   * Reactivate geofences for a task (for unmuting)
   */
  static async reactivateGeofencesForTask(taskId: string): Promise<void> {
    const geofences = await Geofence.findByTaskId(taskId);
    
    for (const geofence of geofences) {
      await geofence.updateActiveStatus(true);
    }
  }

  /**
   * Optimize geofences for a user when approaching the limit
   */
  static async optimizeGeofencesForUser(userId: string, newGeofencesCount: number): Promise<void> {
    const activeGeofences = await Geofence.findActiveByUserId(userId);
    const currentCount = activeGeofences.length;
    const targetCount = this.MAX_ACTIVE_GEOFENCES - newGeofencesCount;

    if (currentCount <= targetCount) {
      return; // No optimization needed
    }

    // Calculate priorities for existing geofences
    const prioritizedGeofences = await this.calculateGeofencePriorities(activeGeofences);
    
    // Sort by priority (lower number = higher priority)
    prioritizedGeofences.sort((a, b) => a.priority - b.priority);

    // Deactivate lowest priority geofences
    const toDeactivate = prioritizedGeofences.slice(targetCount);
    
    for (const item of toDeactivate) {
      await item.geofence.updateActiveStatus(false);
    }
  }

  /**
   * Calculate priority scores for geofences
   */
  private static async calculateGeofencePriorities(geofences: Geofence[]): Promise<GeofencePriorityInfo[]> {
    const priorities: GeofencePriorityInfo[] = [];

    for (const geofence of geofences) {
      let priority = 0;

      // Priority based on geofence type (arrival > approach)
      switch (geofence.geofence_type) {
        case 'arrival':
          priority += 1;
          break;
        case 'post_arrival':
          priority += 2;
          break;
        case 'approach_1mi':
          priority += 3;
          break;
        case 'approach_3mi':
          priority += 4;
          break;
        case 'approach_5mi':
          priority += 5;
          break;
      }

      // TODO: Add priority based on task creation date, user behavior, etc.
      // For now, newer tasks get slightly higher priority
      const task = await Task.findById(geofence.task_id);
      if (task) {
        const daysSinceCreation = (Date.now() - task.created_at.getTime()) / (1000 * 60 * 60 * 24);
        priority += Math.floor(daysSinceCreation / 7); // Lower priority for older tasks
      }

      priorities.push({
        geofence,
        priority
      });
    }

    return priorities;
  }

  /**
   * Get geofence statistics for a user
   */
  static async getGeofenceStats(userId: string): Promise<{
    total: number;
    active: number;
    byType: Record<GeofenceType, number>;
    utilizationPercentage: number;
  }> {
    // Get all geofences for user (both active and inactive)
    const allUserGeofencesQuery = `
      SELECT g.* FROM geofences g
      JOIN tasks t ON g.task_id = t.id
      WHERE t.user_id = $1
      ORDER BY g.created_at ASC
    `;
    
    const activeGeofences = await Geofence.findActiveByUserId(userId);

    const byType: Record<GeofenceType, number> = {
      approach_5mi: 0,
      approach_3mi: 0,
      approach_1mi: 0,
      arrival: 0,
      post_arrival: 0
    };

    activeGeofences.forEach(geofence => {
      byType[geofence.geofence_type]++;
    });

    // For total count, we'll use a separate query
    const totalCount = await this.getTotalGeofenceCountForUser(userId);

    return {
      total: totalCount,
      active: activeGeofences.length,
      byType,
      utilizationPercentage: (activeGeofences.length / this.MAX_ACTIVE_GEOFENCES) * 100
    };
  }

  /**
   * Get total geofence count for a user (including inactive)
   */
  private static async getTotalGeofenceCountForUser(userId: string): Promise<number> {
    const { getDatabase } = await import('../database/connection');
    const query = `
      SELECT COUNT(*) as count FROM geofences g
      JOIN tasks t ON g.task_id = t.id
      WHERE t.user_id = $1
    `;
    const result = await getDatabase().query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Validate geofence configuration
   */
  static validateGeofenceRadii(radii: GeofenceRadii): string[] {
    const errors: string[] = [];

    if (radii.approach !== undefined) {
      if (radii.approach < 0.1 || radii.approach > 50) {
        errors.push('Approach radius must be between 0.1 and 50 miles');
      }
    }

    if (radii.arrival !== undefined) {
      if (radii.arrival < 10 || radii.arrival > 1000) {
        errors.push('Arrival radius must be between 10 and 1000 meters');
      }
    }

    return errors;
  }

  /**
   * Convert miles to meters
   */
  private static milesToMeters(miles: number): number {
    return Math.round(miles * 1609.344);
  }

  /**
   * Convert meters to miles
   */
  private static metersToMiles(meters: number): number {
    return meters / 1609.344;
  }

  /**
   * Get default radii for a location type
   */
  static getDefaultRadii(locationType: LocationType, placeType?: PlaceType): GeofenceRadii {
    if (locationType === 'custom_place') {
      if (placeType === 'home' || placeType === 'work') {
        return {
          approach: this.metersToMiles(this.DEFAULT_RADII.HOME_WORK.approach),
          arrival: this.DEFAULT_RADII.HOME_WORK.arrival,
          postArrival: true
        };
      } else {
        return {
          approach: this.metersToMiles(this.DEFAULT_RADII.CUSTOM_PLACE.approach),
          arrival: this.DEFAULT_RADII.CUSTOM_PLACE.arrival,
          postArrival: true
        };
      }
    } else {
      // POI category
      return {
        approach: this.metersToMiles(this.DEFAULT_RADII.POI_CATEGORY.approach_5mi),
        arrival: this.DEFAULT_RADII.POI_CATEGORY.arrival,
        postArrival: false // POI categories don't use post-arrival by default
      };
    }
  }

  /**
   * Update POI category geofences with actual POI locations
   * This is called when a user is near POIs of a specific category
   */
  static async updatePOIGeofencesWithLocations(
    taskId: string, 
    pois: Array<{ id: string; latitude: number; longitude: number }>
  ): Promise<Geofence[]> {
    // Get existing template geofences for the task
    const existingGeofences = await Geofence.findByTaskId(taskId);
    
    // Remove old POI-specific geofences (those with actual coordinates)
    const templateGeofences = existingGeofences.filter(g => 
      g.latitude === 0 && g.longitude === 0
    );
    
    // Delete non-template geofences
    for (const geofence of existingGeofences) {
      if (geofence.latitude !== 0 || geofence.longitude !== 0) {
        await geofence.delete();
      }
    }

    // Create new geofences for each POI
    const newGeofences: Geofence[] = [];
    
    for (const poi of pois) {
      for (const template of templateGeofences) {
        const geofenceData: CreateGeofenceRequest = {
          task_id: taskId,
          latitude: poi.latitude,
          longitude: poi.longitude,
          radius: template.radius,
          geofence_type: template.geofence_type
        };
        
        const geofence = await Geofence.create(geofenceData);
        newGeofences.push(geofence);
      }
    }

    return newGeofences;
  }

  /**
   * Get nearby POI geofences for a location
   * This helps determine which geofences should be active based on user location
   */
  static async getNearbyPOIGeofences(
    userId: string,
    userLocation: Coordinate,
    radiusKm: number = 50
  ): Promise<{
    taskId: string;
    geofences: Geofence[];
    distance: number;
  }[]> {
    // This would integrate with POI service to find nearby POIs
    // and return relevant geofences for POI category tasks
    
    // For now, return empty array as POI integration is in later tasks
    return [];
  }

  /**
   * Calculate distance between two coordinates in meters
   */
  static calculateDistance(point1: Coordinate, point2: Coordinate): number {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = point1.latitude * Math.PI / 180;
    const lat2Rad = point2.latitude * Math.PI / 180;
    const deltaLatRad = (point2.latitude - point1.latitude) * Math.PI / 180;
    const deltaLonRad = (point2.longitude - point1.longitude) * Math.PI / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Check if a point is within any geofence for a task
   */
  static async checkGeofenceContainment(
    taskId: string,
    location: Coordinate
  ): Promise<{
    contained: boolean;
    geofences: Geofence[];
    distances: number[];
  }> {
    const geofences = await Geofence.findByTaskId(taskId);
    const activeGeofences = geofences.filter(g => g.is_active);
    
    const containedGeofences: Geofence[] = [];
    const distances: number[] = [];
    
    for (const geofence of activeGeofences) {
      const distance = this.calculateDistance(location, geofence.getLocation());
      distances.push(distance);
      
      if (distance <= geofence.radius) {
        containedGeofences.push(geofence);
      }
    }
    
    return {
      contained: containedGeofences.length > 0,
      geofences: containedGeofences,
      distances
    };
  }

  /**
   * Clean up inactive geofences (for maintenance)
   */
  static async cleanupInactiveGeofences(): Promise<number> {
    const { getDatabase } = await import('../database/connection');
    
    // Delete geofences for completed tasks older than 30 days
    const query = `
      DELETE FROM geofences 
      WHERE task_id IN (
        SELECT id FROM tasks 
        WHERE status = 'completed' 
        AND completed_at < NOW() - INTERVAL '30 days'
      )
    `;
    
    const result = await getDatabase().query(query);
    return result.rowCount || 0;
  }
}