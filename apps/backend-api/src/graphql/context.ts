import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel, User } from '../models/User';
import { createDataLoaders, DataLoaders } from './dataloaders';
import { SubscriptionPublisher } from './resolvers/SubscriptionResolver';
import { PubSub } from 'graphql-subscriptions';

export interface Context {
  req?: Request;
  res?: Response;
  user?: User;
  loaders: DataLoaders;
  pubSub: PubSub;
  publisher: SubscriptionPublisher;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEditor: boolean;
}

export interface GraphQLContext {
  req?: Request;
  res?: Response;
  connection?: any; // For subscriptions
}

export async function createContext({ req, res, connection }: GraphQLContext): Promise<Context> {
  const pubSub = new PubSub();
  const publisher = new SubscriptionPublisher(pubSub);
  const loaders = createDataLoaders();

  let user: User | undefined;
  let isAuthenticated = false;
  let isAdmin = false;
  let isEditor = false;

  // Handle authentication for HTTP requests
  if (req) {
    const token = extractToken(req);
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        user = await UserModel.findById(decoded.userId);
        if (user && user.isActive) {
          isAuthenticated = true;
          isAdmin = user.role === 'admin';
          isEditor = user.role === 'editor' || user.role === 'admin';
        }
      } catch (error) {
        console.warn('Invalid JWT token:', error);
      }
    }
  }

  // Handle authentication for WebSocket connections (subscriptions)
  if (connection) {
    const token = connection.context?.Authorization?.replace('Bearer ', '') ||
                 connection.context?.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        user = await UserModel.findById(decoded.userId);
        if (user && user.isActive) {
          isAuthenticated = true;
          isAdmin = user.role === 'admin';
          isEditor = user.role === 'editor' || user.role === 'admin';
        }
      } catch (error) {
        console.warn('Invalid JWT token in subscription:', error);
      }
    }
  }

  return {
    req,
    res,
    user,
    loaders,
    pubSub,
    publisher,
    isAuthenticated,
    isAdmin,
    isEditor
  };
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Also check for token in cookies (for browser requests)
  const cookieToken = req.cookies?.token;
  if (cookieToken) {
    return cookieToken;
  }

  // Check query parameter (for development/testing)
  const queryToken = req.query.token as string;
  if (queryToken) {
    return queryToken;
  }

  return null;
}

// Custom authorization checker
export const customAuthChecker = (resolverData: any, roles: string[]): boolean => {
  const { context }: { context: Context } = resolverData;

  // If no roles specified, just check if authenticated
  if (!roles || roles.length === 0) {
    return context.isAuthenticated;
  }

  // Check if user has any of the required roles
  if (!context.user) {
    return false;
  }

  return roles.includes(context.user.role);
};