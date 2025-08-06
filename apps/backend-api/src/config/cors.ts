import { CorsOptions } from 'cors';

// Define allowed origins based on environment
const getAllowedOrigins = (): string[] => {
  const origins: string[] = [];
  
  // Always allow localhost in development
  if (process.env.NODE_ENV === 'development') {
    origins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:4000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:4000'
    );
  }
  
  // Add production frontend URL
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  
  // Add additional allowed origins from environment
  if (process.env.ALLOWED_ORIGINS) {
    const additionalOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
    origins.push(...additionalOrigins);
  }
  
  return [...new Set(origins)]; // Remove duplicates
};

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if the origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS: Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  
  credentials: true, // Allow cookies and authorization headers
  
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'X-Request-ID',
    'X-CSRF-Token',
    'Accept',
    'Accept-Language',
    'Cache-Control',
    'Origin',
    'Referer',
    'User-Agent'
  ],
  
  exposedHeaders: [
    'X-Request-ID',
    'X-API-Version',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Content-Range',
    'Content-Length'
  ],
  
  maxAge: 86400, // 24 hours - how long the browser can cache preflight requests
  
  optionsSuccessStatus: 204 // Some legacy browsers choke on 204
};

// Strict CORS for sensitive endpoints
export const strictCorsOptions: CorsOptions = {
  ...corsOptions,
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    // For strict CORS, always require an origin
    if (!origin || !allowedOrigins.includes(origin)) {
      console.warn(`Strict CORS: Blocked request from origin: ${origin || 'no-origin'}`);
      return callback(new Error('Not allowed by strict CORS'));
    }
    
    callback(null, true);
  }
};

// Helper to check if origin is trusted
export const isTrustedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return false;
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin);
};