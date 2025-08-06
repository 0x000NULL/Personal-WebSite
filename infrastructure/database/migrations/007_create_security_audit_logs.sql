-- Migration: Create security audit logs table
-- Description: Table to store security-related events for auditing and monitoring

CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_security_audit_logs_event_type ON security_audit_logs(event_type);
CREATE INDEX idx_security_audit_logs_user_id ON security_audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_security_audit_logs_ip_address ON security_audit_logs(ip_address);
CREATE INDEX idx_security_audit_logs_severity ON security_audit_logs(severity);
CREATE INDEX idx_security_audit_logs_created_at ON security_audit_logs(created_at DESC);

-- Composite index for common queries
CREATE INDEX idx_security_audit_logs_event_severity_created 
    ON security_audit_logs(event_type, severity, created_at DESC);

-- Partial index for high severity events
CREATE INDEX idx_security_audit_logs_high_severity 
    ON security_audit_logs(created_at DESC) 
    WHERE severity IN ('high', 'critical');

-- Add comment
COMMENT ON TABLE security_audit_logs IS 'Audit log for security-related events including logins, failed attempts, and suspicious activities';