-- Migration: 006_create_contact_form_table.sql
-- Description: Create contact form submissions table
-- Created: 2025-08-05
-- Author: Database Administrator

-- Create contact form submissions table
CREATE TABLE contact_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    company VARCHAR(255),
    subject VARCHAR(255),
    message TEXT NOT NULL,
    form_type VARCHAR(50) DEFAULT 'general' CHECK (form_type IN ('general', 'business', 'support', 'collaboration')),
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'resolved', 'spam', 'archived')),
    priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    source VARCHAR(50) DEFAULT 'website', -- Where the form was submitted from
    ip_address INET,
    user_agent TEXT,
    referrer_url TEXT,
    spam_score DECIMAL(3,2) DEFAULT 0.00, -- 0.00 to 1.00, higher is more likely spam
    is_spam BOOLEAN DEFAULT false,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    replied_at TIMESTAMP WITH TIME ZONE,
    replied_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reply_message TEXT,
    tags VARCHAR(500), -- Comma-separated tags for categorization
    internal_notes TEXT, -- Staff notes, not visible to submitter
    attachments JSONB DEFAULT '[]'::jsonb, -- Array of attachment file info
    custom_fields JSONB DEFAULT '{}'::jsonb, -- For future form field extensions
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_contact_submissions_updated_at 
    BEFORE UPDATE ON contact_submissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create contact form templates table for automated responses
CREATE TABLE contact_form_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    form_type VARCHAR(50) NOT NULL,
    subject_template VARCHAR(255) NOT NULL,
    message_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    auto_send BOOLEAN DEFAULT false, -- Automatically send when form is submitted
    send_delay_hours INTEGER DEFAULT 0, -- Delay before sending (0 = immediate)
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for templates
CREATE TRIGGER update_contact_form_templates_updated_at 
    BEFORE UPDATE ON contact_form_templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create contact form auto-replies tracking
