import { SignOptions, VerifyOptions } from 'jsonwebtoken';

export const authConfig = {
  jwt: {
    accessToken: {
      secret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'your-super-secret-jwt-key',
      options: {
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        issuer: 'portfolio-api',
        audience: 'portfolio-app',
        algorithm: 'HS256'
      } as SignOptions
    },
    refreshToken: {
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'your-super-secret-jwt-key',
      options: {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        issuer: 'portfolio-api',
        audience: 'portfolio-app',
        algorithm: 'HS256'
      } as SignOptions
    },
    verifyOptions: {
      issuer: 'portfolio-api',
      audience: 'portfolio-app',
      algorithms: ['HS256']
    } as VerifyOptions
  },
  password: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12'),
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])/
  },
  security: {
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5'),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000'), // 15 minutes
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000'), // 1 hour
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
    allowMultipleSessions: process.env.ALLOW_MULTIPLE_SESSIONS !== 'false'
  },
  rateLimiting: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxLoginAttempts: 5,
    maxRegistrations: 3,
    maxPasswordResets: 3
  }
};

export const validatePasswordStrength = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const config = authConfig.password;

  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters long`);
  }

  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (config.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (config.requireSpecialChars && !/[!@#\$%\^&\*]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

export const isSecureEnvironment = (): boolean => {
  return process.env.NODE_ENV === 'production' || process.env.FORCE_SECURE === 'true';
};