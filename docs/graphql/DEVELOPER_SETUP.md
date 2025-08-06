# GraphQL Developer Setup Guide

## Overview

This guide will walk you through setting up the GraphQL development environment, from initial installation to running your first queries. Whether you're a new team member or setting up a development environment, this guide has everything you need.

## Prerequisites

### System Requirements

- **Node.js**: Version 18.0 or higher
- **PostgreSQL**: Version 12 or higher  
- **Redis**: Version 6 or higher (for caching and subscriptions)
- **Git**: For version control
- **Docker** (optional): For containerized development

### Development Tools

- **IDE**: VS Code (recommended) with GraphQL extensions
- **Database Client**: pgAdmin, TablePlus, or similar
- **API Client**: GraphQL Playground, Apollo Studio, or Insomnia

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/personal-website.git
cd personal-website
```

### 2. Install Dependencies

Navigate to the backend API directory and install GraphQL dependencies:

```bash
cd apps/backend-api

# Install GraphQL dependencies using the provided script
node install-graphql-deps.js

# Or install manually
npm install apollo-server-express graphql type-graphql dataloader
npm install graphql-query-complexity graphql-depth-limit
npm install subscriptions-transport-ws graphql-subscriptions
npm install @apollo/server @apollo/server-express
```

### 3. Environment Configuration

Create a `.env` file in the `apps/backend-api` directory:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/personal_website
DB_HOST=localhost
DB_PORT=5432
DB_NAME=personal_website
DB_USER=your_username
DB_PASSWORD=your_password

# Redis Configuration (for subscriptions and caching)
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# GitHub Integration (optional)
GITHUB_TOKEN=your-github-personal-access-token
GITHUB_USERNAME=your-github-username

# Server Configuration
PORT=3001
NODE_ENV=development

# GraphQL Configuration
GRAPHQL_INTROSPECTION=true
GRAPHQL_PLAYGROUND=true
GRAPHQL_DEBUG=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000

# Query Complexity
MAX_QUERY_COMPLEXITY=1000
MAX_QUERY_DEPTH=10
```

### 4. Database Setup

#### Using Docker (Recommended)

```bash
# Start PostgreSQL and Redis with Docker Compose
docker-compose up -d postgres redis

# Wait for services to be ready
docker-compose logs postgres
```

#### Manual Installation

**PostgreSQL Setup:**
```bash
# Install PostgreSQL (macOS)
brew install postgresql
brew services start postgresql

# Install PostgreSQL (Ubuntu)
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database
createdb personal_website
```

**Redis Setup:**
```bash
# Install Redis (macOS)
brew install redis
brew services start redis

# Install Redis (Ubuntu)  
sudo apt install redis-server
sudo systemctl start redis-server
```

### 5. Run Database Migrations

```bash
# Navigate to database directory
cd ../../infrastructure/database

# Run migrations
psql $DATABASE_URL -f run_migrations.sql

# Run seeds (optional)
psql $DATABASE_URL -f run_seeds.sql
```

### 6. Start the Development Server

```bash
# Navigate back to backend-api
cd ../../apps/backend-api

# Start the server
npm run dev

# Or start with debugging
npm run dev:debug
```

The server will start on `http://localhost:3001` with GraphQL endpoint at `/graphql`.

## Development Environment

### VS Code Extensions

Install these recommended extensions:

```json
{
  "recommendations": [
    "GraphQL.vscode-graphql",
    "GraphQL.vscode-graphql-syntax", 
    "apollographql.vscode-apollo",
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint"
  ]
}
```

### VS Code Configuration

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "graphql.useSchemaFileForIntrospection": true,
  "apollographql.telemetry": false
}
```

### GraphQL Schema Configuration

Create `graphql.config.js` in the project root:

```javascript
module.exports = {
  projects: {
    app: {
      schema: ['apps/backend-api/src/graphql/schema.ts'],
      documents: ['apps/frontend/**/*.{graphql,js,ts,jsx,tsx}'],
      extensions: {
        endpoints: {
          default: {
            url: 'http://localhost:3001/graphql',
            headers: {
              Authorization: 'Bearer ${env:GRAPHQL_TOKEN}'
            }
          }
        }
      }
    }
  }
};
```

## Development Workflow

### 1. Schema Development

#### Adding New Types

Create type definition in `src/graphql/types/`:

```typescript
// src/graphql/types/NewType.ts
import { ObjectType, Field, ID, Int } from 'type-graphql';

