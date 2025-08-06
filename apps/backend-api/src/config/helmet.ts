import helmet from 'helmet';
import { isSecureEnvironment } from './auth';

export const helmetConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isSecure = isSecureEnvironment();

  return helmet({
    // Content Security Policy
    contentSecurityPolicy: isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Consider removing unsafe-eval in production
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", "https://api.github.com", "wss:", "ws:"],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        childSrc: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isSecure ? [] : null,
        blockAllMixedContent: isSecure ? [] : null
      }
    } : false, // Disable CSP in development for easier debugging

    // DNS Prefetch Control
    dnsPrefetchControl: {
      allow: false
    },

    // Frameguard - Prevent clickjacking
    frameguard: {
      action: 'deny'
    },

    // Hide Powered-By header
    hidePoweredBy: true,

    // HSTS - Strict Transport Security
    hsts: isSecure ? {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    } : false,

    // IE No Open
    ieNoOpen: true,

    // No Sniff - Prevent MIME type sniffing
    noSniff: true,

    // Origin Agent Cluster
    originAgentCluster: true,

    // Permitted Cross-Domain Policies
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none'
    },

    // Referrer Policy
    referrerPolicy: {
      policy: ['no-referrer', 'strict-origin-when-cross-origin']
    },

    // XSS Filter
    xssFilter: true,

    // Cross-Origin Embedder Policy
    crossOriginEmbedderPolicy: !isProduction, // Disable in production if causing issues

    // Cross-Origin Opener Policy
    crossOriginOpenerPolicy: {
      policy: 'same-origin'
    },

    // Cross-Origin Resource Policy
    crossOriginResourcePolicy: {
      policy: 'same-origin'
    }
  });
};

// Additional security headers not covered by helmet
export const additionalSecurityHeaders = (req: any, res: any, next: any) => {
  // Permissions Policy (formerly Feature Policy)
  res.setHeader('Permissions-Policy', 
    'camera=(), ' +
    'microphone=(), ' +
    'geolocation=(), ' +
    'payment=(), ' +
    'usb=(), ' +
    'magnetometer=(), ' +
    'accelerometer=(), ' +
    'gyroscope=()'
  );

  // X-Content-Type-Options (redundant but explicit)
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options (redundant but explicit)
  res.setHeader('X-Frame-Options', 'DENY');

  // X-XSS-Protection (redundant but explicit)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Cache-Control for security-sensitive responses
  if (req.path.includes('/api/auth') || req.path.includes('/api/admin')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // Clear-Site-Data header for logout
  if (req.path === '/api/auth/logout' && req.method === 'POST') {
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
  }

  next();
};