import { v4 as uuidv4 } from 'uuid';
import { ConnectionManager } from './ConnectionManager';
import { ExtendedWebSocket, ChatMessage, ChatRoom } from '../types/WebSocket';
import { logger } from '../utils/logger';
import { config } from '../config/config';

export class ChatService {
  private connectionManager: ConnectionManager;
  private rooms: Map<string, ChatRoom> = new Map();
  private recentMessages: Map<string, ChatMessage[]> = new Map(); // roomId -> messages
  private userRateLimits: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(connectionManager: ConnectionManager) {
    this.connectionManager = connectionManager;
    this.initializeDefaultRooms();
    this.startRateLimitCleanup();
  }

  private initializeDefaultRooms(): void {
    // Create default public rooms
    const defaultRooms: Omit<ChatRoom, 'id' | 'createdAt'>[] = [
      {
        name: 'General',
        description: 'General discussion about the portfolio and projects',
        type: 'public',
        maxUsers: 100,
        createdBy: 'system',
        settings: {
          allowGuests: true,
          moderated: false,
          rateLimit: 10 // messages per minute
        }
      },
      {
        name: 'Coding Help',
        description: 'Ask questions about programming and get help',
        type: 'public',
        maxUsers: 50,
        createdBy: 'system',
        settings: {
          allowGuests: true,
          moderated: true,
          rateLimit: 5
        }
      },
      {
        name: 'Feedback',
        description: 'Share feedback about the website and projects',
        type: 'public',
        maxUsers: 25,
        createdBy: 'system',
        settings: {
          allowGuests: true,
          moderated: false,
          rateLimit: 3
        }
      }
    ];

    defaultRooms.forEach(roomData => {
      const room: ChatRoom = {
        ...roomData,
        id: uuidv4(),
        createdAt: new Date()
      };
      this.rooms.set(room.id, room);
      this.recentMessages.set(room.id, []);
      
      logger.info(`Created default chat room: ${room.name} (${room.id})`);
    });
  }

  async joinRoom(ws: ExtendedWebSocket, roomId: string): Promise<boolean> {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        this.sendError(ws, 'Room not found');
        return false;
      }

      // Check if room allows guests
      if (!room.settings.allowGuests && !ws.user) {
        this.sendError(ws, 'Authentication required for this room');
        return false;
      }

      // Check room capacity
      const currentUsers = this.connectionManager.getRoomConnections(roomId);
      if (room.maxUsers && currentUsers.length >= room.maxUsers) {
        this.sendError(ws, 'Room is full');
        return false;
      }

      // Subscribe to room
      const success = this.connectionManager.subscribeToRoom(ws.id, roomId);
      if (!success) {
        this.sendError(ws, 'Failed to join room');
        return false;
      }

      // Send room info and recent messages
      this.sendMessage(ws, {
        type: 'chat:room_joined',
        data: {
          room,
          recentMessages: this.getRecentMessages(roomId, 50),
          userCount: currentUsers.length + 1
        }
      });

      // Notify other users in the room
      this.connectionManager.broadcastToRoom(roomId, {
        type: 'chat:user_joined',
        data: {
          roomId,
          user: ws.user ? {
            id: ws.user.id,
            username: ws.user.username
          } : {
            username: 'Anonymous User'
          },
          userCount: currentUsers.length + 1,
          timestamp: new Date().toISOString()
        }
      }, ws.id);

