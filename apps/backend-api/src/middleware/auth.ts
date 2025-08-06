import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel, User } from '../models/User';
import { createError } from './errorHandler';
import { authConfig } from '../config/auth';
import { tokenBlacklist } from '../services/tokenBlacklist';

export interface AuthRequest extends Request {
  user?: User;
  userId?: string;
}

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Deprecated: Use authConfig instead
export const JWT_SECRET = authConfig.jwt.accessToken.secret;
export const JWT_EXPIRES_IN = authConfig.jwt.accessToken.options.expiresIn;
export const REFRESH_TOKEN_EXPIRES_IN = authConfig.jwt.refreshToken.options.expiresIn;

export const generateTokens = (user: User) => {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role
  };

  const accessToken = jwt.sign(
    payload, 
    authConfig.jwt.accessToken.secret, 
    authConfig.jwt.accessToken.options
  );

  const refreshToken = jwt.sign(
    payload, 
    authConfig.jwt.refreshToken.secret, 
    authConfig.jwt.refreshToken.options
  );

  return { accessToken, refreshToken };
};

export const verifyToken = async (token: string, isRefreshToken = false): Promise<JWTPayload> => {
  try {
    // Check if token is blacklisted
    const isBlacklisted = await tokenBlacklist.isBlacklisted(token);
    if (isBlacklisted) {
      throw createError('Token has been revoked', 401);
    }

    const secret = isRefreshToken 
      ? authConfig.jwt.refreshToken.secret 
      : authConfig.jwt.accessToken.secret;

    const payload = jwt.verify(token, secret, authConfig.jwt.verifyOptions) as JWTPayload;

    // Check if user's tokens have been invalidated
    if (payload.iat && await tokenBlacklist.isUserTokenInvalid(payload.userId, payload.iat)) {
      throw createError('Token has been invalidated', 401);
    }

    return payload;
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      throw createError('Invalid token', 401);
    } else if (error.name === 'TokenExpiredError') {
      throw createError('Token expired', 401);
    }
    throw error;
  }
};

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw createError('Access token required', 401);
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      throw createError('Access token required', 401);
    }

    const payload = await verifyToken(token);
    const user = await UserModel.findById(payload.userId);

    if (!user) {
      throw createError('User not found', 401);
    }

    if (!user.isActive) {
      throw createError('Account is deactivated', 401);
    }

    // Check if account is locked
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      throw createError('Account is temporarily locked', 401);
    }

    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(createError('Insufficient permissions', 403));
    }

    next();
  };
};

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return next();
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return next();
    }

    try {
      const payload = await verifyToken(token);
      const user = await UserModel.findById(payload.userId);

      if (user && user.isActive && (!user.lockedUntil || new Date() >= user.lockedUntil)) {
        req.user = user;
        req.userId = user.id;
      }
    } catch (error) {
      // Ignore token errors for optional auth
    }

    next();
  } catch (error) {
    next();
  }
};

export const requireEmailVerification = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(createError('Authentication required', 401));
  }

  if (!req.user.emailVerified) {
    return next(createError('Email verification required', 403));
  }

  next();
};

export const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return next(createError('API key required', 401));
  }

  const validApiKeys = process.env.API_KEYS?.split(',') || [];
  
  if (!validApiKeys.includes(apiKey)) {
    return next(createError('Invalid API key', 401));
  }

  next();
};

// Middleware to check if user owns resource or is admin
export const ownerOrAdmin = (resourceUserField = 'userId') => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    const resourceUserId = req.body[resourceUserField] || req.params[resourceUserField];
    
    if (req.user.role === 'admin' || req.user.id === resourceUserId) {
      return next();
    }

    return next(createError('Access denied', 403));
  };
};