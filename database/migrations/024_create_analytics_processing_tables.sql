-- Migration: Create analytics processing and aggregation tables
-- Description: Add tables for processed analytics data and aggregations

-- Daily analytics summary table
CREATE TABLE IF NOT EXISTS daily_analytics_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    
    -- User metrics
    daily_active_users INTEGER DEFAULT 0,
    daily_sessions INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    
    -- Event metrics
    total_events INTEGER DEFAULT 0,
    tasks_created INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    nudges_shown INTEGER DEFAULT 0,
    places_added INTEGER DEFAULT 0,
    
    -- Calculated metrics
    completion_rate DECIMAL(5,2) DEFAULT 0,
    engagement_rate DECIMAL(5,2) DEFAULT 0,
    avg_session_duration_minutes DECIMAL(8,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(date, platform)
);

-- Cohort analysis table
CREATE TABLE IF NOT EXISTS cohort_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_week DATE NOT NULL,
    week_number INTEGER NOT NULL,
    cohort_size INTEGER NOT NULL,
    active_users INTEGER NOT NULL,
    retention_rate DECIMAL(5,2) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(cohort_week, week_number)
);

-- Funnel analysis table
CREATE TABLE IF NOT EXISTS funnel_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    
    -- Funnel stages
    app_opens INTEGER DEFAULT 0,
    onboarding_starts INTEGER DEFAULT 0,
    onboarding_completions INTEGER DEFAULT 0,
    first_task_created INTEGER DEFAULT 0,
    paywall_views INTEGER DEFAULT 0,
    trial_starts INTEGER DEFAULT 0,
    premium_conversions INTEGER DEFAULT 0,
    
    -- Conversion rates
    onboarding_conversion_rate DECIMAL(5,2) DEFAULT 0,
    task_creation_rate DECIMAL(5,2) DEFAULT 0,
    trial_conversion_rate DECIMAL(5,2) DEFAULT 0,
    premium_conversion_rate DECIMAL(5,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(date, platform)
);

-- Retention analysis table
CREATE TABLE IF NOT EXISTS retention_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_date DATE NOT NULL,
    cohort_size INTEGER NOT NULL,
    
    -- Retention counts
    day_1_retained INTEGER DEFAULT 0,
    day_7_retained INTEGER DEFAULT 0,
    day_30_retained INTEGER DEFAULT 0,
    
    -- Retention rates
    day_1_retention_rate DECIMAL(5,2) DEFAULT 0,
    day_7_retention_rate DECIMAL(5,2) DEFAULT 0,
    day_30_retention_rate DECIMAL(5,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(cohort_date)
);

-- A/B test experiments table
CREATE TABLE IF NOT EXISTS ab_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
    
    -- Experiment configuration
    traffic_allocation DECIMAL(3,2) DEFAULT 0.5, -- 0.0 to 1.0
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    
    -- Variants
    control_variant JSONB NOT NULL,
    test_variant JSONB NOT NULL,
    
    -- Success metrics
    primary_metric TEXT NOT NULL,
    secondary_metrics TEXT[],
    
    -- Results
    control_users INTEGER DEFAULT 0,
    test_users INTEGER DEFAULT 0,
    statistical_significance DECIMAL(5,4),
    confidence_interval JSONB,
    
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- A/B test assignments table
CREATE TABLE IF NOT EXISTS ab_test_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID REFERENCES ab_experiments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    variant TEXT NOT NULL CHECK (variant IN ('control', 'test')),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(experiment_id, user_id)
);

-- A/B test results table
CREATE TABLE IF NOT EXISTS ab_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID REFERENCES ab_experiments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    variant TEXT NOT NULL CHECK (variant IN ('control', 'test')),
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    
    INDEX idx_ab_results_experiment_metric (experiment_id, metric_name)
);

-- Real-time alerts table
CREATE TABLE IF NOT EXISTS analytics_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Alert conditions
    metric_name TEXT,
    threshold_value DECIMAL(10,4),
    current_value DECIMAL(10,4),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance monitoring table
