import { Application } from 'express';
import express from 'express';
import session from 'express-session';
import connectRedis from 'connect-redis';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

import { getRedis } from '../config/database';
import { requestLogger } from './requestLogger';
import { rateLimiter } from './rateLimiter';
import { securityHeaders } from './security';
import { analyticsMiddleware } from './analytics';

export const setupMiddleware = (app: Application): void => {
  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Session middleware (if Redis is available)
  const redis = getRedis();
  if (redis) {
    const RedisStore = connectRedis(session);
    app.use(session({
      store: new RedisStore({ client: redis }),
      secret: process.env.SESSION_SECRET || 'your-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    }));
  }

  // Rate limiting
  app.use('/api/', rateLimiter.global);
  
  // Specific rate limits for sensitive endpoints
  app.use('/api/auth/login', rateLimiter.auth);
  app.use('/api/auth/register', rateLimiter.auth);
  app.use('/api/contact', rateLimiter.contact);
  app.use('/api/challenges/submit', rateLimiter.submission);

  // Speed limiting for API abuse prevention
  app.use('/api/', slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 100, // Allow 100 requests per windowMs without delay
    delayMs: 500 // Add 500ms delay per request after delayAfter
  }));

  // Security headers
  app.use(securityHeaders);

  // Request logging and analytics
  app.use(requestLogger);
  app.use('/api/', analyticsMiddleware);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  });
};