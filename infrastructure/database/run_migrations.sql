-- Master Migration Runner
-- Description: Run all migrations in the correct order
-- Created: 2025-08-05
-- Author: Database Administrator

-- This script will run all migrations in order and can be used to set up a fresh database
-- or update an existing database to the latest schema version.

\echo 'Starting database migration process...'

-- Check if we're connected to the right database
SELECT 
    current_database() as database_name,
    current_user as connected_user,
    NOW() as migration_start_time;

-- Function to check if a migration has already been applied
CREATE OR REPLACE FUNCTION migration_applied(version_num VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM schema_migrations WHERE version = version_num);
EXCEPTION
    WHEN undefined_table THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

\echo 'Running migration 000: Initialize migration framework...'
DO $$
BEGIN
    IF NOT migration_applied('000') THEN
        \i ./database/migrations/000_init_migration_framework.sql
        RAISE NOTICE 'Migration 000 completed successfully';
    ELSE
        RAISE NOTICE 'Migration 000 already applied, skipping...';
    END IF;
END $$;

\echo 'Running migration 001: Create users table...'
DO $$
BEGIN
    IF NOT migration_applied('001') THEN
        \i ./database/migrations/001_create_users_table.sql
        RAISE NOTICE 'Migration 001 completed successfully';
    ELSE
        RAISE NOTICE 'Migration 001 already applied, skipping...';
    END IF;
END $$;

\echo 'Running migration 002: Create blog posts table...'
DO $$
BEGIN
    IF NOT migration_applied('002') THEN
        \i ./database/migrations/002_create_blog_posts_table.sql
        RAISE NOTICE 'Migration 002 completed successfully';
    ELSE
        RAISE NOTICE 'Migration 002 already applied, skipping...';
    END IF;
END $$;

\echo 'Running migration 003: Create comments table...'
DO $$
BEGIN
    IF NOT migration_applied('003') THEN
        \i ./database/migrations/003_create_comments_table.sql
        RAISE NOTICE 'Migration 003 completed successfully';
    ELSE
        RAISE NOTICE 'Migration 003 already applied, skipping...';
    END IF;
END $$;

\echo 'Running migration 004: Create coding challenges table...'
DO $$
BEGIN
    IF NOT migration_applied('004') THEN
        \i ./database/migrations/004_create_coding_challenges_table.sql
        RAISE NOTICE 'Migration 004 completed successfully';
    ELSE
        RAISE NOTICE 'Migration 004 already applied, skipping...';
    END IF;
END $$;

\echo 'Running migration 005: Create analytics tables...'
DO $$
BEGIN
    IF NOT migration_applied('005') THEN
        \i ./database/migrations/005_create_analytics_tables.sql
        RAISE NOTICE 'Migration 005 completed successfully';
    ELSE
        RAISE NOTICE 'Migration 005 already applied, skipping...';
    END IF;
END $$;

\echo 'Running migration 006: Create contact form table...'
DO $$
BEGIN
    IF NOT migration_applied('006') THEN
        \i ./database/migrations/006_create_contact_form_table.sql
        RAISE NOTICE 'Migration 006 completed successfully';
    ELSE
        RAISE NOTICE 'Migration 006 already applied, skipping...';
    END IF;
END $$;

\echo 'Installing performance indexes...'
\i ./database/indexes/performance_indexes.sql

\echo 'Installing additional triggers...'
\i ./database/triggers/additional_triggers.sql

-- Display migration status
\echo 'Migration Summary:'
SELECT 
    version,
    description,
    applied_at,
    execution_time_ms
FROM schema_migrations 
ORDER BY version;

-- Display database statistics
\echo 'Database Statistics:'
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- Clean up helper function
DROP FUNCTION IF EXISTS migration_applied(VARCHAR);

\echo 'All migrations completed successfully!'

-- Display important connection information
\echo 'Database Setup Complete!'
\echo 'Next Steps:'
\echo '1. Run seed data scripts if needed:'
\echo '   \\i ./database/seed/001_seed_users.sql'
\echo '   \\i ./database/seed/002_seed_blog_content.sql'
\echo '   \\i ./database/seed/003_seed_coding_challenges.sql'
\echo '   \\i ./database/seed/004_seed_analytics_and_contact.sql'
\echo ''
\echo '2. Create database users for your application:'
\echo '   -- Example: CREATE USER app_user WITH PASSWORD ''secure_password'';'
\echo '   -- Example: GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;'
\echo ''
\echo '3. Set up regular maintenance tasks:'
\echo '   -- Schedule daily cleanup: SELECT cleanup_old_data();'
\echo '   -- Schedule daily analytics: SELECT update_daily_analytics();'