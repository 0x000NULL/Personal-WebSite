import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import axios from 'axios';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// ML service configuration
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';
const ML_SERVICE_API_KEY = process.env.ML_SERVICE_API_KEY;

// Create axios instance for ML service
const mlService = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
    ...(ML_SERVICE_API_KEY && { 'Authorization': `Bearer ${ML_SERVICE_API_KEY}` })
  }
});

// Validation schemas
const textAnalysisSchema = Joi.object({
  text: Joi.string().min(1).max(10000).required(),
  language: Joi.string().length(2).default('en').optional(),
  features: Joi.array().items(
    Joi.string().valid('sentiment', 'keywords', 'entities', 'summary', 'toxicity')
  ).default(['sentiment']).optional()
});

const codeAnalysisSchema = Joi.object({
  code: Joi.string().min(1).max(50000).required(),
  language: Joi.string().valid('python', 'javascript', 'java', 'cpp', 'go', 'rust', 'typescript').required(),
  features: Joi.array().items(
    Joi.string().valid('complexity', 'quality', 'security', 'suggestions', 'bugs')
  ).default(['complexity', 'quality']).optional()
});

const imageAnalysisSchema = Joi.object({
  imageUrl: Joi.string().uri().optional(),
  imageBase64: Joi.string().optional(),
  features: Joi.array().items(
    Joi.string().valid('objects', 'faces', 'text', 'labels', 'safe_search')
  ).default(['objects']).optional()
}).or('imageUrl', 'imageBase64');

const recommendationSchema = Joi.object({
  userId: Joi.string().uuid().optional(),
  contentType: Joi.string().valid('blog', 'challenge', 'project').required(),
  preferences: Joi.object({
    difficulty: Joi.string().valid('easy', 'medium', 'hard', 'expert').optional(),
    category: Joi.string().optional(),
    tags: Joi.array().items(Joi.string()).optional()
  }).optional(),
  limit: Joi.number().min(1).max(50).default(10).optional()
});

const chatSchema = Joi.object({
  message: Joi.string().min(1).max(2000).required(),
  context: Joi.object({
    conversationId: Joi.string().optional(),
    previousMessages: Joi.array().items(Joi.object({
      role: Joi.string().valid('user', 'assistant').required(),
      content: Joi.string().required()
    })).max(10).optional()
  }).optional(),
  model: Joi.string().valid('gpt-3.5-turbo', 'gpt-4', 'claude-3').default('gpt-3.5-turbo').optional()
});

/**
 * @swagger
 * /api/ml/text/analyze:
 *   post:
 *     summary: Analyze text for sentiment, keywords, and other features
 *     tags: [ML]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 10000
 *               language:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 2
 *                 default: en
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [sentiment, keywords, entities, summary, toxicity]
 *                 default: [sentiment]
 *     responses:
 *       200:
 *         description: Text analysis completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sentiment:
 *                   type: object
 *                   properties:
 *                     score:
 *                       type: number
 *                       minimum: -1
 *                       maximum: 1
 *                     label:
 *                       type: string
 *                       enum: [positive, negative, neutral]
 *                     confidence:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 1
 *                 keywords:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       word:
 *                         type: string
 *                       score:
 *                         type: number
 *                 entities:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       text:
 *                         type: string
 *                       type:
 *                         type: string
 *                       confidence:
 *                         type: number
 *                 summary:
 *                   type: string
 *                 toxicity:
 *                   type: object
 *                   properties:
 *                     score:
 *                       type: number
 *                     isToxic:
 *                       type: boolean
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 *       503:
 *         description: ML service unavailable
 */
router.post('/text/analyze', rateLimiter.ml, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = textAnalysisSchema.validate(req.body);
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    const response = await mlService.post('/text/analyze', value);
    res.json(response.data);
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      next(createError('ML service unavailable', 503));
    } else if (error.response?.status) {
      next(createError(error.response.data?.message || 'ML service error', error.response.status));
    } else {
      next(error);
    }
  }
});

