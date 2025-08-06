-- Seed Data: Coding Challenges
-- Description: Create sample coding challenges, test cases, and submissions
-- Created: 2025-08-05
-- Author: Ethan Aldrich

DO $$
DECLARE
    admin_user_id UUID;
    user1_id UUID;
    user2_id UUID;
    user3_id UUID;
    
    -- Challenge IDs
    challenge1_id UUID := uuid_generate_v4();
    challenge2_id UUID := uuid_generate_v4();
    challenge3_id UUID := uuid_generate_v4();
    challenge4_id UUID := uuid_generate_v4();
    
    -- Test case IDs
    test1_1 UUID := uuid_generate_v4();
    test1_2 UUID := uuid_generate_v4();
    test1_3 UUID := uuid_generate_v4();
    test2_1 UUID := uuid_generate_v4();
    test2_2 UUID := uuid_generate_v4();
    test3_1 UUID := uuid_generate_v4();
    test3_2 UUID := uuid_generate_v4();
    test3_3 UUID := uuid_generate_v4();
    test4_1 UUID := uuid_generate_v4();
    test4_2 UUID := uuid_generate_v4();
    
BEGIN
    -- Get user IDs
    SELECT id INTO admin_user_id FROM users WHERE username = 'ethan';
    -- No other users to select
    
    -- Create coding challenges
    INSERT INTO coding_challenges (
        id, title, slug, description, problem_statement, difficulty, category, 
        tags, input_format, output_format, constraints, sample_input, sample_output, 
        explanation, hints, time_limit_ms, memory_limit_mb, author_id, is_active, is_featured
    ) VALUES
    (
        challenge1_id,
        'Two Sum',
        'two-sum',
        'Find two numbers in an array that add up to a target sum.',
        'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.',
        'easy',
        'Array',
        'array,hash-table,math',
        'First line contains the target integer.
Second line contains space-separated integers representing the array.',
        'Two space-separated integers representing the indices of the two numbers.',
        '- 2 ≤ nums.length ≤ 10^4
- -10^9 ≤ nums[i] ≤ 10^9
- -10^9 ≤ target ≤ 10^9
- Only one valid answer exists.',
        '9
2 7 11 15',
        '0 1',
        'The numbers at indices 0 and 1 (2 and 7) add up to the target 9.',
        '["Try using a hash map to store numbers you''ve seen", "Think about the complement of each number"]',
        2000,
        128,
        admin_user_id,
        true,
        true
    ),
    (
        challenge2_id,
        'Palindrome Number',
        'palindrome-number',
        'Determine whether an integer is a palindrome without converting it to a string.',
        'Given an integer x, return true if x is palindrome integer.

An integer is a palindrome when it reads the same backward as forward.

Follow up: Could you solve it without converting the integer to a string?',
        'easy',
        'Math',
        'math,palindrome',
        'A single integer x.',
        'true if the integer is a palindrome, false otherwise.',
        '- -2^31 ≤ x ≤ 2^31 - 1',
        '121',
        'true',
        '121 reads as 121 from left to right and from right to left, so it is a palindrome.',
        '["Negative numbers are not palindromes", "Try reversing only half of the number"]',
        1000,
        64,
        admin_user_id,
        true,
        false
    ),
    (
        challenge3_id,
        'Binary Tree Maximum Depth',
        'binary-tree-maximum-depth',
        'Find the maximum depth of a binary tree.',
        'Given the root of a binary tree, return its maximum depth.

A binary tree''s maximum depth is the number of nodes along the longest path from the root node down to the farthest leaf node.',
        'medium',
        'Tree',
        'tree,binary-tree,recursion,dfs',
        'The binary tree is represented as a comma-separated list in level order, with null values represented as "null".',
        'An integer representing the maximum depth.',
        '- The number of nodes in the tree is in the range [0, 10^4]
- -100 ≤ Node.val ≤ 100',
        '3,9,20,null,null,15,7',
        '3',
        'The maximum depth is 3, going through nodes 3 → 20 → 7 or 3 → 20 → 15.',
        '["Use recursion to explore both left and right subtrees", "Base case: null node has depth 0"]',
        3000,
        256,
        admin_user_id,
        true,
        true
    ),
    (
        challenge4_id,
        'Valid Parentheses',
        'valid-parentheses',
        'Determine if a string of parentheses is valid.',
        'Given a string s containing just the characters ''('', '')'', ''{'', ''}'', ''['' and '']'', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.',
        'medium',
        'Stack',
        'stack,string,parentheses',
        'A single string s containing only bracket characters.',
        'true if the string is valid, false otherwise.',
        '- 1 ≤ s.length ≤ 10^4
- s consists of parentheses only ''()[]{}''.''',
        '()[]{}',
        'true',
        'All brackets are properly opened and closed in the correct order.',
        '["Use a stack to keep track of opening brackets", "Match each closing bracket with the most recent opening bracket"]',
        2000,
        128,
        admin_user_id,
        true,
        false
    );
    
    -- Create test cases
    INSERT INTO challenge_test_cases (id, challenge_id, input_data, expected_output, is_sample, is_hidden, weight) VALUES
    -- Two Sum test cases
    (test1_1, challenge1_id, '9\n2 7 11 15', '0 1', true, false, 1.0),
    (test1_2, challenge1_id, '6\n3 2 4', '1 2', false, true, 1.0),
    (test1_3, challenge1_id, '6\n3 3', '0 1', false, true, 1.0),
    
    -- Palindrome Number test cases
    (test2_1, challenge2_id, '121', 'true', true, false, 1.0),
    (test2_2, challenge2_id, '-121', 'false', false, true, 1.0),
    
    -- Binary Tree Maximum Depth test cases
    (test3_1, challenge3_id, '3,9,20,null,null,15,7', '3', true, false, 1.0),
    (test3_2, challenge3_id, '1,null,2', '2', false, true, 1.0),
    (test3_3, challenge3_id, 'null', '0', false, true, 1.0),
    
    -- Valid Parentheses test cases
    (test4_1, challenge4_id, '()[]{}', 'true', true, false, 1.0),
    (test4_2, challenge4_id, '([)]', 'false', false, true, 1.0);
    
    -- Submissions will be populated organically by real users
    
END $$;

-- Update challenge statistics (this will be done by triggers in real usage)
UPDATE coding_challenges SET
    submission_count = (SELECT COUNT(*) FROM challenge_submissions WHERE challenge_id = coding_challenges.id),
    solved_count = (SELECT COUNT(DISTINCT user_id) FROM challenge_submissions WHERE challenge_id = coding_challenges.id AND status = 'accepted'),
    success_rate = CASE 
        WHEN (SELECT COUNT(*) FROM challenge_submissions WHERE challenge_id = coding_challenges.id) = 0 THEN 0.0
        ELSE ROUND(
            (SELECT COUNT(*) FROM challenge_submissions WHERE challenge_id = coding_challenges.id AND status = 'accepted') * 100.0 / 
            (SELECT COUNT(*) FROM challenge_submissions WHERE challenge_id = coding_challenges.id), 2
        )
    END;

-- Display created content summary
SELECT 
    'Coding Challenges' as content_type,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE is_active = true) as active,
    COUNT(*) FILTER (WHERE is_featured = true) as featured
FROM coding_challenges
UNION ALL
SELECT 
    'Test Cases' as content_type,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE is_sample = true) as active,
    COUNT(*) FILTER (WHERE is_hidden = false) as featured
FROM challenge_test_cases
UNION ALL
SELECT 
    'Submissions' as content_type,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE status = 'accepted') as active,
    NULL as featured
FROM challenge_submissions;