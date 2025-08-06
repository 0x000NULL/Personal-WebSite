# GraphQL Query Examples

This document provides examples of GraphQL queries, mutations, and subscriptions for the personal website API.

## Table of Contents

- [Queries](#queries)
  - [Blog Posts](#blog-posts)
  - [Comments](#comments)
  - [Coding Challenges](#coding-challenges)
  - [GitHub Activity](#github-activity)
  - [Site Statistics](#site-statistics)
- [Mutations](#mutations)
  - [Blog Post Mutations](#blog-post-mutations)
  - [Comment Mutations](#comment-mutations)
  - [Challenge Mutations](#challenge-mutations)
- [Subscriptions](#subscriptions)
- [Error Handling](#error-handling)

## Queries

### Blog Posts

#### Get all published posts with pagination

```graphql
query GetPosts($pagination: PaginationInput, $filters: BlogPostFilters) {
  posts(pagination: $pagination, filters: $filters) {
    posts {
      id
      title
      slug
      excerpt
      contentHtml
      status
      featured
      featuredImageUrl
      viewCount
      likeCount
      commentCount
      publishedAt
      createdAt
      author {
        id
        username
        avatarUrl
      }
      tags {
        id
        name
        slug
        color
      }
    }
    total
    page
    limit
    hasNextPage
    hasPreviousPage
  }
}
```

Variables:
```json
{
  "pagination": {
    "page": 1,
    "limit": 10
  },
  "filters": {
    "featured": true,
    "status": "PUBLISHED"
  }
}
```

#### Get a single post by slug

```graphql
query GetPost($slug: String!) {
  post(slug: $slug) {
    id
    title
    slug
    content
    contentHtml
    excerpt
    status
    visibility
    featured
    featuredImageUrl
    metaTitle
    metaDescription
    readingTimeMinutes
    viewCount
    likeCount
    commentCount
    publishedAt
    createdAt
    updatedAt
    author {
      id
      username
      firstName
      lastName
      avatarUrl
      bio
    }
    tags {
      id
      name
      slug
      description
      color
      postCount
    }
    comments {
      id
      content
      contentHtml
      status
      likeCount
      depth
      createdAt
      author {
        id
        username
        avatarUrl
      }
      replies {
        id
        content
        contentHtml
        likeCount
        createdAt
        author {
          id
          username
          avatarUrl
        }
      }
    }
  }
}
```

### Comments

#### Get comments for a post

```graphql
query GetComments($filters: CommentFilters, $pagination: PaginationInput) {
  comments(filters: $filters, pagination: $pagination) {
    comments {
      id
      content
      contentHtml
      status
      isGuest
      likeCount
      replyCount
      depth
      createdAt
      author {
        id
        username
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
          id
          username
          avatarUrl
        }
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
  "filters": {
    "postId": "post-id-here",
    "status": "APPROVED",
    "includeReplies": true
  },
  "pagination": {
    "page": 1,
    "limit": 20
  }
}
```

### Coding Challenges

#### Get all challenges

```graphql
query GetChallenges($filters: ChallengeFilters, $pagination: PaginationInput) {
  challenges(filters: $filters, pagination: $pagination) {
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
        id
        username
      }
    }
    total
    hasNextPage
  }
}
```

#### Get a specific challenge with test cases

```graphql
query GetChallenge($slug: String!) {
  challenge(slug: $slug) {
    id
    title
    slug
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
    createdAt
    author {
      id
      username
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

#### Get challenge leaderboard

```graphql
query GetLeaderboard($challengeId: ID!, $limit: Int) {
  challengeLeaderboard(challengeId: $challengeId, limit: $limit) {
    userId
    username
    bestScore
    bestTime
    submissions
  }
}
```

### GitHub Activity

#### Get comprehensive GitHub activity

```graphql
query GetGitHubActivity($days: Int) {
  githubActivity(days: $days) {
    profile {
      id
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
    repositories {
      id
      name
      fullName
      description
      htmlUrl
      language
      stargazersCount
      forksCount
      topics
      createdAt
      updatedAt
    }
    pinnedRepositories {
      id
      name
      description
      language
      stargazersCount
      forksCount
      htmlUrl
    }
    languageStats {
      name
      bytes
      percentage
      color
    }
    contributionStats {
      totalContributions
      totalCommits
      totalPRs
      totalIssues
      contributionsByRepo {
        repo
        commits
      }
    }
    totalBytes
  }
}
```

### Site Statistics

#### Get site statistics

```graphql
query GetSiteStats {
  siteStats {
    totalPosts
    publishedPosts
    totalComments
    approvedComments
    totalUsers
    activeUsers
    totalChallenges
    activeChallenges
    totalSubmissions
    acceptedSubmissions
    overallSuccessRate
    totalViews
    uniqueVisitors
    totalLikes
    lastUpdated
  }
}
```

#### Get analytics overview (admin only)

```graphql
query GetAnalyticsOverview($days: Int) {
  analyticsOverview(days: $days) {
    stats {
      totalPosts
      publishedPosts
      totalComments
      totalUsers
      totalChallenges
      totalSubmissions
      overallSuccessRate
    }
    popularPosts {
      id
      title
      slug
      viewCount
      likeCount
      commentCount
      createdAt
    }
    popularChallenges {
      id
      title
      slug
      submissionCount
      solvedCount
      successRate
      createdAt
    }
    recentActivity {
      id
      type
      title
      description
      username
      createdAt
    }
    dailyStats {
      date
      views
      visitors
      submissions
      newUsers
      newPosts
      newComments
    }
  }
}
```

## Mutations

### Blog Post Mutations

#### Create a new blog post (admin/editor only)

```graphql
mutation CreatePost($input: CreateBlogPostInput!) {
  createPost(input: $input) {
    id
    title
    slug
    content
    status
    visibility
    featured
    createdAt
    author {
      id
      username
    }
    tags {
      id
      name
      slug
    }
  }
}
```

Variables:
```json
{
  "input": {
    "title": "My New Blog Post",
    "content": "This is the content of my blog post...",
    "excerpt": "A brief summary of the post",
    "status": "PUBLISHED",
    "visibility": "PUBLIC",
    "featured": false,
    "tags": ["technology", "web-development"]
  }
}
```

#### Update a blog post

```graphql
mutation UpdatePost($id: ID!, $input: UpdateBlogPostInput!) {
  updatePost(id: $id, input: $input) {
    id
    title
    slug
    content
    status
    updatedAt
  }
}
```

### Comment Mutations

#### Add a comment

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
      id
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
    "postId": "post-id-here",
    "content": "This is my comment on the post.",
    "parentId": null
  }
}
```

#### Moderate a comment (admin/editor only)

```graphql
mutation ModerateComment($id: ID!, $status: String!) {
  moderateComment(id: $id, status: $status) {
    id
    status
    approvedAt
    approvedBy
  }
}
```

### Challenge Mutations

#### Submit a challenge solution

```graphql
mutation SubmitChallenge($input: SubmitChallengeInput!) {
  submitChallenge(input: $input) {
    id
    challengeId
    language
    status
    score
    testCasesPassed
    testCasesTotal
    submittedAt
    challenge {
      id
      title
    }
  }
}
```

Variables:
```json
{
  "input": {
    "challengeId": "challenge-id-here",
    "language": "javascript",
    "code": "function solution(input) {\n  return input.split('').reverse().join('');\n}"
  }
}
```

## Subscriptions

### Real-time updates

#### Subscribe to new blog posts

```graphql
subscription OnPostAdded($includeUnpublished: Boolean) {
  postAdded(includeUnpublished: $includeUnpublished) {
    id
    title
    slug
    excerpt
    status
    createdAt
    author {
      username
    }
  }
}
```

#### Subscribe to new comments on a post

```graphql
subscription OnCommentAdded($postId: ID, $includePending: Boolean) {
  commentAdded(postId: $postId, includePending: $includePending) {
    id
    content
    status
    createdAt
    author {
      username
      avatarUrl
    }
  }
}
```

#### Subscribe to submission updates

```graphql
subscription OnSubmissionUpdated($challengeId: ID) {
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

#### Subscribe to activity feed

```graphql
subscription OnActivityFeed($types: [String!]) {
  activityFeed(types: $types) {
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

### Common error responses

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

### Rate limiting error

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

### Query complexity error

```json
{
  "errors": [
    {
      "message": "Query complexity limit exceeded. Maximum: 1000, Actual: 1250",
      "code": "QUERY_TOO_COMPLEX"
    }
  ]
}
```

## Best Practices

1. **Use fragments** for reusable field selections:

```graphql
fragment PostSummary on BlogPost {
  id
  title
  slug
  excerpt
  viewCount
  likeCount
  commentCount
  createdAt
  author {
    id
    username
    avatarUrl
  }
}

query GetPosts {
  posts {
    posts {
      ...PostSummary
    }
  }
}
```

2. **Implement proper error handling** in your client:

```javascript
const { data, errors } = await client.query({
  query: GET_POSTS,
  errorPolicy: 'all'
});

if (errors) {
  errors.forEach(error => {
    if (error.extensions?.code === 'RATE_LIMIT_EXCEEDED') {
      // Handle rate limiting
    } else if (error.extensions?.code === 'UNAUTHENTICATED') {
      // Redirect to login
    }
  });
}
```

3. **Use variables** instead of string interpolation:

```graphql
# Good
query GetPost($slug: String!) {
  post(slug: $slug) {
    title
  }
}

# Bad
query GetPost {
  post(slug: "my-post-slug") {
    title
  }
}
```

4. **Implement pagination** for large datasets:

```graphql
query GetPosts($after: String, $first: Int) {
  posts(after: $after, first: $first) {
    posts {
      id
      title
    }
    hasNextPage
    hasPreviousPage
  }
}
```