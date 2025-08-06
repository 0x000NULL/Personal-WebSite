import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AnalyticsModel, CreateSessionData, CreatePageViewData, CreateEventData } from '../models/Analytics';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { rateLimiter } from '../middleware/rateLimiter';
import UAParser from 'ua-parser-js';

const router = Router();

// Validation schemas
const sessionSchema = Joi.object({
  sessionId: Joi.string().required(),
  referrerUrl: Joi.string().uri().allow('').optional(),
  utmSource: Joi.string().max(100).optional(),
  utmMedium: Joi.string().max(100).optional(),
  utmCampaign: Joi.string().max(100).optional(),
  utmTerm: Joi.string().max(100).optional(),
  utmContent: Joi.string().max(100).optional(),
  entryPage: Joi.string().max(500).optional()
});

const pageViewSchema = Joi.object({
  sessionId: Joi.string().required(),
  pageUrl: Joi.string().uri().required(),
  pagePath: Joi.string().max(500).required(),
  pageTitle: Joi.string().max(255).optional(),
  resourceType: Joi.string().valid('page', 'post', 'challenge', 'contact', 'api').optional(),
  resourceId: Joi.string().uuid().optional(),
  referrerUrl: Joi.string().uri().allow('').optional()
});

const updatePageViewSchema = Joi.object({
  timeOnPageSeconds: Joi.number().min(0).optional(),
  scrollDepthPercent: Joi.number().min(0).max(100).optional()
});

const eventSchema = Joi.object({
  sessionId: Joi.string().optional(),
  eventName: Joi.string().max(100).required(),
  eventCategory: Joi.string().max(50).optional(),
  eventAction: Joi.string().max(100).optional(),
  eventLabel: Joi.string().max(255).optional(),
  eventValue: Joi.number().optional(),
  pageUrl: Joi.string().uri().optional(),
  customData: Joi.object().optional()
});

// Helper function to parse user agent
function parseUserAgent(userAgent: string) {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  let deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' = 'desktop';
  if (result.device.type === 'mobile') deviceType = 'mobile';
  else if (result.device.type === 'tablet') deviceType = 'tablet';
  else if (result.ua.toLowerCase().includes('bot')) deviceType = 'bot';
  
  return {
    deviceType,
    browser: result.browser.name,
    browserVersion: result.browser.version,
    os: result.os.name,
    osVersion: result.os.version
  };
}

// Helper function to extract domain from URL
function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

/**
 * @swagger
 * /api/analytics/session:
 *   post:
 *     summary: Create or update an analytics session
 *     tags: [Analytics]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *             properties:
 *               sessionId:
 *                 type: string
 *               referrerUrl:
 *                 type: string
 *                 format: uri
 *               utmSource:
 *                 type: string
 *               utmMedium:
 *                 type: string
 *               utmCampaign:
 *                 type: string
 *               utmTerm:
 *                 type: string
 *               utmContent:
 *                 type: string
 *               entryPage:
 *                 type: string
 *     responses:
 *       201:
 *         description: Session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessionId:
 *                   type: string
 *       200:
 *         description: Session already exists
 *       400:
 *         description: Validation error
 */
