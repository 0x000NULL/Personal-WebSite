# GraphQL API Implementation

This directory contains a complete GraphQL implementation for the personal website project, built with Apollo Server, TypeGraphQL, and integrated with the existing Express.js REST API.

## Architecture Overview

```
graphql/
├── types/              # GraphQL type definitions
├── inputs/             # Input type definitions
├── resolvers/          # Query, Mutation, and Subscription resolvers
├── dataloaders/        # DataLoader instances for N+1 query optimization
├── middleware/         # GraphQL-specific middleware
├── examples/           # Query examples and documentation
├── context.ts          # GraphQL context setup
├── schema.ts           # Schema builder configuration
└── server.ts           # Apollo Server setup
```

## Features

### ✅ Complete Type System
- **BlogPost** - Blog posts with authors, tags, and comments
- **Comment** - Hierarchical comments with moderation
- **User** - User management with roles and authentication
- **CodingChallenge** - Programming challenges with submissions
- **Repository** - GitHub repository integration
- **SiteStats** - Analytics and site statistics

### ✅ Query Resolvers
- `posts` - Paginated blog posts with filtering
- `post` - Single post by ID or slug
- `comments` - Paginated comments with threading
- `challenges` - Coding challenges with filtering
- `githubActivity` - GitHub profile and repository data
- `siteStats` - Website analytics and statistics

### ✅ Mutation Resolvers
- `createPost` - Create new blog posts (admin/editor)
- `updatePost` - Update existing posts
- `addComment` - Add comments to posts
- `moderateComment` - Comment moderation (admin/editor)
- `submitChallenge` - Submit coding challenge solutions

### ✅ Subscription Resolvers
- `postAdded` - Real-time new post notifications
- `commentAdded` - Real-time comment notifications
- `submissionUpdated` - Challenge submission status updates
- `activityFeed` - Site-wide activity feed

### ✅ Performance Optimizations
- **DataLoader** - Batching and caching to solve N+1 queries
- **Query Complexity Analysis** - Prevent expensive queries
- **Query Depth Limiting** - Limit nested query depth
- **Rate Limiting** - Per-user request rate limiting
- **Field-level Authorization** - Secure resolver access

### ✅ Real-time Features
- **WebSocket Subscriptions** - Real-time updates via GraphQL subscriptions
- **Activity Feed** - Live activity notifications
- **Comment Threading** - Real-time comment updates

## Quick Start

### 1. Install Dependencies

```bash
# Run the installation script
node install-graphql-deps.js

# Or install manually
npm install apollo-server-express graphql type-graphql dataloader
```

### 2. Environment Variables

Add to your `.env` file:

```env
# Required
DATABASE_URL=postgresql://...
JWT_SECRET=your-jwt-secret

# Optional
GITHUB_TOKEN=your-github-token
GITHUB_USERNAME=your-github-username
```

### 3. Start the Server

```bash
npm run dev
```

### 4. Access GraphQL Playground

Visit `http://localhost:3001/graphql` to explore the API with GraphQL Playground.

## Usage Examples

### Basic Query

```graphql
query GetPosts {
  posts(pagination: { page: 1, limit: 10 }) {
    posts {
      id
      title
      slug
      excerpt
      author {
        username
        avatarUrl
      }
      tags {
        name
        color
      }
    }
    total
    hasNextPage
  }
}
```

### Mutation with Authentication

```graphql
mutation CreatePost($input: CreateBlogPostInput!) {
  createPost(input: $input) {
    id
    title
    slug
    status
    createdAt
  }
}
```

Headers:
```json
{
  "Authorization": "Bearer your-jwt-token"
}
```

### Real-time Subscription

```graphql
subscription OnNewComments($postId: ID!) {
  commentAdded(postId: $postId) {
    id
    content
    author {
      username
      avatarUrl
    }
    createdAt
  }
}
```

## Authentication & Authorization

### Authentication Methods
1. **JWT Bearer Token** - `Authorization: Bearer <token>`
2. **Cookie Authentication** - `token` cookie
3. **Query Parameter** - `?token=<token>` (development only)

### Authorization Levels
- **Public** - No authentication required
- **User** - `@Authorized()` - Requires valid user
- **Editor** - `@Authorized('editor')` - Editor or Admin role
- **Admin** - `@Authorized('admin')` - Admin role only

### Example Protected Resolver

```typescript
@Resolver(() => BlogPost)
export class BlogPostResolver {
  @Authorized('admin', 'editor')
  @Mutation(() => BlogPost)
  async createPost(
    @Arg('input') input: CreateBlogPostInput,
    @Ctx() ctx: Context
  ): Promise<BlogPost> {
    return await BlogPostModel.create(ctx.user.id, input);
  }
}
```

## Performance & Security

### Query Complexity Analysis

Queries are analyzed for complexity to prevent resource abuse:

