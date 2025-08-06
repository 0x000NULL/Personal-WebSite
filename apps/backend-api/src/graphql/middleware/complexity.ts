import { GraphQLError } from 'graphql';
import { MiddlewareFn } from 'type-graphql';
import { Context } from '../context';

// Rate limiting storage (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export interface ComplexityOptions {
  maximumCost: number;
  scalarCost?: number;
  objectCost?: number;
  listFactor?: number;
  introspectionCost?: number;
}

export const defaultComplexityOptions: ComplexityOptions = {
  maximumCost: 1000,
  scalarCost: 1,
  objectCost: 2,
  listFactor: 10,
  introspectionCost: 1000
};

// Field complexity calculator
export function calculateFieldComplexity(
  type: string,
  args: any = {},
  childComplexity: number = 0
): number {
  const options = defaultComplexityOptions;
  
  // Base complexity
  let complexity = options.objectCost || 2;
  
  // Add child complexity
  complexity += childComplexity;
  
  // Handle pagination arguments
  if (args.pagination?.limit) {
    const limit = Math.min(args.pagination.limit, 100);
    complexity *= Math.ceil(limit / 10); // Factor in pagination
  }
  
  // Handle list operations
  if (args.limit) {
    const limit = Math.min(args.limit, 100);
    complexity *= Math.ceil(limit / 10);
  }
  
  // Expensive operations
  switch (type) {
    case 'githubActivity':
      complexity *= 5; // GitHub API calls are expensive
      break;
    case 'analyticsOverview':
      complexity *= 3; // Multiple database queries
      break;
    case 'siteStats':
      complexity *= 2; // Aggregation queries
      break;
    case 'challenges':
    case 'posts':
    case 'comments':
      complexity *= 1.5; // Collection queries
      break;
  }
  
  return Math.ceil(complexity);
}

// Rate limiting middleware
export const RateLimitMiddleware: MiddlewareFn<Context> = async (
  { context, info },
  next
) => {
  const { req, user } = context;
  
  if (!req) {
    return next();
  }
  
  // Determine rate limit key
  const identifier = user?.id || req.ip || 'anonymous';
  const key = `graphql:${identifier}`;
  
  // Get current time window (1 minute)
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const windowStart = Math.floor(now / windowMs) * windowMs;
  
  // Get or create rate limit entry
  let rateLimit = rateLimitStore.get(key);
  if (!rateLimit || rateLimit.resetTime < windowStart) {
    rateLimit = { count: 0, resetTime: windowStart + windowMs };
    rateLimitStore.set(key, rateLimit);
  }
  
  // Determine rate limits based on user type
  const limits = {
    anonymous: 100,    // 100 requests per minute for anonymous users
    user: 300,         // 300 requests per minute for authenticated users
    editor: 500,       // 500 requests per minute for editors
    admin: 1000        // 1000 requests per minute for admins
  };
  
  const userType = user ? user.role : 'anonymous';
  const maxRequests = limits[userType as keyof typeof limits] || limits.anonymous;
  
  // Check if rate limit exceeded
  if (rateLimit.count >= maxRequests) {
    throw new GraphQLError(
      `Rate limit exceeded. Maximum ${maxRequests} requests per minute.`,
      {
        extensions: {
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((rateLimit.resetTime - now) / 1000)
        }
      }
    );
  }
  
  // Increment counter
  rateLimit.count++;
  
  return next();
};

// Query depth analysis middleware
export const QueryDepthMiddleware: MiddlewareFn<Context> = async (
  { context, info },
  next
) => {
  const maxDepth = context.user ? 15 : 10; // Higher depth for authenticated users
  
  const depth = calculateQueryDepth(info.fieldNodes[0]);
  
  if (depth > maxDepth) {
    throw new GraphQLError(
      `Query depth limit exceeded. Maximum depth: ${maxDepth}, actual: ${depth}`,
      {
        extensions: {
          code: 'QUERY_TOO_DEEP'
        }
      }
    );
  }
  
  return next();
};

// Calculate query depth
function calculateQueryDepth(node: any, depth = 0): number {
  if (!node.selectionSet) {
    return depth;
  }
  
  const maxChildDepth = node.selectionSet.selections.reduce((max: number, selection: any) => {
    if (selection.kind === 'Field') {
      const childDepth = calculateQueryDepth(selection, depth + 1);
      return Math.max(max, childDepth);
    }
    return max;
  }, depth);
  
  return maxChildDepth;
}

// Cleanup old rate limit entries (call periodically)
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now - 60000) { // Remove entries older than 1 minute
      rateLimitStore.delete(key);
    }
  }
}

// Initialize cleanup interval
if (process.env.NODE_ENV !== 'test') {
  setInterval(cleanupRateLimitStore, 60000); // Cleanup every minute
}