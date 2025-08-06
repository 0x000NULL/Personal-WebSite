import { Request, Response, NextFunction } from 'express';
import { RequestWithId } from './requestLogger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  errors?: any[];
  code?: string;
}

export interface StandardErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any[];
  };
  requestId: string;
  timestamp: string;
  stack?: string;
}

export const errorHandler = (
  error: AppError,
  req: RequestWithId,
  res: Response,
  next: NextFunction
) => {
  const requestId = req.requestId || 'unknown';
  
  // Log error with request context
  console.error(`[${new Date().toISOString()}] ${requestId} ERROR:`, {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: (req as any).user?.id
  });

  // Default error response
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';
  let errors = error.errors || [];
  let code = error.code || 'INTERNAL_SERVER_ERROR';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    errors = Array.isArray(error.errors) ? error.errors : [error.message];
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;  
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID_FORMAT';
    message = 'Invalid ID format provided';
  } else if (error.message?.includes('duplicate key')) {
    statusCode = 409;
    code = 'RESOURCE_CONFLICT';
    message = 'Resource already exists';
  } else if (error.message?.includes('foreign key constraint')) {
    statusCode = 400;
    code = 'INVALID_REFERENCE';
    message = 'Invalid reference to related resource';
  } else if (error.message?.includes('ECONNREFUSED')) {
    statusCode = 503;
    code = 'SERVICE_UNAVAILABLE';
    message = 'External service unavailable';
  } else if (error.name === 'MulterError') {
    statusCode = 400;
    code = 'FILE_UPLOAD_ERROR';
    message = 'File upload failed';
  }

  // Don't expose internal error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    code = 'INTERNAL_SERVER_ERROR';
    message = 'An internal server error occurred';
    errors = [];
  }

  // Create standardized error response
  const errorResponse: StandardErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(errors.length > 0 && { details: errors })
    },
    requestId,
    timestamp: new Date().toISOString()
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
};

export const notFoundHandler = (req: Request, res: Response) => {
  const response: StandardErrorResponse = {
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    },
    requestId: (req as any).requestId || 'unknown',
    timestamp: new Date().toISOString()
  };
  
  res.status(404).json(response);
};

export const createError = (message: string, statusCode: number = 500, errors?: any[], code?: string): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  error.code = code;
  if (errors) {
    error.errors = errors;
  }
  return error;
};

// Async error wrapper to ensure all async errors are caught
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Standard success response helper
export const createSuccessResponse = (data?: any, message?: string, meta?: any) => {
  return {
    success: true,
    ...(message && { message }),
    ...(data && { data }),
    ...(meta && { meta }),
    timestamp: new Date().toISOString()
  };
};