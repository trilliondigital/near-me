import { APNsService, APNsConfig, APNsPayload } from './apnsService';
import { FCMService, FCMConfig, FCMPayload } from './fcmService';
import { PushToken } from '../models/PushToken';
import { LocationNotification, NotificationBundle } from './notificationService';
import { NotificationRetry } from '../models/NotificationRetry';
import { ValidationError } from '../models/validation';

export interface PushNotificationConfig {
  apns?: APNsConfig;
  fcm?: FCMConfig;
  useMockServices?: boolean;
}

export interface PushDeliveryResult {
  success: boolean;
  platform: 'ios' | 'android';
  deviceToken: string;
  messageId?: string;
  error?: string;
  retryable?: boolean;
}

export interface BulkPushDeliveryResult {
  totalSent: number;
  successCount: number;
  failureCount: number;
  results: PushDeliveryResult[];
  errors: string[];
}

export class PushNotificationService {
  private static config: PushNotificationConfig | null = null;
  private static initialized = false;

  /**
   * Initialize push notification service with configuration
   */
  static initialize(config: PushNotificationConfig): void {
    this.config = config;

    if (config.apns && !config.useMockServices) {
      APNsService.initialize(config.apns);
    }

    if (config.fcm && !config.useMockServices) {
      FCMService.initialize(config.fcm);
    }

    this.initialized = true;
    console.log('Push notification service initialized');
  }

  /**
   * Register device token for push notifications
   */
  static async registerDeviceToken(
    userId: string,
    deviceToken: string,
    platform: 'ios' | 'android',
    deviceId?: string,
    appVersion?: string
  ): Promise<PushToken> {
    if (!this.initialized) {
      throw new Error('Push notification service not initialized');
    }

    // Validate token format
    const isValid = platform === 'ios' 
      ? APNsService.isValidDeviceToken(deviceToken)
      : FCMService.isValidDeviceToken(deviceToken);

    if (!isValid) {
      throw new ValidationError(`Invalid ${platform} device token format`, []);
    }

    // Create or update push token
    const pushToken = await PushToken.create({
      userId,
      deviceToken,
      platform,
      deviceId,
      appVersion
    });

    console.log(`Registered ${platform} device token for user ${userId}`);
    return pushToken;
  }

  /**
   * Send push notification to a single user
   */
  static async sendNotificationToUser(
    userId: string,
    notification: LocationNotification | NotificationBundle
  ): Promise<BulkPushDeliveryResult> {
    if (!this.initialized) {
      throw new Error('Push notification service not initialized');
    }

    // Get all active push tokens for the user
    const pushTokens = await PushToken.findByUserId(userId);
    
    if (pushTokens.length === 0) {
      console.log(`No push tokens found for user ${userId}`);
      return {
        totalSent: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
        errors: ['No push tokens found for user']
      };
    }

    return this.sendNotificationToTokens(pushTokens, notification);
  }

  /**
   * Send push notification to multiple users
   */
  static async sendNotificationToUsers(
    userIds: string[],
    notification: LocationNotification | NotificationBundle
  ): Promise<BulkPushDeliveryResult> {
    if (!this.initialized) {
      throw new Error('Push notification service not initialized');
    }

    if (userIds.length === 0) {
      return {
        totalSent: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
        errors: []
      };
    }

    // Get all active push tokens for the users
    const pushTokens = await PushToken.findByUserIds(userIds);
    
    if (pushTokens.length === 0) {
      console.log(`No push tokens found for users: ${userIds.join(', ')}`);
      return {
        totalSent: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
        errors: ['No push tokens found for users']
      };
    }

    return this.sendNotificationToTokens(pushTokens, notification);
  }

