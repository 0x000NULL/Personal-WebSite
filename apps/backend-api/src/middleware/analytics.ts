import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { RequestWithId } from './requestLogger';

export const analyticsMiddleware = async (req: RequestWithId, res: Response, next: NextFunction) => {
  // Skip analytics for certain paths
  const skipPaths = ['/api/health', '/api-docs', '/api/analytics'];
  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Extract analytics data
  const sessionId = req.session?.id || req.headers['x-session-id'] as string;
  const userAgent = req.headers['user-agent'];
  const ip = req.ip || req.connection.remoteAddress;
  const referrer = req.headers.referer;

  // Track the request (non-blocking)
  setImmediate(async () => {
    try {
      // Only track GET requests for page views
      if (req.method === 'GET') {
        // Find or create visitor session
        let session = null;
        if (sessionId) {
          const sessionResult = await query(
            'SELECT id FROM visitor_sessions WHERE session_id = $1',
            [sessionId]
          );
          session = sessionResult.rows[0];
        }

        if (!session && sessionId) {
          // Create new session
          const newSessionResult = await query(`
            INSERT INTO visitor_sessions (
              session_id, ip_address, user_agent, referrer_url, entry_page, started_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id
          `, [sessionId, ip, userAgent, referrer, req.path]);
          session = newSessionResult.rows[0];
        }

        // Track page view
        if (session) {
          await query(`
            INSERT INTO page_views (
              session_id, page_url, page_path, method, ip_address, 
              user_agent, referrer_url, viewed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          `, [
            session.id,
            `${req.protocol}://${req.get('host')}${req.originalUrl}`,
            req.path,
            req.method,
            ip,
            userAgent,
            referrer
          ]);
        }
      }

      // Track API events for non-GET requests
      if (req.method !== 'GET' && sessionId) {
        await query(`
          INSERT INTO analytics_events (
            session_id, event_name, event_category, event_action,
            page_url, ip_address, user_agent, occurred_at
          ) VALUES (
            (SELECT id FROM visitor_sessions WHERE session_id = $1),
            $2, $3, $4, $5, $6, $7, NOW()
          )
        `, [
          sessionId,
          `api_${req.method.toLowerCase()}`,
          'api',
          req.path,
          `${req.protocol}://${req.get('host')}${req.originalUrl}`,
          ip,
          userAgent
        ]);
      }

    } catch (error) {
      // Log error but don't fail the request
      console.error('Analytics tracking error:', error);
    }
  });

  next();
};