const { Pool } = require('pg');
require('dotenv').config();

async function testSubscriptionSystem() {
  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'nearme_dev',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
  });

  try {
    console.log('🔍 Testing subscription system...');

    // Create subscriptions table
    console.log('📋 Creating subscriptions table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          plan_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('active', 'trial', 'expired', 'cancelled', 'pending')),
          start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          end_date TIMESTAMPTZ NOT NULL,
          trial_end_date TIMESTAMPTZ,
          auto_renew BOOLEAN NOT NULL DEFAULT true,
          platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
          transaction_id TEXT UNIQUE,
          original_transaction_id TEXT,
          receipt_data TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Create indexes
    console.log('📊 Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);');

    // Test inserting a subscription
    console.log('➕ Testing subscription creation...');
    const testUserId = '123e4567-e89b-12d3-a456-426614174000';
    
    const result = await pool.query(`
      INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date, platform)
      VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '7 days', $4)
      RETURNING *
    `, [testUserId, 'premium_monthly', 'trial', 'ios']);

    console.log('✅ Subscription created:', result.rows[0]);

    // Test querying subscriptions
    console.log('🔍 Testing subscription query...');
    const queryResult = await pool.query(
      'SELECT * FROM subscriptions WHERE user_id = $1',
      [testUserId]
    );

    console.log('✅ Subscription found:', queryResult.rows[0]);

    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    await pool.query('DELETE FROM subscriptions WHERE user_id = $1', [testUserId]);

    console.log('🎉 Subscription system test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing subscription system:', error);
  } finally {
    await pool.end();
  }
}

testSubscriptionSystem();