import { 
  Resolver, 
  Subscription, 
  Root, 
  Arg, 
  Ctx,
  ID,
  PubSub,
  Publisher
} from 'type-graphql';
import { BlogPost } from '../types/BlogPost';
import { Comment } from '../types/Comment';
import { ChallengeSubmission } from '../types/CodingChallenge';
import { RecentActivity } from '../types/SiteStats';
import { Context } from '../context';

// Subscription topics
export const SUBSCRIPTION_TOPICS = {
  POST_ADDED: 'POST_ADDED',
  POST_UPDATED: 'POST_UPDATED',
  POST_DELETED: 'POST_DELETED',
  COMMENT_ADDED: 'COMMENT_ADDED',
  COMMENT_UPDATED: 'COMMENT_UPDATED',
  COMMENT_DELETED: 'COMMENT_DELETED',
  COMMENT_MODERATED: 'COMMENT_MODERATED',
  SUBMISSION_UPDATED: 'SUBMISSION_UPDATED',
  ACTIVITY_FEED: 'ACTIVITY_FEED',
  USER_ONLINE: 'USER_ONLINE',
  USER_OFFLINE: 'USER_OFFLINE'
} as const;

@Resolver()
export class SubscriptionResolver {
  @Subscription(() => BlogPost, {
    topics: SUBSCRIPTION_TOPICS.POST_ADDED,
    filter: ({ payload, args }) => {
      // Only notify for published posts unless user is authenticated
      if (args.includeUnpublished) {
        return true;
      }
      return payload.status === 'published' && payload.visibility === 'public';
    }
  })
  postAdded(
    @Root() post: BlogPost,
    @Arg('includeUnpublished', { defaultValue: false }) includeUnpublished: boolean,
    @Ctx() ctx?: Context
  ): BlogPost {
    return post;
  }

  @Subscription(() => BlogPost, {
    topics: SUBSCRIPTION_TOPICS.POST_UPDATED,
    filter: ({ payload, args }) => {
      // Only notify for published posts unless user is authenticated
      if (args.includeUnpublished) {
        return true;
      }
      return payload.status === 'published' && payload.visibility === 'public';
    }
  })
  postUpdated(
    @Root() post: BlogPost,
    @Arg('includeUnpublished', { defaultValue: false }) includeUnpublished: boolean,
    @Ctx() ctx?: Context
  ): BlogPost {
    return post;
  }

  @Subscription(() => String, {
    topics: SUBSCRIPTION_TOPICS.POST_DELETED
  })
  postDeleted(
    @Root() postId: string,
    @Ctx() ctx?: Context
  ): string {
    return postId;
  }

  @Subscription(() => Comment, {
    topics: SUBSCRIPTION_TOPICS.COMMENT_ADDED,
    filter: ({ payload, args }) => {
      // Filter by post ID if specified
      if (args.postId && payload.postId !== args.postId) {
        return false;
      }
      // Only notify for approved comments unless includePending is true
      if (!args.includePending && payload.status !== 'approved') {
        return false;
      }
      return true;
    }
  })
  commentAdded(
    @Root() comment: Comment,
    @Arg('postId', () => ID, { nullable: true }) postId?: string,
    @Arg('includePending', { defaultValue: false }) includePending?: boolean,
    @Ctx() ctx?: Context
  ): Comment {
    return comment;
  }

  @Subscription(() => Comment, {
    topics: SUBSCRIPTION_TOPICS.COMMENT_UPDATED,
    filter: ({ payload, args }) => {
      // Filter by post ID if specified
      if (args.postId && payload.postId !== args.postId) {
        return false;
      }
      return true;
    }
  })
  commentUpdated(
    @Root() comment: Comment,
    @Arg('postId', () => ID, { nullable: true }) postId?: string,
    @Ctx() ctx?: Context
  ): Comment {
    return comment;
  }

  @Subscription(() => String, {
    topics: SUBSCRIPTION_TOPICS.COMMENT_DELETED
  })
  commentDeleted(
    @Root() commentId: string,
    @Ctx() ctx?: Context
  ): string {
    return commentId;
  }

  @Subscription(() => Comment, {
    topics: SUBSCRIPTION_TOPICS.COMMENT_MODERATED,
    filter: ({ payload, args }) => {
      // Filter by post ID if specified
      if (args.postId && payload.postId !== args.postId) {
        return false;
      }
      return true;
    }
  })
  commentModerated(
    @Root() comment: Comment,
    @Arg('postId', () => ID, { nullable: true }) postId?: string,
    @Ctx() ctx?: Context
  ): Comment {
    return comment;
  }

