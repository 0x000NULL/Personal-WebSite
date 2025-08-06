# GraphQL API User Guide

## Introduction

Welcome to the Personal Website GraphQL API! This guide will help you get started with using the API, whether you're building a frontend application, mobile app, or integrating with other systems.

## Getting Started

### Quick Start

1. **Access GraphQL Playground**
   - Development: `http://localhost:3001/graphql`
   - Production: `https://yoursite.com/graphql`

2. **Basic Query Example**
   ```graphql
   query {
     siteStats {
       totalPosts
       totalComments
       totalUsers
     }
   }
   ```

3. **Authentication** (for protected operations)
   ```json
   {
     "Authorization": "Bearer your-jwt-token"
   }
   ```

### API Endpoints

| Endpoint | Protocol | Purpose |
|----------|----------|---------|
| `/graphql` | HTTP/HTTPS | Queries and Mutations |
| `/graphql-subscriptions` | WebSocket | Real-time Subscriptions |

## Common Use Cases

### 1. Building a Blog Frontend

#### Fetch Blog Posts for Homepage

```graphql
query GetHomepagePosts {
  posts(
    pagination: { page: 1, limit: 6 }
    filters: { 
      status: PUBLISHED
      visibility: PUBLIC
      featured: true
    }
  ) {
    posts {
      id
      title
      slug 
      excerpt
      featuredImageUrl
      readingTimeMinutes
      viewCount
      likeCount
      commentCount
      publishedAt
      author {
        username
        displayName
        avatarUrl
      }
      tags {
        name
        slug
        color
      }
    }
    total
    hasNextPage
  }
}
```

#### Get Full Blog Post

```graphql
query GetBlogPost($slug: String!) {
  post(slug: $slug) {
    id
    title
    contentHtml
    excerpt
    featuredImageUrl
    metaTitle
    metaDescription
    readingTimeMinutes
    viewCount
    likeCount
    commentCount
    publishedAt
    isLiked  # Requires authentication
    canEdit  # Requires authentication
    author {
      username
      displayName
      avatarUrl
      bio
      websiteUrl
      twitterHandle
      githubHandle
    }
    tags {
      id
      name
      slug
      description
      color
    }
    comments(
      pagination: { limit: 20 }
      filters: { status: APPROVED, includeReplies: true }
    ) {
      comments {
        id
        content
        contentHtml
        likeCount
        replyCount
        depth
        createdAt
        author {
          username
          displayName
          avatarUrl
        }
        parent {
          id
          author {
            username
          }
        }
        replies {
          id
          content
          contentHtml
          createdAt
          author {
            username
            avatarUrl
          }
        }
      }
      total
      hasNextPage
    }
  }
}
```

#### Search Blog Posts

