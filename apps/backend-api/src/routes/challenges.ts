import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { CodingChallengeModel, CreateChallengeData, UpdateChallengeData } from '../models/CodingChallenge';
import { authenticate, authorize, optionalAuth, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { rateLimiter } from '../middleware/rateLimiter';
import axios from 'axios';

const router = Router();

// Validation schemas
const createChallengeSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  slug: Joi.string().min(1).max(255).optional(),
  description: Joi.string().min(1).required(),
  problemStatement: Joi.string().min(1).required(),
  difficulty: Joi.string().valid('easy', 'medium', 'hard', 'expert').required(),
  category: Joi.string().min(1).max(50).required(),
  tags: Joi.string().max(500).optional(),
  inputFormat: Joi.string().optional(),
  outputFormat: Joi.string().optional(),
  constraints: Joi.string().optional(),
  sampleInput: Joi.string().optional(),
  sampleOutput: Joi.string().optional(),
  explanation: Joi.string().optional(),
  hints: Joi.array().items(Joi.string()).max(5).optional(),
  timeLimitMs: Joi.number().min(100).max(30000).optional(),
  memoryLimitMb: Joi.number().min(16).max(1024).optional(),
  isActive: Joi.boolean().optional(),
  isFeatured: Joi.boolean().optional()
});

const updateChallengeSchema = createChallengeSchema.fork(
  ['title', 'description', 'problemStatement', 'difficulty', 'category'],
  (schema) => schema.optional()
);

const testCaseSchema = Joi.object({
  inputData: Joi.string().required(),
  expectedOutput: Joi.string().required(),
  isSample: Joi.boolean().default(false),
  isHidden: Joi.boolean().default(true),
  weight: Joi.number().min(0).max(10).default(1.0),
  explanation: Joi.string().optional()
});

const submissionSchema = Joi.object({
  language: Joi.string().valid('python', 'javascript', 'java', 'cpp', 'c', 'go', 'rust', 'typescript').required(),
  code: Joi.string().min(1).max(100000).required()
});

/**
 * @swagger
 * /api/challenges:
 *   get:
 *     summary: Get all coding challenges
 *     tags: [Challenges]
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
 *           default: 20
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [easy, medium, hard, expert]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: isFeatured
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *           enum: [createdAt, difficulty, submissionCount, successRate]
 *           default: createdAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Challenges retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 challenges:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CodingChallenge'
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
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const options = {
      limit,
      offset,
      difficulty: req.query.difficulty as string,
      category: req.query.category as string,
      tag: req.query.tag as string,
      search: req.query.search as string,
      isActive: true,
      isFeatured: req.query.isFeatured === 'true' ? true : undefined,
      orderBy: (req.query.orderBy as any) || 'createdAt',
      order: (req.query.order as 'asc' | 'desc') || 'desc'
    };

    const { challenges, total } = await CodingChallengeModel.findAll(options);

    res.json({
      challenges,
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
 * /api/challenges/categories:
 *   get:
 *     summary: Get all challenge categories
 *     tags: [Challenges]
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 categories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       category:
 *                         type: string
 *                       count:
 *                         type: integer
 */
