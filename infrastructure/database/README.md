# PostgreSQL Database Schema for Personal Website

This directory contains a complete PostgreSQL database schema designed for a personal website with blog functionality, coding challenges, analytics tracking, and contact forms.

## 🗂️ Directory Structure

```
infrastructure/database/
├── migrations/           # Database schema migrations
├── seed/                # Sample data for development
├── functions/           # Custom database functions
├── indexes/             # Performance optimization indexes
├── triggers/            # Business logic triggers
├── run_migrations.sql   # Master migration runner
├── run_seeds.sql        # Seed data runner
└── README.md           # This file
```

## 📋 Schema Overview

### Core Tables

1. **users** - User authentication and profiles
2. **blog_posts** - Blog articles and content
3. **blog_post_tags** - Tag system for categorizing posts
4. **comments** - Threaded comment system
5. **coding_challenges** - Programming challenges
6. **challenge_submissions** - User code submissions
7. **contact_submissions** - Contact form messages
8. **visitor_sessions** - User session tracking
9. **page_views** - Page visit analytics
10. **analytics_events** - Custom event tracking

### Features

- ✅ **User Management**: Role-based access (admin, editor, user)
- ✅ **Blog System**: Posts, tags, and threaded comments
- ✅ **Coding Platform**: Challenges with test cases and submissions
- ✅ **Analytics**: Comprehensive visitor and engagement tracking
- ✅ **Contact Forms**: Spam detection and auto-reply system
- ✅ **Performance**: Optimized indexes and query patterns
- ✅ **Data Integrity**: Foreign keys and constraints
- ✅ **Automation**: Triggers for timestamps and statistics

## 🚀 Quick Start

### Prerequisites

- PostgreSQL 12+ installed
- Database user with CREATE privileges
- psql command-line tool

### Setup Database

1. **Create Database**
```sql
CREATE DATABASE personal_website;
\c personal_website;
```

2. **Run Migrations**
```bash
psql -d personal_website -f infrastructure/database/run_migrations.sql
```

3. **Add Sample Data** (Optional)
```bash
psql -d personal_website -f infrastructure/database/run_seeds.sql
```

## 📊 Migration System

Migrations are numbered and tracked in the `schema_migrations` table:

- `000_init_migration_framework.sql` - Sets up migration tracking
- `001_create_users_table.sql` - User accounts and authentication
- `002_create_blog_posts_table.sql` - Blog content management
- `003_create_comments_table.sql` - Comment system with threading
- `004_create_coding_challenges_table.sql` - Programming challenges
- `005_create_analytics_tables.sql` - Visitor tracking and analytics
- `006_create_contact_form_table.sql` - Contact forms and auto-replies

### Running Individual Migrations

```sql
\i infrastructure/database/migrations/001_create_users_table.sql
```

## 🔧 Configuration

### Application Database User

Create a dedicated user for your application:

```sql
-- Create application user
CREATE USER app_user WITH PASSWORD 'your_secure_password_here';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE personal_website TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Grant permissions on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT USAGE, SELECT ON SEQUENCES TO app_user;
```

### Connection Pool Settings

Recommended connection pool settings:

```javascript
// Example for Node.js with pg-pool
const pool = new Pool({
  user: 'app_user',
  password: 'your_secure_password_here',
  host: 'localhost',
  database: 'personal_website',
  port: 5432,
  max: 20,          // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## 📈 Performance Optimization

### Indexes

The schema includes comprehensive indexes for:
- Primary keys and foreign keys
- Common query patterns
- Full-text search capabilities
- Composite indexes for complex queries

### Query Optimization Tips

1. **Blog Posts**: Use `status = 'published'` filters
2. **Analytics**: Query by date ranges with proper indexes
3. **Comments**: Leverage the `depth` column for threading
4. **Search**: Use GIN indexes for full-text search

### Monitoring Queries

Check index usage:
```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;
```

## 🧹 Maintenance

### Daily Tasks

Run the cleanup function daily:
```sql
SELECT cleanup_old_data();
```

### Analytics Updates

Update daily analytics:
```sql
SELECT update_daily_analytics(CURRENT_DATE);
```

### Backup Strategy

1. **Daily Backups**:
```bash
pg_dump -U postgres personal_website > backup_$(date +%Y%m%d).sql
```

2. **Weekly Full Backup**:
```bash
pg_basebackup -U postgres -D /path/to/backup/location
```

## 🔒 Security Considerations

### Password Hashing

The schema expects bcrypt-hashed passwords:
```javascript
const bcrypt = require('bcrypt');
const saltRounds = 12;
const hashedPassword = await bcrypt.hash(password, saltRounds);
```

### SQL Injection Prevention

Always use parameterized queries:
```javascript
// Good
const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

// Bad - Don't do this!
const result = await pool.query(`SELECT * FROM users WHERE email = '${email}'`);
```

### Data Sanitization

- Validate all input data
- Use type checking and constraints
- Implement rate limiting for contact forms
- Monitor for spam patterns

## 📊 Sample Data

The seed scripts create:
- 5 sample users (including admin)
- 4 blog posts with comments
- 4 coding challenges with test cases
- Sample analytics data
- Contact form submissions

### Default Credentials

**Admin Account:**
- Username: `ethan`
- Email: `ethan@ethanaldrich.net`
- Password: `password123`

⚠️ **Change default passwords before production use!**

## 🔍 Common Queries

### Recent Blog Posts
```sql
SELECT title, slug, excerpt, published_at, view_count
FROM blog_posts 
WHERE status = 'published' AND visibility = 'public'
ORDER BY published_at DESC 
LIMIT 10;
```

### User Statistics
```sql
SELECT 
    role,
    COUNT(*) as user_count,
    COUNT(*) FILTER (WHERE is_active = true) as active_users
FROM users 
GROUP BY role;
```

### Popular Challenges
```sql
SELECT 
    title,
    difficulty,
    submission_count,
    solved_count,
    success_rate
FROM coding_challenges 
WHERE is_active = true
ORDER BY submission_count DESC 
LIMIT 10;
```

## 🆘 Troubleshooting

### Migration Issues

1. **Permission Errors**: Ensure user has CREATE privileges
2. **Extension Errors**: Install required extensions as superuser
3. **Rollback**: Use database backups to rollback if needed

### Performance Issues

1. **Slow Queries**: Check `pg_stat_statements` for slow queries
2. **Missing Indexes**: Use `EXPLAIN ANALYZE` to identify missing indexes
3. **Connection Issues**: Monitor connection pool usage

### Common Errors

```sql
-- Check for lock conflicts
SELECT * FROM pg_locks WHERE NOT granted;

-- Monitor active connections
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [SQL Style Guide](https://www.sqlstyle.guide/)
- [Database Design Best Practices](https://www.postgresql.org/docs/current/ddl-best-practices.html)

## 🤝 Contributing

When adding new migrations:
1. Create a new numbered migration file
2. Add proper comments and documentation  
3. Include rollback instructions
4. Test on a copy of production data
5. Update this README with new features

---

For questions or issues, please refer to the project documentation or create an issue in the repository.