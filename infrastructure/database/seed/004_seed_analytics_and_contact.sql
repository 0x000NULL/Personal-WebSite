-- Seed Data: Analytics and Contact Forms
-- Description: Create sample analytics data and contact form submissions
-- Created: 2025-08-05
-- Author: Ethan Aldrich

DO $$
DECLARE
    user1_id UUID;
    user2_id UUID;
    admin_user_id UUID;
    
    -- Session IDs
    session1_id UUID := uuid_generate_v4();
    session2_id UUID := uuid_generate_v4();
    session3_id UUID := uuid_generate_v4();
    session4_id UUID := uuid_generate_v4();
    session5_id UUID := uuid_generate_v4();
    
    -- Template IDs
    template1_id UUID := uuid_generate_v4();
    template2_id UUID := uuid_generate_v4();
    
    i INTEGER;
    random_date TIMESTAMP WITH TIME ZONE;
    
BEGIN
    -- Get user IDs
    SELECT id INTO admin_user_id FROM users WHERE username = 'ethan';
    -- No other users to select
    
    -- Analytics data will be populated organically by real visitors
    
    -- Create contact form templates
    INSERT INTO contact_form_templates (id, name, form_type, subject_template, message_template, is_active, auto_send, send_delay_hours, created_by) VALUES
    (template1_id, 'General Contact Auto-Reply', 'general', 'Thank you for contacting us!', 'Hi {{name}},

Thank you for reaching out! We have received your message and will get back to you within 24 hours.

Your message:
"{{message}}"

Best regards,
The Team', true, true, 0, admin_user_id),
    (template2_id, 'Business Inquiry Response', 'business', 'Business Inquiry Received', 'Dear {{name}},

Thank you for your business inquiry. We appreciate your interest in working with us.

We will review your request and respond within 2 business days.

Company: {{company}}
Subject: {{subject}}

Best regards,
Business Development Team', true, true, 1, admin_user_id);
    
    -- Create contact form submissions
    INSERT INTO contact_submissions (
        name, email, phone, company, subject, message, form_type, status, priority,
        ip_address, user_agent, referrer_url, spam_score, is_spam, submitted_at
    ) VALUES
    (
        'Alice Johnson', 'alice.johnson@techcorp.com', '+1-555-0123', 'TechCorp Inc.',
        'Partnership Opportunity', 'Hi, I represent TechCorp and we are interested in discussing a potential partnership. We develop enterprise software solutions and believe there could be synergy between our companies. Could we schedule a call to discuss further?',
        'business', 'new', 'high', '203.0.113.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'https://linkedin.com/company/techcorp', 0.05, false, NOW() - INTERVAL '2 days'
    ),
    (
        'Bob Smith', 'bob.smith@email.com', NULL, NULL,
        'Question about React tutorial', 'I followed your React hooks tutorial but I''m having trouble with the useEffect dependency array. Could you clarify when I should include variables in the dependency array?',
        'general', 'read', 'normal', '192.168.1.200', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'https://ethanaldrich.net/blog/understanding-react-hooks-in-depth', 0.10, false, NOW() - INTERVAL '1 day'
    ),
    (
        'Carol Davis', 'carol.davis@startup.io', '+1-555-0456', 'StartupIO',
        'Freelance Development Services', 'We are a small startup looking for a freelance developer to help with our React application. Are you available for consulting work? We have a budget of $5000 for this project.',
        'business', 'replied', 'high', '198.51.100.150', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'https://github.com/explore', 0.08, false, NOW() - INTERVAL '3 days'
    ),
    (
        'David Wilson', 'david.wilson@gmail.com', NULL, NULL,
        'Bug in coding challenge', 'I think there might be a bug in the Two Sum challenge. My solution works locally but fails on your platform. Here is my code: [code snippet]. Can you check?',
        'support', 'new', 'normal', '10.0.0.75', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'https://ethanaldrich.net/coding-challenges/two-sum', 0.15, false, NOW() - INTERVAL '6 hours'
    ),
    (
        'Spam User', 'spam@badsite.com', NULL, NULL,
        'MAKE MONEY FAST!!!', 'Click here to earn $5000 per day!!! This is not spam!!! Visit http://badsite.com/offer now!!! Limited time offer!!! Buy cheap viagra!!! Casino games!!!',
        'general', 'spam', 'low', '192.0.2.50', 'BadBot/1.0', NULL, 0.95, true, NOW() - INTERVAL '12 hours'
    );
    
    -- Update contact submission with reply information
    UPDATE contact_submissions 
    SET 
        replied_at = NOW() - INTERVAL '2 days',
        replied_by = admin_user_id,
        reply_message = 'Thank you for your interest in partnership opportunities. I''ve forwarded your message to our business development team. They will contact you within 2 business days to discuss potential collaboration.'
    WHERE email = 'carol.davis@startup.io';
    
    -- Create some auto-reply records
    INSERT INTO contact_auto_replies (submission_id, template_id, subject, message, sent_at, status)
    SELECT 
        cs.id, 
        template1_id, 
        'Thank you for contacting us!', 
        'Hi ' || cs.name || ',

Thank you for reaching out! We have received your message and will get back to you within 24 hours.

Your message:
"' || SUBSTRING(cs.message, 1, 100) || '..."

Best regards,
The Team',
        NOW() - INTERVAL '1 day',
        'sent'
    FROM contact_submissions cs 
    WHERE cs.form_type = 'general' AND cs.is_spam = false
    LIMIT 2;
    
END $$;

-- Update session statistics (normally done by triggers)
UPDATE visitor_sessions SET
    page_views = (SELECT COUNT(*) FROM page_views WHERE session_id = visitor_sessions.id),
    ended_at = (SELECT MAX(viewed_at) FROM page_views WHERE session_id = visitor_sessions.id),
    session_duration_seconds = EXTRACT(EPOCH FROM (
        (SELECT MAX(viewed_at) FROM page_views WHERE session_id = visitor_sessions.id) - started_at
    ))::INTEGER,
    is_bounce = (SELECT COUNT(*) FROM page_views WHERE session_id = visitor_sessions.id) <= 1,
    exit_page = (SELECT page_path FROM page_views WHERE session_id = visitor_sessions.id ORDER BY viewed_at DESC LIMIT 1);

-- Generate daily analytics for the past few days
SELECT update_daily_analytics(CURRENT_DATE);
SELECT update_daily_analytics(CURRENT_DATE - 1);
SELECT update_daily_analytics(CURRENT_DATE - 2);

-- Display created content summary
SELECT 
    'Visitor Sessions' as content_type,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE user_id IS NOT NULL) as logged_in,
    COUNT(*) FILTER (WHERE is_new_visitor = true) as new_visitors
FROM visitor_sessions
UNION ALL
SELECT 
    'Page Views' as content_type,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE user_id IS NOT NULL) as logged_in,
    NULL as new_visitors
FROM page_views
UNION ALL
SELECT 
    'Analytics Events' as content_type,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE user_id IS NOT NULL) as logged_in,
    NULL as new_visitors
FROM analytics_events
UNION ALL
SELECT 
    'Contact Submissions' as content_type,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE status != 'spam') as logged_in,
    COUNT(*) FILTER (WHERE status = 'replied') as new_visitors
FROM contact_submissions;