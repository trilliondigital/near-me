import { Place } from '../Place';
import { PlaceEntity, CreatePlaceRequest, UpdatePlaceRequest, PlaceType } from '../types';

describe('Place Model', () => {
  const mockPlaceEntity: PlaceEntity = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    user_id: '123e4567-e89b-12d3-a456-426614174001',
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
    created_at: new Date('2023-01-01T00:00:00Z'),
    updated_at: new Date('2023-01-01T00:00:00Z'),
  };

  describe('constructor', () => {
    it('should create a Place instance from PlaceEntity', () => {
      const place = new Place(mockPlaceEntity);

      expect(place.id).toBe(mockPlaceEntity.id);
      expect(place.userId).toBe(mockPlaceEntity.user_id);
      expect(place.name).toBe(mockPlaceEntity.name);
      expect(place.latitude).toBe(mockPlaceEntity.latitude);
      expect(place.longitude).toBe(mockPlaceEntity.longitude);
      expect(place.address).toBe(mockPlaceEntity.address);
      expect(place.placeType).toBe(mockPlaceEntity.place_type);
      expect(place.defaultRadii).toEqual(mockPlaceEntity.default_radii);
      expect(place.createdAt).toBe(mockPlaceEntity.created_at);
      expect(place.updatedAt).toBe(mockPlaceEntity.updated_at);
    });
  });

  describe('fromCreateRequest', () => {
    it('should create place data from valid CreatePlaceRequest', () => {
      const createRequest: CreatePlaceRequest = {
        name: 'New Place',
        latitude: 40.7128,
        longitude: -74.0060,
        address: '123 Main St, New York, NY',
        place_type: 'home',
      };

      const placeData = Place.fromCreateRequest('user123', createRequest);

      expect(placeData.user_id).toBe('user123');
      expect(placeData.name).toBe(createRequest.name);
      expect(placeData.latitude).toBe(createRequest.latitude);
      expect(placeData.longitude).toBe(createRequest.longitude);
      expect(placeData.address).toBe(createRequest.address);
      expect(placeData.place_type).toBe(createRequest.place_type);
      expect(placeData.default_radii).toEqual({
        approach: 2,
        arrival: 100,
        postArrival: true,
      });
    });

    it('should use custom radii when provided', () => {
      const createRequest: CreatePlaceRequest = {
        name: 'Custom Place',
        latitude: 40.7128,
        longitude: -74.0060,
        place_type: 'custom',
        default_radii: {
          approach: 10,
          arrival: 200,
          postArrival: false,
        },
      };

      const placeData = Place.fromCreateRequest('user123', createRequest);

      expect(placeData.default_radii).toEqual(createRequest.default_radii);
    });

    it('should throw error for invalid place data', () => {
      const invalidRequest = {
        name: '', // Invalid: empty name
        latitude: 40.7128,
        longitude: -74.0060,
        place_type: 'custom',
      };

      expect(() => {
        Place.fromCreateRequest('user123', invalidRequest as CreatePlaceRequest);
      }).toThrow('Invalid place data');
    });
  });

  describe('fromUpdateRequest', () => {
    it('should create update data from valid UpdatePlaceRequest', () => {
      const updateRequest: UpdatePlaceRequest = {
        name: 'Updated Place',
        latitude: 41.8781,
        longitude: -87.6298,
      };

      const updateData = Place.fromUpdateRequest(updateRequest);

      expect(updateData.name).toBe(updateRequest.name);
      expect(updateData.latitude).toBe(updateRequest.latitude);
      expect(updateData.longitude).toBe(updateRequest.longitude);
      expect(updateData.address).toBeUndefined();
      expect(updateData.place_type).toBeUndefined();
    });

    it('should return empty object for empty update request', () => {
      const updateData = Place.fromUpdateRequest({});
      expect(Object.keys(updateData)).toHaveLength(0);
    });

    it('should throw error for invalid update data', () => {
      const invalidRequest = {
        latitude: 200, // Invalid: out of range
      };

      expect(() => {
        Place.fromUpdateRequest(invalidRequest as UpdatePlaceRequest);
      }).toThrow('Invalid place update data');
    });
  });

  describe('getDefaultRadiiForType', () => {
    it('should return correct radii for home place type', () => {
      const radii = Place.getDefaultRadiiForType('home');
      expect(radii).toEqual({
        approach: 2,
        arrival: 100,
        postArrival: true,
      });
    });

    it('should return correct radii for work place type', () => {
      const radii = Place.getDefaultRadiiForType('work');
      expect(radii).toEqual({
        approach: 2,
        arrival: 100,
        postArrival: true,
      });
    });

    it('should return correct radii for custom place type', () => {
      const radii = Place.getDefaultRadiiForType('custom');
      expect(radii).toEqual({
        approach: 5,
        arrival: 100,
        postArrival: true,
      });
    });
  });

  describe('toJSON', () => {
    it('should return JSON representation of place', () => {
      const place = new Place(mockPlaceEntity);
      const json = place.toJSON();

      expect(json).toEqual({
        id: mockPlaceEntity.id,
        userId: mockPlaceEntity.user_id,
        name: mockPlaceEntity.name,
        latitude: mockPlaceEntity.latitude,
        longitude: mockPlaceEntity.longitude,
        address: mockPlaceEntity.address,
        placeType: mockPlaceEntity.place_type,
        defaultRadii: mockPlaceEntity.default_radii,
        createdAt: mockPlaceEntity.created_at,
        updatedAt: mockPlaceEntity.updated_at,
      });
    });
  });

  describe('getCoordinate', () => {
    it('should return coordinate object', () => {
      const place = new Place(mockPlaceEntity);
      const coordinate = place.getCoordinate();

      expect(coordinate).toEqual({
        latitude: mockPlaceEntity.latitude,
        longitude: mockPlaceEntity.longitude,
      });
    });
  });

  describe('distanceTo', () => {
    it('should calculate distance between two coordinates', () => {
      const place = new Place(mockPlaceEntity);
      const otherCoordinate = {
        latitude: 40.7128, // New York
        longitude: -74.0060,
      };

      const distance = place.distanceTo(otherCoordinate);

      // Distance between San Francisco and New York is approximately 2570 miles
      expect(distance).toBeGreaterThan(2500);
      expect(distance).toBeLessThan(2600);
    });

    it('should return 0 for same coordinates', () => {
      const place = new Place(mockPlaceEntity);
      const sameCoordinate = {
        latitude: mockPlaceEntity.latitude,
        longitude: mockPlaceEntity.longitude,
      };

      const distance = place.distanceTo(sameCoordinate);
      expect(distance).toBeCloseTo(0, 5);
    });

    it('should calculate short distances accurately', () => {
      const place = new Place(mockPlaceEntity);
      const nearbyCoordinate = {
        latitude: mockPlaceEntity.latitude + 0.01, // About 0.7 miles north
        longitude: mockPlaceEntity.longitude,
      };

      const distance = place.distanceTo(nearbyCoordinate);
      expect(distance).toBeGreaterThan(0.6);
      expect(distance).toBeLessThan(0.8);
    });
  });
});