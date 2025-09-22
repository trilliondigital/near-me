import { TaskService } from '../taskService';
import { Task } from '../../models/Task';
import { User } from '../../models/User';
import { ValidationError } from '../../models/validation';
import { CreateTaskRequest, UpdateTaskRequest, TaskStatus } from '../../models/types';

// Mock the models
jest.mock('../../models/Task');
jest.mock('../../models/User');

const MockTask = Task as jest.MockedClass<typeof Task>;
const MockUser = User as jest.MockedClass<typeof User>;

describe('TaskService', () => {
  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockTaskId = '550e8400-e29b-41d4-a716-446655440001';

  const mockUser = {
    id: mockUserId,
    device_id: 'device-123',
    canCreateTask: jest.fn().mockResolvedValue(true)
  };

  const mockTask = {
    id: mockTaskId,
    user_id: mockUserId,
    title: 'Buy groceries',
    description: 'Get milk and bread',
    location_type: 'poi_category',
    poi_category: 'grocery',
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
    toJSON: jest.fn().mockReturnValue({
      id: mockTaskId,
      title: 'Buy groceries',
      status: 'active'
    }),
    update: jest.fn(),
    complete: jest.fn(),
    mute: jest.fn(),
    reactivate: jest.fn(),
    delete: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (MockUser.findById as jest.MockedFunction<typeof MockUser.findById>).mockResolvedValue(mockUser as any);
    (MockTask.create as jest.MockedFunction<typeof MockTask.create>).mockResolvedValue(mockTask as any);
    (MockTask.findById as jest.MockedFunction<typeof MockTask.findById>).mockResolvedValue(mockTask as any);
  });

  describe('createTask', () => {
    it('should create a new task successfully', async () => {
      const createData: CreateTaskRequest = {
        title: 'Buy groceries',
        location_type: 'poi_category',
        poi_category: 'grocery'
      };

      const result = await TaskService.createTask(mockUserId, createData);

      expect(MockUser.findById).toHaveBeenCalledWith(mockUserId);
      expect(MockTask.create).toHaveBeenCalledWith(mockUserId, createData);
      expect(result).toBe(mockTask);
    });

    it('should throw error if user not found', async () => {
      (MockUser.findById as jest.MockedFunction<typeof MockUser.findById>).mockResolvedValueOnce(null);

      const createData: CreateTaskRequest = {
        title: 'Buy groceries',
        location_type: 'poi_category',
        poi_category: 'grocery'
      };

      await expect(TaskService.createTask(mockUserId, createData)).rejects.toThrow(ValidationError);
      expect(MockTask.create).not.toHaveBeenCalled();
    });
  });

  describe('getUserTasks', () => {
    it('should get user tasks with default pagination', async () => {
      const mockTasksResult = {
        tasks: [mockTask],
        total: 1
      };

      (MockTask.findByUserId as jest.MockedFunction<typeof MockTask.findByUserId>).mockResolvedValueOnce(mockTasksResult as any);

      const result = await TaskService.getUserTasks(mockUserId);

      expect(MockUser.findById).toHaveBeenCalledWith(mockUserId);
      expect(MockTask.findByUserId).toHaveBeenCalledWith(mockUserId, {
        status: undefined,
        location_type: undefined,
        page: 1,
        limit: 20
      });
      expect(result.tasks).toEqual([mockTask]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('getTaskById', () => {
    it('should get task by ID', async () => {
      const result = await TaskService.getTaskById(mockTaskId, mockUserId);

      expect(MockTask.findById).toHaveBeenCalledWith(mockTaskId, mockUserId);
      expect(result).toBe(mockTask);
    });
  });

  describe('completeTask', () => {
    it('should complete task successfully', async () => {
      const completedTask = { ...mockTask, status: 'completed' };
      mockTask.complete.mockResolvedValueOnce(completedTask);

      const result = await TaskService.completeTask(mockTaskId, mockUserId);

      expect(MockTask.findById).toHaveBeenCalledWith(mockTaskId, mockUserId);
      expect(mockTask.complete).toHaveBeenCalled();
      expect(result).toBe(completedTask);
    });
  });

  describe('deleteTask', () => {
    it('should delete task successfully', async () => {
      await TaskService.deleteTask(mockTaskId, mockUserId);

      expect(MockTask.findById).toHaveBeenCalledWith(mockTaskId, mockUserId);
      expect(mockTask.delete).toHaveBeenCalled();
    });
  });
});