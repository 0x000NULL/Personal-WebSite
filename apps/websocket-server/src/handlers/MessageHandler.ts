import { ExtendedWebSocket, WebSocketMessage } from '../types/WebSocket';
import { ConnectionManager } from '../services/ConnectionManager';
import { VisitorCounterService } from '../services/VisitorCounterService';
import { ChatService } from '../services/ChatService';
import { NotificationService } from '../services/NotificationService';
import { DeploymentStatusService } from '../services/DeploymentStatusService';
import { logger } from '../utils/logger';
import { requireAuth, requireRole } from '../middleware/auth';

interface Services {
  connectionManager: ConnectionManager;
  visitorCounter: VisitorCounterService;
  chatService: ChatService;
  notificationService: NotificationService;
  deploymentStatus: DeploymentStatusService;
}

export class MessageHandler {
  private services: Services;

  constructor(services: Services) {
    this.services = services;
  }

  async handleMessage(ws: ExtendedWebSocket, message: WebSocketMessage): Promise<void> {
    try {
      logger.debug(`Handling message: ${message.type} from ${ws.id}`);

      switch (message.type) {
        // Visitor tracking
        case 'visitor:page_view':
          await this.handlePageView(ws, message.data);
          break;

        case 'visitor:get_stats':
          await this.handleGetVisitorStats(ws);
          break;

        // Chat system
        case 'chat:join_room':
          await this.handleJoinRoom(ws, message.data);
          break;

        case 'chat:leave_room':
          await this.handleLeaveRoom(ws, message.data);
          break;

        case 'chat:send_message':
          await this.handleSendMessage(ws, message.data);
          break;

        case 'chat:delete_message':
          await this.handleDeleteMessage(ws, message.data);
          break;

        case 'chat:get_rooms':
          await this.handleGetRooms(ws);
          break;

        case 'chat:get_room_info':
          await this.handleGetRoomInfo(ws, message.data);
          break;

        // Notifications
        case 'notification:get_history':
          await this.handleGetNotificationHistory(ws, message.data);
          break;

        case 'notification:mark_read':
          await this.handleMarkNotificationRead(ws, message.data);
          break;

        case 'notification:get_unread_count':
          await this.handleGetUnreadCount(ws);
          break;

        // Deployment status
        case 'deployment:get_active':
          await this.handleGetActiveDeployments(ws);
          break;

        case 'deployment:get_recent':
          await this.handleGetRecentDeployments(ws, message.data);
          break;

        case 'deployment:get_details':
          await this.handleGetDeploymentDetails(ws, message.data);
          break;

        // Admin actions
        case 'admin:chat:create_room':
          await this.handleAdminCreateRoom(ws, message.data);
          break;

        case 'admin:chat:delete_room':
          await this.handleAdminDeleteRoom(ws, message.data);
          break;

        case 'admin:notification:send':
          await this.handleAdminSendNotification(ws, message.data);
          break;

        case 'admin:get_stats':
          await this.handleAdminGetStats(ws);
          break;

        // System
        case 'ping':
          await this.handlePing(ws);
          break;

        case 'subscribe':
          await this.handleSubscribe(ws, message.data);
          break;

        case 'unsubscribe':
          await this.handleUnsubscribe(ws, message.data);
          break;

        default:
          logger.warn(`Unknown message type: ${message.type} from ${ws.id}`);
          this.sendError(ws, `Unknown message type: ${message.type}`);
      }

    } catch (error) {
      logger.error(`Error handling message ${message.type}:`, error);
      this.sendError(ws, 'Internal server error');
    }
  }

  // Visitor tracking handlers
  private async handlePageView(ws: ExtendedWebSocket, data: { pagePath: string }): Promise<void> {
    if (!data.pagePath) {
      this.sendError(ws, 'Page path is required');
      return;
    }

    await this.services.visitorCounter.onPageView(ws.id, data.pagePath);
    this.sendSuccess(ws, 'Page view recorded');
  }

  private async handleGetVisitorStats(ws: ExtendedWebSocket): Promise<void> {
    const stats = this.services.visitorCounter.getVisitorStats();
    this.sendMessage(ws, {
      type: 'visitor:stats',
      data: stats
    });
  }

  // Chat handlers
  private async handleJoinRoom(ws: ExtendedWebSocket, data: { roomId: string }): Promise<void> {
    if (!data.roomId) {
      this.sendError(ws, 'Room ID is required');
      return;
    }

    const success = await this.services.chatService.joinRoom(ws, data.roomId);
    if (success) {
      this.sendSuccess(ws, `Joined room ${data.roomId}`);
    }
  }

