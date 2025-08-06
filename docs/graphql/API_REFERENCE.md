# GraphQL API Reference

## Overview

This document provides a comprehensive reference for the GraphQL API implementation in the Personal Website project. The API is built with Apollo Server, TypeGraphQL, and integrates seamlessly with the existing Express.js REST API.

## Base Information

- **GraphQL Endpoint**: `http://localhost:3001/graphql`
- **Subscriptions Endpoint**: `ws://localhost:3001/graphql-subscriptions`
- **GraphQL Playground**: Available at the GraphQL endpoint in development
- **Schema**: Auto-generated using TypeGraphQL decorators

## Authentication

### Supported Methods

1. **JWT Bearer Token** (Recommended)
   ```
   Authorization: Bearer <jwt-token>
   ```

2. **Cookie Authentication**
   ```
   Cookie: token=<jwt-token>
   ```

3. **Query Parameter** (Development only)
   ```
   ?token=<jwt-token>
   ```

### Authorization Levels

| Level | Decorator | Description |
|-------|-----------|-------------|
| Public | None | No authentication required |
| User | `@Authorized()` | Requires valid user token |
| Editor | `@Authorized('editor')` | Requires editor or admin role |
| Admin | `@Authorized('admin')` | Requires admin role only |

## Rate Limiting

Rate limits are applied per user based on authentication status:

| User Type | Requests/Minute | Query Complexity Limit |
|-----------|-----------------|------------------------|
| Anonymous | 100 | 500 |
| User | 300 | 750 |
| Editor | 500 | 1000 |
| Admin | 1000 | 2000 |

## Core Types

### BlogPost

Represents a blog post with metadata, content, and relationships.

```graphql
type BlogPost {
  id: ID!
  authorId: ID!
  title: String!
  slug: String!
  excerpt: String
  content: String!
  contentHtml: String
  status: PostStatus!
  visibility: PostVisibility!
  featured: Boolean!
  featuredImageUrl: String
  metaTitle: String
  metaDescription: String
  metaKeywords: String
  readingTimeMinutes: Int
  viewCount: Int!
  likeCount: Int!
  commentCount: Int!
  publishedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
  
  # Relations
  author: User
  tags: [BlogTag!]
  comments: [Comment!]
  
  # Virtual fields
  isLiked: Boolean
  canEdit: Boolean
}
```

**Enums:**
- `PostStatus`: `DRAFT`, `PUBLISHED`, `ARCHIVED`
- `PostVisibility`: `PUBLIC`, `PRIVATE`, `UNLISTED`

### Comment

Represents a hierarchical comment system with moderation.

```graphql
type Comment {
  id: ID!
  postId: ID!
  authorId: ID
  parentId: ID
  content: String!
  contentHtml: String
  status: CommentStatus!
  isGuest: Boolean!
  guestName: String
  guestEmail: String
  ipAddress: String
  userAgent: String
  likeCount: Int!
  replyCount: Int!
  depth: Int!
  approvedAt: DateTime
  approvedBy: String
  createdAt: DateTime!
  updatedAt: DateTime!
  
  # Relations
  author: User
  parent: Comment
  replies: [Comment!]
  post: BlogPost!
}
```

**Enums:**
- `CommentStatus`: `PENDING`, `APPROVED`, `REJECTED`, `SPAM`

### CodingChallenge

Represents programming challenges with test cases and submissions.

```graphql
type CodingChallenge {
  id: ID!
  authorId: ID!
  title: String!
  slug: String!
  description: String
  problemStatement: String!
  difficulty: ChallengeDifficulty!
  category: String!
  tags: [String!]!
  inputFormat: String
  outputFormat: String
  constraints: String
  sampleInput: String
  sampleOutput: String
  explanation: String
  hints: [String!]
  timeLimitMs: Int!
  memoryLimitMb: Int!
  submissionCount: Int!
  solvedCount: Int!
  successRate: Float!
  isFeatured: Boolean!
  isActive: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
  
  # Relations
  author: User!
  testCases: [ChallengeTestCase!]
  submissions: [ChallengeSubmission!]
}
```

**Enums:**
- `ChallengeDifficulty`: `EASY`, `MEDIUM`, `HARD`, `EXPERT`

### Repository

Represents GitHub repository information.

```graphql
type Repository {
  id: ID!
  name: String!
  fullName: String!
  description: String
  htmlUrl: String!
  cloneUrl: String!
  language: String
  stargazersCount: Int!
  forksCount: Int!
  size: Int!
  topics: [String!]!
  isPrivate: Boolean!
  isFork: Boolean!
  isArchived: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
  pushedAt: DateTime
}
```

### User

Represents system users with roles and profile information.

