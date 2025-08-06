import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';
import { ExtendedWebSocket, User } from '../types/WebSocket';
import { logger } from '../utils/logger';
import { config } from '../config/config';

export class ConnectionManager {
  private connections: Map<string, ExtendedWebSocket> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> connectionIds
  private roomConnections: Map<string, Set<string>> = new Map(); // roomId -> connectionIds

  generateConnectionId(): string {
    return uuidv4();
  }

  addConnection(ws: ExtendedWebSocket): void {
    if (this.connections.size >= config.websocket.maxConnections) {
      logger.warn('Maximum connections reached, rejecting new connection');
      ws.close(1013, 'Service overloaded');
      return;
    }

    this.connections.set(ws.id, ws);
    ws.subscribedRooms = new Set();
    ws.rateLimitTokens = new Map();

    // Track user connections
    if (ws.user) {
      if (!this.userConnections.has(ws.user.id)) {
        this.userConnections.set(ws.user.id, new Set());
      }
      this.userConnections.get(ws.user.id)!.add(ws.id);
    }

    logger.debug(`Connection added: ${ws.id}, Total: ${this.connections.size}`);
  }

  removeConnection(connectionId: string): void {
    const ws = this.connections.get(connectionId);
    if (!ws) {
      return;
    }

    // Remove from user connections
    if (ws.user) {
      const userConnections = this.userConnections.get(ws.user.id);
      if (userConnections) {
        userConnections.delete(connectionId);
        if (userConnections.size === 0) {
          this.userConnections.delete(ws.user.id);
        }
      }
    }

    // Remove from all subscribed rooms
    ws.subscribedRooms.forEach(roomId => {
      const roomConnections = this.roomConnections.get(roomId);
      if (roomConnections) {
        roomConnections.delete(connectionId);
        if (roomConnections.size === 0) {
          this.roomConnections.delete(roomId);
        }
      }
    });

    this.connections.delete(connectionId);
    logger.debug(`Connection removed: ${connectionId}, Total: ${this.connections.size}`);
  }

  getConnection(connectionId: string): ExtendedWebSocket | undefined {
    return this.connections.get(connectionId);
  }

  getAllConnections(): ExtendedWebSocket[] {
    return Array.from(this.connections.values());
  }

  getUserConnections(userId: string): ExtendedWebSocket[] {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) {
      return [];
    }

    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((ws): ws is ExtendedWebSocket => ws !== undefined);
  }

  getRoomConnections(roomId: string): ExtendedWebSocket[] {
    const connectionIds = this.roomConnections.get(roomId);
    if (!connectionIds) {
      return [];
    }

    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((ws): ws is ExtendedWebSocket => ws !== undefined);
  }

  subscribeToRoom(connectionId: string, roomId: string): boolean {
    const ws = this.connections.get(connectionId);
    if (!ws) {
      return false;
    }

    // Check if user can join more rooms
    if (ws.subscribedRooms.size >= config.websocket.maxRoomsPerUser) {
      logger.warn(`User ${ws.user?.id || 'anonymous'} trying to join too many rooms`);
      return false;
    }

    ws.subscribedRooms.add(roomId);

    if (!this.roomConnections.has(roomId)) {
      this.roomConnections.set(roomId, new Set());
    }
    this.roomConnections.get(roomId)!.add(connectionId);

    logger.debug(`Connection ${connectionId} subscribed to room ${roomId}`);
    return true;
  }

  unsubscribeFromRoom(connectionId: string, roomId: string): boolean {
    const ws = this.connections.get(connectionId);
    if (!ws) {
      return false;
    }

    ws.subscribedRooms.delete(roomId);

    const roomConnections = this.roomConnections.get(roomId);
    if (roomConnections) {
      roomConnections.delete(connectionId);
      if (roomConnections.size === 0) {
        this.roomConnections.delete(roomId);
      }
    }

    logger.debug(`Connection ${connectionId} unsubscribed from room ${roomId}`);
    return true;
  }

  broadcastToRoom(roomId: string, message: any, excludeConnectionId?: string): void {
    const connections = this.getRoomConnections(roomId);
    const messageStr = JSON.stringify(message);

    let sentCount = 0;
    connections.forEach(ws => {
      if (ws.id !== excludeConnectionId && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
          sentCount++;
        } catch (error) {
          logger.error(`Error sending message to connection ${ws.id}:`, error);
        }
      }
    });

    logger.debug(`Broadcast to room ${roomId}: ${sentCount} recipients`);
  }

  broadcastToUser(userId: string, message: any): void {
    const connections = this.getUserConnections(userId);
    const messageStr = JSON.stringify(message);

    let sentCount = 0;
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
          sentCount++;
        } catch (error) {
          logger.error(`Error sending message to user connection ${ws.id}:`, error);
        }
      }
    });

    logger.debug(`Broadcast to user ${userId}: ${sentCount} connections`);
  }

  broadcastToAll(message: any, condition?: (ws: ExtendedWebSocket) => boolean): void {
    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    this.connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN && (!condition || condition(ws))) {
        try {
          ws.send(messageStr);
          sentCount++;
        } catch (error) {
          logger.error(`Error sending broadcast message to connection ${ws.id}:`, error);
        }
      }
    });

    logger.debug(`Broadcast to all: ${sentCount} recipients`);
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getRoomCount(): number {
    return this.roomConnections.size;
  }

  getUserCount(): number {
    return this.userConnections.size;
  }

  getConnectionStats(): {
    totalConnections: number;
    authenticatedUsers: number;
    anonymousConnections: number;
    totalRooms: number;
  } {
    const authenticatedConnections = Array.from(this.connections.values())
      .filter(ws => ws.user).length;

    return {
      totalConnections: this.connections.size,
      authenticatedUsers: this.userConnections.size,
      anonymousConnections: this.connections.size - authenticatedConnections,
      totalRooms: this.roomConnections.size
    };
  }

  cleanupStaleConnections(): void {
    const now = Date.now();
    const staleConnections: string[] = [];

    this.connections.forEach((ws, connectionId) => {
      if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        staleConnections.push(connectionId);
      } else {
        // Check for stale connections (no activity for 5 minutes)
        const timeSinceLastPing = now - ws.lastPing.getTime();
        if (timeSinceLastPing > 300000) { // 5 minutes
          logger.warn(`Terminating stale connection: ${connectionId}`);
          ws.terminate();
          staleConnections.push(connectionId);
        }
      }
    });

    staleConnections.forEach(connectionId => {
      this.removeConnection(connectionId);
    });

    if (staleConnections.length > 0) {
      logger.info(`Cleaned up ${staleConnections.length} stale connections`);
    }
  }
}

// Utility function to start cleanup interval
export function startConnectionCleanup(connectionManager: ConnectionManager, intervalMs = 60000): NodeJS.Timeout {
  return setInterval(() => {
    connectionManager.cleanupStaleConnections();
  }, intervalMs);
}