import { GeocodingService } from '../geocodingService';
import { Coordinate } from '../../models/types';

// Mock the Google Maps client
jest.mock('@googlemaps/google-maps-services-js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    geocode: jest.fn(),
    reverseGeocode: jest.fn(),
    placeDetails: jest.fn(),
  })),
}));

describe('GeocodingService', () => {
  let geocodingService: GeocodingService;
  let mockClient: any;

  beforeEach(() => {
    // Set up environment variable
    process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';
    
    geocodingService = new GeocodingService();
    mockClient = (geocodingService as any).client;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  describe('constructor', () => {
    it('should initialize with API key from environment', () => {
      expect((geocodingService as any).apiKey).toBe('test-api-key');
    });

    it('should handle missing API key', () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      new GeocodingService();
      
      expect(consoleSpy).toHaveBeenCalledWith('Google Maps API key not configured. Geocoding will not work.');
      consoleSpy.mockRestore();
    });
  });

  describe('geocodeAddress', () => {
    it('should geocode address successfully', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              formatted_address: '1600 Amphitheatre Parkway, Mountain View, CA 94043, USA',
              geometry: {
                location: {
                  lat: 37.4224764,
                  lng: -122.0842499,
                },
              },
              place_id: 'ChIJ2eUgeAK6j4ARbn5u_wAGqWA',
              address_components: [
                {
                  long_name: '1600',
                  short_name: '1600',
                  types: ['street_number'],
                },
                {
                  long_name: 'Amphitheatre Parkway',
                  short_name: 'Amphitheatre Pkwy',
                  types: ['route'],
                },
              ],
            },
          ],
        },
      };

      mockClient.geocode.mockResolvedValue(mockResponse);

      const result = await geocodingService.geocodeAddress('1600 Amphitheatre Parkway, Mountain View, CA');

      expect(result).toEqual({
        coordinate: {
          latitude: 37.4224764,
          longitude: -122.0842499,
        },
        formattedAddress: '1600 Amphitheatre Parkway, Mountain View, CA 94043, USA',
        placeId: 'ChIJ2eUgeAK6j4ARbn5u_wAGqWA',
        addressComponents: [
          {
            longName: '1600',
            shortName: '1600',
            types: ['street_number'],
          },
          {
            longName: 'Amphitheatre Parkway',
            shortName: 'Amphitheatre Pkwy',
            types: ['route'],
          },
        ],
      });

      expect(mockClient.geocode).toHaveBeenCalledWith({
        params: {
          address: '1600 Amphitheatre Parkway, Mountain View, CA',
          key: 'test-api-key',
        },
      });
    });

    it('should return null for no results', async () => {
      mockClient.geocode.mockResolvedValue({ data: { results: [] } });

      const result = await geocodingService.geocodeAddress('Invalid Address');
      expect(result).toBeNull();
    });

    it('should throw error when API key is not configured', async () => {
      (geocodingService as any).apiKey = '';

      await expect(geocodingService.geocodeAddress('test address')).rejects.toThrow(
        'Google Maps API key not configured'
      );
    });

    it('should handle API errors', async () => {
      mockClient.geocode.mockRejectedValue(new Error('API Error'));

      await expect(geocodingService.geocodeAddress('test address')).rejects.toThrow(
        'Failed to geocode address'
      );
    });
  });

  describe('reverseGeocode', () => {
    it('should reverse geocode coordinates successfully', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              formatted_address: '1600 Amphitheatre Parkway, Mountain View, CA 94043, USA',
              place_id: 'ChIJ2eUgeAK6j4ARbn5u_wAGqWA',
              address_components: [
                {
                  long_name: 'Mountain View',
                  short_name: 'Mountain View',
                  types: ['locality', 'political'],
                },
              ],
            },
          ],
        },
      };

      mockClient.reverseGeocode.mockResolvedValue(mockResponse);

      const coordinate: Coordinate = { latitude: 37.4224764, longitude: -122.0842499 };
      const result = await geocodingService.reverseGeocode(coordinate);

      expect(result).toEqual({
        formattedAddress: '1600 Amphitheatre Parkway, Mountain View, CA 94043, USA',
        placeId: 'ChIJ2eUgeAK6j4ARbn5u_wAGqWA',
        addressComponents: [
          {
            longName: 'Mountain View',
            shortName: 'Mountain View',
            types: ['locality', 'political'],
          },
        ],
      });

      expect(mockClient.reverseGeocode).toHaveBeenCalledWith({
        params: {
          latlng: '37.4224764,-122.0842499',
          key: 'test-api-key',
        },
      });
    });

    it('should return null for no results', async () => {
      mockClient.reverseGeocode.mockResolvedValue({ data: { results: [] } });

      const coordinate: Coordinate = { latitude: 0, longitude: 0 };
      const result = await geocodingService.reverseGeocode(coordinate);
      expect(result).toBeNull();
    });

    it('should throw error when API key is not configured', async () => {
      (geocodingService as any).apiKey = '';

      const coordinate: Coordinate = { latitude: 37.4224764, longitude: -122.0842499 };
      await expect(geocodingService.reverseGeocode(coordinate)).rejects.toThrow(
        'Google Maps API key not configured'
      );
    });
  });

  describe('validateCoordinates', () => {
    it('should return true for valid coordinates', async () => {
      mockClient.reverseGeocode.mockResolvedValue({
        data: {
          results: [{ formatted_address: 'Some Address' }],
        },
      });

      const coordinate: Coordinate = { latitude: 37.4224764, longitude: -122.0842499 };
      const result = await geocodingService.validateCoordinates(coordinate);
      expect(result).toBe(true);
    });

    it('should return false for invalid coordinates', async () => {
      mockClient.reverseGeocode.mockResolvedValue({ data: { results: [] } });

      const coordinate: Coordinate = { latitude: 0, longitude: 0 };
      const result = await geocodingService.validateCoordinates(coordinate);
      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      mockClient.reverseGeocode.mockRejectedValue(new Error('API Error'));

      const coordinate: Coordinate = { latitude: 37.4224764, longitude: -122.0842499 };
      const result = await geocodingService.validateCoordinates(coordinate);
      expect(result).toBe(false);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between two coordinates', () => {
      const coord1: Coordinate = { latitude: 37.7749, longitude: -122.4194 }; // San Francisco
      const coord2: Coordinate = { latitude: 40.7128, longitude: -74.0060 }; // New York

      const distance = GeocodingService.calculateDistance(coord1, coord2);

      // Distance between San Francisco and New York is approximately 2570 miles
      expect(distance).toBeGreaterThan(2500);
      expect(distance).toBeLessThan(2600);
    });

    it('should return 0 for same coordinates', () => {
      const coord: Coordinate = { latitude: 37.7749, longitude: -122.4194 };
      const distance = GeocodingService.calculateDistance(coord, coord);
      expect(distance).toBeCloseTo(0, 5);
    });

    it('should calculate short distances accurately', () => {
      const coord1: Coordinate = { latitude: 37.7749, longitude: -122.4194 };
      const coord2: Coordinate = { latitude: 37.7849, longitude: -122.4194 }; // 1 degree north

      const distance = GeocodingService.calculateDistance(coord1, coord2);
      expect(distance).toBeGreaterThan(68); // Approximately 69 miles per degree
      expect(distance).toBeLessThan(70);
    });
  });

  describe('getPlaceDetails', () => {
    it('should get place details successfully', async () => {
      const mockResponse = {
        data: {
          result: {
            name: 'Google',
            formatted_address: '1600 Amphitheatre Parkway, Mountain View, CA 94043, USA',
            geometry: {
              location: {
                lat: 37.4224764,
                lng: -122.0842499,
              },
            },
          },
        },
      };

      mockClient.placeDetails.mockResolvedValue(mockResponse);

      const result = await geocodingService.getPlaceDetails('ChIJ2eUgeAK6j4ARbn5u_wAGqWA');

      expect(result).toEqual(mockResponse.data.result);
      expect(mockClient.placeDetails).toHaveBeenCalledWith({
        params: {
          place_id: 'ChIJ2eUgeAK6j4ARbn5u_wAGqWA',
          key: 'test-api-key',
        },
      });
    });

    it('should throw error when API key is not configured', async () => {
      (geocodingService as any).apiKey = '';

      await expect(geocodingService.getPlaceDetails('test-place-id')).rejects.toThrow(
        'Google Maps API key not configured'
      );
    });

    it('should handle API errors', async () => {
      mockClient.placeDetails.mockRejectedValue(new Error('API Error'));

      await expect(geocodingService.getPlaceDetails('test-place-id')).rejects.toThrow(
        'Failed to get place details'
      );
    });
  });
});