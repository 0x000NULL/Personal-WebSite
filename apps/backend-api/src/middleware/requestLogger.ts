import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface RequestWithId extends Request {
  requestId: string;
  startTime: number;
}

export const requestLogger = (req: RequestWithId, res: Response, next: NextFunction) => {
  // Generate unique request ID
  req.requestId = req.headers['x-request-id'] as string || uuidv4();
  req.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.requestId);

  // Log request start
  console.log(`[${new Date().toISOString()}] ${req.requestId} ${req.method} ${req.path} - Started`);

  // Log response when it finishes
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - req.startTime;
    const statusCode = res.statusCode;
    const statusClass = Math.floor(statusCode / 100);
    
    const logLevel = statusClass >= 4 ? 'ERROR' : statusClass >= 3 ? 'WARN' : 'INFO';
    const logMessage = `[${new Date().toISOString()}] ${req.requestId} ${req.method} ${req.path} - ${statusCode} (${duration}ms)`;
    
    if (logLevel === 'ERROR') {
      console.error(logMessage);
    } else if (logLevel === 'WARN') {
      console.warn(logMessage);
    } else {
      console.log(logMessage);
    }

    return originalSend.call(this, data);
  };

  next();
};