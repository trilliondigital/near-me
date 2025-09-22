import Joi from 'joi';
import { 
  POICategory, 
  PremiumStatus, 
  TaskStatus, 
  PlaceType, 
  LocationType, 
  GeofenceType,
  NotificationStyle,
  PrivacyMode
} from './types';

// Common validation schemas
const coordinateSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required()
});

const timeRangeSchema = Joi.object({
  start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
});

const geofenceRadiiSchema = Joi.object({
  approach: Joi.number().min(0.1).max(50).required(), // 0.1 to 50 miles
  arrival: Joi.number().min(10).max(1000).required(), // 10 to 1000 meters
  postArrival: Joi.boolean().required()
});

const userPreferencesSchema = Joi.object({
  quietHours: timeRangeSchema.optional(),
  defaultRadii: geofenceRadiiSchema.optional(),
  notificationStyle: Joi.string().valid('minimal', 'standard', 'detailed').required(),
  privacyMode: Joi.string().valid('standard', 'foreground_only').required()
});

// User validation schemas
export const createUserSchema = Joi.object({
  device_id: Joi.string().min(1).max(255).required(),
  email: Joi.string().email().optional(),
  preferences: userPreferencesSchema.optional()
});

export const updateUserSchema = Joi.object({
  email: Joi.string().email().optional(),
  preferences: userPreferencesSchema.optional(),
  premium_status: Joi.string().valid('free', 'trial', 'premium').optional()
});

// Place validation schemas
export const createPlaceSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  address: Joi.string().max(500).optional(),
  place_type: Joi.string().valid('home', 'work', 'custom').required(),
  default_radii: geofenceRadiiSchema.optional()
});

export const updatePlaceSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  address: Joi.string().max(500).optional(),
  place_type: Joi.string().valid('home', 'work', 'custom').optional(),
  default_radii: geofenceRadiiSchema.optional()
});

// Task validation schemas
export const createTaskSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  location_type: Joi.string().valid('custom_place', 'poi_category').required(),
  place_id: Joi.string().uuid().when('location_type', {
    is: 'custom_place',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),
  poi_category: Joi.string().valid('gas', 'pharmacy', 'grocery', 'bank', 'post_office').when('location_type', {
    is: 'poi_category',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),
  custom_radii: geofenceRadiiSchema.optional()
});

export const updateTaskSchema = Joi.object({
  title: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(1000).optional(),
  location_type: Joi.string().valid('custom_place', 'poi_category').optional(),
  place_id: Joi.string().uuid().optional(),
  poi_category: Joi.string().valid('gas', 'pharmacy', 'grocery', 'bank', 'post_office').optional(),
  custom_radii: geofenceRadiiSchema.optional(),
  status: Joi.string().valid('active', 'completed', 'muted').optional()
});

// Geofence validation schemas
export const createGeofenceSchema = Joi.object({
  task_id: Joi.string().uuid().required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  radius: Joi.number().min(10).max(80467).required(), // 10 meters to 50 miles in meters
  geofence_type: Joi.string().valid('approach_5mi', 'approach_3mi', 'approach_1mi', 'arrival', 'post_arrival').required()
});

// POI validation schemas
export const createPOISchema = Joi.object({
  external_id: Joi.string().max(255).optional(),
  name: Joi.string().min(1).max(255).required(),
  category: Joi.string().valid('gas', 'pharmacy', 'grocery', 'bank', 'post_office').required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  address: Joi.string().max(500).optional(),
  verified: Joi.boolean().optional(),
  source: Joi.string().min(1).max(100).required()
});

// Event validation schemas
export const createEventSchema = Joi.object({
  user_id: Joi.string().uuid().optional(),
  event_type: Joi.string().min(1).max(100).required(),
  event_data: Joi.object().optional(),
  session_id: Joi.string().max(255).optional()
});

