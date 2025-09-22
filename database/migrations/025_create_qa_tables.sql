-- Migration: Create QA tables for request metrics and user feedback
-- Description: Adds api_request_metrics for SLA monitoring and user_feedback for beta/testing feedback

-- API Request Metrics table
CREATE TABLE IF NOT EXISTS api_request_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    method TEXT NOT NULL,
    route TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    error BOOL DEFAULT FALSE,
    error_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_req_metrics_time ON api_request_metrics (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_req_metrics_route_time ON api_request_metrics (route, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_req_metrics_status_time ON api_request_metrics (status_code, timestamp DESC);

-- View: api_sla_last_1h
CREATE OR REPLACE VIEW api_sla_last_1h AS
SELECT 
    DATE_TRUNC('minute', timestamp) AS minute,
    COUNT(*) AS total_requests,
    AVG(response_time_ms)::INT AS avg_latency_ms,
    SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END)::INT AS server_errors,
    SUM(CASE WHEN status_code >= 400 AND status_code < 500 THEN 1 ELSE 0 END)::INT AS client_errors,
    ROUND(SUM(CASE WHEN status_code < 400 THEN 1 ELSE 0 END)::DECIMAL / NULLIF(COUNT(*),0) * 100, 2) AS success_rate
FROM api_request_metrics
WHERE timestamp >= NOW() - INTERVAL '1 hour'
GROUP BY DATE_TRUNC('minute', timestamp)
ORDER BY minute DESC;

-- User Feedback table
CREATE TABLE IF NOT EXISTS user_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    platform TEXT CHECK (platform IN ('ios','android')),
    app_version TEXT,
    category TEXT CHECK (category IN ('bug','idea','ux','performance','other')) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_time ON user_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_category ON user_feedback (category);