  private async handleLeaveRoom(ws: ExtendedWebSocket, data: { roomId: string }): Promise<void> {
    if (!data.roomId) {
      this.sendError(ws, 'Room ID is required');
      return;
    }

    const success = await this.services.chatService.leaveRoom(ws, data.roomId);
    if (success) {
      this.sendSuccess(ws, `Left room ${data.roomId}`);
    }
  }

  private async handleSendMessage(ws: ExtendedWebSocket, data: any): Promise<void> {
    if (!data.roomId || !data.content) {
      this.sendError(ws, 'Room ID and content are required');
      return;
    }

    const success = await this.services.chatService.sendMessage(ws, data);
    if (success) {
      this.sendSuccess(ws, 'Message sent');
    }
  }

  private async handleDeleteMessage(ws: ExtendedWebSocket, data: { messageId: string; roomId: string }): Promise<void> {
    if (!data.messageId || !data.roomId) {
      this.sendError(ws, 'Message ID and Room ID are required');
      return;
    }

    const success = await this.services.chatService.deleteMessage(ws, data.messageId, data.roomId);
    if (success) {
      this.sendSuccess(ws, 'Message deleted');
    }
  }

  private async handleGetRooms(ws: ExtendedWebSocket): Promise<void> {
    const rooms = this.services.chatService.getRooms();
    this.sendMessage(ws, {
      type: 'chat:rooms',
      data: { rooms }
    });
  }

  private async handleGetRoomInfo(ws: ExtendedWebSocket, data: { roomId: string }): Promise<void> {
    if (!data.roomId) {
      this.sendError(ws, 'Room ID is required');
      return;
    }

    const roomInfo = this.services.chatService.getRoomInfo(data.roomId);
    if (roomInfo) {
      this.sendMessage(ws, {
        type: 'chat:room_info',
        data: roomInfo
      });
    } else {
      this.sendError(ws, 'Room not found');
    }
  }

  // Notification handlers
  private async handleGetNotificationHistory(ws: ExtendedWebSocket, data: { limit?: number }): Promise<void> {
    if (!ws.user) {
      this.sendError(ws, 'Authentication required');
      return;
    }

    const notifications = await this.services.notificationService.getUserNotifications(ws.user.id);
    const limit = data?.limit || 50;
    
    this.sendMessage(ws, {
      type: 'notification:history',
      data: {
        notifications: notifications.slice(0, limit)
      }
    });
  }

  private async handleMarkNotificationRead(ws: ExtendedWebSocket, data: { notificationId: string }): Promise<void> {
    if (!ws.user) {
      this.sendError(ws, 'Authentication required');
      return;
    }

    if (!data.notificationId) {
      this.sendError(ws, 'Notification ID is required');
      return;
    }

    const success = await this.services.notificationService.markAsRead(ws.user.id, data.notificationId);
    if (success) {
      this.sendSuccess(ws, 'Notification marked as read');
    } else {
      this.sendError(ws, 'Notification not found');
    }
  }

  private async handleGetUnreadCount(ws: ExtendedWebSocket): Promise<void> {
    if (!ws.user) {
      this.sendError(ws, 'Authentication required');
      return;
    }

    const unreadCount = await this.services.notificationService.getUnreadCount(ws.user.id);
    this.sendMessage(ws, {
      type: 'notification:unread_count',
      data: { count: unreadCount }
    });
  }

  // Deployment handlers
  private async handleGetActiveDeployments(ws: ExtendedWebSocket): Promise<void> {
    const deployments = this.services.deploymentStatus.getActiveDeployments();
    this.sendMessage(ws, {
      type: 'deployment:active',
      data: { deployments }
    });
  }

  private async handleGetRecentDeployments(ws: ExtendedWebSocket, data: { limit?: number }): Promise<void> {
    const limit = data?.limit || 10;
    const deployments = this.services.deploymentStatus.getRecentDeployments(limit);
    this.sendMessage(ws, {
      type: 'deployment:recent',
      data: { deployments }
    });
  }

  private async handleGetDeploymentDetails(ws: ExtendedWebSocket, data: { deploymentId: string }): Promise<void> {
    if (!data.deploymentId) {
      this.sendError(ws, 'Deployment ID is required');
      return;
    }

    const deployment = this.services.deploymentStatus.getDeployment(data.deploymentId);
    if (deployment) {
      const events = this.services.deploymentStatus.getDeploymentEvents(data.deploymentId);
      this.sendMessage(ws, {
        type: 'deployment:details',
        data: { deployment, events }
      });
    } else {
      this.sendError(ws, 'Deployment not found');
    }
  }

