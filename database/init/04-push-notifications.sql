-- Add push notification token support to users table
-- This migration adds a JSONB column to store push notification tokens

-- Add push_token column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token JSONB;

-- Create index on push_token for efficient queries
CREATE INDEX IF NOT EXISTS idx_users_push_token_active 
ON users USING GIN ((push_token->>'is_active')) 
WHERE push_token IS NOT NULL;

-- Create index on push_token platform for filtering
CREATE INDEX IF NOT EXISTS idx_users_push_token_platform 
ON users USING GIN ((push_token->>'platform')) 
WHERE push_token IS NOT NULL;

-- Add comment explaining the push_token structure
COMMENT ON COLUMN users.push_token IS 'JSONB object containing push notification token info: {device_token: string, platform: "ios"|"android", is_active: boolean, last_updated: timestamp}';
