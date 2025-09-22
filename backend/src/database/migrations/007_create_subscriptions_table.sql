-- Migration: Create subscriptions table
-- Description: Add subscription management for premium features

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_transaction_id ON subscriptions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_platform ON subscriptions(platform);

-- Ensure only one active subscription per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_active 
ON subscriptions(user_id) 
WHERE status IN ('active', 'trial');

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscriptions_updated_at();