@ObjectType()
export class NewType {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => Int)
  count: number;

  @Field()
  createdAt: Date;
}
```

#### Adding Input Types

Create input definition in `src/graphql/inputs/`:

```typescript
// src/graphql/inputs/NewTypeInput.ts
import { InputType, Field } from 'type-graphql';

@InputType()
export class CreateNewTypeInput {
  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;
}
```

#### Creating Resolvers

Create resolver in `src/graphql/resolvers/`:

```typescript
// src/graphql/resolvers/NewTypeResolver.ts
import { Resolver, Query, Mutation, Arg, Ctx, Authorized } from 'type-graphql';
import { NewType } from '../types/NewType';
import { CreateNewTypeInput } from '../inputs/NewTypeInput';
import { Context } from '../context';

@Resolver(() => NewType)
export class NewTypeResolver {
  @Query(() => [NewType])
  async newTypes(@Ctx() context: Context): Promise<NewType[]> {
    // Implementation here
    return [];
  }

  @Authorized()
  @Mutation(() => NewType)
  async createNewType(
    @Arg('input') input: CreateNewTypeInput,
    @Ctx() context: Context
  ): Promise<NewType> {
    // Implementation here
    return {} as NewType;
  }
}
```

#### Register Resolver

Add to `src/graphql/schema.ts`:

```typescript
import { NewTypeResolver } from './resolvers/NewTypeResolver';

export async function createGraphQLSchema() {
  return await buildSchema({
    resolvers: [
      // ... existing resolvers
      NewTypeResolver,
    ],
    // ... other options
  });
}
```

### 2. Testing Queries

#### Using GraphQL Playground

1. Open `http://localhost:3001/graphql`
2. Use the schema explorer to discover available queries
3. Test queries with variables:

```graphql
query TestQuery($limit: Int!) {
  posts(pagination: { limit: $limit }) {
    posts {
      id
      title
    }
  }
}
```

Variables:
```json
{
  "limit": 5
}
```

#### Using curl

```bash
# Simple query
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ siteStats { totalPosts } }"}'

# Query with variables
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "query": "query GetPosts($limit: Int!) { posts(pagination: { limit: $limit }) { posts { title } } }",
    "variables": { "limit": 3 }
  }'
```

### 3. Database Development

#### Adding Migrations

Create new migration file in `infrastructure/database/migrations/`:

```sql
-- 007_add_new_table.sql
CREATE TABLE new_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_new_table_name ON new_table(name);

-- Add trigger for updated_at
CREATE TRIGGER trigger_new_table_updated_at
    BEFORE UPDATE ON new_table
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

#### Adding Seeds

Create seed file in `infrastructure/database/seed/`:

```sql
-- 005_seed_new_table.sql  
INSERT INTO new_table (name, description) VALUES
    ('Sample 1', 'First sample record'),
    ('Sample 2', 'Second sample record'),
    ('Sample 3', 'Third sample record');
```

#### Running Migrations

```bash
# Run specific migration
psql $DATABASE_URL -f infrastructure/database/migrations/007_add_new_table.sql

# Run all migrations
psql $DATABASE_URL -f infrastructure/database/run_migrations.sql

# Run seeds
psql $DATABASE_URL -f infrastructure/database/run_seeds.sql
```

### 4. Subscription Development

#### Setting up WebSocket Client

```typescript
// Test subscription client
import { SubscriptionClient } from 'subscriptions-transport-ws';
import WebSocket from 'ws';

const wsClient = new SubscriptionClient(
  'ws://localhost:3001/graphql-subscriptions',
  {
    reconnect: true,
    connectionParams: {
      authorization: 'Bearer your-jwt-token'
    }
  },
  WebSocket
);

