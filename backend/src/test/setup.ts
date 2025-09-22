// Test setup file
// This file runs before each test suite

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import {
  initializeDatabase,
  initializeRedis,
  getDbConnection,
  getRedis,
  closeConnections,
} from '../database/connection';

// Load test environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

// Set test environment
process.env['NODE_ENV'] = 'test';

function getDatabaseConfig() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 5432),
      database: (u.pathname || '').replace(/^\//, ''),
      user: decodeURIComponent(u.username || ''),
      password: decodeURIComponent(u.password || ''),
      ssl: false,
    };
  }
  return {
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT || 5432),
    database: process.env.DATABASE_NAME || 'nearme_test',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    ssl: false,
  };
}

function getRedisConfig() {
  const url = process.env.REDIS_URL;
  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 6379),
      db: Number((u.pathname || '').replace(/^\//, '') || 0),
      password: decodeURIComponent(u.password || ''),
    } as any;
  }
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD,
    db: 0,
  } as any;
}

async function applySqlFile(filePath: string) {
  const db = getDbConnection();
  const sql = fs.readFileSync(filePath, 'utf8');
  await db.query(sql);
}

async function applySchema() {
  const base = path.resolve(__dirname, '../../../database/init');
  const filesInOrder = [
    '01-create-extensions.sql',
    '02-create-tables.sql',
    '03-notification-persistence.sql',
    '04-push-notifications.sql',
  ];
  for (const f of filesInOrder) {
    const full = path.join(base, f);
    if (!fs.existsSync(full)) continue;
    try {
      await applySqlFile(full);
    } catch (err) {
      // PostGIS extension may not be available in all environments; don't fail tests because of it
      console.warn(`Warning applying SQL ${f}:`, (err as any)?.message || err);
    }
  }
}

async function truncateAllTables() {
  const db = getDbConnection();
  const { rows } = await db.query<{ tablename: string }>(
    `SELECT tablename
     FROM pg_tables
     WHERE schemaname = 'public'
       AND tablename NOT IN ('spatial_ref_sys')`
  );
  if (rows.length) {
    const tableList = rows.map((r) => `"${r.tablename}"`).join(', ');
    await db.query(`TRUNCATE ${tableList} RESTART IDENTITY CASCADE;`);
  }
}

async function flushRedis() {
  try {
    const redis = getRedis();
    await redis.flushAll();
  } catch (e) {
    // ignore if redis not initialized yet
  }
}

// Global test setup
beforeAll(async () => {
  // Initialize DB and Redis
  await initializeDatabase(getDatabaseConfig());
  await initializeRedis(getRedisConfig());
  // Apply schema
  await applySchema();
  // Ensure clean state
  await truncateAllTables();
  await flushRedis();
});

beforeEach(async () => {
  await truncateAllTables();
  await flushRedis();
});

afterAll(async () => {
  await closeConnections();
});

// Extend global namespace for test utilities
declare global {
  // eslint-disable-next-line no-var
  var testUtils: {
    resetDb: () => Promise<void>;
  };
}

// Global test utilities
(global as any).testUtils = {
  resetDb: async () => {
    await truncateAllTables();
    await flushRedis();
  },
};