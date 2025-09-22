-- Push notification tokens table
CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    device_id TEXT,
    app_version TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used TIMESTAMPTZ,
    
    -- Ensure unique token per user
    UNIQUE(user_id, device_token)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_platform ON push_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_tokens_device_token ON push_tokens(device_token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_last_used ON push_tokens(last_used);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_push_tokens_updated_at
    BEFORE UPDATE ON push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_push_tokens_updated_at();

-- Add push token columns to users table if not exists
DO $$ 
BEGIN
    -- Check if push_token_id column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'push_token_id'
    ) THEN
        ALTER TABLE users ADD COLUMN push_token_id UUID REFERENCES push_tokens(id);
        CREATE INDEX IF NOT EXISTS idx_users_push_token ON users(push_token_id);
    END IF;
END $$;

-- Function to clean up inactive push tokens
CREATE OR REPLACE FUNCTION cleanup_inactive_push_tokens(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM push_tokens 
    WHERE is_active = false 
    AND updated_at < NOW() - INTERVAL '1 day' * days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up duplicate push tokens
CREATE OR REPLACE FUNCTION cleanup_duplicate_push_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM push_tokens 
    WHERE id NOT IN (
        SELECT DISTINCT ON (user_id, device_token) id
        FROM push_tokens
        ORDER BY user_id, device_token, updated_at DESC
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- View for push token statistics
CREATE OR REPLACE VIEW push_token_stats AS
SELECT 
    COUNT(*) as total_tokens,
    COUNT(*) FILTER (WHERE is_active = true) as active_tokens,
    COUNT(*) FILTER (WHERE is_active = false) as inactive_tokens,
    COUNT(*) FILTER (WHERE platform = 'ios' AND is_active = true) as active_ios_tokens,
    COUNT(*) FILTER (WHERE platform = 'android' AND is_active = true) as active_android_tokens,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT user_id) FILTER (WHERE is_active = true) as active_users
FROM push_tokens;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON push_tokens TO nearme_app;
GRANT USAGE ON SEQUENCE push_tokens_id_seq TO nearme_app;
GRANT SELECT ON push_token_stats TO nearme_app;
GRANT EXECUTE ON FUNCTION cleanup_inactive_push_tokens(INTEGER) TO nearme_app;
GRANT EXECUTE ON FUNCTION cleanup_duplicate_push_tokens() TO nearme_app;