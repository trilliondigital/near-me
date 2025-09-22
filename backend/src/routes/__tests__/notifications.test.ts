import request from 'supertest';
import express from 'express';
import notificationsRouter from '../notifications';
import { NotificationService } from '../../services/notificationService';
import { NotificationScheduler } from '../../services/notificationScheduler';
import { AuthenticatedRequest } from '../../middleware/auth';

// Mock dependencies
jest.mock('../../services/notificationService');
jest.mock('../../services/notificationScheduler');
jest.mock('../../middleware/auth');

const mockNotificationService = NotificationService as jest.Mocked<typeof NotificationService>;
const mockNotificationScheduler = NotificationScheduler as jest.Mocked<typeof NotificationScheduler>;

// Create test app
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  // Mock authenticated user
  (req as any).user = { id: 'user-1' };
  next();
});
app.use('/api/notifications', notificationsRouter);

describe('Notifications Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/notifications/geofence-event', () => {
    it('should process geofence event and create notification', async () => {
      const mockGeofenceEvent = {
        id: 'event-1',
        user_id: 'user-1',
        task_id: 'task-1',
        geofence_id: 'geofence-1',
        event_type: 'enter',
        location: { latitude: 37.7749, longitude: -122.4194 },
        confidence: 0.9
      };

      const mockNotification = {
        id: 'notification-1',
        taskId: 'task-1',
        userId: 'user-1',
        type: 'approach' as const,
        title: 'Approaching location',
        body: 'You are approaching your destination',
        actions: [],
        scheduledTime: new Date(),
        metadata: {
          geofenceId: 'geofence-1',
          geofenceType: 'approach_5mi' as const,
          location: { latitude: 37.7749, longitude: -122.4194 }
        }
      };

      const mockScheduled = {
        id: 'scheduled-1',
        notification: mockNotification,
        scheduledTime: new Date(),
        userId: 'user-1',
        status: 'delivered' as const,
        attempts: 1
      };

      // Mock the GeofenceEvent.create method
      const mockGeofenceEventCreate = jest.fn().mockResolvedValue(mockGeofenceEvent);
      jest.doMock('../../models/GeofenceEvent', () => ({
        GeofenceEvent: {
          create: mockGeofenceEventCreate
        }
      }));

      mockNotificationService.createNotificationForEvent.mockResolvedValue(mockNotification);
      mockNotificationScheduler.scheduleNotification.mockResolvedValue(mockScheduled);

      const response = await request(app)
        .post('/api/notifications/geofence-event')
        .send({
          geofence_id: 'geofence-1',
          event_type: 'enter',
          location: { latitude: 37.7749, longitude: -122.4194 },
          task_id: 'task-1',
          confidence: 0.9
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Geofence event processed and notification scheduled');
      expect(response.body.notification).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/notifications/geofence-event')
        .send({
          geofence_id: 'geofence-1'
          // Missing event_type and location
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });
  });

  describe('POST /api/notifications/:notificationId/action', () => {
    it('should handle notification action successfully', async () => {
      mockNotificationService.handleNotificationAction.mockResolvedValue();

      const response = await request(app)
        .post('/api/notifications/notification-1/action')
        .send({ action: 'complete' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Notification action processed successfully');
      expect(response.body.notificationId).toBe('notification-1');
      expect(response.body.action).toBe('complete');
    });

    it('should return 400 for missing action', async () => {
      const response = await request(app)
        .post('/api/notifications/notification-1/action')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing required field: action');
    });

    it('should return 400 for invalid action type', async () => {
      const response = await request(app)
        .post('/api/notifications/notification-1/action')
        .send({ action: 'invalid_action' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid action type');
    });

    it('should handle all valid action types', async () => {
      const validActions = ['complete', 'snooze_15m', 'snooze_1h', 'snooze_today', 'open_map', 'mute'];
      
      for (const action of validActions) {
        mockNotificationService.handleNotificationAction.mockResolvedValue();

        const response = await request(app)
          .post('/api/notifications/notification-1/action')
          .send({ action });

        expect(response.status).toBe(200);
        expect(response.body.action).toBe(action);
      }
    });
  });

  describe('GET /api/notifications/scheduled', () => {
    it('should return scheduled notifications for user', async () => {
      const mockScheduledNotifications = [
        {
          id: 'scheduled-1',
          notification: {
            id: 'notification-1',
            type: 'approach',
            title: 'Test notification',
            body: 'Test body',
            actions: [],
            metadata: { geofenceId: 'geofence-1' }
          },
          scheduledTime: new Date(),
          status: 'pending',
          attempts: 0
        }
      ];

      mockNotificationScheduler.getScheduledNotifications.mockReturnValue(mockScheduledNotifications);

      const response = await request(app)
        .get('/api/notifications/scheduled');

      expect(response.status).toBe(200);
      expect(response.body.notifications).toHaveLength(1);
      expect(response.body.notifications[0].id).toBe('scheduled-1');
    });
  });

  describe('DELETE /api/notifications/:notificationId', () => {
    it('should cancel notification successfully', async () => {
      const mockScheduledNotifications = [
        {
          id: 'scheduled-1',
          notification: { id: 'notification-1' },
          userId: 'user-1',
          status: 'pending'
        }
      ];

      mockNotificationScheduler.getScheduledNotifications.mockReturnValue(mockScheduledNotifications);
      mockNotificationScheduler.cancelNotification.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/notifications/scheduled-1');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Notification cancelled successfully');
    });

    it('should return 404 for non-existent notification', async () => {
      mockNotificationScheduler.getScheduledNotifications.mockReturnValue([]);

      const response = await request(app)
        .delete('/api/notifications/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Notification not found or does not belong to user');
    });
  });

  describe('POST /api/notifications/bundle', () => {
    it('should bundle notifications successfully', async () => {
      const mockNotifications = [
        {
          id: 'notification-1',
          userId: 'user-1',
          type: 'approach',
          title: 'Test 1',
          body: 'Body 1',
          actions: [],
          scheduledTime: new Date(),
          metadata: {
            geofenceId: 'geofence-1',
            geofenceType: 'approach_5mi',
            location: { latitude: 37.7749, longitude: -122.4194 }
          }
        },
        {
          id: 'notification-2',
          userId: 'user-1',
          type: 'approach',
          title: 'Test 2',
          body: 'Body 2',
          actions: [],
          scheduledTime: new Date(),
          metadata: {
            geofenceId: 'geofence-2',
            geofenceType: 'approach_5mi',
            location: { latitude: 37.7750, longitude: -122.4195 }
          }
        }
      ];

      const mockBundles = [
        {
          id: 'bundle-1',
          userId: 'user-1',
          notifications: mockNotifications,
          title: '2 reminders nearby',
          body: 'You have 2 reminders for 2 tasks in this area',
          actions: [],
          location: { latitude: 37.7749, longitude: -122.4194 },
          radius: 500,
          scheduledTime: new Date()
        }
      ];

      mockNotificationService.bundleNotifications.mockResolvedValue(mockBundles);

      const response = await request(app)
        .post('/api/notifications/bundle')
        .send({ notifications: mockNotifications });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Notifications bundled successfully');
      expect(response.body.bundles).toHaveLength(1);
      expect(response.body.bundledCount).toBe(2);
      expect(response.body.totalCount).toBe(2);
    });

    it('should return 400 for invalid notifications array', async () => {
      const response = await request(app)
        .post('/api/notifications/bundle')
        .send({ notifications: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing or invalid notifications array');
    });

    it('should return 400 when no notifications found for user', async () => {
      const mockNotifications = [
        {
          id: 'notification-1',
          userId: 'user-2', // Different user
          type: 'approach',
          title: 'Test 1',
          body: 'Body 1',
          actions: [],
          scheduledTime: new Date(),
          metadata: {
            geofenceId: 'geofence-1',
            geofenceType: 'approach_5mi',
            location: { latitude: 37.7749, longitude: -122.4194 }
          }
        }
      ];

      const response = await request(app)
        .post('/api/notifications/bundle')
        .send({ notifications: mockNotifications });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No notifications found for user');
    });
  });

  describe('GET /api/notifications/stats', () => {
    it('should return notification statistics', async () => {
      const mockUserNotifications = [
        { id: '1', userId: 'user-1', status: 'pending' },
        { id: '2', userId: 'user-1', status: 'delivered' },
        { id: '3', userId: 'user-1', status: 'failed' }
      ];

      const mockSystemStats = {
        totalScheduled: 10,
        pending: 3,
        delivered: 5,
        failed: 2,
        cancelled: 0
      };

      mockNotificationScheduler.getScheduledNotifications.mockReturnValue(mockUserNotifications);
      mockNotificationScheduler.getStats.mockReturnValue(mockSystemStats);

      const response = await request(app)
        .get('/api/notifications/stats');

      expect(response.status).toBe(200);
      expect(response.body.user.total).toBe(3);
      expect(response.body.user.pending).toBe(1);
      expect(response.body.user.delivered).toBe(1);
      expect(response.body.user.failed).toBe(1);
      expect(response.body.system).toEqual(mockSystemStats);
    });
  });
});
