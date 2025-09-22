import { Router, Request, Response, NextFunction } from 'express';
import { TaskService, TaskFilters } from '../services/taskService';
import { CreateTaskRequest, UpdateTaskRequest, TaskStatus, LocationType, POICategory } from '../models/types';
import { ValidationError } from '../models/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Extend Request interface to include user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    device_id: string;
  };
}

/**
 * GET /api/tasks
 * Get all tasks for the authenticated user with optional filtering
 */
router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    
    // Parse query parameters
    const filters: TaskFilters = {
      status: req.query.status as TaskStatus,
      location_type: req.query.location_type as LocationType,
      poi_category: req.query.poi_category as POICategory,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof TaskFilters] === undefined) {
        delete filters[key as keyof TaskFilters];
      }
    });

    const result = await TaskService.getUserTasks(userId, filters);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tasks/stats
 * Get task statistics for the authenticated user
 */
router.get('/stats', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const stats = await TaskService.getTaskStats(userId);

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/tasks/:id
 * Get a specific task by ID
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const taskId = req.params.id;

    const task = await TaskService.getTaskById(taskId, userId);

    res.json({
      success: true,
      data: task.toJSON(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const taskData: CreateTaskRequest = req.body;

    const task = await TaskService.createTask(userId, taskData);

    res.status(201).json({
      success: true,
      data: task.toJSON(),
      message: 'Task created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/tasks/:id
 * Update a task
 */
router.put('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const taskId = req.params.id;
    const updateData: UpdateTaskRequest = req.body;

    const task = await TaskService.updateTask(taskId, userId, updateData);

    res.json({
      success: true,
      data: task.toJSON(),
      message: 'Task updated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tasks/:id/complete
 * Mark a task as completed
 */
router.post('/:id/complete', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const taskId = req.params.id;

    const task = await TaskService.completeTask(taskId, userId);

    res.json({
      success: true,
      data: task.toJSON(),
      message: 'Task completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tasks/:id/mute
 * Mute a task (stop notifications but keep active)
 */
router.post('/:id/mute', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const taskId = req.params.id;

    const task = await TaskService.muteTask(taskId, userId);

    res.json({
      success: true,
      data: task.toJSON(),
      message: 'Task muted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tasks/:id/reactivate
 * Reactivate a muted or completed task
 */
router.post('/:id/reactivate', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const taskId = req.params.id;

    const task = await TaskService.reactivateTask(taskId, userId);

    res.json({
      success: true,
      data: task.toJSON(),
      message: 'Task reactivated successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const taskId = req.params.id;

    await TaskService.deleteTask(taskId, userId);

    res.json({
      success: true,
      message: 'Task deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/tasks/bulk/status
 * Bulk update task statuses
 */
router.post('/bulk/status', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { taskIds, status }: { taskIds: string[], status: TaskStatus } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw new ValidationError('taskIds must be a non-empty array', []);
    }

    if (!['active', 'completed', 'muted'].includes(status)) {
      throw new ValidationError('Invalid status value', []);
    }

    const updatedTasks = await TaskService.bulkUpdateTaskStatus(userId, taskIds, status);

    res.json({
      success: true,
      data: updatedTasks.map(task => task.toJSON()),
      message: `${updatedTasks.length} tasks updated successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

export { router as taskRoutes };