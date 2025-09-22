import { Client } from '@googlemaps/google-maps-services-js';
import { Coordinate } from '../models/types';

export interface GeocodingResult {
  coordinate: Coordinate;
  formattedAddress: string;
  placeId?: string;
  addressComponents: AddressComponent[];
}

export interface AddressComponent {
  longName: string;
  shortName: string;
  types: string[];
}

export interface ReverseGeocodingResult {
  formattedAddress: string;
  addressComponents: AddressComponent[];
  placeId?: string;
}

export class GeocodingService {
  private client: Client;
  private apiKey: string;

  constructor() {
    this.client = new Client({});
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('Google Maps API key not configured. Geocoding will not work.');
    }
  }

  /**
   * Geocode an address to coordinates
   */
  async geocodeAddress(address: string): Promise<GeocodingResult | null> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const response = await this.client.geocode({
        params: {
          address,
          key: this.apiKey,
        },
      });

      if (response.data.results.length === 0) {
        return null;
      }

      const result = response.data.results[0];
      const location = result.geometry.location;

      return {
        coordinate: {
          latitude: location.lat,
          longitude: location.lng,
        },
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
        addressComponents: result.address_components.map(component => ({
          longName: component.long_name,
          shortName: component.short_name,
          types: component.types,
        })),
      };
    } catch (error) {
      console.error('Geocoding error:', error);
      throw new Error('Failed to geocode address');
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(coordinate: Coordinate): Promise<ReverseGeocodingResult | null> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const response = await this.client.reverseGeocode({
        params: {
          latlng: `${coordinate.latitude},${coordinate.longitude}`,
          key: this.apiKey,
        },
      });

      if (response.data.results.length === 0) {
        return null;
      }

      const result = response.data.results[0];

      return {
        formattedAddress: result.formatted_address,
        placeId: result.place_id,
        addressComponents: result.address_components.map(component => ({
          longName: component.long_name,
          shortName: component.short_name,
          types: component.types,
        })),
      };
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      throw new Error('Failed to reverse geocode coordinates');
    }
  }

  /**
   * Validate coordinates by attempting reverse geocoding
   */
  async validateCoordinates(coordinate: Coordinate): Promise<boolean> {
    try {
      const result = await this.reverseGeocode(coordinate);
      return result !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get place details by place ID
   */
  async getPlaceDetails(placeId: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const response = await this.client.placeDetails({
        params: {
          place_id: placeId,
          key: this.apiKey,
        },
      });

      return response.data.result;
    } catch (error) {
      console.error('Place details error:', error);
      throw new Error('Failed to get place details');
    }
  }

  /**
   * Calculate distance between two coordinates in miles
   */
  static calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
    const R = 3959; // Earth's radius in miles
    const dLat = GeocodingService.toRadians(coord2.latitude - coord1.latitude);
    const dLon = GeocodingService.toRadians(coord2.longitude - coord1.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(GeocodingService.toRadians(coord1.latitude)) * 
              Math.cos(GeocodingService.toRadians(coord2.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}