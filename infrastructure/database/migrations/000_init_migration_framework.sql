-- Migration: 000_init_migration_framework.sql
-- Description: Initialize the migration tracking system
-- Created: 2025-08-05
-- Author: Database Administrator

-- Enable extensions we'll need
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create schema_migrations table to track applied migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    description TEXT,
    checksum VARCHAR(64)
);

-- Add index for quick lookup
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at 
ON schema_migrations(applied_at);

-- Insert this migration as the first one
INSERT INTO schema_migrations (version, description, execution_time_ms, checksum) 
VALUES ('000', 'Initialize migration framework', 0, 'init')
ON CONFLICT (version) DO NOTHING;

-- Create a function to update timestamps automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a function to set created_at and updated_at for new records
CREATE OR REPLACE FUNCTION set_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.created_at = CURRENT_TIMESTAMP;
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

COMMENT ON TABLE schema_migrations IS 'Tracks database migrations and their execution status';
COMMENT ON FUNCTION update_updated_at_column() IS 'Trigger function to automatically update updated_at timestamp';
COMMENT ON FUNCTION set_timestamps() IS 'Trigger function to set both created_at and updated_at for new records';