// Subscribe to updates
const subscription = wsClient.request({
  query: `
    subscription {
      postAdded {
        id
        title
        author { username }
      }
    }
  `
}).subscribe({
  next: (data) => console.log('New post:', data),
  error: (err) => console.error('Subscription error:', err),
  complete: () => console.log('Subscription completed')
});
```

## Debugging

### 1. GraphQL Query Debugging

Enable debug logging in development:

```typescript
// src/graphql/server.ts
const server = new ApolloServer({
  schema,
  context: createContext,
  debug: process.env.NODE_ENV === 'development',
  formatError: (error) => {
    console.error('GraphQL Error:', error);
    return error;
  },
  plugins: [
    {
      requestDidStart() {
        return {
          didResolveOperation(requestContext) {
            console.log('Operation:', requestContext.request.operationName);
          },
          didEncounterErrors(requestContext) {
            console.error('GraphQL errors:', requestContext.errors);
          }
        };
      }
    }
  ]
});
```

### 2. Database Query Debugging

Enable SQL logging:

```typescript
// src/utils/database.ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Log all queries in development
  ...(process.env.NODE_ENV === 'development' && {
    log: (message) => console.log('SQL:', message)
  })
});
```

### 3. DataLoader Debugging

Add logging to DataLoaders:

```typescript
// src/graphql/dataloaders/index.ts
export const createUserLoader = () => new DataLoader(
  async (userIds: readonly string[]) => {
    console.log('DataLoader: Loading users', userIds);
    const users = await User.findByIds([...userIds]);
    console.log('DataLoader: Loaded', users.length, 'users');
    return userIds.map(id => users.find(user => user.id === id) || null);
  },
  {
    cacheKeyFn: (key) => key,
    name: 'UserLoader' // For debugging
  }
);
```

### 4. Performance Monitoring

Add query performance logging:

```typescript
// src/graphql/middleware/performance.ts
export const performancePlugin = {
  requestDidStart() {
    return {
      willSendResponse(requestContext) {
        const { request, response } = requestContext;
        const duration = Date.now() - requestContext.request.http?.startTime;
        
        console.log({
          operationName: request.operationName,
          duration: `${duration}ms`,
          complexity: requestContext.request.query?.complexity,
          cacheHits: requestContext.cache?.hits,
          errors: response.errors?.length || 0
        });
      }
    };
  }
};
```

## Testing

### 1. Unit Testing Setup

Install testing dependencies:

```bash
npm install --save-dev jest @types/jest ts-jest @apollo/server-testing
```

Create `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts']
};
```

### 2. GraphQL Testing Example

```typescript
// src/__tests__/BlogPost.test.ts
import { createTestClient } from '@apollo/server-testing';
import { gql } from 'apollo-server-express';
import { createGraphQLSchema } from '../graphql/schema';
import { createTestContext } from '../test/utils';

