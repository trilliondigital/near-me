import { Router, Request, Response } from 'express';
import { PlaceService } from '../services/placeService';
import { GeocodingService } from '../services/geocodingService';
import { authenticateToken } from '../middleware/auth';
import { validateSchema, locationQuerySchema } from '../models/validation';
import { CreatePlaceRequest, UpdatePlaceRequest, Coordinate } from '../models/types';
import { getDbConnection } from '../database/connection';

const router = Router();
const placeService = new PlaceService(getDbConnection());
const geocodingService = new GeocodingService();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /places - Get all places for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const updatedSinceParam = req.query.updated_since as string | undefined;
    const updatedSince = updatedSinceParam ? new Date(updatedSinceParam) : undefined;
    const places = await placeService.getUserPlaces(userId, updatedSince && !isNaN(updatedSince.getTime()) ? updatedSince : undefined);
    
    return res.json({
      success: true,
      data: places.map(place => place.toJSON()),
    });
  } catch (error) {
    console.error('Error getting places:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get places',
    });
  }
});

/**
 * GET /places/:id - Get a specific place
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const placeId = req.params.id;
    
    const place = await placeService.getPlaceById(placeId, userId);
    
    if (!place) {
      return res.status(404).json({
        success: false,
        error: 'Place not found',
      });
    }
    
    res.json({
      success: true,
      data: place.toJSON(),
    });
  } catch (error) {
    console.error('Error getting place:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get place',
    });
  }
});

/**
 * POST /places - Create a new place
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const createRequest = validateSchema<CreatePlaceRequest>(
      require('../models/validation').createPlaceSchema,
      req.body
    );
    
    const place = await placeService.createPlace(userId, createRequest);
    
    res.status(201).json({
      success: true,
      data: place.toJSON(),
    });
  } catch (error) {
    console.error('Error creating place:', error);
    
    if (error instanceof Error && error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to create place',
    });
  }
});

/**
 * PUT /places/:id - Update a place
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const placeId = req.params.id;
    const updateRequest = validateSchema<UpdatePlaceRequest>(
      require('../models/validation').updatePlaceSchema,
      req.body
    );
    
    const place = await placeService.updatePlace(placeId, userId, updateRequest);
    
    if (!place) {
      return res.status(404).json({
        success: false,
        error: 'Place not found',
      });
    }
    
    res.json({
      success: true,
      data: place.toJSON(),
    });
  } catch (error) {
    console.error('Error updating place:', error);
    
    if (error instanceof Error && error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to update place',
    });
  }
});

/**
 * DELETE /places/:id - Delete a place
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const placeId = req.params.id;
    
    const deleted = await placeService.deletePlace(placeId, userId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Place not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Place deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting place:', error);
    
    if (error instanceof Error && error.message === 'Cannot delete place with active tasks') {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to delete place',
    });
  }
});

/**
 * GET /places/search - Search places by name or address
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const query = req.query.q as string;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
    }
    
    const places = await placeService.searchPlaces(userId, query.trim());
    
    res.json({
      success: true,
      data: places.map(place => place.toJSON()),
    });
  } catch (error) {
    console.error('Error searching places:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search places',
    });
  }
});

/**
 * GET /places/nearby - Find places near a coordinate
 */
router.get('/nearby', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { latitude, longitude, radius } = validateSchema<{
      latitude: number;
      longitude: number;
      radius: number;
    }>(locationQuerySchema, req.query);
    
    const coordinate: Coordinate = { latitude, longitude };
    const places = await placeService.findNearbyPlaces(userId, coordinate, radius);
    
    res.json({
      success: true,
      data: places.map(place => place.toJSON()),
    });
  } catch (error) {
    console.error('Error finding nearby places:', error);
    
    if (error instanceof Error && error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to find nearby places',
    });
  }
});

/**
 * POST /places/from-address - Create place from address
 */
router.post('/from-address', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, address, place_type = 'custom' } = req.body;
    
    if (!name || !address) {
      return res.status(400).json({
        success: false,
        error: 'Name and address are required',
      });
    }
    
    const place = await placeService.createPlaceFromAddress(userId, name, address, place_type);
    
    res.status(201).json({
      success: true,
      data: place.toJSON(),
    });
  } catch (error) {
    console.error('Error creating place from address:', error);
    
    if (error instanceof Error && error.message === 'Could not geocode the provided address') {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to create place from address',
    });
  }
});

/**
 * GET /places/stats - Get place statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const stats = await placeService.getPlaceStats(userId);
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting place stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get place statistics',
    });
  }
});

/**
 * POST /places/geocode - Geocode an address
 */
router.post('/geocode', async (req: Request, res: Response) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address is required',
      });
    }
    
    const result = await geocodingService.geocodeAddress(address);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Could not geocode the provided address',
      });
    }
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error geocoding address:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to geocode address',
    });
  }
});

/**
 * POST /places/reverse-geocode - Reverse geocode coordinates
 */
router.post('/reverse-geocode', async (req: Request, res: Response) => {
  try {
    const Joi = require('joi');
    const { latitude, longitude } = validateSchema<Coordinate>(
      Joi.object({
        latitude: Joi.number().min(-90).max(90).required(),
        longitude: Joi.number().min(-180).max(180).required(),
      }),
      req.body
    );
    
    const result = await geocodingService.reverseGeocode({ latitude, longitude });
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Could not reverse geocode the provided coordinates',
      });
    }
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    
    if (error instanceof Error && error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to reverse geocode coordinates',
    });
  }
});

export { router as placeRoutes };