/**
 * @swagger
 * /api/ml/code/analyze:
 *   post:
 *     summary: Analyze code for complexity, quality, and security issues
 *     tags: [ML]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - language
 *             properties:
 *               code:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50000
 *               language:
 *                 type: string
 *                 enum: [python, javascript, java, cpp, go, rust, typescript]
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [complexity, quality, security, suggestions, bugs]
 *                 default: [complexity, quality]
 *     responses:
 *       200:
 *         description: Code analysis completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 complexity:
 *                   type: object
 *                   properties:
 *                     cyclomaticComplexity:
 *                       type: number
 *                     linesOfCode:
 *                       type: number
 *                     maintainabilityIndex:
 *                       type: number
 *                 quality:
 *                   type: object
 *                   properties:
 *                     score:
 *                       type: number
 *                     issues:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                           message:
 *                             type: string
 *                           line:
 *                             type: number
 *                           severity:
 *                             type: string
 *                 security:
 *                   type: object
 *                   properties:
 *                     vulnerabilities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                           description:
 *                             type: string
 *                           severity:
 *                             type: string
 *                           line:
 *                             type: number
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       message:
 *                         type: string
 *                       type:
 *                         type: string
 *                       line:
 *                         type: number
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 *       503:
 *         description: ML service unavailable
 */
router.post('/code/analyze', rateLimiter.ml, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = codeAnalysisSchema.validate(req.body);
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    const response = await mlService.post('/code/analyze', value);
    res.json(response.data);
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      next(createError('ML service unavailable', 503));
    } else if (error.response?.status) {
      next(createError(error.response.data?.message || 'ML service error', error.response.status));
    } else {
      next(error);
    }
  }
});

/**
 * @swagger
 * /api/ml/image/analyze:
 *   post:
 *     summary: Analyze images for objects, text, and other features
 *     tags: [ML]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *               imageBase64:
 *                 type: string
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [objects, faces, text, labels, safe_search]
 *                 default: [objects]
 *             oneOf:
 *               - required: [imageUrl]
 *               - required: [imageBase64]
 *     responses:
 *       200:
 *         description: Image analysis completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 objects:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       confidence:
 *                         type: number
 *                       boundingBox:
 *                         type: object
 *                 faces:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       confidence:
 *                         type: number
 *                       emotions:
 *                         type: object
 *                       ageRange:
 *                         type: object
 *                 text:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       text:
 *                         type: string
 *                       confidence:
 *                         type: number
 *                 labels:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       confidence:
 *                         type: number
 *                 safeSearch:
 *                   type: object
 *                   properties:
 *                     adult:
 *                       type: string
 *                     violence:
 *                       type: string
 *                     racy:
 *                       type: string
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 *       503:
 *         description: ML service unavailable
 */
router.post('/image/analyze', rateLimiter.ml, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = imageAnalysisSchema.validate(req.body);
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    const response = await mlService.post('/image/analyze', value);
    res.json(response.data);
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      next(createError('ML service unavailable', 503));
    } else if (error.response?.status) {
      next(createError(error.response.data?.message || 'ML service error', error.response.status));
    } else {
      next(error);
    }
  }
});

/**
 * @swagger
 * /api/ml/recommendations:
 *   post:
 *     summary: Get personalized content recommendations
 *     tags: [ML]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contentType
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *               contentType:
 *                 type: string
 *                 enum: [blog, challenge, project]
 *               preferences:
 *                 type: object
 *                 properties:
 *                   difficulty:
 *                     type: string
 *                     enum: [easy, medium, hard, expert]
 *                   category:
 *                     type: string
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: string
 *               limit:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 50
 *                 default: 10
 *     responses:
 *       200:
 *         description: Recommendations generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recommendations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       score:
 *                         type: number
 *                       reason:
 *                         type: string
 *                 algorithm:
 *                   type: string
 *                 generatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 *       503:
 *         description: ML service unavailable
 */
router.post('/recommendations', rateLimiter.ml, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = recommendationSchema.validate(req.body);
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    // Add user context if authenticated
    if ((req as any).user && !value.userId) {
      value.userId = (req as any).user.id;
    }

    const response = await mlService.post('/recommendations', value);
    res.json(response.data);
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      next(createError('ML service unavailable', 503));
    } else if (error.response?.status) {
      next(createError(error.response.data?.message || 'ML service error', error.response.status));
    } else {
      next(error);
    }
  }
});

