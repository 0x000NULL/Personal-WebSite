import { ObjectType, Field, ID, Int, Float } from 'type-graphql';

@ObjectType()
export class Repository {
  @Field(() => ID)
  id: number;

  @Field()
  name: string;

  @Field()
  fullName: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  htmlUrl: string;

  @Field({ nullable: true })
  language?: string;

  @Field(() => Int)
  stargazersCount: number;

  @Field(() => Int)
  forksCount: number;

  @Field(() => Int)
  watchersCount: number;

  @Field(() => Int)
  size: number;

  @Field()
  isPrivate: boolean;

  @Field()
  isFork: boolean;

  @Field()
  isArchived: boolean;

  @Field()
  isDisabled: boolean;

  @Field(() => [String])
  topics: string[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field()
  pushedAt: Date;

  @Field({ nullable: true })
  homepage?: string;

  @Field({ nullable: true })
  license?: string;

  @Field()
  defaultBranch: string;

  @Field(() => Int)
  openIssues: number;

  @Field()
  hasIssues: boolean;

  @Field()
  hasProjects: boolean;

  @Field()
  hasWiki: boolean;

  @Field()
  hasPages: boolean;

  @Field()
  hasDownloads: boolean;
}

@ObjectType()
export class GitHubProfile {
  @Field(() => ID)
  id: number;

  @Field()
  login: string;

  @Field({ nullable: true })
  name?: string;

  @Field()
  avatarUrl: string;

  @Field({ nullable: true })
  bio?: string;

  @Field({ nullable: true })
  company?: string;

  @Field({ nullable: true })
  location?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  blog?: string;

  @Field({ nullable: true })
  twitterUsername?: string;

  @Field(() => Int)
  publicRepos: number;

  @Field(() => Int)
  publicGists: number;

  @Field(() => Int)
  followers: number;

  @Field(() => Int)
  following: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class LanguageStats {
  @Field()
  name: string;

  @Field(() => Int)
  bytes: number;

  @Field(() => Float)
  percentage: number;

  @Field()
  color: string;
}

@ObjectType()
export class ContributionStats {
  @Field(() => Int)
  totalContributions: number;

  @Field(() => Int)
  totalCommits: number;

  @Field(() => Int)
  totalPRs: number;

  @Field(() => Int)
  totalIssues: number;

  @Field(() => Int)
  totalReviews: number;

  @Field(() => [RepoContribution])
  contributionsByRepo: RepoContribution[];
}

@ObjectType()
export class RepoContribution {
  @Field()
  repo: string;

  @Field(() => Int)
  commits: number;
}

@ObjectType()
export class GitHubActivity {
  @Field(() => GitHubProfile)
  profile: GitHubProfile;

  @Field(() => [Repository])
  repositories: Repository[];

  @Field(() => [Repository])
  pinnedRepositories: Repository[];

  @Field(() => [LanguageStats])
  languageStats: LanguageStats[];

  @Field(() => ContributionStats)
  contributionStats: ContributionStats;

  @Field(() => Int)
  totalBytes: number;
}

@ObjectType()
export class RepositoryConnection {
  @Field(() => [Repository])
  repositories: Repository[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field()
  hasNextPage: boolean;

  @Field()
  hasPreviousPage: boolean;
}