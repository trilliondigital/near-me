-- Migration: Create analytics and event tracking tables
-- Description: Add tables for tracking user behavior events and analytics

-- User events table for behavioral analytics
CREATE TABLE IF NOT EXISTS user_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}',
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    app_version TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Privacy and consent tracking
    analytics_consent BOOLEAN DEFAULT TRUE,
    anonymized BOOLEAN DEFAULT FALSE,
    
    -- Context information
    user_agent TEXT,
    ip_address INET,
    country_code TEXT,
    timezone TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics sessions table
CREATE TABLE IF NOT EXISTS analytics_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    app_version TEXT NOT NULL,
    
    -- Session timing
    session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_end TIMESTAMPTZ,
    session_duration_ms BIGINT,
    
    -- Session context
    is_first_session BOOLEAN DEFAULT FALSE,
    previous_session_id TEXT,
    
    -- App state
    app_state_changes INTEGER DEFAULT 0,
    background_time_ms BIGINT DEFAULT 0,
    foreground_time_ms BIGINT DEFAULT 0,
    
    -- User engagement
    screens_viewed INTEGER DEFAULT 0,
    actions_performed INTEGER DEFAULT 0,
    notifications_received INTEGER DEFAULT 0,
    notifications_interacted INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User properties table for analytics segmentation
CREATE TABLE IF NOT EXISTS user_analytics_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    
    -- User preferences (from tracking plan)
    nudge_style TEXT DEFAULT 'standard',
    quiet_hours JSONB,
    default_radii JSONB,
    premium_status TEXT DEFAULT 'free',
    
    -- Behavioral properties
    total_tasks_created INTEGER DEFAULT 0,
    total_places_added INTEGER DEFAULT 0,
    total_notifications_received INTEGER DEFAULT 0,
    total_tasks_completed INTEGER DEFAULT 0,
    
    -- Engagement metrics
    days_active INTEGER DEFAULT 0,
    last_active_date DATE,
    retention_cohort DATE,
    
    -- Onboarding and conversion
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_completed_at TIMESTAMPTZ,
    trial_started BOOLEAN DEFAULT FALSE,
    trial_started_at TIMESTAMPTZ,
    premium_converted BOOLEAN DEFAULT FALSE,
    premium_converted_at TIMESTAMPTZ,
    
    -- Geographic and device info
    primary_country TEXT,
    primary_timezone TEXT,
    primary_platform TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics configuration table
