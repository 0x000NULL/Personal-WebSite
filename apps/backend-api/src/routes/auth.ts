import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { generateTokens, verifyToken, authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { rateLimiter } from '../middleware/rateLimiter';
import { tokenBlacklist } from '../services/tokenBlacklist';
import { authConfig } from '../config/auth';
import { securityAudit } from '../services/securityAudit';

const router = Router();

// Validation schemas
const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])')).required()
    .messages({
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
    }),
  firstName: Joi.string().max(100).optional(),
  lastName: Joi.string().max(100).optional(),
  bio: Joi.string().max(1000).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  rememberMe: Joi.boolean().optional()
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])')).required()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])')).required()
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Must contain at least one lowercase, uppercase, number, and special character
 *               firstName:
 *                 type: string
 *                 maxLength: 100
 *               lastName:
 *                 type: string
 *                 maxLength: 100
 *               bio:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(value.email);
    if (existingUser) {
      throw createError('User with this email already exists', 409);
    }

    const existingUsername = await UserModel.findByUsername(value.username);
    if (existingUsername) {
      throw createError('Username is already taken', 409);
    }

    // Create user
    const user = await UserModel.create(value);
    const tokens = generateTokens(user);

    // Remove sensitive data
    const { passwordHash, ...userResponse } = user;

    res.status(201).json({
      message: 'User registered successfully',
      user: userResponse,
      tokens
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 tokens:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    const user = await UserModel.verifyPassword(value.email, value.password);
    if (!user) {
      // Log failed login attempt
      await securityAudit.logFailedLogin(
        value.email,
        req.ip || req.socket.remoteAddress || 'unknown',
        req.headers['user-agent']
      );
      throw createError('Invalid email or password', 401);
    }

    if (!user.isActive) {
      throw createError('Account is deactivated', 401);
    }

    // Check if account is locked due to too many failed attempts
    if (user.loginAttempts >= authConfig.security.maxLoginAttempts) {
      const lockoutEnd = new Date(user.updatedAt.getTime() + authConfig.security.lockoutDuration);
      if (new Date() < lockoutEnd) {
        throw createError('Account is temporarily locked due to too many failed login attempts', 429);
      }
    }

    const tokens = generateTokens(user);
    
    // Reset failed login attempts on successful login
    await UserModel.resetFailedLoginAttempts(user.id);
    
    // Log successful login
    await securityAudit.logSuccessfulLogin(
      user.id,
      req.ip || req.socket.remoteAddress || 'unknown',
      req.headers['user-agent']
    );

    // Remove sensitive data
    const { passwordHash, ...userResponse } = user;

    res.json({
      message: 'Login successful',
      user: userResponse,
      tokens
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw createError('Refresh token required', 400);
    }

    const payload = await verifyToken(refreshToken, true);
    const user = await UserModel.findById(payload.userId);

    if (!user || !user.isActive) {
      throw createError('Invalid refresh token', 401);
    }

    const tokens = generateTokens(user);

    res.json({
      message: 'Token refreshed successfully',
      tokens
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Authentication required
 */
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { passwordHash, ...userResponse } = req.user!;
    res.json({ user: userResponse });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 */
router.post('/forgot-password', rateLimiter.auth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = forgotPasswordSchema.validate(req.body);
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    const resetToken = await UserModel.setPasswordResetToken(value.email);
    
    if (!resetToken) {
      throw createError('User not found', 404);
    }

    // TODO: Send email with reset token
    console.log(`Password reset token for ${value.email}: ${resetToken}`);

    res.json({
      message: 'Password reset instructions sent to your email'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Validation error or invalid token
 */
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = resetPasswordSchema.validate(req.body);
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    const success = await UserModel.resetPassword(value.token, value.password);
    
    if (!success) {
      throw createError('Invalid or expired reset token', 400);
    }

    res.json({
      message: 'Password reset successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Current password incorrect
 */
router.post('/change-password', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      throw createError('Validation failed', 400, error.details.map(d => d.message));
    }

    // Verify current password
    const user = await UserModel.verifyPassword(req.user!.email, value.currentPassword);
    if (!user) {
      throw createError('Current password is incorrect', 401);
    }

    // Update password using reset function (it hashes the password)
    const resetToken = await UserModel.setPasswordResetToken(req.user!.email);
    if (resetToken) {
      await UserModel.resetPassword(resetToken, value.newPassword);
    }

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Verify email address
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid token
 */
router.post('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      throw createError('Verification token required', 400);
    }

    const success = await UserModel.verifyEmail(token);
    
    if (!success) {
      throw createError('Invalid verification token', 400);
    }

    res.json({
      message: 'Email verified successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user (client-side token cleanup)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Extract token from header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (token) {
      // Calculate token remaining time
      const decoded = jwt.decode(token) as any;
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = decoded.exp ? decoded.exp - now : 0;
      
      if (expiresIn > 0) {
        await tokenBlacklist.blacklistToken(token, expiresIn);
      }
    }
    
    // Log logout event
    if (req.user) {
      await securityAudit.logLogout(
        req.user.id,
        req.ip || req.socket.remoteAddress || 'unknown'
      );
    }
    
    res.json({
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
});

export default router;