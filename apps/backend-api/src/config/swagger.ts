import { Application } from 'express';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Portfolio Backend API',
      version: '1.0.0',
      description: 'Comprehensive REST API for portfolio website with blog, challenges, and analytics',
      contact: {
        name: 'API Support',
        url: 'https://your-portfolio.com/contact',
        email: 'support@your-portfolio.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:3001',
        description: 'Development server'
      },
      {
        url: 'https://api.your-portfolio.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            requestId: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            details: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            bio: { type: 'string' },
            avatarUrl: { type: 'string', format: 'uri' },
            role: { type: 'string', enum: ['admin', 'editor', 'user'] },
            isActive: { type: 'boolean' },
            emailVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        BlogPost: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            slug: { type: 'string' },
            excerpt: { type: 'string' },
            content: { type: 'string' },
            contentHtml: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'published', 'archived'] },
            visibility: { type: 'string', enum: ['public', 'private', 'unlisted'] },
            featured: { type: 'boolean' },
            featuredImageUrl: { type: 'string', format: 'uri' },
            readingTimeMinutes: { type: 'integer' },
            viewCount: { type: 'integer' },
            likeCount: { type: 'integer' },
            commentCount: { type: 'integer' },
            publishedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            author: { $ref: '#/components/schemas/User' },
            tags: {
              type: 'array',
              items: { $ref: '#/components/schemas/BlogTag' }
            }
          }
        },
        BlogTag: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
            color: { type: 'string' },
            postCount: { type: 'integer' }
          }
        },
        Comment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            content: { type: 'string' },
            contentHtml: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'spam'] },
            isGuest: { type: 'boolean' },
            authorName: { type: 'string' },
            authorEmail: { type: 'string', format: 'email' },
            likeCount: { type: 'integer' },
            replyCount: { type: 'integer' },
            depth: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            user: { $ref: '#/components/schemas/User' },
            replies: {
              type: 'array',
              items: { $ref: '#/components/schemas/Comment' }
            }
          }
        },
        Challenge: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
            problemStatement: { type: 'string' },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard', 'expert'] },
            category: { type: 'string' },
            tags: { type: 'string' },
            timeLimitMs: { type: 'integer' },
            memoryLimitMb: { type: 'integer' },
            submissionCount: { type: 'integer' },
            solvedCount: { type: 'integer' },
            successRate: { type: 'number', format: 'float' },
            isActive: { type: 'boolean' },
            isFeatured: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Blog', description: 'Blog management endpoints' },
      { name: 'Comments', description: 'Comment system endpoints' },
      { name: 'Contact', description: 'Contact form endpoints' },
      { name: 'Challenges', description: 'Coding challenges endpoints' },
      { name: 'GitHub', description: 'GitHub integration endpoints' },
      { name: 'Analytics', description: 'Analytics and tracking endpoints' },
      { name: 'ML', description: 'Machine learning service endpoints' },
      { name: 'Admin', description: 'Administrative endpoints' }
    ]
  },
  apis: ['./src/routes/*.ts', './src/routes/**/*.ts'], // Path to the API files
};

const specs = swaggerJSDoc(options);

export const setupSwagger = (app: Application): void => {
  // Swagger UI setup
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Portfolio API Documentation',
    customfavIcon: '/favicon.ico'
  }));

  // JSON endpoint for the spec
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};