-- Migration: 005_create_analytics_tables.sql
-- Description: Create analytics tables for tracking page views and visitor sessions
-- Created: 2025-08-05
-- Author: Database Administrator

-- Create visitor_sessions table
CREATE TABLE visitor_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    device_type VARCHAR(20) CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'bot')),
    browser VARCHAR(50),
    browser_version VARCHAR(20),
    os VARCHAR(50),
    os_version VARCHAR(20),
    country_code VARCHAR(2),
    region VARCHAR(100),
    city VARCHAR(100),
    timezone VARCHAR(50),
    referrer_url TEXT,
    referrer_domain VARCHAR(255),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_term VARCHAR(100),
    utm_content VARCHAR(100),
    entry_page VARCHAR(500),
    exit_page VARCHAR(500),
    page_views INTEGER DEFAULT 0,
    session_duration_seconds INTEGER DEFAULT 0,
    is_bounce BOOLEAN DEFAULT true,
    is_new_visitor BOOLEAN DEFAULT true,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for visitor_sessions
CREATE TRIGGER update_visitor_sessions_updated_at 
    BEFORE UPDATE ON visitor_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create page_views table
CREATE TABLE page_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES visitor_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    page_url VARCHAR(500) NOT NULL,
    page_path VARCHAR(500) NOT NULL,
    page_title VARCHAR(255),
    resource_type VARCHAR(50) DEFAULT 'page' CHECK (resource_type IN ('page', 'post', 'challenge', 'contact', 'api')),
    resource_id UUID, -- References the specific resource (blog post, challenge, etc.)
    method VARCHAR(10) DEFAULT 'GET',
    status_code INTEGER DEFAULT 200,
    response_time_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    referrer_url TEXT,
    time_on_page_seconds INTEGER,
    scroll_depth_percent INTEGER DEFAULT 0,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create daily analytics summary table for faster reporting
