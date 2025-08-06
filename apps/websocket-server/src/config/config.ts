import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig();

export const config = {
  port: parseInt(process.env.WEBSOCKET_PORT || '8080'),
  environment: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'portfolio',
    user: process.env.DB_USER || 'portfolio_user',
    password: process.env.DB_PASSWORD || 'portfolio_password'
  },
  
  // Redis configuration for scaling (if needed)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-jwt-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },
  
  // WebSocket specific settings
  websocket: {
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '1000'),
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '15000'),
    maxMessageSize: parseInt(process.env.WS_MAX_MESSAGE_SIZE || '1048576'), // 1MB
    chatMessageLimit: parseInt(process.env.WS_CHAT_MESSAGE_LIMIT || '5'), // messages per minute
    maxRoomsPerUser: parseInt(process.env.WS_MAX_ROOMS_PER_USER || '10')
  },
  
  // External service URLs
  services: {
    backendApi: process.env.BACKEND_API_URL || 'http://localhost:4000',
    frontend: process.env.FRONTEND_URL || 'http://localhost:3000'
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined'
  }
};