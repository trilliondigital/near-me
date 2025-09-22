import request from 'supertest';
import express from 'express';
import { geofenceRoutes } from '../geofences';
import { GeofenceService } from '../../services/geofenceService';
import { Geofence } from '../../models/Geofence';
import { Task } from '../../models/Task';

// Mock the services and models
jest.mock('../../services/geofenceService');
jest.mock('../../models/Geofence');
jest.mock('../../models/Task');
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'user-1', device_id: 'device-1' };
    next();
  }
}));

const mockGeofenceService = GeofenceService as jest.Mocked<typeof GeofenceService>;
const mockGeofence = Geofence as jest.Mocked<typeof Geofence>;
const mockTask = Task as jest.Mocked<typeof Task>;

const app = express();
app.use(express.json());
app.use('/api/geofences', geofenceRoutes);

// Add error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  } else {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      }
    });
  }
});

describe('Geofence Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/geofences', () => {
    it('should return active geofences for user', async () => {
      const mockGeofences = [
        {
          id: 'geofence-1',
          task_id: 'task-1',
          latitude: 37.7749,
          longitude: -122.4194,
          radius: 1000,
          geofence_type: 'arrival',
          is_active: true,
          created_at: new Date(),
          toJSON: () => ({
            id: 'geofence-1',
            task_id: 'task-1',
            latitude: 37.7749,
            longitude: -122.4194,
            radius: 1000,
            geofence_type: 'arrival',
            is_active: true,
            created_at: new Date()
          })
        }
      ];

      mockGeofence.findActiveByUserId.mockResolvedValueOnce(mockGeofences as any);

      const response = await request(app)
        .get('/api/geofences')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('geofence-1');
    });
  });

  describe('GET /api/geofences/stats', () => {
    it('should return geofence statistics', async () => {
      const mockStats = {
        total: 10,
        active: 8,
        byType: {
          approach_5mi: 2,
          approach_3mi: 2,
          approach_1mi: 2,
          arrival: 2,
          post_arrival: 0
        },
        utilizationPercentage: 40
      };

      mockGeofenceService.getGeofenceStats.mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/geofences/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
    });
  });

  describe('GET /api/geofences/task/:taskId', () => {
    it('should return geofences for a specific task', async () => {
      const mockTaskData = {
        id: 'task-1',
        user_id: 'user-1',
        title: 'Test task'
      };

      const mockGeofences = [
        {
          id: 'geofence-1',
          task_id: 'task-1',
          toJSON: () => ({ id: 'geofence-1', task_id: 'task-1' })
        }
      ];

      mockTask.findById.mockResolvedValueOnce(mockTaskData as any);
      mockGeofence.findByTaskId.mockResolvedValueOnce(mockGeofences as any);

      const response = await request(app)
        .get('/api/geofences/task/task-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });

    it('should return 400 for non-existent task', async () => {
      mockTask.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/geofences/task/non-existent')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/geofences/task/:taskId/regenerate', () => {
    it('should regenerate geofences for a task', async () => {
      const mockTaskData = {
        id: 'task-1',
        user_id: 'user-1',
        title: 'Test task'
      };

      const mockGeofences = [
        {
          id: 'geofence-1',
          task_id: 'task-1',
          toJSON: () => ({ id: 'geofence-1', task_id: 'task-1' })
        }
      ];

      mockTask.findById.mockResolvedValueOnce(mockTaskData as any);
      mockGeofenceService.updateGeofencesForTask.mockResolvedValueOnce(mockGeofences as any);

      const response = await request(app)
        .post('/api/geofences/task/task-1/regenerate')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Geofences regenerated successfully');
    });
  });

  describe('POST /api/geofences/optimize', () => {
    it('should optimize geofences when count is high', async () => {
      mockGeofence.countActiveByUserId.mockResolvedValueOnce(18);
      mockGeofenceService.optimizeGeofencesForUser.mockResolvedValueOnce(undefined);
      mockGeofence.countActiveByUserId.mockResolvedValueOnce(15);

      const response = await request(app)
        .post('/api/geofences/optimize')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.optimized).toBe(true);
      expect(response.body.data.previousCount).toBe(18);
      expect(response.body.data.newCount).toBe(15);
    });

    it('should skip optimization when count is low', async () => {
      mockGeofence.countActiveByUserId.mockResolvedValueOnce(10);

      const response = await request(app)
        .post('/api/geofences/optimize')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.optimized).toBe(false);
    });
  });

  describe('POST /api/geofences/validate-radii', () => {
    it('should validate valid radii', async () => {
      const validRadii = {
        approach: 5,
        arrival: 100,
        postArrival: true
      };

      mockGeofenceService.validateGeofenceRadii.mockReturnValueOnce([]);

      const response = await request(app)
        .post('/api/geofences/validate-radii')
        .send({ radii: validRadii })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid radii', async () => {
      const invalidRadii = {
        approach: 100, // Too large
        arrival: 5,    // Too small
        postArrival: true
      };

      const mockErrors = [
        'Approach radius must be between 0.1 and 50 miles',
        'Arrival radius must be between 10 and 1000 meters'
      ];

      mockGeofenceService.validateGeofenceRadii.mockReturnValueOnce(mockErrors);

      const response = await request(app)
        .post('/api/geofences/validate-radii')
        .send({ radii: invalidRadii })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.errors).toEqual(mockErrors);
    });
  });

  describe('GET /api/geofences/defaults/:locationType', () => {
    it('should return default radii for custom place', async () => {
      const mockDefaults = {
        approach: 5,
        arrival: 100,
        postArrival: true
      };

      mockGeofenceService.getDefaultRadii.mockReturnValueOnce(mockDefaults);

      const response = await request(app)
        .get('/api/geofences/defaults/custom_place?placeType=home')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockDefaults);
    });

    it('should return 400 for invalid location type', async () => {
      const response = await request(app)
        .get('/api/geofences/defaults/invalid_type')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/geofences/task/:taskId', () => {
    it('should remove geofences for a task', async () => {
      const mockTaskData = {
        id: 'task-1',
        user_id: 'user-1',
        title: 'Test task'
      };

      mockTask.findById.mockResolvedValueOnce(mockTaskData as any);
      mockGeofenceService.removeGeofencesForTask.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .delete('/api/geofences/task/task-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Geofences removed successfully');
    });
  });
});