-- Seed Data: Users
-- Description: Create initial users including admin account
-- Created: 2025-08-05
-- Author: Ethan Aldrich

-- Insert admin user
INSERT INTO users (
    id,
    username,
    email,
    password_hash,
    first_name,
    last_name,
    bio,
    role,
    is_active,
    email_verified
) VALUES (
    uuid_generate_v4(),
    'ethan',
    'ethan@ethanaldrich.net',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukGWz5AZC', -- 'password123' hashed
    'Ethan',
    'Aldrich',
    'Software Engineer, Website Owner and Content Creator.',
    'admin',
    true,
    true
) ON CONFLICT (email) DO NOTHING;



-- Update admin user with specific ID for reference in other seed files
UPDATE users 
SET id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE username = 'ethan' AND email = 'ethan@ethanaldrich.net';

-- Set last login time for admin
UPDATE users 
SET last_login = NOW() - INTERVAL '2 days'
WHERE username = 'ethan';

-- Add avatar URL for admin
UPDATE users 
SET avatar_url = 'https://via.placeholder.com/150/FF6B6B/FFFFFF?text=EA'
WHERE username = 'ethan';

-- Display created users
SELECT 
    username,
    email,
    first_name,
    last_name,
    role,
    is_active,
    email_verified,
    created_at
FROM users
ORDER BY created_at;

-- Note: In production, use proper password hashing with your application's bcrypt settings
-- The hash above is for 'password123' with cost 12