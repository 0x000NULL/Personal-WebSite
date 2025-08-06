import { ObjectType, Field, ID, Int, Float } from 'type-graphql';

@ObjectType()
export class SiteStats {
  @Field(() => Int)
  totalPosts: number;

  @Field(() => Int)
  publishedPosts: number;

  @Field(() => Int)
  totalComments: number;

  @Field(() => Int)
  approvedComments: number;

  @Field(() => Int)
  totalUsers: number;

  @Field(() => Int)
  activeUsers: number;

  @Field(() => Int)
  totalChallenges: number;

  @Field(() => Int)
  activeChallenges: number;

  @Field(() => Int)
  totalSubmissions: number;

  @Field(() => Int)
  acceptedSubmissions: number;

  @Field(() => Float)
  overallSuccessRate: number;

  @Field(() => Int)
  totalViews: number;

  @Field(() => Int)
  uniqueVisitors: number;

  @Field(() => Int)
  totalLikes: number;

  @Field()
  lastUpdated: Date;
}

@ObjectType()
export class PopularPost {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  slug: string;

  @Field(() => Int)
  viewCount: number;

  @Field(() => Int)
  likeCount: number;

  @Field(() => Int)
  commentCount: number;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class PopularChallenge {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  slug: string;

  @Field(() => Int)
  submissionCount: number;

  @Field(() => Int)
  solvedCount: number;

  @Field(() => Float)
  successRate: number;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class RecentActivity {
  @Field(() => ID)
  id: string;

  @Field()
  type: string; // 'post', 'comment', 'submission', 'user_signup'

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  userId?: string;

  @Field({ nullable: true })
  username?: string;

  @Field()
  createdAt: Date;
}

@ObjectType()
export class AnalyticsOverview {
  @Field(() => SiteStats)
  stats: SiteStats;

  @Field(() => [PopularPost])
  popularPosts: PopularPost[];

  @Field(() => [PopularChallenge])
  popularChallenges: PopularChallenge[];

  @Field(() => [RecentActivity])
  recentActivity: RecentActivity[];

  @Field(() => [DailyStats])
  dailyStats: DailyStats[];
}

@ObjectType()
export class DailyStats {
  @Field()
  date: Date;

  @Field(() => Int)
  views: number;

  @Field(() => Int)
  visitors: number;

  @Field(() => Int)
  submissions: number;

  @Field(() => Int)
  newUsers: number;

  @Field(() => Int)
  newPosts: number;

  @Field(() => Int)
  newComments: number;
}