describe('BlogPost Resolver', () => {
  let testClient: any;

  beforeAll(async () => {
    const schema = await createGraphQLSchema();
    testClient = createTestClient({
      schema,
      context: createTestContext()
    });
  });

  describe('posts query', () => {
    it('should return published posts', async () => {
      const GET_POSTS = gql`
        query GetPosts {
          posts {
            posts {
              id
              title
              status
            }
          }
        }
      `;

      const response = await testClient.query({
        query: GET_POSTS
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.posts.posts).toBeDefined();
      expect(response.data.posts.posts.length).toBeGreaterThan(0);
      
      // All posts should be published for anonymous users
      response.data.posts.posts.forEach((post: any) => {
        expect(post.status).toBe('PUBLISHED');
      });
    });
  });

  describe('createPost mutation', () => {
    it('should create a new post with admin role', async () => {
      const CREATE_POST = gql`
        mutation CreatePost($input: CreateBlogPostInput!) {
          createPost(input: $input) {
            id
            title
            status
          }
        }
      `;

      const response = await testClient.mutate({
        mutation: CREATE_POST,
        variables: {
          input: {
            title: 'Test Post',
            content: 'Test content'
          }
        }
      });

      expect(response.errors).toBeUndefined();
      expect(response.data.createPost.title).toBe('Test Post');
      expect(response.data.createPost.status).toBe('DRAFT');
    });
  });
});
```

### 3. Integration Testing

```typescript
// src/__tests__/integration.test.ts
import request from 'supertest';
import { app } from '../app';

describe('GraphQL Integration', () => {
  it('should handle graphql queries via HTTP', async () => {
    const query = `
      query {
        siteStats {
          totalPosts
          totalUsers
        }
      }
    `;

    const response = await request(app)
      .post('/graphql')
      .send({ query })
      .expect(200);

    expect(response.body.data.siteStats).toBeDefined();
    expect(typeof response.body.data.siteStats.totalPosts).toBe('number');
  });

  it('should require authentication for protected mutations', async () => {
    const mutation = `
      mutation {
        createPost(input: { title: "Test", content: "Test" }) {
          id
        }
      }
    `;

    const response = await request(app)
      .post('/graphql')
      .send({ query: mutation })
      .expect(200);

    expect(response.body.errors).toBeDefined();
    expect(response.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });
});
```

## Production Deployment

### 1. Environment Configuration

Create production `.env`:

```env
# Production Database
DATABASE_URL=postgresql://prod_user:prod_pass@db-host:5432/prod_db

# Redis for production
REDIS_URL=redis://redis-host:6379

# Security
JWT_SECRET=super-secure-production-secret
NODE_ENV=production

# GraphQL Production Settings
GRAPHQL_INTROSPECTION=false
GRAPHQL_PLAYGROUND=false
GRAPHQL_DEBUG=false

# Performance
MAX_QUERY_COMPLEXITY=500
RATE_LIMIT_MAX_REQUESTS=100
```

### 2. Docker Configuration

Create `Dockerfile` for production:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/backend-api/package*.json ./apps/backend-api/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY apps/backend-api ./apps/backend-api

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start application
CMD ["npm", "run", "start:prod"]
```

### 3. Docker Compose for Production

```yaml
version: '3.8'

services:
  graphql-api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/db
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: personal_website
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  postgres_data:
```

## Troubleshooting

### Common Issues

#### 1. GraphQL Playground Not Loading

**Problem**: Playground shows blank page or errors

**Solutions**:
- Check `GRAPHQL_PLAYGROUND=true` in `.env`
- Verify server is running on correct port
- Check browser console for CORS errors
- Clear browser cache

#### 2. Authentication Errors

**Problem**: "Authentication required" for public queries

**Solutions**:
- Check JWT_SECRET is set correctly
- Verify token format: `Bearer <token>`
- Check token expiration
- Verify user exists in database

#### 3. Database Connection Issues

**Problem**: "Connection refused" or timeout errors

**Solutions**:
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check if database exists
psql -l | grep personal_website

# Verify credentials
echo $DATABASE_URL
```

#### 4. Redis Connection Issues

**Problem**: Subscriptions not working

**Solutions**:
```bash
# Test Redis connection
redis-cli ping

# Check Redis is running
redis-cli info server

# Verify Redis URL
echo $REDIS_URL
```

#### 5. Query Complexity Errors

**Problem**: "Query too complex" errors

**Solutions**:
- Reduce query depth or field selection
- Use pagination for large datasets
- Increase `MAX_QUERY_COMPLEXITY` if appropriate
- Consider breaking query into multiple requests

### Debug Commands

```bash
# Check server logs
npm run dev 2>&1 | tee server.log

# Test GraphQL endpoint
curl -X POST http://localhost:3001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { queryType { name } } }"}'

# Validate schema
npm run graphql:validate

# Generate schema file
npm run graphql:schema

# Database health check
psql $DATABASE_URL -c "SELECT COUNT(*) FROM blog_posts;"

# Redis health check
redis-cli ping
```

### Performance Monitoring

Monitor these metrics in production:

- Query execution time
- DataLoader cache hit rates  
- Subscription connection counts
- Rate limit violations
- Error rates by type
- Database query performance

This comprehensive setup guide should get you up and running with the GraphQL development environment. For additional help, refer to the other documentation files or reach out to the development team.