CREATE TABLE contact_auto_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES contact_submissions(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES contact_form_templates(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for auto-replies
CREATE TRIGGER update_contact_auto_replies_updated_at 
    BEFORE UPDATE ON contact_auto_replies 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_contact_submissions_email ON contact_submissions(email);
CREATE INDEX idx_contact_submissions_status ON contact_submissions(status);
CREATE INDEX idx_contact_submissions_form_type ON contact_submissions(form_type);
CREATE INDEX idx_contact_submissions_priority ON contact_submissions(priority);
CREATE INDEX idx_contact_submissions_assigned_to ON contact_submissions(assigned_to);
CREATE INDEX idx_contact_submissions_submitted_at ON contact_submissions(submitted_at);
CREATE INDEX idx_contact_submissions_is_spam ON contact_submissions(is_spam);
CREATE INDEX idx_contact_submissions_spam_score ON contact_submissions(spam_score);
CREATE INDEX idx_contact_submissions_ip_address ON contact_submissions(ip_address);
CREATE INDEX idx_contact_submissions_replied_at ON contact_submissions(replied_at);

-- Full-text search indexes
CREATE INDEX idx_contact_submissions_name_gin ON contact_submissions USING gin(to_tsvector('english', name));
CREATE INDEX idx_contact_submissions_subject_gin ON contact_submissions USING gin(to_tsvector('english', subject));
CREATE INDEX idx_contact_submissions_message_gin ON contact_submissions USING gin(to_tsvector('english', message));

-- JSONB indexes
CREATE INDEX idx_contact_submissions_attachments ON contact_submissions USING gin(attachments);
CREATE INDEX idx_contact_submissions_custom_fields ON contact_submissions USING gin(custom_fields);

CREATE INDEX idx_contact_form_templates_form_type ON contact_form_templates(form_type);
CREATE INDEX idx_contact_form_templates_is_active ON contact_form_templates(is_active);
CREATE INDEX idx_contact_form_templates_auto_send ON contact_form_templates(auto_send);
CREATE INDEX idx_contact_form_templates_created_by ON contact_form_templates(created_by);

CREATE INDEX idx_contact_auto_replies_submission_id ON contact_auto_replies(submission_id);
CREATE INDEX idx_contact_auto_replies_template_id ON contact_auto_replies(template_id);
CREATE INDEX idx_contact_auto_replies_status ON contact_auto_replies(status);
CREATE INDEX idx_contact_auto_replies_sent_at ON contact_auto_replies(sent_at);

-- Function to calculate spam score based on simple heuristics
CREATE OR REPLACE FUNCTION calculate_spam_score(
    p_name VARCHAR,
    p_email VARCHAR,
    p_message TEXT,
    p_ip_address INET
) RETURNS DECIMAL(3,2) AS $$
DECLARE
    score DECIMAL(3,2) := 0.00;
    recent_submissions INTEGER;
    link_count INTEGER;
BEGIN
    -- Check for recent submissions from same IP
    SELECT COUNT(*) INTO recent_submissions
    FROM contact_submissions 
    WHERE ip_address = p_ip_address 
    AND created_at > NOW() - INTERVAL '1 hour';
    
    IF recent_submissions > 3 THEN
        score := score + 0.40;
    ELSIF recent_submissions > 1 THEN
        score := score + 0.15;
    END IF;
    
    -- Check for excessive links in message
    link_count := (LENGTH(p_message) - LENGTH(REPLACE(LOWER(p_message), 'http', ''))) / 4;
    IF link_count > 3 THEN
        score := score + 0.30;
    ELSIF link_count > 1 THEN
        score := score + 0.10;
    END IF;
    
    -- Check for suspicious patterns
    IF p_message ~* '.*(viagra|casino|loan|pharmacy|bitcoin|investment|earn money).*' THEN
        score := score + 0.50;
    END IF;
    
    -- Check for all caps
    IF LENGTH(p_message) > 20 AND p_message = UPPER(p_message) THEN
        score := score + 0.20;
    END IF;
    
    -- Check for very short messages
    IF LENGTH(TRIM(p_message)) < 10 THEN
        score := score + 0.15;
    END IF;
    
    -- Cap at 1.00
    IF score > 1.00 THEN
        score := 1.00;
    END IF;
    
    RETURN score;
END;
$$ language 'plpgsql';

-- Function to automatically set spam score on insert
CREATE OR REPLACE FUNCTION set_spam_score()
RETURNS TRIGGER AS $$
BEGIN
    NEW.spam_score := calculate_spam_score(NEW.name, NEW.email, NEW.message, NEW.ip_address);
    NEW.is_spam := NEW.spam_score > 0.70;
    
    -- Auto-assign status based on spam score
    IF NEW.is_spam THEN
        NEW.status := 'spam';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for spam detection
CREATE TRIGGER set_spam_score_trigger
    BEFORE INSERT ON contact_submissions
    FOR EACH ROW
    EXECUTE FUNCTION set_spam_score();

-- Function to queue auto-reply emails
CREATE OR REPLACE FUNCTION queue_auto_replies()
RETURNS TRIGGER AS $$
DECLARE
    template_record RECORD;
BEGIN
    -- Only for new submissions that aren't spam
    IF TG_OP = 'INSERT' AND NOT NEW.is_spam THEN
        -- Find active auto-send templates for this form type
        FOR template_record IN 
            SELECT * FROM contact_form_templates 
            WHERE form_type = NEW.form_type 
            AND is_active = true 
            AND auto_send = true
        LOOP
            INSERT INTO contact_auto_replies (
                submission_id,
                template_id,
                subject,
                message,
                status
            ) VALUES (
                NEW.id,
                template_record.id,
                template_record.subject_template,
                template_record.message_template,
                'pending'
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for auto-reply queueing
CREATE TRIGGER queue_auto_replies_trigger
    AFTER INSERT ON contact_submissions
    FOR EACH ROW
    EXECUTE FUNCTION queue_auto_replies();

-- Add comments
COMMENT ON TABLE contact_submissions IS 'Contact form submissions from website visitors';
COMMENT ON COLUMN contact_submissions.form_type IS 'Type of contact form: general, business, support, collaboration';
COMMENT ON COLUMN contact_submissions.status IS 'Processing status: new, read, replied, resolved, spam, archived';
COMMENT ON COLUMN contact_submissions.spam_score IS 'Calculated spam probability (0.00-1.00, higher = more likely spam)';
COMMENT ON COLUMN contact_submissions.attachments IS 'JSON array of file attachment metadata';
COMMENT ON COLUMN contact_submissions.custom_fields IS 'JSON object for additional form fields';

COMMENT ON TABLE contact_form_templates IS 'Email templates for automated responses to contact forms';
COMMENT ON TABLE contact_auto_replies IS 'Queue for automated email replies to contact submissions';

COMMENT ON FUNCTION calculate_spam_score(VARCHAR, VARCHAR, TEXT, INET) IS 'Calculates spam probability based on submission content and patterns';

-- Record migration
INSERT INTO schema_migrations (version, description) 
VALUES ('006', 'Create contact form submissions and auto-reply system');