```graphql
query SearchPosts($searchTerm: String!, $page: Int = 1) {
  posts(
    pagination: { page: $page, limit: 10 }
    filters: { 
      search: $searchTerm
      status: PUBLISHED
      visibility: PUBLIC
    }
  ) {
    posts {
      id
      title
      slug
      excerpt
      publishedAt
      author {
        username
        displayName
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

Variables:
```json
{
  "searchTerm": "javascript tutorial",
  "page": 1
}
```

#### Filter Posts by Tag

```graphql
query GetPostsByTag($tagSlug: String!) {
  posts(
    pagination: { page: 1, limit: 12 }
    filters: { 
      tags: [$tagSlug]
      status: PUBLISHED
    }
  ) {
    posts {
      id
      title
      slug
      excerpt
      featuredImageUrl
      publishedAt
      readingTimeMinutes
      author {
        username
        avatarUrl
      }
    }
    total
  }
}
```

### 2. Comment System Integration

#### Add a Comment

```graphql
mutation AddComment($input: CreateCommentInput!) {
  addComment(input: $input) {
    id
    content
    contentHtml
    status
    isGuest
    createdAt
    author {
      username
      displayName
      avatarUrl
    }
  }
}
```

Variables for authenticated user:
```json
{
  "input": {
    "postId": "post-uuid-here",
    "content": "Great article! Thanks for sharing.",
    "parentId": null
  }
}
```

Variables for guest comment:
```json
{
  "input": {
    "postId": "post-uuid-here", 
    "content": "Anonymous comment here",
    "guestName": "John Doe",
    "guestEmail": "john@example.com"
  }
}
```

#### Reply to Comment

```graphql
mutation ReplyToComment($input: CreateCommentInput!) {
  addComment(input: $input) {
    id
    content
    depth
    parent {
      id
      author {
        username
      }
    }
    author {
      username
      avatarUrl
    }
  }
}
```

Variables:
```json
{
  "input": {
    "postId": "post-uuid-here",
    "content": "@username Thanks for the clarification!",
    "parentId": "parent-comment-uuid"
  }
}
```

#### Load More Comments

```graphql
query LoadMoreComments($postId: ID!, $page: Int!) {
  comments(
    filters: { 
      postId: $postId
      status: APPROVED
      includeReplies: true
    }
    pagination: { page: $page, limit: 10 }
  ) {
    comments {
      id
      content
      contentHtml
      likeCount
      replyCount
      depth
      createdAt
      author {
        username
        avatarUrl
      }
      replies {
        id
        content
        author {
          username
        }
      }
    }
    hasNextPage
  }
}
```

### 3. Coding Challenge Platform

#### Browse Challenges

```graphql
query GetChallenges($difficulty: ChallengeDifficulty, $category: String) {
  challenges(
    pagination: { page: 1, limit: 20, sortBy: "createdAt", sortOrder: DESC }
    filters: { 
      difficulty: $difficulty
      category: $category
      isActive: true
    }
  ) {
    challenges {
      id
      title
      slug
      description
      difficulty
      category
      tags
      submissionCount
      solvedCount
      successRate
      isFeatured
      createdAt
      author {
        username
      }
    }
    total
    hasNextPage
  }
}
```

Variables:
```json
{
  "difficulty": "MEDIUM",
  "category": "Algorithms"
}
```

#### Get Challenge Details

```graphql
query GetChallenge($slug: String!) {
  challenge(slug: $slug) {
    id
    title
    description
    problemStatement
    difficulty
    category
    tags
    inputFormat
    outputFormat
    constraints
    sampleInput
    sampleOutput
    explanation
    hints
    timeLimitMs
    memoryLimitMb
    submissionCount
    solvedCount
    successRate
    author {
      username
      displayName
    }
    testCases {
      id
      inputData
      expectedOutput
      isSample
      explanation
    }
  }
}
```

#### Submit Solution

```graphql
mutation SubmitSolution($input: SubmitChallengeInput!) {
  submitChallenge(input: $input) {
    id
    status
    language
    submittedAt
    challenge {
      title
    }
  }
}
```

Variables:
```json
{
  "input": {
    "challengeId": "challenge-uuid-here",
    "language": "javascript",
    "code": "function solution(input) {\n  const lines = input.trim().split('\\n');\n  const n = parseInt(lines[0]);\n  const arr = lines[1].split(' ').map(Number);\n  \n  return arr.sort((a, b) => a - b).join(' ');\n}"
  }
}
```

#### Get Challenge Leaderboard

```graphql
query GetLeaderboard($challengeId: ID!) {
  challengeLeaderboard(challengeId: $challengeId, limit: 10) {
    userId
    username
    bestScore
    bestTime
    submissions
  }
}
```

### 4. GitHub Integration

#### Get Developer Profile

```graphql
query GetGitHubProfile {
  githubActivity {
    profile {
      login
      name
      avatarUrl
      bio
      company
      location
      publicRepos
      followers
      following
      createdAt
    }
    repositories(limit: 6) {
      name
      description
      htmlUrl
      language
      stargazersCount
      forksCount
      topics
      updatedAt
    }
    pinnedRepositories {
      name
      description
      language
      stargazersCount
      htmlUrl
    }
    languageStats {
      name
      percentage
      color
    }
    contributionStats {
      totalContributions
      totalCommits
      totalPRs
      totalIssues
    }
  }
}
```

#### Get Repository List

```graphql
query GetRepositories($limit: Int = 20) {
  githubActivity {
    repositories(limit: $limit) {
      id
      name
      fullName
      description
      htmlUrl
      language
      stargazersCount
      forksCount
      size
      topics
      isPrivate
      isFork
      createdAt
      updatedAt
      pushedAt
    }
  }
}
```

### 5. Real-time Features with Subscriptions

#### Subscribe to New Posts

```graphql
subscription NewPosts {
  postAdded(includeUnpublished: false) {
    id
    title
    slug
    excerpt
    status
    publishedAt
    author {
      username
      displayName
      avatarUrl
    }
    tags {
      name
      color
    }
  }
}
```

#### Subscribe to New Comments

```graphql
subscription NewComments($postId: ID!) {
  commentAdded(postId: $postId, includePending: false) {
    id
    content
    createdAt
    author {
      username
      displayName
      avatarUrl
    }
    parent {
      id
      author {
        username
      }
    }
  }
}
```

#### Subscribe to Challenge Submissions

```graphql
subscription SubmissionUpdates($challengeId: ID) {
  submissionUpdated(challengeId: $challengeId) {
    id
    status
    score
    executionTimeMs
    testCasesPassed
    testCasesTotal
    errorMessage
    judgedAt
  }
}
```

#### Activity Feed Subscription

```graphql
subscription ActivityFeed {
  activityFeed(types: ["POST_CREATED", "COMMENT_ADDED", "CHALLENGE_SOLVED"]) {
    id
    type
    title
    description
    username
    createdAt
  }
}
```

## Advanced Queries

### Using Fragments

```graphql
fragment PostSummary on BlogPost {
  id
  title
  slug
  excerpt
  featuredImageUrl
  readingTimeMinutes
  viewCount
  likeCount
  commentCount
  publishedAt
}

