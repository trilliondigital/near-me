import { PlaceEntity, CreatePlaceRequest, UpdatePlaceRequest, GeofenceRadii, PlaceType } from './types';
import { validatePlace, validateUpdatePlace } from './validation';

export class Place {
  public id: string;
  public userId: string;
  public name: string;
  public latitude: number;
  public longitude: number;
  public address?: string;
  public placeType: PlaceType;
  public defaultRadii: GeofenceRadii;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(entity: PlaceEntity) {
    this.id = entity.id;
    this.userId = entity.user_id;
    this.name = entity.name;
    this.latitude = entity.latitude;
    this.longitude = entity.longitude;
    this.address = entity.address;
    this.placeType = entity.place_type;
    this.defaultRadii = entity.default_radii;
    this.createdAt = entity.created_at;
    this.updatedAt = entity.updated_at;
  }

  public static fromCreateRequest(userId: string, request: CreatePlaceRequest): Omit<PlaceEntity, 'id' | 'created_at' | 'updated_at'> {
    const validation = validatePlace(request);
    if (validation.error) {
      throw new Error(`Invalid place data: ${validation.error.details[0].message}`);
    }

    const defaultRadii: GeofenceRadii = request.default_radii || Place.getDefaultRadiiForType(request.place_type);

    return {
      user_id: userId,
      name: request.name,
      latitude: request.latitude,
      longitude: request.longitude,
      address: request.address,
      place_type: request.place_type,
      default_radii: defaultRadii
    };
  }

  public static fromUpdateRequest(request: UpdatePlaceRequest): Partial<PlaceEntity> {
    const validation = validateUpdatePlace(request);
    if (validation.error) {
      throw new Error(`Invalid place update data: ${validation.error.details[0].message}`);
    }

    const updates: Partial<PlaceEntity> = {};
    
    if (request.name !== undefined) updates.name = request.name;
    if (request.latitude !== undefined) updates.latitude = request.latitude;
    if (request.longitude !== undefined) updates.longitude = request.longitude;
    if (request.address !== undefined) updates.address = request.address;
    if (request.place_type !== undefined) updates.place_type = request.place_type;
    if (request.default_radii !== undefined) updates.default_radii = request.default_radii;

    return updates;
  }

  public static getDefaultRadiiForType(placeType: PlaceType): GeofenceRadii {
    switch (placeType) {
      case 'home':
      case 'work':
        return {
          approach: 2, // 2 miles
          arrival: 100, // 100 meters
          postArrival: true // 5 minutes post-arrival
        };
      case 'custom':
      default:
        return {
          approach: 5, // 5 miles
          arrival: 100, // 100 meters
          postArrival: true // 5 minutes post-arrival
        };
    }
  }

  public toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      latitude: this.latitude,
      longitude: this.longitude,
      address: this.address,
      placeType: this.placeType,
      defaultRadii: this.defaultRadii,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  public getCoordinate() {
    return {
      latitude: this.latitude,
      longitude: this.longitude
    };
  }

  public distanceTo(other: { latitude: number; longitude: number }): number {
    // Haversine formula to calculate distance in miles
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(other.latitude - this.latitude);
    const dLon = this.toRadians(other.longitude - this.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(this.latitude)) * Math.cos(this.toRadians(other.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}