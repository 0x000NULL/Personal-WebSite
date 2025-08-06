-- Additional Triggers
-- Description: Additional trigger functions for business logic and data integrity
-- Created: 2025-08-05
-- Author: Database Administrator

-- Function to automatically generate slugs from titles
CREATE OR REPLACE FUNCTION generate_slug_from_title()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := lower(
            regexp_replace(
                regexp_replace(
                    regexp_replace(NEW.title, '[^a-zA-Z0-9\s-]', '', 'g'),
                    '\s+', '-', 'g'
                ),
                '-+', '-', 'g'
            )
        );
        
        -- Ensure slug is unique by appending a number if necessary
        DECLARE
            base_slug TEXT := NEW.slug;
            counter INTEGER := 1;
            table_name TEXT := TG_TABLE_NAME;
        BEGIN
            WHILE EXISTS (
                SELECT 1 FROM blog_posts WHERE slug = NEW.slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
                UNION ALL
                SELECT 1 FROM coding_challenges WHERE slug = NEW.slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
            ) LOOP
                NEW.slug := base_slug || '-' || counter;
                counter := counter + 1;
            END LOOP;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply slug generation to blog posts
CREATE TRIGGER generate_blog_post_slug
    BEFORE INSERT OR UPDATE ON blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION generate_slug_from_title();

-- Apply slug generation to coding challenges
CREATE TRIGGER generate_coding_challenge_slug
    BEFORE INSERT OR UPDATE ON coding_challenges
    FOR EACH ROW
    EXECUTE FUNCTION generate_slug_from_title();

-- Function to update blog post view count
CREATE OR REPLACE FUNCTION increment_blog_post_views()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.resource_type = 'post' AND NEW.resource_id IS NOT NULL THEN
        UPDATE blog_posts 
        SET view_count = view_count + 1 
        WHERE id = NEW.resource_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update blog post views from page_views
CREATE TRIGGER increment_blog_post_views_trigger
    AFTER INSERT ON page_views
    FOR EACH ROW
    EXECUTE FUNCTION increment_blog_post_views();

-- Function to calculate reading time for blog posts
CREATE OR REPLACE FUNCTION calculate_reading_time()
RETURNS TRIGGER AS $$
DECLARE
    word_count INTEGER;
    words_per_minute INTEGER := 200; -- Average reading speed
BEGIN
    IF NEW.content IS NOT NULL THEN
        -- Count words (split by whitespace)
        word_count := array_length(string_to_array(trim(NEW.content), ' '), 1);
        
        -- Calculate reading time in minutes (minimum 1 minute)
        NEW.reading_time_minutes := GREATEST(1, ROUND(word_count::decimal / words_per_minute));
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to calculate reading time for blog posts
CREATE TRIGGER calculate_blog_post_reading_time
    BEFORE INSERT OR UPDATE ON blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION calculate_reading_time();

-- Function to update tag post counts
CREATE OR REPLACE FUNCTION update_tag_post_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE blog_post_tags 
        SET post_count = (
            SELECT COUNT(*) 
            FROM blog_post_tag_assignments bpta
            JOIN blog_posts bp ON bpta.post_id = bp.id
            WHERE bpta.tag_id = NEW.tag_id 
            AND bp.status = 'published'
        )
        WHERE id = NEW.tag_id;
        
        RETURN NEW;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        UPDATE blog_post_tags 
        SET post_count = (
            SELECT COUNT(*) 
            FROM blog_post_tag_assignments bpta
            JOIN blog_posts bp ON bpta.post_id = bp.id
            WHERE bpta.tag_id = OLD.tag_id 
            AND bp.status = 'published'
        )
        WHERE id = OLD.tag_id;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Trigger to update tag counts
CREATE TRIGGER update_tag_post_counts_trigger
    AFTER INSERT OR DELETE ON blog_post_tag_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_tag_post_counts();

-- Function to set published_at timestamp
CREATE OR REPLACE FUNCTION set_published_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Set published_at when status changes to published
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
        NEW.published_at := CURRENT_TIMESTAMP;
    END IF;
    
    -- Clear published_at when status changes from published
    IF NEW.status != 'published' AND OLD.status = 'published' THEN
        NEW.published_at := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to set published_at for blog posts
CREATE TRIGGER set_blog_post_published_at
    BEFORE UPDATE ON blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION set_published_at();

-- Function to validate comment depth
CREATE OR REPLACE FUNCTION validate_comment_depth()
RETURNS TRIGGER AS $$
DECLARE
    parent_depth INTEGER := 0;
    max_depth INTEGER := 5; -- Maximum nesting level
BEGIN
    IF NEW.parent_id IS NOT NULL THEN
        -- Get parent comment depth
        SELECT depth INTO parent_depth 
        FROM comments 
        WHERE id = NEW.parent_id;
        
        IF parent_depth IS NULL THEN
            RAISE EXCEPTION 'Parent comment not found';
        END IF;
        
        NEW.depth := parent_depth + 1;
        
        -- Enforce maximum depth
        IF NEW.depth > max_depth THEN
            RAISE EXCEPTION 'Comment nesting too deep (max % levels)', max_depth;
        END IF;
    ELSE
        NEW.depth := 0;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to validate comment depth
