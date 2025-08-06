import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { CommentModel, CreateCommentData, UpdateCommentData } from '../models/Comment';
import { BlogPostModel } from '../models/BlogPost';
import { authenticate, authorize, optionalAuth, AuthRequest } from '../middleware/auth';
import { createError, asyncHandler, createSuccessResponse } from '../middleware/errorHandler';
import { rateLimiter } from '../middleware/rateLimiter';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { marked } from 'marked';

const router = Router();

// Setup DOMPurify
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Validation schemas
const createCommentSchema = Joi.object({
  postId: Joi.string().uuid().required(),
  parentId: Joi.string().uuid().optional(),
  content: Joi.string().min(1).max(5000).required(),
  authorName: Joi.string().max(100).optional(),
  authorEmail: Joi.string().email().optional(),
  authorWebsite: Joi.string().uri().optional()
});

const updateCommentSchema = Joi.object({
  content: Joi.string().min(1).max(5000).optional(),
  status: Joi.string().valid('pending', 'approved', 'rejected', 'spam').optional()
});

// Helper function to render markdown and sanitize HTML
function renderAndSanitizeContent(content: string): string {
  const rendered = marked(content);
  return purify.sanitize(rendered, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    ALLOW_DATA_ATTR: false
  });
}

/**
 * @swagger
 * /api/comments:
 *   get:
 *     summary: Get comments for a post
 *     tags: [Comments]
 *     parameters:
 *       - in: query
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: parentId
 *         schema:
 *           type: string
 *           format: uuid
 *           nullable: true
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
 *         name: orderBy
 *         schema:
 *           type: string
 *           enum: [createdAt, likeCount]
 *           default: createdAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: includeReplies
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 comments:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Comment'
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
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const postId = req.query.postId as string;
  if (!postId) {
    throw createError('postId is required', 400, undefined, 'MISSING_POST_ID');
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = (page - 1) * limit;

  const options = {
    postId,
    parentId: req.query.parentId === 'null' ? null : req.query.parentId as string,
    status: 'approved',
    limit,
    offset,
    orderBy: (req.query.orderBy as 'createdAt' | 'likeCount') || 'createdAt',
    order: (req.query.order as 'asc' | 'desc') || 'desc',
    includeReplies: req.query.includeReplies === 'true'
  };

  const { comments, total } = await CommentModel.findAll(options);

  const response = createSuccessResponse(
    { comments },
    undefined,
    {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  );

  res.json(response);
}));

/**
 * @swagger
 * /api/comments/{id}:
 *   get:
 *     summary: Get a single comment
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: includeReplies
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Comment retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       404:
 *         description: Comment not found
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const includeReplies = req.query.includeReplies === 'true';

    const comment = await CommentModel.findById(id, includeReplies);

    if (!comment) {
      throw createError('Comment not found', 404);
    }

    res.json(comment);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Create a new comment
 *     tags: [Comments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *               - content
 *             properties:
 *               postId:
 *                 type: string
 *                 format: uuid
 *               parentId:
 *                 type: string
 *                 format: uuid
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *               authorName:
 *                 type: string
 *                 maxLength: 100
 *               authorEmail:
 *                 type: string
 *                 format: email
 *               authorWebsite:
 *                 type: string
 *                 format: uri
 *     responses:
 *       201:
 *         description: Comment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Post not found
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/', rateLimiter.comment, optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { error, value } = createCommentSchema.validate(req.body);
  if (error) {
    throw createError('Validation failed', 400, error.details.map(d => d.message), 'VALIDATION_ERROR');
  }

  // Check if post exists and is published
  const post = await BlogPostModel.findById(value.postId);
  if (!post) {
    throw createError('Post not found', 404, undefined, 'POST_NOT_FOUND');
  }
  
  if (post.status !== 'published') {
    throw createError('Cannot comment on unpublished post', 400, undefined, 'POST_NOT_PUBLISHED');
  }

  // For guest comments, require name and email
  if (!req.user && (!value.authorName || !value.authorEmail)) {
    throw createError('Guest comments require authorName and authorEmail', 400, undefined, 'GUEST_INFO_REQUIRED');
  }

  const commentData: CreateCommentData = {
    postId: value.postId,
    parentId: value.parentId,
    content: value.content,
    contentHtml: renderAndSanitizeContent(value.content),
    userId: req.user?.id,
    authorName: req.user ? req.user.username : value.authorName,
    authorEmail: req.user ? req.user.email : value.authorEmail,
    authorWebsite: value.authorWebsite,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  };

  const comment = await CommentModel.create(commentData);

  // Load author info if logged in
  if (req.user) {
    comment.author = {
      id: req.user.id,
      username: req.user.username,
      avatarUrl: req.user.avatarUrl
    };
  }

  const response = createSuccessResponse(comment, 'Comment created successfully');
  res.status(201).json(response);
}));

/**
 * @swagger
 * /api/comments/{id}:
 *   put:
 *     summary: Update a comment
 *     tags: [Comments]
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
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Comment not found
 */
