import { GeofenceService } from '../geofenceService';
import { Geofence } from '../../models/Geofence';
import { Task } from '../../models/Task';
import { Place } from '../../models/Place';
import { POI } from '../../models/POI';
import { 
  GeofenceType, 
  LocationType, 
  PlaceType, 
  POICategory,
  GeofenceRadii 
} from '../../models/types';

// Mock the models
jest.mock('../../models/Geofence');
jest.mock('../../models/Task');
jest.mock('../../models/Place');
jest.mock('../../models/POI');

const mockGeofence = Geofence as jest.Mocked<typeof Geofence>;
const mockTask = Task as jest.Mocked<typeof Task>;

// Mock Place.findById as a static method
const mockPlace = Place as jest.Mocked<typeof Place>;
mockPlace.findById = jest.fn();

describe('GeofenceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateGeofencesForTask', () => {
    it('should calculate geofences for custom place task', async () => {
      const mockTaskData = {
        id: 'task-1',
        user_id: 'user-1',
        title: 'Buy groceries',
        location_type: 'custom_place' as LocationType,
        place_id: 'place-1',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockPlaceData = {
        id: 'place-1',
        userId: 'user-1',
        name: 'Home',
        latitude: 37.7749,
        longitude: -122.4194,
        placeType: 'home' as PlaceType,
        defaultRadii: {
          approach: 2,
          arrival: 100,
          postArrival: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPlace.findById.mockResolvedValueOnce(mockPlaceData as any);

      const result = await GeofenceService.calculateGeofencesForTask(mockTaskData as any);

      expect(result.geofences).toHaveLength(3); // approach + arrival + post_arrival
      expect(result.totalCount).toBe(3);
      
      // Check geofence types
      const types = result.geofences.map(g => g.geofence_type);
      expect(types).toContain('approach_5mi');
      expect(types).toContain('arrival');
      expect(types).toContain('post_arrival');
    });

    it('should calculate geofences for POI category task', async () => {
      const mockTaskData = {
        id: 'task-1',
        user_id: 'user-1',
        title: 'Get gas',
        location_type: 'poi_category' as LocationType,
        poi_category: 'gas' as POICategory,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = await GeofenceService.calculateGeofencesForTask(mockTaskData as any);

      expect(result.geofences).toHaveLength(4); // 5mi + 3mi + 1mi + arrival
      expect(result.totalCount).toBe(4);
      
      // Check geofence types
      const types = result.geofences.map(g => g.geofence_type);
      expect(types).toContain('approach_5mi');
      expect(types).toContain('approach_3mi');
      expect(types).toContain('approach_1mi');
      expect(types).toContain('arrival');
    });

    it('should throw error for custom place task without place_id', async () => {
      const mockTaskData = {
        id: 'task-1',
        user_id: 'user-1',
        title: 'Buy groceries',
        location_type: 'custom_place' as LocationType,
        // missing place_id
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      await expect(GeofenceService.calculateGeofencesForTask(mockTaskData as any))
        .rejects.toThrow('Place ID required for custom place tasks');
    });

    it('should throw error for POI category task without poi_category', async () => {
      const mockTaskData = {
        id: 'task-1',
        user_id: 'user-1',
        title: 'Get gas',
        location_type: 'poi_category' as LocationType,
        // missing poi_category
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      await expect(GeofenceService.calculateGeofencesForTask(mockTaskData as any))
        .rejects.toThrow('POI category required for category tasks');
    });

    it('should use custom radii when provided', async () => {
      const customRadii: GeofenceRadii = {
        approach: 10, // 10 miles instead of default
        arrival: 200, // 200 meters instead of default
        postArrival: false
      };

      const mockTaskData = {
        id: 'task-1',
        user_id: 'user-1',
        title: 'Buy groceries',
        location_type: 'custom_place' as LocationType,
        place_id: 'place-1',
        custom_radii: customRadii,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockPlaceData = {
        id: 'place-1',
        userId: 'user-1',
        name: 'Store',
        latitude: 37.7749,
        longitude: -122.4194,
        placeType: 'custom' as PlaceType,
        defaultRadii: {
          approach: 5,
          arrival: 100,
          postArrival: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPlace.findById.mockResolvedValueOnce(mockPlaceData as any);

      const result = await GeofenceService.calculateGeofencesForTask(mockTaskData as any);

      // Should have 2 geofences (approach + arrival, no post_arrival due to custom setting)
      expect(result.geofences).toHaveLength(2);
      
      // Check custom radius is applied (10 miles = ~16093 meters)
      const approachGeofence = result.geofences.find(g => g.geofence_type === 'approach_5mi');
      expect(approachGeofence?.radius).toBeCloseTo(16093, -2); // Within 100m
      
      const arrivalGeofence = result.geofences.find(g => g.geofence_type === 'arrival');
      expect(arrivalGeofence?.radius).toBe(200);
    });
  });

  describe('createGeofencesForTask', () => {
    it('should create geofences for active task', async () => {
      const mockTaskData = {
        id: 'task-1',
        user_id: 'user-1',
        title: 'Buy groceries',
        location_type: 'custom_place' as LocationType,
        place_id: 'place-1',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockPlaceData = {
        id: 'place-1',
        userId: 'user-1',
        name: 'Store',
        latitude: 37.7749,
        longitude: -122.4194,
        placeType: 'custom' as PlaceType,
        defaultRadii: {
          approach: 5,
          arrival: 100,
          postArrival: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockCreatedGeofence = {
        id: 'geofence-1',
        task_id: 'task-1',
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 8047,
        geofence_type: 'approach_5mi' as GeofenceType,
        is_active: true,
        created_at: new Date()
      };

      mockPlace.findById.mockResolvedValueOnce(mockPlaceData as any);
      mockGeofence.countActiveByUserId.mockResolvedValueOnce(5);
      mockGeofence.create.mockResolvedValue(mockCreatedGeofence as any);

      const result = await GeofenceService.createGeofencesForTask(mockTaskData as any);

      expect(result).toHaveLength(3); // approach + arrival + post_arrival
      expect(mockGeofence.create).toHaveBeenCalledTimes(3);
    });

    it('should throw error for non-active task', async () => {
      const mockTaskData = {
        id: 'task-1',
        user_id: 'user-1',
        title: 'Buy groceries',
        location_type: 'custom_place' as LocationType,
        place_id: 'place-1',
        status: 'completed', // Not active
        created_at: new Date(),
        updated_at: new Date()
      };

      await expect(GeofenceService.createGeofencesForTask(mockTaskData as any))
        .rejects.toThrow('Can only create geofences for active tasks');
    });

    it('should optimize geofences when approaching limit', async () => {
      const mockTaskData = {
        id: 'task-1',
        user_id: 'user-1',
        title: 'Buy groceries',
        location_type: 'custom_place' as LocationType,
        place_id: 'place-1',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockPlaceData = {
        id: 'place-1',
        userId: 'user-1',
        name: 'Store',
        latitude: 37.7749,
        longitude: -122.4194,
        placeType: 'custom' as PlaceType,
        defaultRadii: {
          approach: 5,
          arrival: 100,
          postArrival: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPlace.findById.mockResolvedValueOnce(mockPlaceData as any);
      mockGeofence.countActiveByUserId.mockResolvedValueOnce(19); // Close to limit of 20
      
      // Mock optimization
      const mockActiveGeofences = Array.from({ length: 19 }, (_, i) => ({
        id: `geofence-${i}`,
        task_id: `task-${i}`,
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 1000,
        geofence_type: 'arrival' as GeofenceType,
        is_active: true,
        created_at: new Date(),
        updateActiveStatus: jest.fn().mockResolvedValue({})
      }));

      mockGeofence.findActiveByUserId.mockResolvedValueOnce(mockActiveGeofences as any);
      mockTask.findById.mockResolvedValue({
        id: 'task-1',
        created_at: new Date()
      } as any);

      const mockCreatedGeofence = {
        id: 'geofence-new',
        task_id: 'task-1',
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 8047,
        geofence_type: 'approach_5mi' as GeofenceType,
        is_active: true,
        created_at: new Date()
      };

      mockGeofence.create.mockResolvedValue(mockCreatedGeofence as any);

      const result = await GeofenceService.createGeofencesForTask(mockTaskData as any);

      expect(mockGeofence.findActiveByUserId).toHaveBeenCalled();
      expect(result).toHaveLength(3);
    });
  });

  describe('validateGeofenceRadii', () => {
    it('should validate valid radii', () => {
      const validRadii: GeofenceRadii = {
        approach: 5,
        arrival: 100,
        postArrival: true
      };

      const errors = GeofenceService.validateGeofenceRadii(validRadii);

      expect(errors).toHaveLength(0);
    });

    it('should reject approach radius too small', () => {
      const invalidRadii: GeofenceRadii = {
        approach: 0.05, // Too small
        arrival: 100,
        postArrival: true
      };

      const errors = GeofenceService.validateGeofenceRadii(invalidRadii);

      expect(errors).toContain('Approach radius must be between 0.1 and 50 miles');
    });

    it('should reject approach radius too large', () => {
      const invalidRadii: GeofenceRadii = {
        approach: 100, // Too large
        arrival: 100,
        postArrival: true
      };

      const errors = GeofenceService.validateGeofenceRadii(invalidRadii);

      expect(errors).toContain('Approach radius must be between 0.1 and 50 miles');
    });

    it('should reject arrival radius too small', () => {
      const invalidRadii: GeofenceRadii = {
        approach: 5,
        arrival: 5, // Too small
        postArrival: true
      };

      const errors = GeofenceService.validateGeofenceRadii(invalidRadii);

      expect(errors).toContain('Arrival radius must be between 10 and 1000 meters');
    });

    it('should reject arrival radius too large', () => {
      const invalidRadii: GeofenceRadii = {
        approach: 5,
        arrival: 2000, // Too large
        postArrival: true
      };

      const errors = GeofenceService.validateGeofenceRadii(invalidRadii);

      expect(errors).toContain('Arrival radius must be between 10 and 1000 meters');
    });
  });

  describe('getDefaultRadii', () => {
    it('should return correct defaults for home/work places', () => {
      const radii = GeofenceService.getDefaultRadii('custom_place', 'home');

      expect(radii.approach).toBeCloseTo(2, 1); // 2 miles
      expect(radii.arrival).toBe(100);
      expect(radii.postArrival).toBe(true);
    });

    it('should return correct defaults for custom places', () => {
      const radii = GeofenceService.getDefaultRadii('custom_place', 'custom');

      expect(radii.approach).toBeCloseTo(5, 1); // 5 miles
      expect(radii.arrival).toBe(100);
      expect(radii.postArrival).toBe(true);
    });

    it('should return correct defaults for POI categories', () => {
      const radii = GeofenceService.getDefaultRadii('poi_category');

      expect(radii.approach).toBeCloseTo(5, 1); // 5 miles
      expect(radii.arrival).toBe(100);
      expect(radii.postArrival).toBe(false); // POI categories don't use post-arrival by default
    });
  });

  describe('updateGeofencesForTask', () => {
    it('should delete old geofences and create new ones for active task', async () => {
      const mockTaskData = {
        id: 'task-1',
        user_id: 'user-1',
        title: 'Buy groceries',
        location_type: 'custom_place' as LocationType,
        place_id: 'place-1',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockPlaceData = {
        id: 'place-1',
        userId: 'user-1',
        name: 'Store',
        latitude: 37.7749,
        longitude: -122.4194,
        placeType: 'custom' as PlaceType,
        defaultRadii: {
          approach: 5,
          arrival: 100,
          postArrival: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPlace.findById.mockResolvedValueOnce(mockPlaceData as any);
      mockGeofence.deleteByTaskId.mockResolvedValueOnce(undefined);
      mockGeofence.countActiveByUserId.mockResolvedValueOnce(5);
      mockGeofence.create.mockResolvedValue({} as any);

      const result = await GeofenceService.updateGeofencesForTask(mockTaskData as any);

      expect(mockGeofence.deleteByTaskId).toHaveBeenCalledWith('task-1');
      expect(result).toHaveLength(3);
    });

    it('should only delete geofences for inactive task', async () => {
      const mockTaskData = {
        id: 'task-1',
        user_id: 'user-1',
        title: 'Buy groceries',
        location_type: 'custom_place' as LocationType,
        place_id: 'place-1',
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockGeofence.deleteByTaskId.mockResolvedValueOnce(undefined);

      const result = await GeofenceService.updateGeofencesForTask(mockTaskData as any);

      expect(mockGeofence.deleteByTaskId).toHaveBeenCalledWith('task-1');
      expect(result).toHaveLength(0);
    });
  });

  describe('removeGeofencesForTask', () => {
    it('should delete all geofences for a task', async () => {
      mockGeofence.deleteByTaskId.mockResolvedValueOnce(undefined);

      await GeofenceService.removeGeofencesForTask('task-1');

      expect(mockGeofence.deleteByTaskId).toHaveBeenCalledWith('task-1');
    });
  });

  describe('deactivateGeofencesForTask', () => {
    it('should deactivate all geofences for a task', async () => {
      mockGeofence.deactivateByTaskId.mockResolvedValueOnce(undefined);

      await GeofenceService.deactivateGeofencesForTask('task-1');

      expect(mockGeofence.deactivateByTaskId).toHaveBeenCalledWith('task-1');
    });
  });

  describe('reactivateGeofencesForTask', () => {
    it('should reactivate all geofences for a task', async () => {
      const mockGeofences = [
        {
          id: 'geofence-1',
          updateActiveStatus: jest.fn().mockResolvedValue({})
        },
        {
          id: 'geofence-2',
          updateActiveStatus: jest.fn().mockResolvedValue({})
        }
      ];

      mockGeofence.findByTaskId.mockResolvedValueOnce(mockGeofences as any);

      await GeofenceService.reactivateGeofencesForTask('task-1');

      expect(mockGeofences[0].updateActiveStatus).toHaveBeenCalledWith(true);
      expect(mockGeofences[1].updateActiveStatus).toHaveBeenCalledWith(true);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two coordinates', () => {
      const point1 = { latitude: 37.7749, longitude: -122.4194 }; // San Francisco
      const point2 = { latitude: 37.7849, longitude: -122.4094 }; // ~1.5km away

      const distance = GeofenceService.calculateDistance(point1, point2);

      expect(distance).toBeGreaterThan(1000); // Should be > 1km
      expect(distance).toBeLessThan(2000);    // Should be < 2km
    });

    it('should return 0 for identical coordinates', () => {
      const point = { latitude: 37.7749, longitude: -122.4194 };

      const distance = GeofenceService.calculateDistance(point, point);

      expect(distance).toBe(0);
    });
  });

  describe('checkGeofenceContainment', () => {
    it('should detect when location is within geofence', async () => {
      const mockGeofences = [
        {
          id: 'geofence-1',
          task_id: 'task-1',
          latitude: 37.7749,
          longitude: -122.4194,
          radius: 1000,
          geofence_type: 'arrival',
          is_active: true,
          getLocation: () => ({ latitude: 37.7749, longitude: -122.4194 })
        }
      ];

      mockGeofence.findByTaskId.mockResolvedValueOnce(mockGeofences as any);

      const testLocation = { latitude: 37.7750, longitude: -122.4195 }; // Very close
      const result = await GeofenceService.checkGeofenceContainment('task-1', testLocation);

      expect(result.contained).toBe(true);
      expect(result.geofences).toHaveLength(1);
      expect(result.distances[0]).toBeLessThan(1000);
    });

    it('should detect when location is outside geofence', async () => {
      const mockGeofences = [
        {
          id: 'geofence-1',
          task_id: 'task-1',
          latitude: 37.7749,
          longitude: -122.4194,
          radius: 100,
          geofence_type: 'arrival',
          is_active: true,
          getLocation: () => ({ latitude: 37.7749, longitude: -122.4194 })
        }
      ];

      mockGeofence.findByTaskId.mockResolvedValueOnce(mockGeofences as any);

      const testLocation = { latitude: 37.7849, longitude: -122.4094 }; // Far away
      const result = await GeofenceService.checkGeofenceContainment('task-1', testLocation);

      expect(result.contained).toBe(false);
      expect(result.geofences).toHaveLength(0);
      expect(result.distances[0]).toBeGreaterThan(100);
    });
  });

  describe('updatePOIGeofencesWithLocations', () => {
    it('should update template geofences with actual POI locations', async () => {
      const mockTemplateGeofences = [
        {
          id: 'template-1',
          task_id: 'task-1',
          latitude: 0,
          longitude: 0,
          radius: 1000,
          geofence_type: 'arrival' as GeofenceType,
          is_active: true,
          delete: jest.fn()
        }
      ];

      const mockPOIs = [
        { id: 'poi-1', latitude: 37.7749, longitude: -122.4194 },
        { id: 'poi-2', latitude: 37.7849, longitude: -122.4094 }
      ];

      mockGeofence.findByTaskId.mockResolvedValueOnce(mockTemplateGeofences as any);
      mockGeofence.create.mockResolvedValue({
        id: 'new-geofence',
        task_id: 'task-1',
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 1000,
        geofence_type: 'arrival'
      } as any);

      const result = await GeofenceService.updatePOIGeofencesWithLocations('task-1', mockPOIs);

      expect(result).toHaveLength(2); // One geofence per POI
      expect(mockGeofence.create).toHaveBeenCalledTimes(2);
    });
  });
});