import { Pool, PoolClient, QueryResult } from 'pg';
import { createClient, RedisClientType } from 'redis';

// PostgreSQL connection pool
let pool: Pool | null = null;
let redisClient: RedisClientType | null = null;

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

/**
 * Initialize PostgreSQL connection pool
 */
export function initializeDatabase(config: DatabaseConfig): Pool {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: config.max || 20,
    idleTimeoutMillis: config.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
  });

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  return pool;
}

/**
 * Initialize Redis client
 */
export async function initializeRedis(config: RedisConfig): Promise<RedisClientType> {
  if (redisClient) {
    return redisClient;
  }

  const clientConfig: any = {
    socket: {
      host: config.host,
      port: config.port,
    },
    database: config.db || 0,
  };

  if (config.password) {
    clientConfig.password = config.password;
  }

  redisClient = createClient(clientConfig);

  redisClient.on('error', (err) => {
    console.error('Redis Client Error', err);
  });

  await redisClient.connect();
  return redisClient;
}

/**
 * Get database pool instance
 */
export function getDatabase(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

/**
 * Get Redis client instance
 */
export function getRedis(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call initializeRedis() first.');
  }
  return redisClient;
}

/**
 * Execute a database query with automatic connection handling
 */
export async function query<T extends Record<string, any> = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const db = getDatabase();
  const start = Date.now();
  
  try {
    const result = await db.query<T>(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (> 100ms)
    if (duration > 100) {
      console.warn(`Slow query detected: ${duration}ms - ${text}`);
    }
    
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Execute a database transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const db = getDatabase();
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close all database connections
 */
export async function closeConnections(): Promise<void> {
  const promises: Promise<void>[] = [];
  
  if (pool) {
    promises.push(pool.end());
    pool = null;
  }
  
  if (redisClient) {
    promises.push(redisClient.quit().then(() => {}));
    redisClient = null;
  }
  
  await Promise.all(promises);
}

/**
 * Check database connectivity
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await query('SELECT 1 as health_check');
    return result.rows.length === 1 && result.rows[0].health_check === 1;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Check Redis connectivity
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const redis = getRedis();
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  }
}