  @Subscription(() => ChallengeSubmission, {
    topics: SUBSCRIPTION_TOPICS.SUBMISSION_UPDATED,
    filter: ({ payload, args, context }) => {
      // Only notify the user who made the submission
      if (context.user && payload.userId === context.user.id) {
        return true;
      }
      // Or if it's for a specific challenge and user is authenticated
      if (args.challengeId && payload.challengeId === args.challengeId && context.user) {
        return true;
      }
      return false;
    }
  })
  submissionUpdated(
    @Root() submission: ChallengeSubmission,
    @Arg('challengeId', () => ID, { nullable: true }) challengeId?: string,
    @Ctx() ctx?: Context
  ): ChallengeSubmission {
    return submission;
  }

  @Subscription(() => RecentActivity, {
    topics: SUBSCRIPTION_TOPICS.ACTIVITY_FEED,
    filter: ({ payload, args }) => {
      // Filter by activity type if specified
      if (args.types && args.types.length > 0) {
        return args.types.includes(payload.type);
      }
      return true;
    }
  })
  activityFeed(
    @Root() activity: RecentActivity,
    @Arg('types', () => [String], { nullable: true }) types?: string[],
    @Ctx() ctx?: Context
  ): RecentActivity {
    return activity;
  }

  @Subscription(() => String, {
    topics: SUBSCRIPTION_TOPICS.USER_ONLINE
  })
  userOnline(
    @Root() userId: string,
    @Ctx() ctx?: Context
  ): string {
    return userId;
  }

  @Subscription(() => String, {
    topics: SUBSCRIPTION_TOPICS.USER_OFFLINE
  })
  userOffline(
    @Root() userId: string,
    @Ctx() ctx?: Context
  ): string {
    return userId;
  }
}

// Subscription helpers to publish events
export class SubscriptionPublisher {
  constructor(private pubSub: PubSub) {}

  async publishPostAdded(post: BlogPost): Promise<void> {
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.POST_ADDED, post);
    
    // Also publish to activity feed
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.ACTIVITY_FEED, {
      id: `post-${post.id}`,
      type: 'post',
      title: `New Post: ${post.title}`,
      description: post.excerpt || 'New blog post published',
      userId: post.authorId,
      username: post.author?.username,
      createdAt: post.createdAt
    });
  }

  async publishPostUpdated(post: BlogPost): Promise<void> {
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.POST_UPDATED, post);
  }

  async publishPostDeleted(postId: string): Promise<void> {
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.POST_DELETED, postId);
  }

  async publishCommentAdded(comment: Comment): Promise<void> {
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.COMMENT_ADDED, comment);
    
    // Also publish to activity feed
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.ACTIVITY_FEED, {
      id: `comment-${comment.id}`,
      type: 'comment',
      title: 'New Comment',
      description: comment.content.substring(0, 100) + (comment.content.length > 100 ? '...' : ''),
      userId: comment.userId,
      username: comment.author?.username || comment.authorName,
      createdAt: comment.createdAt
    });
  }

  async publishCommentUpdated(comment: Comment): Promise<void> {
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.COMMENT_UPDATED, comment);
  }

  async publishCommentDeleted(commentId: string): Promise<void> {
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.COMMENT_DELETED, commentId);
  }

  async publishCommentModerated(comment: Comment): Promise<void> {
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.COMMENT_MODERATED, comment);
  }

  async publishSubmissionUpdated(submission: ChallengeSubmission): Promise<void> {
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.SUBMISSION_UPDATED, submission);
    
    // Also publish to activity feed
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.ACTIVITY_FEED, {
      id: `submission-${submission.id}`,
      type: 'submission',
      title: 'Challenge Submission Updated',
      description: `Status: ${submission.status}`,
      userId: submission.userId,
      username: submission.user?.username,
      createdAt: submission.updatedAt
    });
  }

  async publishUserOnline(userId: string): Promise<void> {
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.USER_ONLINE, userId);
  }

  async publishUserOffline(userId: string): Promise<void> {
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.USER_OFFLINE, userId);
  }

  async publishActivity(activity: RecentActivity): Promise<void> {
    await this.pubSub.publish(SUBSCRIPTION_TOPICS.ACTIVITY_FEED, activity);
  }
}