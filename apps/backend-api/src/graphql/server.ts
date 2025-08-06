import { ApolloServer } from 'apollo-server-express';
import { Application } from 'express';
import { createServer } from 'http';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { execute, subscribe } from 'graphql';
import depthLimit from 'graphql-depth-limit';
import costAnalysis from 'graphql-query-complexity';
import { createGraphQLSchema } from './schema';
import { createContext, GraphQLContext } from './context';

export async function setupGraphQLServer(app: Application) {
  // Create GraphQL schema
  const schema = await createGraphQLSchema();

  // Create Apollo Server
  const server = new ApolloServer({
    schema,
    context: ({ req, res, connection }: GraphQLContext) => {
      return createContext({ req, res, connection });
    },
    introspection: process.env.NODE_ENV !== 'production',
    playground: process.env.NODE_ENV !== 'production',
    subscriptions: {
      path: '/graphql-subscriptions',
      onConnect: (connectionParams: any) => {
        // Handle WebSocket connection authentication
        console.log('GraphQL subscription client connected');
        return {
          authorization: connectionParams.authorization || connectionParams.Authorization
        };
      },
      onDisconnect: () => {
        console.log('GraphQL subscription client disconnected');
      }
    },
    plugins: [
      // Query complexity analysis
      {
        requestDidStart: () => ({
          didResolveOperation({ request, document }) {
            const complexity = costAnalysis({
              maximumCost: 1000,
              variables: request.variables,
              schema,
              query: document,
              createError: (max, actual) => {
                return new Error(
                  `Query complexity limit exceeded. Maximum: ${max}, Actual: ${actual}`
                );
              }
            });
          }
        })
      }
    ],
    validationRules: [
      depthLimit(10), // Limit query depth to 10
    ],
    formatError: (error) => {
      // Log errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error('GraphQL Error:', error);
      }

      // Don't expose internal errors in production
      if (process.env.NODE_ENV === 'production' && error.message.startsWith('Database')) {
        return new Error('Internal server error');
      }

      return {
        message: error.message,
        code: error.extensions?.code,
        path: error.path,
        locations: error.locations
      };
    },
    formatResponse: (response) => {
      // Add custom headers or modify response
      return response;
    }
  });

  // Apply middleware to Express app
  server.applyMiddleware({ 
    app, 
    path: '/graphql',
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    }
  });

  // Create HTTP server for subscriptions
  const httpServer = createServer(app);

  // Set up subscription server
  const subscriptionServer = new SubscriptionServer(
    {
      execute,
      subscribe,
      schema,
      onConnect: (connectionParams, webSocket, context) => {
        console.log('GraphQL subscription client connected');
        return {
          authorization: connectionParams.authorization || connectionParams.Authorization
        };
      },
      onDisconnect: (webSocket, context) => {
        console.log('GraphQL subscription client disconnected');
      }
    },
    {
      server: httpServer,
      path: '/graphql-subscriptions'
    }
  );

  return {
    server,
    httpServer,
    subscriptionServer,
    graphqlPath: server.graphqlPath
  };
}