```typescript
// Maximum query complexity: 1000 points
// Pagination multiplies complexity
// Expensive operations have higher costs
```

### Rate Limiting

Per-user rate limits based on authentication:

- **Anonymous**: 100 requests/minute
- **User**: 300 requests/minute  
- **Editor**: 500 requests/minute
- **Admin**: 1000 requests/minute

### DataLoader Pattern

Automatic batching and caching for related data:

```typescript
// Instead of N+1 queries
posts.forEach(post => getUserById(post.authorId));

// DataLoader batches into single query
const users = await userLoader.loadMany(authorIds);
```

## Subscription Setup

### WebSocket Connection

```javascript
import { SubscriptionClient } from 'subscriptions-transport-ws';

const wsClient = new SubscriptionClient(
  'ws://localhost:3001/graphql-subscriptions',
  {
    reconnect: true,
    connectionParams: {
      authorization: `Bearer ${token}`
    }
  }
);
```

### React Integration

```jsx
import { useSubscription } from '@apollo/client';

const NEW_COMMENT_SUBSCRIPTION = gql`
  subscription OnNewComment($postId: ID!) {
    commentAdded(postId: $postId) {
      id
      content
      author { username }
    }
  }
`;

function Comments({ postId }) {
  const { data } = useSubscription(NEW_COMMENT_SUBSCRIPTION, {
    variables: { postId }
  });
  
  // Handle real-time comment updates
}
```

## Integration with REST API

The GraphQL API works alongside the existing REST API:

- **GraphQL**: `/graphql` - For complex queries and real-time features
- **REST**: `/api/*` - For simple CRUD operations and file uploads
- **Subscriptions**: `/graphql-subscriptions` - WebSocket endpoint

Both APIs share:
- Database models
- Authentication middleware
- Authorization logic
- Rate limiting
- Error handling

## Development Tools

### Schema Generation

```bash
# Generate schema.gql file
npm run graphql:schema
```

### Query Validation

```bash
# Validate queries against schema
npm run graphql:validate
```

### Introspection

```bash
# Introspect schema
npm run graphql:introspect
```

## Monitoring & Logging

### Query Logging

All GraphQL operations are logged with:
- Query/mutation name
- Execution time
- User information
- Complexity score

### Error Tracking

Errors are categorized and tracked:
- Authentication errors
- Authorization errors  
- Validation errors
- Database errors
- Rate limit errors

### Performance Metrics

Key metrics tracked:
- Query execution time
- DataLoader cache hit rates
- Subscription connection counts
- Rate limit violations

## Testing

### Query Testing

```javascript
import { createTestClient } from 'apollo-server-testing';
import { createGraphQLSchema } from '../schema';

const { query, mutate } = createTestClient(server);

test('should fetch posts', async () => {
  const GET_POSTS = gql`
    query GetPosts {
      posts {
        posts { id title }
      }
    }
  `;
  
  const response = await query({ query: GET_POSTS });
  expect(response.data.posts.posts).toBeDefined();
});
```

### Subscription Testing

```javascript
import { execute, subscribe } from 'graphql';

test('should receive post notifications', async () => {
  const subscription = await subscribe({
    schema,
    document: POST_ADDED_SUBSCRIPTION,
    contextValue: context
  });
  
  // Test subscription logic
});
```

## Deployment Considerations

### Production Settings

```typescript
const server = new ApolloServer({
  schema,
  introspection: process.env.NODE_ENV !== 'production',
  playground: process.env.NODE_ENV !== 'production',
  formatError: (error) => {
    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production') {
      return new Error('Internal server error');
    }
    return error;
  }
});
```

### Scaling Considerations

- **Redis** - For subscription pub/sub in multi-instance deployments
- **DataLoader** - Configure cache TTL for production
- **Query Complexity** - Adjust limits based on server capacity  
- **Rate Limiting** - Use Redis-backed rate limiting

## Contributing

When adding new features:

1. **Define Types** - Add TypeGraphQL classes in `types/`
2. **Create Inputs** - Add input types in `inputs/`
3. **Write Resolvers** - Implement resolvers in `resolvers/`
4. **Add DataLoaders** - Optimize queries in `dataloaders/`
5. **Update Examples** - Document usage in `examples/`
6. **Add Tests** - Write comprehensive tests

## Troubleshooting

### Common Issues

**GraphQL Playground not loading**
- Check server logs for startup errors
- Verify GraphQL endpoint is accessible
- Ensure CORS is configured correctly

**Subscription connection failures**  
- Check WebSocket endpoint
- Verify authentication headers
- Ensure firewall allows WebSocket traffic

**Query complexity errors**
- Reduce query depth or field selection
- Use pagination for large datasets
- Consider breaking into multiple queries

**Rate limiting issues**
- Check user authentication status
- Verify rate limit configuration
- Consider implementing query caching

For more examples and detailed documentation, see the `examples/` directory.