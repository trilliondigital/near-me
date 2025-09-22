-- Migration: Privacy and Data Export Tables
-- Description: Add tables for privacy settings, data exports, and location history

-- Add privacy_settings column to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{}';

-- Create data_exports table for tracking export requests
CREATE TABLE IF NOT EXISTS data_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_data JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    file_path TEXT,
    file_size BIGINT,
    download_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    
    CONSTRAINT valid_export_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired'))
);

-- Create indexes for data_exports
CREATE INDEX IF NOT EXISTS idx_data_exports_user_id ON data_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_data_exports_status ON data_exports(status);
CREATE INDEX IF NOT EXISTS idx_data_exports_expires_at ON data_exports(expires_at);

-- Create location_history table for tracking location events (optional)
CREATE TABLE IF NOT EXISTS location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(8, 2),
    event_type TEXT NOT NULL,
    context_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_location_event_type CHECK (event_type IN ('geofence_enter', 'geofence_exit', 'significant_change', 'visit_start', 'visit_end'))
);

-- Create indexes for location_history
CREATE INDEX IF NOT EXISTS idx_location_history_user_id ON location_history(user_id);
CREATE INDEX IF NOT EXISTS idx_location_history_created_at ON location_history(created_at);
CREATE INDEX IF NOT EXISTS idx_location_history_location ON location_history(latitude, longitude);

-- Create geofence_events table if it doesn't exist (for location history export)
CREATE TABLE IF NOT EXISTS geofence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    geofence_id UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    accuracy DECIMAL(8, 2),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT valid_geofence_event_type CHECK (event_type IN ('enter', 'exit'))
);

-- Create indexes for geofence_events
CREATE INDEX IF NOT EXISTS idx_geofence_events_geofence_id ON geofence_events(geofence_id);
CREATE INDEX IF NOT EXISTS idx_geofence_events_timestamp ON geofence_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_geofence_events_processed ON geofence_events(processed) WHERE processed = FALSE;

-- Create notifications table if it doesn't exist (for notification history export)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    action_taken TEXT,
    action_taken_at TIMESTAMPTZ,
    
    CONSTRAINT valid_notification_type CHECK (type IN ('approach', 'arrival', 'post_arrival')),
    CONSTRAINT valid_notification_action CHECK (action_taken IS NULL OR action_taken IN ('complete', 'snooze_15m', 'snooze_1h', 'snooze_today', 'open_map', 'mute'))
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Add updated_at trigger for data_exports
CREATE OR REPLACE FUNCTION update_data_exports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_data_exports_updated_at
    BEFORE UPDATE ON data_exports
    FOR EACH ROW
    EXECUTE FUNCTION update_data_exports_updated_at();

-- Add privacy-related indexes to existing tables
CREATE INDEX IF NOT EXISTS idx_users_privacy_settings ON users USING GIN (privacy_settings);

-- Add comments for documentation
COMMENT ON TABLE data_exports IS 'Tracks user data export requests and their status';
COMMENT ON TABLE location_history IS 'Stores anonymized location events for privacy compliance';
COMMENT ON TABLE geofence_events IS 'Records geofence entry/exit events for location history';
COMMENT ON TABLE notifications IS 'Stores notification history for export purposes';

COMMENT ON COLUMN users.privacy_settings IS 'JSON object containing user privacy preferences';
COMMENT ON COLUMN data_exports.request_data IS 'JSON object containing the original export request parameters';
COMMENT ON COLUMN data_exports.expires_at IS 'When the export download link expires (typically 7 days)';
COMMENT ON COLUMN location_history.context_data IS 'Additional context about the location event (task info, etc.)';

-- Insert default privacy settings for existing users
UPDATE users 
SET privacy_settings = '{
    "locationPrivacyMode": "standard",
    "onDeviceProcessing": true,
    "dataMinimization": true,
    "analyticsOptOut": false,
    "crashReportingOptOut": false,
    "locationHistoryRetention": 30
}'::jsonb
WHERE privacy_settings = '{}'::jsonb OR privacy_settings IS NULL;