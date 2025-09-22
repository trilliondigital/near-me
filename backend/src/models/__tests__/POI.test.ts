import { POI } from '../POI';
import { POIEntity, CreatePOIRequest, POICategory } from '../types';

describe('POI Model', () => {
  const mockPOIEntity: POIEntity = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    external_id: 'foursquare_12345',
    name: 'Test Gas Station',
    category: 'gas',
    latitude: 37.7749,
    longitude: -122.4194,
    address: '123 Test St, San Francisco, CA',
    verified: true,
    source: 'foursquare',
    last_updated: new Date('2023-01-01T00:00:00Z'),
  };

  describe('constructor', () => {
    it('should create a POI instance from POIEntity', () => {
      const poi = new POI(mockPOIEntity);

      expect(poi.id).toBe(mockPOIEntity.id);
      expect(poi.externalId).toBe(mockPOIEntity.external_id);
      expect(poi.name).toBe(mockPOIEntity.name);
      expect(poi.category).toBe(mockPOIEntity.category);
      expect(poi.latitude).toBe(mockPOIEntity.latitude);
      expect(poi.longitude).toBe(mockPOIEntity.longitude);
      expect(poi.address).toBe(mockPOIEntity.address);
      expect(poi.verified).toBe(mockPOIEntity.verified);
      expect(poi.source).toBe(mockPOIEntity.source);
      expect(poi.lastUpdated).toBe(mockPOIEntity.last_updated);
    });
  });

  describe('fromCreateRequest', () => {
    it('should create POI data from valid CreatePOIRequest', () => {
      const createRequest: CreatePOIRequest = {
        external_id: 'google_abc123',
        name: 'Test Pharmacy',
        category: 'pharmacy',
        latitude: 40.7128,
        longitude: -74.0060,
        address: '456 Main St, New York, NY',
        verified: true,
        source: 'google_places',
      };

      const poiData = POI.fromCreateRequest(createRequest);

      expect(poiData.external_id).toBe(createRequest.external_id);
      expect(poiData.name).toBe(createRequest.name);
      expect(poiData.category).toBe(createRequest.category);
      expect(poiData.latitude).toBe(createRequest.latitude);
      expect(poiData.longitude).toBe(createRequest.longitude);
      expect(poiData.address).toBe(createRequest.address);
      expect(poiData.verified).toBe(createRequest.verified);
      expect(poiData.source).toBe(createRequest.source);
    });

    it('should default verified to false when not provided', () => {
      const createRequest: CreatePOIRequest = {
        name: 'Test Bank',
        category: 'bank',
        latitude: 40.7128,
        longitude: -74.0060,
        source: 'manual',
      };

      const poiData = POI.fromCreateRequest(createRequest);
      expect(poiData.verified).toBe(false);
    });

    it('should throw error for invalid POI data', () => {
      const invalidRequest = {
        name: '', // Invalid: empty name
        category: 'gas',
        latitude: 40.7128,
        longitude: -74.0060,
        source: 'test',
      };

      expect(() => {
        POI.fromCreateRequest(invalidRequest as CreatePOIRequest);
      }).toThrow('Invalid POI data');
    });
  });

  describe('toJSON', () => {
    it('should return JSON representation of POI', () => {
      const poi = new POI(mockPOIEntity);
      const json = poi.toJSON();

      expect(json).toEqual({
        id: mockPOIEntity.id,
        externalId: mockPOIEntity.external_id,
        name: mockPOIEntity.name,
        category: mockPOIEntity.category,
        latitude: mockPOIEntity.latitude,
        longitude: mockPOIEntity.longitude,
        address: mockPOIEntity.address,
        verified: mockPOIEntity.verified,
        source: mockPOIEntity.source,
        lastUpdated: mockPOIEntity.last_updated,
      });
    });
  });

  describe('getCoordinate', () => {
    it('should return coordinate object', () => {
      const poi = new POI(mockPOIEntity);
      const coordinate = poi.getCoordinate();

      expect(coordinate).toEqual({
        latitude: mockPOIEntity.latitude,
        longitude: mockPOIEntity.longitude,
      });
    });
  });

  describe('distanceTo', () => {
    it('should calculate distance between POI and coordinate', () => {
      const poi = new POI(mockPOIEntity);
      const coordinate = {
        latitude: 40.7128, // New York
        longitude: -74.0060,
      };

      const distance = poi.distanceTo(coordinate);

      // Distance between San Francisco and New York is approximately 2570 miles
      expect(distance).toBeGreaterThan(2500);
      expect(distance).toBeLessThan(2600);
    });

    it('should return 0 for same coordinates', () => {
      const poi = new POI(mockPOIEntity);
      const sameCoordinate = {
        latitude: mockPOIEntity.latitude,
        longitude: mockPOIEntity.longitude,
      };

      const distance = poi.distanceTo(sameCoordinate);
      expect(distance).toBeCloseTo(0, 5);
    });
  });

  describe('getCategoryDisplayName', () => {
    it('should return correct display names for all categories', () => {
      expect(POI.getCategoryDisplayName('gas')).toBe('Gas Station');
      expect(POI.getCategoryDisplayName('pharmacy')).toBe('Pharmacy');
      expect(POI.getCategoryDisplayName('grocery')).toBe('Grocery Store');
      expect(POI.getCategoryDisplayName('bank')).toBe('Bank');
      expect(POI.getCategoryDisplayName('post_office')).toBe('Post Office');
    });
  });

  describe('getAllCategories', () => {
    it('should return all supported categories', () => {
      const categories = POI.getAllCategories();
      expect(categories).toEqual(['gas', 'pharmacy', 'grocery', 'bank', 'post_office']);
    });
  });

  describe('isValidCategory', () => {
    it('should return true for valid categories', () => {
      expect(POI.isValidCategory('gas')).toBe(true);
      expect(POI.isValidCategory('pharmacy')).toBe(true);
      expect(POI.isValidCategory('grocery')).toBe(true);
      expect(POI.isValidCategory('bank')).toBe(true);
      expect(POI.isValidCategory('post_office')).toBe(true);
    });

    it('should return false for invalid categories', () => {
      expect(POI.isValidCategory('restaurant')).toBe(false);
      expect(POI.isValidCategory('hospital')).toBe(false);
      expect(POI.isValidCategory('')).toBe(false);
      expect(POI.isValidCategory('invalid')).toBe(false);
    });

    it('should handle case sensitivity', () => {
      expect(POI.isValidCategory('GAS')).toBe(false);
      expect(POI.isValidCategory('Gas')).toBe(false);
      expect(POI.isValidCategory('PHARMACY')).toBe(false);
    });
  });
});