CREATE TRIGGER validate_comment_depth_trigger
    BEFORE INSERT OR UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION validate_comment_depth();

-- Function to set approved_at timestamp
CREATE OR REPLACE FUNCTION set_approved_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Set approved_at when status changes to approved
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        NEW.approved_at := CURRENT_TIMESTAMP;
    END IF;
    
    -- Clear approved_at when status changes from approved
    IF NEW.status != 'approved' AND OLD.status = 'approved' THEN
        NEW.approved_at := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to set approved_at for comments
CREATE TRIGGER set_comment_approved_at
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION set_approved_at();

-- Function to prevent deletion of users with content
CREATE OR REPLACE FUNCTION prevent_user_deletion_with_content()
RETURNS TRIGGER AS $$
DECLARE
    post_count INTEGER;
    submission_count INTEGER;
BEGIN
    -- Check for blog posts
    SELECT COUNT(*) INTO post_count FROM blog_posts WHERE author_id = OLD.id;
    
    -- Check for challenge submissions
    SELECT COUNT(*) INTO submission_count FROM challenge_submissions WHERE user_id = OLD.id;
    
    IF post_count > 0 OR submission_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete user with existing content (% posts, % submissions)', post_count, submission_count;
    END IF;
    
    RETURN OLD;
END;
$$ language 'plpgsql';

-- Trigger to prevent user deletion with content
CREATE TRIGGER prevent_user_deletion_with_content_trigger
    BEFORE DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION prevent_user_deletion_with_content();

-- Function to log important changes
CREATE OR REPLACE FUNCTION log_important_changes()
RETURNS TRIGGER AS $$
DECLARE
    change_log TEXT;
BEGIN
    -- Log user role changes
    IF TG_TABLE_NAME = 'users' AND OLD.role != NEW.role THEN
        INSERT INTO analytics_events (
            user_id,
            event_name,
            event_category,
            event_action,
            event_label,
            custom_data
        ) VALUES (
            NEW.id,
            'user_role_changed',
            'security',
            'role_update',
            OLD.role || ' -> ' || NEW.role,
            jsonb_build_object(
                'old_role', OLD.role,
                'new_role', NEW.role,
                'changed_by', current_setting('app.current_user_id', true)
            )
        );
    END IF;
    
    -- Log blog post status changes
    IF TG_TABLE_NAME = 'blog_posts' AND OLD.status != NEW.status THEN
        INSERT INTO analytics_events (
            user_id,
            event_name,
            event_category,
            event_action,
            event_label,
            custom_data
        ) VALUES (
            NEW.author_id,
            'post_status_changed',
            'content',
            'status_update',
            OLD.status || ' -> ' || NEW.status,
            jsonb_build_object(
                'post_id', NEW.id,
                'post_title', NEW.title,
                'old_status', OLD.status,
                'new_status', NEW.status
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to log important changes
CREATE TRIGGER log_user_changes
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_important_changes();

CREATE TRIGGER log_blog_post_changes
    AFTER UPDATE ON blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION log_important_changes();

-- Function to cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS VOID AS $$
BEGIN
    -- Delete old page views (keep 1 year)
    DELETE FROM page_views 
    WHERE viewed_at < NOW() - INTERVAL '1 year';
    
    -- Delete old visitor sessions (keep 1 year)
    DELETE FROM visitor_sessions 
    WHERE started_at < NOW() - INTERVAL '1 year';
    
    -- Delete old analytics events (keep 1 year)
    DELETE FROM analytics_events 
    WHERE occurred_at < NOW() - INTERVAL '1 year';
    
    -- Delete spam contact submissions (keep 90 days)
    DELETE FROM contact_submissions 
    WHERE is_spam = true 
    AND created_at < NOW() - INTERVAL '90 days';
    
    -- Archive old resolved contact submissions (keep 2 years)
    UPDATE contact_submissions 
    SET status = 'archived'
    WHERE status = 'resolved' 
    AND replied_at < NOW() - INTERVAL '2 years';
    
    -- Delete old password reset tokens
    UPDATE users 
    SET password_reset_token = NULL, 
        password_reset_expires = NULL
    WHERE password_reset_expires < NOW();
    
    -- Delete old email verification tokens (24 hours)
    UPDATE users 
    SET email_verification_token = NULL
    WHERE created_at < NOW() - INTERVAL '24 hours'
    AND email_verified = false
    AND email_verification_token IS NOT NULL;
    
    RAISE NOTICE 'Cleanup completed for old data';
END;
$$ language 'plpgsql';

-- Comments
COMMENT ON FUNCTION generate_slug_from_title() IS 'Automatically generates URL-friendly slugs from titles';
COMMENT ON FUNCTION calculate_reading_time() IS 'Calculates estimated reading time based on word count';
COMMENT ON FUNCTION validate_comment_depth() IS 'Prevents comment nesting beyond maximum depth';
COMMENT ON FUNCTION prevent_user_deletion_with_content() IS 'Prevents deletion of users who have created content';
COMMENT ON FUNCTION log_important_changes() IS 'Logs significant changes for audit trail';
COMMENT ON FUNCTION cleanup_old_data() IS 'Removes or archives old data according to retention policies';

-- Schedule the cleanup function to run daily (add to cron or scheduler)
-- Example cron job: 0 2 * * * psql -d your_database -c "SELECT cleanup_old_data();"