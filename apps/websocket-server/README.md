# Portfolio WebSocket Server

Real-time communication server for the portfolio website providing live updates for visitor counting, chat system, notifications, and deployment status.

## Features

### 🔄 Real-time Visitor Counter
- Live visitor count updates
- Page view tracking
- Geographic visitor distribution
- Session duration analytics

### 💬 Live Chat System
- Multiple chat rooms (General, Coding Help, Feedback)
- Real-time message broadcasting
- Guest and authenticated user support
- Rate limiting and moderation
- Message history

### 🔔 Notification System
- Challenge submission status updates
- Comment approval notifications
- System alerts and announcements
- Personal notifications for authenticated users
- Persistent notification history

### 🚀 Deployment Status Updates
- Real-time deployment progress tracking
- Support for multiple CI/CD platforms (GitHub Actions, GitLab, Jenkins)
- Service health monitoring
- Deployment logs streaming

## Architecture

```
WebSocket Server
├── Connection Manager     # WebSocket connection handling
├── Visitor Counter       # Real-time visitor tracking
├── Chat Service         # Multi-room chat system
├── Notification Service # Push notifications
├── Deployment Service   # CI/CD status updates
└── Message Handler     # Route messages to services
```

## Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit configuration
nano .env

# Development mode
npm run dev

# Production build and start
npm run build
npm start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WEBSOCKET_PORT` | WebSocket server port | 8080 |
| `NODE_ENV` | Environment (development/production) | development |
| `FRONTEND_URL` | Frontend application URL | http://localhost:3000 |
| `JWT_SECRET` | JWT secret for authentication | - |
| `WS_MAX_CONNECTIONS` | Maximum concurrent connections | 1000 |
| `WS_PING_INTERVAL` | Ping interval in milliseconds | 15000 |

## WebSocket API

### Connection

Connect to: `ws://localhost:8080/ws`

Optional authentication via:
- Authorization header: `Bearer <token>`
- Query parameter: `?token=<token>`
- Cookie: `authToken=<token>`

### Message Format

```json
{
  "type": "message_type",
  "data": { ... },
  "messageId": "optional-id",
  "timestamp": "2023-01-01T00:00:00Z"
}
```

### Visitor Tracking

```javascript
// Record page view
ws.send(JSON.stringify({
  type: 'visitor:page_view',
  data: { pagePath: '/blog/post-1' }
}));

// Get visitor stats
ws.send(JSON.stringify({
  type: 'visitor:get_stats'
}));
```

### Chat System

```javascript
// Join a room
ws.send(JSON.stringify({
  type: 'chat:join_room',
  data: { roomId: 'room-id' }
}));

// Send message
ws.send(JSON.stringify({
  type: 'chat:send_message',
  data: {
    roomId: 'room-id',
    content: 'Hello world!',
    type: 'text'
  }
}));

// Get available rooms
ws.send(JSON.stringify({
  type: 'chat:get_rooms'
}));
```

### Notifications

```javascript
// Get notification history
ws.send(JSON.stringify({
  type: 'notification:get_history',
  data: { limit: 50 }
}));

// Mark notification as read
ws.send(JSON.stringify({
  type: 'notification:mark_read',
  data: { notificationId: 'notification-id' }
}));
```

### Deployment Status

```javascript
// Get active deployments
ws.send(JSON.stringify({
  type: 'deployment:get_active'
}));

// Subscribe to deployment updates
ws.send(JSON.stringify({
  type: 'subscribe',
  data: { topics: ['deployments'] }
}));
```

## Webhook Endpoints

### Deployment Webhooks

POST `/webhook/deployment`

Supports webhooks from:
- GitHub Actions
- GitLab CI/CD
- Jenkins
- Generic CI/CD systems

### Manual Notifications

POST `/notify/comment-approval`
```json
{
  "commentId": "comment-123",
  "postId": "post-456",
  "action": "approved"
}
```

POST `/notify/challenge-submission`
```json
{
  "submissionId": "sub-123",
  "challengeId": "challenge-456",
  "status": "accepted"
}
```

## Admin Features

Requires admin role authentication:

```javascript
// Create chat room
ws.send(JSON.stringify({
  type: 'admin:chat:create_room',
  data: {
    name: 'New Room',
    description: 'Room description',
    type: 'public',
    settings: {
      allowGuests: true,
      moderated: false,
      rateLimit: 10
    }
  }
}));

// Send system notification
ws.send(JSON.stringify({
  type: 'admin:notification:send',
  data: {
    title: 'System Maintenance',
    message: 'Scheduled maintenance in 10 minutes',
    severity: 'warning'
  }
}));

// Get system stats
ws.send(JSON.stringify({
  type: 'admin:get_stats'
}));
```

## Rate Limiting

- Chat messages: 5-10 per minute (configurable per room)
- General messages: 100 per 15 minutes per IP
- Connection limit: 1000 concurrent connections

## Security Features

- JWT authentication (optional)
- Origin validation
- Rate limiting
- Input validation
- XSS protection
- CORS configuration
- Connection cleanup

## Health Monitoring

- Health endpoint: `GET /health`
- Stats endpoint: `GET /stats`
- Connection metrics in admin panel

## Docker Support

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["npm", "start"]
```

## Testing

```bash
# Run tests
npm test

# Test coverage
npm run test:coverage

# Integration tests
npm run test:integration
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Ensure all tests pass
5. Submit pull request

## License

MIT License - see LICENSE file for details