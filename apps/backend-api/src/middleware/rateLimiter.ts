import rateLimit from 'express-rate-limit';
import { getRedis } from '../config/database';

// Create rate limit store (use Redis if available, otherwise memory)
const createStore = () => {
  const redis = getRedis();
  if (redis) {
    // Use Redis store for distributed rate limiting
    const RedisStore = require('rate-limit-redis');
    return new RedisStore({
      client: redis,
      prefix: 'rl:',
    });
  }
  // Fallback to memory store
  return undefined;
};

export const rateLimiter = {
  // Global API rate limit
  global: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: 15 * 60 // seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
  }),

  // Authentication endpoints (more restrictive)
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per windowMs
    message: {
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: 15 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
    skipSuccessfulRequests: true, // Don't count successful requests
  }),

  // Contact form submissions
  contact: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 contact form submissions per hour
    message: {
      error: 'Too many contact form submissions, please try again later.',
      retryAfter: 60 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
  }),

  // Code challenge submissions
  submission: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 submissions per minute
    message: {
      error: 'Too many code submissions, please slow down.',
      retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
  }),

  // Admin endpoints
  admin: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Higher limit for admin users
    message: {
      error: 'Too many admin requests, please try again later.',
      retryAfter: 15 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
  }),

  // Search endpoints
  search: rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Limit search requests
    message: {
      error: 'Too many search requests, please slow down.',
      retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: createStore(),
  }),
};