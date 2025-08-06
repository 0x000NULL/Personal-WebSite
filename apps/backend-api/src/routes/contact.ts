import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ContactSubmissionModel, CreateContactSubmissionData } from '../models/ContactSubmission';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { rateLimiter } from '../middleware/rateLimiter';
import nodemailer from 'nodemailer';

const router = Router();

// Validation schemas
const createSubmissionSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().max(50).optional(),
  company: Joi.string().max(255).optional(),
  subject: Joi.string().max(255).optional(),
  message: Joi.string().min(10).max(5000).required(),
  formType: Joi.string().valid('general', 'business', 'support', 'collaboration').default('general'),
  attachments: Joi.array().items(Joi.object({
    filename: Joi.string().required(),
    size: Joi.number().required(),
    mimetype: Joi.string().required(),
    url: Joi.string().uri().required()
  })).max(5).optional(),
  customFields: Joi.object().optional()
});

const updateSubmissionSchema = Joi.object({
  status: Joi.string().valid('new', 'read', 'replied', 'resolved', 'spam', 'archived').optional(),
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent').optional(),
  assignedTo: Joi.string().uuid().optional(),
  tags: Joi.string().max(500).optional(),
  internalNotes: Joi.string().optional()
});

const replySchema = Joi.object({
  message: Joi.string().min(1).max(10000).required()
});