fragment AuthorInfo on User {
  username
  displayName
  avatarUrl
  bio
}

query GetPostsWithFragments {
  posts(pagination: { limit: 10 }) {
    posts {
      ...PostSummary
      author {
        ...AuthorInfo
      }
      tags {
        name
        slug
        color
      }
    }
    total
    hasNextPage
  }
}
```

### Complex Filtering

```graphql
query AdvancedPostSearch($filters: BlogPostFilters!) {
  posts(
    pagination: { 
      page: 1, 
      limit: 20, 
      sortBy: "publishedAt", 
      sortOrder: DESC 
    }
    filters: $filters
  ) {
    posts {
      id
      title
      slug
      excerpt
      publishedAt
      author {
        username
      }
      tags {
        name
      }
    }
    total
  }
}
```

Variables:
```json
{
  "filters": {
    "status": "PUBLISHED",
    "visibility": "PUBLIC",
    "featured": true,
    "tags": ["javascript", "tutorial"],
    "search": "react hooks",
    "dateFrom": "2024-01-01T00:00:00.000Z",
    "dateTo": "2024-12-31T23:59:59.999Z"
  }
}
```

### Conditional Fields

```graphql
query GetPost($slug: String!, $includeComments: Boolean = false) {
  post(slug: $slug) {
    id
    title
    contentHtml
    author {
      username
      displayName
    }
    comments(pagination: { limit: 10 }) @include(if: $includeComments) {
      comments {
        id
        content
        author {
          username
        }
      }
    }
  }
}
```

## Error Handling

### Common Error Responses

#### Authentication Error
```json
{
  "errors": [
    {
      "message": "Authentication required",
      "code": "UNAUTHENTICATED",
      "path": ["createPost"],
      "locations": [{"line": 2, "column": 3}]
    }
  ],
  "data": null
}
```

#### Authorization Error
```json
{
  "errors": [
    {
      "message": "Insufficient permissions",
      "code": "FORBIDDEN",
      "path": ["deletePost"]
    }
  ]
}
```

#### Validation Error
```json
{
  "errors": [
    {
      "message": "Title is required and must be between 5 and 200 characters",
      "code": "VALIDATION_ERROR",
      "extensions": {
        "field": "title"
      }
    }
  ]
}
```

#### Rate Limit Error
```json
{
  "errors": [
    {
      "message": "Rate limit exceeded. Maximum 100 requests per minute.",
      "code": "RATE_LIMIT_EXCEEDED", 
      "extensions": {
        "retryAfter": 45
      }
    }
  ]
}
```

### Error Handling in Client Code

#### JavaScript/TypeScript Example
```typescript
import { useQuery, useMutation } from '@apollo/client';

function BlogPost({ slug }: { slug: string }) {
  const { data, loading, error } = useQuery(GET_POST, {
    variables: { slug },
    errorPolicy: 'all'
  });

  const [createComment, { loading: submitting }] = useMutation(CREATE_COMMENT, {
    onError: (error) => {
      error.graphQLErrors.forEach(({ message, code, extensions }) => {
        switch (code) {
          case 'UNAUTHENTICATED':
            // Redirect to login
            window.location.href = '/login';
            break;
          case 'RATE_LIMIT_EXCEEDED':
            // Show rate limit message
            setError(`Too many requests. Try again in ${extensions.retryAfter} seconds.`);
            break;
          case 'VALIDATION_ERROR':
            // Show field-specific error
            setFieldError(extensions.field, message);
            break;
          default:
            setError(message);
        }
      });
    }
  });

  if (loading) return <div>Loading...</div>;
  
  if (error && !data) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <article>
      <h1>{data.post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: data.post.contentHtml }} />
    </article>
  );
}
```

## Best Practices

### 1. Query Optimization

#### ✅ Good: Request only needed fields
```graphql
query GetPosts {
  posts {
    posts {
      id
      title
      slug
      author {
        username
      }
    }
  }
}
```

#### ❌ Bad: Over-fetching data
```graphql
query GetPosts {
  posts {
    posts {
      id
      title
      slug
      content        # Heavy field not needed for list
      contentHtml    # Heavy field not needed for list
      author {
        id
        username
        email        # Sensitive field
        bio          # Heavy field not needed
      }
    }
  }
}
```

### 2. Pagination

#### ✅ Good: Use pagination for large datasets
```graphql
query GetPosts($page: Int!, $limit: Int!) {
  posts(pagination: { page: $page, limit: $limit }) {
    posts {
      id
      title
    }
    hasNextPage
    total
  }
}
```

#### ❌ Bad: Fetching all records
```graphql
query GetAllPosts {
  posts(pagination: { limit: 1000 }) {  # Too many records
    posts {
      id
      title
    }
  }
}
```

### 3. Authentication

#### ✅ Good: Handle auth headers properly
```typescript
const client = new ApolloClient({
  uri: '/graphql',
  headers: {
    authorization: `Bearer ${getToken()}`
  }
});
```

#### ✅ Good: Handle auth errors gracefully
```typescript
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ extensions, message }) => {
      if (extensions?.code === 'UNAUTHENTICATED') {
        // Clear local storage and redirect
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    });
  }
});
```

### 4. Caching

#### ✅ Good: Use cache policies appropriately
```typescript
const { data } = useQuery(GET_POSTS, {
  fetchPolicy: 'cache-first',  // Use cache if available
  variables: { page: 1 }
});

