import { Geofence } from '../Geofence';
import { Task } from '../Task';
import { User } from '../User';
import { Place } from '../Place';
import { getDatabase } from '../../database/connection';
import { CreateGeofenceRequest, GeofenceType } from '../types';

// Mock the database connection
jest.mock('../../database/connection');
const mockGetDatabase = getDatabase as jest.MockedFunction<typeof getDatabase>;
const mockPool = {
  query: jest.fn()
} as any;

describe('Geofence Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDatabase.mockReturnValue(mockPool);
  });

  describe('create', () => {
    it('should create a geofence with valid data', async () => {
      const mockGeofenceData = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        task_id: '550e8400-e29b-41d4-a716-446655440000',
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 1000,
        geofence_type: 'arrival' as GeofenceType,
        is_active: true,
        created_at: new Date()
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockGeofenceData],
        rowCount: 1,
        command: 'INSERT',
        oid: 0,
        fields: []
      });

      const createData: CreateGeofenceRequest = {
        task_id: '550e8400-e29b-41d4-a716-446655440000',
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 1000,
        geofence_type: 'arrival'
      };

      const geofence = await Geofence.create(createData);

      expect(geofence).toBeInstanceOf(Geofence);
      expect(geofence.task_id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(geofence.latitude).toBe(37.7749);
      expect(geofence.longitude).toBe(-122.4194);
      expect(geofence.radius).toBe(1000);
      expect(geofence.geofence_type).toBe('arrival');
      expect(geofence.is_active).toBe(true);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 1000,
        geofence_type: 'arrival' as GeofenceType
        // missing task_id
      } as CreateGeofenceRequest;

      await expect(Geofence.create(invalidData)).rejects.toThrow('task_id');
    });

    it('should validate latitude range', async () => {
      const invalidData: CreateGeofenceRequest = {
        task_id: '550e8400-e29b-41d4-a716-446655440000',
        latitude: 91, // Invalid latitude
        longitude: -122.4194,
        radius: 1000,
        geofence_type: 'arrival'
      };

      await expect(Geofence.create(invalidData)).rejects.toThrow('latitude');
    });

    it('should validate longitude range', async () => {
      const invalidData: CreateGeofenceRequest = {
        task_id: '550e8400-e29b-41d4-a716-446655440000',
        latitude: 37.7749,
        longitude: 181, // Invalid longitude
        radius: 1000,
        geofence_type: 'arrival'
      };

      await expect(Geofence.create(invalidData)).rejects.toThrow('longitude');
    });

    it('should validate radius range', async () => {
      const invalidData: CreateGeofenceRequest = {
        task_id: '550e8400-e29b-41d4-a716-446655440000',
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 0, // Invalid radius
        geofence_type: 'arrival'
      };

      await expect(Geofence.create(invalidData)).rejects.toThrow('radius');
    });

    it('should validate geofence type', async () => {
      const invalidData: CreateGeofenceRequest = {
        task_id: '550e8400-e29b-41d4-a716-446655440000',
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 1000,
        geofence_type: 'invalid_type' as GeofenceType
      };

      await expect(Geofence.create(invalidData)).rejects.toThrow('geofence_type');
    });
  });

  describe('findById', () => {
    it('should find geofence by ID', async () => {
      const mockGeofenceData = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        task_id: '550e8400-e29b-41d4-a716-446655440000',
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 1000,
        geofence_type: 'arrival',
        is_active: true,
        created_at: new Date()
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockGeofenceData],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const geofence = await Geofence.findById('550e8400-e29b-41d4-a716-446655440001');

      expect(geofence).toBeInstanceOf(Geofence);
      expect(geofence?.id).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    it('should return null if geofence not found', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const geofence = await Geofence.findById('nonexistent');

      expect(geofence).toBeNull();
    });
  });

  describe('findByTaskId', () => {
    it('should find all geofences for a task', async () => {
      const mockGeofences = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          task_id: '550e8400-e29b-41d4-a716-446655440000',
          latitude: 37.7749,
          longitude: -122.4194,
          radius: 8047,
          geofence_type: 'approach_5mi',
          is_active: true,
          created_at: new Date()
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          task_id: '550e8400-e29b-41d4-a716-446655440000',
          latitude: 37.7749,
          longitude: -122.4194,
          radius: 100,
          geofence_type: 'arrival',
          is_active: true,
          created_at: new Date()
        }
      ];

      mockPool.query.mockResolvedValueOnce({
        rows: mockGeofences,
        rowCount: 2,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const geofences = await Geofence.findByTaskId('550e8400-e29b-41d4-a716-446655440000');

      expect(geofences).toHaveLength(2);
      expect(geofences[0].geofence_type).toBe('approach_5mi');
      expect(geofences[1].geofence_type).toBe('arrival');
    });
  });

  describe('findActiveByUserId', () => {
    it('should find active geofences for a user', async () => {
      const mockGeofences = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          task_id: '550e8400-e29b-41d4-a716-446655440000',
          latitude: 37.7749,
          longitude: -122.4194,
          radius: 1000,
          geofence_type: 'arrival',
          is_active: true,
          created_at: new Date()
        }
      ];

      mockPool.query.mockResolvedValueOnce({
        rows: mockGeofences,
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const geofences = await Geofence.findActiveByUserId('550e8400-e29b-41d4-a716-446655440003');

      expect(geofences).toHaveLength(1);
      expect(geofences[0].is_active).toBe(true);
    });
  });

  describe('countActiveByUserId', () => {
    it('should count active geofences for a user', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ count: '5' }],
        rowCount: 1,
        command: 'SELECT',
        oid: 0,
        fields: []
      });

      const count = await Geofence.countActiveByUserId('550e8400-e29b-41d4-a716-446655440003');

      expect(count).toBe(5);
    });
  });

  describe('updateActiveStatus', () => {
    it('should update geofence active status', async () => {
      const mockGeofenceData = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        task_id: '550e8400-e29b-41d4-a716-446655440000',
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 1000,
        geofence_type: 'arrival',
        is_active: false,
        created_at: new Date()
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockGeofenceData],
        rowCount: 1,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      const geofence = new Geofence({
        ...mockGeofenceData,
        is_active: true,
        geofence_type: 'arrival' as GeofenceType
      });

      const updatedGeofence = await geofence.updateActiveStatus(false);

      expect(updatedGeofence.is_active).toBe(false);
    });
  });

  describe('containsPoint', () => {
    it('should return true if point is within geofence', () => {
      const geofence = new Geofence({
        id: '550e8400-e29b-41d4-a716-446655440001',
        task_id: '550e8400-e29b-41d4-a716-446655440000',
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 1000, // 1km radius
        geofence_type: 'arrival',
        is_active: true,
        created_at: new Date()
      });

      // Point very close to center (should be within 1km)
      const nearbyPoint = {
        latitude: 37.7750,
        longitude: -122.4195
      };

      expect(geofence.containsPoint(nearbyPoint)).toBe(true);
    });

    it('should return false if point is outside geofence', () => {
      const geofence = new Geofence({
        id: '550e8400-e29b-41d4-a716-446655440001',
        task_id: '550e8400-e29b-41d4-a716-446655440000',
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 100, // 100m radius
        geofence_type: 'arrival',
        is_active: true,
        created_at: new Date()
      });

      // Point far from center (should be outside 100m)
      const farPoint = {
        latitude: 37.7849, // ~1km north
        longitude: -122.4194
      };

      expect(geofence.containsPoint(farPoint)).toBe(false);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between geofence center and point', () => {
      const geofence = new Geofence({
        id: '550e8400-e29b-41d4-a716-446655440001',
        task_id: '550e8400-e29b-41d4-a716-446655440000',
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 1000,
        geofence_type: 'arrival',
        is_active: true,
        created_at: new Date()
      });

      const point = {
        latitude: 37.7749,
        longitude: -122.4194
      };

      const distance = geofence.calculateDistance(point);

      // Distance to same point should be 0
      expect(distance).toBeCloseTo(0, 1);
    });

    it('should calculate distance accurately', () => {
      const geofence = new Geofence({
        id: '550e8400-e29b-41d4-a716-446655440001',
        task_id: '550e8400-e29b-41d4-a716-446655440000',
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 1000,
        geofence_type: 'arrival',
        is_active: true,
        created_at: new Date()
      });

      // Point approximately 1km north
      const point = {
        latitude: 37.7839,
        longitude: -122.4194
      };

      const distance = geofence.calculateDistance(point);

      // Should be approximately 1000 meters
      expect(distance).toBeGreaterThan(900);
      expect(distance).toBeLessThan(1100);
    });
  });

  describe('deleteByTaskId', () => {
    it('should delete all geofences for a task', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 2,
        command: 'DELETE',
        oid: 0,
        fields: []
      });

      await Geofence.deleteByTaskId('550e8400-e29b-41d4-a716-446655440000');

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM geofences WHERE task_id = $1',
        ['550e8400-e29b-41d4-a716-446655440000']
      );
    });
  });

  describe('deactivateByTaskId', () => {
    it('should deactivate all geofences for a task', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 2,
        command: 'UPDATE',
        oid: 0,
        fields: []
      });

      await Geofence.deactivateByTaskId('550e8400-e29b-41d4-a716-446655440000');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE geofences'),
        ['550e8400-e29b-41d4-a716-446655440000']
      );
    });
  });
});