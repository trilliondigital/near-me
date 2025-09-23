import { PushNotificationToken } from '../models/types';
import { LocationNotification, NotificationBundle } from './notificationService';

export interface APNsConfig {
  teamId: string;
  keyId: string;
  bundleId: string;
  privateKey: string;
  environment: 'development' | 'production';
}

export interface APNsPayload {
  aps: {
    alert: {
      title: string;
      body: string;
    };
    sound?: string;
    badge?: number;
    category?: string;
    'content-available'?: number;
    'mutable-content'?: number;
  };
  task_id?: string;
  notification_id?: string;
  action_type?: string;
}

export interface APNsResponse {
  success: boolean;
  error?: string;
  apnsId?: string;
}

export class APNsService {
  private static config: APNsConfig | null = null;
  private static jwtToken: string | null = null;
  private static tokenExpiry: Date | null = null;

  /**
   * Initialize APNs service with configuration
   */
  static initialize(config: APNsConfig): void {
    this.config = config;
  }

  /**
   * Send push notification to iOS device
   */
  static async sendNotification(
    deviceToken: string,
    payload: APNsPayload
  ): Promise<APNsResponse> {
    if (!this.config) {
      return {
        success: false,
        error: 'APNs service not initialized'
      };
    }

    try {
      // Get or refresh JWT token
      const token = await this.getJWTToken();
      if (!token) {
        return {
          success: false,
          error: 'Failed to generate JWT token'
        };
      }

      // Prepare APNs request
      const url = this.getAPNsURL();
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'apns-push-type': 'alert',
        'apns-expiration': '0', // No expiration
        'apns-priority': '10' // High priority
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const apnsId = response.headers.get('apns-id');
        return {
          success: true,
          apnsId: apnsId || undefined
        };
      } else {
        const errorData = await response.text();
        return {
          success: false,
          error: `APNs error: ${response.status} - ${errorData}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send notification to multiple devices
   */
  static async sendBulkNotifications(
    tokens: string[],
    payload: APNsPayload
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = await Promise.allSettled(
      tokens.map(token => this.sendNotification(token, payload))
    );

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        success++;
      } else {
        failed++;
        const error = result.status === 'fulfilled' 
          ? result.value.error 
          : `Token ${index}: ${result.reason}`;
        if (error) errors.push(error);
      }
    });

    return { success, failed, errors };
  }

  /**
   * Convert notification to APNs payload
   */
  static createPayload(
    notification: LocationNotification | NotificationBundle,
    customData?: Record<string, any>
  ): APNsPayload {
    const isLocation = 'type' in notification;
    const payload: APNsPayload = {
      aps: {
        alert: {
          title: notification.title,
          body: notification.body
        },
        sound: 'default',
        category: 'LOCATION_REMINDER'
      },
      task_id: isLocation ? (notification as LocationNotification).taskId : undefined,
      notification_id: notification.id,
      action_type: isLocation ? (notification as LocationNotification).type : 'bundle'
    };

    // Add custom data
    if (customData) {
      Object.assign(payload, customData);
    }

    return payload;
  }

  /**
   * Get or refresh JWT token for APNs authentication
   */
  private static async getJWTToken(): Promise<string | null> {
    if (!this.config) return null;

    // Check if current token is still valid
    if (this.jwtToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.jwtToken;
    }

    try {
      // Generate new JWT token
      const jwt = await this.generateJWT();
      this.jwtToken = jwt;
      this.tokenExpiry = new Date(Date.now() + 50 * 60 * 1000); // 50 minutes
      return jwt;
    } catch (error) {
      console.error('Failed to generate JWT token:', error);
      return null;
    }
  }

  /**
   * Generate JWT token for APNs authentication
   */
  private static async generateJWT(): Promise<string> {
    if (!this.config) {
      throw new Error('APNs configuration not set');
    }

    // This is a simplified JWT generation
    // In production, you should use a proper JWT library like 'jsonwebtoken'
    const header = {
      alg: 'ES256',
      kid: this.config.keyId
    };

    const payload = {
      iss: this.config.teamId,
      iat: Math.floor(Date.now() / 1000)
    };

    // For now, return a mock token
    // In production, you would sign this with your private key
    const mockToken = Buffer.from(JSON.stringify({ header, payload })).toString('base64');
    return mockToken;
  }

  /**
   * Get APNs URL based on environment
   */
  private static getAPNsURL(): string {
    if (!this.config) {
      throw new Error('APNs configuration not set');
    }

    const baseURL = this.config.environment === 'production' 
      ? 'https://api.push.apple.com'
      : 'https://api.sandbox.push.apple.com';

    return `${baseURL}/3/device/`;
  }

  /**
   * Validate device token format
   */
  static isValidDeviceToken(token: string): boolean {
    // APNs device tokens are 64 hex characters
    return /^[0-9a-fA-F]{64}$/.test(token);
  }
}

// Mock implementation for development/testing
export class MockAPNsService {
  static async sendNotification(
    deviceToken: string,
    payload: APNsPayload
  ): Promise<APNsResponse> {
    console.log(`[MOCK APNs] Sending to ${deviceToken}:`, payload);
    
    // Simulate occasional failures for testing
    if (Math.random() < 0.05) { // 5% failure rate
      return {
        success: false,
        error: 'Mock APNs service failure'
      };
    }

    return {
      success: true,
      apnsId: `mock-${Date.now()}`
    };
  }

  static async sendBulkNotifications(
    tokens: string[],
    payload: APNsPayload
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    console.log(`[MOCK APNs] Sending bulk to ${tokens.length} devices:`, payload);
    
    const results = await Promise.allSettled(
      tokens.map(token => this.sendNotification(token, payload))
    );

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        success++;
      } else {
        failed++;
        const error = result.status === 'fulfilled' 
          ? result.value.error 
          : `Token ${index}: ${result.reason}`;
        if (error) errors.push(error);
      }
    });

    return { success, failed, errors };
  }
}
