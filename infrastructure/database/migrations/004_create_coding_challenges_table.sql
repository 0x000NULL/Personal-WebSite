-- Migration: 004_create_coding_challenges_table.sql
-- Description: Create coding challenges and submissions tables
-- Created: 2025-08-05
-- Author: Database Administrator

-- Create coding_challenges table
CREATE TABLE coding_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    problem_statement TEXT NOT NULL,
    difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
    category VARCHAR(50) NOT NULL,
    tags VARCHAR(500), -- Comma-separated tags
    input_format TEXT,
    output_format TEXT,
    constraints TEXT,
    sample_input TEXT,
    sample_output TEXT,
    explanation TEXT,
    hints TEXT, -- JSON array of hints
    time_limit_ms INTEGER DEFAULT 5000,
    memory_limit_mb INTEGER DEFAULT 256,
    test_cases_count INTEGER DEFAULT 0,
    submission_count INTEGER DEFAULT 0,
    solved_count INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_coding_challenges_updated_at 
    BEFORE UPDATE ON coding_challenges 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create test cases table
CREATE TABLE challenge_test_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES coding_challenges(id) ON DELETE CASCADE,
    input_data TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    is_sample BOOLEAN DEFAULT false,
    is_hidden BOOLEAN DEFAULT true,
    weight DECIMAL(3,2) DEFAULT 1.00, -- Weight for scoring
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for test cases
CREATE TRIGGER update_challenge_test_cases_updated_at 
    BEFORE UPDATE ON challenge_test_cases 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create submissions table
CREATE TABLE challenge_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES coding_challenges(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    language VARCHAR(50) NOT NULL,
    code TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
        'pending', 'running', 'accepted', 'wrong_answer', 
        'time_limit_exceeded', 'memory_limit_exceeded', 
        'runtime_error', 'compilation_error', 'system_error'
    )),
    score DECIMAL(5,2) DEFAULT 0.00,
    execution_time_ms INTEGER,
    memory_used_mb DECIMAL(8,2),
    test_cases_passed INTEGER DEFAULT 0,
    test_cases_total INTEGER DEFAULT 0,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    judged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for submissions
CREATE TRIGGER update_challenge_submissions_updated_at 
    BEFORE UPDATE ON challenge_submissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create submission results table for detailed test case results