CREATE TABLE daily_analytics (
    date DATE PRIMARY KEY,
    total_page_views INTEGER DEFAULT 0,
    unique_page_views INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    new_visitors INTEGER DEFAULT 0,
    returning_visitors INTEGER DEFAULT 0,
    bounce_rate DECIMAL(5,2) DEFAULT 0.00,
    avg_session_duration_seconds INTEGER DEFAULT 0,
    avg_pages_per_session DECIMAL(4,2) DEFAULT 0.00,
    top_pages JSONB DEFAULT '[]'::jsonb,
    top_referrers JSONB DEFAULT '[]'::jsonb,
    device_breakdown JSONB DEFAULT '{}'::jsonb,
    browser_breakdown JSONB DEFAULT '{}'::jsonb,
    country_breakdown JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for daily_analytics
CREATE TRIGGER update_daily_analytics_updated_at 
    BEFORE UPDATE ON daily_analytics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create event tracking table for custom events
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES visitor_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_name VARCHAR(100) NOT NULL,
    event_category VARCHAR(50),
    event_action VARCHAR(100),
    event_label VARCHAR(255),
    event_value DECIMAL(10,2),
    page_url VARCHAR(500),
    custom_data JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_visitor_sessions_session_id ON visitor_sessions(session_id);
CREATE INDEX idx_visitor_sessions_user_id ON visitor_sessions(user_id);
CREATE INDEX idx_visitor_sessions_ip_address ON visitor_sessions(ip_address);
CREATE INDEX idx_visitor_sessions_started_at ON visitor_sessions(started_at);
CREATE INDEX idx_visitor_sessions_device_type ON visitor_sessions(device_type);
CREATE INDEX idx_visitor_sessions_country_code ON visitor_sessions(country_code);
CREATE INDEX idx_visitor_sessions_referrer_domain ON visitor_sessions(referrer_domain);
CREATE INDEX idx_visitor_sessions_utm_source ON visitor_sessions(utm_source);
CREATE INDEX idx_visitor_sessions_is_new_visitor ON visitor_sessions(is_new_visitor);

CREATE INDEX idx_page_views_session_id ON page_views(session_id);
CREATE INDEX idx_page_views_user_id ON page_views(user_id);
CREATE INDEX idx_page_views_page_path ON page_views(page_path);
CREATE INDEX idx_page_views_resource_type ON page_views(resource_type);
CREATE INDEX idx_page_views_resource_id ON page_views(resource_id);
CREATE INDEX idx_page_views_viewed_at ON page_views(viewed_at);
CREATE INDEX idx_page_views_viewed_at_date ON page_views(DATE(viewed_at));
CREATE INDEX idx_page_views_status_code ON page_views(status_code);

CREATE INDEX idx_daily_analytics_date ON daily_analytics(date);

CREATE INDEX idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_events_event_category ON analytics_events(event_category);
CREATE INDEX idx_analytics_events_occurred_at ON analytics_events(occurred_at);
CREATE INDEX idx_analytics_events_occurred_at_date ON analytics_events(DATE(occurred_at));

-- GIN indexes for JSONB fields
CREATE INDEX idx_daily_analytics_top_pages ON daily_analytics USING gin(top_pages);
CREATE INDEX idx_daily_analytics_device_breakdown ON daily_analytics USING gin(device_breakdown);
CREATE INDEX idx_analytics_events_custom_data ON analytics_events USING gin(custom_data);

-- Function to update session statistics when page views are added
CREATE OR REPLACE FUNCTION update_session_statistics()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE visitor_sessions SET
            page_views = (
                SELECT COUNT(*) 
                FROM page_views 
                WHERE session_id = NEW.session_id
            ),
            ended_at = NEW.viewed_at,
            session_duration_seconds = EXTRACT(EPOCH FROM (NEW.viewed_at - started_at))::INTEGER,
            is_bounce = (
                SELECT COUNT(*) FROM page_views WHERE session_id = NEW.session_id
            ) <= 1,
            exit_page = NEW.page_path
        WHERE id = NEW.session_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for session statistics
CREATE TRIGGER update_session_statistics_trigger
    AFTER INSERT ON page_views
    FOR EACH ROW
    EXECUTE FUNCTION update_session_statistics();

-- Function to generate or update daily analytics
CREATE OR REPLACE FUNCTION update_daily_analytics(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
    analytics_record RECORD;
BEGIN
    -- Calculate daily analytics
    SELECT 
        COUNT(*) as total_page_views,
        COUNT(DISTINCT CONCAT(vs.ip_address, vs.user_agent)) as unique_page_views,
        COUNT(DISTINCT vs.id) as total_sessions,
        COUNT(DISTINCT COALESCE(vs.user_id::text, CONCAT(vs.ip_address, vs.user_agent))) as unique_visitors,
        COUNT(DISTINCT vs.id) FILTER (WHERE vs.is_new_visitor = true) as new_visitors,
        COUNT(DISTINCT vs.id) FILTER (WHERE vs.is_new_visitor = false) as returning_visitors,
        ROUND(AVG(CASE WHEN vs.is_bounce THEN 100.0 ELSE 0.0 END), 2) as bounce_rate,
        ROUND(AVG(vs.session_duration_seconds))::INTEGER as avg_session_duration_seconds,
        ROUND(AVG(vs.page_views), 2) as avg_pages_per_session
    INTO analytics_record
    FROM visitor_sessions vs
    JOIN page_views pv ON vs.id = pv.session_id
    WHERE DATE(pv.viewed_at) = target_date;
    
    -- Insert or update daily analytics
    INSERT INTO daily_analytics (
        date, 
        total_page_views, 
        unique_page_views, 
        total_sessions,
        unique_visitors,
        new_visitors,
        returning_visitors,
        bounce_rate,
        avg_session_duration_seconds,
        avg_pages_per_session
    ) 
    VALUES (
        target_date,
        COALESCE(analytics_record.total_page_views, 0),
        COALESCE(analytics_record.unique_page_views, 0),
        COALESCE(analytics_record.total_sessions, 0),
        COALESCE(analytics_record.unique_visitors, 0),
        COALESCE(analytics_record.new_visitors, 0),
        COALESCE(analytics_record.returning_visitors, 0),
        COALESCE(analytics_record.bounce_rate, 0.00),
        COALESCE(analytics_record.avg_session_duration_seconds, 0),
        COALESCE(analytics_record.avg_pages_per_session, 0.00)
    )
    ON CONFLICT (date) DO UPDATE SET
        total_page_views = EXCLUDED.total_page_views,
        unique_page_views = EXCLUDED.unique_page_views,
        total_sessions = EXCLUDED.total_sessions,
        unique_visitors = EXCLUDED.unique_visitors,
        new_visitors = EXCLUDED.new_visitors,
        returning_visitors = EXCLUDED.returning_visitors,
        bounce_rate = EXCLUDED.bounce_rate,
        avg_session_duration_seconds = EXCLUDED.avg_session_duration_seconds,
        avg_pages_per_session = EXCLUDED.avg_pages_per_session,
        updated_at = CURRENT_TIMESTAMP;
        
    -- Update top pages
    UPDATE daily_analytics SET
        top_pages = (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'page_path', page_path,
                    'page_title', page_title,
                    'views', views
                )
            )
            FROM (
                SELECT 
                    pv.page_path,
                    pv.page_title,
                    COUNT(*) as views
                FROM page_views pv
                WHERE DATE(pv.viewed_at) = target_date
                GROUP BY pv.page_path, pv.page_title
                ORDER BY views DESC
                LIMIT 10
            ) top_pages_data
        )
    WHERE date = target_date;
END;
$$ language 'plpgsql';

-- Add comments
COMMENT ON TABLE visitor_sessions IS 'User sessions for tracking visitor behavior and analytics';
COMMENT ON COLUMN visitor_sessions.session_id IS 'Unique session identifier (from cookie/token)';
COMMENT ON COLUMN visitor_sessions.is_bounce IS 'True if user viewed only one page';
COMMENT ON COLUMN visitor_sessions.is_new_visitor IS 'True if this is the users first visit';

COMMENT ON TABLE page_views IS 'Individual page view events for detailed analytics';
COMMENT ON COLUMN page_views.resource_type IS 'Type of content being viewed';
COMMENT ON COLUMN page_views.resource_id IS 'ID of the specific resource (blog post, challenge, etc.)';
COMMENT ON COLUMN page_views.scroll_depth_percent IS 'How far down the page the user scrolled';

COMMENT ON TABLE daily_analytics IS 'Daily aggregated analytics data for faster reporting';
COMMENT ON TABLE analytics_events IS 'Custom event tracking (downloads, form submissions, etc.)';

COMMENT ON FUNCTION update_daily_analytics(DATE) IS 'Generates daily analytics summary for the specified date';

-- Record migration
INSERT INTO schema_migrations (version, description) 
VALUES ('005', 'Create analytics tables for tracking page views and sessions');