import { v4 as uuidv4 } from 'uuid';
import {
  getDbConnection,
  checkDatabaseHealth,
  checkRedisHealth,
  query,
} from '../../database/connection';

/**
 * Integration tests that rely on real Postgres and Redis services.
 * Schema is applied by src/test/setup.ts before tests run.
 */

describe('Database and Redis integration health', () => {
  it('should report healthy for Postgres and Redis', async () => {
    await expect(checkDatabaseHealth()).resolves.toBe(true);
    await expect(checkRedisHealth()).resolves.toBe(true);
  });

  it('should insert and read a user row from Postgres schema', async () => {
    const id = uuidv4();
    const deviceId = `device-${uuidv4()}`;

    // Insert user
    await query(
      `INSERT INTO users (id, device_id, email, preferences, premium_status)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, deviceId, 'test@example.com', JSON.stringify({ theme: 'dark' }), 'free']
    );

    // Read back
    const res = await query<{ id: string; device_id: string }>(
      `SELECT id, device_id FROM users WHERE id = $1`,
      [id]
    );

    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].id).toBe(id);
    expect(res.rows[0].device_id).toBe(deviceId);
  });
});