/**
 * @swagger
 * /api/ml/chat:
 *   post:
 *     summary: Chat with AI assistant
 *     tags: [ML]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *               context:
 *                 type: object
 *                 properties:
 *                   conversationId:
 *                     type: string
 *                   previousMessages:
 *                     type: array
 *                     maxItems: 10
 *                     items:
 *                       type: object
 *                       properties:
 *                         role:
 *                           type: string
 *                           enum: [user, assistant]
 *                         content:
 *                           type: string
 *               model:
 *                 type: string
 *                 enum: [gpt-3.5-turbo, gpt-4, claude-3]
 *                 default: gpt-3.5-turbo
 *     responses:
 *       200:
 *         description: Chat response generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 response:
 *                   type: string
 *                 conversationId:
 *                   type: string
 *                 model:
 *                   type: string
 *                 usage:
 *                   type: object
 *                   properties:
 *                     promptTokens:
 *                       type: number
 *                     completionTokens:
 *                       type: number
 *                     totalTokens:
 *                       type: number
 *                 generatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 *       503:
 *         description: ML service unavailable
 */
router.post('/chat', rateLimiter.ml, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = chatSchema.validate(req.body);
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    // Add user context
    const requestData = {
      ...value,
      user: (req as any).user ? {
        id: (req as any).user.id,
        username: (req as any).user.username
      } : null
    };

    const response = await mlService.post('/chat', requestData);
    res.json(response.data);
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      next(createError('ML service unavailable', 503));
    } else if (error.response?.status) {
      next(createError(error.response.data?.message || 'ML service error', error.response.status));
    } else {
      next(error);
    }
  }
});

/**
 * @swagger
 * /api/ml/health:
 *   get:
 *     summary: Check ML service health
 *     tags: [ML]
 *     responses:
 *       200:
 *         description: ML service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, degraded]
 *                 version:
 *                   type: string
 *                 models:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       status:
 *                         type: string
 *                       version:
 *                         type: string
 *                 uptime:
 *                   type: number
 *       503:
 *         description: ML service unavailable
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await mlService.get('/health');
    res.json(response.data);
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      res.status(503).json({
        status: 'unavailable',
        message: 'ML service is not responding'
      });
    } else {
      next(error);
    }
  }
});

/**
 * @swagger
 * /api/ml/models:
 *   get:
 *     summary: Get available ML models (admin only)
 *     tags: [ML]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available models retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 models:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       type:
 *                         type: string
 *                       version:
 *                         type: string
 *                       status:
 *                         type: string
 *                       capabilities:
 *                         type: array
 *                         items:
 *                           type: string
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       503:
 *         description: ML service unavailable
 */
router.get('/models', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const response = await mlService.get('/models');
    res.json(response.data);
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      next(createError('ML service unavailable', 503));
    } else if (error.response?.status) {
      next(createError(error.response.data?.message || 'ML service error', error.response.status));
    } else {
      next(error);
    }
  }
});

/**
 * @swagger
 * /api/ml/usage:
 *   get:
 *     summary: Get ML service usage statistics (admin only)
 *     tags: [ML]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Usage statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalRequests:
 *                   type: integer
 *                 totalTokens:
 *                   type: integer
 *                 requestsByModel:
 *                   type: object
 *                 requestsByUser:
 *                   type: object
 *                 requestsByEndpoint:
 *                   type: object
 *                 costs:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     byModel:
 *                       type: object
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       503:
 *         description: ML service unavailable
 */
router.get('/usage', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, userId } = req.query;
    
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (userId) params.userId = userId;

    const response = await mlService.get('/usage', { params });
    res.json(response.data);
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      next(createError('ML service unavailable', 503));
    } else if (error.response?.status) {
      next(createError(error.response.data?.message || 'ML service error', error.response.status));
    } else {
      next(error);
    }
  }
});

export default router;