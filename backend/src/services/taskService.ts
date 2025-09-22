import { Task } from '../models/Task';
import { User } from '../models/User';
import { 
  CreateTaskRequest, 
  UpdateTaskRequest, 
  TaskStatus, 
  LocationType,
  POICategory 
} from '../models/types';
import { ValidationError } from '../models/validation';

export interface TaskFilters {
  status?: TaskStatus;
  location_type?: LocationType;
  poi_category?: POICategory;
  page?: number;
  limit?: number;
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class TaskService {
  /**
   * Create a new task for a user
   */
  static async createTask(userId: string, data: CreateTaskRequest): Promise<Task> {
    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError('User not found', []);
    }

    // Create the task
    const task = await Task.create(userId, data);

    // TODO: In future tasks, this will trigger geofence creation
    // await GeofenceService.createGeofencesForTask(task);

    return task;
  }

  /**
   * Get tasks for a user with filtering and pagination
   */
  static async getUserTasks(userId: string, filters: TaskFilters = {}): Promise<TaskListResponse> {
    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError('User not found', []);
    }

    const { page = 1, limit = 20 } = filters;
    
    // Build query options
    const queryOptions = {
      status: filters.status,
      location_type: filters.location_type,
      page,
      limit
    };

    const { tasks, total } = await Task.findByUserId(userId, queryOptions);
    
    // Filter by POI category if specified (since it's not in the main query)
    let filteredTasks = tasks;
    if (filters.poi_category) {
      filteredTasks = tasks.filter(task => task.poi_category === filters.poi_category);
    }

    const totalPages = Math.ceil(total / limit);

    return {
      tasks: filteredTasks,
      total,
      page,
      limit,
      totalPages
    };
  }

  /**
   * Get a specific task by ID
   */
  static async getTaskById(taskId: string, userId: string): Promise<Task> {
    const task = await Task.findById(taskId, userId);
    if (!task) {
      throw new ValidationError('Task not found', []);
    }

    return task;
  }

  /**
   * Update a task
   */
  static async updateTask(taskId: string, userId: string, data: UpdateTaskRequest): Promise<Task> {
    const task = await Task.findById(taskId, userId);
    if (!task) {
      throw new ValidationError('Task not found', []);
    }

    // If reactivating a task, check task limits
    if (data.status === 'active' && task.status !== 'active') {
      const user = await User.findById(userId);
      if (!user) {
        throw new ValidationError('User not found', []);
      }

      const canCreate = await user.canCreateTask();
      if (!canCreate) {
        throw new ValidationError('Free users are limited to 3 active tasks. Upgrade to premium for unlimited tasks.', []);
      }
    }

    const updatedTask = await task.update(data);

    // TODO: In future tasks, this will update geofences if location changed
    // if (locationChanged) {
    //   await GeofenceService.updateGeofencesForTask(updatedTask);
    // }

    return updatedTask;
  }

  /**
   * Complete a task
   */
  static async completeTask(taskId: string, userId: string): Promise<Task> {
    const task = await Task.findById(taskId, userId);
    if (!task) {
      throw new ValidationError('Task not found', []);
    }

    const completedTask = await task.complete();

    // TODO: In future tasks, this will remove geofences
    // await GeofenceService.removeGeofencesForTask(taskId);

    return completedTask;
  }

  /**
   * Mute a task
   */
  static async muteTask(taskId: string, userId: string): Promise<Task> {
    const task = await Task.findById(taskId, userId);
    if (!task) {
      throw new ValidationError('Task not found', []);
    }

    const mutedTask = await task.mute();

    // TODO: In future tasks, this will disable notifications but keep geofences
    // await NotificationService.muteTaskNotifications(taskId);

    return mutedTask;
  }

  /**
   * Reactivate a task
   */
  static async reactivateTask(taskId: string, userId: string): Promise<Task> {
    const task = await Task.findById(taskId, userId);
    if (!task) {
      throw new ValidationError('Task not found', []);
    }

    const reactivatedTask = await task.reactivate();

    // TODO: In future tasks, this will re-enable notifications and geofences
    // await GeofenceService.createGeofencesForTask(reactivatedTask);
    // await NotificationService.enableTaskNotifications(taskId);

    return reactivatedTask;
  }

  /**
   * Delete a task
   */
  static async deleteTask(taskId: string, userId: string): Promise<void> {
    const task = await Task.findById(taskId, userId);
    if (!task) {
      throw new ValidationError('Task not found', []);
    }

    // TODO: In future tasks, this will remove geofences and notifications
    // await GeofenceService.removeGeofencesForTask(taskId);
    // await NotificationService.removeTaskNotifications(taskId);

    await task.delete();
  }

  /**
   * Get task statistics for a user
   */
  static async getTaskStats(userId: string): Promise<{
    total: number;
    active: number;
    completed: number;
    muted: number;
    byLocationType: Record<LocationType, number>;
    byPOICategory: Record<POICategory, number>;
  }> {
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError('User not found', []);
    }

    const [allTasks, activeTasks, completedTasks, mutedTasks] = await Promise.all([
      Task.findByUserId(userId, { limit: 1000 }), // Get all tasks for stats
      Task.findByStatus(userId, 'active'),
      Task.findByStatus(userId, 'completed'),
      Task.findByStatus(userId, 'muted')
    ]);

    // Calculate stats by location type
    const byLocationType: Record<LocationType, number> = {
      custom_place: 0,
      poi_category: 0
    };

    // Calculate stats by POI category
    const byPOICategory: Record<POICategory, number> = {
      gas: 0,
      pharmacy: 0,
      grocery: 0,
      bank: 0,
      post_office: 0
    };

    allTasks.tasks.forEach(task => {
      byLocationType[task.location_type]++;
      if (task.poi_category) {
        byPOICategory[task.poi_category]++;
      }
    });

    return {
      total: allTasks.total,
      active: activeTasks.length,
      completed: completedTasks.length,
      muted: mutedTasks.length,
      byLocationType,
      byPOICategory
    };
  }

  /**
   * Get tasks that need geofence updates (for background processing)
   */
  static async getTasksNeedingGeofenceUpdate(): Promise<Task[]> {
    // This would be used by background jobs to update geofences
    // For now, return empty array as geofencing is implemented in later tasks
    return [];
  }

  /**
   * Bulk update task statuses (for admin operations)
   */
  static async bulkUpdateTaskStatus(
    userId: string, 
    taskIds: string[], 
    status: TaskStatus
  ): Promise<Task[]> {
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError('User not found', []);
    }

    const updatedTasks: Task[] = [];

    for (const taskId of taskIds) {
      try {
        const task = await Task.findById(taskId, userId);
        if (task) {
          const updatedTask = await task.update({ status });
          updatedTasks.push(updatedTask);
        }
      } catch (error) {
        // Continue with other tasks if one fails
        console.error(`Failed to update task ${taskId}:`, error);
      }
    }

    return updatedTasks;
  }

  /**
   * Get tasks by place (for place deletion validation)
   */
  static async getTasksByPlace(placeId: string): Promise<Task[]> {
    return Task.findByPlaceId(placeId);
  }

  /**
   * Validate task creation limits
   */
  static async validateTaskCreation(userId: string): Promise<boolean> {
    const user = await User.findById(userId);
    if (!user) {
      return false;
    }

    return user.canCreateTask();
  }
}