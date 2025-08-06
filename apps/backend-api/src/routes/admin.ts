import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { UserModel } from '../models/User';
import { BlogPostModel } from '../models/BlogPost';
import { CommentModel } from '../models/Comment';
import { ContactSubmissionModel } from '../models/ContactSubmission';
import { CodingChallengeModel } from '../models/CodingChallenge';
import { AnalyticsModel } from '../models/Analytics';
import { pool } from '../config/database';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// Validation schemas
const updateUserSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).optional(),
  email: Joi.string().email().optional(),
  firstName: Joi.string().max(100).optional(),
  lastName: Joi.string().max(100).optional(),
  bio: Joi.string().max(1000).optional(),
  role: Joi.string().valid('user', 'admin', 'editor', 'moderator').optional(),
  isActive: Joi.boolean().optional(),
  isEmailVerified: Joi.boolean().optional()
});

const systemConfigSchema = Joi.object({
  siteName: Joi.string().max(100).optional(),
  siteDescription: Joi.string().max(500).optional(),
  maintenanceMode: Joi.boolean().optional(),
  registrationEnabled: Joi.boolean().optional(),
  commentsEnabled: Joi.boolean().optional(),
  analyticsEnabled: Joi.boolean().optional(),
  maxUploadSize: Joi.number().min(1).max(100).optional(), // MB
  allowedFileTypes: Joi.array().items(Joi.string()).optional(),
  emailSettings: Joi.object({
    smtpHost: Joi.string().optional(),
    smtpPort: Joi.number().optional(),
    smtpUser: Joi.string().optional(),
    smtpSecure: Joi.boolean().optional()
  }).optional()
});

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     active:
 *                       type: integer
 *                     newThisMonth:
 *                       type: integer
 *                 content:
 *                   type: object
 *                   properties:
 *                     blogPosts:
 *                       type: integer
 *                     challenges:
 *                       type: integer
 *                     comments:
 *                       type: integer
 *                 analytics:
 *                   type: object
 *                   properties:
 *                     pageViewsToday:
 *                       type: integer
 *                     pageViewsThisMonth:
 *                       type: integer
 *                     activeUsers:
 *                       type: integer
 *                 system:
 *                   type: object
 *                   properties:
 *                     version:
 *                       type: string
 *                     uptime:
 *                       type: number
 *                     dbConnections:
 *                       type: integer
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/dashboard', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Get user statistics
    const userStatsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_this_month
      FROM users
    `;
    
    // Get content statistics
    const contentStatsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM blog_posts) as blog_posts,
        (SELECT COUNT(*) FROM coding_challenges) as challenges,
        (SELECT COUNT(*) FROM comments) as comments
    `;
    
    // Get analytics statistics
    const analyticsStatsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM page_views WHERE DATE(viewed_at) = CURRENT_DATE) as page_views_today,
        (SELECT COUNT(*) FROM page_views WHERE viewed_at >= CURRENT_DATE - INTERVAL '30 days') as page_views_this_month,
        (SELECT COUNT(DISTINCT session_id) FROM visitor_sessions WHERE ended_at IS NULL OR ended_at > NOW() - INTERVAL '30 minutes') as active_users
    `;
    
    // Get system statistics
    const systemStatsQuery = `
      SELECT 
        version() as db_version,
        pg_size_pretty(pg_database_size(current_database())) as db_size,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as db_connections
    `;
    
    const [userStats, contentStats, analyticsStats, systemStats] = await Promise.all([
      pool.query(userStatsQuery),
      pool.query(contentStatsQuery),
      pool.query(analyticsStatsQuery),
      pool.query(systemStatsQuery)
    ]);
    
    const dashboard = {
      users: {
        total: parseInt(userStats.rows[0].total),
        active: parseInt(userStats.rows[0].active),
        newThisMonth: parseInt(userStats.rows[0].new_this_month)
      },
      content: {
        blogPosts: parseInt(contentStats.rows[0].blog_posts),
        challenges: parseInt(contentStats.rows[0].challenges),
        comments: parseInt(contentStats.rows[0].comments)
      },
      analytics: {
        pageViewsToday: parseInt(analyticsStats.rows[0].page_views_today),
        pageViewsThisMonth: parseInt(analyticsStats.rows[0].page_views_this_month),
        activeUsers: parseInt(analyticsStats.rows[0].active_users)
      },
      system: {
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        dbConnections: parseInt(systemStats.rows[0].db_connections),
        dbSize: systemStats.rows[0].db_size
      }
    };
    
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users with admin details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, admin, editor, moderator]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (req.query.search) {
      conditions.push(`(username ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex})`);
      values.push(`%${req.query.search}%`);
      paramIndex++;
    }

    if (req.query.role) {
      conditions.push(`role = $${paramIndex++}`);
      values.push(req.query.role);
    }

    if (req.query.isActive !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      values.push(req.query.isActive === 'true');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get users
    const query = `
      SELECT 
        id, username, email, first_name, last_name, bio, role, 
        is_active, is_email_verified, avatar_url, last_login_at,
        created_at, updated_at
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);
    const result = await pool.query(query, values);

    res.json({
      users: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     summary: Update user details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               bio:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [user, admin, editor, moderator]
 *               isActive:
 *                 type: boolean
 *               isEmailVerified:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: User not found
 */
router.put('/users/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { error, value } = updateUserSchema.validate(req.body);

    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    // Prevent changing own admin status
    if (id === req.user!.id && value.role && value.role !== 'admin') {
      throw createError('Cannot change your own admin role', 400);
    }

    const updatedUser = await UserModel.updateByAdmin(id, value);

    if (!updatedUser) {
      throw createError('User not found', 404);
    }

    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Delete user account
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: User not found
 */
router.delete('/users/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Prevent deleting own account
    if (id === req.user!.id) {
      throw createError('Cannot delete your own account', 400);
    }

    const deleted = await UserModel.delete(id);

    if (!deleted) {
      throw createError('User not found', 404);
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/content/stats:
 *   get:
 *     summary: Get content statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Content statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 blogPosts:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     published:
 *                       type: integer
 *                     drafts:
 *                       type: integer
 *                     thisMonth:
 *                       type: integer
 *                 challenges:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     active:
 *                       type: integer
 *                     byDifficulty:
 *                       type: object
 *                 comments:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     approved:
 *                       type: integer
 *                     pending:
 *                       type: integer
 *                     spam:
 *                       type: integer
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/content/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const blogStatsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'published') as published,
        COUNT(*) FILTER (WHERE status = 'draft') as drafts,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as this_month
      FROM blog_posts
    `;

    const challengeStatsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE difficulty = 'easy') as easy,
        COUNT(*) FILTER (WHERE difficulty = 'medium') as medium,
        COUNT(*) FILTER (WHERE difficulty = 'hard') as hard,
        COUNT(*) FILTER (WHERE difficulty = 'expert') as expert
      FROM coding_challenges
    `;

    const commentStatsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'spam') as spam
      FROM comments
    `;

    const [blogStats, challengeStats, commentStats] = await Promise.all([
      pool.query(blogStatsQuery),
      pool.query(challengeStatsQuery),
      pool.query(commentStatsQuery)
    ]);

    const stats = {
      blogPosts: {
        total: parseInt(blogStats.rows[0].total),
        published: parseInt(blogStats.rows[0].published),
        drafts: parseInt(blogStats.rows[0].drafts),
        thisMonth: parseInt(blogStats.rows[0].this_month)
      },
      challenges: {
        total: parseInt(challengeStats.rows[0].total),
        active: parseInt(challengeStats.rows[0].active),
        byDifficulty: {
          easy: parseInt(challengeStats.rows[0].easy),
          medium: parseInt(challengeStats.rows[0].medium),
          hard: parseInt(challengeStats.rows[0].hard),
          expert: parseInt(challengeStats.rows[0].expert)
        }
      },
      comments: {
        total: parseInt(commentStats.rows[0].total),
        approved: parseInt(commentStats.rows[0].approved),
        pending: parseInt(commentStats.rows[0].pending),
        spam: parseInt(commentStats.rows[0].spam)
      }
    };

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/logs:
 *   get:
 *     summary: Get system logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [error, warn, info, debug]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       level:
 *                         type: string
 *                       message:
 *                         type: string
 *                       meta:
 *                         type: object
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/logs', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // In a real implementation, this would read from actual log files or a logging service
    // For now, we'll return a placeholder response
    const logs = [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Admin accessed logs endpoint',
        meta: {
          userId: req.user!.id,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        }
      }
    ];

    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/system/health:
 *   get:
 *     summary: Get system health status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded, unhealthy]
 *                 database:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     connectionCount:
 *                       type: integer
 *                     responseTime:
 *                       type: number
 *                 services:
 *                   type: object
 *                   properties:
 *                     mlService:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         responseTime:
 *                           type: number
 *                 memory:
 *                   type: object
 *                   properties:
 *                     used:
 *                       type: number
 *                     total:
 *                       type: number
 *                     percentage:
 *                       type: number
 *                 uptime:
 *                   type: number
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/system/health', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const startTime = Date.now();
    
    // Check database health
    let dbStatus = 'healthy';
    let dbResponseTime = 0;
    let dbConnectionCount = 0;
    
    try {
      const dbStart = Date.now();
      const dbResult = await pool.query('SELECT 1');
      dbResponseTime = Date.now() - dbStart;
      
      const connResult = await pool.query('SELECT count(*) FROM pg_stat_activity WHERE state = \'active\'');
      dbConnectionCount = parseInt(connResult.rows[0].count);
    } catch (error) {
      dbStatus = 'unhealthy';
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const usedMemory = memoryUsage.heapUsed;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    // Determine overall status
    let overallStatus = 'healthy';
    if (dbStatus === 'unhealthy' || memoryPercentage > 90) {
      overallStatus = 'unhealthy';
    } else if (dbResponseTime > 1000 || memoryPercentage > 75) {
      overallStatus = 'degraded';
    }

    const health = {
      status: overallStatus,
      database: {
        status: dbStatus,
        connectionCount: dbConnectionCount,
        responseTime: dbResponseTime
      },
      services: {
        mlService: {
          status: 'unknown', // Would check ML service health here
          responseTime: 0
        }
      },
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: parseFloat(memoryPercentage.toFixed(2))
      },
      uptime: process.uptime()
    };

    res.json(health);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/admin/cache/clear:
 *   post:
 *     summary: Clear application cache
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.post('/cache/clear', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // In a real implementation, this would clear Redis cache, in-memory cache, etc.
    // For now, we'll just log the action
    console.log(`Cache cleared by admin: ${req.user!.username}`);
    
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;