const { data: siteStats } = useQuery(GET_SITE_STATS, {
  fetchPolicy: 'cache-and-network',  // Show cache, then update
  pollInterval: 300000  // Refresh every 5 minutes
});
```

### 5. Real-time Updates

#### ✅ Good: Subscribe to relevant updates only
```typescript
const { data: subscriptionData } = useSubscription(NEW_COMMENTS, {
  variables: { postId: currentPost.id },
  onSubscriptionData: ({ subscriptionData }) => {
    // Update local state with new comment
    updateCache(subscriptionData.data.commentAdded);
  }
});
```

## Client Integration Examples

### React with Apollo Client

```tsx
import React from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import { GET_POSTS, CREATE_COMMENT, NEW_COMMENTS } from './queries';

function BlogPostList() {
  const { data, loading, error, fetchMore } = useQuery(GET_POSTS, {
    variables: { page: 1, limit: 10 },
    notifyOnNetworkStatusChange: true
  });

  const [addComment] = useMutation(CREATE_COMMENT, {
    update(cache, { data: { addComment } }) {
      // Update the cache with new comment
      const existingComments = cache.readQuery({
        query: GET_COMMENTS,
        variables: { postId: currentPostId }
      });
      
      cache.writeQuery({
        query: GET_COMMENTS,
        variables: { postId: currentPostId },
        data: {
          comments: {
            ...existingComments.comments,
            comments: [addComment, ...existingComments.comments.comments]
          }
        }
      });
    }
  });

  useSubscription(NEW_COMMENTS, {
    variables: { postId: currentPostId },
    onSubscriptionData: ({ subscriptionData }) => {
      // Handle real-time comment updates
      if (subscriptionData.data) {
        setNewCommentNotification(subscriptionData.data.commentAdded);
      }
    }
  });

  const loadMore = () => {
    fetchMore({
      variables: { page: data.posts.page + 1 },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult) return prev;
        return {
          posts: {
            ...fetchMoreResult.posts,
            posts: [...prev.posts.posts, ...fetchMoreResult.posts.posts]
          }
        };
      }
    });
  };

  if (loading && !data) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data.posts.posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </article>
      ))}
      
      {data.posts.hasNextPage && (
        <button onClick={loadMore}>Load More</button>
      )}
    </div>
  );
}
```

### Vue.js with Apollo

```vue
<template>
  <div>
    <div v-if="$apollo.loading">Loading...</div>
    <div v-else-if="error">Error: {{ error }}</div>
    <div v-else>
      <article v-for="post in posts" :key="post.id">
        <h2>{{ post.title }}</h2>
        <p>{{ post.excerpt }}</p>
      </article>
    </div>
  </div>
</template>

<script>
import { GET_POSTS } from '@/graphql/queries';

export default {
  data() {
    return {
      posts: [],
      error: null
    };
  },
  apollo: {
    posts: {
      query: GET_POSTS,
      variables() {
        return {
          pagination: { page: 1, limit: 10 },
          filters: { status: 'PUBLISHED' }
        };
      },
      update: data => data.posts.posts,
      error(error) {
        this.error = error.message;
      }
    }
  }
};
</script>
```

This user guide provides comprehensive examples and best practices for integrating with the GraphQL API. It covers common use cases, error handling, and client integration patterns to help developers build robust applications using the API.