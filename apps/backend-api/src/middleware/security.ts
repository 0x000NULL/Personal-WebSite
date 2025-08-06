import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Generate request ID if not present
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  // Additional security headers not covered by helmet
  res.setHeader('X-API-Version', process.env.API_VERSION || '1.0.0');
  
  // Prevent information disclosure
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Custom rate limit headers for debugging
  if (process.env.NODE_ENV === 'development') {
    res.setHeader('X-Debug-Mode', 'true');
  }

  // Add security headers for API responses
  if (req.path.startsWith('/api/')) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
  }

  next();
};

export const requireHTTPS = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(`https://${req.header('host')}${req.url}`);
  }
  next();
};

export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const contentType = req.header('content-type');
      if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
        return res.status(415).json({
          error: 'Unsupported Media Type',
          message: `Content-Type must be one of: ${allowedTypes.join(', ')}`
        });
      }
    }
    next();
  };
};

// CSRF protection for state-changing operations
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip for API key authenticated requests
  if (req.headers['x-api-key']) {
    return next();
  }

  // Check for CSRF token in development
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // Verify CSRF token
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = (req as any).session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({
      error: 'CSRF token validation failed',
      message: 'Invalid or missing CSRF token'
    });
  }

  next();
};

// Request size limiting
export const requestSizeLimit = (maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    let size = 0;
    
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        res.status(413).json({
          error: 'Payload Too Large',
          message: `Request body exceeds maximum size of ${maxSize / 1024 / 1024}MB`
        });
        req.socket.destroy();
      }
    });
    
    next();
  };
};

// IP-based access control
export const ipWhitelist = (allowedIPs: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (allowedIPs.length === 0) {
      return next();
    }

    const clientIP = req.ip || req.socket.remoteAddress || '';
    
    if (!allowedIPs.includes(clientIP)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied from your IP address'
      });
    }

    next();
  };
};

// Prevent timing attacks on sensitive operations
export const constantTimeResponse = (delayMs: number = 1000) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json method to add delay
    res.json = function(body: any) {
      const elapsed = Date.now() - startTime;
      const remainingDelay = Math.max(0, delayMs - elapsed);
      
      setTimeout(() => {
        originalJson(body);
      }, remainingDelay);
      
      return res;
    };
    
    next();
  };
};