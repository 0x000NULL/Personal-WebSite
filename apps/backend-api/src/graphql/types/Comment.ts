import { ObjectType, Field, ID, Int, registerEnumType } from 'type-graphql';
import { User } from './User';

export enum CommentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SPAM = 'spam'
}

registerEnumType(CommentStatus, {
  name: 'CommentStatus',
  description: 'Comment status types'
});

@ObjectType()
export class Comment {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  postId: string;

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;

  @Field({ nullable: true })
  authorName?: string;

  @Field({ nullable: true })
  authorEmail?: string;

  @Field({ nullable: true })
  authorWebsite?: string;

  @Field()
  content: string;

  @Field({ nullable: true })
  contentHtml?: string;

  @Field(() => CommentStatus)
  status: CommentStatus;

  @Field()
  isGuest: boolean;

  @Field(() => Int)
  likeCount: number;

  @Field(() => Int)
  replyCount: number;

  @Field(() => Int)
  depth: number;

  @Field({ nullable: true })
  approvedAt?: Date;

  @Field(() => ID, { nullable: true })
  approvedBy?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Relations
  @Field(() => User, { nullable: true })
  author?: User;

  @Field(() => Comment, { nullable: true })
  parent?: Comment;

  @Field(() => [Comment], { nullable: true })
  replies?: Comment[];

  // Virtual fields
  @Field()
  isLiked?: boolean;

  @Field()
  canEdit?: boolean;

  @Field()
  canModerate?: boolean;
}

@ObjectType()
export class CommentConnection {
  @Field(() => [Comment])
  comments: Comment[];

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

@ObjectType()
export class CommentStats {
  @Field(() => Int)
  total: number;

  @Field(() => Int)
  approved: number;

  @Field(() => Int)
  pending: number;

  @Field(() => Int)
  rejected: number;

  @Field(() => Int)
  spam: number;
}