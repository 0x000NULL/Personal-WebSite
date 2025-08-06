import { pool } from '../config/database';
import { getRedis } from '../config/database';

export interface SecurityEvent {
  eventType: 'login' | 'logout' | 'failed_login' | 'password_reset' | 'permission_denied' | 'suspicious_activity' | 'api_key_usage';
  userId?: string;
  ipAddress: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp?: Date;
}

export class SecurityAuditService {
  private static instance: SecurityAuditService;
  private redis: any;

  private constructor() {
    this.redis = getRedis();
  }

  static getInstance(): SecurityAuditService {
    if (!SecurityAuditService.instance) {
      SecurityAuditService.instance = new SecurityAuditService();
    }
    return SecurityAuditService.instance;
  }

  /**
   * Log a security event
   */
  async logEvent(event: SecurityEvent): Promise<void> {
    try {
      const timestamp = event.timestamp || new Date();
      
      // Store in database for permanent record
      await pool.query(`
        INSERT INTO security_audit_logs (
          event_type, user_id, ip_address, user_agent, 
          metadata, severity, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        event.eventType,
        event.userId || null,
        event.ipAddress,
        event.userAgent || null,
        JSON.stringify(event.metadata || {}),
        event.severity,
        timestamp
      ]);

      // Also store in Redis for real-time monitoring
      if (this.redis) {
        const key = `security:events:${event.eventType}:${timestamp.getTime()}`;
        await this.redis.setex(key, 86400, JSON.stringify(event)); // 24 hour TTL
        
        // Update counters
        await this.incrementEventCounter(event.eventType, event.severity);
      }

      // Check for patterns that might indicate an attack
      await this.detectSuspiciousPatterns(event);
    } catch (error) {
      console.error('Failed to log security event:', error);
      // Don't throw - security logging should not break the app
    }
  }

  /**
   * Log failed login attempt
   */
  async logFailedLogin(email: string, ipAddress: string, userAgent?: string): Promise<void> {
    await this.logEvent({
      eventType: 'failed_login',
      ipAddress,
      userAgent,
      metadata: { email },
      severity: 'medium'
    });
  }

  /**
   * Log successful login
   */
  async logSuccessfulLogin(userId: string, ipAddress: string, userAgent?: string): Promise<void> {
    await this.logEvent({
      eventType: 'login',
      userId,
      ipAddress,
      userAgent,
      severity: 'low'
    });
  }

  /**
   * Log logout
   */
  async logLogout(userId: string, ipAddress: string): Promise<void> {
    await this.logEvent({
      eventType: 'logout',
      userId,
      ipAddress,
      severity: 'low'
    });
  }

  /**
   * Log permission denied
   */
  async logPermissionDenied(userId: string | undefined, resource: string, ipAddress: string): Promise<void> {
    await this.logEvent({
      eventType: 'permission_denied',
      userId,
      ipAddress,
      metadata: { resource },
      severity: 'medium'
    });
  }

  /**
   * Get security events for a user
   */
  async getUserSecurityEvents(userId: string, limit = 50): Promise<any[]> {
    const result = await pool.query(`
      SELECT * FROM security_audit_logs 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `, [userId, limit]);
    
    return result.rows;
  }

  /**
   * Get recent suspicious activity
   */
  async getRecentSuspiciousActivity(hours = 24): Promise<any[]> {
    const result = await pool.query(`
      SELECT * FROM security_audit_logs 
      WHERE severity IN ('high', 'critical') 
        AND created_at > NOW() - INTERVAL '${hours} hours'
      ORDER BY created_at DESC
    `);
    
    return result.rows;
  }

  /**
   * Detect suspicious patterns
   */
  private async detectSuspiciousPatterns(event: SecurityEvent): Promise<void> {
    if (!this.redis) return;

    const patterns = [
      { type: 'failed_login', threshold: 10, window: 300 }, // 10 failed logins in 5 minutes
      { type: 'permission_denied', threshold: 20, window: 600 }, // 20 permission denied in 10 minutes
    ];

    for (const pattern of patterns) {
      if (event.eventType === pattern.type) {
        const key = `security:pattern:${pattern.type}:${event.ipAddress}`;
        const count = await this.redis.incr(key);
        
        if (count === 1) {
          await this.redis.expire(key, pattern.window);
        }
        
        if (count >= pattern.threshold) {
          await this.logEvent({
            eventType: 'suspicious_activity',
            ipAddress: event.ipAddress,
            metadata: {
              pattern: pattern.type,
              count,
              threshold: pattern.threshold,
              window: pattern.window
            },
            severity: 'high'
          });
          
          // Reset counter
          await this.redis.del(key);
        }
      }
    }
  }

  /**
   * Increment event counters for monitoring
   */
  private async incrementEventCounter(eventType: string, severity: string): Promise<void> {
    if (!this.redis) return;

    const date = new Date();
    const hourKey = `security:stats:${eventType}:${severity}:${date.toISOString().slice(0, 13)}`;
    const dayKey = `security:stats:${eventType}:${severity}:${date.toISOString().slice(0, 10)}`;
    
    await this.redis.incr(hourKey);
    await this.redis.expire(hourKey, 86400); // 24 hour TTL
    
    await this.redis.incr(dayKey);
    await this.redis.expire(dayKey, 604800); // 7 day TTL
  }

  /**
   * Get security statistics
   */
  async getSecurityStats(hours = 24): Promise<any> {
    const result = await pool.query(`
      SELECT 
        event_type,
        severity,
        COUNT(*) as count,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(DISTINCT user_id) as unique_users
      FROM security_audit_logs
      WHERE created_at > NOW() - INTERVAL '${hours} hours'
      GROUP BY event_type, severity
      ORDER BY count DESC
    `);
    
    return {
      summary: result.rows,
      totalEvents: result.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
      timeRange: `${hours} hours`
    };
  }

  /**
   * Clean up old security logs
   */
  async cleanupOldLogs(daysToKeep = 90): Promise<number> {
    const result = await pool.query(`
      DELETE FROM security_audit_logs 
      WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
    `);
    
    return result.rowCount;
  }
}

export const securityAudit = SecurityAuditService.getInstance();