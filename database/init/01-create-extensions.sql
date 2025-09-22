-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_spatial_geom ON spatial_ref_sys USING GIST (auth_name);