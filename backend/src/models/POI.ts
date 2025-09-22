import { POIEntity, CreatePOIRequest, POICategory, Coordinate } from './types';
import { validatePOI } from './validation';

export class POI {
  public id: string;
  public externalId?: string;
  public name: string;
  public category: POICategory;
  public latitude: number;
  public longitude: number;
  public address?: string;
  public verified: boolean;
  public source: string;
  public lastUpdated: Date;

  constructor(entity: POIEntity) {
    this.id = entity.id;
    this.externalId = entity.external_id;
    this.name = entity.name;
    this.category = entity.category;
    this.latitude = entity.latitude;
    this.longitude = entity.longitude;
    this.address = entity.address;
    this.verified = entity.verified;
    this.source = entity.source;
    this.lastUpdated = entity.last_updated;
  }

  public static fromCreateRequest(request: CreatePOIRequest): Omit<POIEntity, 'id' | 'last_updated'> {
    const validation = validatePOI(request);
    if (validation.error) {
      throw new Error(`Invalid POI data: ${validation.error.details[0].message}`);
    }

    return {
      external_id: request.external_id,
      name: request.name,
      category: request.category,
      latitude: request.latitude,
      longitude: request.longitude,
      address: request.address,
      verified: request.verified || false,
      source: request.source
    };
  }

  public toJSON() {
    return {
      id: this.id,
      externalId: this.externalId,
      name: this.name,
      category: this.category,
      latitude: this.latitude,
      longitude: this.longitude,
      address: this.address,
      verified: this.verified,
      source: this.source,
      lastUpdated: this.lastUpdated
    };
  }

  public getCoordinate(): Coordinate {
    return {
      latitude: this.latitude,
      longitude: this.longitude
    };
  }

  public distanceTo(coordinate: Coordinate): number {
    // Haversine formula to calculate distance in miles
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(coordinate.latitude - this.latitude);
    const dLon = this.toRadians(coordinate.longitude - this.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(this.latitude)) * Math.cos(this.toRadians(coordinate.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  public static getCategoryDisplayName(category: POICategory): string {
    const displayNames: Record<POICategory, string> = {
      gas: 'Gas Station',
      pharmacy: 'Pharmacy',
      grocery: 'Grocery Store',
      bank: 'Bank',
      post_office: 'Post Office'
    };
    return displayNames[category];
  }

  public static getAllCategories(): POICategory[] {
    return ['gas', 'pharmacy', 'grocery', 'bank', 'post_office'];
  }

  public static isValidCategory(category: string): category is POICategory {
    return POI.getAllCategories().includes(category as POICategory);
  }
}