import { WebSocket } from 'ws';

export interface User {
  id: string;
  username: string;
  email?: string;
  role?: 'admin' | 'user';
}

export interface ExtendedWebSocket extends WebSocket {
  id: string;
  user?: User;
  ip: string;
  userAgent?: string;
  connectedAt: Date;
  lastPing: Date;
  subscribedRooms: Set<string>;
  rateLimitTokens: Map<string, { count: number; resetTime: number }>;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  messageId?: string;
  timestamp?: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId?: string;
  username: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'system' | 'emoji';
  metadata?: {
    edited?: boolean;
    editedAt?: Date;
    replyTo?: string;
  };
}

export interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private' | 'system';
  maxUsers?: number;
  createdAt: Date;
  createdBy?: string;
  settings: {
    allowGuests: boolean;
    moderated: boolean;
    rateLimit: number; // messages per minute
  };
}

export interface VisitorStats {
  currentCount: number;
  totalToday: number;
  peakToday: number;
  averageSessionTime: number;
  topPages: Array<{
    path: string;
    visitors: number;
  }>;
  countries: Array<{
    code: string;
    name: string;
    count: number;
  }>;
}

export interface NotificationPayload {
  type: 'comment_approval' | 'challenge_submission' | 'deployment_status' | 'system_alert';
  title: string;
  message: string;
  data?: any;
  userId?: string;
  broadcast?: boolean;
  persistent?: boolean;
}

export interface DeploymentStatus {
  id: string;
  environment: 'development' | 'staging' | 'production';
  status: 'pending' | 'building' | 'testing' | 'deploying' | 'success' | 'failed';
  progress: number; // 0-100
  startedAt: Date;
  completedAt?: Date;
  logs: Array<{
    timestamp: Date;
    level: 'info' | 'warn' | 'error';
    message: string;
  }>;
  services: Array<{
    name: string;
    status: 'pending' | 'building' | 'deploying' | 'healthy' | 'unhealthy';
    url?: string;
  }>;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (ws: ExtendedWebSocket, message: WebSocketMessage) => string;
}