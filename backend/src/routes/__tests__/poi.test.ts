import request from 'supertest';
import express from 'express';
import { poiRoutes } from '../poi';
import { POIService } from '../../services/poiService';
import { POI } from '../../models/POI';
import { POICategory } from '../../models/types';

// Mock dependencies
jest.mock('../../services/poiService');
jest.mock('../../models/POI');

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'user123' };
    next();
  },
}));

const MockedPOIService = POIService as jest.MockedClass<typeof POIService>;

describe('POI Routes', () => {
  let app: express.Application;
  let mockPOIService: jest.Mocked<POIService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/poi', poiRoutes);

    mockPOIService = {
      searchNearbyPOIs: jest.fn(),
      getPOIsByCategory: jest.fn(),
      findClosestPOI: jest.fn(),
    } as any;

    MockedPOIService.mockImplementation(() => mockPOIService);

    // Mock POI static methods
    (POI.getAllCategories as unknown as jest.Mock) = jest
      .fn()
      .mockReturnValue(['gas', 'pharmacy', 'grocery', 'bank', 'post_office']);
    (POI.getCategoryDisplayName as unknown as jest.Mock) = jest.fn().mockImplementation((category) => {
      const names: Record<string, string> = {
        gas: 'Gas Station',
        pharmacy: 'Pharmacy',
        grocery: 'Grocery Store',
        bank: 'Bank',
        post_office: 'Post Office',
      };
      return names[category];
    });
    (POI.isValidCategory as unknown as jest.Mock) = jest.fn().mockImplementation((category: string) => {
      return ['gas', 'pharmacy', 'grocery', 'bank', 'post_office'].includes(category);
    });

    jest.clearAllMocks();
  });

  describe('GET /poi/categories', () => {
    it('should get all POI categories', async () => {
      const response = await request(app).get('/poi/categories');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: [
          { id: 'gas', name: 'Gas Station' },
          { id: 'pharmacy', name: 'Pharmacy' },
          { id: 'grocery', name: 'Grocery Store' },
          { id: 'bank', name: 'Bank' },
          { id: 'post_office', name: 'Post Office' },
        ],
      });
    });

    it('should handle service errors', async () => {
      (POI.getAllCategories as jest.Mock).mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app).get('/poi/categories');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to get POI categories',
      });
    });
  });

  describe('GET /poi/search', () => {
    const mockPOIs = [
      {
        id: 'foursquare_123',
        name: 'Test Gas Station',
        category: 'gas' as POICategory,
        coordinate: { latitude: 37.7749, longitude: -122.4194 },
        address: '123 Test St',
        distance: 1.5,
        verified: true,
        source: 'foursquare',
      },
    ];

    it('should search POIs successfully', async () => {
      mockPOIService.searchNearbyPOIs.mockResolvedValue(mockPOIs);

      const response = await request(app).get('/poi/search?latitude=37.7749&longitude=-122.4194&radius=5&category=gas&limit=10');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockPOIs,
      });
      expect(mockPOIService.searchNearbyPOIs).toHaveBeenCalledWith({
        coordinate: { latitude: 37.7749, longitude: -122.4194 },
        category: 'gas',
        radius: 5,
        limit: 10,
      });
    });

    it('should search without category filter', async () => {
      mockPOIService.searchNearbyPOIs.mockResolvedValue(mockPOIs);

      const response = await request(app).get('/poi/search?latitude=37.7749&longitude=-122.4194&radius=5');

      expect(response.status).toBe(200);
      expect(mockPOIService.searchNearbyPOIs).toHaveBeenCalledWith({
        coordinate: { latitude: 37.7749, longitude: -122.4194 },
        category: undefined,
        radius: 5,
        limit: 20, // default limit
      });
    });

    it('should return 400 for invalid category', async () => {
      (POI.isValidCategory as unknown as jest.Mock).mockReturnValue(false);

      const response = await request(app).get('/poi/search?latitude=37.7749&longitude=-122.4194&radius=5&category=invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid POI category',
      });
    });

    it('should return 400 for invalid coordinates', async () => {
      const response = await request(app).get('/poi/search?latitude=invalid&longitude=-122.4194&radius=5');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors', async () => {
      mockPOIService.searchNearbyPOIs.mockRejectedValue(new Error('Service error'));

      const response = await request(app).get('/poi/search?latitude=37.7749&longitude=-122.4194&radius=5');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to search POIs',
      });
    });
  });

  describe('GET /poi/category/:category', () => {
    const mockPOIs = [
      {
        id: 'google_456',
        name: 'Test Pharmacy',
        category: 'pharmacy' as POICategory,
        coordinate: { latitude: 37.7849, longitude: -122.4094 },
        address: '456 Test Ave',
        distance: 0.8,
        verified: true,
        source: 'google_places',
      },
    ];

    it('should get POIs by category successfully', async () => {
      mockPOIService.getPOIsByCategory.mockResolvedValue(mockPOIs);

      const response = await request(app).get('/poi/category/pharmacy?latitude=37.7749&longitude=-122.4194&radius=10');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockPOIs,
      });
      expect(mockPOIService.getPOIsByCategory).toHaveBeenCalledWith(
        { latitude: 37.7749, longitude: -122.4194 },
        'pharmacy',
        10
      );
    });

    it('should return 400 for invalid category', async () => {
      (POI.isValidCategory as unknown as jest.Mock).mockReturnValue(false);

      const response = await request(app).get('/poi/category/invalid?latitude=37.7749&longitude=-122.4194&radius=10');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid POI category',
      });
    });

    it('should use default radius when not provided', async () => {
      mockPOIService.getPOIsByCategory.mockResolvedValue(mockPOIs);

      const response = await request(app).get('/poi/category/pharmacy?latitude=37.7749&longitude=-122.4194');

      expect(response.status).toBe(200);
      expect(mockPOIService.getPOIsByCategory).toHaveBeenCalledWith(
        { latitude: 37.7749, longitude: -122.4194 },
        'pharmacy',
        10 // default radius
      );
    });
  });

  describe('GET /poi/closest/:category', () => {
    const mockPOI = {
      id: 'foursquare_789',
      name: 'Closest Bank',
      category: 'bank' as POICategory,
      coordinate: { latitude: 37.7750, longitude: -122.4190 },
      address: '789 Test Blvd',
      distance: 0.2,
      verified: true,
      source: 'foursquare',
    };

    it('should find closest POI successfully', async () => {
      mockPOIService.findClosestPOI.mockResolvedValue(mockPOI);

      const response = await request(app).get('/poi/closest/bank?latitude=37.7749&longitude=-122.4194&maxRadius=15');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockPOI,
      });
      expect(mockPOIService.findClosestPOI).toHaveBeenCalledWith(
        { latitude: 37.7749, longitude: -122.4194 },
        'bank',
        15
      );
    });

    it('should return 404 when no POI found', async () => {
      mockPOIService.findClosestPOI.mockResolvedValue(null);
      (POI.getCategoryDisplayName as jest.Mock).mockReturnValue('Bank');

      const response = await request(app).get('/poi/closest/bank?latitude=37.7749&longitude=-122.4194');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'No Bank found within 25 miles',
      });
    });

    it('should use default max radius when not provided', async () => {
      mockPOIService.findClosestPOI.mockResolvedValue(mockPOI);

      const response = await request(app).get('/poi/closest/bank?latitude=37.7749&longitude=-122.4194');

      expect(response.status).toBe(200);
      expect(mockPOIService.findClosestPOI).toHaveBeenCalledWith(
        { latitude: 37.7749, longitude: -122.4194 },
        'bank',
        25 // default max radius
      );
    });

    it('should return 400 for invalid category', async () => {
      (POI.isValidCategory as jest.Mock).mockReturnValue(false);

      const response = await request(app).get('/poi/closest/invalid?latitude=37.7749&longitude=-122.4194');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid POI category',
      });
    });
  });

  describe('GET /poi/nearby-all', () => {
    const mockAllPOIs = [
      {
        id: 'gas_1',
        name: 'Gas Station 1',
        category: 'gas' as POICategory,
        coordinate: { latitude: 37.7750, longitude: -122.4190 },
        verified: true,
        source: 'test',
      },
      {
        id: 'pharmacy_1',
        name: 'Pharmacy 1',
        category: 'pharmacy' as POICategory,
        coordinate: { latitude: 37.7748, longitude: -122.4195 },
        verified: true,
        source: 'test',
      },
    ];

    it('should get all nearby POIs grouped by category', async () => {
      mockPOIService.searchNearbyPOIs.mockResolvedValue(mockAllPOIs);

      const response = await request(app).get('/poi/nearby-all?latitude=37.7749&longitude=-122.4194&radius=5&limit=30');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          coordinate: { latitude: 37.7749, longitude: -122.4194 },
          radius: 5,
          totalPOIs: 2,
          poisByCategory: {
            gas: [mockAllPOIs[0]],
            pharmacy: [mockAllPOIs[1]],
            grocery: [],
            bank: [],
            post_office: [],
          },
        },
      });
      expect(mockPOIService.searchNearbyPOIs).toHaveBeenCalledWith({
        coordinate: { latitude: 37.7749, longitude: -122.4194 },
        radius: 5,
        limit: 30,
      });
    });

    it('should use default limit when not provided', async () => {
      mockPOIService.searchNearbyPOIs.mockResolvedValue([]);

      const response = await request(app).get('/poi/nearby-all?latitude=37.7749&longitude=-122.4194&radius=5');

      expect(response.status).toBe(200);
      expect(mockPOIService.searchNearbyPOIs).toHaveBeenCalledWith({
        coordinate: { latitude: 37.7749, longitude: -122.4194 },
        radius: 5,
        limit: 50, // default limit
      });
    });
  });

  describe('POST /poi/validate-category', () => {
    it('should validate valid category', async () => {
      (POI.isValidCategory as unknown as jest.Mock).mockReturnValue(true);
      (POI.getCategoryDisplayName as unknown as jest.Mock).mockReturnValue('Gas Station');

      const response = await request(app).post('/poi/validate-category').send({ category: 'gas' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          category: 'gas',
          isValid: true,
          displayName: 'Gas Station',
        },
      });
    });

    it('should validate invalid category', async () => {
      (POI.isValidCategory as unknown as jest.Mock).mockReturnValue(false);

      const response = await request(app).post('/poi/validate-category').send({ category: 'invalid' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          category: 'invalid',
          isValid: false,
          displayName: null,
        },
      });
    });

    it('should return 400 for missing category', async () => {
      const response = await request(app).post('/poi/validate-category').send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Category is required',
      });
    });

    it('should handle service errors', async () => {
      (POI.isValidCategory as unknown as jest.Mock).mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app).post('/poi/validate-category').send({ category: 'gas' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to validate category',
      });
    });
  });
});