router.put('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { error, value } = updateCommentSchema.validate(req.body);

    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    // Get existing comment
    const existingComment = await CommentModel.findById(id);
    if (!existingComment) {
      throw createError('Comment not found', 404);
    }

    // Check permissions - users can only edit their own comments
    if (req.user!.role !== 'admin' && existingComment.userId !== req.user!.id) {
      throw createError('You can only edit your own comments', 403);
    }

    // Don't allow status updates for non-admin users
    if (value.status && req.user!.role !== 'admin') {
      throw createError('Only admins can change comment status', 403);
    }

    const updateData: UpdateCommentData = {};
    
    if (value.content) {
      updateData.content = value.content;
      updateData.contentHtml = renderAndSanitizeContent(value.content);
    }
    
    if (value.status) {
      updateData.status = value.status;
    }

    const updatedComment = await CommentModel.update(id, updateData);

    if (!updatedComment) {
      throw createError('Comment not found', 404);
    }

    res.json(updatedComment);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/comments/{id}:
 *   delete:
 *     summary: Delete a comment
 *     tags: [Comments]
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
 *         description: Comment deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Comment not found
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get existing comment
    const existingComment = await CommentModel.findById(id);
    if (!existingComment) {
      throw createError('Comment not found', 404);
    }

    // Check permissions - users can only delete their own comments
    if (req.user!.role !== 'admin' && existingComment.userId !== req.user!.id) {
      throw createError('You can only delete your own comments', 403);
    }

    const deleted = await CommentModel.delete(id);

    if (!deleted) {
      throw createError('Comment not found', 404);
    }

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/comments/{id}/moderate:
 *   post:
 *     summary: Moderate a comment (admin only)
 *     tags: [Comments]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected, spam]
 *     responses:
 *       200:
 *         description: Comment moderated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Comment not found
 */
router.post('/:id/moderate', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected', 'spam'].includes(status)) {
      throw createError('Invalid status', 400);
    }

    const comment = await CommentModel.moderate(id, status, req.user!.id);

    if (!comment) {
      throw createError('Comment not found', 404);
    }

    res.json(comment);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/comments/{id}/like:
 *   post:
 *     summary: Like a comment
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Comment liked successfully
 *       404:
 *         description: Comment not found
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/:id/like', rateLimiter.like, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const comment = await CommentModel.findById(id);
    if (!comment) {
      throw createError('Comment not found', 404);
    }

    await CommentModel.incrementLikeCount(id);

    res.json({ message: 'Comment liked successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/comments/stats/{postId}:
 *   get:
 *     summary: Get comment statistics for a post
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Comment statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 approved:
 *                   type: integer
 *                 pending:
 *                   type: integer
 *                 rejected:
 *                   type: integer
 *                 spam:
 *                   type: integer
 */
router.get('/stats/:postId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { postId } = req.params;

    const stats = await CommentModel.getCommentStats(postId);

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;