import { query, transaction } from '../database/connection';
import { 
  TaskEntity, 
  CreateTaskRequest, 
  UpdateTaskRequest, 
  TaskStatus,
  LocationType,
  POICategory,
  GeofenceRadii 
} from './types';
import { validateSchema, createTaskSchema, updateTaskSchema, ValidationError, validateTaskLimit } from './validation';
import { User } from './User';

export class Task {
  public id: string;
  public user_id: string;
  public title: string;
  public description?: string;
  public location_type: LocationType;
  public place_id?: string;
  public poi_category?: POICategory;
  public custom_radii?: GeofenceRadii;
  public status: TaskStatus;
  public created_at: Date;
  public completed_at?: Date;
  public updated_at: Date;

  constructor(entity: TaskEntity) {
    this.id = entity.id;
    this.user_id = entity.user_id;
    this.title = entity.title;
    this.description = entity.description;
    this.location_type = entity.location_type;
    this.place_id = entity.place_id;
    this.poi_category = entity.poi_category;
    this.custom_radii = entity.custom_radii;
    this.status = entity.status;
    this.created_at = entity.created_at;
    this.completed_at = entity.completed_at;
    this.updated_at = entity.updated_at;
  }

  /**
   * Create a new task
   */
  static async create(userId: string, data: CreateTaskRequest): Promise<Task> {
    const validatedData = validateSchema<CreateTaskRequest>(createTaskSchema, data);
    
    // Check if user exists and can create tasks
    const user = await User.findById(userId);
    if (!user) {
      throw new ValidationError('User not found', []);
    }

    const canCreate = await user.canCreateTask();
    if (!canCreate) {
      throw new ValidationError('Free users are limited to 3 active tasks. Upgrade to premium for unlimited tasks.', []);
    }

    // Validate place_id exists if location_type is custom_place
    if (validatedData.location_type === 'custom_place' && validatedData.place_id) {
      const placeExists = await query(
        'SELECT id FROM places WHERE id = $1 AND user_id = $2',
        [validatedData.place_id, userId]
      );
      
      if (placeExists.rows.length === 0) {
        throw new ValidationError('Place not found or does not belong to user', []);
      }
    }

    const result = await query<TaskEntity>(
      `INSERT INTO tasks (user_id, title, description, location_type, place_id, poi_category, custom_radii, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        validatedData.title,
        validatedData.description || null,
        validatedData.location_type,
        validatedData.place_id || null,
        validatedData.poi_category || null,
        validatedData.custom_radii ? JSON.stringify(validatedData.custom_radii) : null,
        'active'
      ]
    );

    return new Task(result.rows[0]);
  }

  /**
   * Find task by ID
   */
  static async findById(id: string, userId?: string): Promise<Task | null> {
    let queryText = 'SELECT * FROM tasks WHERE id = $1';
    const queryParams = [id];

    if (userId) {
      queryText += ' AND user_id = $2';
      queryParams.push(userId);
    }

    const result = await query<TaskEntity>(queryText, queryParams);
    return result.rows.length > 0 ? new Task(result.rows[0]) : null;
  }

  /**
   * Find all tasks for a user with optional filtering
   */
  static async findByUserId(
    userId: string, 
    options: {
      status?: TaskStatus;
      location_type?: LocationType;
      updated_since?: Date;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ tasks: Task[], total: number }> {
    const { status, location_type, updated_since, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    // Build dynamic query
    let whereClause = 'WHERE user_id = $1';
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    if (location_type) {
      whereClause += ` AND location_type = $${paramIndex}`;
      queryParams.push(location_type);
      paramIndex++;
    }

    if (updated_since) {
      whereClause += ` AND updated_at > $${paramIndex}`;
      queryParams.push(updated_since);
      paramIndex++;
    }

    const [tasksResult, countResult] = await Promise.all([
      query<TaskEntity>(
        `SELECT * FROM tasks ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM tasks ${whereClause}`,
        queryParams
      )
    ]);

    const tasks = tasksResult.rows.map(row => new Task(row));
    const total = parseInt(countResult.rows[0].count, 10);

    return { tasks, total };
  }

  /**
   * Update task
   */
  async update(data: UpdateTaskRequest): Promise<Task> {
    const validatedData = validateSchema<UpdateTaskRequest>(updateTaskSchema, data);
    
    // Validate place_id exists if being updated to custom_place
    if (validatedData.location_type === 'custom_place' && validatedData.place_id) {
      const placeExists = await query(
        'SELECT id FROM places WHERE id = $1 AND user_id = $2',
        [validatedData.place_id, this.user_id]
      );
      
      if (placeExists.rows.length === 0) {
        throw new ValidationError('Place not found or does not belong to user', []);
      }
    }

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (validatedData.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(validatedData.title);
    }

    if (validatedData.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(validatedData.description);
    }

    if (validatedData.location_type !== undefined) {
      updates.push(`location_type = $${paramIndex++}`);
      values.push(validatedData.location_type);
    }

    if (validatedData.place_id !== undefined) {
      updates.push(`place_id = $${paramIndex++}`);
      values.push(validatedData.place_id);
    }

    if (validatedData.poi_category !== undefined) {
      updates.push(`poi_category = $${paramIndex++}`);
      values.push(validatedData.poi_category);
    }

    if (validatedData.custom_radii !== undefined) {
      updates.push(`custom_radii = $${paramIndex++}`);
      values.push(validatedData.custom_radii ? JSON.stringify(validatedData.custom_radii) : null);
    }

    if (validatedData.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(validatedData.status);
      
      // Set completed_at if status is being set to completed
      if (validatedData.status === 'completed') {
        updates.push(`completed_at = NOW()`);
      } else if (validatedData.status === 'active' && this.status === 'completed') {
        // Clear completed_at if reactivating a completed task
        updates.push(`completed_at = NULL`);
      }
    }

    if (updates.length === 0) {
      return this; // No updates to make
    }

    updates.push(`updated_at = NOW()`);
    values.push(this.id);

    const result = await query<TaskEntity>(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    const updatedTask = new Task(result.rows[0]);
    Object.assign(this, updatedTask);
    return this;
  }

  /**
   * Complete task
   */
  async complete(): Promise<Task> {
    return this.update({ status: 'completed' });
  }

  /**
   * Mute task
   */
  async mute(): Promise<Task> {
    return this.update({ status: 'muted' });
  }

  /**
   * Reactivate task
   */
  async reactivate(): Promise<Task> {
    // Check if user can have more active tasks
    const user = await User.findById(this.user_id);
    if (!user) {
      throw new ValidationError('User not found', []);
    }

    if (this.status !== 'active') {
      const canCreate = await user.canCreateTask();
      if (!canCreate) {
        throw new ValidationError('Free users are limited to 3 active tasks. Upgrade to premium for unlimited tasks.', []);
      }
    }

    return this.update({ status: 'active' });
  }

  /**
   * Delete task and associated geofences
   */
  async delete(): Promise<void> {
    await transaction(async (client) => {
      // Delete associated geofences first
      await client.query('DELETE FROM geofences WHERE task_id = $1', [this.id]);
      // Delete the task
      await client.query('DELETE FROM tasks WHERE id = $1', [this.id]);
    });
  }

  /**
   * Get active tasks count for a user
   */
  static async getActiveTaskCount(userId: string): Promise<number> {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM tasks WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get tasks by status for a user
   */
  static async findByStatus(userId: string, status: TaskStatus): Promise<Task[]> {
    const result = await query<TaskEntity>(
      'SELECT * FROM tasks WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
      [userId, status]
    );

    return result.rows.map(row => new Task(row));
  }

  /**
   * Get tasks by location type for a user
   */
  static async findByLocationType(userId: string, locationType: LocationType): Promise<Task[]> {
    const result = await query<TaskEntity>(
      'SELECT * FROM tasks WHERE user_id = $1 AND location_type = $2 ORDER BY created_at DESC',
      [userId, locationType]
    );

    return result.rows.map(row => new Task(row));
  }

  /**
   * Get tasks associated with a specific place
   */
  static async findByPlaceId(placeId: string): Promise<Task[]> {
    const result = await query<TaskEntity>(
      'SELECT * FROM tasks WHERE place_id = $1 ORDER BY created_at DESC',
      [placeId]
    );

    return result.rows.map(row => new Task(row));
  }

  /**
   * Get tasks by POI category for a user
   */
  static async findByPOICategory(userId: string, category: POICategory): Promise<Task[]> {
    const result = await query<TaskEntity>(
      'SELECT * FROM tasks WHERE user_id = $1 AND poi_category = $2 ORDER BY created_at DESC',
      [userId, category]
    );

    return result.rows.map(row => new Task(row));
  }

  /**
   * Check if task belongs to user
   */
  belongsToUser(userId: string): boolean {
    return this.user_id === userId;
  }

  /**
   * Check if task is active
   */
  isActive(): boolean {
    return this.status === 'active';
  }

  /**
   * Check if task is completed
   */
  isCompleted(): boolean {
    return this.status === 'completed';
  }

  /**
   * Check if task is muted
   */
  isMuted(): boolean {
    return this.status === 'muted';
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON(): TaskEntity {
    return {
      id: this.id,
      user_id: this.user_id,
      title: this.title,
      description: this.description,
      location_type: this.location_type,
      place_id: this.place_id,
      poi_category: this.poi_category,
      custom_radii: this.custom_radii,
      status: this.status,
      created_at: this.created_at,
      completed_at: this.completed_at,
      updated_at: this.updated_at
    };
  }
}