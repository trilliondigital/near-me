import request from 'supertest';
import express from 'express';
import { taskRoutes } from '../tasks';
import { TaskService } from '../../services/taskService';
import { ValidationError } from '../../models/validation';
import { authenticateToken } from '../../middleware/auth';

// Mock the service and middleware
jest.mock('../../services/taskService');
jest.mock('../../middleware/auth');

const MockTaskService = TaskService as jest.MockedClass<typeof TaskService>;
const mockAuthenticateToken = authenticateToken as jest.MockedFunction<typeof authenticateToken>;

// Create test app
const app = express();
app.use(express.json());
app.use('/api/tasks', taskRoutes);

// Add error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: error.message,
      details: error.details
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Mock user for authenticated requests
const mockUser = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  device_id: 'device-123'
};

describe('Task Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock authentication middleware to add user to request
    mockAuthenticateToken.mockImplementation(async (req: any, res, next) => {
      req.user = mockUser;
      next();
    });
  });

  describe('GET /api/tasks', () => {
    it('should get user tasks successfully', async () => {
      const mockTask = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Buy groceries',
        description: 'Get milk and bread',
        location_type: 'poi_category',
        place_id: undefined,
        poi_category: 'grocery',
        custom_radii: undefined,
        status: 'active',
        created_at: new Date(),
        completed_at: undefined,
        updated_at: new Date(),
        toJSON: jest.fn(),
        update: jest.fn(),
        complete: jest.fn(),
        mute: jest.fn(),
        reactivate: jest.fn(),
        delete: jest.fn(),
        belongsToUser: jest.fn(),
        isActive: jest.fn(),
        isCompleted: jest.fn(),
        isMuted: jest.fn()
      };

      const mockResponse = {
        tasks: [mockTask],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      };

      (MockTaskService.getUserTasks as jest.MockedFunction<typeof MockTaskService.getUserTasks>).mockResolvedValueOnce(mockResponse as any);

      const response = await request(app)
        .get('/api/tasks')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tasks).toHaveLength(1);
      expect(response.body.data.total).toBe(1);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(20);
      expect(response.body.data.totalPages).toBe(1);
      expect(MockTaskService.getUserTasks).toHaveBeenCalledWith(mockUser.id, {
        page: 1,
        limit: 20
      });
    });

    it('should handle query parameters', async () => {
      const mockResponse = {
        tasks: [],
        total: 0,
        page: 2,
        limit: 10,
        totalPages: 0
      };

      (MockTaskService.getUserTasks as jest.MockedFunction<typeof MockTaskService.getUserTasks>).mockResolvedValueOnce(mockResponse);

      await request(app)
        .get('/api/tasks?status=active&location_type=poi_category&page=2&limit=10')
        .expect(200);

      expect(MockTaskService.getUserTasks).toHaveBeenCalledWith(mockUser.id, {
        status: 'active',
        location_type: 'poi_category',
        page: 2,
        limit: 10
      });
    });

    it('should handle service errors', async () => {
      (MockTaskService.getUserTasks as jest.MockedFunction<typeof MockTaskService.getUserTasks>).mockRejectedValueOnce(new ValidationError('User not found', []));

      const response = await request(app)
        .get('/api/tasks')
        .expect(400);

      expect(response.body.success).toBeFalsy();
    });
  });

  describe('GET /api/tasks/stats', () => {
    it('should get task statistics', async () => {
      const mockStats = {
        total: 5,
        active: 3,
        completed: 2,
        muted: 0,
        byLocationType: { custom_place: 2, poi_category: 3 },
        byPOICategory: { grocery: 2, pharmacy: 1, gas: 0, bank: 0, post_office: 0 }
      };

      (MockTaskService.getTaskStats as jest.MockedFunction<typeof MockTaskService.getTaskStats>).mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/tasks/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(MockTaskService.getTaskStats).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('should get specific task', async () => {
      const mockTask = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Buy groceries',
        status: 'active',
        toJSON: jest.fn().mockReturnValue({
          id: '550e8400-e29b-41d4-a716-446655440001',
          title: 'Buy groceries',
          status: 'active'
        })
      };

      (MockTaskService.getTaskById as jest.MockedFunction<typeof MockTaskService.getTaskById>).mockResolvedValueOnce(mockTask as any);

      const response = await request(app)
        .get('/api/tasks/550e8400-e29b-41d4-a716-446655440001')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(MockTaskService.getTaskById).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440001', mockUser.id);
    });

    it('should handle task not found', async () => {
      (MockTaskService.getTaskById as jest.MockedFunction<typeof MockTaskService.getTaskById>).mockRejectedValueOnce(new ValidationError('Task not found', []));

      await request(app)
        .get('/api/tasks/nonexistent')
        .expect(400);
    });
  });

  describe('POST /api/tasks', () => {
    it('should create new task', async () => {
      const taskData = {
        title: 'Buy groceries',
        location_type: 'poi_category',
        poi_category: 'grocery'
      };

      const mockTask = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        ...taskData,
        status: 'active',
        toJSON: jest.fn().mockReturnValue({
          id: '550e8400-e29b-41d4-a716-446655440001',
          ...taskData,
          status: 'active'
        })
      };

      (MockTaskService.createTask as jest.MockedFunction<typeof MockTaskService.createTask>).mockResolvedValueOnce(mockTask as any);

      const response = await request(app)
        .post('/api/tasks')
        .send(taskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('550e8400-e29b-41d4-a716-446655440001');
      expect(response.body.message).toBe('Task created successfully');
      expect(MockTaskService.createTask).toHaveBeenCalledWith(mockUser.id, taskData);
    });

    it('should handle validation errors', async () => {
      (MockTaskService.createTask as jest.MockedFunction<typeof MockTaskService.createTask>).mockRejectedValueOnce(
        new ValidationError('Title is required', [])
      );

      await request(app)
        .post('/api/tasks')
        .send({})
        .expect(400);
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('should update task', async () => {
      const updateData = { title: 'Updated title' };
      const mockTask = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Updated title',
        toJSON: jest.fn().mockReturnValue({
          id: '550e8400-e29b-41d4-a716-446655440001',
          title: 'Updated title'
        })
      };

      (MockTaskService.updateTask as jest.MockedFunction<typeof MockTaskService.updateTask>).mockResolvedValueOnce(mockTask as any);

      const response = await request(app)
        .put('/api/tasks/550e8400-e29b-41d4-a716-446655440001')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Task updated successfully');
      expect(MockTaskService.updateTask).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440001', mockUser.id, updateData);
    });
  });

  describe('POST /api/tasks/:id/complete', () => {
    it('should complete task', async () => {
      const mockTask = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'completed',
        toJSON: jest.fn().mockReturnValue({
          id: '550e8400-e29b-41d4-a716-446655440001',
          status: 'completed'
        })
      };

      (MockTaskService.completeTask as jest.MockedFunction<typeof MockTaskService.completeTask>).mockResolvedValueOnce(mockTask as any);

      const response = await request(app)
        .post('/api/tasks/550e8400-e29b-41d4-a716-446655440001/complete')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Task completed successfully');
      expect(MockTaskService.completeTask).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440001', mockUser.id);
    });
  });

  describe('POST /api/tasks/:id/mute', () => {
    it('should mute task', async () => {
      const mockTask = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'muted',
        toJSON: jest.fn().mockReturnValue({
          id: '550e8400-e29b-41d4-a716-446655440001',
          status: 'muted'
        })
      };

      (MockTaskService.muteTask as jest.MockedFunction<typeof MockTaskService.muteTask>).mockResolvedValueOnce(mockTask as any);

      const response = await request(app)
        .post('/api/tasks/550e8400-e29b-41d4-a716-446655440001/mute')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Task muted successfully');
      expect(MockTaskService.muteTask).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440001', mockUser.id);
    });
  });

  describe('POST /api/tasks/:id/reactivate', () => {
    it('should reactivate task', async () => {
      const mockTask = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'active',
        toJSON: jest.fn().mockReturnValue({
          id: '550e8400-e29b-41d4-a716-446655440001',
          status: 'active'
        })
      };

      (MockTaskService.reactivateTask as jest.MockedFunction<typeof MockTaskService.reactivateTask>).mockResolvedValueOnce(mockTask as any);

      const response = await request(app)
        .post('/api/tasks/550e8400-e29b-41d4-a716-446655440001/reactivate')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Task reactivated successfully');
      expect(MockTaskService.reactivateTask).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440001', mockUser.id);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete task', async () => {
      (MockTaskService.deleteTask as jest.MockedFunction<typeof MockTaskService.deleteTask>).mockResolvedValueOnce(undefined);

      const response = await request(app)
        .delete('/api/tasks/550e8400-e29b-41d4-a716-446655440001')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Task deleted successfully');
      expect(MockTaskService.deleteTask).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440001', mockUser.id);
    });
  });

  describe('POST /api/tasks/bulk/status', () => {
    it('should bulk update task statuses', async () => {
      const requestData = {
        taskIds: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003'],
        status: 'completed'
      };

      const mockTasks = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          status: 'completed',
          toJSON: jest.fn().mockReturnValue({ id: '550e8400-e29b-41d4-a716-446655440001', status: 'completed' })
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          status: 'completed',
          toJSON: jest.fn().mockReturnValue({ id: '550e8400-e29b-41d4-a716-446655440003', status: 'completed' })
        }
      ];

      (MockTaskService.bulkUpdateTaskStatus as jest.MockedFunction<typeof MockTaskService.bulkUpdateTaskStatus>).mockResolvedValueOnce(mockTasks as any);

      const response = await request(app)
        .post('/api/tasks/bulk/status')
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('2 tasks updated successfully');
      expect(MockTaskService.bulkUpdateTaskStatus).toHaveBeenCalledWith(
        mockUser.id,
        requestData.taskIds,
        requestData.status
      );
    });

    it('should validate request data', async () => {
      await request(app)
        .post('/api/tasks/bulk/status')
        .send({ taskIds: [], status: 'completed' })
        .expect(400);

      await request(app)
        .post('/api/tasks/bulk/status')
        .send({ taskIds: ['550e8400-e29b-41d4-a716-446655440001'], status: 'invalid' })
        .expect(400);
    });
  });
});