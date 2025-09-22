import { User } from '../User';
import { PushNotificationToken } from '../types';
import { query } from '../../database/connection';

// Mock the database connection
jest.mock('../../database/connection', () => ({
  query: jest.fn()
}));

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('User Push Token Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updatePushToken', () => {
    it('should update user push token successfully', async () => {
      const userId = 'test-user-123';
      const deviceToken = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const platform = 'ios';

      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

      await User.updatePushToken(userId, deviceToken, platform);

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE users SET push_token = $1, updated_at = NOW() WHERE id = $2',
        [
          expect.stringContaining('"device_token":"' + deviceToken + '"'),
          userId
        ]
      );
    });

    it('should create proper push token JSON structure', async () => {
      const userId = 'test-user-123';
      const deviceToken = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const platform = 'ios';

      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

      await User.updatePushToken(userId, deviceToken, platform);

      const callArgs = mockQuery.mock.calls[0];
      const pushTokenJson = JSON.parse(callArgs[1][0]);

      expect(pushTokenJson.device_token).toBe(deviceToken);
      expect(pushTokenJson.platform).toBe(platform);
      expect(pushTokenJson.is_active).toBe(true);
      expect(pushTokenJson.last_updated).toBeDefined();
    });
  });

  describe('findUsersWithPushTokens', () => {
    it('should return users with active push tokens', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          device_id: 'device-1',
          email: 'user1@test.com',
          preferences: { notificationStyle: 'standard', privacyMode: 'standard' },
          premium_status: 'free',
          push_token: {
            device_token: 'token1',
            platform: 'ios',
            is_active: true,
            last_updated: new Date()
          },
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'user-2',
          device_id: 'device-2',
          email: 'user2@test.com',
          preferences: { notificationStyle: 'standard', privacyMode: 'standard' },
          premium_status: 'free',
          push_token: {
            device_token: 'token2',
            platform: 'android',
            is_active: true,
            last_updated: new Date()
          },
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockQuery.mockResolvedValue({ rows: mockUsers });

      const users = await User.findUsersWithPushTokens();

      expect(users).toHaveLength(2);
      expect(users[0].push_token?.is_active).toBe(true);
      expect(users[1].push_token?.is_active).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE push_token IS NOT NULL AND (push_token->>\'is_active\')::boolean = true'
      );
    });

    it('should return empty array when no users have push tokens', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const users = await User.findUsersWithPushTokens();

      expect(users).toHaveLength(0);
    });
  });

  describe('deactivatePushToken', () => {
    it('should deactivate push token for user', async () => {
      const userId = 'test-user-123';

      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });

      await User.deactivatePushToken(userId);

      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE users SET push_token = jsonb_set(push_token, \'{is_active}\', \'false\'), updated_at = NOW() WHERE id = $1',
        [userId]
      );
    });
  });

  describe('User constructor with push token', () => {
    it('should properly initialize user with push token', () => {
      const userEntity = {
        id: 'test-user-123',
        device_id: 'test-device-456',
        email: 'test@example.com',
        preferences: { notificationStyle: 'standard', privacyMode: 'standard' },
        premium_status: 'free' as const,
        push_token: {
          device_token: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          platform: 'ios' as const,
          is_active: true,
          last_updated: new Date()
        },
        created_at: new Date(),
        updated_at: new Date()
      };

      const user = new User(userEntity);

      expect(user.push_token).toBeDefined();
      expect(user.push_token?.device_token).toBe(userEntity.push_token.device_token);
      expect(user.push_token?.platform).toBe('ios');
      expect(user.push_token?.is_active).toBe(true);
    });

    it('should handle user without push token', () => {
      const userEntity = {
        id: 'test-user-123',
        device_id: 'test-device-456',
        email: 'test@example.com',
        preferences: { notificationStyle: 'standard', privacyMode: 'standard' },
        premium_status: 'free' as const,
        push_token: undefined,
        created_at: new Date(),
        updated_at: new Date()
      };

      const user = new User(userEntity);

      expect(user.push_token).toBeUndefined();
    });
  });
});
