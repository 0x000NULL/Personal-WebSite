import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { User } from '../types/WebSocket';
import { logger } from '../utils/logger';

export async function authenticateWebSocket(req: any): Promise<User | null> {
  try {
    // Try to extract token from various sources
    let token: string | null = null;
    
    // 1. Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    // 2. Check query parameters
    if (!token && req.url) {
      const url = new URL(req.url, 'http://localhost');
      token = url.searchParams.get('token');
    }
    
    // 3. Check cookies (if available)
    if (!token && req.headers.cookie) {
      const cookies = parseCookies(req.headers.cookie);
      token = cookies.authToken || cookies.token;
    }
    
    if (!token) {
      // No token provided - allow anonymous connection
      return null;
    }
    
    // Verify and decode the JWT
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    
    if (!decoded || !decoded.id) {
      logger.warn('Invalid JWT token structure');
      return null;
    }
    
    // TODO: In a real implementation, you might want to:
    // 1. Validate the user exists in the database
    // 2. Check if the user is active/not banned
    // 3. Load additional user permissions
    
    const user: User = {
      id: decoded.id,
      username: decoded.username || decoded.email || 'Unknown',
      email: decoded.email,
      role: decoded.role || 'user'
    };
    
    logger.debug(`Authenticated WebSocket user: ${user.id} (${user.username})`);
    return user;
    
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('JWT verification failed:', error.message);
    } else {
      logger.error('Authentication error:', error);
    }
    return null;
  }
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.trim().split('=');
    if (parts.length === 2) {
      const key = decodeURIComponent(parts[0]);
      const value = decodeURIComponent(parts[1]);
      cookies[key] = value;
    }
  });
  
  return cookies;
}

export function requireAuth(user: User | undefined): User {
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

export function requireRole(user: User | undefined, requiredRole: 'admin' | 'user'): User {
  const authenticatedUser = requireAuth(user);
  
  if (requiredRole === 'admin' && authenticatedUser.role !== 'admin') {
    throw new Error('Admin privileges required');
  }
  
  return authenticatedUser;
}