      logger.debug(`User ${ws.user?.username || 'anonymous'} joined room ${room.name}`);
      return true;

    } catch (error) {
      logger.error('Error joining room:', error);
      this.sendError(ws, 'Failed to join room');
      return false;
    }
  }

  async leaveRoom(ws: ExtendedWebSocket, roomId: string): Promise<boolean> {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        return false;
      }

      const success = this.connectionManager.unsubscribeFromRoom(ws.id, roomId);
      if (!success) {
        return false;
      }

      // Notify other users in the room
      const remainingUsers = this.connectionManager.getRoomConnections(roomId);
      this.connectionManager.broadcastToRoom(roomId, {
        type: 'chat:user_left',
        data: {
          roomId,
          user: ws.user ? {
            id: ws.user.id,
            username: ws.user.username
          } : {
            username: 'Anonymous User'
          },
          userCount: remainingUsers.length,
          timestamp: new Date().toISOString()
        }
      });

      logger.debug(`User ${ws.user?.username || 'anonymous'} left room ${room.name}`);
      return true;

    } catch (error) {
      logger.error('Error leaving room:', error);
      return false;
    }
  }

  async leaveAllRooms(ws: ExtendedWebSocket): Promise<void> {
    const roomIds = Array.from(ws.subscribedRooms);
    for (const roomId of roomIds) {
      await this.leaveRoom(ws, roomId);
    }
  }

  async sendMessage(ws: ExtendedWebSocket, messageData: {
    roomId: string;
    content: string;
    type?: 'text' | 'emoji';
    replyTo?: string;
  }): Promise<boolean> {
    try {
      const { roomId, content, type = 'text', replyTo } = messageData;

      const room = this.rooms.get(roomId);
      if (!room) {
        this.sendError(ws, 'Room not found');
        return false;
      }

      // Check if user is in the room
      if (!ws.subscribedRooms.has(roomId)) {
        this.sendError(ws, 'You are not in this room');
        return false;
      }

      // Rate limiting
      const userKey = ws.user?.id || ws.ip;
      if (!this.checkRateLimit(userKey, room.settings.rateLimit)) {
        this.sendError(ws, 'Rate limit exceeded. Please slow down.');
        return false;
      }

      // Validate message content
      const trimmedContent = content.trim();
      if (!trimmedContent || trimmedContent.length > 1000) {
        this.sendError(ws, 'Message content is invalid');
        return false;
      }

      // Create chat message
      const chatMessage: ChatMessage = {
        id: uuidv4(),
        roomId,
        userId: ws.user?.id,
        username: ws.user?.username || 'Anonymous',
        content: trimmedContent,
        timestamp: new Date(),
        type,
        metadata: replyTo ? { replyTo } : undefined
      };

      // Store message
      this.addMessageToRoom(roomId, chatMessage);

      // Broadcast to all users in the room
      this.connectionManager.broadcastToRoom(roomId, {
        type: 'chat:message',
        data: chatMessage
      });

      logger.debug(`Chat message sent in ${room.name}: ${ws.user?.username || 'anonymous'}`);
      return true;

    } catch (error) {
      logger.error('Error sending chat message:', error);
      this.sendError(ws, 'Failed to send message');
      return false;
    }
  }

  async deleteMessage(ws: ExtendedWebSocket, messageId: string, roomId: string): Promise<boolean> {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        return false;
      }

      const messages = this.recentMessages.get(roomId) || [];
      const messageIndex = messages.findIndex(m => m.id === messageId);
      
      if (messageIndex === -1) {
        this.sendError(ws, 'Message not found');
        return false;
      }

      const message = messages[messageIndex];
      
      // Check if user can delete the message (own message or admin)
      if (message.userId !== ws.user?.id && ws.user?.role !== 'admin') {
        this.sendError(ws, 'You can only delete your own messages');
        return false;
      }

      // Remove message
      messages.splice(messageIndex, 1);

      // Broadcast deletion
      this.connectionManager.broadcastToRoom(roomId, {
        type: 'chat:message_deleted',
        data: {
          messageId,
          roomId,
          timestamp: new Date().toISOString()
        }
      });

      return true;

    } catch (error) {
      logger.error('Error deleting message:', error);
      return false;
    }
  }

  getRooms(): ChatRoom[] {
    return Array.from(this.rooms.values())
      .filter(room => room.type === 'public')
      .map(room => ({
        ...room,
        // Don't expose sensitive settings to clients
        settings: {
          allowGuests: room.settings.allowGuests,
          moderated: room.settings.moderated,
          rateLimit: room.settings.rateLimit
        }
      }));
  }

  getRoomInfo(roomId: string): (ChatRoom & { userCount: number; onlineUsers: Array<{ username: string }> }) | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    const connections = this.connectionManager.getRoomConnections(roomId);
    const onlineUsers = connections.map(ws => ({
      username: ws.user?.username || 'Anonymous'
    }));

    return {
      ...room,
      userCount: connections.length,
      onlineUsers
    };
  }

  private addMessageToRoom(roomId: string, message: ChatMessage): void {
    const messages = this.recentMessages.get(roomId) || [];
    messages.push(message);

    // Keep only the last 100 messages per room
    if (messages.length > 100) {
      messages.splice(0, messages.length - 100);
    }

    this.recentMessages.set(roomId, messages);
  }

  private getRecentMessages(roomId: string, limit: number = 50): ChatMessage[] {
    const messages = this.recentMessages.get(roomId) || [];
    return messages.slice(-limit);
  }

  private checkRateLimit(userKey: string, messagesPerMinute: number): boolean {
    const now = Date.now();
    const windowStart = now - (60 * 1000); // 1 minute window

    let rateLimit = this.userRateLimits.get(userKey);
    
    if (!rateLimit || rateLimit.resetTime <= windowStart) {
      // Reset or initialize rate limit
      rateLimit = {
        count: 1,
        resetTime: now
      };
      this.userRateLimits.set(userKey, rateLimit);
      return true;
    }

    if (rateLimit.count >= messagesPerMinute) {
      return false;
    }

    rateLimit.count++;
    return true;
  }

  private startRateLimitCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const cutoff = now - (5 * 60 * 1000); // Clean up entries older than 5 minutes

      for (const [userKey, rateLimit] of this.userRateLimits.entries()) {
        if (rateLimit.resetTime <= cutoff) {
          this.userRateLimits.delete(userKey);
        }
      }
    }, 60 * 1000); // Run every minute
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  private sendMessage(ws: ExtendedWebSocket, message: any): void {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: ExtendedWebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      data: { message: error }
    });
  }

  // Admin methods
  async createRoom(creatorId: string, roomData: Omit<ChatRoom, 'id' | 'createdAt' | 'createdBy'>): Promise<ChatRoom> {
    const room: ChatRoom = {
      ...roomData,
      id: uuidv4(),
      createdAt: new Date(),
      createdBy: creatorId
    };

    this.rooms.set(room.id, room);
    this.recentMessages.set(room.id, []);

    logger.info(`New chat room created: ${room.name} by ${creatorId}`);
    return room;
  }

  async deleteRoom(roomId: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room || room.createdBy === 'system') {
      return false;
    }

    // Notify all users in the room
    this.connectionManager.broadcastToRoom(roomId, {
      type: 'chat:room_deleted',
      data: { roomId, roomName: room.name }
    });

    // Force leave all users
    const connections = this.connectionManager.getRoomConnections(roomId);
    connections.forEach(ws => {
      ws.subscribedRooms.delete(roomId);
    });

    this.rooms.delete(roomId);
    this.recentMessages.delete(roomId);

    logger.info(`Chat room deleted: ${room.name}`);
    return true;
  }
}