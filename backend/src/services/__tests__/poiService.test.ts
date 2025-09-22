import { POIService, ExternalPOI, POISearchOptions } from '../poiService';
import { POICategory, Coordinate } from '../../models/types';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock GeocodingService
jest.mock('../geocodingService', () => ({
  GeocodingService: {
    calculateDistance: jest.fn((coord1, coord2) => {
      // Simple mock distance calculation
      const latDiff = Math.abs(coord1.latitude - coord2.latitude);
      const lngDiff = Math.abs(coord1.longitude - coord2.longitude);
      return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 69; // Rough miles conversion
    }),
  },
}));

describe('POIService', () => {
  let poiService: POIService;

  beforeEach(() => {
    process.env.FOURSQUARE_API_KEY = 'test-foursquare-key';
    process.env.GOOGLE_PLACES_API_KEY = 'test-google-key';
    poiService = new POIService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.FOURSQUARE_API_KEY;
    delete process.env.GOOGLE_PLACES_API_KEY;
  });

  describe('searchNearbyPOIs', () => {
    const mockSearchOptions: POISearchOptions = {
      coordinate: { latitude: 37.7749, longitude: -122.4194 },
      category: 'gas',
      radius: 5,
      limit: 10,
    };

    it('should search Foursquare POIs successfully', async () => {
      const mockFoursquareResponse = {
        data: {
          results: [
            {
              fsq_id: 'test123',
              name: 'Test Gas Station',
              categories: [{ id: '17069' }],
              geocodes: {
                main: {
                  latitude: 37.7849,
                  longitude: -122.4094,
                },
              },
              location: {
                formatted_address: '123 Test St, San Francisco, CA',
              },
              verified: true,
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockFoursquareResponse);

      const result = await poiService.searchNearbyPOIs(mockSearchOptions);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'foursquare_test123',
        name: 'Test Gas Station',
        category: 'gas',
        coordinate: {
          latitude: 37.7849,
          longitude: -122.4094,
        },
        address: '123 Test St, San Francisco, CA',
        verified: true,
        source: 'foursquare',
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.foursquare.com/v3/places/search',
        expect.objectContaining({
          headers: {
            Authorization: 'test-foursquare-key',
            Accept: 'application/json',
          },
          params: expect.objectContaining({
            ll: '37.7749,-122.4194',
            radius: 8047, // 5 miles in meters
            limit: 10,
            categories: '17069',
          }),
        })
      );
    });

    it('should fallback to Google Places when Foursquare fails', async () => {
      // Foursquare fails
      mockedAxios.get.mockRejectedValueOnce(new Error('Foursquare API Error'));

      // Google Places succeeds
      const mockGoogleResponse = {
        data: {
          status: 'OK',
          results: [
            {
              place_id: 'google123',
              name: 'Test Gas Station',
              types: ['gas_station'],
              geometry: {
                location: {
                  lat: 37.7849,
                  lng: -122.4094,
                },
              },
              vicinity: '123 Test St, San Francisco',
              business_status: 'OPERATIONAL',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockGoogleResponse);

      const result = await poiService.searchNearbyPOIs(mockSearchOptions);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'google_google123',
        name: 'Test Gas Station',
        category: 'gas',
        coordinate: {
          latitude: 37.7849,
          longitude: -122.4094,
        },
        address: '123 Test St, San Francisco',
        verified: true,
        source: 'google_places',
      });

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should search without category filter', async () => {
      const optionsWithoutCategory = {
        ...mockSearchOptions,
        category: undefined,
      };

      const mockResponse = {
        data: {
          results: [],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      await poiService.searchNearbyPOIs(optionsWithoutCategory);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.foursquare.com/v3/places/search',
        expect.objectContaining({
          params: expect.not.objectContaining({
            categories: expect.anything(),
          }),
        })
      );
    });

    it('should sort results by distance and apply limit', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              fsq_id: 'far123',
              name: 'Far Gas Station',
              categories: [{ id: '17069' }],
              geocodes: {
                main: {
                  latitude: 38.0000, // Further away
                  longitude: -122.0000,
                },
              },
            },
            {
              fsq_id: 'near123',
              name: 'Near Gas Station',
              categories: [{ id: '17069' }],
              geocodes: {
                main: {
                  latitude: 37.7750, // Closer
                  longitude: -122.4190,
                },
              },
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await poiService.searchNearbyPOIs({
        ...mockSearchOptions,
        limit: 1,
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Near Gas Station');
    });
  });

  describe('getPOIsByCategory', () => {
    it('should get POIs by category', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              fsq_id: 'test123',
              name: 'Test Pharmacy',
              categories: [{ id: '17031' }],
              geocodes: {
                main: {
                  latitude: 37.7849,
                  longitude: -122.4094,
                },
              },
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const coordinate: Coordinate = { latitude: 37.7749, longitude: -122.4194 };
      const result = await poiService.getPOIsByCategory(coordinate, 'pharmacy', 5);

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('pharmacy');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.foursquare.com/v3/places/search',
        expect.objectContaining({
          params: expect.objectContaining({
            categories: '17031', // Pharmacy category
            limit: 50,
          }),
        })
      );
    });
  });

  describe('findClosestPOI', () => {
    it('should find the closest POI', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              fsq_id: 'closest123',
              name: 'Closest Bank',
              categories: [{ id: '10023' }],
              geocodes: {
                main: {
                  latitude: 37.7750,
                  longitude: -122.4190,
                },
              },
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const coordinate: Coordinate = { latitude: 37.7749, longitude: -122.4194 };
      const result = await poiService.findClosestPOI(coordinate, 'bank', 10);

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Closest Bank');
      expect(result!.category).toBe('bank');
    });

    it('should return null when no POIs found', async () => {
      const mockResponse = {
        data: {
          results: [],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const coordinate: Coordinate = { latitude: 37.7749, longitude: -122.4194 };
      const result = await poiService.findClosestPOI(coordinate, 'bank', 10);

      expect(result).toBeNull();
    });
  });

  describe('externalPOIToCreateRequest', () => {
    it('should convert external POI to create request', () => {
      const externalPOI: ExternalPOI = {
        id: 'foursquare_123',
        name: 'Test POI',
        category: 'gas',
        coordinate: { latitude: 37.7749, longitude: -122.4194 },
        address: '123 Test St',
        distance: 1.5,
        verified: true,
        source: 'foursquare',
      };

      const createRequest = POIService.externalPOIToCreateRequest(externalPOI);

      expect(createRequest).toEqual({
        external_id: 'foursquare_123',
        name: 'Test POI',
        category: 'gas',
        latitude: 37.7749,
        longitude: -122.4194,
        address: '123 Test St',
        verified: true,
        source: 'foursquare',
      });
    });
  });

  describe('getSupportedCategories', () => {
    it('should return all supported categories', () => {
      const categories = POIService.getSupportedCategories();
      expect(categories).toEqual(['gas', 'pharmacy', 'grocery', 'bank', 'post_office']);
    });
  });

  describe('isSupportedCategory', () => {
    it('should validate supported categories', () => {
      expect(POIService.isSupportedCategory('gas')).toBe(true);
      expect(POIService.isSupportedCategory('pharmacy')).toBe(true);
      expect(POIService.isSupportedCategory('invalid')).toBe(false);
      expect(POIService.isSupportedCategory('')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle Foursquare API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network Error'));

      const mockSearchOptions: POISearchOptions = {
        coordinate: { latitude: 37.7749, longitude: -122.4194 },
        category: 'gas',
        radius: 5,
        limit: 10,
      };

      // Should not throw, should return empty array when both APIs fail
      const result = await poiService.searchNearbyPOIs(mockSearchOptions);
      expect(result).toEqual([]);
    });

    it('should handle Google Places API errors', async () => {
      // Foursquare not configured
      (poiService as any).foursquareApiKey = '';
      
      // Google Places fails
      mockedAxios.get.mockRejectedValue(new Error('Google API Error'));

      const mockSearchOptions: POISearchOptions = {
        coordinate: { latitude: 37.7749, longitude: -122.4194 },
        category: 'gas',
        radius: 5,
        limit: 10,
      };

      const result = await poiService.searchNearbyPOIs(mockSearchOptions);
      expect(result).toEqual([]);
    });
  });

  describe('category mapping', () => {
    it('should map Foursquare categories correctly', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              fsq_id: 'test123',
              name: 'Test Place',
              categories: [{ id: '17031' }], // Pharmacy
              geocodes: {
                main: {
                  latitude: 37.7849,
                  longitude: -122.4094,
                },
              },
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await poiService.searchNearbyPOIs({
        coordinate: { latitude: 37.7749, longitude: -122.4194 },
        radius: 5,
        limit: 10,
      });

      expect(result[0].category).toBe('pharmacy');
    });

    it('should map Google Places types correctly', async () => {
      // Foursquare fails
      mockedAxios.get.mockRejectedValueOnce(new Error('Foursquare Error'));

      const mockGoogleResponse = {
        data: {
          status: 'OK',
          results: [
            {
              place_id: 'google123',
              name: 'Test Grocery',
              types: ['grocery_or_supermarket', 'store'],
              geometry: {
                location: {
                  lat: 37.7849,
                  lng: -122.4094,
                },
              },
              vicinity: '123 Test St',
              business_status: 'OPERATIONAL',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValueOnce(mockGoogleResponse);

      const result = await poiService.searchNearbyPOIs({
        coordinate: { latitude: 37.7749, longitude: -122.4194 },
        radius: 5,
        limit: 10,
      });

      expect(result[0].category).toBe('grocery');
    });
  });
});