router.post('/session', rateLimiter.analytics, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = sessionSchema.validate(req.body);
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    // Check if session already exists
    const existingSession = await AnalyticsModel.getSession(value.sessionId);
    if (existingSession) {
      return res.json({ sessionId: value.sessionId });
    }

    const userAgent = req.get('User-Agent') || '';
    const parsedUA = parseUserAgent(userAgent);
    
    const sessionData: CreateSessionData = {
      ...value,
      userId: (req as any).user?.id,
      ipAddress: req.ip,
      userAgent,
      ...parsedUA,
      referrerDomain: value.referrerUrl ? extractDomain(value.referrerUrl) : null
    };

    await AnalyticsModel.createSession(sessionData);

    res.status(201).json({ sessionId: value.sessionId });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/analytics/pageview:
 *   post:
 *     summary: Track a page view
 *     tags: [Analytics]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - pageUrl
 *               - pagePath
 *             properties:
 *               sessionId:
 *                 type: string
 *               pageUrl:
 *                 type: string
 *                 format: uri
 *               pagePath:
 *                 type: string
 *               pageTitle:
 *                 type: string
 *               resourceType:
 *                 type: string
 *                 enum: [page, post, challenge, contact, api]
 *               resourceId:
 *                 type: string
 *                 format: uuid
 *               referrerUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       201:
 *         description: Page view tracked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pageViewId:
 *                   type: string
 *                   format: uuid
 *       400:
 *         description: Validation error
 */
router.post('/pageview', rateLimiter.analytics, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = pageViewSchema.validate(req.body);
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    const pageViewData: CreatePageViewData = {
      ...value,
      userId: (req as any).user?.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method,
      statusCode: res.statusCode
    };

    const pageView = await AnalyticsModel.createPageView(pageViewData);

    res.status(201).json({ pageViewId: pageView.id });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/analytics/pageview/{id}:
 *   patch:
 *     summary: Update page view metrics
 *     tags: [Analytics]
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
 *               timeOnPageSeconds:
 *                 type: number
 *                 minimum: 0
 *               scrollDepthPercent:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *     responses:
 *       200:
 *         description: Page view updated successfully
 *       400:
 *         description: Validation error
 */
router.patch('/pageview/:id', rateLimiter.analytics, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { error, value } = updatePageViewSchema.validate(req.body);
    
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    await AnalyticsModel.updatePageView(id, value);

    res.json({ message: 'Page view updated successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/analytics/event:
 *   post:
 *     summary: Track a custom event
 *     tags: [Analytics]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventName
 *             properties:
 *               sessionId:
 *                 type: string
 *               eventName:
 *                 type: string
 *               eventCategory:
 *                 type: string
 *               eventAction:
 *                 type: string
 *               eventLabel:
 *                 type: string
 *               eventValue:
 *                 type: number
 *               pageUrl:
 *                 type: string
 *                 format: uri
 *               customData:
 *                 type: object
 *     responses:
 *       201:
 *         description: Event tracked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 eventId:
 *                   type: string
 *                   format: uuid
 *       400:
 *         description: Validation error
 */
router.post('/event', rateLimiter.analytics, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = eventSchema.validate(req.body);
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    const eventData: CreateEventData = {
      ...value,
      userId: (req as any).user?.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    const event = await AnalyticsModel.createEvent(eventData);

    res.status(201).json({ eventId: event.id });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/analytics/realtime:
 *   get:
 *     summary: Get realtime analytics (admin only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Realtime analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 activeUsers:
 *                   type: integer
 *                 pageViewsLastHour:
 *                   type: integer
 *                 topPages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       path:
 *                         type: string
 *                       views:
 *                         type: integer
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/realtime', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await AnalyticsModel.getRealtimeStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/analytics/daily:
 *   get:
 *     summary: Get daily analytics summary (admin only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Daily analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 analytics:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DailyAnalytics'
 *       400:
 *         description: Invalid date range
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/daily', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw createError('startDate and endDate are required', 400);
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw createError('Invalid date format', 400);
    }

    if (start > end) {
      throw createError('startDate must be before endDate', 400);
    }

    const analytics = await AnalyticsModel.getDailyAnalytics(start, end);

    res.json({ analytics });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/analytics/top-content:
 *   get:
 *     summary: Get top content by views
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [post, challenge, page]
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *     responses:
 *       200:
 *         description: Top content retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       resourceId:
 *                         type: string
 *                       title:
 *                         type: string
 *                       views:
 *                         type: integer
 *       400:
 *         description: Invalid parameters
 */
router.get('/top-content', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, days = 30, limit = 10 } = req.query;

    if (!type || !['post', 'challenge', 'page'].includes(type as string)) {
      throw createError('Invalid content type', 400);
    }

    const content = await AnalyticsModel.getTopContent(
      type as 'post' | 'challenge' | 'page',
      parseInt(days as string),
      parseInt(limit as string)
    );

    res.json({ content });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/analytics/user/{userId}:
 *   get:
 *     summary: Get user analytics (admin or own data)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *     responses:
 *       200:
 *         description: User analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalPageViews:
 *                   type: integer
 *                 totalSessions:
 *                   type: integer
 *                 avgSessionDuration:
 *                   type: number
 *                 favoriteContent:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                       title:
 *                         type: string
 *                       views:
 *                         type: integer
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 */
router.get('/user/:userId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    // Check permissions - users can only see their own data unless admin
    if (req.user!.role !== 'admin' && req.user!.id !== userId) {
      throw createError('Access denied', 403);
    }

    const analytics = await AnalyticsModel.getUserAnalytics(
      userId,
      parseInt(days as string)
    );

    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/analytics/traffic-sources:
 *   get:
 *     summary: Get traffic source analytics (admin only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *     responses:
 *       200:
 *         description: Traffic sources retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 referrers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       domain:
 *                         type: string
 *                       visits:
 *                         type: integer
 *                       percentage:
 *                         type: number
 *                 utmSources:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       source:
 *                         type: string
 *                       visits:
 *                         type: integer
 *                       percentage:
 *                         type: number
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/traffic-sources', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { days = 30 } = req.query;

    const sources = await AnalyticsModel.getTrafficSources(
      parseInt(days as string)
    );

    res.json(sources);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/analytics/generate-daily:
 *   post:
 *     summary: Generate daily analytics summary (admin only)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Daily analytics generated successfully
 *       400:
 *         description: Invalid date
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.post('/generate-daily', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date } = req.body;

    if (!date) {
      throw createError('date is required', 400);
    }

    const targetDate = new Date(date);

    if (isNaN(targetDate.getTime())) {
      throw createError('Invalid date format', 400);
    }

    await AnalyticsModel.generateDailyAnalytics(targetDate);

    res.json({ message: 'Daily analytics generated successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;