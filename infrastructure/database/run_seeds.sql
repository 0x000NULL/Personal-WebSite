-- Seed Data Runner
-- Description: Run all seed scripts to populate the database with sample data
-- Created: 2025-08-05
-- Author: Ethan Aldrich

-- This script will populate the database with sample data for development and testing
-- WARNING: This should NOT be run on production databases

\echo 'Starting database seeding process...'

-- Check if we're connected to the right database
SELECT 
    current_database() as database_name,
    current_user as connected_user,
    NOW() as seed_start_time;

-- Verify that all required tables exist
DO $$
DECLARE
    missing_tables TEXT[];
    required_tables TEXT[] := ARRAY[
        'users', 'blog_posts', 'blog_post_tags', 'blog_post_tag_assignments',
        'comments', 'coding_challenges', 'challenge_test_cases', 'challenge_submissions',
        'visitor_sessions', 'page_views', 'analytics_events', 'contact_submissions'
    ];
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY required_tables
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = table_name
        ) THEN
            missing_tables := array_append(missing_tables, table_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Missing required tables: %. Please run migrations first.', array_to_string(missing_tables, ', ');
    END IF;
    
    RAISE NOTICE 'All required tables found. Proceeding with seeding...';
END $$;

\echo 'Seeding users...'
\i ./database/seed/001_seed_users.sql

\echo 'Seeding blog content (posts, tags, comments)...'
\i ./database/seed/002_seed_blog_content.sql

\echo 'Seeding coding challenges...'
\i ./database/seed/003_seed_coding_challenges.sql

\echo 'Seeding analytics and contact data...'
\i ./database/seed/004_seed_analytics_and_contact.sql

-- Final statistics
\echo 'Seed Data Summary:'
SELECT 
    'Users' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE is_active = true) as active_records,
    COUNT(*) FILTER (WHERE role = 'admin') as admin_users
FROM users
UNION ALL
SELECT 
    'Blog Posts' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE status = 'published') as active_records,
    COUNT(*) FILTER (WHERE featured = true) as admin_users
FROM blog_posts
UNION ALL
SELECT 
    'Comments' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE status = 'approved') as active_records,
    NULL as admin_users
FROM comments
UNION ALL
SELECT 
    'Coding Challenges' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE is_active = true) as active_records,
    COUNT(*) FILTER (WHERE is_featured = true) as admin_users
FROM coding_challenges
UNION ALL
SELECT 
    'Challenge Submissions' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE status = 'accepted') as active_records,
    NULL as admin_users
FROM challenge_submissions
UNION ALL
SELECT 
    'Visitor Sessions' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE user_id IS NOT NULL) as active_records,
    NULL as admin_users
FROM visitor_sessions
UNION ALL
SELECT 
    'Page Views' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE user_id IS NOT NULL) as active_records,
    NULL as admin_users
FROM page_views
UNION ALL
SELECT 
    'Contact Submissions' as table_name,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE status != 'spam') as active_records,
    COUNT(*) FILTER (WHERE status = 'replied') as admin_users
FROM contact_submissions;

-- Show sample login credentials
\echo 'Sample Login Credentials:'
\echo 'Admin User:'
\echo '  Username: ethan'
\echo '  Email: ethan@ethanaldrich.net'
\echo '  Password: password123'
\echo ''
\echo 'NOTE: Change default password before deploying to production!'

\echo 'Database seeding completed successfully!'

-- Display recent activity
\echo 'Recent Activity Summary:'
SELECT 
    'Recent Blog Posts' as activity_type,
    title as description,
    created_at as timestamp
FROM blog_posts 
WHERE status = 'published' 
ORDER BY created_at DESC 
LIMIT 3
UNION ALL
SELECT 
    'Recent Comments' as activity_type,
    SUBSTRING(content, 1, 50) || '...' as description,
    created_at as timestamp
FROM comments 
WHERE status = 'approved' 
ORDER BY created_at DESC 
LIMIT 3
UNION ALL
SELECT 
    'Recent Submissions' as activity_type,
    'Challenge: ' || (SELECT title FROM coding_challenges WHERE id = challenge_id) as description,
    submitted_at as timestamp
FROM challenge_submissions 
ORDER BY submitted_at DESC 
LIMIT 3
ORDER BY timestamp DESC;