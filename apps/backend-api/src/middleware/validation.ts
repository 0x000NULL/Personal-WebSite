import { Request, Response, NextFunction } from 'express';
import Joi, { Schema, ValidationError } from 'joi';
import xss from 'xss';
import { createError } from './errorHandler';

// XSS options for sanitizing user input
const xssOptions = {
  whiteList: {}, // No tags allowed by default
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script']
};

// Common validation schemas
export const commonSchemas = {
  id: Joi.string().uuid().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])/).required(),
  username: Joi.string().alphanum().min(3).max(30).required(),
  url: Joi.string().uri().required(),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    sortBy: Joi.string().alphanum().max(50)
  }
};

// Sanitize strings to prevent XSS
const sanitizeString = (value: any): any => {
  if (typeof value === 'string') {
    return xss(value, xssOptions);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeString);
  }
  if (value && typeof value === 'object') {
    const sanitized: any = {};
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        sanitized[key] = sanitizeString(value[key]);
      }
    }
    return sanitized;
  }
  return value;
};

// Validation middleware factory
export const validate = (schema: Schema, options: {
  body?: boolean;
  query?: boolean;
  params?: boolean;
  sanitize?: boolean;
  stripUnknown?: boolean;
} = {}) => {
  const { 
    body = true, 
    query = false, 
    params = false, 
    sanitize = true,
    stripUnknown = true 
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate: any = {};
      
      if (body && req.body) {
        dataToValidate.body = req.body;
      }
      if (query && req.query) {
        dataToValidate.query = req.query;
      }
      if (params && req.params) {
        dataToValidate.params = req.params;
      }

      // Create a combined schema if multiple sources
      let validationSchema = schema;
      if (Object.keys(dataToValidate).length > 1) {
        const schemaObject: any = {};
        if (body) schemaObject.body = schema;
        if (query) schemaObject.query = schema;
        if (params) schemaObject.params = schema;
        validationSchema = Joi.object(schemaObject);
      }

      // Validate
      const { error, value } = validationSchema.validate(
        Object.keys(dataToValidate).length > 1 ? dataToValidate : dataToValidate[Object.keys(dataToValidate)[0]],
        {
          abortEarly: false,
          stripUnknown,
          convert: true
        }
      );

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
        throw createError('Validation failed', 400, errors);
      }

      // Apply sanitization if enabled
      if (sanitize) {
        if (Object.keys(dataToValidate).length > 1) {
          if (value.body) req.body = sanitizeString(value.body);
          if (value.query) req.query = sanitizeString(value.query);
          if (value.params) req.params = sanitizeString(value.params);
        } else {
          if (body) req.body = sanitizeString(value);
          if (query) req.query = sanitizeString(value);
          if (params) req.params = sanitizeString(value);
        }
      } else {
        // Still apply the validated values (with type conversion)
        if (Object.keys(dataToValidate).length > 1) {
          if (value.body) req.body = value.body;
          if (value.query) req.query = value.query;
          if (value.params) req.params = value.params;
        } else {
          if (body) req.body = value;
          if (query) req.query = value;
          if (params) req.params = value;
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Specific validators for common operations
export const validators = {
  // Pagination validation
  pagination: validate(
    Joi.object({
      page: commonSchemas.pagination.page,
      limit: commonSchemas.pagination.limit,
      sort: commonSchemas.pagination.sort,
      sortBy: commonSchemas.pagination.sortBy
    }),
    { query: true, body: false }
  ),

  // ID parameter validation
  idParam: validate(
    Joi.object({
      id: commonSchemas.id
    }),
    { params: true, body: false, query: false }
  ),

  // Search query validation
  search: validate(
    Joi.object({
      q: Joi.string().min(1).max(200).required(),
      type: Joi.string().valid('blog', 'challenge', 'user').optional(),
      ...commonSchemas.pagination
    }),
    { query: true, body: false }
  )
};

// SQL Injection prevention helpers
export const sanitizeSQLIdentifier = (identifier: string): string => {
  // Only allow alphanumeric characters and underscores
  return identifier.replace(/[^a-zA-Z0-9_]/g, '');
};

export const createSafeSQLOrderBy = (column: string, direction: 'asc' | 'desc' = 'desc'): string => {
  const safeColumn = sanitizeSQLIdentifier(column);
  const safeDirection = direction.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `${safeColumn} ${safeDirection}`;
};

// File upload validation
export const validateFileUpload = (options: {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
} = {}) => {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];

    for (const file of files.filter(Boolean)) {
      // Check file size
      if (file.size > maxSize) {
        return next(createError(`File ${file.originalname} exceeds maximum size of ${maxSize / 1024 / 1024}MB`, 400));
      }

      // Check MIME type
      if (!allowedTypes.includes(file.mimetype)) {
        return next(createError(`File ${file.originalname} has invalid type. Allowed types: ${allowedTypes.join(', ')}`, 400));
      }

      // Check file extension
      const ext = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];
      if (!ext || !allowedExtensions.includes(ext)) {
        return next(createError(`File ${file.originalname} has invalid extension. Allowed extensions: ${allowedExtensions.join(', ')}`, 400));
      }
    }

    next();
  };
};