  // Admin handlers
  private async handleAdminCreateRoom(ws: ExtendedWebSocket, data: any): Promise<void> {
    try {
      const user = requireRole(ws.user, 'admin');
      
      if (!data.name || !data.type) {
        this.sendError(ws, 'Room name and type are required');
        return;
      }

      const room = await this.services.chatService.createRoom(user.id, data);
      this.sendMessage(ws, {
        type: 'admin:room_created',
        data: { room }
      });

      // Broadcast new room to all users
      this.services.connectionManager.broadcastToAll({
        type: 'chat:room_added',
        data: { room }
      });

    } catch (error) {
      this.sendError(ws, error instanceof Error ? error.message : 'Permission denied');
    }
  }

  private async handleAdminDeleteRoom(ws: ExtendedWebSocket, data: { roomId: string }): Promise<void> {
    try {
      requireRole(ws.user, 'admin');

      if (!data.roomId) {
        this.sendError(ws, 'Room ID is required');
        return;
      }

      const success = await this.services.chatService.deleteRoom(data.roomId);
      if (success) {
        this.sendSuccess(ws, 'Room deleted');
      } else {
        this.sendError(ws, 'Failed to delete room');
      }

    } catch (error) {
      this.sendError(ws, error instanceof Error ? error.message : 'Permission denied');
    }
  }

  private async handleAdminSendNotification(ws: ExtendedWebSocket, data: any): Promise<void> {
    try {
      requireRole(ws.user, 'admin');

      if (!data.title || !data.message) {
        this.sendError(ws, 'Title and message are required');
        return;
      }

      if (data.userId) {
        await this.services.notificationService.sendPersonalNotification(data.userId, data);
      } else {
        await this.services.notificationService.sendSystemAlert(data.title, data.message, data.severity);
      }

      this.sendSuccess(ws, 'Notification sent');

    } catch (error) {
      this.sendError(ws, error instanceof Error ? error.message : 'Permission denied');
    }
  }

  private async handleAdminGetStats(ws: ExtendedWebSocket): Promise<void> {
    try {
      requireRole(ws.user, 'admin');

      const connectionStats = this.services.connectionManager.getConnectionStats();
      const visitorStats = await this.services.visitorCounter.getDetailedStats();
      const notificationStats = this.services.notificationService.getNotificationStats();
      const deploymentStats = this.services.deploymentStatus.getDeploymentStats();

      this.sendMessage(ws, {
        type: 'admin:stats',
        data: {
          connections: connectionStats,
          visitors: visitorStats,
          notifications: notificationStats,
          deployments: deploymentStats
        }
      });

    } catch (error) {
      this.sendError(ws, error instanceof Error ? error.message : 'Permission denied');
    }
  }

  // System handlers
  private async handlePing(ws: ExtendedWebSocket): Promise<void> {
    ws.lastPing = new Date();
    this.sendMessage(ws, {
      type: 'pong',
      data: { timestamp: new Date().toISOString() }
    });
  }

  private async handleSubscribe(ws: ExtendedWebSocket, data: { topics: string[] }): Promise<void> {
    if (!data.topics || !Array.isArray(data.topics)) {
      this.sendError(ws, 'Topics array is required');
      return;
    }

    // Subscribe to general topics (like deployment updates, system alerts)
    for (const topic of data.topics) {
      this.services.connectionManager.subscribeToRoom(ws.id, `topic:${topic}`);
    }

    this.sendSuccess(ws, `Subscribed to ${data.topics.length} topics`);
  }

  private async handleUnsubscribe(ws: ExtendedWebSocket, data: { topics: string[] }): Promise<void> {
    if (!data.topics || !Array.isArray(data.topics)) {
      this.sendError(ws, 'Topics array is required');
      return;
    }

    for (const topic of data.topics) {
      this.services.connectionManager.unsubscribeFromRoom(ws.id, `topic:${topic}`);
    }

    this.sendSuccess(ws, `Unsubscribed from ${data.topics.length} topics`);
  }

  // Utility methods
  private sendMessage(ws: ExtendedWebSocket, message: any): void {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify(message));
    }
  }

  private sendSuccess(ws: ExtendedWebSocket, message: string): void {
    this.sendMessage(ws, {
      type: 'success',
      data: { message }
    });
  }

  private sendError(ws: ExtendedWebSocket, message: string): void {
    this.sendMessage(ws, {
      type: 'error',
      data: { message }
    });
  }
}