// Core type definitions for Near Me application

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface TimeRange {
  start: string; // HH:MM format
  end: string;   // HH:MM format
}

export interface GeofenceRadii {
  approach: number; // miles
  arrival: number;  // meters
  postArrival: boolean;
}

export type POICategory = 'gas' | 'pharmacy' | 'grocery' | 'bank' | 'post_office';
export type PremiumStatus = 'free' | 'trial' | 'premium';
export type TaskStatus = 'active' | 'completed' | 'muted';
export type PlaceType = 'home' | 'work' | 'custom';
export type LocationType = 'custom_place' | 'poi_category';
export type GeofenceType = 'approach_5mi' | 'approach_3mi' | 'approach_1mi' | 'arrival' | 'post_arrival';
export type GeofenceEventType = 'enter' | 'exit' | 'dwell';
export type GeofenceEventStatus = 'pending' | 'processed' | 'failed' | 'duplicate' | 'cooldown';
export type NotificationStyle = 'minimal' | 'standard' | 'detailed';
export type PrivacyMode = 'standard' | 'foreground_only';

export interface UserPreferences {
  quietHours?: TimeRange;
  defaultRadii?: GeofenceRadii;
  notificationStyle: NotificationStyle;
  privacyMode: PrivacyMode;
}

// Database entity interfaces
export interface UserEntity {
  id: string;
  device_id: string;
  email?: string;
  preferences: UserPreferences;
  premium_status: PremiumStatus;
  created_at: Date;
  updated_at: Date;
}

export interface PlaceEntity {
  id: string;
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  place_type: PlaceType;
  default_radii: GeofenceRadii;
  created_at: Date;
  updated_at: Date;
}

export interface TaskEntity {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  location_type: LocationType;
  place_id?: string;
  poi_category?: POICategory;
  custom_radii?: GeofenceRadii;
  status: TaskStatus;
  created_at: Date;
  completed_at?: Date;
  updated_at: Date;
}

export interface GeofenceEntity {
  id: string;
  task_id: string;
  latitude: number;
  longitude: number;
  radius: number; // meters
  geofence_type: GeofenceType;
  is_active: boolean;
  created_at: Date;
}

export interface POIEntity {
  id: string;
  external_id?: string;
  name: string;
  category: POICategory;
  latitude: number;
  longitude: number;
  address?: string;
  verified: boolean;
  source: string;
  last_updated: Date;
}

export interface EventEntity {
  id: string;
  user_id?: string;
  event_type: string;
  event_data?: Record<string, any>;
  session_id?: string;
  timestamp: Date;
}

export interface GeofenceEventEntity {
  id: string;
  user_id: string;
  task_id: string;
  geofence_id: string;
  event_type: GeofenceEventType;
  latitude: number;
  longitude: number;
  confidence: number;
  status: GeofenceEventStatus;
  processed_at?: Date;
  notification_sent: boolean;
  bundled_with?: string;
  cooldown_until?: Date;
  created_at: Date;
}

// Request/Response DTOs
export interface CreateUserRequest {
  device_id: string;
  email?: string;
  preferences?: Partial<UserPreferences>;
}

export interface UpdateUserRequest {
  email?: string;
  preferences?: Partial<UserPreferences>;
  premium_status?: PremiumStatus;
}

export interface CreatePlaceRequest {
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  place_type: PlaceType;
  default_radii?: GeofenceRadii;
}

export interface UpdatePlaceRequest {
  name?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  place_type?: PlaceType;
  default_radii?: GeofenceRadii;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  location_type: LocationType;
  place_id?: string;
  poi_category?: POICategory;
  custom_radii?: GeofenceRadii;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  location_type?: LocationType;
  place_id?: string;
  poi_category?: POICategory;
  custom_radii?: GeofenceRadii;
  status?: TaskStatus;
}

export interface CreateGeofenceRequest {
  task_id: string;
  latitude: number;
  longitude: number;
  radius: number;
  geofence_type: GeofenceType;
}

export interface CreatePOIRequest {
  external_id?: string;
  name: string;
  category: POICategory;
  latitude: number;
  longitude: number;
  address?: string;
  verified?: boolean;
  source: string;
}

export interface CreateEventRequest {
  user_id?: string;
  event_type: string;
  event_data?: Record<string, any>;
  session_id?: string;
}

export interface CreateGeofenceEventRequest {
  user_id: string;
  task_id: string;
  geofence_id: string;
  event_type: GeofenceEventType;
  location: Coordinate;
  confidence?: number;
}