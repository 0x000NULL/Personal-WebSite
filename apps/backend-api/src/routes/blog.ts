import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { BlogPostModel, CreateBlogPostData, UpdateBlogPostData } from '../models/BlogPost';
import { authenticate, authorize, optionalAuth, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Validation schemas
const createPostSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  slug: Joi.string().min(1).max(255).optional(),
  excerpt: Joi.string().max(1000).optional(),
  content: Joi.string().min(1).required(),
  status: Joi.string().valid('draft', 'published', 'archived').default('draft'),
  visibility: Joi.string().valid('public', 'private', 'unlisted').default('public'),
  featured: Joi.boolean().default(false),
  featuredImageUrl: Joi.string().uri().optional(),
  metaTitle: Joi.string().max(255).optional(),
  metaDescription: Joi.string().max(1000).optional(),
  metaKeywords: Joi.string().max(500).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
});

const updatePostSchema = Joi.object({
  title: Joi.string().min(1).max(255).optional(),
  slug: Joi.string().min(1).max(255).optional(),
  excerpt: Joi.string().max(1000).optional(),
  content: Joi.string().min(1).optional(),
  status: Joi.string().valid('draft', 'published', 'archived').optional(),
  visibility: Joi.string().valid('public', 'private', 'unlisted').optional(),
  featured: Joi.boolean().optional(),
  featuredImageUrl: Joi.string().uri().optional(),
  metaTitle: Joi.string().max(255).optional(),
  metaDescription: Joi.string().max(1000).optional(),
  metaKeywords: Joi.string().max(500).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
});

/**
 * @swagger
 * /api/blog:
 *   get:
 *     summary: Get all blog posts
 *     tags: [Blog]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, archived]
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: author
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Blog posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 posts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BlogPost'
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
router.get('/', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const options = {
      limit,
      offset,
      status: req.query.status as string,
      featured: req.query.featured === 'true' ? true : req.query.featured === 'false' ? false : undefined,
      tag: req.query.tag as string,
      search: req.query.search as string,
      authorId: req.query.author as string,
      includeUnpublished: req.user?.role === 'admin' || req.user?.role === 'editor'
    };

    const { posts, total } = await BlogPostModel.findAll(options);

    res.json({
      posts,
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
 * /api/blog/{slug}:
 *   get:
 *     summary: Get blog post by slug
 *     tags: [Blog]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Blog post retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BlogPost'
 *       404:
 *         description: Blog post not found
 */
router.get('/:slug', optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const includeUnpublished = req.user?.role === 'admin' || req.user?.role === 'editor';
    
    const post = await BlogPostModel.findBySlug(slug, includeUnpublished);
    
    if (!post) {
      throw createError('Blog post not found', 404);
    }

    // Check if user can access private posts
    if (post.visibility === 'private' && (!req.user || (req.user.id !== post.authorId && req.user.role !== 'admin'))) {
      throw createError('Blog post not found', 404);
    }

    // Increment view count for published posts
    if (post.status === 'published' && post.visibility !== 'private') {
      setImmediate(() => {
        BlogPostModel.incrementViewCount(post.id).catch(console.error);
      });
    }

    res.json(post);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/blog:
 *   post:
 *     summary: Create a new blog post
 *     tags: [Blog]
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
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *               slug:
 *                 type: string
 *                 maxLength: 255
 *               excerpt:
 *                 type: string
 *                 maxLength: 1000
 *               content:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, published, archived]
 *                 default: draft
 *               visibility:
 *                 type: string
 *                 enum: [public, private, unlisted]
 *                 default: public
 *               featured:
 *                 type: boolean
 *                 default: false
 *               featuredImageUrl:
 *                 type: string
 *                 format: uri
 *               metaTitle:
 *                 type: string
 *                 maxLength: 255
 *               metaDescription:
 *                 type: string
 *                 maxLength: 1000
 *               metaKeywords:
 *                 type: string
 *                 maxLength: 500
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 10
 *     responses:
 *       201:
 *         description: Blog post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BlogPost'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 */
router.post('/', authenticate, authorize('admin', 'editor'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createPostSchema.validate(req.body);
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    const post = await BlogPostModel.create(req.user!.id, value as CreateBlogPostData);

    res.status(201).json(post);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/blog/{id}:
 *   put:
 *     summary: Update blog post
 *     tags: [Blog]
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
 *               title:
 *                 type: string
 *                 maxLength: 255
 *               slug:
 *                 type: string
 *                 maxLength: 255
 *               excerpt:
 *                 type: string
 *                 maxLength: 1000
 *               content:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [draft, published, archived]
 *               visibility:
 *                 type: string
 *                 enum: [public, private, unlisted]
 *               featured:
 *                 type: boolean
 *               featuredImageUrl:
 *                 type: string
 *                 format: uri
 *               metaTitle:
 *                 type: string
 *                 maxLength: 255
 *               metaDescription:
 *                 type: string
 *                 maxLength: 1000
 *               metaKeywords:
 *                 type: string
 *                 maxLength: 500
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 10
 *     responses:
 *       200:
 *         description: Blog post updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Blog post not found
 */
router.put('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { error, value } = updatePostSchema.validate(req.body);
    
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    // Check if post exists and user has permission
    const existingPost = await BlogPostModel.findById(id, true);
    if (!existingPost) {
      throw createError('Blog post not found', 404);
    }

    // Check permissions - admin can edit any post, others can only edit their own
    if (req.user!.role !== 'admin' && existingPost.authorId !== req.user!.id) {
      throw createError('You can only edit your own posts', 403);
    }

    const updatedPost = await BlogPostModel.update(id, value as UpdateBlogPostData);
    
    if (!updatedPost) {
      throw createError('Blog post not found', 404);
    }

    res.json(updatedPost);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/blog/{id}:
 *   delete:
 *     summary: Delete blog post
 *     tags: [Blog]
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
 *         description: Blog post deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Blog post not found
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Check if post exists and user has permission
    const existingPost = await BlogPostModel.findById(id, true);
    if (!existingPost) {
      throw createError('Blog post not found', 404);
    }

    // Check permissions - admin can delete any post, others can only delete their own
    if (req.user!.role !== 'admin' && existingPost.authorId !== req.user!.id) {
      throw createError('You can only delete your own posts', 403);
    }

    const deleted = await BlogPostModel.delete(id);
    
    if (!deleted) {
      throw createError('Blog post not found', 404);
    }

    res.json({ message: 'Blog post deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/blog/featured:
 *   get:
 *     summary: Get featured blog posts
 *     tags: [Blog]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 5
 *     responses:
 *       200:
 *         description: Featured posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 posts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BlogPost'
 */
router.get('/featured', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);
    
    const { posts } = await BlogPostModel.findAll({
      limit,
      featured: true,
      includeUnpublished: false
    });

    res.json({ posts });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/blog/tags:
 *   get:
 *     summary: Get all blog tags
 *     tags: [Blog]
 *     responses:
 *       200:
 *         description: Tags retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tags:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BlogTag'
 */
router.get('/tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tags = await BlogPostModel.getAllTags();
    res.json({ tags });
  } catch (error) {
    next(error);
  }
});

export default router;