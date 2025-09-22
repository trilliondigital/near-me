import request from 'supertest';
import express from 'express';
import notificationPersistenceRoutes from '../notificationPersistence';
import { NotificationService } from '../../services/notificationService';
import { NotificationHistory } from '../../models/NotificationHistory';
import { NotificationSnooze } from '../../models/NotificationSnooze';
import { TaskMute } from '../../models/TaskMute';

// Mock the auth middleware
const mockAuthMiddleware = (req: any, res: any, next: any) => {
  req.user = { id: 'user-123' };
  next();
};

const app = express();
app.use(express.json());
app.use('/api/notifications', mockAuthMiddleware, notificationPersistenceRoutes);

describe('Notification Persistence API Routes', () => {
  beforeEach(() => {
    // Reset any mocks or test data
  });

  describe('GET /api/notifications/history', () => {
    it('should get notification history for authenticated user', async () => {
      // Mock the service method
      const mockNotifications = [
        {
          id: 'history-1',
          notification_id: 'notification-1',
          type: 'approach',
          title: 'Test Notification',
          body: 'Test body',
          scheduled_time: new Date(),
          delivered_time: null,
          status: 'pending',
          attempts: 0,
          last_attempt: null,
          error_message: null,
          metadata: {},
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      jest.spyOn(NotificationService, 'getUserNotificationHistory')
        .mockResolvedValue({ notifications: mockNotifications as any, total: 1 });

      const response = await request(app)
        .get('/api/notifications/history')
        .expect(200);

      expect(response.body.notifications).toHaveLength(1);
      expect(response.body.total).toBe(1);
      expect(response.body.notifications[0].notification_id).toBe('notification-1');
    });

    it('should support pagination parameters', async () => {
      jest.spyOn(NotificationService, 'getUserNotificationHistory')
        .mockResolvedValue({ notifications: [], total: 0 });

      await request(app)
        .get('/api/notifications/history?page=2&limit=10&status=pending')
        .expect(200);

      expect(NotificationService.getUserNotificationHistory).toHaveBeenCalledWith(
        'user-123',
        2,
        10,
        'pending'
      );
    });

    it('should return 401 for unauthenticated user', async () => {
      const appWithoutAuth = express();
      appWithoutAuth.use(express.json());
      appWithoutAuth.use('/api/notifications', notificationPersistenceRoutes);

      await request(appWithoutAuth)
        .get('/api/notifications/history')
        .expect(401);
    });
  });

  describe('GET /api/notifications/snoozes', () => {
    it('should get active snoozes for authenticated user', async () => {
      const mockSnoozes = [
        {
          id: 'snooze-1',
          notification_id: 'notification-1',
          snooze_duration: '15m',
          snooze_until: new Date(),
          original_scheduled_time: new Date(),
          snooze_count: 1,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      jest.spyOn(NotificationService, 'getUserActiveSnoozes')
        .mockResolvedValue(mockSnoozes as any);

      const response = await request(app)
        .get('/api/notifications/snoozes')
        .expect(200);

      expect(response.body.snoozes).toHaveLength(1);
      expect(response.body.snoozes[0].notification_id).toBe('notification-1');
    });
  });

  describe('GET /api/notifications/mutes', () => {
    it('should get active mutes for authenticated user', async () => {
      const mockMutes = [
        {
          id: 'mute-1',
          mute_duration: '24h',
          mute_until: new Date(),
          reason: 'User requested',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      jest.spyOn(NotificationService, 'getUserActiveMutes')
        .mockResolvedValue(mockMutes as any);

      const response = await request(app)
        .get('/api/notifications/mutes')
        .expect(200);

      expect(response.body.mutes).toHaveLength(1);
      expect(response.body.mutes[0].mute_duration).toBe('24h');
    });
  });

  describe('POST /api/notifications/snoozes/:snoozeId/cancel', () => {
    it('should cancel a snooze', async () => {
      const mockSnooze = {
        id: 'snooze-1',
        userId: 'user-123',
        notificationId: 'notification-1',
        cancel: jest.fn().mockResolvedValue({}),
        toJSON: jest.fn().mockReturnValue({ id: 'snooze-1' })
      };

      jest.spyOn(NotificationSnooze, 'findByNotificationId')
        .mockResolvedValue(mockSnooze as any);

      const response = await request(app)
        .post('/api/notifications/snoozes/notification-1/cancel')
        .expect(200);

      expect(response.body.message).toBe('Snooze cancelled successfully');
      expect(mockSnooze.cancel).toHaveBeenCalled();
    });

    it('should return 404 for non-existent snooze', async () => {
      jest.spyOn(NotificationSnooze, 'findByNotificationId')
        .mockResolvedValue(null);

      await request(app)
        .post('/api/notifications/snoozes/non-existent/cancel')
        .expect(404);
    });

    it('should return 404 for snooze owned by different user', async () => {
      const mockSnooze = {
        id: 'snooze-1',
        userId: 'different-user',
        notificationId: 'notification-1'
      };

      jest.spyOn(NotificationSnooze, 'findByNotificationId')
        .mockResolvedValue(mockSnooze as any);

      await request(app)
        .post('/api/notifications/snoozes/notification-1/cancel')
        .expect(404);
    });
  });

  describe('POST /api/notifications/snoozes/:snoozeId/extend', () => {
    it('should extend a snooze', async () => {
      const mockSnooze = {
        id: 'snooze-1',
        userId: 'user-123',
        notificationId: 'notification-1',
        extendSnooze: jest.fn().mockResolvedValue({}),
        toJSON: jest.fn().mockReturnValue({ id: 'snooze-1' })
      };

      jest.spyOn(NotificationSnooze, 'findByNotificationId')
        .mockResolvedValue(mockSnooze as any);

      const response = await request(app)
        .post('/api/notifications/snoozes/notification-1/extend')
        .send({ duration: '1h' })
        .expect(200);

      expect(response.body.message).toBe('Snooze extended successfully');
      expect(mockSnooze.extendSnooze).toHaveBeenCalledWith('1h');
    });

    it('should return 400 for invalid duration', async () => {
      await request(app)
        .post('/api/notifications/snoozes/notification-1/extend')
        .send({ duration: 'invalid' })
        .expect(400);
    });
  });

  describe('POST /api/notifications/mutes/:muteId/cancel', () => {
    it('should cancel a mute', async () => {
      const mockMute = {
        id: 'mute-1',
        userId: 'user-123',
        taskId: 'task-1',
        cancel: jest.fn().mockResolvedValue({}),
        toJSON: jest.fn().mockReturnValue({ id: 'mute-1' })
      };

      jest.spyOn(TaskMute, 'findActiveByTaskId')
        .mockResolvedValue(mockMute as any);

      const response = await request(app)
        .post('/api/notifications/mutes/task-1/cancel')
        .expect(200);

      expect(response.body.message).toBe('Mute cancelled successfully');
      expect(mockMute.cancel).toHaveBeenCalled();
    });
  });

  describe('POST /api/notifications/mutes/:muteId/extend', () => {
    it('should extend a mute', async () => {
      const mockMute = {
        id: 'mute-1',
        userId: 'user-123',
        taskId: 'task-1',
        extendMute: jest.fn().mockResolvedValue({}),
        toJSON: jest.fn().mockReturnValue({ id: 'mute-1' })
      };

      jest.spyOn(TaskMute, 'findActiveByTaskId')
        .mockResolvedValue(mockMute as any);

      const response = await request(app)
        .post('/api/notifications/mutes/task-1/extend')
        .send({ duration: '8h' })
        .expect(200);

      expect(response.body.message).toBe('Mute extended successfully');
      expect(mockMute.extendMute).toHaveBeenCalledWith('8h');
    });

    it('should return 400 for invalid duration', async () => {
      await request(app)
        .post('/api/notifications/mutes/task-1/extend')
        .send({ duration: 'invalid' })
        .expect(400);
    });
  });

  describe('POST /api/notifications/process-expired-snoozes', () => {
    it('should process expired snoozes', async () => {
      jest.spyOn(NotificationService, 'processExpiredSnoozes')
        .mockResolvedValue();

      const response = await request(app)
        .post('/api/notifications/process-expired-snoozes')
        .expect(200);

      expect(response.body.message).toBe('Expired snoozes processed successfully');
      expect(NotificationService.processExpiredSnoozes).toHaveBeenCalled();
    });
  });

  describe('POST /api/notifications/process-expired-mutes', () => {
    it('should process expired mutes', async () => {
      jest.spyOn(NotificationService, 'processExpiredMutes')
        .mockResolvedValue();

      const response = await request(app)
        .post('/api/notifications/process-expired-mutes')
        .expect(200);

      expect(response.body.message).toBe('Expired mutes processed successfully');
      expect(NotificationService.processExpiredMutes).toHaveBeenCalled();
    });
  });

  describe('POST /api/notifications/process-retries', () => {
    it('should process notification retries', async () => {
      jest.spyOn(NotificationService, 'processNotificationRetries')
        .mockResolvedValue();

      const response = await request(app)
        .post('/api/notifications/process-retries')
        .expect(200);

      expect(response.body.message).toBe('Notification retries processed successfully');
      expect(NotificationService.processNotificationRetries).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      jest.spyOn(NotificationService, 'getUserNotificationHistory')
        .mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/notifications/history')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch notification history');
      expect(response.body.details).toBe('Database connection failed');
    });

    it('should handle validation errors', async () => {
      await request(app)
        .post('/api/notifications/snoozes/notification-1/extend')
        .send({ duration: 'invalid-duration' })
        .expect(400);

      const response = await request(app)
        .post('/api/notifications/mutes/task-1/extend')
        .send({ duration: 'invalid-duration' })
        .expect(400);

      expect(response.body.error).toBe('Invalid mute duration');
    });
  });
});