CREATE TABLE IF NOT EXISTS analytics_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- System metrics
    event_ingestion_rate INTEGER DEFAULT 0, -- events per minute
    processing_latency_ms INTEGER DEFAULT 0,
    queue_size INTEGER DEFAULT 0,
    
    -- Database metrics
    db_connection_count INTEGER DEFAULT 0,
    avg_query_time_ms DECIMAL(8,2) DEFAULT 0,
    
    -- Application metrics
    memory_usage_mb DECIMAL(8,2) DEFAULT 0,
    cpu_usage_percent DECIMAL(5,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_analytics_summary_date_platform 
    ON daily_analytics_summary(date DESC, platform);

CREATE INDEX IF NOT EXISTS idx_cohort_analysis_cohort_week 
    ON cohort_analysis(cohort_week DESC);

CREATE INDEX IF NOT EXISTS idx_funnel_analysis_date_platform 
    ON funnel_analysis(date DESC, platform);

CREATE INDEX IF NOT EXISTS idx_retention_analysis_cohort_date 
    ON retention_analysis(cohort_date DESC);

CREATE INDEX IF NOT EXISTS idx_ab_experiments_status 
    ON ab_experiments(status) WHERE status IN ('running', 'paused');

CREATE INDEX IF NOT EXISTS idx_ab_test_assignments_experiment_user 
    ON ab_test_assignments(experiment_id, user_id);

CREATE INDEX IF NOT EXISTS idx_ab_test_results_experiment_metric 
    ON ab_test_results(experiment_id, metric_name, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_alerts_status_severity 
    ON analytics_alerts(status, severity) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_analytics_performance_timestamp 
    ON analytics_performance(timestamp DESC);

-- Views for reporting
CREATE OR REPLACE VIEW analytics_dashboard_summary AS
SELECT 
    das.date,
    das.platform,
    das.daily_active_users,
    das.daily_sessions,
    das.tasks_created,
    das.tasks_completed,
    das.completion_rate,
    das.engagement_rate,
    fa.trial_starts,
    fa.premium_conversions,
    fa.premium_conversion_rate,
    ra.day_1_retention_rate,
    ra.day_7_retention_rate,
    ra.day_30_retention_rate
FROM daily_analytics_summary das
LEFT JOIN funnel_analysis fa ON das.date = fa.date AND das.platform = fa.platform
LEFT JOIN retention_analysis ra ON das.date = ra.cohort_date
WHERE das.date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY das.date DESC, das.platform;

CREATE OR REPLACE VIEW active_experiments_summary AS
SELECT 
    ae.id,
    ae.name,
    ae.status,
    ae.start_date,
    ae.end_date,
    ae.traffic_allocation,
    ae.control_users,
    ae.test_users,
    ae.statistical_significance,
    COUNT(ata.user_id) as total_assignments,
    COUNT(CASE WHEN ata.variant = 'control' THEN 1 END) as control_assignments,
    COUNT(CASE WHEN ata.variant = 'test' THEN 1 END) as test_assignments
FROM ab_experiments ae
LEFT JOIN ab_test_assignments ata ON ae.id = ata.experiment_id
WHERE ae.status IN ('running', 'paused')
GROUP BY ae.id, ae.name, ae.status, ae.start_date, ae.end_date, 
         ae.traffic_allocation, ae.control_users, ae.test_users, ae.statistical_significance;

-- Functions for analytics processing
CREATE OR REPLACE FUNCTION update_daily_summary()
RETURNS TRIGGER AS $
BEGIN
    -- Update daily summary when events are inserted
    INSERT INTO daily_analytics_summary (
        date, 
        platform, 
        daily_active_users, 
        total_events
    )
    VALUES (
        DATE_TRUNC('day', NEW.timestamp)::DATE,
        NEW.platform,
        1,
        1
    )
    ON CONFLICT (date, platform) 
    DO UPDATE SET
        total_events = daily_analytics_summary.total_events + 1,
        updated_at = NOW();
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Trigger to update daily summary
CREATE TRIGGER update_daily_summary_trigger
    AFTER INSERT ON user_events
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_summary();

-- Function to calculate statistical significance for A/B tests
CREATE OR REPLACE FUNCTION calculate_ab_test_significance(
    control_conversions INTEGER,
    control_total INTEGER,
    test_conversions INTEGER,
    test_total INTEGER
)
RETURNS DECIMAL(5,4) AS $
BEGIN
    -- Simplified z-test calculation
    -- In production, you'd want a more robust statistical test
    DECLARE
        p1 DECIMAL := control_conversions::DECIMAL / control_total;
        p2 DECIMAL := test_conversions::DECIMAL / test_total;
        p_pooled DECIMAL := (control_conversions + test_conversions)::DECIMAL / (control_total + test_total);
        se DECIMAL := SQRT(p_pooled * (1 - p_pooled) * (1.0/control_total + 1.0/test_total));
        z_score DECIMAL;
    BEGIN
        IF se = 0 THEN
            RETURN 0;
        END IF;
        
        z_score := ABS(p2 - p1) / se;
        
        -- Convert z-score to p-value (simplified)
        -- This is a rough approximation - use proper statistical libraries in production
        RETURN CASE 
            WHEN z_score >= 2.58 THEN 0.01   -- 99% confidence
            WHEN z_score >= 1.96 THEN 0.05   -- 95% confidence
            WHEN z_score >= 1.65 THEN 0.10   -- 90% confidence
            ELSE 1.0
        END;
    END;
END;
$ LANGUAGE plpgsql;

-- Function to clean up old analytics data
CREATE OR REPLACE FUNCTION cleanup_analytics_data()
RETURNS void AS $
BEGIN
    -- Clean up old performance data (keep 30 days)
    DELETE FROM analytics_performance 
    WHERE timestamp < NOW() - INTERVAL '30 days';
    
    -- Clean up resolved alerts (keep 7 days)
    DELETE FROM analytics_alerts 
    WHERE status = 'resolved' 
    AND resolved_at < NOW() - INTERVAL '7 days';
    
    -- Clean up old A/B test results for completed experiments
    DELETE FROM ab_test_results atr
    USING ab_experiments ae
    WHERE atr.experiment_id = ae.id
    AND ae.status = 'completed'
    AND ae.end_date < NOW() - INTERVAL '90 days';
    
    RAISE NOTICE 'Analytics data cleanup completed';
END;
$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE daily_analytics_summary IS 'Daily aggregated analytics metrics by platform';
COMMENT ON TABLE cohort_analysis IS 'User cohort retention analysis by week';
COMMENT ON TABLE funnel_analysis IS 'Conversion funnel metrics by date and platform';
COMMENT ON TABLE retention_analysis IS 'User retention rates by cohort date';
COMMENT ON TABLE ab_experiments IS 'A/B test experiment definitions and results';
COMMENT ON TABLE ab_test_assignments IS 'User assignments to A/B test variants';
COMMENT ON TABLE ab_test_results IS 'Individual metric results for A/B tests';
COMMENT ON TABLE analytics_alerts IS 'Real-time alerts for analytics anomalies';
COMMENT ON TABLE analytics_performance IS 'System performance metrics for analytics pipeline';

COMMENT ON COLUMN ab_experiments.traffic_allocation IS 'Percentage of traffic allocated to test variant (0.0 to 1.0)';
COMMENT ON COLUMN ab_experiments.statistical_significance IS 'P-value indicating statistical significance of results';
COMMENT ON COLUMN analytics_alerts.threshold_value IS 'The threshold value that triggered the alert';
COMMENT ON COLUMN analytics_alerts.current_value IS 'The current value of the metric when alert was triggered';