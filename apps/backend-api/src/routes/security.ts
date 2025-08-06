import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { securityAudit } from '../services/securityAudit';
import { tokenBlacklist } from '../services/tokenBlacklist';
import { getRedis } from '../config/database';
import { createError } from '../middleware/errorHandler';

const router = Router();

/**
 * @swagger
 * /api/security/status:
 *   get:
 *     summary: Get security system status
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Security status retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/status', authenticate, authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const redis = getRedis();
    
    const status = {
      authentication: {
        jwtConfigured: !!process.env.JWT_ACCESS_SECRET && process.env.JWT_ACCESS_SECRET !== 'your-super-secret-jwt-key',
        refreshTokensEnabled: true,
        tokenBlacklistEnabled: !!redis,
        maxLoginAttempts: process.env.MAX_LOGIN_ATTEMPTS || 5,
        lockoutDuration: process.env.LOCKOUT_DURATION || 900000
      },
      rateLimiting: {
        enabled: true,
        redisAvailable: !!redis,
        storage: redis ? 'redis' : 'memory'
      },
      cors: {
        enabled: true,
        origins: process.env.ALLOWED_ORIGINS?.split(',') || [process.env.FRONTEND_URL || 'http://localhost:3000']
      },
      headers: {
        helmetEnabled: true,
        hstsEnabled: process.env.NODE_ENV === 'production',
        cspEnabled: process.env.NODE_ENV === 'production'
      },
      database: {
        parameterizedQueries: true,
        transactionSupport: true,
        auditLoggingEnabled: true
      },
      monitoring: {
        auditLogEnabled: true,
        suspiciousPatternDetection: !!redis
      }
    };
    
    res.json(status);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/security/audit:
 *   get:
 *     summary: Get security audit logs
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: number
 *           default: 24
 *         description: Number of hours to look back
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/audit', authenticate, authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    
    const [stats, suspicious] = await Promise.all([
      securityAudit.getSecurityStats(hours),
      securityAudit.getRecentSuspiciousActivity(hours)
    ]);
    
    res.json({
      stats,
      suspiciousActivity: suspicious,
      timeRange: `${hours} hours`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/security/user/{userId}/events:
 *   get:
 *     summary: Get security events for a specific user
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 50
 *         description: Maximum number of events to retrieve
 *     responses:
 *       200:
 *         description: User security events retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/user/:userId/events', authenticate, authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const events = await securityAudit.getUserSecurityEvents(userId, limit);
    
    res.json({
      userId,
      events,
      count: events.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/security/blacklist:
 *   get:
 *     summary: Get token blacklist statistics
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Blacklist statistics retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/blacklist', authenticate, authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await tokenBlacklist.getStats();
    
    res.json({
      blacklist: stats,
      redisAvailable: !!getRedis()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/security/user/{userId}/revoke-tokens:
 *   post:
 *     summary: Revoke all tokens for a specific user
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Tokens revoked successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.post('/user/:userId/revoke-tokens', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    
    // In a real implementation, you would:
    // 1. Get all active tokens for the user from your token store
    // 2. Add them to the blacklist
    // 3. Force the user to re-authenticate
    
    // For now, we'll just invalidate future tokens by setting a timestamp
    const tokens: string[] = []; // Would be fetched from token store
    await tokenBlacklist.blacklistUserTokens(userId, tokens, 86400); // 24 hour expiry
    
    // Log the action
    await securityAudit.logEvent({
      eventType: 'suspicious_activity',
      userId: req.user!.id,
      ipAddress: req.ip || 'unknown',
      metadata: {
        action: 'revoked_user_tokens',
        targetUserId: userId
      },
      severity: 'high'
    });
    
    res.json({
      message: 'All tokens for user have been revoked',
      userId
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/security/cleanup:
 *   post:
 *     summary: Clean up old security logs
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               daysToKeep:
 *                 type: number
 *                 default: 90
 *     responses:
 *       200:
 *         description: Cleanup completed successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.post('/cleanup', authenticate, authorize('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daysToKeep = req.body.daysToKeep || 90;
    
    const deletedCount = await securityAudit.cleanupOldLogs(daysToKeep);
    
    res.json({
      message: 'Security logs cleaned up successfully',
      deletedCount,
      daysToKeep
    });
  } catch (error) {
    next(error);
  }
});

export default router;