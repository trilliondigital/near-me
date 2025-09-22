-- Migration: Create performance monitoring tables
-- Description: Add tables for tracking app performance metrics and alerts

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    app_version TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Battery metrics
    battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
    battery_drain_rate DECIMAL(5,2), -- Percentage per day
    is_charging BOOLEAN,
    is_low_power_mode BOOLEAN,
    
    -- Location metrics
    location_accuracy DECIMAL(10,2), -- meters
    location_updates_per_hour INTEGER,
    geofence_events_per_hour INTEGER,
    geofence_response_time_ms INTEGER,
    
    -- Performance metrics
    memory_usage_mb DECIMAL(10,2),
    cpu_usage_percentage DECIMAL(5,2),
    crash_free_percentage DECIMAL(5,2),
    false_positive_rate DECIMAL(5,2),
    
    -- Network metrics
    api_response_time_ms INTEGER,
    network_request_count INTEGER,
    cache_hit_rate DECIMAL(5,2),
    
    -- Background metrics
    background_execution_time_ms BIGINT,
    notification_delivery_time_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance alerts table
CREATE TABLE IF NOT EXISTS performance_alerts (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    message TEXT NOT NULL,
    metrics JSONB,
    timestamp TIMESTAMPTZ NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Battery optimization settings table
CREATE TABLE IF NOT EXISTS battery_optimization_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    optimization_level TEXT NOT NULL DEFAULT 'balanced' 
        CHECK (optimization_level IN ('high_accuracy', 'balanced', 'power_save', 'minimal')),
    adaptive_optimization_enabled BOOLEAN DEFAULT TRUE,
    custom_thresholds JSONB,
    last_optimization_change TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance thresholds configuration table
CREATE TABLE IF NOT EXISTS performance_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    thresholds JSONB NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_timestamp 
    ON performance_metrics(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_platform_timestamp 
    ON performance_metrics(platform, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_battery_drain 
    ON performance_metrics(battery_drain_rate) 
    WHERE battery_drain_rate IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_performance_alerts_user_timestamp 
    ON performance_alerts(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_performance_alerts_severity_resolved 
    ON performance_alerts(severity, resolved);

CREATE INDEX IF NOT EXISTS idx_performance_alerts_type_timestamp 
    ON performance_alerts(alert_type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_battery_optimization_user 
    ON battery_optimization_settings(user_id);

-- Insert default performance thresholds
INSERT INTO performance_thresholds (name, description, thresholds, is_default) VALUES 
(
    'default_thresholds',
    'Default performance monitoring thresholds',
    '{
        "maxBatteryDrainRate": 5.0,
        "maxMemoryUsageMB": 200,
        "maxCpuUsagePercentage": 20,
        "minCrashFreePercentage": 99.0,
        "maxFalsePositiveRate": 10.0,
        "maxGeofenceResponseTimeMs": 5000,
        "maxApiResponseTimeMs": 2000,
        "maxLocationAccuracyMeters": 100
    }'::jsonb,
    TRUE
),
(
    'strict_thresholds',
    'Strict performance monitoring thresholds for premium users',
    '{
        "maxBatteryDrainRate": 3.0,
        "maxMemoryUsageMB": 150,
        "maxCpuUsagePercentage": 15,
        "minCrashFreePercentage": 99.5,
        "maxFalsePositiveRate": 5.0,
        "maxGeofenceResponseTimeMs": 3000,
        "maxApiResponseTimeMs": 1500,
        "maxLocationAccuracyMeters": 50
    }'::jsonb,
    FALSE
);

-- Function to update battery optimization settings timestamp
CREATE OR REPLACE FUNCTION update_battery_optimization_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for battery optimization settings
CREATE TRIGGER battery_optimization_settings_updated_at
    BEFORE UPDATE ON battery_optimization_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_battery_optimization_timestamp();

-- Function to automatically resolve old alerts
CREATE OR REPLACE FUNCTION auto_resolve_old_alerts()
RETURNS void AS $$
BEGIN
    UPDATE performance_alerts 
    SET resolved = TRUE, resolved_at = NOW()
    WHERE resolved = FALSE 
    AND timestamp < NOW() - INTERVAL '24 hours'
    AND severity IN ('low', 'medium');
END;
$$ LANGUAGE plpgsql;

-- View for performance summary
CREATE OR REPLACE VIEW performance_summary AS
SELECT 
    user_id,
    platform,
    DATE_TRUNC('day', timestamp) as date,
    AVG(battery_drain_rate) as avg_battery_drain,
    AVG(memory_usage_mb) as avg_memory_usage,
    AVG(cpu_usage_percentage) as avg_cpu_usage,
    AVG(location_accuracy) as avg_location_accuracy,
    AVG(geofence_response_time_ms) as avg_geofence_response_time,
    AVG(api_response_time_ms) as avg_api_response_time,
    AVG(crash_free_percentage) as avg_crash_free_percentage,
    AVG(false_positive_rate) as avg_false_positive_rate,
    COUNT(*) as metric_count
FROM performance_metrics
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY user_id, platform, DATE_TRUNC('day', timestamp);

-- View for alert summary
CREATE OR REPLACE VIEW alert_summary AS
SELECT 
    user_id,
    alert_type,
    severity,
    COUNT(*) as alert_count,
    COUNT(CASE WHEN resolved THEN 1 END) as resolved_count,
    MAX(timestamp) as last_alert_time
FROM performance_alerts
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY user_id, alert_type, severity;

-- Comments for documentation
COMMENT ON TABLE performance_metrics IS 'Stores performance metrics from mobile clients';
COMMENT ON TABLE performance_alerts IS 'Stores performance alerts and issues';
COMMENT ON TABLE battery_optimization_settings IS 'User-specific battery optimization preferences';
COMMENT ON TABLE performance_thresholds IS 'Configurable performance monitoring thresholds';

COMMENT ON COLUMN performance_metrics.battery_drain_rate IS 'Battery drain rate as percentage per day';
COMMENT ON COLUMN performance_metrics.location_accuracy IS 'Location accuracy in meters';
COMMENT ON COLUMN performance_metrics.geofence_response_time_ms IS 'Time to process geofence events in milliseconds';
COMMENT ON COLUMN performance_alerts.metrics IS 'JSON snapshot of metrics when alert was triggered';
COMMENT ON COLUMN battery_optimization_settings.custom_thresholds IS 'User-specific performance thresholds override';