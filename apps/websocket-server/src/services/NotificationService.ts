import { v4 as uuidv4 } from 'uuid';
import { ConnectionManager } from './ConnectionManager';
import { NotificationPayload } from '../types/WebSocket';
import { logger } from '../utils/logger';

interface StoredNotification extends NotificationPayload {
  id: string;
  createdAt: Date;
  readBy: Set<string>; // userIds who have read this notification
  expiresAt?: Date;
}

export class NotificationService {
  private connectionManager: ConnectionManager;
  private notifications: Map<string, StoredNotification> = new Map();
  private userNotifications: Map<string, string[]> = new Map(); // userId -> notificationIds

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.startNotificationCleanup();
  }

  async notifyCommentApproval(commentId: string, postId: string, action: 'approved' | 'rejected'): Promise<void> {
    try {
      const notification: NotificationPayload = {
        type: 'comment_approval',
        title: `Comment ${action}`,
        message: `Your comment has been ${action}`,
        data: {
          commentId,
          postId,
          action
        },
        persistent: true
      };

      // Try to find the comment author to send targeted notification
      // In a real implementation, you would fetch the comment from the database
      // For now, we'll broadcast to all authenticated users
      await this.broadcastNotification(notification);

      logger.info(`Comment approval notification sent: ${commentId} - ${action}`);

    } catch (error) {
      logger.error('Error sending comment approval notification:', error);
    }
  }

  async notifyChallengeSubmission(submissionId: string, challengeId: string, status: string): Promise<void> {
    try {
      // Create different messages based on status
      let title = 'Challenge Submission Update';
      let message = `Your submission status: ${status}`;

      switch (status) {
        case 'accepted':
          title = '🎉 Challenge Solved!';
          message = 'Congratulations! Your solution has been accepted.';
          break;
        case 'wrong_answer':
          title = '❌ Incorrect Solution';
          message = 'Your solution produced incorrect output. Try again!';
          break;
        case 'time_limit_exceeded':
          title = '⏰ Time Limit Exceeded';
          message = 'Your solution took too long to execute. Consider optimizing your approach.';
          break;
        case 'memory_limit_exceeded':
          title = '🧠 Memory Limit Exceeded';
          message = 'Your solution used too much memory. Try to optimize memory usage.';
          break;
        case 'compilation_error':
          title = '🔧 Compilation Error';
          message = 'There was an error compiling your code. Check your syntax.';
          break;
        case 'runtime_error':
          title = '💥 Runtime Error';
          message = 'Your code encountered a runtime error during execution.';
          break;
      }

      const notification: NotificationPayload = {
        type: 'challenge_submission',
        title,
        message,
        data: {
          submissionId,
          challengeId,
          status
        },
        persistent: true
      };

      // In a real implementation, you would get the user ID from the submission
      // For now, we'll broadcast to all users interested in this challenge
      await this.broadcastNotification(notification, (ws) => {
        // Only send to authenticated users
        return !!ws.user;
      });

      logger.info(`Challenge submission notification sent: ${submissionId} - ${status}`);

    } catch (error) {
      logger.error('Error sending challenge submission notification:', error);
    }
  }

  async notifyDeploymentStatus(deploymentId: string, environment: string, status: string, details?: any): Promise<void> {
    try {
      let title = 'Deployment Update';
      let message = `Deployment to ${environment}: ${status}`;

      switch (status) {
        case 'started':
          title = '🚀 Deployment Started';
          message = `Deployment to ${environment} has begun`;
          break;
        case 'success':
          title = '✅ Deployment Complete';
          message = `Successfully deployed to ${environment}`;
          break;
        case 'failed':
          title = '❌ Deployment Failed';
          message = `Deployment to ${environment} failed`;
          break;
        case 'rollback':
          title = '🔄 Rolling Back';
          message = `Rolling back ${environment} deployment`;
          break;
      }

      const notification: NotificationPayload = {
        type: 'deployment_status',
        title,
        message,
        data: {
          deploymentId,
          environment,
          status,
          details
        },
        broadcast: true,
        persistent: false
      };

      await this.broadcastNotification(notification);

      logger.info(`Deployment notification sent: ${deploymentId} - ${status}`);

    } catch (error) {
      logger.error('Error sending deployment notification:', error);
    }
  }

  async sendSystemAlert(title: string, message: string, severity: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
    try {
      const notification: NotificationPayload = {
        type: 'system_alert',
        title: `${this.getSeverityIcon(severity)} ${title}`,
        message,
        data: {
          severity,
          timestamp: new Date().toISOString()
        },
        broadcast: true,
        persistent: severity === 'error'
      };

      await this.broadcastNotification(notification);

      logger.info(`System alert sent: ${severity} - ${title}`);

    } catch (error) {
      logger.error('Error sending system alert:', error);
    }
  }

  async sendPersonalNotification(userId: string, notification: Omit<NotificationPayload, 'userId'>): Promise<void> {
    try {
      const personalNotification: NotificationPayload = {
        ...notification,
        userId
      };

      await this.sendNotification(personalNotification);

      logger.debug(`Personal notification sent to user ${userId}: ${notification.title}`);

    } catch (error) {
      logger.error('Error sending personal notification:', error);
    }
  }

  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      return false;
    }

    notification.readBy.add(userId);

    // Send confirmation to user
    const userConnections = this.connectionManager.getUserConnections(userId);
    userConnections.forEach(ws => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'notification:marked_read',
          data: { notificationId }
        }));
      }
    });

    return true;
  }

  async getUserNotifications(userId: string): Promise<StoredNotification[]> {
    const notificationIds = this.userNotifications.get(userId) || [];
    return notificationIds
      .map(id => this.notifications.get(id))
      .filter((n): n is StoredNotification => n !== undefined)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getUnreadCount(userId: string): Promise<number> {
    const notifications = await this.getUserNotifications(userId);
    return notifications.filter(n => !n.readBy.has(userId)).length;
  }

  private async sendNotification(notification: NotificationPayload): Promise<void> {
    const stored = this.storeNotification(notification);

    if (notification.userId) {
      // Send to specific user
      this.connectionManager.broadcastToUser(notification.userId, {
        type: 'notification',
        data: stored
      });
    } else if (notification.broadcast) {
      // Broadcast to all users
      await this.broadcastNotification(notification);
    }
  }

  private async broadcastNotification(
    notification: NotificationPayload,
    condition?: (ws: any) => boolean
  ): Promise<void> {
    const stored = this.storeNotification(notification);

    this.connectionManager.broadcastToAll({
      type: 'notification',
      data: stored
    }, condition);
  }

  private storeNotification(notification: NotificationPayload): StoredNotification {
    const stored: StoredNotification = {
      ...notification,
      id: uuidv4(),
      createdAt: new Date(),
      readBy: new Set(),
      expiresAt: notification.persistent ? undefined : new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    this.notifications.set(stored.id, stored);

    // Add to user's notifications if targeted
    if (notification.userId) {
      const userNotifs = this.userNotifications.get(notification.userId) || [];
      userNotifs.push(stored.id);
      
      // Keep only last 100 notifications per user
      if (userNotifs.length > 100) {
        const removed = userNotifs.splice(0, userNotifs.length - 100);
        removed.forEach(id => this.notifications.delete(id));
      }
      
      this.userNotifications.set(notification.userId, userNotifs);
    }

    return stored;
  }

  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      case 'error': return '🚨';
      default: return '📢';
    }
  }

  private startNotificationCleanup(): void {
    // Clean up expired notifications every hour
    setInterval(() => {
      const now = new Date();
      let cleaned = 0;

      for (const [id, notification] of this.notifications.entries()) {
        if (notification.expiresAt && notification.expiresAt < now) {
          this.notifications.delete(id);
          cleaned++;

          // Remove from user notification lists
          for (const [userId, notificationIds] of this.userNotifications.entries()) {
            const index = notificationIds.indexOf(id);
            if (index > -1) {
              notificationIds.splice(index, 1);
              if (notificationIds.length === 0) {
                this.userNotifications.delete(userId);
              }
            }
          }
        }
      }

      if (cleaned > 0) {
        logger.debug(`Cleaned up ${cleaned} expired notifications`);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  // Analytics methods
  getNotificationStats(): {
    total: number;
    byType: Record<string, number>;
    unreadTotal: number;
  } {
    const stats = {
      total: this.notifications.size,
      byType: {} as Record<string, number>,
      unreadTotal: 0
    };

    for (const notification of this.notifications.values()) {
      stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
      
      // Count total unread across all users
      const totalUsers = this.connectionManager.getUserCount();
      const readByCount = notification.readBy.size;
      if (notification.broadcast) {
        stats.unreadTotal += Math.max(0, totalUsers - readByCount);
      } else if (notification.userId && !notification.readBy.has(notification.userId)) {
        stats.unreadTotal += 1;
      }
    }

    return stats;
  }
}