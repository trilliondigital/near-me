import { PushNotificationToken } from '../models/types';
import { LocationNotification, NotificationBundle } from './notificationService';

export interface FCMConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
  serverKey?: string; // Legacy server key for HTTP v1 API
}

export interface FCMPayload {
  message: {
    token?: string;
    tokens?: string[];
    notification?: {
      title: string;
      body: string;
    };
    data?: Record<string, string>;
    android?: {
      priority: 'normal' | 'high';
      notification?: {
        icon?: string;
        color?: string;
        sound?: string;
        tag?: string;
        click_action?: string;
        body_loc_key?: string;
        body_loc_args?: string[];
        title_loc_key?: string;
        title_loc_args?: string[];
      };
    };
    apns?: {
      headers?: Record<string, string>;
      payload?: {
        aps?: {
          alert?: {
            title?: string;
            body?: string;
          };
          badge?: number;
          sound?: string;
          category?: string;
          'content-available'?: number;
        };
      };
    };
  };
}

export interface FCMResponse {
  success: boolean;
  error?: string;
  messageId?: string;
  failureCount?: number;
  successCount?: number;
  responses?: Array<{
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

export class FCMService {
  private static config: FCMConfig | null = null;
  private static accessToken: string | null = null;
  private static tokenExpiry: Date | null = null;

  /**
   * Initialize FCM service with configuration
   */
  static initialize(config: FCMConfig): void {
    this.config = config;
  }

  /**
   * Send push notification to Android device
   */
  static async sendNotification(
    deviceToken: string,
    payload: FCMPayload
  ): Promise<FCMResponse> {
    if (!this.config) {
      return {
        success: false,
        error: 'FCM service not initialized'
      };
    }

    try {
      // Get or refresh access token
      const token = await this.getAccessToken();
      if (!token) {
        return {
          success: false,
          error: 'Failed to get FCM access token'
        };
      }

      // Set the device token in the payload
      payload.message.token = deviceToken;

      // Prepare FCM request
      const url = `https://fcm.googleapis.com/v1/projects/${this.config.projectId}/messages:send`;
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const responseData = await response.json();
        return {
          success: true,
          messageId: responseData.name
        };
      } else {
        const errorData = await response.text();
        return {
          success: false,
          error: `FCM error: ${response.status} - ${errorData}`
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
    payload: Omit<FCMPayload, 'message'> & { 
      message: Omit<FCMPayload['message'], 'token' | 'tokens'> 
    }
  ): Promise<FCMResponse> {
    if (!this.config) {
      return {
        success: false,
        error: 'FCM service not initialized'
      };
    }

    if (tokens.length === 0) {
      return {
        success: true,
        successCount: 0,
        failureCount: 0,
        responses: []
      };
    }

    try {
      // For bulk sending, we'll send individual requests
      // FCM HTTP v1 API doesn't support multicast like the legacy API
      const results = await Promise.allSettled(
        tokens.map(token => this.sendNotification(token, {
          message: {
            ...payload.message,
            token
          }
        }))
      );

      let successCount = 0;
      let failureCount = 0;
      const responses: Array<{
        success: boolean;
        messageId?: string;
        error?: string;
      }> = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
          responses.push({
            success: true,
            messageId: result.value.messageId
          });
        } else {
          failureCount++;
          const error = result.status === 'fulfilled' 
            ? result.value.error 
            : `Token ${index}: ${result.reason}`;
          responses.push({
            success: false,
            error
          });
        }
      });

      return {
        success: successCount > 0,
        successCount,
        failureCount,
        responses
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Convert notification to FCM payload
   */
  static createPayload(
    notification: LocationNotification | NotificationBundle,
    customData?: Record<string, any>
  ): FCMPayload {
    const data: Record<string, string> = {
      task_id: notification.taskId,
      notification_id: notification.id,
      action_type: notification.type,
      title: notification.title,
      body: notification.body
    };

    // Add custom data (convert all values to strings for FCM data payload)
    if (customData) {
      Object.entries(customData).forEach(([key, value]) => {
        data[key] = String(value);
      });
    }

    // Add metadata if available
    if ('metadata' in notification && notification.metadata) {
      if (notification.metadata.placeName) {
        data.place_name = notification.metadata.placeName;
      }
      if (notification.metadata.category) {
        data.category = notification.metadata.category;
      }
      if (notification.metadata.distance !== undefined) {
        data.distance = String(notification.metadata.distance);
      }
    }

    const payload: FCMPayload = {
      message: {
        notification: {
          title: notification.title,
          body: notification.body
        },
        data,
        android: {
          priority: 'high',
          notification: {
            icon: 'ic_notification',
            color: '#2196F3',
            sound: 'default',
            tag: `task_${notification.taskId}`,
            click_action: 'FLUTTER_NOTIFICATION_CLICK'
          }
        }
      }
    };

    return payload;
  }

  /**
   * Get or refresh access token for FCM authentication
   */
  private static async getAccessToken(): Promise<string | null> {
    if (!this.config) return null;

    // Check if current token is still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      // Generate new access token using service account
      const jwt = await this.generateJWT();
      const tokenResponse = await this.exchangeJWTForAccessToken(jwt);
      
      this.accessToken = tokenResponse.access_token;
      this.tokenExpiry = new Date(Date.now() + (tokenResponse.expires_in - 60) * 1000); // 1 minute buffer
      
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get FCM access token:', error);
      return null;
    }
  }

  /**
   * Generate JWT for service account authentication
   */
  private static async generateJWT(): Promise<string> {
    if (!this.config) {
      throw new Error('FCM configuration not set');
    }

    // This is a simplified JWT generation
    // In production, you should use a proper JWT library like 'jsonwebtoken'
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.config.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600, // 1 hour
      iat: now
    };

    // For now, return a mock JWT
    // In production, you would sign this with your private key
    const mockJWT = Buffer.from(JSON.stringify({ header, payload })).toString('base64');
    return mockJWT;
  }

  /**
   * Exchange JWT for access token
   */
  private static async exchangeJWTForAccessToken(jwt: string): Promise<{
    access_token: string;
    expires_in: number;
    token_type: string;
  }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange JWT for access token: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Validate device token format
   */
  static isValidDeviceToken(token: string): boolean {
    // FCM tokens are typically 152+ characters and contain specific patterns
    return token.length >= 140 && /^[A-Za-z0-9_-]+$/.test(token);
  }

  /**
   * Subscribe token to topic
   */
  static async subscribeToTopic(token: string, topic: string): Promise<FCMResponse> {
    if (!this.config) {
      return {
        success: false,
        error: 'FCM service not initialized'
      };
    }

    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        return {
          success: false,
          error: 'Failed to get FCM access token'
        };
      }

      const response = await fetch(
        `https://iid.googleapis.com/iid/v1/${token}/rel/topics/${topic}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        return { success: true };
      } else {
        const errorData = await response.text();
        return {
          success: false,
          error: `Failed to subscribe to topic: ${errorData}`
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
   * Unsubscribe token from topic
   */
  static async unsubscribeFromTopic(token: string, topic: string): Promise<FCMResponse> {
    if (!this.config) {
      return {
        success: false,
        error: 'FCM service not initialized'
      };
    }

    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        return {
          success: false,
          error: 'Failed to get FCM access token'
        };
      }

      const response = await fetch(
        `https://iid.googleapis.com/iid/v1/${token}/rel/topics/${topic}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        return { success: true };
      } else {
        const errorData = await response.text();
        return {
          success: false,
          error: `Failed to unsubscribe from topic: ${errorData}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Mock implementation for development/testing
export class MockFCMService {
  static async sendNotification(
    deviceToken: string,
    payload: FCMPayload
  ): Promise<FCMResponse> {
    console.log(`[MOCK FCM] Sending to ${deviceToken}:`, payload);
    
    // Simulate occasional failures for testing
    if (Math.random() < 0.05) { // 5% failure rate
      return {
        success: false,
        error: 'Mock FCM service failure'
      };
    }

    return {
      success: true,
      messageId: `mock-${Date.now()}`
    };
  }

  static async sendBulkNotifications(
    tokens: string[],
    payload: Omit<FCMPayload, 'message'> & { 
      message: Omit<FCMPayload['message'], 'token' | 'tokens'> 
    }
  ): Promise<FCMResponse> {
    console.log(`[MOCK FCM] Sending bulk to ${tokens.length} devices:`, payload);
    
    const results = await Promise.allSettled(
      tokens.map(token => this.sendNotification(token, {
        message: {
          ...payload.message,
          token
        }
      }))
    );

    let successCount = 0;
    let failureCount = 0;
    const responses: Array<{
      success: boolean;
      messageId?: string;
      error?: string;
    }> = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
        responses.push({
          success: true,
          messageId: result.value.messageId
        });
      } else {
        failureCount++;
        const error = result.status === 'fulfilled' 
          ? result.value.error 
          : `Token ${index}: ${result.reason}`;
        responses.push({
          success: false,
          error
        });
      }
    });

    return {
      success: successCount > 0,
      successCount,
      failureCount,
      responses
    };
  }
}