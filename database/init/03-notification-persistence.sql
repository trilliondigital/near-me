-- Notification persistence tables for Task 11

-- Notification history table
CREATE TABLE notification_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    notification_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('approach', 'arrival', 'post_arrival')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    scheduled_time TIMESTAMPTZ NOT NULL,
    delivered_time TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'cancelled', 'failed', 'snoozed')),
    attempts INTEGER DEFAULT 0,
    last_attempt TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Snooze records table
CREATE TABLE notification_snoozes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    notification_id TEXT NOT NULL,
    snooze_duration TEXT NOT NULL CHECK (snooze_duration IN ('15m', '1h', 'today')),
    snooze_until TIMESTAMPTZ NOT NULL,
    original_scheduled_time TIMESTAMPTZ NOT NULL,
    snooze_count INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task mute records table
CREATE TABLE task_mutes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    mute_duration TEXT CHECK (mute_duration IN ('1h', '4h', '8h', '24h', 'until_tomorrow', 'permanent')),
    mute_until TIMESTAMPTZ,
    reason TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification retry queue table
CREATE TABLE notification_retries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_history_id UUID REFERENCES notification_history(id) ON DELETE CASCADE,
    retry_count INTEGER DEFAULT 0,
    next_retry_time TIMESTAMPTZ NOT NULL,
    backoff_multiplier DECIMAL(3, 2) DEFAULT 1.0,
    max_retries INTEGER DEFAULT 3,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'failed', 'succeeded')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_notification_history_user ON notification_history(user_id, created_at);
CREATE INDEX idx_notification_history_task ON notification_history(task_id, created_at);
CREATE INDEX idx_notification_history_status ON notification_history(status) WHERE status IN ('pending', 'snoozed');
CREATE INDEX idx_notification_history_scheduled ON notification_history(scheduled_time) WHERE status = 'pending';

CREATE INDEX idx_notification_snoozes_user ON notification_snoozes(user_id, snooze_until);
CREATE INDEX idx_notification_snoozes_task ON notification_snoozes(task_id, status);
CREATE INDEX idx_notification_snoozes_active ON notification_snoozes(status, snooze_until) WHERE status = 'active';

CREATE INDEX idx_task_mutes_user ON task_mutes(user_id, mute_until);
CREATE INDEX idx_task_mutes_task ON task_mutes(task_id, status);
CREATE INDEX idx_task_mutes_active ON task_mutes(status, mute_until) WHERE status = 'active';

CREATE INDEX idx_notification_retries_pending ON notification_retries(status, next_retry_time) WHERE status = 'pending';

-- Create triggers for updated_at
CREATE TRIGGER update_notification_history_updated_at BEFORE UPDATE ON notification_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_snoozes_updated_at BEFORE UPDATE ON notification_snoozes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_task_mutes_updated_at BEFORE UPDATE ON task_mutes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_retries_updated_at BEFORE UPDATE ON notification_retries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
