import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/config';
import { ConnectionManager } from './services/ConnectionManager';
import { VisitorCounterService } from './services/VisitorCounterService';
import { ChatService } from './services/ChatService';
import { NotificationService } from './services/NotificationService';
import { DeploymentStatusService } from './services/DeploymentStatusService';
import { MessageHandler } from './handlers/MessageHandler';
import { logger } from './utils/logger';
import { authenticateWebSocket } from './middleware/auth';
import type { ExtendedWebSocket, WebSocketMessage } from './types/WebSocket';

class WebSocketServerApp {
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer;
  private connectionManager: ConnectionManager;
  private visitorCounter: VisitorCounterService;
  private chatService: ChatService;
  private notificationService: NotificationService;
  private deploymentStatus: DeploymentStatusService;
  private messageHandler: MessageHandler;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.setupMiddleware();
    this.setupWebSocketServer();
    this.initializeServices();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    }));
    this.app.use(express.json({ limit: '10mb' }));
  }

  private setupWebSocketServer(): void {
    this.wss = new WebSocketServer({
      server: this.server,
      path: '/ws',
      verifyClient: (info) => {
        const origin = info.origin;
        const allowedOrigins = [
          process.env.FRONTEND_URL || 'http://localhost:3000',
          'http://localhost:3000',
          'https://localhost:3000'
        ];
        
        if (!origin || !allowedOrigins.includes(origin)) {
          logger.warn(`WebSocket connection rejected from origin: ${origin}`);
          return false;
        }
        
        return true;
      }
    });

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  private initializeServices(): void {
    this.connectionManager = new ConnectionManager();
    this.visitorCounter = new VisitorCounterService(this.connectionManager);
    this.chatService = new ChatService(this.connectionManager);
    this.notificationService = new NotificationService(this.connectionManager);
    this.deploymentStatus = new DeploymentStatusService(this.connectionManager);
    
    this.messageHandler = new MessageHandler({
      connectionManager: this.connectionManager,
      visitorCounter: this.visitorCounter,
      chatService: this.chatService,
      notificationService: this.notificationService,
      deploymentStatus: this.deploymentStatus
    });
  }

  private async handleConnection(ws: WebSocket, req: any): Promise<void> {
    const extendedWs = ws as ExtendedWebSocket;
    
    try {
      // Extract connection info
      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      
      // Try to authenticate the user (optional)
      const user = await authenticateWebSocket(req);
      
      // Initialize connection
      extendedWs.id = this.connectionManager.generateConnectionId();
      extendedWs.user = user;
      extendedWs.ip = ip;
      extendedWs.userAgent = userAgent;
      extendedWs.connectedAt = new Date();
      extendedWs.lastPing = new Date();
      
      // Register connection
      this.connectionManager.addConnection(extendedWs);
      
      // Update visitor counter
      await this.visitorCounter.onUserConnected(extendedWs);
      
      logger.info(`WebSocket connection established: ${extendedWs.id} (User: ${user?.id || 'anonymous'})`);
      
      // Send welcome message
      this.sendMessage(extendedWs, {
        type: 'connection:established',
        data: {
          connectionId: extendedWs.id,
          timestamp: new Date().toISOString(),
          user: user ? { id: user.id, username: user.username } : null
        }
      });
      
      // Setup event handlers
      extendedWs.on('message', (data) => this.handleMessage(extendedWs, data));
      extendedWs.on('close', () => this.handleDisconnection(extendedWs));
      extendedWs.on('error', (error) => this.handleError(extendedWs, error));
      extendedWs.on('pong', () => {
        extendedWs.lastPing = new Date();
      });
      
    } catch (error) {
      logger.error('Error establishing WebSocket connection:', error);
      extendedWs.close(1002, 'Connection initialization failed');
    }
  }

  private async handleMessage(ws: ExtendedWebSocket, data: any): Promise<void> {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      await this.messageHandler.handleMessage(ws, message);
    } catch (error) {
      logger.error(`Error handling message from ${ws.id}:`, error);
      this.sendError(ws, 'Invalid message format');
    }
  }

  private async handleDisconnection(ws: ExtendedWebSocket): Promise<void> {
    logger.info(`WebSocket disconnected: ${ws.id}`);
    
    try {
      // Update visitor counter
      await this.visitorCounter.onUserDisconnected(ws);
      
      // Leave any chat rooms
      await this.chatService.leaveAllRooms(ws);
      
      // Remove connection
      this.connectionManager.removeConnection(ws.id);
      
    } catch (error) {
      logger.error(`Error handling disconnection for ${ws.id}:`, error);
    }
  }

  private handleError(ws: ExtendedWebSocket, error: Error): void {
    logger.error(`WebSocket error for ${ws.id}:`, error);
  }

  private sendMessage(ws: ExtendedWebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: ExtendedWebSocket, message: string): void {
    this.sendMessage(ws, {
      type: 'error',
      data: { message }
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        connections: this.connectionManager.getConnectionCount(),
        uptime: process.uptime()
      });
    });

    // Connection stats
    this.app.get('/stats', (req, res) => {
      res.json({
        connections: this.connectionManager.getConnectionCount(),
        rooms: this.chatService.getRoomCount(),
        visitors: this.visitorCounter.getCurrentCount()
      });
    });

    // Webhook endpoints for external services
    this.app.post('/webhook/deployment', (req, res) => {
      this.deploymentStatus.handleDeploymentWebhook(req.body);
      res.json({ success: true });
    });

    // Admin endpoints for notifications
    this.app.post('/notify/comment-approval', (req, res) => {
      const { commentId, postId, action } = req.body;
      this.notificationService.notifyCommentApproval(commentId, postId, action);
      res.json({ success: true });
    });

    this.app.post('/notify/challenge-submission', (req, res) => {
      const { submissionId, challengeId, status } = req.body;
      this.notificationService.notifyChallengeSubmission(submissionId, challengeId, status);
      res.json({ success: true });
    });
  }

  private startPingInterval(): void {
    setInterval(() => {
      this.connectionManager.getAllConnections().forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          // Check if connection is stale (no pong received in 30 seconds)
          const timeSinceLastPing = Date.now() - ws.lastPing.getTime();
          if (timeSinceLastPing > 30000) {
            logger.warn(`Closing stale connection: ${ws.id}`);
            ws.terminate();
            return;
          }
          
          // Send ping
          ws.ping();
        }
      });
    }, 15000); // Every 15 seconds
  }

  public start(port: number = config.port): void {
    this.server.listen(port, () => {
      logger.info(`WebSocket server started on port ${port}`);
      logger.info(`WebSocket path: /ws`);
      this.startPingInterval();
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      this.server.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      this.server.close(() => {
        process.exit(0);
      });
    });
  }
}

// Start the server
const app = new WebSocketServerApp();
app.start();

export default WebSocketServerApp;