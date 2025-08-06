-- Migration: 003_create_comments_table.sql
-- Description: Create comments table for blog post discussions
-- Created: 2025-08-05
-- Author: Database Administrator

-- Create comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- For threaded comments
    author_name VARCHAR(100), -- For guest comments
    author_email VARCHAR(255), -- For guest comments
    author_website VARCHAR(255), -- Optional website for guest comments
    content TEXT NOT NULL,
    content_html TEXT, -- Rendered HTML version
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'spam')),
    is_guest BOOLEAN DEFAULT false,
    ip_address INET,
    user_agent TEXT,
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    depth INTEGER DEFAULT 0, -- Comment nesting depth
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_comments_updated_at 
    BEFORE UPDATE ON comments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
CREATE INDEX idx_comments_status ON comments(status);
CREATE INDEX idx_comments_created_at ON comments(created_at);
CREATE INDEX idx_comments_post_status_created ON comments(post_id, status, created_at);
CREATE INDEX idx_comments_ip_address ON comments(ip_address);
CREATE INDEX idx_comments_content_gin ON comments USING gin(to_tsvector('english', content));

-- Create function to update comment counts
CREATE OR REPLACE FUNCTION update_comment_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update post comment count
    IF TG_OP = 'INSERT' THEN
        UPDATE blog_posts 
        SET comment_count = (
            SELECT COUNT(*) 
            FROM comments 
            WHERE post_id = NEW.post_id AND status = 'approved'
        )
        WHERE id = NEW.post_id;
        
        -- Update parent comment reply count
        IF NEW.parent_id IS NOT NULL THEN
            UPDATE comments 
            SET reply_count = (
                SELECT COUNT(*) 
                FROM comments 
                WHERE parent_id = NEW.parent_id AND status = 'approved'
            )
            WHERE id = NEW.parent_id;
        END IF;
        
        RETURN NEW;
    END IF;
    
    IF TG_OP = 'UPDATE' THEN
        -- If status changed, update counts
        IF OLD.status != NEW.status THEN
            UPDATE blog_posts 
            SET comment_count = (
                SELECT COUNT(*) 
                FROM comments 
                WHERE post_id = NEW.post_id AND status = 'approved'
            )
            WHERE id = NEW.post_id;
            
            -- Update parent comment reply count
            IF NEW.parent_id IS NOT NULL THEN
                UPDATE comments 
                SET reply_count = (
                    SELECT COUNT(*) 
                    FROM comments 
                    WHERE parent_id = NEW.parent_id AND status = 'approved'
                )
                WHERE id = NEW.parent_id;
            END IF;
        END IF;
        
        RETURN NEW;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        UPDATE blog_posts 
        SET comment_count = (
            SELECT COUNT(*) 
            FROM comments 
            WHERE post_id = OLD.post_id AND status = 'approved'
        )
        WHERE id = OLD.post_id;
        
        -- Update parent comment reply count
        IF OLD.parent_id IS NOT NULL THEN
            UPDATE comments 
            SET reply_count = (
                SELECT COUNT(*) 
                FROM comments 
                WHERE parent_id = OLD.parent_id AND status = 'approved'
            )
            WHERE id = OLD.parent_id;
        END IF;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create triggers for comment count updates
CREATE TRIGGER update_comment_counts_trigger
    AFTER INSERT OR UPDATE OR DELETE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_comment_counts();

-- Add comments
COMMENT ON TABLE comments IS 'Comments on blog posts, supports threaded discussions';
COMMENT ON COLUMN comments.parent_id IS 'Parent comment ID for threaded/nested comments';
COMMENT ON COLUMN comments.author_name IS 'Name for guest comments (when user_id is null)';
COMMENT ON COLUMN comments.author_email IS 'Email for guest comments';
COMMENT ON COLUMN comments.is_guest IS 'True if this is a guest comment (no user account)';
COMMENT ON COLUMN comments.depth IS 'Nesting depth for threaded comments (0 = top level)';
COMMENT ON COLUMN comments.status IS 'Moderation status: pending, approved, rejected, or spam';
COMMENT ON COLUMN comments.ip_address IS 'IP address of commenter (for spam prevention)';

-- Record migration
INSERT INTO schema_migrations (version, description) 
VALUES ('003', 'Create comments table with threading support');