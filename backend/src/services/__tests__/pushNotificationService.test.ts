import { PushNotificationService } from '../pushNotificationService';
import { PushToken } from '../../models/PushToken';
import { LocationNotification } from '../notificationService';

// Mock the dependencies
jest.mock('../../models/PushToken');
jest.mock('../apnsService');
jest.mock('../fcmService');

const mockPushToken = PushToken as jest.Mocked<typeof PushToken>;

describe('PushNotificationService', () => {
  const mockConfig = {
    apns: {
      teamId: 'test-team-id',
      keyId: 'test-key-id',
      bundleId: 'com.nearme.app',
      privateKey: 'test-private-key',
      environment: 'development' as const
    },
    fcm: {
      projectId: 'test-project-id',
      privateKey: 'test-private-key',
      clientEmail: 'test@test.com'
    },
    useMockServices: true
  };

  const mockNotification: LocationNotification = {
    id: 'test-notification-id',
    taskId: 'test-task-id',
    userId: 'test-user-id',
    type: 'arrival',
    title: 'Test Notification',
    body: 'This is a test notification',
    actions: [],
    scheduledTime: new Date(),
    metadata: {
      geofenceId: 'test-geofence-id',
      geofenceType: 'arrival',
      location: { latitude: 37.7749, longitude: -122.4194 }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    PushNotificationService.initialize(mockConfig);
  });

  describe('initialize', () => {
    it('should initialize the service with configuration', () => {
      expect(() => PushNotificationService.initialize(mockConfig)).not.toThrow();
    });
  });

  describe('registerDeviceToken', () => {
    it('should register a valid iOS device token', async () => {
      const mockToken = {
        id: 'test-id',
        userId: 'test-user-id',
        deviceToken: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        platform: 'ios' as const,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPushToken.create.mockResolvedValue(mockToken as any);

      const result = await PushNotificationService.registerDeviceToken(
        'test-user-id',
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        'ios'
      );

      expect(result).toEqual(mockToken);
      expect(mockPushToken.create).toHaveBeenCalledWith({
        userId: 'test-user-id',
        deviceToken: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        platform: 'ios',
        deviceId: undefined,
        appVersion: undefined
      });
    });

    it('should register a valid Android device token', async () => {
      const longToken = 'a'.repeat(152); // FCM tokens are typically 152+ characters
      const mockToken = {
        id: 'test-id',
        userId: 'test-user-id',
        deviceToken: longToken,
        platform: 'android' as const,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPushToken.create.mockResolvedValue(mockToken as any);

      const result = await PushNotificationService.registerDeviceToken(
        'test-user-id',
        longToken,
        'android'
      );

      expect(result).toEqual(mockToken);
    });

    it('should throw error for invalid token format', async () => {
      await expect(
        PushNotificationService.registerDeviceToken(
          'test-user-id',
          'invalid-token',
          'ios'
        )
      ).rejects.toThrow('Invalid ios device token format');
    });
  });

  describe('sendNotificationToUser', () => {
    it('should send notification to user with push tokens', async () => {
      const mockTokens = [
        {
          id: 'token-1',
          userId: 'test-user-id',
          deviceToken: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          platform: 'ios' as const,
          isActive: true,
          markUsed: jest.fn()
        },
        {
          id: 'token-2',
          userId: 'test-user-id',
          deviceToken: 'a'.repeat(152),
          platform: 'android' as const,
          isActive: true,
          markUsed: jest.fn()
        }
      ];

      mockPushToken.findByUserId.mockResolvedValue(mockTokens as any);

      const result = await PushNotificationService.sendNotificationToUser(
        'test-user-id',
        mockNotification
      );

      expect(result.totalSent).toBe(2);
      expect(mockPushToken.findByUserId).toHaveBeenCalledWith('test-user-id');
    });

    it('should return empty result when user has no push tokens', async () => {
      mockPushToken.findByUserId.mockResolvedValue([]);

      const result = await PushNotificationService.sendNotificationToUser(
        'test-user-id',
        mockNotification
      );

      expect(result.totalSent).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.errors).toContain('No push tokens found for user');
    });
  });

  describe('sendNotificationToUsers', () => {
    it('should send notification to multiple users', async () => {
      const mockTokens = [
        {
          id: 'token-1',
          userId: 'user-1',
          deviceToken: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          platform: 'ios' as const,
          isActive: true,
          markUsed: jest.fn()
        },
        {
          id: 'token-2',
          userId: 'user-2',
          deviceToken: 'a'.repeat(152),
          platform: 'android' as const,
          isActive: true,
          markUsed: jest.fn()
        }
      ];

      mockPushToken.findByUserIds.mockResolvedValue(mockTokens as any);

      const result = await PushNotificationService.sendNotificationToUsers(
        ['user-1', 'user-2'],
        mockNotification
      );

      expect(result.totalSent).toBe(2);
      expect(mockPushToken.findByUserIds).toHaveBeenCalledWith(['user-1', 'user-2']);
    });

    it('should handle empty user list', async () => {
      const result = await PushNotificationService.sendNotificationToUsers(
        [],
        mockNotification
      );

      expect(result.totalSent).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
    });
  });

  describe('testNotification', () => {
    it('should send test notification', async () => {
      const mockTokens = [
        {
          id: 'token-1',
          userId: 'test-user-id',
          deviceToken: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          platform: 'ios' as const,
          isActive: true,
          markUsed: jest.fn()
        }
      ];

      mockPushToken.findByUserId.mockResolvedValue(mockTokens as any);

      const result = await PushNotificationService.testNotification(
        'test-user-id',
        'Test Title',
        'Test Body'
      );

      expect(result.totalSent).toBe(1);
      expect(mockPushToken.findByUserId).toHaveBeenCalledWith('test-user-id');
    });
  });

  describe('deactivateDeviceToken', () => {
    it('should deactivate device token', async () => {
      const mockToken = {
        id: 'token-1',
        userId: 'test-user-id',
        deviceToken: 'test-token',
        platform: 'ios' as const,
        isActive: true,
        deactivate: jest.fn()
      };

      mockPushToken.findByUserAndDevice.mockResolvedValue(mockToken as any);

      await PushNotificationService.deactivateDeviceToken('test-user-id', 'test-token');

      expect(mockPushToken.findByUserAndDevice).toHaveBeenCalledWith('test-user-id', 'test-token');
      expect(mockToken.deactivate).toHaveBeenCalled();
    });

    it('should handle non-existent token gracefully', async () => {
      mockPushToken.findByUserAndDevice.mockResolvedValue(null);

      await expect(
        PushNotificationService.deactivateDeviceToken('test-user-id', 'test-token')
      ).resolves.not.toThrow();
    });
  });

  describe('getStatistics', () => {
    it('should return push token statistics', async () => {
      const mockStats = {
        total: 100,
        active: 80,
        inactive: 20,
        byPlatform: { ios: 40, android: 40 }
      };

      mockPushToken.getStatistics.mockResolvedValue(mockStats);

      const result = await PushNotificationService.getStatistics();

      expect(result).toEqual(mockStats);
      expect(mockPushToken.getStatistics).toHaveBeenCalled();
    });
  });

  describe('cleanupTokens', () => {
    it('should clean up old and duplicate tokens', async () => {
      mockPushToken.cleanupInactiveTokens.mockResolvedValue(10);
      mockPushToken.cleanupDuplicateTokens.mockResolvedValue(5);

      const result = await PushNotificationService.cleanupTokens();

      expect(result.inactiveRemoved).toBe(10);
      expect(result.duplicatesRemoved).toBe(5);
      expect(mockPushToken.cleanupInactiveTokens).toHaveBeenCalledWith(30);
      expect(mockPushToken.cleanupDuplicateTokens).toHaveBeenCalled();
    });
  });
});