router.get('/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await CodingChallengeModel.getCategories();
    res.json({ categories });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/challenges/{slug}:
 *   get:
 *     summary: Get a challenge by slug
 *     tags: [Challenges]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Challenge retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 challenge:
 *                   $ref: '#/components/schemas/CodingChallenge'
 *                 testCases:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TestCase'
 *       404:
 *         description: Challenge not found
 */
router.get('/:slug', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;

    const challenge = await CodingChallengeModel.findBySlug(slug);

    if (!challenge || (!challenge.isActive && (!req.user || req.user.role !== 'admin'))) {
      throw createError('Challenge not found', 404);
    }

    // Get sample test cases (visible to all)
    const testCases = await CodingChallengeModel.getTestCases(challenge.id, false);

    res.json({
      challenge,
      testCases: testCases.filter(tc => tc.isSample)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/challenges:
 *   post:
 *     summary: Create a new challenge (admin only)
 *     tags: [Challenges]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - problemStatement
 *               - difficulty
 *               - category
 *             properties:
 *               title:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               problemStatement:
 *                 type: string
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard, expert]
 *               category:
 *                 type: string
 *               tags:
 *                 type: string
 *               inputFormat:
 *                 type: string
 *               outputFormat:
 *                 type: string
 *               constraints:
 *                 type: string
 *               sampleInput:
 *                 type: string
 *               sampleOutput:
 *                 type: string
 *               explanation:
 *                 type: string
 *               hints:
 *                 type: array
 *                 items:
 *                   type: string
 *               timeLimitMs:
 *                 type: integer
 *               memoryLimitMb:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *               isFeatured:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Challenge created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.post('/', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createChallengeSchema.validate(req.body);
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    const challenge = await CodingChallengeModel.create(req.user!.id, value as CreateChallengeData);

    res.status(201).json(challenge);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/challenges/{id}:
 *   put:
 *     summary: Update a challenge (admin only)
 *     tags: [Challenges]
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
 *             $ref: '#/components/schemas/UpdateChallenge'
 *     responses:
 *       200:
 *         description: Challenge updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Challenge not found
 */
router.put('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { error, value } = updateChallengeSchema.validate(req.body);

    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    const updatedChallenge = await CodingChallengeModel.update(id, value as UpdateChallengeData);

    if (!updatedChallenge) {
      throw createError('Challenge not found', 404);
    }

    res.json(updatedChallenge);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/challenges/{id}:
 *   delete:
 *     summary: Delete a challenge (admin only)
 *     tags: [Challenges]
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
 *         description: Challenge deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Challenge not found
 */
router.delete('/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const deleted = await CodingChallengeModel.delete(id);

    if (!deleted) {
      throw createError('Challenge not found', 404);
    }

    res.json({ message: 'Challenge deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/challenges/{id}/test-cases:
 *   post:
 *     summary: Add a test case to a challenge (admin only)
 *     tags: [Challenges]
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
 *             required:
 *               - inputData
 *               - expectedOutput
 *             properties:
 *               inputData:
 *                 type: string
 *               expectedOutput:
 *                 type: string
 *               isSample:
 *                 type: boolean
 *               isHidden:
 *                 type: boolean
 *               weight:
 *                 type: number
 *               explanation:
 *                 type: string
 *     responses:
 *       201:
 *         description: Test case added successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Challenge not found
 */
router.post('/:id/test-cases', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { error, value } = testCaseSchema.validate(req.body);

    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    // Check if challenge exists
    const challenge = await CodingChallengeModel.findById(id);
    if (!challenge) {
      throw createError('Challenge not found', 404);
    }

    const testCase = await CodingChallengeModel.addTestCase(id, value);

    res.status(201).json(testCase);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/challenges/{id}/test-cases:
 *   get:
 *     summary: Get test cases for a challenge (admin only)
 *     tags: [Challenges]
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
 *         description: Test cases retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 testCases:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TestCase'
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Challenge not found
 */
router.get('/:id/test-cases', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const testCases = await CodingChallengeModel.getTestCases(id, true);

    res.json({ testCases });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/challenges/{id}/submit:
 *   post:
 *     summary: Submit a solution for a challenge
 *     tags: [Challenges]
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
 *             required:
 *               - language
 *               - code
 *             properties:
 *               language:
 *                 type: string
 *                 enum: [python, javascript, java, cpp, c, go, rust, typescript]
 *               code:
 *                 type: string
 *     responses:
 *       201:
 *         description: Submission created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 submissionId:
 *                   type: string
 *                   format: uuid
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       404:
 *         description: Challenge not found
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/:id/submit', rateLimiter.submission, optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { error, value } = submissionSchema.validate(req.body);

    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    // Check if challenge exists and is active
    const challenge = await CodingChallengeModel.findById(id);
    if (!challenge || !challenge.isActive) {
      throw createError('Challenge not found', 404);
    }

    const submission = await CodingChallengeModel.createSubmission({
      challengeId: id,
      userId: req.user?.id,
      language: value.language,
      code: value.code,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Queue submission for judging
    // In a real implementation, this would send to a message queue
    // For now, we'll simulate with a delayed execution
    setImmediate(async () => {
      try {
        await judgeSubmission(submission.id);
      } catch (error) {
        console.error('Failed to judge submission:', error);
      }
    });

    res.status(201).json({
      submissionId: submission.id,
      message: 'Submission received and queued for judging'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/challenges/{id}/submissions:
 *   get:
 *     summary: Get user's submissions for a challenge
 *     tags: [Challenges]
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
 *         description: Submissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 submissions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ChallengeSubmission'
 *       401:
 *         description: Authentication required
 */
router.get('/:id/submissions', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const submissions = await CodingChallengeModel.getUserSubmissions(req.user!.id, id);

    res.json({ submissions });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/challenges/{id}/submission/{submissionId}:
 *   get:
 *     summary: Get submission details
 *     tags: [Challenges]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Submission retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChallengeSubmission'
 *       404:
 *         description: Submission not found
 */
router.get('/:id/submission/:submissionId', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, submissionId } = req.params;

    const submission = await CodingChallengeModel.getSubmission(submissionId);

    if (!submission || submission.challengeId !== id) {
      throw createError('Submission not found', 404);
    }

    // Check permissions - users can only see their own submissions unless admin
    if (!req.user || (submission.userId !== req.user.id && req.user.role !== 'admin')) {
      // Remove code from response for other users
      const { code, ...publicSubmission } = submission;
      res.json(publicSubmission);
    } else {
      res.json(submission);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/challenges/{id}/leaderboard:
 *   get:
 *     summary: Get challenge leaderboard
 *     tags: [Challenges]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: Leaderboard retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leaderboard:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       username:
 *                         type: string
 *                       bestScore:
 *                         type: number
 *                       bestTime:
 *                         type: number
 *                       submissions:
 *                         type: integer
 */
router.get('/:id/leaderboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

    const leaderboard = await CodingChallengeModel.getLeaderboard(id, limit);

    res.json({ leaderboard });
  } catch (error) {
    next(error);
  }
});

// Helper function to simulate judging (in production, this would be a separate service)
async function judgeSubmission(submissionId: string) {
  const submission = await CodingChallengeModel.getSubmission(submissionId);
  if (!submission) return;

  // Update status to running
  await CodingChallengeModel.updateSubmissionStatus(submissionId, 'running');

  // Get test cases
  const testCases = await CodingChallengeModel.getTestCases(submission.challengeId, true);

  // In a real implementation, this would execute code in a sandbox
  // For now, we'll simulate with random results
  const results = {
    score: Math.random() * 100,
    executionTimeMs: Math.floor(Math.random() * 1000),
    memoryUsedMb: Math.random() * 100,
    testCasesPassed: Math.floor(Math.random() * testCases.length),
    testCasesTotal: testCases.length
  };

  const status = results.testCasesPassed === results.testCasesTotal ? 'accepted' : 'wrong_answer';

  await CodingChallengeModel.updateSubmissionStatus(submissionId, status, results);
}

export default router;