import { Router, Request, Response } from 'express';
import { POIService } from '../services/poiService';
import { authenticateToken } from '../middleware/auth';
import { validateSchema, locationQuerySchema } from '../models/validation';
import { POICategory, Coordinate } from '../models/types';
import { POI } from '../models/POI';

export function createPOIsRouter(): Router {
  const router = Router();
  const poiService = new POIService();

  // Apply authentication to all routes
  router.use(authenticateToken);

  /**
   * GET /pois/categories - Get all supported POI categories
   */
  router.get('/categories', async (req: Request, res: Response) => {
    try {
      const categories = POI.getAllCategories().map(category => ({
        id: category,
        name: POI.getCategoryDisplayName(category),
      }));
      
      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      console.error('Error getting POI categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get POI categories',
      });
    }
  });

  /**
   * GET /pois/search - Search for POIs near a location
   */
  router.get('/search', async (req: Request, res: Response) => {
    try {
      const { latitude, longitude, radius } = validateSchema<{
        latitude: number;
        longitude: number;
        radius: number;
      }>(locationQuerySchema, req.query);

      const category = req.query.category as POICategory;
      const limit = parseInt(req.query.limit as string) || 20;

      // Validate category if provided
      if (category && !POI.isValidCategory(category)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid POI category',
        });
      }

      const coordinate: Coordinate = { latitude, longitude };
      const pois = await poiService.searchNearbyPOIs({
        coordinate,
        category,
        radius,
        limit,
      });

      res.json({
        success: true,
        data: pois,
      });
    } catch (error) {
      console.error('Error searching POIs:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to search POIs',
      });
    }
  });

  /**
   * GET /pois/category/:category - Get POIs by category near a location
   */
  router.get('/category/:category', async (req: Request, res: Response) => {
    try {
      const category = req.params.category as POICategory;
      
      if (!POI.isValidCategory(category)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid POI category',
        });
      }

      const { latitude, longitude, radius } = validateSchema<{
        latitude: number;
        longitude: number;
        radius: number;
      }>(locationQuerySchema, req.query);

      const coordinate: Coordinate = { latitude, longitude };
      const pois = await poiService.getPOIsByCategory(coordinate, category, radius);

      res.json({
        success: true,
        data: pois,
      });
    } catch (error) {
      console.error('Error getting POIs by category:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to get POIs by category',
      });
    }
  });

  /**
   * GET /pois/closest/:category - Find the closest POI of a specific category
   */
  router.get('/closest/:category', async (req: Request, res: Response) => {
    try {
      const category = req.params.category as POICategory;
      
      if (!POI.isValidCategory(category)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid POI category',
        });
      }

      const { latitude, longitude } = validateSchema<{
        latitude: number;
        longitude: number;
      }>(
        require('joi').object({
          latitude: require('joi').number().min(-90).max(90).required(),
          longitude: require('joi').number().min(-180).max(180).required(),
        }),
        req.query
      );

      const maxRadius = parseInt(req.query.maxRadius as string) || 25;
      const coordinate: Coordinate = { latitude, longitude };
      
      const poi = await poiService.findClosestPOI(coordinate, category, maxRadius);

      if (!poi) {
        return res.status(404).json({
          success: false,
          error: `No ${POI.getCategoryDisplayName(category)} found within ${maxRadius} miles`,
        });
      }

      res.json({
        success: true,
        data: poi,
      });
    } catch (error) {
      console.error('Error finding closest POI:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to find closest POI',
      });
    }
  });

  /**
   * GET /pois/nearby-all - Get all POI categories near a location
   */
  router.get('/nearby-all', async (req: Request, res: Response) => {
    try {
      const { latitude, longitude, radius } = validateSchema<{
        latitude: number;
        longitude: number;
        radius: number;
      }>(locationQuerySchema, req.query);

      const coordinate: Coordinate = { latitude, longitude };
      const limit = parseInt(req.query.limit as string) || 50;

      // Search for all categories
      const allPOIs = await poiService.searchNearbyPOIs({
        coordinate,
        radius,
        limit,
      });

      // Group by category
      const poisByCategory: Record<POICategory, any[]> = {
        gas: [],
        pharmacy: [],
        grocery: [],
        bank: [],
        post_office: [],
      };

      allPOIs.forEach(poi => {
        if (poisByCategory[poi.category]) {
          poisByCategory[poi.category].push(poi);
        }
      });

      res.json({
        success: true,
        data: {
          coordinate,
          radius,
          totalPOIs: allPOIs.length,
          poisByCategory,
        },
      });
    } catch (error) {
      console.error('Error getting nearby POIs:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to get nearby POIs',
      });
    }
  });

  /**
   * POST /pois/validate-category - Validate if a category is supported
   */
  router.post('/validate-category', async (req: Request, res: Response) => {
    try {
      const { category } = req.body;
      
      if (!category) {
        return res.status(400).json({
          success: false,
          error: 'Category is required',
        });
      }

      const isValid = POI.isValidCategory(category);
      
      res.json({
        success: true,
        data: {
          category,
          isValid,
          displayName: isValid ? POI.getCategoryDisplayName(category) : null,
        },
      });
    } catch (error) {
      console.error('Error validating category:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate category',
      });
    }
  });

  return router;
}