-- Migration: 002_create_blog_posts_table.sql
-- Description: Create blog posts table for content management
-- Created: 2025-08-05
-- Author: Database Administrator

-- Create blog_posts table
CREATE TABLE blog_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    content_html TEXT, -- Rendered HTML version of content
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),
    featured BOOLEAN DEFAULT false,
    featured_image_url VARCHAR(500),
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords VARCHAR(500),
    reading_time_minutes INTEGER,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_blog_posts_updated_at 
    BEFORE UPDATE ON blog_posts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_blog_posts_author_id ON blog_posts(author_id);
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_visibility ON blog_posts(visibility);
CREATE INDEX idx_blog_posts_featured ON blog_posts(featured) WHERE featured = true;
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at);
CREATE INDEX idx_blog_posts_created_at ON blog_posts(created_at);
CREATE INDEX idx_blog_posts_status_published_at ON blog_posts(status, published_at) WHERE status = 'published';
CREATE INDEX idx_blog_posts_view_count ON blog_posts(view_count);
CREATE INDEX idx_blog_posts_title_gin ON blog_posts USING gin(to_tsvector('english', title));
CREATE INDEX idx_blog_posts_content_gin ON blog_posts USING gin(to_tsvector('english', content));

-- Create blog_post_tags table for many-to-many relationship
CREATE TABLE blog_post_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7), -- Hex color code
    post_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for blog_post_tags
CREATE TRIGGER update_blog_post_tags_updated_at 
    BEFORE UPDATE ON blog_post_tags 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create junction table for post-tag relationships
CREATE TABLE blog_post_tag_assignments (
    post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES blog_post_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, tag_id)
);

-- Create indexes for tag relationships
CREATE INDEX idx_blog_post_tags_name ON blog_post_tags(name);
CREATE INDEX idx_blog_post_tags_slug ON blog_post_tags(slug);
CREATE INDEX idx_blog_post_tag_assignments_post_id ON blog_post_tag_assignments(post_id);
CREATE INDEX idx_blog_post_tag_assignments_tag_id ON blog_post_tag_assignments(tag_id);

-- Add comments
COMMENT ON TABLE blog_posts IS 'Blog posts and articles for the website';
COMMENT ON COLUMN blog_posts.slug IS 'URL-friendly version of the title';
COMMENT ON COLUMN blog_posts.excerpt IS 'Short summary of the post';
COMMENT ON COLUMN blog_posts.content IS 'Full post content (markdown/text)';
COMMENT ON COLUMN blog_posts.content_html IS 'Rendered HTML version of content';
COMMENT ON COLUMN blog_posts.status IS 'Publication status: draft, published, or archived';
COMMENT ON COLUMN blog_posts.visibility IS 'Who can see this post: public, private, or unlisted';
COMMENT ON COLUMN blog_posts.reading_time_minutes IS 'Estimated reading time in minutes';
COMMENT ON COLUMN blog_posts.view_count IS 'Number of times this post has been viewed';

COMMENT ON TABLE blog_post_tags IS 'Tags that can be assigned to blog posts';
COMMENT ON TABLE blog_post_tag_assignments IS 'Many-to-many relationship between posts and tags';

-- Record migration
INSERT INTO schema_migrations (version, description) 
VALUES ('002', 'Create blog posts and tags tables');