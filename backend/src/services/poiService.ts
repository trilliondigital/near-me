import axios from 'axios';
import { POI } from '../models/POI';
import { POICategory, Coordinate, CreatePOIRequest } from '../models/types';
import { GeocodingService } from './geocodingService';

export interface ExternalPOI {
  id: string;
  name: string;
  category: POICategory;
  coordinate: Coordinate;
  address?: string;
  distance?: number;
  verified: boolean;
  source: string;
}

export interface POISearchOptions {
  coordinate: Coordinate;
  category?: POICategory;
  radius: number; // in miles
  limit?: number;
  includeUnverified?: boolean;
}

export class POIService {
  private foursquareApiKey: string;
  private googlePlacesApiKey: string;

  constructor() {
    this.foursquareApiKey = process.env.FOURSQUARE_API_KEY || '';
    this.googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
  }

  /**
   * Search for POIs near a location
   */
  async searchNearbyPOIs(options: POISearchOptions): Promise<ExternalPOI[]> {
    const results: ExternalPOI[] = [];

    // Try Foursquare first
    if (this.foursquareApiKey) {
      try {
        const foursquarePOIs = await this.searchFoursquare(options);
        results.push(...foursquarePOIs);
      } catch (error) {
        console.error('Foursquare search failed:', error);
      }
    }

    // Fallback to Google Places
    if (this.googlePlacesApiKey && results.length === 0) {
      try {
        const googlePOIs = await this.searchGooglePlaces(options);
        results.push(...googlePOIs);
      } catch (error) {
        console.error('Google Places search failed:', error);
      }
    }

    // Sort by distance and apply limit
    const sortedResults = results
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, options.limit || 20);

    return sortedResults;
  }

  /**
   * Search Foursquare for POIs
   */
  private async searchFoursquare(options: POISearchOptions): Promise<ExternalPOI[]> {
    const categoryMap = this.getFoursquareCategoryMap();
    const categoryId = options.category ? categoryMap[options.category] : undefined;

    const params: any = {
      ll: `${options.coordinate.latitude},${options.coordinate.longitude}`,
      radius: Math.round(options.radius * 1609.34), // Convert miles to meters
      limit: options.limit || 20,
    };

    if (categoryId) {
      params.categories = categoryId;
    }

    try {
      const response = await axios.get('https://api.foursquare.com/v3/places/search', {
        headers: {
          'Authorization': this.foursquareApiKey,
          'Accept': 'application/json',
        },
        params,
      });

      return response.data.results.map((place: any) => {
        const coordinate: Coordinate = {
          latitude: place.geocodes.main.latitude,
          longitude: place.geocodes.main.longitude,
        };

        const distance = GeocodingService.calculateDistance(options.coordinate, coordinate);
        const category = this.mapFoursquareCategory(place.categories?.[0]?.id);

        return {
          id: `foursquare_${place.fsq_id}`,
          name: place.name,
          category: category || 'grocery', // Default fallback
          coordinate,
          address: place.location?.formatted_address,
          distance,
          verified: place.verified || false,
          source: 'foursquare',
        };
      }).filter((poi: ExternalPOI) => poi.category); // Filter out unmapped categories
    } catch (error) {
      console.error('Foursquare API error:', error);
      throw new Error('Failed to search Foursquare POIs');
    }
  }

  /**
   * Search Google Places for POIs
   */
  private async searchGooglePlaces(options: POISearchOptions): Promise<ExternalPOI[]> {
    const placeType = options.category ? this.getGooglePlaceType(options.category) : undefined;

    const params: any = {
      location: `${options.coordinate.latitude},${options.coordinate.longitude}`,
      radius: Math.round(options.radius * 1609.34), // Convert miles to meters
      key: this.googlePlacesApiKey,
    };

    if (placeType) {
      params.type = placeType;
    }

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
        params,
      });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      return response.data.results.map((place: any) => {
        const coordinate: Coordinate = {
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
        };

        const distance = GeocodingService.calculateDistance(options.coordinate, coordinate);
        const category = this.mapGooglePlaceType(place.types);

        return {
          id: `google_${place.place_id}`,
          name: place.name,
          category: category || 'grocery', // Default fallback
          coordinate,
          address: place.vicinity,
          distance,
          verified: place.business_status === 'OPERATIONAL',
          source: 'google_places',
        };
      }).filter((poi: ExternalPOI) => poi.category); // Filter out unmapped categories
    } catch (error) {
      console.error('Google Places API error:', error);
      throw new Error('Failed to search Google Places POIs');
    }
  }

  /**
   * Get POIs by category within radius
   */
  async getPOIsByCategory(coordinate: Coordinate, category: POICategory, radiusMiles: number = 10): Promise<ExternalPOI[]> {
    return this.searchNearbyPOIs({
      coordinate,
      category,
      radius: radiusMiles,
      limit: 50,
    });
  }

  /**
   * Find the closest POI of a specific category
   */
  async findClosestPOI(coordinate: Coordinate, category: POICategory, maxRadiusMiles: number = 25): Promise<ExternalPOI | null> {
    const pois = await this.getPOIsByCategory(coordinate, category, maxRadiusMiles);
    return pois.length > 0 ? pois[0] : null;
  }

  /**
   * Convert external POI to internal POI creation request
   */
  static externalPOIToCreateRequest(externalPOI: ExternalPOI): CreatePOIRequest {
    return {
      external_id: externalPOI.id,
      name: externalPOI.name,
      category: externalPOI.category,
      latitude: externalPOI.coordinate.latitude,
      longitude: externalPOI.coordinate.longitude,
      address: externalPOI.address,
      verified: externalPOI.verified,
      source: externalPOI.source,
    };
  }

  /**
   * Get Foursquare category mapping
   */
  private getFoursquareCategoryMap(): Record<POICategory, string> {
    return {
      gas: '17069', // Gas Station
      pharmacy: '17031', // Pharmacy
      grocery: '17069', // Grocery Store
      bank: '10023', // Bank
      post_office: '19007', // Post Office
    };
  }

  /**
   * Map Foursquare category ID to our POI category
   */
  private mapFoursquareCategory(categoryId: string): POICategory | null {
    const reverseMap: Record<string, POICategory> = {
      '17069': 'gas',
      '17031': 'pharmacy',
      '17003': 'grocery',
      '10023': 'bank',
      '19007': 'post_office',
    };
    return reverseMap[categoryId] || null;
  }

  /**
   * Get Google Places type for POI category
   */
  private getGooglePlaceType(category: POICategory): string {
    const typeMap: Record<POICategory, string> = {
      gas: 'gas_station',
      pharmacy: 'pharmacy',
      grocery: 'grocery_or_supermarket',
      bank: 'bank',
      post_office: 'post_office',
    };
    return typeMap[category];
  }

  /**
   * Map Google Places types to our POI category
   */
  private mapGooglePlaceType(types: string[]): POICategory | null {
    const typeMap: Record<string, POICategory> = {
      gas_station: 'gas',
      pharmacy: 'pharmacy',
      grocery_or_supermarket: 'grocery',
      supermarket: 'grocery',
      bank: 'bank',
      post_office: 'post_office',
    };

    for (const type of types) {
      if (typeMap[type]) {
        return typeMap[type];
      }
    }
    return null;
  }

  /**
   * Get all supported POI categories
   */
  static getSupportedCategories(): POICategory[] {
    return ['gas', 'pharmacy', 'grocery', 'bank', 'post_office'];
  }

  /**
   * Validate if a category is supported
   */
  static isSupportedCategory(category: string): category is POICategory {
    return POIService.getSupportedCategories().includes(category as POICategory);
  }
}