```graphql
type User {
  id: ID!
  username: String!
  email: String!
  firstName: String
  lastName: String
  displayName: String
  bio: String
  avatarUrl: String
  websiteUrl: String
  twitterHandle: String
  githubHandle: String
  linkedinHandle: String
  role: UserRole!
  isActive: Boolean!
  emailVerified: Boolean!
  lastLoginAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
  
  # Relations
  posts: [BlogPost!]
  comments: [Comment!]
  challenges: [CodingChallenge!]
  submissions: [ChallengeSubmission!]
}
```

**Enums:**
- `UserRole`: `USER`, `EDITOR`, `ADMIN`

## Queries

### Blog Post Queries

#### `posts`
Get paginated list of blog posts with filtering.

```graphql
posts(
  pagination: PaginationInput
  filters: BlogPostFilters
): BlogPostConnection!
```

**Parameters:**
- `pagination`: Page, limit, and sorting options
- `filters`: Status, visibility, featured, tags, search terms

**Example:**
```graphql
query GetPosts {
  posts(
    pagination: { page: 1, limit: 10, sortBy: "createdAt", sortOrder: DESC }
    filters: { status: PUBLISHED, featured: true }
  ) {
    posts {
      id
      title
      slug
      excerpt
      featured
      createdAt
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

#### `post`
Get a single blog post by ID or slug.

```graphql
post(id: ID, slug: String): BlogPost
```

**Example:**
```graphql
query GetPost($slug: String!) {
  post(slug: $slug) {
    id
    title
    content
    contentHtml
    viewCount
    likeCount
    author {
      username
      bio
    }
    comments {
      id
      content
      author {
        username
      }
      replies {
        id
        content
      }
    }
  }
}
```

### Comment Queries

#### `comments`
Get paginated comments with filtering and threading.

```graphql
comments(
  filters: CommentFilters
  pagination: PaginationInput
): CommentConnection!
```

**Parameters:**
- `filters`: Post ID, status, parent ID, search terms
- `pagination`: Standard pagination options

### Challenge Queries

#### `challenges`
Get coding challenges with filtering.

```graphql
challenges(
  filters: ChallengeFilters
  pagination: PaginationInput
): ChallengeConnection!
```

#### `challenge`
Get a specific challenge with test cases.

```graphql
challenge(id: ID, slug: String): CodingChallenge
```

#### `challengeLeaderboard`
Get leaderboard for a specific challenge.

```graphql
challengeLeaderboard(
  challengeId: ID!
  limit: Int
): [LeaderboardEntry!]!
```

### GitHub Queries

#### `githubActivity`
Get comprehensive GitHub activity data.

```graphql
githubActivity(days: Int): GitHubActivity!
```

**Returns:**
- Profile information
- Repository list with statistics
- Pinned repositories
- Language statistics
- Contribution data

### Statistics Queries

#### `siteStats`
Get general site statistics (public).

```graphql
siteStats: SiteStats!
```

#### `analyticsOverview`
Get detailed analytics overview (admin only).

```graphql
analyticsOverview(days: Int): AnalyticsOverview!
```

## Mutations

### Blog Post Mutations

#### `createPost`
Create a new blog post (editor/admin only).

```graphql
createPost(input: CreateBlogPostInput!): BlogPost!
```

**Input:**
```graphql
input CreateBlogPostInput {
  title: String!
  content: String!
  excerpt: String
  status: PostStatus = DRAFT
  visibility: PostVisibility = PUBLIC
  featured: Boolean = false
  featuredImageUrl: String
  metaTitle: String
  metaDescription: String
  tags: [String!]
}
```

#### `updatePost`
Update an existing blog post.

```graphql
updatePost(id: ID!, input: UpdateBlogPostInput!): BlogPost!
```

#### `deletePost`
Delete a blog post (admin only).

```graphql
deletePost(id: ID!): Boolean!
```

### Comment Mutations

#### `addComment`
Add a comment to a blog post.

```graphql
addComment(input: CreateCommentInput!): Comment!
```

**Input:**
```graphql
input CreateCommentInput {
  postId: ID!
  content: String!
  parentId: ID
  guestName: String
  guestEmail: String
}
```

#### `moderateComment`
Moderate a comment (editor/admin only).

```graphql
moderateComment(id: ID!, status: CommentStatus!): Comment!
```

### Challenge Mutations

#### `submitChallenge`
Submit a solution to a coding challenge.

```graphql
submitChallenge(input: SubmitChallengeInput!): ChallengeSubmission!
```

**Input:**
```graphql
input SubmitChallengeInput {
  challengeId: ID!
  language: String!
  code: String!
}
```

## Subscriptions

### Real-time Updates

#### `postAdded`
Subscribe to new blog post notifications.

```graphql
subscription {
  postAdded(includeUnpublished: Boolean) {
    id
    title
    status
    author {
      username
    }
  }
}
```

#### `commentAdded`
Subscribe to new comments on posts.

```graphql
subscription {
  commentAdded(postId: ID, includePending: Boolean) {
    id
    content
    author {
      username
    }
  }
}
```

#### `submissionUpdated`
Subscribe to challenge submission updates.

```graphql
subscription {
  submissionUpdated(challengeId: ID) {
    id
    status
    score
    testCasesPassed
    testCasesTotal
  }
}
```

#### `activityFeed`
Subscribe to site-wide activity feed.

```graphql
subscription {
  activityFeed(types: [String!]) {
    id
    type
    title
    description
    username
    createdAt
  }
}
```

## Error Handling

### Error Types

| Code | Description |
|------|-------------|
| `UNAUTHENTICATED` | No valid authentication provided |
| `FORBIDDEN` | Insufficient permissions |
| `VALIDATION_ERROR` | Input validation failed |
| `NOT_FOUND` | Requested resource not found |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `QUERY_TOO_COMPLEX` | Query exceeds complexity limit |
| `INTERNAL_ERROR` | Server error |

### Error Response Format

```json
{
  "errors": [
    {
      "message": "Authentication required",
      "code": "UNAUTHENTICATED",
      "path": ["createPost"],
      "locations": [{"line": 2, "column": 3}],
      "extensions": {
        "code": "UNAUTHENTICATED",
        "retryAfter": 60
      }
    }
  ],
  "data": null
}
```

## Performance Optimizations

### DataLoader Integration

The API uses DataLoader to prevent N+1 query problems:

- **User Loader**: Batches user queries by ID
- **Post Loader**: Batches blog post queries
- **Comment Loader**: Batches comment queries
- **Tag Loader**: Batches tag queries

### Query Complexity Analysis

Each field has an assigned complexity cost:
- Simple scalars: 1 point
- Relations: 2 points
- Paginated lists: multiplied by limit
- Expensive operations: 10+ points

### Caching Strategy

- **Redis Cache**: Used for frequently accessed data
- **DataLoader Cache**: Per-request caching
- **Query Result Cache**: Time-based caching for expensive queries

## Client Integration Examples

### Apollo Client Setup

```javascript
import { ApolloClient, InMemoryCache, createHttpLink, split } from '@apollo/client';
import { WebSocketLink } from '@apollo/client/link/ws';
import { getMainDefinition } from '@apollo/client/utilities';