// Geofence Event validation schemas
export const createGeofenceEventSchema = Joi.object({
  user_id: Joi.string().uuid().required(),
  task_id: Joi.string().uuid().required(),
  geofence_id: Joi.string().uuid().required(),
  event_type: Joi.string().valid('enter', 'exit', 'dwell').required(),
  location: coordinateSchema.required(),
  confidence: Joi.number().min(0).max(1).default(1.0)
});

// Query parameter validation schemas
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

export const locationQuerySchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  radius: Joi.number().min(0.1).max(50).default(10) // miles
});

// Validation helper functions
export function validateSchema<T>(schema: Joi.ObjectSchema, data: any): T {
  const { error, value } = schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });
  
  if (error) {
    const errorMessage = error.details.map(detail => detail.message).join(', ');
    throw new ValidationError(errorMessage, error.details);
  }
  
  return value as T;
}

export class ValidationError extends Error {
  public details: Joi.ValidationErrorItem[];
  
  constructor(message: string, details: Joi.ValidationErrorItem[]) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

// Coordinate validation helpers
export function validateCoordinate(lat: number, lng: number): void {
  if (lat < -90 || lat > 90) {
    throw new ValidationError('Latitude must be between -90 and 90', []);
  }
  if (lng < -180 || lng > 180) {
    throw new ValidationError('Longitude must be between -180 and 180', []);
  }
}

export function validateRadius(radius: number, unit: 'meters' | 'miles' = 'meters'): void {
  if (unit === 'meters') {
    if (radius < 10 || radius > 80467) { // 50 miles in meters
      throw new ValidationError('Radius must be between 10 meters and 50 miles', []);
    }
  } else {
    if (radius < 0.1 || radius > 50) {
      throw new ValidationError('Radius must be between 0.1 and 50 miles', []);
    }
  }
}

export function validateTaskLimit(taskCount: number, premiumStatus: PremiumStatus): void {
  if (premiumStatus === 'free' && taskCount >= 3) {
    throw new ValidationError('Free users are limited to 3 active tasks', []);
  }
}

// Individual validation functions for models
export function validateUser(data: any) {
  return createUserSchema.validate(data);
}

export function validateUpdateUser(data: any) {
  return updateUserSchema.validate(data);
}

export function validatePlace(data: any) {
  return createPlaceSchema.validate(data);
}

export function validateUpdatePlace(data: any) {
  return updatePlaceSchema.validate(data);
}

export function validateTask(data: any) {
  return createTaskSchema.validate(data);
}

export function validateUpdateTask(data: any) {
  return updateTaskSchema.validate(data);
}

export function validateGeofence(data: any) {
  return createGeofenceSchema.validate(data);
}

export function validatePOI(data: any) {
  return createPOISchema.validate(data);
}

export function validateEvent(data: any) {
  return createEventSchema.validate(data);
}

// Simple validation helper functions for individual fields
export function validateRequired(fieldName: string, value: any): string[] {
  const errors: string[] = [];
  if (value === undefined || value === null || value === '') {
    errors.push(`${fieldName} is required`);
  }
  return errors;
}

export function validateNumber(fieldName: string, value: any, options?: { min?: number; max?: number }): string[] {
  const errors: string[] = [];
  
  if (value === undefined || value === null) {
    return errors; // Let validateRequired handle this
  }
  
  if (typeof value !== 'number' || isNaN(value)) {
    errors.push(`${fieldName} must be a valid number`);
    return errors;
  }
  
  if (options?.min !== undefined && value < options.min) {
    errors.push(`${fieldName} must be at least ${options.min}`);
  }
  
  if (options?.max !== undefined && value > options.max) {
    errors.push(`${fieldName} must be at most ${options.max}`);
  }
  
  return errors;
}

export function validateEnum(fieldName: string, value: any, validValues: string[]): string[] {
  const errors: string[] = [];
  
  if (value === undefined || value === null) {
    return errors; // Let validateRequired handle this
  }
  
  if (!validValues.includes(value)) {
    errors.push(`${fieldName} must be one of: ${validValues.join(', ')}`);
  }
  
  return errors;
}