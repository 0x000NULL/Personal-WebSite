-- Performance Indexes
-- Description: Additional performance indexes for common query patterns
-- Created: 2025-08-05
-- Author: Database Administrator

-- Composite indexes for common query patterns

-- Users table composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active 
ON users(role, is_active) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_verified_active 
ON users(email_verified, is_active) WHERE is_active = true;

-- Blog posts composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blog_posts_status_published_featured 
ON blog_posts(status, published_at DESC, featured DESC) 
WHERE status = 'published' AND visibility = 'public';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blog_posts_author_status_published 
ON blog_posts(author_id, status, published_at DESC) 
WHERE status = 'published';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blog_posts_featured_published 
ON blog_posts(featured, published_at DESC) 
WHERE status = 'published' AND visibility = 'public' AND featured = true;

-- Comments composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_post_status_created 
ON comments(post_id, status, created_at DESC) 
WHERE status = 'approved';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_parent_status_created 
ON comments(parent_id, status, created_at) 
WHERE parent_id IS NOT NULL AND status = 'approved';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_user_status_created 
ON comments(user_id, status, created_at DESC) 
WHERE user_id IS NOT NULL AND status = 'approved';

-- Coding challenges composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coding_challenges_difficulty_active 
ON coding_challenges(difficulty, is_active, created_at DESC) 
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coding_challenges_category_difficulty 
ON coding_challenges(category, difficulty, success_rate DESC) 
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coding_challenges_featured_active 
ON coding_challenges(is_featured, difficulty, created_at DESC) 
WHERE is_active = true AND is_featured = true;

-- Challenge submissions composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_challenge_submissions_user_status_submitted 
ON challenge_submissions(user_id, status, submitted_at DESC) 
WHERE user_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_challenge_submissions_challenge_status_score 
ON challenge_submissions(challenge_id, status, score DESC, submitted_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_challenge_submissions_language_status 
ON challenge_submissions(language, status, submitted_at DESC);

-- Analytics composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_page_views_date_resource 
ON page_views(DATE(viewed_at), resource_type, resource_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_page_views_session_viewed 
ON page_views(session_id, viewed_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visitor_sessions_date_country 
ON visitor_sessions(DATE(started_at), country_code, device_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visitor_sessions_user_started 
ON visitor_sessions(user_id, started_at DESC) 
WHERE user_id IS NOT NULL;

-- Contact submissions composite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_submissions_status_priority_submitted 
ON contact_submissions(status, priority, submitted_at DESC) 
WHERE status != 'spam';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_submissions_assigned_status 
ON contact_submissions(assigned_to, status, submitted_at DESC) 
WHERE assigned_to IS NOT NULL AND status != 'spam';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_submissions_form_type_status 
ON contact_submissions(form_type, status, submitted_at DESC);

-- Partial indexes for common filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blog_posts_published_only 
ON blog_posts(published_at DESC, view_count DESC) 
WHERE status = 'published' AND visibility = 'public';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_approved_only 
ON comments(post_id, created_at) 
WHERE status = 'approved';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_challenge_submissions_accepted_only 
ON challenge_submissions(challenge_id, user_id, submitted_at DESC) 
WHERE status = 'accepted';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_submissions_pending_only 
ON contact_submissions(priority, submitted_at DESC) 
WHERE status IN ('new', 'read') AND is_spam = false;

-- Covering indexes (include additional columns)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blog_posts_list_cover 
ON blog_posts(status, published_at DESC) 
INCLUDE (title, slug, excerpt, featured_image_url, view_count, like_count, comment_count)
WHERE status = 'published' AND visibility = 'public';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coding_challenges_list_cover 
ON coding_challenges(is_active, difficulty, created_at DESC) 
INCLUDE (title, slug, category, submission_count, solved_count, success_rate)
WHERE is_active = true;

-- Hash indexes for equality lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username_hash 
ON users USING hash(username);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blog_posts_slug_hash 
ON blog_posts USING hash(slug);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coding_challenges_slug_hash 
ON coding_challenges USING hash(slug);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visitor_sessions_session_id_hash 
ON visitor_sessions USING hash(session_id);

-- Expression indexes for computed values
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blog_posts_title_length 
ON blog_posts(length(title)) 
WHERE status = 'published';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_challenge_submissions_success_rate 
ON challenge_submissions((test_cases_passed::float / NULLIF(test_cases_total, 0))) 
WHERE test_cases_total > 0;

-- Indexes for JSON/JSONB columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_analytics_top_pages_path 
ON daily_analytics USING gin((top_pages->'page_path'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_custom_data_keys 
ON analytics_events USING gin((custom_data ? 'event_value'));

-- Time-based partitioning preparation indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_page_views_monthly 
ON page_views(DATE_TRUNC('month', viewed_at), resource_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_monthly 
ON analytics_events(DATE_TRUNC('month', occurred_at), event_name);

-- Full-text search performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blog_posts_search_combined 
ON blog_posts USING gin(
    to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content, '') || ' ' || COALESCE(excerpt, ''))
) WHERE status = 'published' AND visibility = 'public';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coding_challenges_search_combined 
ON coding_challenges USING gin(
    to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(category, ''))
) WHERE is_active = true;

-- Comments for performance indexes
COMMENT ON INDEX idx_users_role_active IS 'Fast lookup for active users by role';
COMMENT ON INDEX idx_blog_posts_status_published_featured IS 'Optimized for blog post listing pages';
COMMENT ON INDEX idx_comments_post_status_created IS 'Fast comment retrieval for blog posts';
COMMENT ON INDEX idx_coding_challenges_difficulty_active IS 'Challenge filtering by difficulty';
COMMENT ON INDEX idx_page_views_date_resource IS 'Analytics queries by date and resource type';
COMMENT ON INDEX idx_contact_submissions_status_priority_submitted IS 'Contact form management dashboard';
COMMENT ON INDEX idx_blog_posts_search_combined IS 'Full-text search across all blog content';

-- Index usage monitoring query (for DBA reference)
/*
-- Query to monitor index usage:
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;

-- Query to find unused indexes:
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes 
WHERE idx_scan = 0
AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
*/