// Email transporter configuration (to be properly configured with env vars)
const createEmailTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    return null;
  }

  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Submit a contact form
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 255
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *                 maxLength: 50
 *               company:
 *                 type: string
 *                 maxLength: 255
 *               subject:
 *                 type: string
 *                 maxLength: 255
 *               message:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 5000
 *               formType:
 *                 type: string
 *                 enum: [general, business, support, collaboration]
 *                 default: general
 *               attachments:
 *                 type: array
 *                 maxItems: 5
 *                 items:
 *                   type: object
 *                   properties:
 *                     filename:
 *                       type: string
 *                     size:
 *                       type: number
 *                     mimetype:
 *                       type: string
 *                     url:
 *                       type: string
 *                       format: uri
 *               customFields:
 *                 type: object
 *     responses:
 *       201:
 *         description: Contact form submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 submissionId:
 *                   type: string
 *                   format: uuid
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/', rateLimiter.contact, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createSubmissionSchema.validate(req.body);
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    const submissionData: CreateContactSubmissionData = {
      ...value,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      referrerUrl: req.get('Referrer'),
      source: req.get('Origin') || 'website'
    };

    const submission = await ContactSubmissionModel.create(submissionData);

    // Send notification email to admin if not spam
    if (!submission.isSpam && process.env.CONTACT_NOTIFICATION_EMAIL) {
      const transporter = createEmailTransporter();
      if (transporter) {
        try {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@example.com',
            to: process.env.CONTACT_NOTIFICATION_EMAIL,
            subject: `New Contact Form Submission: ${submission.subject || submission.formType}`,
            html: `
              <h2>New Contact Form Submission</h2>
              <p><strong>From:</strong> ${submission.name} (${submission.email})</p>
              ${submission.phone ? `<p><strong>Phone:</strong> ${submission.phone}</p>` : ''}
              ${submission.company ? `<p><strong>Company:</strong> ${submission.company}</p>` : ''}
              <p><strong>Type:</strong> ${submission.formType}</p>
              <p><strong>Subject:</strong> ${submission.subject || 'N/A'}</p>
              <p><strong>Message:</strong></p>
              <blockquote>${submission.message.replace(/\n/g, '<br>')}</blockquote>
              <p><strong>Submitted at:</strong> ${submission.submittedAt}</p>
              <hr>
              <p><a href="${process.env.ADMIN_URL}/contact/${submission.id}">View in Admin Panel</a></p>
            `
          });
        } catch (emailError) {
          console.error('Failed to send notification email:', emailError);
        }
      }
    }

    // Send acknowledgment email to submitter
    if (!submission.isSpam && process.env.SEND_ACKNOWLEDGMENT_EMAIL === 'true') {
      const transporter = createEmailTransporter();
      if (transporter) {
        try {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || 'noreply@example.com',
            to: submission.email,
            subject: 'Thank you for contacting us',
            html: `
              <h2>Thank you for your message</h2>
              <p>Hi ${submission.name},</p>
              <p>We've received your message and will get back to you as soon as possible.</p>
              <p>For your reference, here's a copy of your message:</p>
              <blockquote>${submission.message.replace(/\n/g, '<br>')}</blockquote>
              <p>Best regards,<br>${process.env.COMPANY_NAME || 'The Team'}</p>
            `
          });
        } catch (emailError) {
          console.error('Failed to send acknowledgment email:', emailError);
        }
      }
    }

    res.status(201).json({
      message: 'Thank you for your message. We will get back to you soon.',
      submissionId: submission.id
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/contact/submissions:
 *   get:
 *     summary: Get all contact submissions (admin only)
 *     tags: [Contact]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [new, read, replied, resolved, spam, archived]
 *       - in: query
 *         name: formType
 *         schema:
 *           type: string
 *           enum: [general, business, support, collaboration]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, normal, high, urgent]
 *       - in: query
 *         name: isSpam
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
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
 *         description: Contact submissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 submissions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ContactSubmission'
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
router.get('/submissions', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    const options = {
      limit,
      offset,
      status: req.query.status as string,
      formType: req.query.formType as string,
      priority: req.query.priority as string,
      assignedTo: req.query.assignedTo as string,
      isSpam: req.query.isSpam === 'true' ? true : req.query.isSpam === 'false' ? false : undefined,
      search: req.query.search as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      orderBy: (req.query.orderBy as any) || 'submittedAt',
      order: (req.query.order as 'asc' | 'desc') || 'desc'
    };

    const { submissions, total } = await ContactSubmissionModel.findAll(options);

    res.json({
      submissions,
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
 * /api/contact/submissions/{id}:
 *   get:
 *     summary: Get a specific contact submission (admin only)
 *     tags: [Contact]
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
 *         description: Contact submission retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContactSubmission'
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Submission not found
 */
router.get('/submissions/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const submission = await ContactSubmissionModel.findById(id);

    if (!submission) {
      throw createError('Submission not found', 404);
    }

    // Mark as read if it's new
    if (submission.status === 'new') {
      await ContactSubmissionModel.markAsRead(id);
      submission.status = 'read';
    }

    res.json(submission);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/contact/submissions/{id}:
 *   put:
 *     summary: Update a contact submission (admin only)
 *     tags: [Contact]
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
 *               status:
 *                 type: string
 *                 enum: [new, read, replied, resolved, spam, archived]
 *               priority:
 *                 type: string
 *                 enum: [low, normal, high, urgent]
 *               assignedTo:
 *                 type: string
 *                 format: uuid
 *               tags:
 *                 type: string
 *                 maxLength: 500
 *               internalNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Submission updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Submission not found
 */
router.put('/submissions/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { error, value } = updateSubmissionSchema.validate(req.body);

    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    const updatedSubmission = await ContactSubmissionModel.update(id, value);

    if (!updatedSubmission) {
      throw createError('Submission not found', 404);
    }

    res.json(updatedSubmission);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/contact/submissions/{id}/reply:
 *   post:
 *     summary: Reply to a contact submission (admin only)
 *     tags: [Contact]
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
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 10000
 *     responses:
 *       200:
 *         description: Reply sent successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Submission not found
 */
router.post('/submissions/:id/reply', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { error, value } = replySchema.validate(req.body);

    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    const submission = await ContactSubmissionModel.findById(id);

    if (!submission) {
      throw createError('Submission not found', 404);
    }

    // Send reply email
    const transporter = createEmailTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@example.com',
          to: submission.email,
          subject: `Re: ${submission.subject || 'Your contact form submission'}`,
          html: `
            <p>Hi ${submission.name},</p>
            ${value.message.replace(/\n/g, '<br>')}
            <hr>
            <p><em>This is a reply to your message sent on ${submission.submittedAt}</em></p>
            <blockquote>${submission.message.replace(/\n/g, '<br>')}</blockquote>
          `
        });

        // Update submission with reply info
        const updatedSubmission = await ContactSubmissionModel.reply(id, value.message, req.user!.id);

        res.json({
          message: 'Reply sent successfully',
          submission: updatedSubmission
        });
      } catch (emailError) {
        throw createError('Failed to send reply email', 500);
      }
    } else {
      throw createError('Email service not configured', 500);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/contact/submissions/{id}:
 *   delete:
 *     summary: Delete a contact submission (admin only)
 *     tags: [Contact]
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
 *         description: Submission deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Submission not found
 */
router.delete('/submissions/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const deleted = await ContactSubmissionModel.delete(id);

    if (!deleted) {
      throw createError('Submission not found', 404);
    }

    res.json({ message: 'Submission deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/contact/stats:
 *   get:
 *     summary: Get contact form statistics (admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 new:
 *                   type: integer
 *                 read:
 *                   type: integer
 *                 replied:
 *                   type: integer
 *                 resolved:
 *                   type: integer
 *                 spam:
 *                   type: integer
 *                 urgent:
 *                   type: integer
 *                 todayCount:
 *                   type: integer
 *                 weekCount:
 *                   type: integer
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
router.get('/stats', authenticate, authorize('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await ContactSubmissionModel.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

export default router;