  /**
   * Send push notification to specific tokens
   */
  static async sendNotificationToTokens(
    pushTokens: PushToken[],
    notification: LocationNotification | NotificationBundle
  ): Promise<BulkPushDeliveryResult> {
    if (!this.initialized) {
      throw new Error('Push notification service not initialized');
    }

    const results: PushDeliveryResult[] = [];
    const errors: string[] = [];

    // Group tokens by platform
    const iosTokens = pushTokens.filter(token => token.platform === 'ios');
    const androidTokens = pushTokens.filter(token => token.platform === 'android');

    // Send to iOS devices
    if (iosTokens.length > 0) {
      const iosResults = await this.sendToIOSDevices(iosTokens, notification);
      results.push(...iosResults.results);
      errors.push(...iosResults.errors);
    }

    // Send to Android devices
    if (androidTokens.length > 0) {
      const androidResults = await this.sendToAndroidDevices(androidTokens, notification);
      results.push(...androidResults.results);
      errors.push(...androidResults.errors);
    }

    // Update token usage
    await this.updateTokenUsage(pushTokens, results);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return {
      totalSent: results.length,
      successCount,
      failureCount,
      results,
      errors
    };
  }

  /**
   * Send notifications to iOS devices
   */
  private static async sendToIOSDevices(
    tokens: PushToken[],
    notification: LocationNotification | NotificationBundle
  ): Promise<{ results: PushDeliveryResult[]; errors: string[] }> {
    const results: PushDeliveryResult[] = [];
    const errors: string[] = [];

    try {
      // Create APNs payload
      const payload = APNsService.createPayload(notification);

      // Send to each token individually for better error handling
      for (const token of tokens) {
        try {
          const response = this.config?.useMockServices
            ? await (await import('./apnsService')).MockAPNsService.sendNotification(token.deviceToken, payload)
            : await APNsService.sendNotification(token.deviceToken, payload);

          results.push({
            success: response.success,
            platform: 'ios',
            deviceToken: token.deviceToken,
            messageId: response.apnsId,
            error: response.error,
            retryable: this.isRetryableError(response.error)
          });

          if (!response.success && response.error) {
            errors.push(`iOS token ${token.deviceToken}: ${response.error}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            success: false,
            platform: 'ios',
            deviceToken: token.deviceToken,
            error: errorMessage,
            retryable: true
          });
          errors.push(`iOS token ${token.deviceToken}: ${errorMessage}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`iOS batch error: ${errorMessage}`);
      
      // Mark all tokens as failed
      tokens.forEach(token => {
        results.push({
          success: false,
          platform: 'ios',
          deviceToken: token.deviceToken,
          error: errorMessage,
          retryable: true
        });
      });
    }

    return { results, errors };
  }

  /**
   * Send notifications to Android devices
   */
  private static async sendToAndroidDevices(
    tokens: PushToken[],
    notification: LocationNotification | NotificationBundle
  ): Promise<{ results: PushDeliveryResult[]; errors: string[] }> {
    const results: PushDeliveryResult[] = [];
    const errors: string[] = [];

    try {
      // Create FCM payload
      const payload = FCMService.createPayload(notification);

      // Send to each token individually for better error handling
      for (const token of tokens) {
        try {
          const response = this.config?.useMockServices
            ? await (await import('./fcmService')).MockFCMService.sendNotification(token.deviceToken, payload)
            : await FCMService.sendNotification(token.deviceToken, payload);

          results.push({
            success: response.success,
            platform: 'android',
            deviceToken: token.deviceToken,
            messageId: response.messageId,
            error: response.error,
            retryable: this.isRetryableError(response.error)
          });

          if (!response.success && response.error) {
            errors.push(`Android token ${token.deviceToken}: ${response.error}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({
            success: false,
            platform: 'android',
            deviceToken: token.deviceToken,
            error: errorMessage,
            retryable: true
          });
          errors.push(`Android token ${token.deviceToken}: ${errorMessage}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Android batch error: ${errorMessage}`);
      
      // Mark all tokens as failed
      tokens.forEach(token => {
        results.push({
          success: false,
          platform: 'android',
          deviceToken: token.deviceToken,
          error: errorMessage,
          retryable: true
        });
      });
    }

    return { results, errors };
  }

  /**
   * Update token usage statistics
   */
  private static async updateTokenUsage(
    tokens: PushToken[],
    results: PushDeliveryResult[]
  ): Promise<void> {
    const resultMap = new Map(results.map(r => [r.deviceToken, r]));

    for (const token of tokens) {
      const result = resultMap.get(token.deviceToken);
      
      if (result?.success) {
        // Mark token as used
        await token.markUsed();
      } else if (result?.error && this.isInvalidTokenError(result.error)) {
        // Deactivate invalid tokens
        await token.deactivate();
        console.log(`Deactivated invalid token: ${token.deviceToken}`);
      }
    }
  }

  /**
   * Check if error is retryable
   */
  private static isRetryableError(error?: string): boolean {
    if (!error) return false;
    
    const retryableErrors = [
      'timeout',
      'network',
      'server error',
      'rate limit',
      'service unavailable',
      '500',
      '502',
      '503',
      '504'
    ];

    return retryableErrors.some(retryableError => 
      error.toLowerCase().includes(retryableError)
    );
  }

  /**
   * Check if error indicates invalid token
   */
  private static isInvalidTokenError(error: string): boolean {
    const invalidTokenErrors = [
      'invalid token',
      'unregistered',
      'not found',
      'invalid registration',
      'mismatched sender',
      '400',
      '404',
      '410'
    ];

    return invalidTokenErrors.some(invalidError => 
      error.toLowerCase().includes(invalidError)
    );
  }

  /**
   * Create retry records for failed deliveries
   */
  static async createRetryRecords(
    notificationHistoryId: string,
    results: PushDeliveryResult[]
  ): Promise<NotificationRetry[]> {
    const retryRecords: NotificationRetry[] = [];

    for (const result of results) {
      if (!result.success && result.retryable) {
        const retry = await NotificationRetry.create({
          notificationHistoryId,
          maxRetries: 3
        });
        retryRecords.push(retry);
      }
    }

    return retryRecords;
  }

  /**
   * Deactivate device token
   */
  static async deactivateDeviceToken(
    userId: string,
    deviceToken: string
  ): Promise<void> {
    const pushToken = await PushToken.findByUserAndDevice(userId, deviceToken);
    if (pushToken) {
      await pushToken.deactivate();
      console.log(`Deactivated device token for user ${userId}`);
    }
  }

  /**
   * Get push token statistics
   */
  static async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byPlatform: { ios: number; android: number };
  }> {
    return PushToken.getStatistics();
  }

  /**
   * Clean up old and invalid tokens
   */
  static async cleanupTokens(): Promise<{
    inactiveRemoved: number;
    duplicatesRemoved: number;
  }> {
    const inactiveRemoved = await PushToken.cleanupInactiveTokens(30);
    const duplicatesRemoved = await PushToken.cleanupDuplicateTokens();

    console.log(`Cleaned up ${inactiveRemoved} inactive tokens and ${duplicatesRemoved} duplicate tokens`);

    return {
      inactiveRemoved,
      duplicatesRemoved
    };
  }

  /**
   * Test push notification delivery
   */
  static async testNotification(
    userId: string,
    title: string = 'Test Notification',
    body: string = 'This is a test notification from Near Me'
  ): Promise<BulkPushDeliveryResult> {
    const testNotification: LocationNotification = {
      id: `test_${Date.now()}`,
      taskId: 'test_task',
      userId,
      type: 'arrival',
      title,
      body,
      actions: [],
      scheduledTime: new Date(),
      metadata: {
        geofenceId: 'test_geofence',
        geofenceType: 'arrival',
        location: { latitude: 0, longitude: 0 }
      }
    };

    return this.sendNotificationToUser(userId, testNotification);
  }
}