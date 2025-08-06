#!/usr/bin/env node

/**
 * Security Configuration Checker
 * Run this script to verify all security measures are properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 Security Configuration Check\n');

const checks = [
  {
    name: 'Environment Variables',
    check: () => {
      const required = [
        'JWT_ACCESS_SECRET',
        'JWT_REFRESH_SECRET',
        'SESSION_SECRET',
        'DATABASE_URL'
      ];
      
      const missing = required.filter(key => !process.env[key]);
      
      if (missing.length > 0) {
        return { 
          passed: false, 
          message: `Missing required environment variables: ${missing.join(', ')}`
        };
      }
      
      // Check for default values
      const defaults = [];
      if (process.env.JWT_ACCESS_SECRET === 'your-super-secret-jwt-key') {
        defaults.push('JWT_ACCESS_SECRET');
      }
      if (process.env.SESSION_SECRET === 'your-secret-key') {
        defaults.push('SESSION_SECRET');
      }
      
      if (defaults.length > 0) {
        return {
          passed: false,
          message: `Using default values for: ${defaults.join(', ')}. Please change these!`
        };
      }
      
      return { passed: true, message: 'All required environment variables are set' };
    }
  },
  {
    name: 'HTTPS Configuration',
    check: () => {
      if (process.env.NODE_ENV === 'production' && process.env.FORCE_SECURE !== 'true') {
        return {
          passed: false,
          message: 'FORCE_SECURE should be set to true in production'
        };
      }
      return { passed: true, message: 'HTTPS configuration is correct' };
    }
  },
  {
    name: 'CORS Configuration',
    check: () => {
      if (!process.env.FRONTEND_URL || process.env.FRONTEND_URL.includes('localhost')) {
        if (process.env.NODE_ENV === 'production') {
          return {
            passed: false,
            message: 'FRONTEND_URL should not contain localhost in production'
          };
        }
      }
      return { passed: true, message: 'CORS configuration is correct' };
    }
  },
  {
    name: 'Rate Limiting',
    check: () => {
      if (!process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
        return {
          passed: false,
          message: 'Redis is recommended for rate limiting in production'
        };
      }
      return { passed: true, message: 'Rate limiting configuration is correct' };
    }
  },
  {
    name: 'Password Policy',
    check: () => {
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
      if (saltRounds < 10) {
        return {
          passed: false,
          message: 'BCRYPT_SALT_ROUNDS should be at least 10'
        };
      }
      return { passed: true, message: 'Password policy is secure' };
    }
  },
  {
    name: 'Security Headers',
    check: () => {
      // This would be checked at runtime, but we can verify the files exist
      const helmetConfigExists = fs.existsSync(path.join(__dirname, '../src/config/helmet.ts'));
      if (!helmetConfigExists) {
        return {
          passed: false,
          message: 'Helmet configuration file not found'
        };
      }
      return { passed: true, message: 'Security headers configuration found' };
    }
  },
  {
    name: 'Database Security',
    check: () => {
      const dbUtilsExists = fs.existsSync(path.join(__dirname, '../src/utils/database.ts'));
      if (!dbUtilsExists) {
        return {
          passed: false,
          message: 'Database utilities file not found'
        };
      }
      return { passed: true, message: 'Database security utilities found' };
    }
  }
];

let allPassed = true;

checks.forEach(({ name, check }) => {
  try {
    const result = check();
    if (result.passed) {
      console.log(`✅ ${name}: ${result.message}`);
    } else {
      console.log(`❌ ${name}: ${result.message}`);
      allPassed = false;
    }
  } catch (error) {
    console.log(`❌ ${name}: Error - ${error.message}`);
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('✅ All security checks passed!');
  process.exit(0);
} else {
  console.log('❌ Some security checks failed. Please address the issues above.');
  process.exit(1);
}