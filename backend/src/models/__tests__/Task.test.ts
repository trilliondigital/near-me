import { Task } from '../Task';
import { User } from '../User';
import { query, transaction } from '../../database/connection';
import { ValidationError } from '../validation';
import { CreateTaskRequest, UpdateTaskRequest, TaskStatus, LocationType } from '../types';

// Mock the database connection
jest.mock('../../database/connection');
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockTransaction = transaction as jest.MockedFunction<typeof transaction>;

// Mock User model
jest.mock('../User');
const MockUser = User as jest.MockedClass<typeof User>;

// Helper function to create mock query result
const createMockQueryResult = (rows: any[], command = 'SELECT', rowCount?: number) => ({
  rows,
  command,
  rowCount: rowCount ?? rows.length,
  oid: 0,
  fields: []
});

describe('Task Model', () => {
  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockTaskId = '550e8400-e29b-41d4-a716-446655440001';
  const mockPlaceId = '550e8400-e29b-41d4-a716-446655440002';

  const mockTaskEntity = {
    id: mockTaskId,
    user_id: mockUserId,
    title: 'Buy groceries',
    description: 'Get milk and bread',
    location_type: 'poi_category' as LocationType,
    place_id: undefined,
    poi_category: 'grocery' as const,
    custom_radii: undefined,
    status: 'active' as TaskStatus,
    created_at: new Date('2024-01-01T10:00:00Z'),
    completed_at: undefined,
    updated_at: new Date('2024-01-01T10:00:00Z')
  };

  const mockUser = {
    id: mockUserId,
    device_id: 'device-123',
    canCreateTask: jest.fn().mockResolvedValue(true),
    isPremium: jest.fn().mockReturnValue(false)
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (MockUser.findById as jest.MockedFunction<typeof MockUser.findById>).mockResolvedValue(mockUser as any);
  });

  describe('create', () => {
    it('should create a new task successfully', async () => {
      const createData: CreateTaskRequest = {
        title: 'Buy groceries',
        description: 'Get milk and bread',
        location_type: 'poi_category',
        poi_category: 'grocery'
      };

      mockQuery.mockResolvedValueOnce(createMockQueryResult([mockTaskEntity], 'INSERT'));

      const task = await Task.create(mockUserId, createData);

      expect(MockUser.findById).toHaveBeenCalledWith(mockUserId);
      expect(mockUser.canCreateTask).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tasks'),
        [
          mockUserId,
          'Buy groceries',
          'Get milk and bread',
          'poi_category',
          null,
          'grocery',
          null,
          'active'
        ]
      );
      expect(task).toBeInstanceOf(Task);
      expect(task.title).toBe('Buy groceries');
      expect(task.status).toBe('active');
    });

    it('should throw error if user not found', async () => {
      (MockUser.findById as jest.MockedFunction<typeof MockUser.findById>).mockResolvedValueOnce(null);

      const createData: CreateTaskRequest = {
        title: 'Buy groceries',
        location_type: 'poi_category',
        poi_category: 'grocery'
      };

      await expect(Task.create(mockUserId, createData)).rejects.toThrow(ValidationError);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should throw error if user cannot create more tasks', async () => {
      mockUser.canCreateTask.mockResolvedValueOnce(false);

      const createData: CreateTaskRequest = {
        title: 'Buy groceries',
        location_type: 'poi_category',
        poi_category: 'grocery'
      };

      await expect(Task.create(mockUserId, createData)).rejects.toThrow(ValidationError);
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('should validate place exists for custom_place location type', async () => {
      const createData: CreateTaskRequest = {
        title: 'Pick up package',
        location_type: 'custom_place',
        place_id: mockPlaceId
      };

      // Mock place exists check
      mockQuery.mockResolvedValueOnce(createMockQueryResult([{ id: mockPlaceId }]));
      // Mock task creation
      const taskWithPlace = { 
        ...mockTaskEntity, 
        location_type: 'custom_place' as LocationType, 
        place_id: mockPlaceId, 
        poi_category: undefined 
      };
      mockQuery.mockResolvedValueOnce(createMockQueryResult([taskWithPlace], 'INSERT'));

      const task = await Task.create(mockUserId, createData);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id FROM places WHERE id = $1 AND user_id = $2',
        [mockPlaceId, mockUserId]
      );
      expect(task.location_type).toBe('custom_place');
      expect(task.place_id).toBe(mockPlaceId);
    });

    it('should throw error if place does not exist', async () => {
      const createData: CreateTaskRequest = {
        title: 'Pick up package',
        location_type: 'custom_place',
        place_id: mockPlaceId
      };

      // Mock place does not exist
      mockQuery.mockResolvedValueOnce(createMockQueryResult([]));

      await expect(Task.create(mockUserId, createData)).rejects.toThrow(ValidationError);
    });
  });

  describe('findById', () => {
    it('should find task by ID', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([mockTaskEntity]));

      const task = await Task.findById(mockTaskId);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM tasks WHERE id = $1',
        [mockTaskId]
      );
      expect(task).toBeInstanceOf(Task);
      expect(task!.id).toBe(mockTaskId);
    });

    it('should find task by ID and user ID', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([mockTaskEntity]));

      const task = await Task.findById(mockTaskId, mockUserId);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
        [mockTaskId, mockUserId]
      );
      expect(task).toBeInstanceOf(Task);
    });

    it('should return null if task not found', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const task = await Task.findById(mockTaskId);

      expect(task).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find tasks by user ID with pagination', async () => {
      const mockTasks = [mockTaskEntity];
      mockQuery.mockResolvedValueOnce(createMockQueryResult(mockTasks));
      mockQuery.mockResolvedValueOnce(createMockQueryResult([{ count: '1' }]));

      const result = await Task.findByUserId(mockUserId, { page: 1, limit: 20 });

      expect(result.tasks).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.tasks[0]).toBeInstanceOf(Task);
    });

    it('should filter by status', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([mockTaskEntity]));
      mockQuery.mockResolvedValueOnce(createMockQueryResult([{ count: '1' }]));

      await Task.findByUserId(mockUserId, { status: 'active' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1 AND status = $2'),
        expect.arrayContaining([mockUserId, 'active'])
      );
    });

    it('should filter by location type', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([mockTaskEntity]));
      mockQuery.mockResolvedValueOnce(createMockQueryResult([{ count: '1' }]));

      await Task.findByUserId(mockUserId, { location_type: 'poi_category' });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1 AND location_type = $2'),
        expect.arrayContaining([mockUserId, 'poi_category'])
      );
    });
  });

  describe('update', () => {
    let task: Task;

    beforeEach(() => {
      task = new Task(mockTaskEntity);
    });

    it('should update task title', async () => {
      const updateData: UpdateTaskRequest = { title: 'Updated title' };
      const updatedEntity = { ...mockTaskEntity, title: 'Updated title' };
      
      mockQuery.mockResolvedValueOnce(createMockQueryResult([updatedEntity], 'UPDATE'));

      const updatedTask = await task.update(updateData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tasks SET title = $1, updated_at = NOW()'),
        ['Updated title', mockTaskId]
      );
      expect(updatedTask.title).toBe('Updated title');
    });

    it('should update task status to completed and set completed_at', async () => {
      const updateData: UpdateTaskRequest = { status: 'completed' };
      const updatedEntity = { 
        ...mockTaskEntity, 
        status: 'completed' as TaskStatus,
        completed_at: new Date()
      };
      
      mockQuery.mockResolvedValueOnce(createMockQueryResult([updatedEntity], 'UPDATE'));

      const updatedTask = await task.update(updateData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        expect.arrayContaining(['completed'])
      );
      expect(updatedTask.status).toBe('completed');
    });

    it('should clear completed_at when reactivating completed task', async () => {
      const completedTask = new Task({ ...mockTaskEntity, status: 'completed' });
      const updateData: UpdateTaskRequest = { status: 'active' };
      const updatedEntity = { 
        ...mockTaskEntity, 
        status: 'active' as TaskStatus,
        completed_at: undefined
      };
      
      mockQuery.mockResolvedValueOnce(createMockQueryResult([updatedEntity], 'UPDATE'));

      await completedTask.update(updateData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('completed_at = NULL'),
        expect.anything()
      );
    });

    it('should validate place exists when updating to custom_place', async () => {
      const updateData: UpdateTaskRequest = {
        location_type: 'custom_place',
        place_id: mockPlaceId
      };

      // Mock place exists check
      mockQuery.mockResolvedValueOnce(createMockQueryResult([{ id: mockPlaceId }]));
      // Mock update
      mockQuery.mockResolvedValueOnce(createMockQueryResult([mockTaskEntity], 'UPDATE'));

      await task.update(updateData);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id FROM places WHERE id = $1 AND user_id = $2',
        [mockPlaceId, mockUserId]
      );
    });

    it('should return same task if no updates provided', async () => {
      const result = await task.update({});
      expect(result).toBe(task);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('should mark task as completed', async () => {
      const task = new Task(mockTaskEntity);
      const completedEntity = { ...mockTaskEntity, status: 'completed' as TaskStatus };
      
      mockQuery.mockResolvedValueOnce(createMockQueryResult([completedEntity], 'UPDATE'));

      const result = await task.complete();

      expect(result.status).toBe('completed');
    });
  });

  describe('mute', () => {
    it('should mark task as muted', async () => {
      const task = new Task(mockTaskEntity);
      const mutedEntity = { ...mockTaskEntity, status: 'muted' as TaskStatus };
      
      mockQuery.mockResolvedValueOnce(createMockQueryResult([mutedEntity], 'UPDATE'));

      const result = await task.mute();

      expect(result.status).toBe('muted');
    });
  });

  describe('reactivate', () => {
    it('should reactivate a muted task', async () => {
      const mutedTask = new Task({ ...mockTaskEntity, status: 'muted' });
      const activeEntity = { ...mockTaskEntity, status: 'active' as TaskStatus };
      
      mockQuery.mockResolvedValueOnce(createMockQueryResult([activeEntity], 'UPDATE'));

      const result = await mutedTask.reactivate();

      expect(result.status).toBe('active');
    });

    it('should check task limits when reactivating', async () => {
      const mutedTask = new Task({ ...mockTaskEntity, status: 'muted' });
      mockUser.canCreateTask.mockResolvedValueOnce(false);

      await expect(mutedTask.reactivate()).rejects.toThrow(ValidationError);
    });
  });

  describe('delete', () => {
    it('should delete task and associated geofences', async () => {
      const task = new Task(mockTaskEntity);
      const mockClient = {
        query: jest.fn().mockResolvedValue(createMockQueryResult([], 'DELETE'))
      };
      
      mockTransaction.mockImplementationOnce(async (callback) => {
        return callback(mockClient as any);
      });

      await task.delete();

      expect(mockTransaction).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM geofences WHERE task_id = $1',
        [mockTaskId]
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM tasks WHERE id = $1',
        [mockTaskId]
      );
    });
  });

  describe('static methods', () => {
    it('should get active task count', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([{ count: '2' }]));

      const count = await Task.getActiveTaskCount(mockUserId);

      expect(count).toBe(2);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM tasks WHERE user_id = $1 AND status = $2',
        [mockUserId, 'active']
      );
    });

    it('should find tasks by status', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([mockTaskEntity]));

      const tasks = await Task.findByStatus(mockUserId, 'active');

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toBeInstanceOf(Task);
    });

    it('should find tasks by location type', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([mockTaskEntity]));

      const tasks = await Task.findByLocationType(mockUserId, 'poi_category');

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toBeInstanceOf(Task);
    });

    it('should find tasks by place ID', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([mockTaskEntity]));

      const tasks = await Task.findByPlaceId(mockPlaceId);

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toBeInstanceOf(Task);
    });

    it('should find tasks by POI category', async () => {
      mockQuery.mockResolvedValueOnce(createMockQueryResult([mockTaskEntity]));

      const tasks = await Task.findByPOICategory(mockUserId, 'grocery');

      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toBeInstanceOf(Task);
    });
  });

  describe('instance methods', () => {
    let task: Task;

    beforeEach(() => {
      task = new Task(mockTaskEntity);
    });

    it('should check if task belongs to user', () => {
      expect(task.belongsToUser(mockUserId)).toBe(true);
      expect(task.belongsToUser('other-user')).toBe(false);
    });

    it('should check if task is active', () => {
      expect(task.isActive()).toBe(true);
      
      const completedTask = new Task({ ...mockTaskEntity, status: 'completed' });
      expect(completedTask.isActive()).toBe(false);
    });

    it('should check if task is completed', () => {
      expect(task.isCompleted()).toBe(false);
      
      const completedTask = new Task({ ...mockTaskEntity, status: 'completed' });
      expect(completedTask.isCompleted()).toBe(true);
    });

    it('should check if task is muted', () => {
      expect(task.isMuted()).toBe(false);
      
      const mutedTask = new Task({ ...mockTaskEntity, status: 'muted' });
      expect(mutedTask.isMuted()).toBe(true);
    });

    it('should convert to JSON', () => {
      const json = task.toJSON();
      
      expect(json).toEqual(mockTaskEntity);
      expect(json.id).toBe(mockTaskId);
      expect(json.user_id).toBe(mockUserId);
    });
  });
});