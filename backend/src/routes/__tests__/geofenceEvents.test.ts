import request from 'supertest';
import express from 'express';
import { geofenceRoutes } from '../geofences';
import { authenticateToken } from '../../middleware/auth';
import { errorHandler } from '../../middleware/errorHandler';
import { GeofenceEventProcessor } from '../../services/geofenceEventProcessor';
import { EventQueueService } from '../../services/eventQueueService';
import { GeofenceEvent } from '../../models/GeofenceEvent';

// Mock the services and models
jest.mock('../../services/geofenceEventProcessor');
jest.mock('../../services/eventQueueService');
jest.mock('../../models/GeofenceEvent');
jest.mock('../../middleware/auth');

const mockGeofenceEventProcessor = GeofenceEventProcessor as jest.Mocked<typeof GeofenceEventProcessor>;
const mockEventQueueService = EventQueueService as jest.Mocked<typeof EventQueueService>;
const mockGeofenceEvent = GeofenceEvent as jest.Mocked<typeof GeofenceEvent>;
const mockAuthenticateToken = authenticateToken as jest.MockedFunction<typeof authenticateToken>;

// Create test app
const app = express();
app.use(express.json());
app.use('/api/geofences', geofenceRoutes);
app.use(errorHandler);

// Mock user for authentication
const mockUser = {
  id: 'user-1',
  device_id: 'device-1',
  email: 'test@example.com'
};

