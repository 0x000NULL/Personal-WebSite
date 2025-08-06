-- Seed Data: Blog Content
-- Description: Create sample blog posts, tags, and comments
-- Created: 2025-08-05
-- Author: Ethan Aldrich

-- Get admin user ID for blog posts
DO $$
DECLARE
    admin_user_id UUID;
    editor_user_id UUID;
    user1_id UUID;
    user2_id UUID;
    
    -- Post IDs for referencing
    post1_id UUID := uuid_generate_v4();
    post2_id UUID := uuid_generate_v4();
    post3_id UUID := uuid_generate_v4();
    post4_id UUID := uuid_generate_v4();
    
    -- Tag IDs
    tag_js_id UUID := uuid_generate_v4();
    tag_react_id UUID := uuid_generate_v4();
    tag_node_id UUID := uuid_generate_v4();
    tag_web_id UUID := uuid_generate_v4();
    tag_tutorial_id UUID := uuid_generate_v4();
    tag_career_id UUID := uuid_generate_v4();
BEGIN
    -- Get user IDs
    SELECT id INTO admin_user_id FROM users WHERE username = 'ethan';
    -- No other users to select
    
    -- Create blog post tags
    INSERT INTO blog_post_tags (id, name, slug, description, color) VALUES
    (tag_js_id, 'JavaScript', 'javascript', 'JavaScript programming language', '#F7DF1E'),
    (tag_react_id, 'React', 'react', 'React.js framework', '#61DAFB'),
    (tag_node_id, 'Node.js', 'nodejs', 'Node.js runtime environment', '#339933'),
    (tag_web_id, 'Web Development', 'web-development', 'General web development topics', '#FF6B6B'),
    (tag_tutorial_id, 'Tutorial', 'tutorial', 'Step-by-step tutorials', '#4ECDC4'),
    (tag_career_id, 'Career', 'career', 'Career advice and tips', '#45B7D1');
    
    -- Create blog posts
    INSERT INTO blog_posts (
        id, author_id, title, slug, excerpt, content, status, visibility, featured, 
        meta_title, meta_description, published_at
    ) VALUES
    (
        post1_id,
        admin_user_id,
        'Understanding React Hooks in Depth',
        'understanding-react-hooks-in-depth',
        'A comprehensive guide to React Hooks for managing state and side effects in modern React applications.',
        '# Getting Started with React Hooks

React Hooks revolutionized how we write React components by allowing us to use state and lifecycle methods in functional components. In this comprehensive guide, we''ll explore the most commonly used hooks and how to implement them effectively.

## What are React Hooks?

Hooks are functions that let you "hook into" React state and lifecycle features from function components. They were introduced in React 16.8 and have become the standard way to write React components.

## useState Hook

The `useState` hook is the most fundamental hook for managing component state:

```javascript
import React, { useState } from ''react'';

function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
```

## useEffect Hook

The `useEffect` hook lets you perform side effects in function components:

```javascript
import React, { useState, useEffect } from ''react'';

function DataFetcher() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    fetchData().then(setData);
  }, []); // Empty dependency array means this runs once
  
  return <div>{data ? data.title : ''Loading...''}</div>;
}
```

## Best Practices

1. Always use the dependency array with useEffect
2. Extract custom hooks for reusable logic
3. Keep hooks at the top level of your components
4. Use multiple state variables for unrelated state

React Hooks make your code more readable and reusable. Start incorporating them into your projects today!',
        'published',
        'public',
        true,
        'Getting Started with React Hooks - Complete Guide',
        'Learn React Hooks fundamentals including useState, useEffect, and best practices for modern React development.',
        NOW() - INTERVAL '5 days'
    ),
    (
        post2_id,
        admin_user_id,
        'Building Scalable APIs with Node.js',
        'building-scalable-apis-nodejs',
        'Learn how to build production-ready REST APIs with Node.js, Express, and modern best practices.',
        '# Building a REST API with Node.js and Express

Creating a REST API is a fundamental skill for backend developers. In this tutorial, we''ll build a complete API for a blog application using Node.js and Express.

## Project Setup

First, let''s initialize our project and install dependencies:

```bash
npm init -y
npm install express mongoose cors helmet morgan
npm install -D nodemon
```

## Basic Server Setup

Create `server.js`:

```javascript
const express = require(''express'');
const mongoose = require(''mongoose'');
const cors = require(''cors'');
const helmet = require(''helmet'');
const morgan = require(''morgan'');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan(''combined''));
app.use(express.json());

// Routes
app.get(''/api/health'', (req, res) => {
  res.json({ status: ''OK'', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Creating Models

Define your data models using Mongoose:

```javascript
const mongoose = require(''mongoose'');

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model(''Post'', postSchema);
```

## API Routes

Implement CRUD operations:

```javascript
// GET all posts
app.get(''/api/posts'', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST new post
app.post(''/api/posts'', async (req, res) => {
  try {
    const post = new Post(req.body);
    await post.save();
    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

## Error Handling and Validation

Always implement proper error handling and input validation for production APIs.

This foundation will help you build robust APIs for any application!',
        'published',
        'public',
        false,
        'Building a REST API with Node.js and Express',
        'Complete tutorial on creating REST APIs with Node.js, Express, and MongoDB including authentication and error handling.',
        NOW() - INTERVAL '3 days'
    ),
    (
        post3_id,
        admin_user_id,
        'My Journey Into Software Engineering',
        'my-journey-software-engineering',
        'Personal reflections and lessons learned from my transition into software engineering.',
        '# My Journey Into Software Engineering

Looking back on my journey into software engineering, I wanted to share some personal insights and lessons that helped shape my path.

## 1. Focus on Fundamentals

Before diving into the latest frameworks, make sure you have a solid understanding of:

- Programming fundamentals (data structures, algorithms)
- Version control (Git)
- Basic debugging techniques
- Code organization and clean code principles

## 2. Build Projects

Nothing beats hands-on experience. Create projects that demonstrate your skills:

- Personal portfolio website
- Todo application with full CRUD functionality
- Weather app using APIs
- Simple e-commerce site

## 3. Learn Continuously

The tech industry evolves rapidly. Stay current by:

- Following tech blogs and newsletters
- Watching coding tutorials
- Attending local meetups and conferences
- Contributing to open source projects

## 4. Network and Seek Mentorship

Connect with other developers:

- Join developer communities (Discord, Slack, Reddit)
- Attend local tech meetups
- Find a mentor who can guide your growth
- Don''t be afraid to ask questions

## 5. Practice Soft Skills

Technical skills are important, but don''t neglect:

- Communication skills
- Problem-solving approaches
- Time management
- Teamwork and collaboration

## 6. Be Patient with Yourself

Remember that becoming proficient takes time. Everyone learns at their own pace, and it''s okay to feel overwhelmed sometimes.

## Conclusion

Everyone''s journey is unique. These are the principles that guided mine, and I hope they provide value to others on a similar path.',
        'published',
        'public',
        false,
        'Career Tips for Junior Developers - Start Your Tech Journey',
        'Essential career advice for junior developers including skill development, networking, and professional growth strategies.',
        NOW() - INTERVAL '1 day'
    ),
    (
        post4_id,
        admin_user_id,
        'Advanced JavaScript Concepts Every Developer Should Know',
        'advanced-javascript-concepts',
        'Deep dive into closures, prototypes, async/await, and other advanced JavaScript concepts.',
        '# Advanced JavaScript Concepts Every Developer Should Know

JavaScript is a powerful language with many advanced concepts that can help you write better, more efficient code. Let''s explore some key concepts every developer should master.

## Closures

Closures are one of JavaScript''s most powerful features:

```javascript
function outerFunction(x) {
  return function innerFunction(y) {
    return x + y;
  };
}

const addFive = outerFunction(5);
console.log(addFive(3)); // 8
```

## Prototypes and Inheritance

Understanding prototypes is crucial for JavaScript mastery:

```javascript
function Person(name) {
  this.name = name;
}

Person.prototype.greet = function() {
  return `Hello, I''m ${this.name}`;
};

const john = new Person(''John'');
console.log(john.greet()); // "Hello, I''m John"
```

## Async/Await

Modern asynchronous programming:

```javascript
async function fetchUserData(userId) {
  try {
    const response = await fetch(`/api/users/${userId}`);
    const userData = await response.json();
    return userData;
  } catch (error) {
    console.error(''Error fetching user data:'', error);
    throw error;
  }
}
```

## Event Loop

Understanding how JavaScript handles asynchronous operations is crucial for writing efficient code and avoiding common pitfalls.

## Destructuring and Spread Operator

Modern ES6+ features that make code more readable:

```javascript
// Destructuring
const { name, age } = user;
const [first, second] = array;

// Spread operator
const newArray = [...oldArray, newItem];
const newObject = { ...oldObject, newProperty: value };
```

These concepts form the foundation of advanced JavaScript development. Mastering them will significantly improve your code quality and problem-solving abilities.',
        'draft',
        'public',
        false,
        'Advanced JavaScript Concepts - Master Modern JS',
        'Learn advanced JavaScript concepts including closures, prototypes, async/await, and modern ES6+ features.',
        NULL
    );
    
    -- Create tag assignments
    INSERT INTO blog_post_tag_assignments (post_id, tag_id) VALUES
    (post1_id, tag_js_id),
    (post1_id, tag_react_id),
    (post1_id, tag_tutorial_id),
    (post2_id, tag_js_id),
    (post2_id, tag_node_id),
    (post2_id, tag_tutorial_id),
    (post2_id, tag_web_id),
    (post3_id, tag_career_id),
    (post4_id, tag_js_id),
    (post4_id, tag_web_id);
    
    -- Comments section removed - will be populated organically by real users
    
END $$;

-- Update post statistics
UPDATE blog_posts SET 
    view_count = floor(random() * 1000) + 100,
    like_count = floor(random() * 50) + 5
WHERE status = 'published';

-- Display created content summary
SELECT 
    'Blog Posts' as content_type,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE status = 'published') as published,
    COUNT(*) FILTER (WHERE featured = true) as featured
FROM blog_posts
UNION ALL
SELECT 
    'Tags' as content_type,
    COUNT(*) as count,
    NULL as published,
    NULL as featured
FROM blog_post_tags
UNION ALL
SELECT 
    'Comments' as content_type,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE status = 'approved') as published,
    NULL as featured
FROM comments;