import { buildSchema } from 'type-graphql';
import { BlogPostResolver } from './resolvers/BlogPostResolver';
import { CommentResolver } from './resolvers/CommentResolver';
import { ChallengeResolver, ChallengeSubmissionResolver } from './resolvers/ChallengeResolver';
import { GitHubResolver } from './resolvers/GitHubResolver';
import { SiteStatsResolver } from './resolvers/SiteStatsResolver';
import { SubscriptionResolver } from './resolvers/SubscriptionResolver';
import { HealthResolver } from './resolvers/HealthResolver';
import { customAuthChecker } from './context';

export async function createGraphQLSchema() {
  return await buildSchema({
    resolvers: [
      BlogPostResolver,
      CommentResolver,
      ChallengeResolver,
      ChallengeSubmissionResolver,
      GitHubResolver,
      SiteStatsResolver,
      SubscriptionResolver,
      HealthResolver
    ],
    authChecker: customAuthChecker,
    validate: false, // Disable class-validator to avoid conflicts
    emitSchemaFile: process.env.NODE_ENV === 'development' ? 'schema.gql' : false,
  });
}