CREATE TABLE IF NOT EXISTS analytics_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event type definitions table
CREATE TABLE IF NOT EXISTS event_type_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL, -- 'user_action', 'system_event', 'business_metric'
    description TEXT,
    schema_definition JSONB, -- JSON schema for event_data validation
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_events_user_timestamp 
    ON user_events(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_user_events_type_timestamp 
    ON user_events(event_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_user_events_session 
    ON user_events(session_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_user_events_platform_timestamp 
    ON user_events(platform, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_user_events_consent 
    ON user_events(analytics_consent) WHERE analytics_consent = TRUE;

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user_start 
    ON analytics_sessions(user_id, session_start DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_platform_start 
    ON analytics_sessions(platform, session_start DESC);

CREATE INDEX IF NOT EXISTS idx_user_analytics_properties_user 
    ON user_analytics_properties(user_id);

CREATE INDEX IF NOT EXISTS idx_user_analytics_properties_cohort 
    ON user_analytics_properties(retention_cohort);

CREATE INDEX IF NOT EXISTS idx_user_analytics_properties_premium 
    ON user_analytics_properties(premium_status);

-- Partial indexes for active users
CREATE INDEX IF NOT EXISTS idx_user_events_recent_active 
    ON user_events(user_id, timestamp DESC) 
    WHERE timestamp >= NOW() - INTERVAL '30 days';

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_recent 
    ON analytics_sessions(user_id, session_start DESC) 
    WHERE session_start >= NOW() - INTERVAL '30 days';

-- Insert default event type definitions
INSERT INTO event_type_definitions (event_type, category, description, schema_definition) VALUES 
('task_created', 'user_action', 'User creates a new task', '{
    "type": "object",
    "properties": {
        "task_id": {"type": "string"},
        "location_type": {"type": "string", "enum": ["custom_place", "poi_category"]},
        "place_id": {"type": "string"},
        "poi_category": {"type": "string"},
        "has_description": {"type": "boolean"}
    },
    "required": ["task_id", "location_type"]
}'::jsonb),

('place_added', 'user_action', 'User adds a custom place', '{
    "type": "object",
    "properties": {
        "place_id": {"type": "string"},
        "place_type": {"type": "string", "enum": ["home", "work", "custom"]},
        "method": {"type": "string", "enum": ["map_selection", "address_search", "current_location"]}
    },
    "required": ["place_id", "place_type", "method"]
}'::jsonb),

('geofence_registered', 'system_event', 'Geofence is registered for a task', '{
    "type": "object",
    "properties": {
        "task_id": {"type": "string"},
        "geofence_id": {"type": "string"},
        "geofence_type": {"type": "string"},
        "radius_meters": {"type": "number"}
    },
    "required": ["task_id", "geofence_id", "geofence_type"]
}'::jsonb),

('nudge_shown', 'system_event', 'Notification nudge is shown to user', '{
    "type": "object",
    "properties": {
        "task_id": {"type": "string"},
        "nudge_type": {"type": "string", "enum": ["approach", "arrival", "post_arrival"]},
        "location_name": {"type": "string"},
        "distance_meters": {"type": "number"}
    },
    "required": ["task_id", "nudge_type"]
}'::jsonb),

('task_completed', 'user_action', 'User completes a task', '{
    "type": "object",
    "properties": {
        "task_id": {"type": "string"},
        "completion_method": {"type": "string", "enum": ["notification_action", "app_action", "auto_complete"]},
        "time_to_complete_hours": {"type": "number"},
        "nudges_received": {"type": "number"}
    },
    "required": ["task_id", "completion_method"]
}'::jsonb),

('snooze_selected', 'user_action', 'User snoozes a notification', '{
    "type": "object",
    "properties": {
        "task_id": {"type": "string"},
        "snooze_duration": {"type": "string", "enum": ["15m", "1h", "today"]},
        "nudge_type": {"type": "string"}
    },
    "required": ["task_id", "snooze_duration"]
}'::jsonb),

('paywall_viewed', 'business_metric', 'User views the premium paywall', '{
    "type": "object",
    "properties": {
        "trigger": {"type": "string", "enum": ["onboarding", "task_limit", "feature_access"]},
        "current_task_count": {"type": "number"}
    },
    "required": ["trigger"]
}'::jsonb),

('trial_started', 'business_metric', 'User starts premium trial', '{
    "type": "object",
    "properties": {
        "trial_duration_days": {"type": "number"},
        "trigger_source": {"type": "string"}
    },
    "required": ["trial_duration_days"]
}'::jsonb),

('premium_converted', 'business_metric', 'User converts to premium subscription', '{
    "type": "object",
    "properties": {
        "subscription_type": {"type": "string"},
        "price": {"type": "number"},
        "currency": {"type": "string"},
        "trial_duration_days": {"type": "number"}
    },
    "required": ["subscription_type"]
}'::jsonb);

-- Insert default analytics configuration
INSERT INTO analytics_config (config_key, config_value, description) VALUES 
('event_retention_days', '90', 'Number of days to retain user events'),
('session_timeout_minutes', '30', 'Session timeout in minutes'),
('batch_size', '100', 'Batch size for event processing'),
('privacy_mode_enabled', 'true', 'Enable privacy-compliant analytics'),
('anonymization_enabled', 'true', 'Enable automatic data anonymization'),
('sampling_rate', '1.0', 'Event sampling rate (0.0 to 1.0)');

-- Functions for analytics
CREATE OR REPLACE FUNCTION update_user_analytics_properties()
RETURNS TRIGGER AS $
BEGIN
    -- Update user properties when events are inserted
    IF NEW.event_type = 'task_created' THEN
        INSERT INTO user_analytics_properties (user_id, total_tasks_created)
        VALUES (NEW.user_id, 1)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            total_tasks_created = user_analytics_properties.total_tasks_created + 1,
            updated_at = NOW();
    
    ELSIF NEW.event_type = 'place_added' THEN
        INSERT INTO user_analytics_properties (user_id, total_places_added)
        VALUES (NEW.user_id, 1)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            total_places_added = user_analytics_properties.total_places_added + 1,
            updated_at = NOW();
    
    ELSIF NEW.event_type = 'task_completed' THEN
        INSERT INTO user_analytics_properties (user_id, total_tasks_completed)
        VALUES (NEW.user_id, 1)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            total_tasks_completed = user_analytics_properties.total_tasks_completed + 1,
            updated_at = NOW();
    
    ELSIF NEW.event_type = 'nudge_shown' THEN
        INSERT INTO user_analytics_properties (user_id, total_notifications_received)
        VALUES (NEW.user_id, 1)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            total_notifications_received = user_analytics_properties.total_notifications_received + 1,
            updated_at = NOW();
    END IF;
    
    -- Update last active date
    INSERT INTO user_analytics_properties (user_id, last_active_date, days_active)
    VALUES (NEW.user_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        last_active_date = CURRENT_DATE,
        days_active = CASE 
            WHEN user_analytics_properties.last_active_date < CURRENT_DATE 
            THEN user_analytics_properties.days_active + 1
            ELSE user_analytics_properties.days_active
        END,
        updated_at = NOW();
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Trigger to update user properties
CREATE TRIGGER update_user_analytics_properties_trigger
    AFTER INSERT ON user_events
    FOR EACH ROW
    EXECUTE FUNCTION update_user_analytics_properties();

-- Function to update session analytics
CREATE OR REPLACE FUNCTION update_session_analytics()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = NOW();
    
    -- Calculate session duration if session is ending
    IF NEW.session_end IS NOT NULL AND OLD.session_end IS NULL THEN
        NEW.session_duration_ms = EXTRACT(EPOCH FROM (NEW.session_end - NEW.session_start)) * 1000;
    END IF;
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Trigger for session updates
CREATE TRIGGER update_session_analytics_trigger
    BEFORE UPDATE ON analytics_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_analytics();

-- Function to clean up old analytics data
CREATE OR REPLACE FUNCTION cleanup_old_analytics_data()
RETURNS void AS $
BEGIN
    -- Get retention period from config
    DECLARE
        retention_days INTEGER;
    BEGIN
        SELECT (config_value->>'event_retention_days')::INTEGER 
        INTO retention_days 
        FROM analytics_config 
        WHERE config_key = 'event_retention_days';
        
        IF retention_days IS NULL THEN
            retention_days := 90; -- Default fallback
        END IF;
        
        -- Delete old events
        DELETE FROM user_events 
        WHERE timestamp < NOW() - (retention_days || ' days')::INTERVAL;
        
        -- Delete old sessions
        DELETE FROM analytics_sessions 
        WHERE session_start < NOW() - (retention_days || ' days')::INTERVAL;
        
        -- Log cleanup
        RAISE NOTICE 'Cleaned up analytics data older than % days', retention_days;
    END;
END;
$ LANGUAGE plpgsql;

-- Views for analytics reporting
CREATE OR REPLACE VIEW daily_user_metrics AS
SELECT 
    DATE_TRUNC('day', timestamp) as date,
    platform,
    COUNT(DISTINCT user_id) as daily_active_users,
    COUNT(DISTINCT session_id) as daily_sessions,
    COUNT(*) as total_events,
    COUNT(CASE WHEN event_type = 'task_created' THEN 1 END) as tasks_created,
    COUNT(CASE WHEN event_type = 'task_completed' THEN 1 END) as tasks_completed,
    COUNT(CASE WHEN event_type = 'nudge_shown' THEN 1 END) as nudges_shown
FROM user_events
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', timestamp), platform
ORDER BY date DESC;

CREATE OR REPLACE VIEW user_retention_cohorts AS
SELECT 
    retention_cohort,
    COUNT(*) as cohort_size,
    COUNT(CASE WHEN last_active_date >= CURRENT_DATE - INTERVAL '1 day' THEN 1 END) as day_1_retained,
    COUNT(CASE WHEN last_active_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as day_7_retained,
    COUNT(CASE WHEN last_active_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as day_30_retained
FROM user_analytics_properties
WHERE retention_cohort IS NOT NULL
GROUP BY retention_cohort
ORDER BY retention_cohort DESC;

CREATE OR REPLACE VIEW conversion_funnel AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN onboarding_completed THEN 1 END) as onboarding_completed,
    COUNT(CASE WHEN trial_started THEN 1 END) as trial_started,
    COUNT(CASE WHEN premium_converted THEN 1 END) as premium_converted,
    ROUND(
        COUNT(CASE WHEN onboarding_completed THEN 1 END)::DECIMAL / COUNT(*) * 100, 2
    ) as onboarding_completion_rate,
    ROUND(
        COUNT(CASE WHEN trial_started THEN 1 END)::DECIMAL / 
        COUNT(CASE WHEN onboarding_completed THEN 1 END) * 100, 2
    ) as trial_conversion_rate,
    ROUND(
        COUNT(CASE WHEN premium_converted THEN 1 END)::DECIMAL / 
        COUNT(CASE WHEN trial_started THEN 1 END) * 100, 2
    ) as premium_conversion_rate
FROM user_analytics_properties;

-- Comments for documentation
COMMENT ON TABLE user_events IS 'Stores user behavior events for analytics';
COMMENT ON TABLE analytics_sessions IS 'Tracks user session data and engagement metrics';
COMMENT ON TABLE user_analytics_properties IS 'User-level analytics properties and metrics';
COMMENT ON TABLE analytics_config IS 'Configuration settings for analytics system';
COMMENT ON TABLE event_type_definitions IS 'Defines valid event types and their schemas';

COMMENT ON COLUMN user_events.analytics_consent IS 'Whether user has consented to analytics tracking';
COMMENT ON COLUMN user_events.anonymized IS 'Whether this event has been anonymized';
COMMENT ON COLUMN analytics_sessions.session_duration_ms IS 'Total session duration in milliseconds';
COMMENT ON COLUMN user_analytics_properties.retention_cohort IS 'Date when user first became active (for cohort analysis)';