CREATE TABLE submission_test_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES challenge_submissions(id) ON DELETE CASCADE,
    test_case_id UUID NOT NULL REFERENCES challenge_test_cases(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL CHECK (status IN (
        'passed', 'failed', 'time_limit_exceeded', 
        'memory_limit_exceeded', 'runtime_error'
    )),
    execution_time_ms INTEGER,
    memory_used_mb DECIMAL(8,2),
    actual_output TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_coding_challenges_slug ON coding_challenges(slug);
CREATE INDEX idx_coding_challenges_difficulty ON coding_challenges(difficulty);
CREATE INDEX idx_coding_challenges_category ON coding_challenges(category);
CREATE INDEX idx_coding_challenges_author_id ON coding_challenges(author_id);
CREATE INDEX idx_coding_challenges_is_active ON coding_challenges(is_active);
CREATE INDEX idx_coding_challenges_is_featured ON coding_challenges(is_featured) WHERE is_featured = true;
CREATE INDEX idx_coding_challenges_created_at ON coding_challenges(created_at);
CREATE INDEX idx_coding_challenges_success_rate ON coding_challenges(success_rate);

CREATE INDEX idx_challenge_test_cases_challenge_id ON challenge_test_cases(challenge_id);
CREATE INDEX idx_challenge_test_cases_is_sample ON challenge_test_cases(is_sample);
CREATE INDEX idx_challenge_test_cases_is_hidden ON challenge_test_cases(is_hidden);

CREATE INDEX idx_challenge_submissions_challenge_id ON challenge_submissions(challenge_id);
CREATE INDEX idx_challenge_submissions_user_id ON challenge_submissions(user_id);
CREATE INDEX idx_challenge_submissions_status ON challenge_submissions(status);
CREATE INDEX idx_challenge_submissions_language ON challenge_submissions(language);
CREATE INDEX idx_challenge_submissions_submitted_at ON challenge_submissions(submitted_at);
CREATE INDEX idx_challenge_submissions_score ON challenge_submissions(score);
CREATE INDEX idx_challenge_submissions_user_challenge ON challenge_submissions(user_id, challenge_id);

CREATE INDEX idx_submission_test_results_submission_id ON submission_test_results(submission_id);
CREATE INDEX idx_submission_test_results_test_case_id ON submission_test_results(test_case_id);
CREATE INDEX idx_submission_test_results_status ON submission_test_results(status);

-- Full-text search indexes
CREATE INDEX idx_coding_challenges_title_gin ON coding_challenges USING gin(to_tsvector('english', title));
CREATE INDEX idx_coding_challenges_description_gin ON coding_challenges USING gin(to_tsvector('english', description));

-- Function to update challenge statistics
CREATE OR REPLACE FUNCTION update_challenge_statistics()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
        UPDATE coding_challenges SET
            submission_count = (
                SELECT COUNT(*) 
                FROM challenge_submissions 
                WHERE challenge_id = NEW.challenge_id
            ),
            solved_count = (
                SELECT COUNT(DISTINCT user_id) 
                FROM challenge_submissions 
                WHERE challenge_id = NEW.challenge_id 
                AND status = 'accepted'
                AND user_id IS NOT NULL
            ),
            success_rate = (
                SELECT CASE 
                    WHEN COUNT(*) = 0 THEN 0.00
                    ELSE ROUND(
                        (COUNT(*) FILTER (WHERE status = 'accepted') * 100.0) / COUNT(*), 
                        2
                    )
                END
                FROM challenge_submissions 
                WHERE challenge_id = NEW.challenge_id
            )
        WHERE id = NEW.challenge_id;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        UPDATE coding_challenges SET
            submission_count = (
                SELECT COUNT(*) 
                FROM challenge_submissions 
                WHERE challenge_id = OLD.challenge_id
            ),
            solved_count = (
                SELECT COUNT(DISTINCT user_id) 
                FROM challenge_submissions 
                WHERE challenge_id = OLD.challenge_id 
                AND status = 'accepted'
                AND user_id IS NOT NULL
            ),
            success_rate = (
                SELECT CASE 
                    WHEN COUNT(*) = 0 THEN 0.00
                    ELSE ROUND(
                        (COUNT(*) FILTER (WHERE status = 'accepted') * 100.0) / COUNT(*), 
                        2
                    )
                END
                FROM challenge_submissions 
                WHERE challenge_id = OLD.challenge_id
            )
        WHERE id = OLD.challenge_id;
        
        RETURN OLD;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for challenge statistics
CREATE TRIGGER update_challenge_statistics_trigger
    AFTER INSERT OR UPDATE OR DELETE ON challenge_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_challenge_statistics();

-- Function to update test case count
CREATE OR REPLACE FUNCTION update_test_case_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE coding_challenges 
        SET test_cases_count = (
            SELECT COUNT(*) 
            FROM challenge_test_cases 
            WHERE challenge_id = NEW.challenge_id
        )
        WHERE id = NEW.challenge_id;
        RETURN NEW;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        UPDATE coding_challenges 
        SET test_cases_count = (
            SELECT COUNT(*) 
            FROM challenge_test_cases 
            WHERE challenge_id = OLD.challenge_id
        )
        WHERE id = OLD.challenge_id;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Create trigger for test case count
CREATE TRIGGER update_test_case_count_trigger
    AFTER INSERT OR DELETE ON challenge_test_cases
    FOR EACH ROW
    EXECUTE FUNCTION update_test_case_count();

-- Add comments
COMMENT ON TABLE coding_challenges IS 'Programming challenges and coding problems';
COMMENT ON COLUMN coding_challenges.difficulty IS 'Challenge difficulty: easy, medium, hard, expert';
COMMENT ON COLUMN coding_challenges.time_limit_ms IS 'Execution time limit in milliseconds';
COMMENT ON COLUMN coding_challenges.memory_limit_mb IS 'Memory usage limit in megabytes';
COMMENT ON COLUMN coding_challenges.success_rate IS 'Percentage of successful submissions';

COMMENT ON TABLE challenge_test_cases IS 'Test cases for coding challenges';
COMMENT ON COLUMN challenge_test_cases.is_sample IS 'Whether this test case is shown to users';
COMMENT ON COLUMN challenge_test_cases.is_hidden IS 'Whether this test case is hidden during judging';
COMMENT ON COLUMN challenge_test_cases.weight IS 'Weight for scoring (e.g., 1.0 = full points)';

COMMENT ON TABLE challenge_submissions IS 'User submissions for coding challenges';
COMMENT ON COLUMN challenge_submissions.status IS 'Submission status after judging';
COMMENT ON COLUMN challenge_submissions.score IS 'Score achieved (0-100)';

COMMENT ON TABLE submission_test_results IS 'Detailed results for each test case of a submission';

-- Record migration
INSERT INTO schema_migrations (version, description) 
VALUES ('004', 'Create coding challenges and submissions tables');