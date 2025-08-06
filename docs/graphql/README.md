# GraphQL API Documentation

Welcome to the comprehensive documentation for the Personal Website GraphQL API. This documentation covers everything from getting started to advanced usage patterns and development workflows.

## 📚 Documentation Index

### Getting Started
- **[Developer Setup Guide](./DEVELOPER_SETUP.md)** - Complete setup instructions for development environment
- **[User Guide](./USER_GUIDE.md)** - Practical examples and common use cases  
- **[API Reference](./API_REFERENCE.md)** - Complete API reference with all queries, mutations, and subscriptions

### Technical Documentation
- **[Schema Documentation](./SCHEMA_DOCUMENTATION.md)** - Detailed schema types, relationships, and validation rules
- **[Resolver Documentation](./RESOLVER_DOCUMENTATION.md)** - In-depth resolver implementation details

### Quick Links
- [GraphQL Playground (Development)](http://localhost:3001/graphql)
- [Original Implementation README](../../apps/backend-api/src/graphql/README.md)
- [Query Examples](../../apps/backend-api/src/graphql/examples/queries.md)

## 🚀 Quick Start

### 1. For Frontend Developers

If you're building a frontend application and want to use the GraphQL API:

1. **Start here**: [User Guide](./USER_GUIDE.md)
2. **Reference**: [API Reference](./API_REFERENCE.md) for complete API details
3. **Examples**: Check the [Query Examples](../../apps/backend-api/src/graphql/examples/queries.md)

### 2. For Backend Developers

If you're working on the GraphQL implementation itself:

1. **Setup**: [Developer Setup Guide](./DEVELOPER_SETUP.md) 
2. **Architecture**: [Schema Documentation](./SCHEMA_DOCUMENTATION.md)
3. **Implementation**: [Resolver Documentation](./RESOLVER_DOCUMENTATION.md)

### 3. For API Consumers

If you're integrating with the API from external systems:

1. **Getting Started**: [API Reference](./API_REFERENCE.md)
2. **Authentication**: See the Authentication section in the API Reference
3. **Rate Limits**: Review the rate limiting information

## 🏗️ API Overview

The GraphQL API provides a modern, flexible interface for accessing all the personal website's functionality:

### Core Features
- **Blog System**: Full-featured blog with posts, comments, and tags
- **Coding Challenges**: Programming challenge platform with submissions
- **GitHub Integration**: Live repository and activity data
- **Real-time Updates**: WebSocket subscriptions for live updates
- **User Management**: Authentication, authorization, and user profiles

### Key Benefits
- **Type Safety**: Strongly typed schema with TypeScript integration
- **Flexible Queries**: Request exactly the data you need
- **Real-time**: WebSocket subscriptions for live updates
- **Performance**: DataLoader optimization and intelligent caching
- **Security**: Rate limiting, query complexity analysis, and authorization

## 📖 Documentation Structure

```
docs/graphql/
├── README.md                    # This overview document
├── API_REFERENCE.md            # Complete API reference
├── SCHEMA_DOCUMENTATION.md     # Schema types and relationships  
├── RESOLVER_DOCUMENTATION.md   # Resolver implementation details
├── USER_GUIDE.md              # Practical usage examples
└── DEVELOPER_SETUP.md         # Development environment setup
```

## 🔧 API Endpoints

| Endpoint | Protocol | Purpose |
|----------|----------|---------|
| `/graphql` | HTTP/HTTPS | Queries and Mutations |
| `/graphql-subscriptions` | WebSocket | Real-time Subscriptions |

## 🔐 Authentication

The API supports multiple authentication methods:

1. **JWT Bearer Token** (Recommended)
   ```
   Authorization: Bearer <your-jwt-token>
   ```

2. **Cookie Authentication**  
   ```
   Cookie: token=<your-jwt-token>
   ```

3. **Query Parameter** (Development only)
   ```
   ?token=<your-jwt-token>
   ```

## 📊 Rate Limits

| User Type | Requests/Minute | Query Complexity |
|-----------|-----------------|------------------|
| Anonymous | 100 | 500 |
| User | 300 | 750 |
| Editor | 500 | 1000 |
| Admin | 1000 | 2000 |

## 🎯 Common Use Cases

### Blog Frontend
```graphql
query GetPosts {
  posts(pagination: { limit: 10 }) {
    posts {
      id
      title
      slug
      excerpt
      author { username }
      tags { name color }
    }
  }
}
```

### Real-time Comments
```graphql
subscription NewComments($postId: ID!) {
  commentAdded(postId: $postId) {
    id
    content
    author { username }
  }
}
```

### Coding Challenge
```graphql
mutation SubmitSolution($input: SubmitChallengeInput!) {
  submitChallenge(input: $input) {
    id
    status
    score
  }
}
```

## 🛠️ Development Tools

### GraphQL Playground
Interactive query builder and documentation explorer:
- Development: `http://localhost:3001/graphql`
- Features: Auto-completion, schema exploration, query history

### Apollo Studio
Advanced GraphQL development and monitoring:
- Schema registry and validation
- Performance monitoring
- Client integration

### VS Code Extensions
Recommended extensions for GraphQL development:
- GraphQL Language Support
- Apollo GraphQL
- GraphQL Syntax Highlighting

## 🧪 Testing

### Query Testing
```typescript
import { createTestClient } from '@apollo/server-testing';

const { query } = createTestClient(server);
const response = await query({
  query: GET_POSTS_QUERY
});
```

### Integration Testing
```typescript
import request from 'supertest';

const response = await request(app)
  .post('/graphql')
  .send({ query: '{ siteStats { totalPosts } }' });
```

## 📈 Performance

### Optimization Features
- **DataLoader**: Prevents N+1 query problems
- **Query Complexity Analysis**: Prevents expensive queries
- **Rate Limiting**: Protects against abuse
- **Caching**: Redis-based caching for expensive operations

### Monitoring
Key metrics to track:
- Query execution time
- DataLoader cache hit rates
- Subscription connection counts
- Rate limit violations

## 🔍 Troubleshooting

### Common Issues

**GraphQL Playground not loading**
- Check `GRAPHQL_PLAYGROUND=true` in environment
- Verify server is running on correct port

**Authentication errors**
- Verify JWT token format and expiration
- Check user permissions for protected operations

**Query complexity errors**
- Reduce query depth or field selection
- Use pagination for large datasets

**Subscription connection issues**
- Verify WebSocket endpoint and authentication
- Check Redis connection for pub/sub

## 🤝 Contributing

### Adding New Features

1. **Schema Changes**: Update type definitions in `src/graphql/types/`
2. **Resolvers**: Implement resolvers in `src/graphql/resolvers/`
3. **Tests**: Add comprehensive tests for new functionality
4. **Documentation**: Update relevant documentation files

### Code Standards

- Follow TypeScript best practices
- Use TypeGraphQL decorators for type safety
- Implement proper error handling
- Add DataLoader optimization for relationships
- Include comprehensive tests

## 📞 Support & Resources

- **GitHub Issues**: Report bugs and feature requests
- **Team Chat**: Internal development discussions
- **API Status**: Monitor API health and performance
- **Changelog**: Track API changes and updates

## 🔄 API Versioning

The GraphQL API follows these versioning principles:

- **Additive Changes**: New fields and types can be added safely
- **Deprecation**: Old fields marked with `@deprecated` before removal  
- **Breaking Changes**: Communicated well in advance with migration guides
- **Schema Evolution**: Backward compatibility maintained where possible

## 📋 Changelog

### Latest Updates

- ✅ Complete GraphQL implementation with TypeGraphQL
- ✅ Real-time subscriptions via WebSocket
- ✅ DataLoader optimization for N+1 prevention
- ✅ Query complexity analysis and rate limiting
- ✅ Comprehensive test coverage
- ✅ Production-ready deployment configuration

---

## 📖 Where to Go Next

### New to GraphQL?
Start with the **[User Guide](./USER_GUIDE.md)** for practical examples and common patterns.

### Setting up Development?
Follow the **[Developer Setup Guide](./DEVELOPER_SETUP.md)** for complete environment setup.

### Need API Details?
Check the **[API Reference](./API_REFERENCE.md)** for comprehensive API documentation.

### Working on Implementation?
Review the **[Schema Documentation](./SCHEMA_DOCUMENTATION.md)** and **[Resolver Documentation](./RESOLVER_DOCUMENTATION.md)**.

**Happy coding! 🚀**