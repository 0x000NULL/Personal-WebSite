import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { corsOptions } from './config/cors';
import { helmetConfig, additionalSecurityHeaders } from './config/helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { connectDatabase } from './config/database';
import { setupMiddleware } from './middleware';
import { setupRoutes } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { setupSwagger } from './config/swagger';
import { startCronJobs } from './services/cronJobs';
import { setupGraphQLServer } from './graphql/server';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected successfully');

    // Basic middleware
    app.use(helmetConfig());
    app.use(additionalSecurityHeaders);
    app.use(compression());
    app.use(morgan('combined'));
    app.use(cors(corsOptions));

    // Setup additional middleware
    setupMiddleware(app);

    // Setup GraphQL server
    const { server: graphqlServer, httpServer, graphqlPath } = await setupGraphQLServer(app);
    console.log(`🔗 GraphQL server ready at http://localhost:${PORT}${graphqlPath}`);
    console.log(`🔔 GraphQL subscriptions ready at ws://localhost:${PORT}/graphql-subscriptions`);

    // Setup API documentation
    setupSwagger(app);

    // Setup REST routes
    setupRoutes(app);

    // Global error handler (must be last)
    app.use(errorHandler);

    // Start cron jobs
    startCronJobs();

    // Start server with WebSocket support
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📖 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`🎯 GraphQL Playground: http://localhost:${PORT}${graphqlPath}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();