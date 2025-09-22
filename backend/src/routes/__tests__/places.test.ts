import request from 'supertest';
import express from 'express';
import { placeRoutes } from '../places';
import { PlaceService } from '../../services/placeService';
import { GeocodingService } from '../../services/geocodingService';

// Mock dependencies
jest.mock('../../services/placeService');
jest.mock('../../services/geocodingService');
jest.mock('../../database/connection', () => ({
  getDbConnection: jest.fn(() => ({})),
}));

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'user123' };
    next();
  },
}));

const MockedPlaceService = PlaceService as jest.MockedClass<typeof PlaceService>;
const MockedGeocodingService = GeocodingService as jest.MockedClass<typeof GeocodingService>;

describe('Places Routes', () => {
  let app: express.Application;
  let mockPlaceService: jest.Mocked<PlaceService>;
  let mockGeocodingService: jest.Mocked<GeocodingService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/places', placeRoutes);

    mockPlaceService = {
      getUserPlaces: jest.fn(),
      getPlaceById: jest.fn(),
      createPlace: jest.fn(),
      updatePlace: jest.fn(),
      deletePlace: jest.fn(),
      searchPlaces: jest.fn(),
      findNearbyPlaces: jest.fn(),
      createPlaceFromAddress: jest.fn(),
      getPlaceStats: jest.fn(),
    } as any;

    mockGeocodingService = {
      geocodeAddress: jest.fn(),
      reverseGeocode: jest.fn(),
    } as any;

    MockedPlaceService.mockImplementation(() => mockPlaceService);
    MockedGeocodingService.mockImplementation(() => mockGeocodingService);

    jest.clearAllMocks();
  });

  describe('GET /places', () => {
    it('should get all places for user', async () => {
      const mockPlaces = [
        { toJSON: () => ({ id: 'place1', name: 'Home' }) },
        { toJSON: () => ({ id: 'place2', name: 'Work' }) },
      ];

      mockPlaceService.getUserPlaces.mockResolvedValue(mockPlaces as any);

      const response = await request(app).get('/places');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: [
          { id: 'place1', name: 'Home' },
          { id: 'place2', name: 'Work' },
        ],
      });
      expect(mockPlaceService.getUserPlaces).toHaveBeenCalledWith('user123');
    });

    it('should handle service errors', async () => {
      mockPlaceService.getUserPlaces.mockRejectedValue(new Error('Service error'));

      const response = await request(app).get('/places');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to get places',
      });
    });
  });

  describe('GET /places/:id', () => {
    it('should get place by ID', async () => {
      const mockPlace = { toJSON: () => ({ id: 'place123', name: 'Test Place' }) };
      mockPlaceService.getPlaceById.mockResolvedValue(mockPlace as any);

      const response = await request(app).get('/places/place123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { id: 'place123', name: 'Test Place' },
      });
      expect(mockPlaceService.getPlaceById).toHaveBeenCalledWith('place123', 'user123');
    });

    it('should return 404 when place not found', async () => {
      mockPlaceService.getPlaceById.mockResolvedValue(null);

      const response = await request(app).get('/places/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Place not found',
      });
    });
  });

  describe('POST /places', () => {
    const validPlaceData = {
      name: 'Test Place',
      latitude: 37.7749,
      longitude: -122.4194,
      address: '123 Test St',
      place_type: 'custom',
    };

    it('should create place successfully', async () => {
      const mockPlace = { toJSON: () => ({ id: 'place123', ...validPlaceData }) };
      mockPlaceService.createPlace.mockResolvedValue(mockPlace as any);

      const response = await request(app).post('/places').send(validPlaceData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        data: { id: 'place123', ...validPlaceData },
      });
      expect(mockPlaceService.createPlace).toHaveBeenCalledWith('user123', validPlaceData);
    });

    it('should return 400 for invalid data', async () => {
      const invalidData = { name: '', latitude: 37.7749 }; // Missing required fields

      const response = await request(app).post('/places').send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle validation errors', async () => {
      const error = new Error('Invalid place data');
      error.name = 'ValidationError';
      mockPlaceService.createPlace.mockRejectedValue(error);

      const response = await request(app).post('/places').send(validPlaceData);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid place data',
      });
    });
  });

  describe('PUT /places/:id', () => {
    const updateData = { name: 'Updated Place' };

    it('should update place successfully', async () => {
      const mockPlace = { toJSON: () => ({ id: 'place123', name: 'Updated Place' }) };
      mockPlaceService.updatePlace.mockResolvedValue(mockPlace as any);

      const response = await request(app).put('/places/place123').send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { id: 'place123', name: 'Updated Place' },
      });
      expect(mockPlaceService.updatePlace).toHaveBeenCalledWith('place123', 'user123', updateData);
    });

    it('should return 404 when place not found', async () => {
      mockPlaceService.updatePlace.mockResolvedValue(null);

      const response = await request(app).put('/places/nonexistent').send(updateData);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Place not found',
      });
    });
  });

  describe('DELETE /places/:id', () => {
    it('should delete place successfully', async () => {
      mockPlaceService.deletePlace.mockResolvedValue(true);

      const response = await request(app).delete('/places/place123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Place deleted successfully',
      });
      expect(mockPlaceService.deletePlace).toHaveBeenCalledWith('place123', 'user123');
    });

    it('should return 404 when place not found', async () => {
      mockPlaceService.deletePlace.mockResolvedValue(false);

      const response = await request(app).delete('/places/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Place not found',
      });
    });

    it('should handle places with active tasks', async () => {
      const error = new Error('Cannot delete place with active tasks');
      mockPlaceService.deletePlace.mockRejectedValue(error);

      const response = await request(app).delete('/places/place123');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Cannot delete place with active tasks',
      });
    });
  });

  describe('GET /places/search', () => {
    it('should search places successfully', async () => {
      const mockPlaces = [{ toJSON: () => ({ id: 'place1', name: 'Test Place' }) }];
      mockPlaceService.searchPlaces.mockResolvedValue(mockPlaces as any);

      const response = await request(app).get('/places/search?q=test');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: [{ id: 'place1', name: 'Test Place' }],
      });
      expect(mockPlaceService.searchPlaces).toHaveBeenCalledWith('user123', 'test');
    });

    it('should return 400 for empty query', async () => {
      const response = await request(app).get('/places/search?q=');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Search query is required',
      });
    });
  });

  describe('GET /places/nearby', () => {
    it('should find nearby places successfully', async () => {
      const mockPlaces = [{ toJSON: () => ({ id: 'place1', name: 'Nearby Place' }) }];
      mockPlaceService.findNearbyPlaces.mockResolvedValue(mockPlaces as any);

      const response = await request(app).get('/places/nearby?latitude=37.7749&longitude=-122.4194&radius=5');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: [{ id: 'place1', name: 'Nearby Place' }],
      });
      expect(mockPlaceService.findNearbyPlaces).toHaveBeenCalledWith(
        'user123',
        { latitude: 37.7749, longitude: -122.4194 },
        5
      );
    });

    it('should return 400 for invalid coordinates', async () => {
      const response = await request(app).get('/places/nearby?latitude=invalid&longitude=-122.4194');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /places/from-address', () => {
    it('should create place from address successfully', async () => {
      const mockPlace = { toJSON: () => ({ id: 'place123', name: 'Address Place' }) };
      mockPlaceService.createPlaceFromAddress.mockResolvedValue(mockPlace as any);

      const response = await request(app)
        .post('/places/from-address')
        .send({
          name: 'Address Place',
          address: '123 Test St, San Francisco, CA',
          place_type: 'custom',
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        data: { id: 'place123', name: 'Address Place' },
      });
      expect(mockPlaceService.createPlaceFromAddress).toHaveBeenCalledWith(
        'user123',
        'Address Place',
        '123 Test St, San Francisco, CA',
        'custom'
      );
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app).post('/places/from-address').send({ name: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Name and address are required',
      });
    });

    it('should handle geocoding failures', async () => {
      const error = new Error('Could not geocode the provided address');
      mockPlaceService.createPlaceFromAddress.mockRejectedValue(error);

      const response = await request(app)
        .post('/places/from-address')
        .send({
          name: 'Test Place',
          address: 'Invalid Address',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Could not geocode the provided address',
      });
    });
  });

  describe('GET /places/stats', () => {
    it('should get place statistics successfully', async () => {
      const mockStats = {
        totalPlaces: 5,
        placesByType: { home: 1, work: 1, custom: 3 },
        placesWithActiveTasks: 2,
      };
      mockPlaceService.getPlaceStats.mockResolvedValue(mockStats);

      const response = await request(app).get('/places/stats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockStats,
      });
      expect(mockPlaceService.getPlaceStats).toHaveBeenCalledWith('user123');
    });
  });

  describe('POST /places/geocode', () => {
    it('should geocode address successfully', async () => {
      const mockResult = {
        coordinate: { latitude: 37.7749, longitude: -122.4194 },
        formattedAddress: '123 Test St, San Francisco, CA 94102, USA',
        addressComponents: [],
      };
      mockGeocodingService.geocodeAddress.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/places/geocode')
        .send({ address: '123 Test St, San Francisco, CA' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockResult,
      });
      expect(mockGeocodingService.geocodeAddress).toHaveBeenCalledWith('123 Test St, San Francisco, CA');
    });

    it('should return 400 for missing address', async () => {
      const response = await request(app).post('/places/geocode').send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Address is required',
      });
    });

    it('should return 404 for invalid address', async () => {
      mockGeocodingService.geocodeAddress.mockResolvedValue(null);

      const response = await request(app)
        .post('/places/geocode')
        .send({ address: 'Invalid Address' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Could not geocode the provided address',
      });
    });
  });

  describe('POST /places/reverse-geocode', () => {
    it('should reverse geocode coordinates successfully', async () => {
      const mockResult = {
        formattedAddress: '123 Test St, San Francisco, CA 94102, USA',
        addressComponents: [],
      };
      mockGeocodingService.reverseGeocode.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/places/reverse-geocode')
        .send({ latitude: 37.7749, longitude: -122.4194 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockResult,
      });
      expect(mockGeocodingService.reverseGeocode).toHaveBeenCalledWith({
        latitude: 37.7749,
        longitude: -122.4194,
      });
    });

    it('should return 400 for invalid coordinates', async () => {
      const response = await request(app)
        .post('/places/reverse-geocode')
        .send({ latitude: 200, longitude: -122.4194 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for coordinates that cannot be reverse geocoded', async () => {
      mockGeocodingService.reverseGeocode.mockResolvedValue(null);

      const response = await request(app)
        .post('/places/reverse-geocode')
        .send({ latitude: 0, longitude: 0 });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Could not reverse geocode the provided coordinates',
      });
    });
  });
});