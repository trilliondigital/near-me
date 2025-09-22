import { PlaceService } from '../placeService';
import { Place } from '../../models/Place';
import { CreatePlaceRequest, UpdatePlaceRequest, Coordinate } from '../../models/types';
import { Pool } from 'pg';

// Mock dependencies
jest.mock('../../models/Place');
jest.mock('../geocodingService');
jest.mock('../poiService');

const MockedPlace = Place as jest.MockedClass<typeof Place>;

describe('PlaceService', () => {
  let placeService: PlaceService;
  let mockDb: jest.Mocked<Pool>;
  let mockGeocodingService: any;
  let mockPOIService: any;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
      connect: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
    } as any;

    mockGeocodingService = {
      reverseGeocode: jest.fn(),
      geocodeAddress: jest.fn(),
    };

    mockPOIService = {};

    placeService = new PlaceService(mockDb);
    (placeService as any).geocodingService = mockGeocodingService;
    (placeService as any).poiService = mockPOIService;

    jest.clearAllMocks();
  });

  describe('createPlace', () => {
    const mockCreateRequest: CreatePlaceRequest = {
      name: 'Test Place',
      latitude: 37.7749,
      longitude: -122.4194,
      address: '123 Test St, San Francisco, CA',
      place_type: 'custom',
    };

    const mockPlaceData = {
      user_id: 'user123',
      name: 'Test Place',
      latitude: 37.7749,
      longitude: -122.4194,
      address: '123 Test St, San Francisco, CA',
      place_type: 'custom',
      default_radii: {
        approach: 5,
        arrival: 100,
        postArrival: true,
      },
    };

    const mockDbResult = {
      rows: [
        {
          id: 'place123',
          user_id: 'user123',
          name: 'Test Place',
          latitude: 37.7749,
          longitude: -122.4194,
          address: '123 Test St, San Francisco, CA',
          place_type: 'custom',
          default_radii: {
            approach: 5,
            arrival: 100,
            postArrival: true,
          },
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    };

    it('should create a place successfully', async () => {
      MockedPlace.fromCreateRequest.mockReturnValue(mockPlaceData);
      mockDb.query.mockResolvedValue(mockDbResult);
      const mockPlace = { toJSON: () => ({ id: 'place123' }) };
      MockedPlace.mockImplementation(() => mockPlace as any);

      const result = await placeService.createPlace('user123', mockCreateRequest);

      expect(MockedPlace.fromCreateRequest).toHaveBeenCalledWith('user123', mockCreateRequest);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO places'),
        expect.arrayContaining([
          'user123',
          'Test Place',
          37.7749,
          -122.4194,
          '123 Test St, San Francisco, CA',
          'custom',
          JSON.stringify(mockPlaceData.default_radii),
        ])
      );
      expect(result).toBe(mockPlace);
    });

    it('should reverse geocode coordinates when no address provided', async () => {
      const requestWithoutAddress = { ...mockCreateRequest, address: undefined };
      const placeDataWithoutAddress = { ...mockPlaceData, address: undefined };

      MockedPlace.fromCreateRequest.mockReturnValue(placeDataWithoutAddress);
      mockGeocodingService.reverseGeocode.mockResolvedValue({
        formattedAddress: 'Reverse Geocoded Address',
      });
      mockDb.query.mockResolvedValue({
        rows: [{ ...mockDbResult.rows[0], address: 'Reverse Geocoded Address' }],
      });

      const mockPlace = { toJSON: () => ({ id: 'place123' }) };
      MockedPlace.mockImplementation(() => mockPlace as any);

      await placeService.createPlace('user123', requestWithoutAddress);

      expect(mockGeocodingService.reverseGeocode).toHaveBeenCalledWith({
        latitude: 37.7749,
        longitude: -122.4194,
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO places'),
        expect.arrayContaining(['Reverse Geocoded Address'])
      );
    });

    it('should handle reverse geocoding failure gracefully', async () => {
      const requestWithoutAddress = { ...mockCreateRequest, address: undefined };
      const placeDataWithoutAddress = { ...mockPlaceData, address: undefined };

      MockedPlace.fromCreateRequest.mockReturnValue(placeDataWithoutAddress);
      mockGeocodingService.reverseGeocode.mockRejectedValue(new Error('Geocoding failed'));
      mockDb.query.mockResolvedValue(mockDbResult);

      const mockPlace = { toJSON: () => ({ id: 'place123' }) };
      MockedPlace.mockImplementation(() => mockPlace as any);

      await placeService.createPlace('user123', requestWithoutAddress);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO places'),
        expect.arrayContaining([undefined]) // address should be undefined
      );
    });

    it('should handle database errors', async () => {
      MockedPlace.fromCreateRequest.mockReturnValue(mockPlaceData);
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(placeService.createPlace('user123', mockCreateRequest)).rejects.toThrow(
        'Failed to create place'
      );
    });
  });

  describe('getPlaceById', () => {
    const mockDbResult = {
      rows: [
        {
          id: 'place123',
          user_id: 'user123',
          name: 'Test Place',
          latitude: '37.7749',
          longitude: '-122.4194',
          address: '123 Test St',
          place_type: 'custom',
          default_radii: { approach: 5, arrival: 100, postArrival: true },
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    };

    it('should get place by ID successfully', async () => {
      mockDb.query.mockResolvedValue(mockDbResult);
      const mockPlace = { id: 'place123' };
      MockedPlace.mockImplementation(() => mockPlace as any);

      const result = await placeService.getPlaceById('place123', 'user123');

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM places WHERE id = $1 AND user_id = $2',
        ['place123', 'user123']
      );
      expect(result).toBe(mockPlace);
    });

    it('should return null when place not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await placeService.getPlaceById('nonexistent', 'user123');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(placeService.getPlaceById('place123', 'user123')).rejects.toThrow(
        'Failed to get place'
      );
    });
  });

  describe('getUserPlaces', () => {
    it('should get all user places', async () => {
      const mockDbResult = {
        rows: [
          {
            id: 'place1',
            user_id: 'user123',
            name: 'Place 1',
            latitude: '37.7749',
            longitude: '-122.4194',
            place_type: 'home',
            default_radii: { approach: 2, arrival: 100, postArrival: true },
            created_at: new Date(),
            updated_at: new Date(),
          },
          {
            id: 'place2',
            user_id: 'user123',
            name: 'Place 2',
            latitude: '40.7128',
            longitude: '-74.0060',
            place_type: 'work',
            default_radii: { approach: 2, arrival: 100, postArrival: true },
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      };

      mockDb.query.mockResolvedValue(mockDbResult);
      MockedPlace.mockImplementation((entity) => ({ id: entity.id } as any));

      const result = await placeService.getUserPlaces('user123');

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM places WHERE user_id = $1 ORDER BY created_at DESC',
        ['user123']
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('place1');
      expect(result[1].id).toBe('place2');
    });
  });

  describe('updatePlace', () => {
    const mockUpdateRequest: UpdatePlaceRequest = {
      name: 'Updated Place',
      latitude: 40.7128,
    };

    it('should update place successfully', async () => {
      const mockUpdates = { name: 'Updated Place', latitude: 40.7128 };
      MockedPlace.fromUpdateRequest.mockReturnValue(mockUpdates);

      const mockDbResult = {
        rows: [
          {
            id: 'place123',
            user_id: 'user123',
            name: 'Updated Place',
            latitude: '40.7128',
            longitude: '-122.4194',
            place_type: 'custom',
            default_radii: { approach: 5, arrival: 100, postArrival: true },
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      };

      mockDb.query.mockResolvedValue(mockDbResult);
      const mockPlace = { id: 'place123' };
      MockedPlace.mockImplementation(() => mockPlace as any);

      const result = await placeService.updatePlace('place123', 'user123', mockUpdateRequest);

      expect(MockedPlace.fromUpdateRequest).toHaveBeenCalledWith(mockUpdateRequest);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE places'),
        expect.arrayContaining(['place123', 'user123', 'Updated Place', 40.7128])
      );
      expect(result).toBe(mockPlace);
    });

    it('should return null when place not found', async () => {
      MockedPlace.fromUpdateRequest.mockReturnValue({ name: 'Updated' });
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await placeService.updatePlace('nonexistent', 'user123', mockUpdateRequest);

      expect(result).toBeNull();
    });

    it('should return current place when no updates provided', async () => {
      MockedPlace.fromUpdateRequest.mockReturnValue({});
      
      const mockPlace = { id: 'place123' };
      const getPlaceByIdSpy = jest.spyOn(placeService, 'getPlaceById').mockResolvedValue(mockPlace as any);

      const result = await placeService.updatePlace('place123', 'user123', {});

      expect(getPlaceByIdSpy).toHaveBeenCalledWith('place123', 'user123');
      expect(result).toBe(mockPlace);
    });
  });

  describe('deletePlace', () => {
    it('should delete place successfully', async () => {
      // Mock task check query
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // No active tasks
        .mockResolvedValueOnce({ rowCount: 1 }); // Delete successful

      const result = await placeService.deletePlace('place123', 'user123');

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM tasks WHERE place_id = $1 AND user_id = $2 AND status = $3',
        ['place123', 'user123', 'active']
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM places WHERE id = $1 AND user_id = $2',
        ['place123', 'user123']
      );
      expect(result).toBe(true);
    });

    it('should prevent deletion when place has active tasks', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [{ count: '2' }] }); // Has active tasks

      await expect(placeService.deletePlace('place123', 'user123')).rejects.toThrow(
        'Cannot delete place with active tasks'
      );
    });

    it('should return false when place not found', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // No active tasks
        .mockResolvedValueOnce({ rowCount: 0 }); // Delete failed (not found)

      const result = await placeService.deletePlace('nonexistent', 'user123');

      expect(result).toBe(false);
    });
  });

  describe('searchPlaces', () => {
    it('should search places by name and address', async () => {
      const mockDbResult = {
        rows: [
          {
            id: 'place1',
            user_id: 'user123',
            name: 'Test Place',
            latitude: '37.7749',
            longitude: '-122.4194',
            place_type: 'custom',
            default_radii: { approach: 5, arrival: 100, postArrival: true },
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      };

      mockDb.query.mockResolvedValue(mockDbResult);
      MockedPlace.mockImplementation(() => ({ id: 'place1' } as any));

      const result = await placeService.searchPlaces('user123', 'test');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('name ILIKE $2 OR address ILIKE $2'),
        ['user123', '%test%']
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findNearbyPlaces', () => {
    it('should find places near a coordinate', async () => {
      const coordinate: Coordinate = { latitude: 37.7749, longitude: -122.4194 };
      const mockDbResult = {
        rows: [
          {
            id: 'place1',
            user_id: 'user123',
            name: 'Nearby Place',
            latitude: '37.7750',
            longitude: '-122.4195',
            place_type: 'custom',
            default_radii: { approach: 5, arrival: 100, postArrival: true },
            created_at: new Date(),
            updated_at: new Date(),
            distance: 0.1,
          },
        ],
      };

      mockDb.query.mockResolvedValue(mockDbResult);
      MockedPlace.mockImplementation(() => ({ id: 'place1' } as any));

      const result = await placeService.findNearbyPlaces('user123', coordinate, 5);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('3959 * acos'),
        ['user123', 37.7749, -122.4194, 5]
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('createPlaceFromAddress', () => {
    it('should create place from address using geocoding', async () => {
      const mockGeocodingResult = {
        coordinate: { latitude: 37.7749, longitude: -122.4194 },
        formattedAddress: '123 Test St, San Francisco, CA 94102, USA',
      };

      mockGeocodingService.geocodeAddress.mockResolvedValue(mockGeocodingResult);

      const mockPlace = { id: 'place123' };
      const createPlaceSpy = jest.spyOn(placeService, 'createPlace').mockResolvedValue(mockPlace as any);

      const result = await placeService.createPlaceFromAddress(
        'user123',
        'Test Place',
        '123 Test St, San Francisco, CA',
        'custom'
      );

      expect(mockGeocodingService.geocodeAddress).toHaveBeenCalledWith('123 Test St, San Francisco, CA');
      expect(createPlaceSpy).toHaveBeenCalledWith('user123', {
        name: 'Test Place',
        latitude: 37.7749,
        longitude: -122.4194,
        address: '123 Test St, San Francisco, CA 94102, USA',
        place_type: 'custom',
      });
      expect(result).toBe(mockPlace);
    });

    it('should throw error when geocoding fails', async () => {
      mockGeocodingService.geocodeAddress.mockResolvedValue(null);

      await expect(
        placeService.createPlaceFromAddress('user123', 'Test Place', 'Invalid Address')
      ).rejects.toThrow('Could not geocode the provided address');
    });
  });

  describe('getPlaceStats', () => {
    it('should return place statistics', async () => {
      const mockDbResult = {
        rows: [
          {
            total_places: '5',
            home_places: '1',
            work_places: '1',
            custom_places: '3',
            places_with_active_tasks: '2',
          },
        ],
      };

      mockDb.query.mockResolvedValue(mockDbResult);

      const result = await placeService.getPlaceStats('user123');

      expect(result).toEqual({
        totalPlaces: 5,
        placesByType: {
          home: 1,
          work: 1,
          custom: 3,
        },
        placesWithActiveTasks: 2,
      });
    });
  });
});