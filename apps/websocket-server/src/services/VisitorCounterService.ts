import { ConnectionManager } from './ConnectionManager';
import { ExtendedWebSocket, VisitorStats } from '../types/WebSocket';
import { logger } from '../utils/logger';

interface VisitorSession {
  connectionId: string;
  userId?: string;
  ip: string;
  userAgent?: string;
  connectedAt: Date;
  lastSeen: Date;
  pageViews: string[];
  country?: string;
}

export class VisitorCounterService {
  private connectionManager: ConnectionManager;
  private sessions: Map<string, VisitorSession> = new Map();
  private dailyVisitors: Set<string> = new Set();
  private peakCount: number = 0;
  private pageViewCounts: Map<string, number> = new Map();
  private countryCounts: Map<string, number> = new Map();
  private lastResetDate: string;

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.lastResetDate = new Date().toDateString();
    
    // Reset daily stats at midnight
    this.scheduleDailyReset();
  }

  async onUserConnected(ws: ExtendedWebSocket): Promise<void> {
    try {
      // Create visitor session
      const session: VisitorSession = {
        connectionId: ws.id,
        userId: ws.user?.id,
        ip: ws.ip,
        userAgent: ws.userAgent,
        connectedAt: new Date(),
        lastSeen: new Date(),
        pageViews: [],
        country: await this.getCountryFromIP(ws.ip)
      };

      this.sessions.set(ws.id, session);
      
      // Track daily visitors (by IP for anonymous, by userId for authenticated)
      const visitorKey = ws.user?.id || ws.ip;
      this.dailyVisitors.add(visitorKey);
      
      // Update country stats
      if (session.country) {
        const currentCount = this.countryCounts.get(session.country) || 0;
        this.countryCounts.set(session.country, currentCount + 1);
      }
      
      // Update peak count
      const currentCount = this.getCurrentCount();
      if (currentCount > this.peakCount) {
        this.peakCount = currentCount;
      }
      
      // Broadcast updated visitor count
      await this.broadcastVisitorUpdate();
      
      logger.debug(`Visitor connected: ${ws.id} (Total: ${currentCount})`);
      
    } catch (error) {
      logger.error('Error handling user connection:', error);
    }
  }

  async onUserDisconnected(ws: ExtendedWebSocket): Promise<void> {
    try {
      const session = this.sessions.get(ws.id);
      if (!session) {
        return;
      }

      // Update country stats
      if (session.country) {
        const currentCount = this.countryCounts.get(session.country) || 0;
        if (currentCount > 1) {
          this.countryCounts.set(session.country, currentCount - 1);
        } else {
          this.countryCounts.delete(session.country);
        }
      }

      this.sessions.delete(ws.id);
      
      // Broadcast updated visitor count
      await this.broadcastVisitorUpdate();
      
      logger.debug(`Visitor disconnected: ${ws.id} (Total: ${this.getCurrentCount()})`);
      
    } catch (error) {
      logger.error('Error handling user disconnection:', error);
    }
  }

  async onPageView(connectionId: string, pagePath: string): Promise<void> {
    const session = this.sessions.get(connectionId);
    if (!session) {
      return;
    }

    session.pageViews.push(pagePath);
    session.lastSeen = new Date();
    
    // Update page view counts
    const currentCount = this.pageViewCounts.get(pagePath) || 0;
    this.pageViewCounts.set(pagePath, currentCount + 1);
    
    // Broadcast page view update
    this.connectionManager.broadcastToAll({
      type: 'visitor:page_view',
      data: {
        pagePath,
        totalViews: this.pageViewCounts.get(pagePath),
        timestamp: new Date().toISOString()
      }
    });
  }

  getCurrentCount(): number {
    return this.sessions.size;
  }

  getTotalDailyVisitors(): number {
    return this.dailyVisitors.size;
  }

  getPeakDailyCount(): number {
    return this.peakCount;
  }

  getVisitorStats(): VisitorStats {
    const totalSessionTime = Array.from(this.sessions.values())
      .reduce((acc, session) => {
        const sessionTime = Date.now() - session.connectedAt.getTime();
        return acc + sessionTime;
      }, 0);

    const averageSessionTime = this.sessions.size > 0 
      ? totalSessionTime / this.sessions.size / 1000 // Convert to seconds
      : 0;

    const topPages = Array.from(this.pageViewCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([path, visitors]) => ({ path, visitors }));

    const countries = Array.from(this.countryCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([code, count]) => ({ 
        code, 
        name: this.getCountryName(code), 
        count 
      }));

    return {
      currentCount: this.getCurrentCount(),
      totalToday: this.getTotalDailyVisitors(),
      peakToday: this.getPeakDailyCount(),
      averageSessionTime: Math.round(averageSessionTime),
      topPages,
      countries
    };
  }

  private async broadcastVisitorUpdate(): Promise<void> {
    const stats = this.getVisitorStats();
    
    this.connectionManager.broadcastToAll({
      type: 'visitor:count_update',
      data: {
        current: stats.currentCount,
        totalToday: stats.totalToday,
        peakToday: stats.peakToday,
        timestamp: new Date().toISOString()
      }
    });
  }

  private async getCountryFromIP(ip: string): Promise<string | undefined> {
    try {
      // In a real implementation, you would use a geolocation service
      // For now, we'll return undefined or implement a simple IP-to-country lookup
      
      // Example: Using ipapi.co or similar service
      // const response = await fetch(`https://ipapi.co/${ip}/country/`);
      // const country = await response.text();
      // return country.trim();
      
      // For development, return a mock country based on IP pattern
      if (ip.startsWith('192.168.') || ip.startsWith('127.0.') || ip === '::1') {
        return 'US'; // Local development
      }
      
      return undefined;
    } catch (error) {
      logger.error('Error getting country from IP:', error);
      return undefined;
    }
  }

  private getCountryName(code: string): string {
    // Simple country code to name mapping
    const countryNames: Record<string, string> = {
      'US': 'United States',
      'CA': 'Canada',
      'GB': 'United Kingdom',
      'DE': 'Germany',
      'FR': 'France',
      'JP': 'Japan',
      'AU': 'Australia',
      'BR': 'Brazil',
      'IN': 'India',
      'CN': 'China'
    };
    
    return countryNames[code] || code;
  }

  private scheduleDailyReset(): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.resetDailyStats();
      
      // Schedule daily reset every 24 hours
      setInterval(() => {
        this.resetDailyStats();
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
    
    logger.info(`Daily stats reset scheduled in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);
  }

  private resetDailyStats(): void {
    this.dailyVisitors.clear();
    this.peakCount = this.getCurrentCount();
    this.lastResetDate = new Date().toDateString();
    
    logger.info('Daily visitor stats reset');
    
    // Broadcast the reset
    this.connectionManager.broadcastToAll({
      type: 'visitor:daily_reset',
      data: {
        date: this.lastResetDate,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Admin methods
  async getDetailedStats(): Promise<{
    sessions: Array<{
      connectionId: string;
      userId?: string;
      ip: string;
      connectedAt: Date;
      sessionDuration: number;
      pageViewCount: number;
      country?: string;
    }>;
    topCountries: Array<{ code: string; name: string; count: number }>;
    topPages: Array<{ path: string; views: number }>;
    hourlyBreakdown: Array<{ hour: number; visitors: number }>;
  }> {
    const sessions = Array.from(this.sessions.values()).map(session => ({
      connectionId: session.connectionId,
      userId: session.userId,
      ip: session.ip.substring(0, 8) + '***', // Mask IP for privacy
      connectedAt: session.connectedAt,
      sessionDuration: Date.now() - session.connectedAt.getTime(),
      pageViewCount: session.pageViews.length,
      country: session.country
    }));

    const topCountries = Array.from(this.countryCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([code, count]) => ({ 
        code, 
        name: this.getCountryName(code), 
        count 
      }));

    const topPages = Array.from(this.pageViewCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([path, views]) => ({ path, views }));

    // Create hourly breakdown (last 24 hours)
    const hourlyBreakdown = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      visitors: 0 // This would need to be tracked over time in a real implementation
    }));

    return {
      sessions,
      topCountries,
      topPages,
      hourlyBreakdown
    };
  }
}