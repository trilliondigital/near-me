-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id TEXT UNIQUE NOT NULL,
    email TEXT,
    preferences JSONB DEFAULT '{}',
    premium_status TEXT DEFAULT 'free' CHECK (premium_status IN ('free', 'trial', 'premium')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Places table
CREATE TABLE places (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT,
    place_type TEXT NOT NULL CHECK (place_type IN ('home', 'work', 'custom')),
    default_radii JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    location_type TEXT NOT NULL CHECK (location_type IN ('custom_place', 'poi_category')),
    place_id UUID REFERENCES places(id),
    poi_category TEXT CHECK (poi_category IN ('gas', 'pharmacy', 'grocery', 'bank', 'post_office')),
    custom_radii JSONB,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'muted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geofences table
CREATE TABLE geofences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    radius INTEGER NOT NULL, -- meters
    geofence_type TEXT NOT NULL CHECK (geofence_type IN ('approach_5mi', 'approach_3mi', 'approach_1mi', 'arrival', 'post_arrival')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- POIs table
CREATE TABLE pois (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id TEXT UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('gas', 'pharmacy', 'grocery', 'bank', 'post_office')),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    address TEXT,
    verified BOOLEAN DEFAULT false,
    source TEXT NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Events table for analytics
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    event_type TEXT NOT NULL,
    event_data JSONB,
    session_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Geofence Events table for event processing
CREATE TABLE geofence_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    geofence_id UUID REFERENCES geofences(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('enter', 'exit', 'dwell')),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    confidence DECIMAL(3, 2) DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'duplicate', 'cooldown')),
    processed_at TIMESTAMPTZ,
    notification_sent BOOLEAN DEFAULT false,
    bundled_with UUID REFERENCES geofence_events(id),
    cooldown_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_user_tasks ON tasks(user_id, status);
CREATE INDEX idx_active_tasks ON tasks(status) WHERE status = 'active';
CREATE INDEX idx_user_places ON places(user_id);
CREATE INDEX idx_location_places ON places(latitude, longitude);
CREATE INDEX idx_task_geofences ON geofences(task_id);
CREATE INDEX idx_active_geofences ON geofences(is_active) WHERE is_active = true;
CREATE INDEX idx_poi_location ON pois(latitude, longitude);
CREATE INDEX idx_poi_category ON pois(category);
CREATE INDEX idx_poi_verified ON pois(verified);
CREATE INDEX idx_events_user_time ON events(user_id, timestamp);
CREATE INDEX idx_events_type_time ON events(event_type, timestamp);
CREATE INDEX idx_geofence_events_user ON geofence_events(user_id, created_at);
CREATE INDEX idx_geofence_events_task ON geofence_events(task_id, created_at);
CREATE INDEX idx_geofence_events_status ON geofence_events(status) WHERE status = 'pending';
CREATE INDEX idx_geofence_events_cooldown ON geofence_events(cooldown_until) WHERE cooldown_until IS NOT NULL;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_places_updated_at BEFORE UPDATE ON places FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();