const httpLink = createHttpLink({
  uri: 'http://localhost:3001/graphql',
  headers: {
    authorization: `Bearer ${localStorage.getItem('token')}`
  }
});

const wsLink = new WebSocketLink({
  uri: 'ws://localhost:3001/graphql-subscriptions',
  options: {
    reconnect: true,
    connectionParams: {
      authorization: `Bearer ${localStorage.getItem('token')}`
    }
  }
});

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink
);

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache()
});
```

### React Hook Usage

```jsx
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { GET_POSTS, CREATE_POST, POST_ADDED } from './queries';

function BlogList() {
  const { data, loading, error } = useQuery(GET_POSTS, {
    variables: { 
      pagination: { page: 1, limit: 10 },
      filters: { status: 'PUBLISHED' }
    }
  });

  const [createPost] = useMutation(CREATE_POST, {
    update(cache, { data: { createPost } }) {
      // Update cache after creating post
    }
  });

  useSubscription(POST_ADDED, {
    onSubscriptionData: ({ subscriptionData }) => {
      // Handle real-time post updates
    }
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data.posts.posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
```

## Testing

### Query Testing Example

```javascript
import { createTestClient } from 'apollo-server-testing';
import { gql } from 'apollo-server-express';

const GET_POSTS = gql`
  query GetPosts {
    posts {
      posts {
        id
        title
      }
    }
  }
`;

test('should return published posts', async () => {
  const { query } = createTestClient(server);
  
  const response = await query({
    query: GET_POSTS
  });

  expect(response.errors).toBeUndefined();
  expect(response.data.posts.posts).toBeDefined();
  expect(response.data.posts.posts.length).toBeGreaterThan(0);
});
```

## Security Considerations

1. **Input Validation**: All inputs are validated using TypeGraphQL decorators
2. **SQL Injection**: Using parameterized queries and ORM
3. **Rate Limiting**: Per-user limits prevent abuse
4. **Query Complexity**: Prevents resource exhaustion attacks
5. **Authentication**: JWT tokens with expiration
6. **Authorization**: Field-level and resolver-level checks
7. **CORS**: Properly configured for cross-origin requests

## Production Deployment

### Environment Variables

```env
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
JWT_SECRET=your-secret-key
REDIS_URL=redis://localhost:6379

# Optional
GITHUB_TOKEN=github-personal-access-token
GITHUB_USERNAME=your-github-username
GRAPHQL_INTROSPECTION=false
GRAPHQL_PLAYGROUND=false
```

### Performance Monitoring

Monitor these key metrics:
- Query execution time
- DataLoader cache hit rates
- Subscription connection counts
- Rate limit violations
- Error rates by type

### Scaling Considerations

- Use Redis for subscription pub/sub across instances
- Configure DataLoader cache TTL appropriately
- Implement query result caching for expensive operations
- Monitor and adjust complexity limits based on capacity