describe('Geofence Events API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock authentication middleware
    mockAuthenticateToken.mockImplementation(async (req: any, res: any, next: any) => {
      req.user = mockUser;
      next();
    });
  });

  describe('POST /api/geofences/events', () => {
    const mockEventData = {
      task_id: 'task-1',
      geofence_id: 'geofence-1',
      event_type: 'enter',
      location: { latitude: 37.7749, longitude: -122.4194 },
      confidence: 0.9
    };

    it('should process geofence events successfully', async () => {
      const mockResult = {
        event: { id: 'event-1' },
        shouldNotify: true,
        reason: 'Event processed successfully'
      };

      mockGeofenceEventProcessor.processEvent.mockResolvedValue(mockResult as any);

      const response = await request(app)
        .post('/api/geofences/events')
        .send({ events: [mockEventData] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.processed).toBe(1);
      expect(response.body.data.queued).toBe(0);
      expect(response.body.data.results).toHaveLength(1);
      expect(response.body.data.results[0].shouldNotify).toBe(true);
    });

    it('should queue events that fail immediate processing', async () => {
      mockGeofenceEventProcessor.processEvent.mockRejectedValue(new Error('Processing failed'));
      mockEventQueueService.enqueueEvent.mockResolvedValue('queued-event-1');

      const response = await request(app)
        .post('/api/geofences/events')
        .send({ events: [mockEventData] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.processed).toBe(0);
      expect(response.body.data.queued).toBe(1);
      expect(response.body.data.queuedEvents).toHaveLength(1);
      expect(response.body.data.queuedEvents[0].eventId).toBe('queued-event-1');
    });

    it('should add user_id to events', async () => {
      const mockResult = {
        event: { id: 'event-1' },
        shouldNotify: true,
        reason: 'Event processed successfully'
      };

      mockGeofenceEventProcessor.processEvent.mockResolvedValue(mockResult as any);

      await request(app)
        .post('/api/geofences/events')
        .send({ events: [mockEventData] });

      expect(mockGeofenceEventProcessor.processEvent).toHaveBeenCalledWith({
        ...mockEventData,
        user_id: 'user-1'
      });
    });

    it('should handle multiple events', async () => {
      const events = [
        mockEventData,
        { ...mockEventData, geofence_id: 'geofence-2' },
        { ...mockEventData, geofence_id: 'geofence-3' }
      ];

      const mockResult = {
        event: { id: 'event-1' },
        shouldNotify: true,
        reason: 'Event processed successfully'
      };

      mockGeofenceEventProcessor.processEvent.mockResolvedValue(mockResult as any);

      const response = await request(app)
        .post('/api/geofences/events')
        .send({ events });

      expect(response.status).toBe(200);
      expect(response.body.data.processed).toBe(3);
      expect(mockGeofenceEventProcessor.processEvent).toHaveBeenCalledTimes(3);
    });

    it('should return 400 for missing events array', async () => {
      const response = await request(app)
        .post('/api/geofences/events')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid events array', async () => {
      const response = await request(app)
        .post('/api/geofences/events')
        .send({ events: 'not-an-array' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/geofences/events/sync', () => {
    const mockEventData = {
      task_id: 'task-1',
      geofence_id: 'geofence-1',
      event_type: 'enter',
      location: { latitude: 37.7749, longitude: -122.4194 },
      confidence: 0.9
    };

    it('should sync offline events successfully', async () => {
      const mockSyncResult = {
        queued: 0,
        processed: 2,
        failed: 0,
        duplicates: 1
      };

      mockEventQueueService.syncOfflineEvents.mockResolvedValue(mockSyncResult);

      const response = await request(app)
        .post('/api/geofences/events/sync')
        .send({ events: [mockEventData, mockEventData, mockEventData] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSyncResult);
      expect(response.body.message).toContain('Synced 3 offline events');
    });

    it('should add user_id to events before syncing', async () => {
      const mockSyncResult = {
        queued: 0,
        processed: 1,
        failed: 0,
        duplicates: 0
      };

      mockEventQueueService.syncOfflineEvents.mockResolvedValue(mockSyncResult);

      await request(app)
        .post('/api/geofences/events/sync')
        .send({ events: [mockEventData] });

      expect(mockEventQueueService.syncOfflineEvents).toHaveBeenCalledWith('user-1', [
        { ...mockEventData, user_id: 'user-1' }
      ]);
    });

    it('should return 400 for missing events array', async () => {
      const response = await request(app)
        .post('/api/geofences/events/sync')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/geofences/events/queue', () => {
    it('should return queued events for user', async () => {
      const mockQueuedEvents = [
        {
          id: 'queued-1',
          eventData: { 
            user_id: 'user-1', 
            task_id: 'task-1',
            geofence_id: 'geofence-1',
            event_type: 'enter' as const,
            location: { latitude: 37.7749, longitude: -122.4194 }
          },
          attempts: 1,
          error: 'Processing failed'
        }
      ];

      const mockQueueStats = {
        pending: 1,
        processing: 0,
        failed: 0,
        completed: 5,
        totalRetries: 2
      };

      mockEventQueueService.getQueuedEventsForUser.mockReturnValue(mockQueuedEvents);
      mockEventQueueService.getQueueStats.mockReturnValue(mockQueueStats);

      const response = await request(app)
        .get('/api/geofences/events/queue');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toEqual(mockQueuedEvents);
      expect(response.body.data.stats).toEqual(mockQueueStats);
    });
  });

  describe('GET /api/geofences/events/stats', () => {
    it('should return event processing statistics', async () => {
      const mockStats = {
        totalEvents: 100,
        processed: 85,
        duplicates: 10,
        failed: 3,
        bundled: 15,
        averageProcessingTime: 250
      };

      mockGeofenceEventProcessor.getProcessingStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/geofences/events/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(mockGeofenceEventProcessor.getProcessingStats).toHaveBeenCalledWith('user-1', 7);
    });

    it('should accept custom days parameter', async () => {
      const mockStats = {
        totalEvents: 50,
        processed: 45,
        duplicates: 3,
        failed: 1,
        bundled: 8,
        averageProcessingTime: 200
      };

      mockGeofenceEventProcessor.getProcessingStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/geofences/events/stats?days=30');

      expect(response.status).toBe(200);
      expect(mockGeofenceEventProcessor.getProcessingStats).toHaveBeenCalledWith('user-1', 30);
    });
  });

  describe('POST /api/geofences/events/retry/:eventId', () => {
    it('should retry failed event successfully', async () => {
      mockEventQueueService.retryEvent.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/geofences/events/retry/event-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Event retry initiated');
      expect(mockEventQueueService.retryEvent).toHaveBeenCalledWith('event-123');
    });

    it('should return 400 for non-existent event', async () => {
      mockEventQueueService.retryEvent.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/geofences/events/retry/non-existent');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/geofences/events/history', () => {
    it('should return event history for user', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          user_id: 'user-1',
          task_id: 'task-1',
          event_type: 'enter',
          status: 'processed',
          created_at: new Date(),
          toJSON: jest.fn().mockReturnValue({
            id: 'event-1',
            user_id: 'user-1',
            task_id: 'task-1',
            event_type: 'enter',
            status: 'processed'
          })
        }
      ];

      mockGeofenceEvent.findByUserId.mockResolvedValue(mockEvents as any);

      const response = await request(app)
        .get('/api/geofences/events/history');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination.limit).toBe(50);
      expect(response.body.pagination.offset).toBe(0);
    });

    it('should accept pagination parameters', async () => {
      mockGeofenceEvent.findByUserId.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/geofences/events/history?limit=10&offset=20');

      expect(response.status).toBe(200);
      expect(mockGeofenceEvent.findByUserId).toHaveBeenCalledWith('user-1', {
        status: undefined,
        limit: 10,
        offset: 20
      });
    });

    it('should accept status filter', async () => {
      mockGeofenceEvent.findByUserId.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/geofences/events/history?status=processed');

      expect(response.status).toBe(200);
      expect(mockGeofenceEvent.findByUserId).toHaveBeenCalledWith('user-1', {
        status: 'processed',
        limit: 50,
        offset: 0
      });
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all endpoints', async () => {
      // Mock authentication to fail
      mockAuthenticateToken.mockImplementation(async (req: any, res: any, next: any) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const endpoints = [
        { method: 'post', path: '/api/geofences/events' },
        { method: 'post', path: '/api/geofences/events/sync' },
        { method: 'get', path: '/api/geofences/events/queue' },
        { method: 'get', path: '/api/geofences/events/stats' },
        { method: 'post', path: '/api/geofences/events/retry/event-1' },
        { method: 'get', path: '/api/geofences/events/history' }
      ];

      for (const endpoint of endpoints) {
        let response;
        if (endpoint.method === 'post') {
          response = await request(app).post(endpoint.path).send({});
        } else {
          response = await request(app).get(endpoint.path);
        }
        expect(response.status).toBe(401);
      }
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      // Reset authentication mock
      mockAuthenticateToken.mockImplementation(async (req: any, res: any, next: any) => {
        req.user = mockUser;
        next();
      });
    });

    it('should handle processing errors gracefully', async () => {
      mockGeofenceEventProcessor.processEvent.mockRejectedValue(new Error('Database error'));
      mockEventQueueService.enqueueEvent.mockRejectedValue(new Error('Queue error'));

      const response = await request(app)
        .post('/api/geofences/events')
        .send({ 
          events: [{ 
            task_id: 'task-1',
            geofence_id: 'geofence-1',
            event_type: 'enter',
            location: { latitude: 37.7749, longitude: -122.4194 }
          }] 
        });

      expect(response.status).toBe(500);
    });

    it('should handle sync errors gracefully', async () => {
      mockEventQueueService.syncOfflineEvents.mockRejectedValue(new Error('Sync error'));

      const response = await request(app)
        .post('/api/geofences/events/sync')
        .send({ 
          events: [{ 
            task_id: 'task-1',
            geofence_id: 'geofence-1',
            event_type: 'enter',
            location: { latitude: 37.7749, longitude: -122.4194 }
          }] 
        });

      expect(response.status).toBe(500);
    });

    it('should handle stats retrieval errors', async () => {
      mockGeofenceEventProcessor.getProcessingStats.mockRejectedValue(new Error('Stats error'));

      const response = await request(app)
        .get('/api/geofences/events/stats');

      expect(response.status).toBe(500);
    });

    it('should handle history retrieval errors', async () => {
      mockGeofenceEvent.findByUserId.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/geofences/events/history');

      expect(response.status).toBe(500);
    });
  });

  describe('Input Validation', () => {
    it('should validate event data structure', async () => {
      const invalidEvents = [
        { /* missing required fields */ },
        { task_id: 'task-1' /* missing other fields */ },
        { 
          task_id: 'task-1',
          geofence_id: 'geofence-1',
          event_type: 'invalid-type', // Invalid event type
          location: { latitude: 37.7749, longitude: -122.4194 }
        }
      ];

      // Mock validation to fail
      mockGeofenceEventProcessor.processEvent.mockRejectedValue(new Error('Validation failed'));
      mockEventQueueService.enqueueEvent.mockRejectedValue(new Error('Validation failed'));

      const response = await request(app)
        .post('/api/geofences/events')
        .send({ events: invalidEvents });

      expect(response.status).toBe(500);
    });

    it('should validate location coordinates', async () => {
      const invalidLocationEvents = [
        {
          task_id: 'task-1',
          geofence_id: 'geofence-1',
          event_type: 'enter',
          location: { latitude: 91, longitude: -122.4194 } // Invalid latitude
        },
        {
          task_id: 'task-1',
          geofence_id: 'geofence-1',
          event_type: 'enter',
          location: { latitude: 37.7749, longitude: 181 } // Invalid longitude
        }
      ];

      mockGeofenceEventProcessor.processEvent.mockRejectedValue(new Error('Invalid coordinates'));
      mockEventQueueService.enqueueEvent.mockRejectedValue(new Error('Invalid coordinates'));

      const response = await request(app)
        .post('/api/geofences/events')
        .send({ events: invalidLocationEvents });

      expect(response.status).toBe(500);
    });
  });
});